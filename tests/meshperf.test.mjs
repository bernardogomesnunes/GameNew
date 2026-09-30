import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { generateEndlessWorld } from '../src/world/StarterWorld.js';

/**
 * Reported directly: "Still not liking the performance. We should find some
 * way to have it faster lighter and better without compromising gameplay and
 * render distance."
 *
 * Two findings, measured. Building one chunk's mesh took ~23ms — longer than
 * a whole frame, paid on every block you break and every chunk that streams
 * in — most of it Map lookups per cell and growing plain arrays per quad.
 * And ~88% of every chunk's triangles were the walls of caves sealed inside
 * the rock, drawn for every chunk out to the horizon though nobody on the
 * surface could ever see them. ChunkMesher now reads a flat padded copy of
 * the chunk, writes typed arrays, and puts faces that look into sealed air
 * in a separate deep mesh that Game only draws near the player.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const STONE = 3;
const scene = { add() {}, remove() {} };

function deepAndSurface(chunk) {
  const out = { deep: 0, surface: 0 };
  for (const m of chunk.mesh.values()) out[m.userData.deep ? 'deep' : 'surface'] += m.geometry.index.count / 6;
  return out;
}

// --- a sealed cave goes deep; the same cave opened to the sky doesn't --------

{
  const world = new World({ sizeX: 16, sizeZ: 16, height: 32 });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 20; y++) world.setBlock(x, y, z, STONE);
  // a 3x3x3 pocket, sealed
  for (let x = 6; x < 9; x++) for (let z = 6; z < 9; z++) for (let y = 8; y < 11; y++) world.setBlock(x, y, z, 0);
  const mesher = new ChunkMesher(scene);
  const chunk = world.getChunk(0, 0);
  mesher.rebuild(world, chunk);
  const sealed = deepAndSurface(chunk);
  ok(`a sealed pocket's six walls are all deep (${sealed.deep} deep quads)`, sealed.deep === 6);
  ok('and the ground above it is ordinary surface', sealed.surface >= 1);

  // a shaft down into it: now it's part of the open world
  for (let y = 11; y < 20; y++) world.setBlock(7, y, 7, 0);
  mesher.rebuild(world, chunk);
  const open = deepAndSurface(chunk);
  ok(`dig a shaft down to it and nothing is deep any more (${open.deep})`, open.deep === 0);
}

// --- a real world: most of the triangles are sealed, and it builds fast ------

{
  const { world } = generateEndlessWorld({ seed: 4242 });
  const mesher = new ChunkMesher(scene);
  const chunks = [];
  for (let cx = 10; cx < 16; cx++) for (let cz = -3; cz < 3; cz++) chunks.push(world.getChunk(cx, cz));
  for (let cx = 9; cx < 17; cx++) for (let cz = -4; cz < 4; cz++) world.getChunk(cx, cz);
  for (const c of chunks) mesher.rebuild(world, c); // warm up
  let deep = 0, surface = 0;
  const t0 = performance.now();
  for (const c of chunks) {
    mesher.rebuild(world, c);
    const s = deepAndSurface(c);
    deep += s.deep; surface += s.surface;
  }
  const ms = (performance.now() - t0) / chunks.length;
  ok(`most generated faces are sealed caves, culled at a distance (${Math.round(deep / (deep + surface) * 100)}%)`, deep / (deep + surface) > 0.5);
  // Generous: ~6ms here, ~23ms before. Loose enough for a slow CI box, tight
  // enough that the old per-cell Map lookups would fail it.
  ok(`a chunk builds in well under a frame's worth of time (${ms.toFixed(1)}ms)`, ms < 16);
}

process.exit(f ? 1 : 0);
