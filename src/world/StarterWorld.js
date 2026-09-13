import { World } from './World.js';
import { generateTerrain } from './TerrainGenerator.js';

/**
 * The world Duilt starts in: generated, not flattened — but with a river.
 *
 * Natural terrain is what makes the place worth looking at, so the land is
 * rolled as usual. What is *not* left to chance is water: a river is routed
 * across the whole map and pinned to pass close to where you begin. It needn't
 * run through your first 32 blocks — near enough to farm from the edge is
 * enough — and because it spans the map, every ring you unlock later has water
 * in it too, without any further arrangement.
 *
 * Trees are topped up near the start for the same reason: the first ten
 * minutes need wood, and noise is not obliged to provide any.
 */

const GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, SAND = 6, WATER = 11;

export const STARTER_SIZE = 32;
const RIVER_NEAR = 8;      // how close the river must pass to the settlement
const RIVER_DEPTH = 3;
const GROVE_TREES = 6;     // enough in one place to claim as a forest
const GROVE_SPAN = 9;      // how tightly the grove is packed

function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDuiltWorld({ sizeX = 256, sizeZ = 256, height = 64, seed = Date.now() % 1000000 } = {}) {
  const world = new World({ sizeX, sizeZ, height });
  generateTerrain(world, seed);
  const origin = carveRiverAndSettle(world, seed);
  return { world, origin };
}

/**
 * Cuts a river the length of the map, then makes sure the starting plot has
 * trees and somewhere safe to stand.
 */
export function carveRiverAndSettle(world, seed = 1) {
  const rand = rng(seed);
  const half = STARTER_SIZE / 2;
  const centreX = Math.floor(world.sizeX / 2);
  const centreZ = Math.floor(world.sizeZ / 2);
  const minX = centreX - half, minZ = centreZ - half;

  // One river is pinned near the settlement; the rest wander the map so water
  // looks like a feature of the world rather than a convenience placed for you.
  const rivers = [riverPath(world, centreX, centreZ, rand)];
  // Three more, spread across fixed bands rather than dropped at random:
  // left to chance, they bunch and leave a corner of the map bone dry.
  for (let i = 0; i < 3; i++) rivers.push(wildRiver(world, rand, i));
  for (const r of rivers) carveRiver(world, r);

  const trees = topUpTrees(world, minX, minZ, rivers, rand);

  return {
    minX, minZ, size: STARTER_SIZE,
    rivers,
    trees,
    spawn: findSpawn(world, minX, minZ, rivers),
  };
}

/**
 * The river's centre-line, one x per z, wandering but pinned to pass within
 * RIVER_NEAR of the settlement so the first farm is always possible.
 */
function riverPath(world, centreX, centreZ, rand) {
  const amp = 14 + rand() * 22;
  const wavelength = 70 + rand() * 90;
  const phase = rand() * Math.PI * 2;
  const drift = (rand() - 0.5) * 0.12;

  // Offset chosen so the curve is close to the centre exactly where it matters.
  const atCentre = Math.sin((centreZ / wavelength) + phase) * amp + drift * centreZ;
  const side = rand() < 0.5 ? -1 : 1;
  const target = centreX + side * (2 + rand() * (RIVER_NEAR - 2));
  const offset = target - atCentre;

  const xs = new Int32Array(world.sizeZ);
  for (let z = 0; z < world.sizeZ; z++) {
    const x = Math.sin((z / wavelength) + phase) * amp + drift * z + offset;
    xs[z] = Math.max(3, Math.min(world.sizeX - 4, Math.round(x)));
  }
  return { axis: 'z', coords: xs, width: 2 + Math.round(rand() * 2) };
}

/**
 * A river with nowhere in particular to be. Alternates orientation so the map
 * gets crossings and islands rather than a set of parallel stripes.
 */
