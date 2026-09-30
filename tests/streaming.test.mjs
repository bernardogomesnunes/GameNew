import { generateEndlessWorld } from '../src/world/StarterWorld.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';

/**
 * Reported directly: "By moving my avatar, I feel that the terrain moves with
 * me, continuous re-rendering and loading... when I'm flying it's especially
 * noticed."
 *
 * Crossing a chunk line used to generate the whole missing ring at once —
 * thirty-odd chunks in one frame — and flying crosses one about every
 * second. Now streamChunks only lists what's missing, nearest first, and
 * generateQueued works through it a few milliseconds a frame. Driven here
 * through the real Game methods on a game-shaped `this`.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');
const G = Game.prototype;

const { world } = generateEndlessWorld({ seed: 99 });
const mesher = new ChunkMesher({ add() {}, remove() {} });
const game = {
  world, mesher,
  renderDistance: 160,
  remeshQueue: new Set(),
  player: { position: { x: world.centreX, y: 100, z: world.centreZ } },
};

// Fly a long way east in one step: a whole new stretch of country is missing.
game.player.position.x += 2000;
let t0 = performance.now();
G.streamChunks.call(game);
const listMs = performance.now() - t0;
const pcx = Math.floor(game.player.position.x) >> 4, pcz = Math.floor(game.player.position.z) >> 4;
const listed = [...game.genQueue];
ok(`crossing into new country makes nothing on the spot (${listMs.toFixed(1)}ms)`,
  !world.hasChunk(pcx, pcz) && listed.every((c) => !world.hasChunk(c.cx, c.cz)));
ok(`it lists what's missing instead (${game.genQueue.length})`, game.genQueue.length > 100);
ok('nearest first', game.genQueue.every((c, i, a) => i === 0 || a[i - 1].d2 <= c.d2));

t0 = performance.now();
G.generateQueued.call(game, 4);
const frameMs = performance.now() - t0;
const madeNow = listed.filter((c) => world.hasChunk(c.cx, c.cz));
ok(`one frame makes only what fits in its budget (${madeNow.length} chunks, ${frameMs.toFixed(1)}ms)`,
  madeNow.length >= 1 && madeNow.length < 12 && frameMs < 20);
ok('nearest first — the chunk you are over comes first', world.hasChunk(pcx, pcz));
ok('and what it made is queued for a mesh', madeNow.every((c) => game.remeshQueue.has(world.getChunk(c.cx, c.cz))));

// The edge chunk made first has no neighbours yet: it isn't meshed until they exist.
const lonely = [...game.remeshQueue][0];
G.drainRemeshQueue.call(game, 1000);
const hasAll = (c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => world.hasChunk(c.cx + dx, c.cz + dz));
ok('a chunk waits for its neighbours before it is meshed — no hidden generation inside the mesh budget',
  hasAll(lonely) ? !game.remeshQueue.has(lonely) : game.remeshQueue.has(lonely));

let frames = 0;
while (game.genQueue.length && frames < 2000) { G.generateQueued.call(game, 4); G.drainRemeshQueue.call(game, 6); frames++; }
ok(`the whole ring arrives over a few hundred frames, not one (${frames})`, frames > 5 && !game.genQueue.length);

process.exit(f ? 1 : 0);
