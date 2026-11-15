import assert from 'node:assert/strict';
import { Crafting } from '../src/duilt/Crafting.js';
import { Inventory } from '../src/items/Inventory.js';
import { benchStroke, BENCH_MACHINES, WORK_MIN, WORK_MAX } from '../src/duilt/BenchWork.js';
import { RECIPES } from '../src/config/recipes.js';
import { BLOCKS, stationOf } from '../src/config/blocks.js';

// CRAFT3D-2, 4 to 7 (owner, 15 November: "proceed with the rest of the crafting").
const bag = new Inventory();
const crafting = new Crafting({ inventory: bag, world: { getBlock: () => 0 } });
const at = { atStations: ['spinning_wheel'], age: 1 };
bag.add('hemp_fibre', 9);

assert.equal(benchStroke(crafting, 'string_spun', WORK_MIN - 0.1, at).result, 'short');
assert.equal(bag.countOf('hemp_fibre'), 9, 'let go short: nothing spent');
const made = benchStroke(crafting, 'string_spun', 0.95, at);
assert.equal(made.result, 'made');
assert.equal(bag.countOf('string'), 2, 'the wheel spins 2 string from 3 fibre');
assert.equal(bag.countOf('hemp_fibre'), 6);
assert.equal(benchStroke(crafting, 'string_spun', WORK_MAX + 0.1, at).result, 'spoilt');
assert.equal(bag.countOf('hemp_fibre'), 3, 'held too long: the batch is lost');
assert.equal(bag.countOf('string'), 2);
assert.equal(benchStroke(crafting, 'string_spun', 0.95, { atStations: [], age: 1 }).result, 'none', 'away from the wheel, nothing');
console.log('PASS a stroke in the window makes one batch; short spends nothing; too long spoils it');

for (const st of Object.keys(BENCH_MACHINES)) {
  assert.ok(BLOCKS.some((b) => stationOf(b.id) === st), `${st} is a placed block`);
  assert.ok(RECIPES.some((r) => r.station === st), `${st} makes something`);
}
console.log('PASS every bench machine is a block with recipes of its own');

assert.ok(RECIPES.some((r) => r.id === 'ring_white_forge' && r.station === 'forge' && r.needsTemple === 4));
assert.ok(RECIPES.some((r) => r.id === 'ring_black_forge' && r.station === 'forge' && r.needsTemple === 4));
console.log('PASS the rings can be forged at a forge once a temple reaches its fourth level');
