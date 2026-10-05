import { readFileSync } from 'node:fs';
import { generateEndlessWorld } from '../src/world/StarterWorld.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';

/**
 * Reported directly: "if I spend some time in a world sometimes ... the game
 * breaks and I see a white screen". Measured on phone settings: the chunk
 * geometry on the graphics card climbed to ~660 MB in two minutes of
 * travel, two thirds of it the sealed caves under every chunk out to the
 * horizon — never drawn past 80 blocks, but built and kept all the same.
 * A phone that runs out of graphics memory takes the canvas back: white.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const { world } = generateEndlessWorld({ seed: 99 });
const deepOf = (chunk) => [...(chunk.mesh?.values() ?? [])].filter((m) => m.userData.deep);
world.ensureAround(world.centreX, world.centreZ, 96);
const c0x = world.centreX >> 4, c0z = world.centreZ >> 4;
let chunk = null;
for (let cx = c0x - 3; cx <= c0x + 3 && !chunk; cx++) for (let cz = c0z - 3; cz <= c0z + 3 && !chunk; cz++) {
  const c = world.getChunk(cx, cz);
  const m = new ChunkMesher({ add() {}, remove() {} });
  m.rebuild(world, c);
  if (deepOf(c).length) chunk = c;
}
ok('a chunk with sealed caves under it', !!chunk);

// --- the deep mesh only near you ------------------------------------------------------
const mesher = new ChunkMesher({ add() {}, remove() {} });
mesher.deepNear = () => false;
mesher.rebuild(world, chunk);
ok('far away, its caves are not meshed at all', deepOf(chunk).length === 0 && chunk.deepSkipped === true);
mesher.deepNear = () => true;
mesher.rebuild(world, chunk);
ok('near, they are', deepOf(chunk).length > 0 && chunk.deepSkipped === false);
const surface = chunk.mesh.size - deepOf(chunk).length;
mesher.dropDeep(chunk);
ok('walk away and they go, the ground stays', deepOf(chunk).length === 0 && chunk.mesh.size === surface && chunk.deepSkipped);
ok('and nothing of them is left to draw', ![...mesher.activeMeshes].some((m) => m.userData.chunk === chunk && m.userData.deep));

// --- smaller vertices -------------------------------------------------------------------
const any = [...chunk.mesh.values()][0].geometry;
ok('normals are a byte each, not a float', any.attributes.normal.array instanceof Int8Array && any.attributes.normal.normalized);
ok('the texture layer is a byte', any.attributes.layer.array instanceof Uint8Array);

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('the game asks for deep meshes only within DEEP_RANGE', /this\.mesher\.deepNear = \(chunk\) => this\.chunkDistSq\(chunk\) <= DEEP_RANGE \* DEEP_RANGE;/.test(game));
ok('and keeps them following you, frame by frame', /this\.drainRemeshQueue\([^)]*\);\s*this\.updateDeep\(\);/.test(game));

// --- and if it happens anyway: saved, and said ------------------------------------------
ok('a phone taking the canvas back saves and says so', /webglcontextlost[\s\S]{0,120}e\.preventDefault\(\);\s*this\.crashed\(/.test(game));
ok('a frame that keeps failing does the same', /if \(\+\+this\.tickErrors >= 3\) this\.crashed\(/.test(game) && /setAnimationLoop\(\(\) => this\.safeTick\(\)\)/.test(game));
ok('the message shows even in full screen', /\(this\.container \?\? document\.body\)\.appendChild\(box\);/.test(game));

process.exit(f ? 1 : 0);
