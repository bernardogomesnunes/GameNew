// PLAY-17: mushroom flour is ground at the Stone Mill (docs/design/play-14-21.md).
import assert from 'node:assert/strict';
import { Crafting } from '../src/duilt/Crafting.js';
import { Inventory } from '../src/items/Inventory.js';
import { benchStroke } from '../src/duilt/BenchWork.js';
import { RECIPES, RECIPES_BY_ID } from '../src/config/recipes.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { recipeChain } from '../src/duilt/recipeChain.js';

const r = RECIPES_BY_ID.get('mill_mushroom_flour');
assert.equal(r.station, 'stone_mill'); assert.equal(r.age, 3);
assert.deepEqual(r.inputs, { dried_pale: 1 }); assert.equal(r.output.id, 'mushroom_flour'); assert.equal(r.output.count, 1);
assert.equal(r.batch, 8);
console.log('PASS mill_mushroom_flour: Stone Mill, Age 3, 1 dried pale to 1 flour, batch 8');

const bag = new Inventory();
const crafting = new Crafting({ inventory: bag, world: { getBlock: () => 0 } });
bag.add('dried_pale', 3);
const made = benchStroke(crafting, 'mill_mushroom_flour', 0.95, { atStations: ['stone_mill'], age: 3 });
assert.equal(made.result, 'made');
assert.equal(bag.countOf('mushroom_flour'), 1); assert.equal(bag.countOf('dried_pale'), 2);
assert.equal(benchStroke(crafting, 'mill_mushroom_flour', 0.95, { atStations: [], age: 3 }).result, 'none');
console.log('PASS a stroke at the Stone Mill makes 1 flour from 1 dried pale, and nothing away from it');

assert.deepEqual(RECIPES.filter((x) => x.output.id === 'mushroom_flour').map((x) => x.id), ['mill_mushroom_flour']);
assert.ok(!RECIPES.filter((x) => x.station === 'wood_mill').some((x) => Object.keys(x.inputs).some((i) => /mushroom|dried_/.test(i))));
console.log('PASS the one recipe that makes flour; no Wood Mill recipe takes mushrooms');

assert.equal(recipeChain('mushroom_flour').text, 'Pale Mushroom > Dehydrator > Dried Pale Mushroom > Stone Mill > Mushroom Flour');
console.log('PASS the chain line reads Pale Mushroom > Dehydrator > Dried Pale Mushroom > Stone Mill > Mushroom Flour');

assert.match(ITEMS_BY_ID.get('stone_mill').madeBy, /mushroom flour/);
assert.match(RECIPES_BY_ID.get('stone_mill').blurb, /mushroom flour/);
console.log('PASS the Stone Mill texts say it grinds mushroom flour');
