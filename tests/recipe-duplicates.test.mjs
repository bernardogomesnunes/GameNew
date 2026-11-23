// PLAY-11 chunk A: an item made more than one way is listed here with its
// reason, and three recipes (workbench Stone Slab, workshop Workbench,
// workshop Lantern) are gone. Rings: forge only (default decision, 23 Nov).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RECIPES, RECIPES_BY_ID, howToGet } from '../src/config/recipes.js';

const KEEP = {
  stone: 'variants: cobblestone, white stone, marble',
  bucket: 'emptying a water bucket',
  planks: 'owner 16 Nov: machine costs less',
  iron_ingot: 'unpack an iron block',
  gold: 'unpack a gold block',
  coin: 'variants: gold, copper, ruby',
  slab_plank: 'owner 16 Nov', stairs_plank: 'owner 16 Nov', chest: 'owner 16 Nov', door: 'owner 16 Nov',
  white_planks: 'owner 16 Nov', door_white: 'owner 16 Nov', trapdoor_white: 'owner 16 Nov',
  dark_planks: 'owner 16 Nov', door_dark: 'owner 16 Nov', trapdoor_dark: 'owner 16 Nov',
  string: 'bow.test needs hand string; wheel variants',
  gravel: 'variants: cobblestone or stone',
  roof_stone: 'owner 16 Nov', trim_curl: 'owner 16 Nov', trapdoor: 'owner 16 Nov',
  vase: 'age gap: workbench 2 clay Age 3, kiln oven 1 clay Age 4',
  compost: 'one recipe per seed kind',
  devotion: 'five offerings',
};
const MACHINE_CHEAPER = ['planks', 'slab_plank', 'stairs_plank', 'chest', 'door', 'white_planks', 'door_white',
  'trapdoor_white', 'dark_planks', 'door_dark', 'trapdoor_dark', 'roof_stone', 'trim_curl', 'trapdoor'];

const byOut = new Map();
for (const r of RECIPES) {
  if (!r.output?.id) continue;
  if (!byOut.has(r.output.id)) byOut.set(r.output.id, []);
  byOut.get(r.output.id).push(r);
}
const dupes = [...byOut].filter(([, rs]) => rs.length > 1).map(([id]) => id).sort();

assert.deepEqual(dupes, Object.keys(KEEP).sort(), 'every duplicated item is on the KEEP list, and the list has nothing extra');
assert.equal(dupes.length, 24);
console.log('PASS 24 items made more than one way, each with a reason');

for (const id of ['slab_stone', 'lantern', 'workshop_workbench', 'ring_white', 'ring_black']) {
  assert.equal(RECIPES_BY_ID.get(id), undefined, `${id} is not a recipe id`);
}
console.log('PASS the 3 duplicates and the 2 temple rings are gone');

assert.deepEqual(byOut.get('slab_stone').map((r) => r.id), ['mason_slab_stone']);
assert.match(howToGet('slab_stone'), /mason/i);
const lantern = byOut.get('lantern');
assert.deepEqual(lantern.map((r) => r.id), ['lantern_workbench']);
assert.equal(lantern[0].station, 'hand');
assert.equal(lantern[0].age, 1);
assert.doesNotMatch(lantern[0].blurb, /workshop/i);
const wb = byOut.get('workbench');
assert.deepEqual(wb.map((r) => r.id), ['workbench']);
assert.equal(wb[0].station, 'hand');
assert.equal(wb[0].age, 1);
console.log('PASS Stone Slab, Lantern and Workbench each have one recipe');

for (const color of ['white', 'black']) {
  const rs = byOut.get(`ring_${color}`);
  assert.deepEqual(rs.map((r) => r.id), [`ring_${color}_forge`]);
  assert.equal(rs[0].station, 'forge');
  assert.equal(rs[0].needsTemple, 4);
}
console.log('PASS each ring is forged at the forge only, with a level 5 temple');

const total = (r) => Object.values(r.inputs).reduce((a, b) => a + b, 0);
for (const id of MACHINE_CHEAPER) {
  const hand = byOut.get(id).filter((r) => r.station === 'hand' || r.station === 'workbench');
  const mach = byOut.get(id).filter((r) => r.station !== 'hand' && r.station !== 'workbench');
  assert.ok(hand.length && mach.length, `${id} has a hand and a machine recipe`);
  const per = (r) => r.output.count / total(r);
  assert.ok(mach.every((m) => hand.every((h) => per(m) > per(h))), `${id}: the machine gives more output per input`);
}
console.log('PASS every owner-16-Nov pair: the machine gives more per input');

const text = ['quests', 'achievements', 'challenges', 'ages', 'secrets', 'skills']
  .map((n) => readFileSync(new URL(`../src/config/${n}.js`, import.meta.url), 'utf8')).join('\n');
assert.ok(!text.includes('workshop_workbench'), 'no config names a removed recipe id');
console.log('PASS no quest, achievement or challenge names a removed recipe id');
