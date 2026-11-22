import assert from 'node:assert/strict';
import { Crafting } from '../src/duilt/Crafting.js';
import { Inventory } from '../src/items/Inventory.js';
import { benchStroke } from '../src/duilt/BenchWork.js';
import { RECIPES, RECIPES_BY_ID } from '../src/config/recipes.js';
import { CROPS_BY_KIND } from '../src/config/crops.js';
import { BLOCKS_BY_ID } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { harvestOf, farmProduce } from '../src/duilt/Crops.js';
import { WILD_SEEDS } from '../src/duilt/DuiltGame.js';
import { itemIcon } from '../src/config/cubes.js';
import { TRADERS_BY_ID } from '../src/config/traders.js';

// PLAY-10 (docs/design/play-9-10.md): string from wool and cotton at the Spinning Wheel.
const pass = (n) => console.log('PASS ' + n);

assert.equal(CROPS_BY_KIND.get('cotton')?.base, 548);
for (let id = 548; id <= 551; id++) assert.ok(BLOCKS_BY_ID.has(id), `block ${id}`);
assert.equal(BLOCKS_BY_ID.get(551).name, 'Ripe Cotton');
assert.equal(ITEMS_BY_ID.get('seeds_cotton').block, 548);
pass('cotton is a crop on blocks 548-551; its seeds place 548');

assert.deepEqual(harvestOf(551), { cotton: 2, seeds_cotton: 2 });
assert.deepEqual(harvestOf(548), { seeds_cotton: 1 });
pass('ripe cotton gives 2 cotton and 2 seeds; a sprout gives its seed back');

assert.ok(WILD_SEEDS.includes('seeds_cotton') && !WILD_SEEDS.includes('seeds_coffee'));
pass('turf can drop cotton seeds, never coffee seeds');

const made = farmProduce({ seeds: ['cotton'] });
assert.deepEqual(made, { cotton: 1, seeds_cotton: 1 });
assert.ok(made.cotton * 6 < 15 && made.seeds_cotton * 6 < 15);
pass('a farm with cotton makes 1 cotton and 1 seed a cycle: 6 a day, under 15');

for (const [id, input] of [['string_wool', 'wool'], ['string_cotton', 'cotton']]) {
  const r = RECIPES_BY_ID.get(id);
  assert.ok(r, id);
  assert.equal(r.station, 'spinning_wheel');
  assert.equal(r.age, 1);
  assert.equal(r.batch, 4);
  assert.deepEqual(r.inputs, { [input]: 1 });
  assert.deepEqual(r.output, { id: 'string', count: 1 });
}
pass('string_wool and string_cotton: 1 input for 1 string, at the wheel, Age 1, batch 4');

for (const input of ['wool', 'cotton']) {
  const bag = new Inventory();
  const crafting = new Crafting({ inventory: bag, world: { getBlock: () => 0 } });
  bag.add(input, 1);
  const rid = input === 'wool' ? 'string_wool' : 'string_cotton';
  const r = benchStroke(crafting, rid, 0.95, { atStations: ['spinning_wheel'], age: 1 });
  assert.equal(r.result, 'made');
  assert.equal(bag.countOf('string'), 1);
  assert.equal(bag.countOf(input), 0);
}
pass('a stroke at the wheel makes 1 string from 1 wool, and 1 from 1 cotton');

const wheel = RECIPES.filter((r) => r.station === 'spinning_wheel' && r.age <= 1);
assert.equal(wheel.length, 3);
assert.ok(wheel.every((r) => r.output.id === 'string'));
assert.equal(new Set(wheel.map((r) => Object.keys(r.inputs)[0])).size, 3);
pass('the wheel offers 3 string recipes at Age 1, one input each');

for (const t of ['seedwife', 'provisioner']) {
  assert.ok(TRADERS_BY_ID.get(t).goods.some(([id]) => id === 'seeds_cotton'), t);
}
pass('Bramble and Mabel sell cotton seeds');

for (const id of ['cotton', 'seeds_cotton']) assert.ok(ITEMS_BY_ID.get(id), id);
for (const id of ['cotton', 'seeds_cotton', 'wool']) assert.ok((itemIcon(ITEMS_BY_ID.get(id)) ?? '').startsWith('<svg'), id);
assert.notEqual(itemIcon(ITEMS_BY_ID.get('cotton')), itemIcon(ITEMS_BY_ID.get('wool')));
pass('cotton and cotton seeds have svg icons; the cotton icon differs from wool');

const strings = { bow: 3, arrow: 1, fairy_lights: 1, dino_whistle: 2, backpack_leather: 2 };
for (const [id, n] of Object.entries(strings)) {
  assert.equal(RECIPES_BY_ID.get(id)?.inputs.string, n, id);
}
pass('bow, arrow, fairy_lights, dino_whistle, backpack_leather keep their string counts');
