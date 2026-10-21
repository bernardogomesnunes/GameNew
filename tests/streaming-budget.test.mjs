import assert from 'node:assert/strict';
import { runStreamingWork } from '../src/world/streamingWork.js';
import { Game } from '../src/Game.js';

let time = 0;
const calls = [];
const game = {
  generateQueued(budget) { calls.push(['generate', budget]); time += 20; },
  drainRemeshQueue(budget) { calls.push(['mesh', budget]); time += 20; },
  updateFarTerrain(budget) { calls.push(['far', budget]); time += 20; },
};
for (let frame = 0; frame < 3; frame++) {
  time = 0;
  runStreamingWork(game, 0, () => time);
}
assert.deepEqual(calls.map(([stage]) => stage).sort(), ['far', 'generate', 'mesh']);
console.log('PASS one expensive stage cannot make all three queues overrun in one frame; every queue progresses');

calls.length = 0;
time = 18; // gameplay has already used this frame's target
runStreamingWork(game, 0, () => time);
assert.equal(calls.length, 1);
assert.equal(calls[0][1], 0);
console.log('PASS a busy gameplay frame admits only the minimum streaming progress');

const budgets = [];
time = 0;
const cheap = {
  generateQueued(ms) { budgets.push(ms); time += 2; },
  drainRemeshQueue(ms) { budgets.push(ms); time += 3; },
  updateFarTerrain(ms) { budgets.push(ms); time += 1; },
};
runStreamingWork(cheap, 0, () => time);
assert.deepEqual(budgets, [4, 6, 2]);
console.log('PASS cheap work shares the remaining allowance instead of stacking independent budgets');

time = 0;
calls.length = 0;
game.booting = true;
runStreamingWork(game, 0, () => time, 40);
assert.deepEqual(calls.map(([, ms]) => ms), [40, 40, Infinity]);
console.log('PASS loading screens preserve their separate throughput allowance');

const realPerformance = globalThis.performance;
try {
  time = 0;
  globalThis.performance = { now: () => time };
  const busy = { remeshQueue: new Set(Array.from({ length: 61 }, () => ({}))),
    world: { endless: false }, meshCostMs: 3,
    mesher: { rebuild() { time += 3; } },
  };
  Game.prototype.drainRemeshQueue.call(busy, 0);
  assert.equal(busy.remeshQueue.size, 60);
  assert.equal(time, 3);
  console.log('PASS a long real remesh queue cannot increase its shared allowance');
} finally { globalThis.performance = realPerformance; }
