// CRAFT3D-1, Task 2: the Counter block, and furniture made nowhere else.
import assert from 'node:assert/strict';
import { COUNTER, BLOCKS_BY_ID, stationOf } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES, RECIPES_BY_ID } from '../src/config/recipes.js';
import { FURNITURE, COST } from '../src/config/furnitureParts.js';

assert.equal(COUNTER, 530);
assert.equal(stationOf(530), 'counter');
assert.equal(BLOCKS_BY_ID.get(530).name, 'Counter');
assert.equal(ITEMS_BY_ID.get('counter').block, 530);
const r = RECIPES_BY_ID.get('counter');
assert.equal(r.station, 'hand');
assert.equal(r.age, 1);
assert.deepEqual(r.inputs, { planks: 6, wood: 2 });
console.log('PASS the Counter: block 530, made by hand from Age 1 (the first house is furnished from it) from 6 planks and 2 logs');

assert.equal(RECIPES.filter((x) => FURNITURE.includes(x.output.id)).length, 0, 'no furniture recipe left anywhere');
for (const id of FURNITURE) {
  assert.ok(ITEMS_BY_ID.has(id), `${id} is still an item`);
  const cost = COST.get(id);
  assert.ok(cost && Object.values(cost).every((n) => n > 0), `${id} keeps its planks cost`);
}
assert.deepEqual(COST.get('table_oak'), { planks: 4 });
console.log('PASS furniture leaves every bench; each piece keeps its cost for the counter');

// Owner, 12 November: a new world could not furnish the Starter cabin or the Work Hall.
{
  const { AGE } = await import('../src/config/furnitureParts.js');
  for (const id of ['bed', 'painting', 'table_oak', 'chair_oak']) assert.equal(AGE.get(id), 1, id);
  console.log('PASS the first house and the Work Hall can be furnished in Age 1');
}
