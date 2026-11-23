// PLAY-18: mushroom building items made from dried mushroom and flour (docs/design/play-14-21.md).
import assert from 'node:assert/strict';
import { RECIPES, RECIPES_BY_ID } from '../src/config/recipes.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { BLOCKS_BY_ID } from '../src/config/blocks.js';
import { blockTexture } from '../src/config/textures.js';

const WAS = ['clay', 'leaves', 'white_leaves', 'sand'];
for (const [id, input] of [['cap_red', 'dried_red'], ['cap_lilac', 'dried_lilac'], ['mushroom_stem', 'mushroom_flour']]) {
  const r = RECIPES_BY_ID.get(id);
  assert.deepEqual(r.inputs, { [input]: 1 }, id);
  assert.equal(r.output.count, 2); assert.equal(r.batch, 8); assert.equal(r.station, 'workbench', 'a hand recipe past Age 2 is made at the Workbench'); assert.equal(r.age, 3);
  for (const w of WAS) assert.ok(!(w in r.inputs), `${id} no longer takes ${w}`);
}
console.log('PASS cap_red, cap_lilac and mushroom_stem take dried_red, dried_lilac and mushroom_flour, and no clay, leaves or sand');

assert.match(ITEMS_BY_ID.get('cap_red').madeBy, /dried red mushrooms/);
assert.match(ITEMS_BY_ID.get('cap_lilac').madeBy, /dried lilac mushrooms/);
assert.match(ITEMS_BY_ID.get('mushroom_stem').madeBy, /Mushroom flour/);
assert.equal(ITEMS_BY_ID.get('cap_red').glyph, 'mushroom');
assert.equal(ITEMS_BY_ID.get('cap_lilac').glyph, 'mushroom');
console.log('PASS the madeBy texts name the new inputs and the caps use the mushroom glyph');

const plaster = RECIPES_BY_ID.get('mushroom_plaster');
assert.equal(plaster.station, 'workbench'); assert.equal(plaster.age, 3);
assert.deepEqual(plaster.inputs, { mushroom_flour: 1, sand: 1, clay: 1 }); assert.equal(plaster.output.count, 4);
const b = BLOCKS_BY_ID.get(570);
assert.equal(b.name, 'Mushroom Plaster'); assert.equal(b.shape, undefined, 'a full cube'); assert.equal(b.material, 'stone');
assert.equal(b.color, 0xe9dcc2); assert.equal(b.unlock, null);
assert.equal(ITEMS_BY_ID.get('mushroom_plaster').block, 570);
assert.ok(blockTexture(b), 'it has its own texture');
console.log('PASS Mushroom Plaster: block 570, a full cube, Workbench Age 3, flour 1, sand 1, clay 1 to 4');

for (const out of ['cap_red', 'cap_lilac', 'mushroom_stem']) {
  assert.ok(!RECIPES.some((r) => r.output.id === out && 'clay' in r.inputs), `no clay recipe makes ${out}`);
  assert.equal(RECIPES.filter((r) => r.output.id === out).length, 1, `one way to ${out}`);
}
console.log('PASS no recipe outputs a cap or stem from clay');
