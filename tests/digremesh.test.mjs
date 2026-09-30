import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';

/**
 * Reported directly: "when digging down, when a block breaks there's a
 * rendering issue that shows me all the caves below."
 *
 * An edited chunk went to the back of the remesh queue, behind every chunk
 * streaming in at the time, so a broken block stayed drawn as solid for a
 * while after it was gone. Digging down, you dropped into it — and from
 * inside a block's mesh you see out through the back of it, straight to the
 * caves. Game.remeshDirty now rebuilds edited chunks on the spot.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');

const STONE = 3;
const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) for (let y = 0; y < 10; y++) world.setBlock(x, y, z, STONE);
const mesher = new ChunkMesher({ add() {}, remove() {} });
for (const c of world.allChunks()) mesher.rebuild(world, c);

// A game-shaped `this`: a queue already backed up with streaming chunks.
const fake = {
  world, mesher,
  player: { position: { x: 8, y: 10, z: 8 } },
  remeshQueue: new Set([...world.allChunks()].slice(4)),
};
for (const c of fake.remeshQueue) { c.dirty = true; c.mesh = null; } // generated, never meshed
const backlog = fake.remeshQueue.size;

const home = world.getChunk(0, 0);
const before = home.mesh;
world.setBlock(8, 9, 8, 0);
Game.prototype.remeshDirty.call(fake);
ok('the chunk you dug in is rebuilt at once, not queued', home.mesh !== before && !home.dirty && !fake.remeshQueue.has(home));
ok('and the streaming backlog is still there to drain as before', fake.remeshQueue.size === backlog);

// a paste across many already-meshed chunks: nearest few now, the rest first in line
for (const c of fake.remeshQueue) mesher.rebuild(world, c);
fake.remeshQueue.clear();
const fresh = world.getChunk(3, 3);
fresh.mesh = null; fresh.dirty = true; // newly generated, never meshed
for (let x = 0; x < 64; x += 8) for (let z = 0; z < 64; z += 8) world.setBlock(x, 9, z, 0);
fake.remeshQueue.add(fresh);
Game.prototype.remeshDirty.call(fake);
const order = [...fake.remeshQueue];
ok(`a big edit rebuilds a few now and queues the rest (${fake.remeshQueue.size} queued)`, fake.remeshQueue.size > 0 && fake.remeshQueue.size < 16);
ok('with the edited chunks ahead of anything that was already waiting', order[order.length - 1] === fresh);

process.exit(f ? 1 : 0);
