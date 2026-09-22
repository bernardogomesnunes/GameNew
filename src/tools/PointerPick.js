import { AIR } from '../config/blocks.js';

/**
 * Working out what you are pointing at, so nothing needs a box drawn round it.
 *
 * The selector was a mode: press a button, a grid-snapped cube appears, aim the
 * cube, and only then can you save a design, claim a building or put a roof on.
 * Three things wrong with that. It is a mode, so half the buttons on screen
 * meant something different depending on whether it was on. It snapped to
 * powers of two, so a 7-wide house got an 8-wide roof and a 5-wide one got the
 * same. And it asked you to describe a building the game could already see —
 * you were pointing at the thing.
 *
 * So: point at it. Two kinds of answer, because two different questions get
 * asked of a build.
 *
 *   pickFootprint — "what shape is the top of this?" Walks up to the top of the
 *   wall you are aiming at, follows that course round, and fills in what it
 *   encloses. What a roof goes on.
 *
 *   pickBuild — "which blocks are this thing?" Everything connected to what you
 *   are pointing at that somebody put there rather than the world growing it.
 *   What a design saves.
 *
 *   wallFootprintAt — "how far does this go, sideways?" The same connected
 *   walk as pickBuild, minus the requirement that every block sit above the
 *   world's own recorded terrain height — a requirement that made sense for
 *   telling a wall apart from a hillside, and made "point at the bottom
 *   course of your own wall" fail outright. What a claim measures.
 *
 * Both are capped. A fill that runs away has found a hillside, not a building,
 * and the honest answer to that is to say so rather than to roof a valley.
 */

/** Past this many blocks it is scenery, not something somebody built. */
export const PICK_CAP = 3000;

const key = (x, z) => `${x},${z}`;
const unkey = (k) => k.split(',').map(Number);

/**
 * The top of the stack you are pointing at.
 *
 * Aiming at a wall usually means aiming at the middle of it, and the course
 * that matters is the one at the top — so the pick walks up rather than making
 * you climb and aim down at a one-block edge.
 */
export function columnTop(world, x, y, z) {
  let top = y;
  while (top + 1 < world.height && world.getBlock(x, top + 1, z) !== AIR) top++;
  return top;
}

/** The connected run of solid blocks at one height — a wall course, followed round. */
export function wallCourse(world, x, y, z, cap = PICK_CAP) {
  if (world.getBlock(x, y, z) === AIR) return null;
  const seen = new Set([key(x, z)]);
  const queue = [[x, z]];
  while (queue.length) {
    const [cx, cz] = queue.pop();
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + ox, nz = cz + oz, k = key(nx, nz);
      if (seen.has(k)) continue;
      if (world.getBlock(nx, y, nz) === AIR) continue;
      seen.add(k);
      if (seen.size > cap) return null;
      queue.push([nx, nz]);
    }
  }
  return seen;
}

/**
 * The smallest box round a set of `x,z` keys, or null if there is nothing.
 *
 * Null rather than a box of infinities. `enclose` sizes an array from whatever
 * this returns, and infinite bounds meant a `new Uint8Array(Infinity)` and a
 * dead frame — a long way from the mistake that caused it, which is the kind of
 * crash that takes an afternoon to find.
 */
export function boundsOf(cells) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const k of cells) {
    const [x, z] = unkey(k);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return Number.isFinite(minX) ? { minX, maxX, minZ, maxZ } : null;
}

/**
 * The walls plus the rooms inside them.
 *
 * A roof covers the building, not just the line of its walls, and it should not
 * cover the garden. So: anything the outside cannot reach without crossing a
 * wall is inside. That is what makes an L-shaped house get an L-shaped roof
 * rather than a rectangle floating over the notch.
 */
