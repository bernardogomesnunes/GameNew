import { AIR, turned, isFluid, shapeOf } from '../config/blocks.js';
import { LOGS } from '../world/leafDecay.js';

/**
 * The way down to a ready-made mine (asked for directly: "I'd like to keep
 * the placement at 91 blocks deep, but it should open a stairs to the top").
 *
 * The mine goes down to its depth under where you aimed, and this cuts a
 * spiral stair beside it up to the surface: a 3×3 well round a stone pillar,
 * eight steps a turn, walled in stone where it passes through caves or water,
 * a lantern every turn, and a doorway at the bottom into the mine. The inside
 * of the mine is dug out too, so it works the moment it's placed.
 */

const STONE = 3, STONE_STAIRS = 29, LANTERN = 26;
const LEAVES = new Set([5, 42, 44, 517]);

// Round the well, the way up: each cell, and which way its stair climbs —
// towards the next cell (facing 0 climbs towards -z, 1 +x, 2 +z, 3 -x).
const RING = [[-1, -1, 1], [0, -1, 1], [1, -1, 2], [1, 0, 2], [1, 1, 3], [0, 1, 3], [-1, 1, 0], [-1, 0, 0]];
/** The ring cell beside the doorway, where the stair starts from the floor. */
const LANDING = 3;
/** The ring cell whose outer wall gets a lantern, once a turn. */
const LIT = 7;

/** Whether a block is ground to come up onto, rather than air, water, a tree or something small. */
function ground(id) {
  return id !== AIR && !isFluid(id) && !LEAVES.has(id) && !LOGS.has(id) && shapeOf(id) === 'cube';
}

/** The first air above the highest ground in a column, looking down from `from`. */
function groundTop(world, x, z, from, floor) {
  for (let y = from; y > floor; y--) if (ground(world.getBlock(x, y, z))) return y + 1;
  return floor + 1;
}

/**
 * The changes that dig out a mine at `region` (a ready-made one, square) and
 * cut its stair to the surface, on the first side of it where `fits(x, z)`
 * holds for the whole stairwell. `look` is how high up to start looking for
 * the surface. Returns { changes, side } — `side` null when no side fits, and
 * then only the mine's inside is dug.
 */
export function mineStairs(world, region, { look, fits = () => true } = {}) {
  const { minX, maxX, minZ, maxZ } = region;
  const floor = region.minY;
  const cells = new Map();
  const put = (x, y, z, next) => cells.set(`${x},${y},${z}`, { x, y, z, next });

  // The mine's inside, round its four props.
  for (let x = minX + 1; x < maxX; x++) {
    for (let z = minZ + 1; z < maxZ; z++) {
      const prop = (x === minX + 1 || x === maxX - 1) && (z === minZ + 1 || z === maxZ - 1);
      if (!prop) for (const dy of [1, 2]) put(x, floor + dy, z, AIR);
    }
  }

  // The stair, laid out on the mine's -x side, then turned to the side it
  // goes on: q quarter turns about the mine's middle, in doubled coordinates
  // so a square's half-cell middle stays whole.
  const cx2 = minX + maxX + 1, cz2 = minZ + maxZ + 1;
  const turn = (x, z, q) => {
    let ox = 2 * x + 1 - cx2, oz = 2 * z + 1 - cz2;
    for (let i = 0; i < q; i++) [ox, oz] = [-oz, ox];
    return [Math.floor((ox + cx2 - 1) / 2), Math.floor((oz + cz2 - 1) / 2)];
  };
  const door = Math.floor((minZ + maxZ) / 2);
  const wx = minX - 3, wz = door;

  for (let q = 0; q < 4; q++) {
    const at = (x, z) => turn(x, z, q);
    const footprint = [];
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) footprint.push(at(wx + dx, wz + dz));
    if (!footprint.every(([x, z]) => fits(x, z))) continue;

    // Up to the highest ground round the well, so it comes out on top.
    const from = Math.min(world.height - 3, look ?? world.height - 3);
    const top = Math.max(...footprint.map(([x, z]) => groundTop(world, x, z, from, floor)));
    const stair = new Map();
    for (let k = 1; floor + k < top; k++) {
      const [rx, rz, f] = RING[(LANDING + k) % RING.length];
      stair.set(`${rx},${rz},${floor + k}`, turned(STONE_STAIRS, f + q));
    }
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const [x, z] = at(wx + dx, wz + dz);
        const rim = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        put(x, floor, z, STONE);
        for (let y = floor + 1; y <= top + 2; y++) {
          if (rim) {
            // Walled where it passes through air or water, below the top.
            const was = world.getBlock(x, y, z);
            if (y < top && (was === AIR || isFluid(was) || LEAVES.has(was))) put(x, y, z, STONE);
          } else if (!dx && !dz) {
            put(x, y, z, y < top ? STONE : AIR);
          } else {
            put(x, y, z, stair.get(`${dx},${dz},${y}`) ?? AIR);
          }
        }
      }
    }
    // A lantern in the far wall once a turn, at head height off its step.
    const [lx, lz] = RING[LIT];
    for (let y = floor + 1; y < top; y++) {
      if (!stair.has(`${lx},${lz},${y}`) || y + 2 >= top) continue;
      const [x, z] = at(wx + 2 * lx, wz + 2 * lz);
      put(x, y + 2, z, LANTERN);
    }
    // The doorway: through the well's wall and the mine's.
    for (const dy of [1, 2]) {
      for (const x of [minX - 1, minX]) {
        const [tx, tz] = at(x, door);
        put(tx, floor + dy, tz, AIR);
      }
    }
    return { changes: diff(world, cells), side: q, top };
  }
  return { changes: diff(world, cells), side: null, top: null };
}

function diff(world, cells) {
  const out = [];
  for (const c of cells.values()) {
    const prev = world.getBlock(c.x, c.y, c.z);
    if (prev !== c.next) out.push({ x: c.x, y: c.y, z: c.z, prev, next: c.next });
  }
  return out;
}
