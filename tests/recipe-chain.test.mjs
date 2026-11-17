import assert from 'node:assert/strict';
import { recipeChain, stationLabel } from '../src/duilt/recipeChain.js';
import { chainLineHtml } from '../src/ui/chainLine.js';
import { RECIPES } from '../src/config/recipes.js';

// CRAFT-9 part 7: the chain line comes from recipe data.
const text = (id) => recipeChain(id)?.text ?? null;
assert.equal(text('planks'), 'Oak Log > Planing Bench > Oak Planks');
assert.equal(text('slab_plank'), 'Oak Log > Planing Bench > Oak Planks > Wood Mill > Plank Slab');
assert.equal(text('door'), 'Oak Log > Planing Bench > Oak Planks > Joinery Bench > Door');
assert.equal(text('brick'), 'Clay > Kiln Oven > Brick');
assert.equal(text('glass'), 'Stone > Stone Mill > Sand > Kiln Oven > Glass');
assert.equal(text('chair_oak'), "Oak Log > Planing Bench > Oak Planks > Carpenter's Table > Oak Chair");
console.log('PASS chains for planks, slab, door, brick, glass and a chair read from the recipes');

assert.equal(text('wood'), null, 'a raw log has no chain');
assert.equal(text('axe'), null, 'hand work has no chain');
assert.equal(text('no_such_item'), null);
console.log('PASS raw and hand-made items have no line');

// A new station in the data shows up with no code change; a repeated station folds.
const fake = [
  { id: 'b', station: 'kiln_oven', age: 4, inputs: { clay: 1 }, output: { id: 'brick', count: 2 } },
  { id: 'c', station: 'masons_bench', age: 3, inputs: { brick: 1 }, output: { id: 'roof', count: 3 } },
  { id: 'd', station: 'masons_bench', age: 3, inputs: { roof: 1 }, output: { id: 'ridge', count: 1 } },
  { id: 'e', station: 'stone_mill', age: 3, inputs: { stone: 1 }, output: { id: 'clay', count: 1 } },
  { id: 'f', station: 'a', inputs: { x: 1 }, output: { id: 'x', count: 1 } },
];
const names = { clay: 'Clay', brick: 'Brick', roof: 'Roof', ridge: 'Ridge', stone: 'Stone', x: 'X' };
const st = { kiln_oven: 'Kiln Oven', masons_bench: "Mason's Bench", stone_mill: 'Stone Mill', a: 'A' };
const o = { recipes: fake, itemName: (i) => names[i], stationName: (s) => st[s] };
assert.equal(recipeChain('ridge', o).text, "Stone > Stone Mill > Clay > Kiln Oven > Brick > Mason's Bench > Ridge");
console.log('PASS a new station appears from data; two steps at one station fold into one');

assert.equal(recipeChain('x', o), null, 'a recipe that needs its own output has no chain');
console.log('PASS a cycle ends');

const many = ['s1', 's2', 's3', 's4', 's5'].map((s, i) => ({ id: s, station: s, age: 1, inputs: { [`i${i}`]: 1 }, output: { id: `i${i + 1}`, count: 1 } }));
const long = recipeChain('i5', { recipes: many, itemName: (i) => i, stationName: (s) => s.toUpperCase() });
assert.equal(long.text, 'i2 > S3 > i3 > S4 > i4 > S5 > i5', 'a long chain keeps its last 3 stations');
console.log('PASS a long chain is cut to 3 stations');

assert.equal(stationLabel('planing_bench'), 'Planing Bench');
assert.equal(stationLabel('made_up_station'), 'Made up station');
console.log('PASS station names come from the blocks, else the id in words');

// Every station a recipe uses gets a readable name, so no line shows a raw id.
const stations = new Set(RECIPES.map((r) => r.station).filter((s) => s !== 'hand'));
for (const s of stations) assert.ok(!/_/.test(stationLabel(s)), `${s} has a display name`);
console.log('PASS every recipe station has a display name');

// Every station recipe's output yields a well-formed line.
let lines = 0;
for (const r of RECIPES) {
  if (r.study || r.station === 'hand') continue;
  const c = recipeChain(r.output.id);
  if (!c) continue;
  lines++;
  assert.ok(c.steps.length >= 3 && c.steps.length % 2 === 1 && c.steps.length <= 7, r.id);
  assert.equal(c.steps[0].kind, 'item');
}
assert.ok(lines > 50, `${lines} lines`);
console.log(`PASS ${lines} station recipes give a well-formed line`);

const html = chainLineHtml('planks', 'planing_bench');
assert.match(html, /<p class="chain-line"/);
assert.match(html, /chain-station here">Planing Bench/);
assert.equal(chainLineHtml('wood'), '');
assert.equal(chainLineHtml(null), '');
assert.ok(!chainLineHtml('planks', 'wood_mill').includes('here'));
console.log('PASS the html lights the station you are at and is empty without a chain');
