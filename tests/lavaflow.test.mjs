import { World } from '../src/world/World.js';
import { WaterFlow, LavaFlow } from '../src/world/WaterFlow.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { isLava, isLavaFlow, lavaLevel, isFlowing, PLACEABLE_BLOCKS } from '../src/config/blocks.js';
import { castVoxelRay } from '../src/interaction/VoxelRaycast.js';

/** Requested directly: "noticed that lava is not fluid like water, it should." */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const STONE = 3, WATER = 11, LAVA = 45, COBBLE = 8;
function floor(size = 32) {
  const world = new World({ sizeX: size, sizeZ: size, height: 24 });
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) world.setBlock(x, 0, z, STONE);
  return world;
}
const settle = (flow) => { let n = 0; while (flow.busy && n < 300) { flow.step(); n++; } return n; };

{
  const world = floor();
  const lava = new LavaFlow(world);
  world.setBlock(16, 1, 16, LAVA);
  lava.touch(16, 1, 16);
  settle(lava);
  ok('lava runs off its source', isLavaFlow(world.getBlock(17, 1, 16)) && lavaLevel(world.getBlock(17, 1, 16)) === 3);
  ok('three blocks and no further — thicker than water', isLavaFlow(world.getBlock(19, 1, 16)) && !isLava(world.getBlock(20, 1, 16)));
  ok('it is never placed by hand', !PLACEABLE_BLOCKS.some((b) => isLavaFlow(b.id)));
  ok('you wade into it rather than stand on it', world.collisionBoxAt(16, 1, 16) === null && world.collisionBoxAt(17, 1, 16) === null);
  const hit = castVoxelRay(world, { x: 17.5, y: 4, z: 16.5 }, { x: 0, y: -1, z: 0 }, 10);
  ok('you look through running lava to the ground under it', hit && hit.y === 0);

  world.setBlock(16, 1, 16, 0);
  lava.touch(16, 1, 16);
  settle(lava);
  let left = 0;
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) if (isLava(world.getBlock(x, 1, z))) left++;
  ok(`with its source gone it drains away (${left} left)`, left === 0);
}

{
  // Off a ledge it pours down.
  const world = floor();
  for (let x = 0; x < 12; x++) for (let z = 0; z < 32; z++) { world.setBlock(x, 1, z, STONE); world.setBlock(x, 2, z, STONE); }
  const lava = new LavaFlow(world);
  world.setBlock(10, 3, 16, LAVA);
  lava.touch(10, 3, 16);
  settle(lava);
  ok('lava pours over an edge and down', isLavaFlow(world.getBlock(12, 2, 16)) && isLavaFlow(world.getBlock(12, 1, 16)));
}

{
  // Running lava meeting water sets into stone.
  const world = floor();
  const water = new WaterFlow(world), lava = new LavaFlow(world);
  water.onChange = (x, y, z) => lava.touch(x, y, z);
  lava.onChange = (x, y, z) => water.touch(x, y, z);
  world.setBlock(10, 1, 16, WATER);
  world.setBlock(14, 1, 16, LAVA);
  water.touch(10, 1, 16); lava.touch(14, 1, 16);
  for (let i = 0; i < 200 && (water.busy || lava.busy); i++) { water.step(); lava.step(); }
  let cobble = 0;
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) if (world.getBlock(x, 1, z) === COBBLE) cobble++;
  ok(`where running lava meets water it turns to cobblestone (${cobble} blocks)`, cobble > 0);
  ok('and neither source is harmed', world.getBlock(10, 1, 16) === WATER && world.getBlock(14, 1, 16) === LAVA);
}

{
  // Drawn as a fluid, lower as it thins, and not as an extra box under it.
  const world = floor();
  const lava = new LavaFlow(world);
  world.setBlock(16, 1, 16, LAVA);
  lava.touch(16, 1, 16);
  settle(lava);
  const water = new WaterFlow(world);
  world.setBlock(4, 1, 4, WATER);
  water.touch(4, 1, 4);
  settle(water);
  const mesher = new ChunkMesher({ add() {}, remove() {} });
  const chunk = world.getChunk(1, 1);
  mesher.rebuild(world, chunk);
  let topAt = null;
  for (const m of chunk.mesh.values()) {
    const P = m.geometry.attributes.position.array, N = Float32Array.from(m.geometry.attributes.normal.array, (v) => v / 127);
    for (let i = 0; i < P.length; i += 3) {
      if (N[i + 1] !== 1) continue;
      const x = P[i] + 16, z = P[i + 2] + 16;
      if (x > 19 && x <= 20 - 0 && z > 16 && z <= 17) topAt = P[i + 1];
    }
  }
  ok(`the thin end of running lava sits low in its cell (${topAt?.toFixed(2)})`, topAt != null && topAt > 1 && topAt < 1.6);
  const home = world.getChunk(0, 0);
  mesher.rebuild(world, home);
  ok('running water and lava get no stray box drawn under them', !home.propMesh && !chunk.propMesh);
  ok('running water is still water', isFlowing(world.getBlock(5, 1, 4)));
}

process.exit(f ? 1 : 0);
