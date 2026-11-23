// PLAY-19: the Cauldron (docs/design/play-14-21.md). Block 569, four meals that feed 36 to 50.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BLOCKS_BY_ID, stationOf } from '../src/config/blocks.js';
import { ITEMS_BY_ID, isFood } from '../src/config/items.js';
import { RECIPES, RECIPES_BY_ID } from '../src/config/recipes.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';
import { Crucibles, mouldFor } from '../src/duilt/Crucible.js';
import { Inventory } from '../src/items/Inventory.js';

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('PASS ' + name); } catch (e) { failures++; console.log('FAIL ' + name + '\n  ' + e.message); } };
const K = '5,2,5';
const MEALS = ['hunters_stew', 'forest_broth', 'mushroom_soup', 'mushroom_dumplings'];
function setup() {
  const bag = new Inventory();
  for (const id of ['raw_meat', 'vegetables', 'potato', 'dried_pale', 'dried_lilac', 'broccoli', 'zucchini', 'milk', 'cabbage', 'egg', 'pepper', 'mushroom_flour']) bag.add(id, 8);
  const c = new Crucibles({ station: 'cauldron', bag: () => bag, deliver: () => false, heated: () => true });
  return { bag, c };
}

check('block 569 is the Cauldron, a stone station; it has a shape and a hand recipe of Age 2', () => {
  const b = BLOCKS_BY_ID.get(569);
  assert.equal(b.name, 'Cauldron'); assert.equal(stationOf(569), 'cauldron'); assert.equal(b.material, 'stone');
  assert.ok(PROP_SHAPES[b.shape].length >= 8 && PROP_SHAPES[b.shape].length <= 14);
  assert.equal(ITEMS_BY_ID.get('cauldron').block, 569);
  const r = RECIPES_BY_ID.get('cauldron');
  assert.equal(r.station, 'hand'); assert.equal(r.age, 2); assert.deepEqual(r.inputs, { cobblestone: 6, clay: 2 });
});
check('four meal recipes as designed: 40 s, 2 out, at the cauldron only', () => {
  const want = {
    hunters_stew: { raw_meat: 2, vegetables: 1, potato: 1, dried_pale: 1 },
    forest_broth: { raw_meat: 1, broccoli: 1, zucchini: 1, dried_lilac: 1 },
    mushroom_soup: { dried_lilac: 2, milk: 1, cabbage: 1 },
    mushroom_dumplings: { mushroom_flour: 1, egg: 1, dried_pale: 1, pepper: 1 },
  };
  for (const id of MEALS) {
    const r = RECIPES_BY_ID.get(id);
    assert.equal(r.station, 'cauldron'); assert.deepEqual(r.inputs, want[id]);
    assert.equal(r.output.id, id); assert.equal(r.output.count, 2); assert.equal(r.seconds, 40);
    assert.equal(RECIPES.filter((x) => x.output.id === id).length, 1);
  }
  assert.equal(RECIPES_BY_ID.get('mushroom_soup').age, 3); assert.equal(RECIPES_BY_ID.get('mushroom_dumplings').age, 3);
  assert.equal(RECIPES_BY_ID.get('hunters_stew').age, 2); assert.equal(RECIPES_BY_ID.get('forest_broth').age, 2);
});
check('every meal is food and feeds more than any raw food and more than cooked meat', () => {
  const raw = ['fruit', 'vegetables', 'potato', 'cabbage', 'lettuce', 'pepper', 'zucchini', 'broccoli', 'raw_meat', 'egg', 'milk'];
  const feeds = { hunters_stew: 50, forest_broth: 40, mushroom_soup: 36, mushroom_dumplings: 44 };
  for (const id of MEALS) {
    const it = ITEMS_BY_ID.get(id);
    assert.ok(isFood(id)); assert.equal(it.feeds, feeds[id]); assert.ok(it.feeds >= 36 && it.feeds <= 50);
    assert.ok(it.feeds > ITEMS_BY_ID.get('cooked_meat').feeds);
    for (const r of raw) assert.ok(it.feeds > ITEMS_BY_ID.get(r).feeds);
  }
});
check('every meal takes a dried mushroom or flour, a meat or egg or milk, and a vegetable', () => {
  for (const id of MEALS) {
    const ins = Object.keys(RECIPES_BY_ID.get(id).inputs);
    assert.ok(ins.some((i) => i.startsWith('dried_') || i === 'mushroom_flour'), `${id}: mushroom`);
    assert.ok(ins.some((i) => ['raw_meat', 'egg', 'milk'].includes(i)), `${id}: meat, egg or milk`);
    assert.ok(ins.some((i) => ['vegetables', 'potato', 'broccoli', 'zucchini', 'cabbage', 'pepper'].includes(i)), `${id}: vegetable`);
  }
});
check('mouldFor gives a bowl, and the bar shows no mould buttons for it', () => {
  for (const id of MEALS) assert.equal(mouldFor(RECIPES_BY_ID.get(id)), 'bowl');
  const bar = readFileSync(new URL('../src/ui/CrucibleBar.js', import.meta.url), 'utf8');
  assert.match(bar, /moulds = poured === 'ingot' \|\| poured === 'coin'/);
  const { c } = setup();
  c.load(K, 'hunters_stew', 1);
  assert.equal(c.state(K).mould, 'bowl');
});
check('load, simmer 40 s, pour at 1.0 gives 2 meals', () => {
  const { bag, c } = setup();
  assert.equal(c.load(K, 'hunters_stew', 1).batches, 1);
  assert.equal(bag.countOf('raw_meat'), 6); assert.equal(bag.countOf('dried_pale'), 7);
  c.tick(39); assert.equal(c.state(K).molten, 0);
  c.tick(1); assert.equal(c.state(K).molten, 1);
  const r = c.pour(K, 1.0);
  assert.equal(r.result, 'made'); assert.equal(r.made.id, 'hunters_stew'); assert.equal(r.made.count, 2);
  assert.equal(bag.countOf('hunters_stew'), 2);
  assert.equal(c.pour(K, 1.0).result, 'none');
});
check('other stations\' recipes do not load here', () => {
  const { c } = setup();
  assert.match(c.load(K, 'dry_red').reason, /Cauldron/);
});
check('broken mid-cook: unloaded inputs back, cooked meals whole', () => {
  const { bag, c } = setup();
  c.load(K, 'forest_broth', 3); c.tick(45); // one cooked and waiting, two still in
  assert.equal(bag.countOf('raw_meat'), 5);
  c.prune(() => false);
  assert.equal(bag.countOf('raw_meat'), 7, 'two unloaded batches back');
  assert.equal(bag.countOf('forest_broth'), 2, 'the cooked batch whole');
  assert.equal(c.pots.size, 0);
});
check('saved and loaded, a pot keeps its bowl', () => {
  const { c } = setup();
  c.load(K, 'mushroom_soup', 2); c.tick(50);
  const { c: back } = setup();
  back.loadJSON(JSON.parse(JSON.stringify(c.toJSON())));
  assert.deepEqual(back.state(K), c.state(K));
  assert.equal(back.state(K).mould, 'bowl');
});

process.exit(failures ? 1 : 0);
