// CRAFT3D-1, Task 2: the Carpenter's Table (the Counter until CRAFT-9), and furniture made nowhere else.
import assert from 'node:assert/strict';
import { COUNTER, BLOCKS_BY_ID, stationOf, shapeOf } from '../src/config/blocks.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES, RECIPES_BY_ID } from '../src/config/recipes.js';
import { FURNITURE, COST } from '../src/config/furnitureParts.js';

assert.equal(COUNTER, 530);
assert.equal(stationOf(530), 'counter');
assert.equal(BLOCKS_BY_ID.get(530).name, "Carpenter's Table");
assert.equal(ITEMS_BY_ID.get('counter').name, "Carpenter's Table");
assert.equal(RECIPES_BY_ID.get('counter').name, "Carpenter's Table");
assert.equal(ITEMS_BY_ID.get('counter').block, 530);
const r = RECIPES_BY_ID.get('counter');
assert.equal(r.station, 'hand');
assert.equal(r.age, 1);
assert.deepEqual(r.inputs, { planks: 6, wood: 2 });
console.log("PASS the Carpenter's Table: still block 530 and item `counter`, made by hand from Age 1 (the first house is furnished from it) from 6 planks and 2 logs");

// CRAFT-9: drawn as a table: a thick top level with the cell's top, on four legs, a vise and a saw.
{
  assert.equal(shapeOf(530), 'carpenters_table');
  const boxes = PROP_SHAPES.carpenters_table;
  const legs = boxes.filter((b) => b.minY === 0 && b.maxY > 0.8 && b.maxX - b.minX < 0.2 && b.maxZ - b.minZ < 0.2);
  assert.equal(legs.length, 4, 'four legs');
  const top = boxes.find((b) => b.minX === 0 && b.maxX === 1 && b.maxY === 1);
  assert.ok(top && top.maxY - top.minY >= 0.12, 'a thick top, level with the top of the cell');
  assert.ok(boxes.some((b) => b.minZ < 0), 'the vise screw stands out of the front');
  assert.ok(boxes.some((b) => b.minX >= 0.94 && b.maxY - b.minY > 0.3), 'the saw hangs on the side');
  for (const b of boxes) assert.ok(b.minX >= 0 && b.maxX <= 1 && b.minY >= 0 && b.maxY <= 1.02 && b.minZ >= -0.08 && b.maxZ <= 1, 'inside its cell');
  console.log("PASS the Carpenter's Table is drawn as a table: four legs, a thick top, a vise, a saw on its side");
}

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