export function enclose(walls, bounds) {
  const w = bounds.maxX - bounds.minX + 3;   // one cell of margin each side, so
  const l = bounds.maxZ - bounds.minZ + 3;   // the outside is always connected
  const ox = bounds.minX - 1, oz = bounds.minZ - 1;
  const outside = new Uint8Array(w * l);
  const at = (x, z) => (z - oz) * w + (x - ox);
  const queue = [[ox, oz]];
  outside[at(ox, oz)] = 1;
  while (queue.length) {
    const [cx, cz] = queue.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < ox || nx >= ox + w || nz < oz || nz >= oz + l) continue;
      if (outside[at(nx, nz)]) continue;
      if (walls.has(key(nx, nz))) continue;
      outside[at(nx, nz)] = 1;
      queue.push([nx, nz]);
    }
  }
  const foot = new Set();
  for (let x = bounds.minX; x <= bounds.maxX; x++) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
      if (!outside[at(x, z)]) foot.add(key(x, z));
    }
  }
  return foot;
}

/**
 * How far each cell is from the edge of the footprint, the four ways out.
 *
 * This is what lets a roof shape work on any outline rather than on a square.
 * A shape asks "how far to the edge going west?" and gets a number whether the
 * building is a rectangle, an L, or a circle. One step from the edge is 1.
 */
export function spans(foot) {
  const out = new Map();
  const get = (x, z) => out.get(key(x, z));
  const touch = (x, z) => {
    let d = out.get(key(x, z));
    if (!d) { d = { xm: 0, xp: 0, zm: 0, zp: 0 }; out.set(key(x, z), d); }
    return d;
  };
  for (const k of foot) touch(...unkey(k));

  const b = boundsOf(foot);
  for (let z = b.minZ; z <= b.maxZ; z++) {
    let run = 0;
    for (let x = b.minX; x <= b.maxX; x++) {
      run = foot.has(key(x, z)) ? run + 1 : 0;
      if (run) get(x, z).xm = run;
    }
    run = 0;
    for (let x = b.maxX; x >= b.minX; x--) {
      run = foot.has(key(x, z)) ? run + 1 : 0;
      if (run) get(x, z).xp = run;
    }
  }
  for (let x = b.minX; x <= b.maxX; x++) {
    let run = 0;
    for (let z = b.minZ; z <= b.maxZ; z++) {
      run = foot.has(key(x, z)) ? run + 1 : 0;
      if (run) get(x, z).zm = run;
    }
    run = 0;
    for (let z = b.maxZ; z >= b.minZ; z--) {
      run = foot.has(key(x, z)) ? run + 1 : 0;
      if (run) get(x, z).zp = run;
    }
  }
  return out;
}

/**
 * The shape of the top of whatever you are pointing at.
 *
 * `{ y, foot, spans, bounds, walls }` — y being the course the walls end on, so
 * a roof starts at y + 1. Null when the fill ran away, which means you are
 * pointing at the ground.
 */
export function pickFootprint(world, hit, { cap = PICK_CAP } = {}) {
  if (!solidSpot(hit)) return null;
  const y = columnTop(world, hit.x, hit.y, hit.z);
  const walls = wallCourse(world, hit.x, y, hit.z, cap);
  if (!walls) return null;
  const bounds = boundsOf(walls);
  if (!bounds) return null;
  const foot = enclose(walls, bounds);
  return { y, walls, foot, bounds, spans: spans(foot) };
}

/** A hit worth asking about: three real numbers, not a near-miss or a NaN. */
function solidSpot(hit) {
  return !!hit && Number.isFinite(hit.x) && Number.isFinite(hit.y) && Number.isFinite(hit.z);
}