function wildRiver(world, rand, index) {
  const axis = index % 2 === 0 ? 'x' : 'z';
  const along = axis === 'z' ? world.sizeZ : world.sizeX;
  const across = axis === 'z' ? world.sizeX : world.sizeZ;

  const amp = 14 + rand() * 18;
  const wavelength = 60 + rand() * 110;
  const phase = rand() * Math.PI * 2;
  const drift = (rand() - 0.5) * 0.1;
  // Bands at roughly a fifth, a half and four fifths across, jittered a little.
  const band = 0.2 + index * 0.3 + (rand() - 0.5) * 0.1;
  const base = across * band;

  const coords = new Int32Array(along);
  for (let i = 0; i < along; i++) {
    const v = Math.sin((i / wavelength) + phase) * amp + drift * i + base;
    coords[i] = Math.max(3, Math.min(across - 4, Math.round(v)));
  }
  return { axis, coords, width: 1 + Math.round(rand() * 2) };
}

/** Distance from a column to the nearest river centre-line. */
function distanceToRivers(rivers, x, z) {
  let best = Infinity;
  for (const r of rivers) {
    const d = r.axis === 'z' ? Math.abs(x - r.coords[z]) : Math.abs(z - r.coords[x]);
    best = Math.min(best, d - r.width);
  }
  return best;
}

/**
 * Cuts the channel. The water surface follows a smoothed version of the land so
 * the river runs downhill in steps rather than leaping about with every bump.
 */
function carveRiver(world, river) {
  const { axis, coords, width } = river;
  const along = coords.length;
  const at = (i, c) => (axis === 'z' ? [c, i] : [i, c]);   // -> [x, z]

  // Smooth the terrain height along the river's length.
  const raw = new Int32Array(along);
  for (let i = 0; i < along; i++) {
    const [x, z] = at(i, coords[i]);
    raw[i] = world.surfaceHeight(x, z) - 1;
  }
  const level = new Int32Array(along);
  const span = 12;
  for (let i = 0; i < along; i++) {
    let sum = 0, n = 0;
    for (let k = -span; k <= span; k++) {
      const j = i + k;
      if (j < 0 || j >= along) continue;
      sum += raw[j]; n++;
    }
    level[i] = Math.round(sum / n);
  }

  for (let i = 0; i < along; i++) {
    const cx = coords[i];
    const surface = level[i];
    const bed = Math.max(2, surface - RIVER_DEPTH);
    const bankAt = width + 1;

    for (let dx = -bankAt; dx <= bankAt; dx++) {
      const [x, z] = at(i, cx + dx);
      if (!world.inBounds(x, 0, z)) continue;
      const dist = Math.abs(dx);

      if (dist <= width) {
        // Channel: clear the column, lay a bed, fill to just under the bank.
        for (let y = bed; y < world.height; y++) world.setBlock(x, y, z, 0);
        world.setBlock(x, bed, z, SAND);
        for (let y = bed + 1; y <= surface; y++) world.setBlock(x, y, z, WATER);
        world.surfaceHeightMap[x * world.sizeZ + z] = surface + 1;
      } else {
        // Bank: flatten to the water's shoulder so the edge is walkable.
        const shoulder = surface + 1;
        for (let y = shoulder + 1; y < world.height; y++) world.setBlock(x, y, z, 0);
        for (let y = Math.max(0, shoulder - 3); y < shoulder; y++) {
          if (world.getBlock(x, y, z) === 0) world.setBlock(x, y, z, DIRT);
        }
        world.setBlock(x, shoulder, z, SAND);
        world.surfaceHeightMap[x * world.sizeZ + z] = shoulder + 1;
      }
    }
  }
}

/**
 * Makes sure the plot has trees, and that enough of them stand together.
 *
 * Scattered singles are not a forest: the claim wants three or four trunks
 * inside one box, and ten trees spread over a thousand tiles almost never
 * gives you that. So the top-up plants a grove — which is also how woodland
 * actually looks.
 */
