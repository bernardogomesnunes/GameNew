import assert from 'node:assert/strict';
import { Chunk, World } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { TerrainWorkerQueue, terrainConfig, generateTerrainChunk } from '../src/world/TerrainWorkerQueue.js';
import { BLOCKS } from '../src/config/blocks.js';

const gen = new ChunkGen({ seed: 621, height: 256, homeX: 100, homeZ: -60 });
gen.sky = true; gen.battle = true; gen.skyCut = new Set([2, 1]);
const world = new World({ height: 256, gen });
const result = generateTerrainChunk(terrainConfig(world), -3, 4);
const expected = new Chunk(-3, 4, 256);
gen.fill(world, expected);
assert.deepEqual(result.data, expected.data);
assert.deepEqual(result.surface, expected.surface);
assert.deepEqual(result.biomes, expected.biomes);
assert.equal(world.acceptGeneratedChunk(result).touched, false);
world.setBlock(-48, 100, 64, 3);
assert.equal(world.acceptGeneratedChunk(result), null);
assert.equal(world.getBlock(-48, 100, 64), 3);
console.log('PASS worker terrain matches synchronous terrain and never overwrites edits');

for (const [cx, cz] of [[7507, -4], [-7494, -4]]) {
  const remote = generateTerrainChunk(terrainConfig(world), cx, cz);
  const sync = new Chunk(cx, cz, 256);
  gen.fill(world, sync);
  assert.deepEqual(remote.data, sync.data);
  assert.deepEqual(remote.surface, sync.surface);
  assert.deepEqual(remote.biomes, sync.biomes);
}
const lit = generateTerrainChunk(terrainConfig(world), 10, 10);
const lamp = BLOCKS.find((block) => block.light && !/Ore$/.test(block.name) && !block.fluid);
const chimney = BLOCKS.find((block) => block.smoke);
lit.data = new Uint16Array(lit.data);
lit.data[0] = lamp.id; lit.data[1] = chimney.id;
world.acceptGeneratedChunk(lit);
assert.ok(world.lights.has('160,0,160'));
assert.ok(world.smokes.has('161,0,160'));
console.log('PASS worker preserves Past/Future terrain, light and smoke bookkeeping');

class FakeWorker {
  messages = [];
  postMessage(message) { this.messages.push(message); }
  terminate() { this.terminated = true; }
}
let worker;
const fresh = new World({ height: 256, gen });
let received = 0;
const queue = new TerrainWorkerQueue(fresh, { workerFactory: () => (worker = new FakeWorker()), maxPending: 2, onChunk: () => received++ });
assert.equal(queue.request(1, 1), true);
assert.equal(queue.request(1, 1), true);
assert.equal(queue.request(2, 2), true);
assert.equal(queue.request(3, 3), false);
const first = worker.messages[0];
gen.sky = false;
worker.onmessage({ data: { ...first, chunk: generateTerrainChunk(first.config, 1, 1) } });
assert.equal(fresh.hasChunk(1, 1), false);
assert.equal(received, 0);
queue.request(4, 4);
const next = worker.messages.at(-1);
worker.onmessage({ data: { ...next, chunk: generateTerrainChunk(next.config, 4, 4) } });
assert.equal(fresh.hasChunk(4, 4), true);
assert.equal(received, 1);
queue.dispose();
assert.equal(worker.terminated, true);
assert.equal(queue.request(5, 5), false);
assert.equal(new TerrainWorkerQueue(fresh, { workerFactory: () => { throw new Error('blocked'); } }).available, false);
console.log('PASS worker queue bounds work, rejects stale flags, disposes, and falls back when unavailable');
