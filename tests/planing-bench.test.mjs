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

const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
world.setBlock(10, 5, 10, PLANING_BENCH);
const near = DuiltGame.prototype.stationsNear.call({ world, structures: { list: () => [] } }, { x: 10.5, y: 5, z: 12 });
assert.ok(near.includes('planing_bench'));
console.log('PASS standing by a placed bench counts as being at it');