/**
 * The footprint of the build you are pointing at, as a bounding box.
 *
 * This is what pickBuild got wrong for claiming. It double-checked *every*
 * block against `world.surfaceHeight`, including the one you clicked — so a
 * wall whose lowest course sits exactly at the ground's recorded height
 * failed on the spot, with nothing to say why. That happens more than it
 * sounds like it should: breaking a block never lowers the world's recorded
 * surface height for that column (only things like river-carving do), so
 * clearing a patch of grass before building and then placing your first
 * course flush with it leaves that course sitting at the *original* recorded
 * height rather than above it.
 *
 * The fix keeps the surface-height check everywhere it matters — dropping it
 * entirely would let the fill walk sideways through untouched ground and
 * swallow an entire hillside — but not on the one block you actually clicked.
 * Every other block still has to be strictly above its own column's recorded
 * height to be pulled in, exactly as before; the search just no longer
 * insists that the block you started from meet that bar too. One flush
 * course at the very bottom stops mattering once the search finds the rest
 * of the wall sitting properly above it, which it does the moment it climbs
 * one block up from wherever you clicked.
 */
export function wallFootprintAt(world, hit, { cap = PICK_CAP } = {}) {
  if (!solidSpot(hit)) return null;
  if (world.getBlock(hit.x, hit.y, hit.z) === AIR) return null;

  const above = (x, y, z) => y > world.surfaceHeight(x, z);
  const seen = new Set([`${hit.x},${hit.y},${hit.z}`]);
  const cellsXZ = new Set([key(hit.x, hit.z)]);
  const queue = [[hit.x, hit.y, hit.z]];
  const steps = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  while (queue.length) {
    const [x, y, z] = queue.pop();
    for (const [dx, dy, dz] of steps) {
      const nx = x + dx, ny = y + dy, nz = z + dz, k = `${nx},${ny},${nz}`;
      if (seen.has(k)) continue;
      if (!world.inBounds(nx, ny, nz)) continue;
      if (world.getBlock(nx, ny, nz) === AIR) continue;
      if (!above(nx, ny, nz)) continue; // only the block you clicked is exempt
      seen.add(k);
      if (seen.size > cap) return null;
      cellsXZ.add(key(nx, nz));
      queue.push([nx, ny, nz]);
    }
  }
  return boundsOf(cellsXZ);
}

/**
 * The blocks of the thing you are pointing at, as `{ x, y, z, type }`.
 *
 * "Somebody put it there" is the test, and the ground's own recorded height is
 * how it is asked: generating terrain writes that height down and placing a
 * block never changes it, so anything above it is yours. It means a fill
 * crosses a doorway and stops at the lawn without needing a list of which
 * materials count as building materials — which would have been wrong the first
 * time anyone built a house out of dirt.
 */
export function pickBuild(world, hit, { cap = PICK_CAP } = {}) {
  if (!solidSpot(hit)) return null;
  const above = (x, y, z) => y > world.surfaceHeight(x, z);
  if (world.getBlock(hit.x, hit.y, hit.z) === AIR || !above(hit.x, hit.y, hit.z)) return null;

  const seen = new Set([`${hit.x},${hit.y},${hit.z}`]);
  const blocks = [];
  const queue = [[hit.x, hit.y, hit.z]];
  const steps = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  while (queue.length) {
    const [x, y, z] = queue.pop();
    blocks.push({ x, y, z, type: world.getBlock(x, y, z) });
    for (const [dx, dy, dz] of steps) {
      const nx = x + dx, ny = y + dy, nz = z + dz, k = `${nx},${ny},${nz}`;
      if (seen.has(k)) continue;
      if (!world.inBounds(nx, ny, nz)) continue;
      if (world.getBlock(nx, ny, nz) === AIR) continue;
      if (!above(nx, ny, nz)) continue;
      seen.add(k);
      if (seen.size > cap) return null;
      queue.push([nx, ny, nz]);
    }
  }
  let minY = Infinity, maxY = -Infinity;
  for (const b of blocks) {
    if (b.y < minY) minY = b.y;
    if (b.y > maxY) maxY = b.y;
  }
  const flat = boundsOf(blocks.map((b) => key(b.x, b.z)));
  if (!flat) return null;
  return { blocks, bounds: { ...flat, minY, maxY } };
}