function topUpTrees(world, minX, minZ, rivers, rand) {
  const standing = [];
  for (let lx = 0; lx < STARTER_SIZE; lx++) {
    for (let lz = 0; lz < STARTER_SIZE; lz++) {
      const x = minX + lx, z = minZ + lz;
      const h = world.surfaceHeight(x, z);
      if (world.getBlock(x, h, z) === WOOD) standing.push({ lx, lz });
    }
  }

  const grove = findGroveSpot(world, minX, minZ, rivers, rand);
  let planted = 0, attempts = 0;
  while (planted < GROVE_TREES && attempts < 800) {
    attempts++;
    const lx = grove.lx + Math.floor((rand() - 0.5) * GROVE_SPAN);
    const lz = grove.lz + Math.floor((rand() - 0.5) * GROVE_SPAN);
    if (lx < 2 || lz < 2 || lx >= STARTER_SIZE - 2 || lz >= STARTER_SIZE - 2) continue;
    const x = minX + lx, z = minZ + lz;
    if (distanceToRivers(rivers, x, z) < 3) continue;
    if (standing.some((p) => Math.abs(p.lx - lx) < 2 && Math.abs(p.lz - lz) < 2)) continue;
    const ground = world.surfaceHeight(x, z) - 1;
    const under = world.getBlock(x, ground, z);
    if (under !== GRASS && under !== DIRT) continue;
    plantTree(world, x, ground + 1, z, rand);
    standing.push({ lx, lz });
    planted++;
  }
  return standing.length;
}

/** Flat, dry ground with room for a stand of trees. */
function findGroveSpot(world, minX, minZ, rivers, rand) {
  let best = null;
  for (let lx = 6; lx < STARTER_SIZE - 6; lx += 2) {
    for (let lz = 6; lz < STARTER_SIZE - 6; lz += 2) {
      const x = minX + lx, z = minZ + lz;
      if (distanceToRivers(rivers, x, z) < 6) continue;
      const h = world.surfaceHeight(x, z);
      let rough = 0;
      for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
        rough += Math.abs(world.surfaceHeight(x + dx, z + dz) - h);
      }
      if (!best || rough < best.rough) best = { lx, lz, rough };
    }
  }
  return best ?? { lx: STARTER_SIZE / 2, lz: STARTER_SIZE / 2 };
}

function plantTree(world, x, groundY, z, rand) {
  const trunk = 4 + Math.floor(rand() * 2);
  for (let i = 0; i < trunk; i++) world.setBlock(x, groundY + i, z, WOOD);
  const top = groundY + trunk;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = -2; dy <= 1; dy++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (dy === 1 && (Math.abs(dx) > 1 || Math.abs(dz) > 1)) continue;
        const tx = x + dx, ty = top + dy, tz = z + dz;
        if (!world.inBounds(tx, ty, tz)) continue;
        if (world.getBlock(tx, ty, tz) === 0) world.setBlock(tx, ty, tz, LEAVES);
      }
    }
  }
}

/** Dry, level, standing on solid ground, with headroom — and near the water. */
const EYE = 1;          // the cell the player's eyes occupy, above their feet
const LOOK_RANGE = 14;  // how far ahead "a clear view" is worth measuring

/**
 * How much of the world you can actually see from a spot, and which way is
 * clearest.
 *
 * A spot can be perfectly flat and still be a bad place to arrive, because it
 * sits at the foot of a hill and your whole screen is one brown wall. That is
 * what the first version did: it checked that the ground was level and that
 * nothing was inside your head, and nothing at all about the view.
 */
