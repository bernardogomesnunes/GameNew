// IMP-10 step 3: "plane mallet should be placed". The mallet becomes a placed
// Joinery Bench; the mallet is no longer a bag tool; bows still ask for the plane.
import assert from 'node:assert/strict';
import { Crafting } from '../src/duilt/Crafting.js';
import { Inventory } from '../src/items/Inventory.js';
import { RECIPES, RECIPES_BY_ID } from '../src/config/recipes.js';
import { BLOCKS_BY_ID, stationOf, JOINERY_BENCH } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

assert.equal(ITEMS_BY_ID.get('joinery_bench').block, JOINERY_BENCH);
assert.equal(stationOf(JOINERY_BENCH), 'joinery_bench');
assert.equal(BLOCKS_BY_ID.get(JOINERY_BENCH).name, 'Joinery Bench');
assert.equal(RECIPES_BY_ID.get('joinery_bench').station, 'hand');
console.log('PASS the joinery bench is a placeable station block made by hand');

// CRAFT-9 part 2: door, trapdoor and chest keep a dearer hand recipe; fences and gates are made only here.
for (const id of ['door', 'trapdoor', 'chest', 'door_white', 'trapdoor_dark']) {
  const hand = RECIPES_BY_ID.get(id), bench = RECIPES_BY_ID.get(`joinery_${id}`);
  assert.equal(bench.station, 'joinery_bench');
  assert.equal(bench.output.id, hand.output.id);
  const per = (r) => Object.values(r.inputs)[0] / r.output.count;
  assert.ok(per(bench) < per(hand), `${id} costs fewer planks at the bench`);
}
for (const id of ['fence', 'gate', 'fence_white', 'gate_white', 'fence_dark', 'gate_dark']) {
  assert.ok(!RECIPES_BY_ID.has(id), `${id} has no workbench recipe`);
  assert.equal(RECIPES_BY_ID.get(`joinery_${id}`).station, 'joinery_bench');
}
assert.deepEqual(RECIPES_BY_ID.get('joinery_door').inputs, { planks: 3 });
assert.deepEqual(RECIPES_BY_ID.get('joinery_trapdoor').inputs, { planks: 2 });
console.log('PASS doors, trapdoors and chests take fewer planks at the bench; fences and gates are made only there');

assert.ok(!RECIPES.some((r) => r.output.id === 'carpentry_mallet'), 'no mallet recipe');
assert.ok(!RECIPES.some((r) => r.tools?.includes('carpentry_mallet')), 'nothing asks for the mallet');
assert.ok(ITEMS_BY_ID.has('carpentry_mallet'), 'old bags keep the item');
// CRAFT-9: the bow is made by hand; nothing asks for the plane.
assert.deepEqual(RECIPES_BY_ID.get('bow').tools, ['carpentry_saw']);
assert.equal(RECIPES_BY_ID.get('bow').station, 'hand');
assert.ok(!RECIPES.some((r) => r.tools?.includes('carpentry_plane')), 'nothing asks for the plane');
assert.ok(!RECIPES.some((r) => r.output.id === 'carpentry_plane'), 'no plane recipe');
assert.ok(RECIPES_BY_ID.get('planing_bench').age <= RECIPES_BY_ID.get('bow').age, 'the bench comes no later than the bow');
console.log('PASS the mallet and the plane left the bag rules; the bow is made by hand');

const inv = new Inventory();
inv.add('planks', 4);
const craft = new Crafting({ inventory: inv, world: { getBlock: () => 0 } });
assert.equal(craft.craft('joinery_chest', 1).ok, false, 'not away from the bench');
assert.equal(craft.craft('joinery_chest', 1, { atStations: ['joinery_bench'] }).ok, true);
assert.equal(inv.countOf('chest'), 1);
console.log('PASS it only works standing at the bench');

const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
world.setBlock(10, 5, 10, JOINERY_BENCH);
const near = DuiltGame.prototype.stationsNear.call({ world, structures: { list: () => [] } }, { x: 10.5, y: 5, z: 12 });
assert.ok(near.includes('joinery_bench'));
console.log('PASS standing by a placed bench counts as being at it');
