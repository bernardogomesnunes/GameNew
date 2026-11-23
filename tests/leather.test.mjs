import assert from 'node:assert/strict';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { BLOCKS_BY_ID, stationOf } from '../src/config/blocks.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';
import { RECIPES } from '../src/config/recipes.js';
import { Crafting } from '../src/duilt/Crafting.js';
import { Inventory } from '../src/items/Inventory.js';
import { benchStroke, BENCH_MACHINES, WORK_MIN, WORK_MAX } from '../src/duilt/BenchWork.js';
import { recipeChain } from '../src/duilt/recipeChain.js';
import { itemIcon } from '../src/config/cubes.js';

// PLAY-9: hides become leather at a placed Tanning Vat.
const leather = ITEMS_BY_ID.get('leather'), vat = ITEMS_BY_ID.get('tanning_vat');
assert.equal(leather.kind, 'refined');
assert.equal(leather.stackTo, 100);
assert.ok((itemIcon(leather) ?? '').startsWith('<svg'));
assert.equal(vat.block, 544);
assert.equal(vat.name, 'Tanning Vat');
assert.equal(BLOCKS_BY_ID.get(544).name, 'Tanning Vat');
assert.equal(stationOf(544), 'tanning_vat');
assert.ok(PROP_SHAPES.tanning_vat.length <= 12);
console.log('PASS leather and the vat are defined, the vat is block 544 with a shape of 12 boxes or fewer');

const makers = RECIPES.filter((r) => r.output.id === 'leather');
assert.equal(makers.length, 1);
const lr = makers[0];
assert.equal(lr.id, 'leather');
assert.equal(lr.station, 'tanning_vat');
assert.equal(lr.age, 1);
assert.deepEqual(lr.inputs, { hide: 2, wood: 1 });
assert.equal(lr.output.count, 2);
console.log('PASS one recipe makes leather: hide 2 and wood 1 for 2 at the vat, Age 1');

const m = BENCH_MACHINES.tanning_vat;
assert.equal(m.verb, 'Soak');
assert.equal(m.tool, 'dip');
assert.ok(m.seconds > 0);
console.log('PASS the vat has a Soak close-up with the dip tool');

const bag = new Inventory();
const crafting = new Crafting({ inventory: bag, world: { getBlock: () => 0 } });
const at = { atStations: ['tanning_vat'], age: 1 };
bag.add('hide', 4); bag.add('wood', 2);
assert.equal(benchStroke(crafting, 'leather', WORK_MIN - 0.1, at).result, 'short');
assert.equal(bag.countOf('hide'), 4);
assert.equal(bag.countOf('wood'), 2);
assert.equal(bag.countOf('leather'), 0);
assert.equal(benchStroke(crafting, 'leather', 0.95, at).result, 'made');
assert.equal(bag.countOf('hide'), 2);
assert.equal(bag.countOf('wood'), 1);
assert.equal(bag.countOf('leather'), 2);
assert.equal(benchStroke(crafting, 'leather', WORK_MAX + 0.1, at).result, 'spoilt');
assert.equal(bag.countOf('leather'), 2, 'over the window adds nothing');
assert.equal(benchStroke(crafting, 'leather', 0.95, { atStations: [], age: 1 }).result, 'none');
console.log('PASS strokes at the vat: short spends nothing, in the window tans, over spoils, away from the vat does nothing');

const switched = {
  armour_leather_head: { leather: 3 }, armour_leather_body: { leather: 5 },
  armour_leather_legs: { leather: 4 }, armour_leather_feet: { leather: 2 },
  backpack_leather: { leather: 4, string: 2 },
  backpack_reinforced: { backpack_leather: 1, iron_ingot: 2, leather: 2 },
  shield_wood: { planks: 6, leather: 1 },
};
for (const [id, inputs] of Object.entries(switched)) {
  const r = RECIPES.find((x) => x.id === id);
  assert.deepEqual(r.inputs, inputs, id);
  assert.equal(r.inputs.hide, undefined, `${id} takes no hide`);
}
console.log('PASS the 7 switched recipes take leather in the table counts and no hide');

for (const id of ['war_horn', 'dino_whistle']) assert.equal(RECIPES.find((r) => r.id === id).inputs.hide, 2, id);
console.log('PASS war_horn and dino_whistle keep hide 2');

const hideUsers = RECIPES.filter((r) => r.inputs.hide).map((r) => r.id).sort();
assert.deepEqual(hideUsers, ['dino_whistle', 'leather', 'war_horn']);
console.log('PASS no other recipe takes hide');

assert.equal(recipeChain('leather').text, 'Hide > Tanning Vat > Leather');
console.log('PASS the leather chain reads Hide > Tanning Vat > Leather');
