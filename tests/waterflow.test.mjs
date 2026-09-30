import { World } from '../src/world/World.js';
import { WaterFlow } from '../src/world/WaterFlow.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { isWater, isFlowing, waterLevel, PLACEABLE_BLOCKS } from '../src/config/blocks.js';
import { castVoxelRay } from '../src/interaction/VoxelRaycast.js';

/**
 * Requested directly: "would be nice to have flowing water, and if it is on
 * a higher block, it should flow down." Still water (sources) stays put;
 * what runs off it spreads up to seven blocks, falls off edges, fills
 * holes, and dries up again when the source is taken away.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const STONE = 3, WATER = 11;

function floor(size = 32, y = 0) {
  const world = new World({ sizeX: size, sizeZ: size, height: 24 });
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) world.setBlock(x, y, z, STONE);
  return world;
}

/** Runs the flow until it settles, returning how many steps that took. */
function settle(flow, max = 200) {
  let steps = 0;
  while (flow.busy && steps < max) { flow.step(); steps++; }
  return steps;
}

// --- a source on flat ground spreads out, weaker as it goes, and stops ----------------

{
  const world = floor();
  const flow = new WaterFlow(world);
  world.setBlock(16, 1, 16, WATER);
  flow.touch(16, 1, 16);
  const steps = settle(flow);
  ok(`it settles by itself (${steps} steps)`, !flow.busy && steps < 100);
  ok('one step out is strong (7)', waterLevel(world.getBlock(17, 1, 16)) === 7);
  ok('three out is weaker (5)', waterLevel(world.getBlock(19, 1, 16)) === 5);
  ok('it reaches seven blocks and no further', isWater(world.getBlock(23, 1, 16)) && !isWater(world.getBlock(24, 1, 16)));
  ok('the source itself never changes', world.getBlock(16, 1, 16) === WATER);
  ok('none of it climbs', !isWater(world.getBlock(17, 2, 16)));
}

// --- on a ledge, it runs to the edge and pours down ---------------------------------------

{
  const world = floor();
  // a raised shelf at x < 12, two blocks up
  for (let x = 0; x < 12; x++) for (let z = 0; z < 32; z++) { world.setBlock(x, 1, z, STONE); world.setBlock(x, 2, z, STONE); }
  const flow = new WaterFlow(world);
  world.setBlock(9, 3, 16, WATER);
  flow.touch(9, 3, 16);
  settle(flow);
  ok('it runs along the shelf to the edge', isFlowing(world.getBlock(11, 3, 16)));
  ok('pours over and falls down the face', isFlowing(world.getBlock(12, 2, 16)) && isFlowing(world.getBlock(12, 1, 16)));
  ok('falling water is at full strength', waterLevel(world.getBlock(12, 1, 16)) === 7);
  ok('and spreads out again where it lands', isFlowing(world.getBlock(15, 1, 16)));
  ok('it spreads further below than it had left on the shelf', isFlowing(world.getBlock(17, 1, 16)));
  let hanging = 0;
  for (let z = 0; z < 32; z++) for (let x = 13; x < 32; x++) if (isWater(world.getBlock(x, 2, z))) hanging++;
  ok(`a waterfall is a sheet down the face, not a wall out from it (${hanging} cells hanging beyond it)`, hanging === 0);
}

// --- poured off a tall pillar: a column down each side, a spill at the foot, then still -----

{
  const world = floor();
  for (let y = 1; y <= 6; y++) world.setBlock(16, y, 16, STONE);
  const flow = new WaterFlow(world);
  world.setBlock(16, 7, 16, WATER);
  flow.touch(16, 7, 16);
  const steps = settle(flow);
  let air = 0, water = 0;
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) for (let y = 2; y <= 6; y++) {
    if (isWater(world.getBlock(x, y, z))) water++;
  }
  ok(`it settles (${steps} steps)`, !flow.busy);
  ok(`only the four falling columns hang in the air (${water} cells, 4 columns × 5)`, water === 20);
}

// --- dig a hole beside a pool: it runs in and fills it --------------------------------------

{
  const world = floor();
  const flow = new WaterFlow(world);
  for (let z = 0; z < 32; z++) world.setBlock(10, 1, z, WATER); // a line of pool
  for (let z = 0; z < 32; z++) world.setBlock(11, 1, z, STONE); // with a bank
  // Dig through the bank and down a pit behind it.
  world.setBlock(11, 1, 16, 0);
  world.setBlock(12, 0, 16, 0);
  flow.touch(11, 1, 16);
  flow.touch(12, 0, 16);
  settle(flow);
  ok('water runs through the gap in the bank', isFlowing(world.getBlock(11, 1, 16)));
  ok('and down into the pit', isWater(world.getBlock(12, 0, 16)));
}

// --- take the source away and the spill dries up ------------------------------------------------

{
  const world = floor();
  const flow = new WaterFlow(world);
  world.setBlock(16, 1, 16, WATER);
  flow.touch(16, 1, 16);
  settle(flow);
  world.setBlock(16, 1, 16, 0);
  flow.touch(16, 1, 16);
  settle(flow);
  let left = 0;
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) if (isWater(world.getBlock(x, 1, z))) left++;
  ok(`with its source gone, the spill dries up completely (${left} left)`, left === 0);
}

// --- it never makes land by looking at it -------------------------------------------------------------

{
  const world = floor(16);
  const flow = new WaterFlow(world);
  world.setBlock(15, 1, 8, WATER);
  flow.touch(15, 1, 8);
  settle(flow);
  ok('it stops at the edge of what exists instead of generating more', !world.hasChunk(1, 0));
}

// --- flowing water is water to everything else ----------------------------------------------------------

{
  const world = floor();
  const flow = new WaterFlow(world);
  world.setBlock(16, 1, 16, WATER);
  flow.touch(16, 1, 16);
  settle(flow);
  ok('you walk and swim through it (no collision box)', world.collisionBoxAt(18, 1, 16) === null);
  const hit = castVoxelRay(world, { x: 18.5, y: 4, z: 16.5 }, { x: 0, y: -1, z: 0 }, 10);
  ok('you look through it to the ground it\'s running over', hit && hit.y === 0 && hit.placeY === 1);
  ok('it is never something you place by hand', !PLACEABLE_BLOCKS.some((b) => isFlowing(b.id)));

  const mesher = new ChunkMesher({ add() {}, remove() {} });
  const chunk = world.getChunk(1, 1);
  mesher.rebuild(world, chunk);
  const water = chunk.mesh.get(WATER);
  const P = water.geometry.attributes.position.array, N = water.geometry.attributes.normal.array;
  let low = null, high = null;
  for (let i = 0; i < P.length; i += 3) {
    if (N[i + 1] !== 1) continue;
    const x = P[i] + 16, z = P[i + 2] + 16, y = P[i + 1];
    if (x > 22 && x <= 23 && z > 16 && z <= 17) low = y;
    if (x > 17 && x <= 18 && z > 16 && z <= 17) high = y;
  }
  ok(`the weak end of a spill sits lower than the strong end (${low?.toFixed(2)} < ${high?.toFixed(2)})`, low != null && high != null && low < high && high < 2);
}

process.exit(f ? 1 : 0);