function outlook(world, x, y, z) {
  // Unit vectors, not [1,1] steps. A diagonal taken as [1,1] walks corner to
  // corner through a different set of blocks than the camera ray does, so the
  // direction that measured clearest was not always the one you ended up
  // looking down.
  const R2 = Math.SQRT1_2;
  const dirs = [[0, -1], [R2, -R2], [1, 0], [R2, R2], [0, 1], [-R2, R2], [-1, 0], [-R2, -R2]];
  let open = 0, bestRun = -1, bestDir = dirs[0];
  for (const [dx, dz] of dirs) {
    let run = 0;
    for (let k = 1; k <= LOOK_RANGE; k++) {
      // Cast from the middle of the block, which is where the player stands,
      // and floor to a cell. Casting from the block's corner instead put the
      // ray in the neighbouring column and reported a clear view down a
      // direction that was in fact blocked.
      const px = Math.floor(x + 0.5 + dx * k), pz = Math.floor(z + 0.5 + dz * k);
      if (!world.inBounds(px, y + EYE, pz)) break;
      if (world.getBlock(px, y + EYE, pz) !== 0) break;
      run = k;
    }
    open += run;
    if (run > bestRun) { bestRun = run; bestDir = [dx, dz]; }
  }
  // Forward is (-sin yaw, 0, -cos yaw), so this points the camera down bestDir.
  const yaw = Math.atan2(-bestDir[0], -bestDir[1]);
  return { open, bestRun, yaw };
}

/**
 * Where the player arrives, and which way they are facing.
 *
 * Ranked on three things, in the order they matter: can you see anything from
 * here, is the ground level enough to walk off, and is the water a short walk
 * away. The facing is returned too — arriving on a lovely open ridge while
 * looking the one way that is blocked is the same bad first impression.
 */
function findSpawn(world, minX, minZ, rivers) {
  // Ask for a proper view first and settle for less only if the plot cannot
  // offer one. Four blocks of clearance was enough to pass while still putting
  // the player's nose in a tree; a dense wood can genuinely have nothing better,
  // so the bar drops rather than the search failing.
  for (const minRun of [10, 7, 4, 1]) {
    const spot = searchSpawn(world, minX, minZ, rivers, minRun);
    if (spot) return spot;
  }
  return centreSpawn(world, minX, minZ);
}

const PITCH = -0.16;   // a shallow downward tilt; level puts half the screen in sky

function centreSpawn(world, minX, minZ) {
  const cx = minX + STARTER_SIZE / 2, cz = minZ + STARTER_SIZE / 2;
  const h = world.surfaceHeight(cx, cz);
  return { x: cx + 0.5, y: h, z: cz + 0.5, yaw: outlook(world, cx, h, cz).yaw, pitch: PITCH };
}

function searchSpawn(world, minX, minZ, rivers, minRun) {
  let best = null;
  for (let lx = 1; lx < STARTER_SIZE - 1; lx++) {
    for (let lz = 1; lz < STARTER_SIZE - 1; lz++) {
      const x = minX + lx, z = minZ + lz;
      const fromRiver = distanceToRivers(rivers, x, z);
      if (fromRiver < 2) continue;                        // not standing in it
      const h = world.surfaceHeight(x, z);                // first free y
      const under = world.getBlock(x, h - 1, z);
      if (under !== GRASS && under !== DIRT && under !== SAND) continue;
      if (world.getBlock(x, h, z) !== 0 || world.getBlock(x, h + 1, z) !== 0) continue;

      const view = outlook(world, x, h, z);
      if (view.bestRun < minRun) continue;                // hemmed in on every side

      // Flat enough that the first few steps aren't a scramble.
      let rough = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        rough += Math.abs(world.surfaceHeight(x + dx, z + dz) - h);
      }
      // Openness leads, because it is what you see before you touch anything.
      const score = -view.open * 3 + rough * 4 + Math.abs(fromRiver - 7);
      if (!best || score < best.score) {
        best = { x: x + 0.5, y: h, z: z + 0.5, yaw: view.yaw, score };
      }
    }
  }
  return best ? { x: best.x, y: best.y, z: best.z, yaw: best.yaw, pitch: PITCH } : null;
}
