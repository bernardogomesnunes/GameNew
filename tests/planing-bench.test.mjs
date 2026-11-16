// IMP-6 phase 1: "carpenter planer should be placed and give more planks".
import assert from 'node:assert/strict';
import { Crafting } from '../src/duilt/Crafting.js';
import { Inventory } from '../src/items/Inventory.js';
import { RECIPES_BY_ID } from '../src/config/recipes.js';
import { BLOCKS_BY_ID, stationOf, PLANING_BENCH } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

assert.equal(ITEMS_BY_ID.get('planing_bench').block, PLANING_BENCH);
assert.equal(stationOf(PLANING_BENCH), 'planing_bench');
assert.equal(BLOCKS_BY_ID.get(PLANING_BENCH).name, 'Planing Bench');
console.log('PASS the planing bench is a placeable station block');

const bench = RECIPES_BY_ID.get('bench_planks'), hand = RECIPES_BY_ID.get('planks');
assert.equal(bench.station, 'planing_bench');
assert.ok(bench.output.count > hand.output.count, 'more planks than by hand');
assert.equal(bench.inputs.wood, 1);
assert.equal(RECIPES_BY_ID.get('planing_bench').station, 'hand');
console.log('PASS at the bench a log gives more planks than by hand');

const inv = new Inventory();
inv.add('wood', 4);
const craft = new Crafting({ inventory: inv, world: { getBlock: () => 0 } });
assert.equal(craft.craft('bench_planks', 1).ok, false, 'not away from the bench');
assert.equal(craft.craft('bench_planks', 1, { atStations: ['planing_bench'] }).ok, true);
assert.equal(inv.countOf('planks'), 3);
console.log('PASS it only works standing at the bench');

// CRAFT-9: all three woods are planed at the bench from Age 1, for less than by hand.
for (const [id, wood, out, handId] of [['bench_planks', 'wood', 'planks', 'planks'], ['bench_planks_white', 'white_wood', 'white_planks', 'white_planks'], ['bench_planks_dark', 'dark_wood', 'dark_planks', 'dark_planks']]) {
  const b = RECIPES_BY_ID.get(id), h = RECIPES_BY_ID.get(handId);
  assert.equal(b.station, 'planing_bench'); assert.equal(b.age, 1);
  assert.deepEqual(b.inputs, { [wood]: 1 }); assert.deepEqual(b.output, { id: out, count: 3 });
  assert.equal(h.station, 'hand'); assert.equal(h.output.count, 2);
}
for (const id of ['mill_planks', 'mill_planks_white', 'mill_planks_dark', 'planks_fine']) assert.equal(RECIPES_BY_ID.get(id), undefined, id);
console.log('PASS oak, white and dark planks are planed at the bench from Age 1');

// Saved work on a removed mill recipe carries on as the bench recipe.
{
  const { StationWork } = await import('../src/duilt/StationWork.js');
  const w = new StationWork({ inventory: new Inventory() });
  w.loadJSON([{ key: 's:1', station: 'wood_mill', recipeId: 'mill_planks_white', batches: 3, progress: 0.5, out: 6 }, { key: 's:2', station: 'wood_mill', recipeId: 'gone_forever', batches: 2, progress: 0, out: 0 }]);
  const s = w.spot('s:1');
  assert.deepEqual([s.station, s.recipeId, s.batches, s.out], ['planing_bench', 'bench_planks_white', 3, 6]);
  assert.equal(w.spot('s:2'), null);
}
console.log('PASS saved mill plank work carries on at the bench');

const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
world.setBlock(10, 5, 10, PLANING_BENCH);
const near = DuiltGame.prototype.stationsNear.call({ world, structures: { list: () => [] } }, { x: 10.5, y: 5, z: 12 });
assert.ok(near.includes('planing_bench'));
console.log('PASS standing by a placed bench counts as being at it');
