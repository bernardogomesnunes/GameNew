// CRAFT-9 part 4 (docs/plan-crafting-processes.md): the Mason's Bench shapes
// cut stone. Shaping moved from the stone mill; the 24 workbench copies went;
// a chisel tap on each of three chalk marks makes a batch; an older world
// past Age 3 gets one bench in the bag on its first load.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Crafting, stationName } from '../src/duilt/Crafting.js';
import { Inventory } from '../src/items/Inventory.js';
import { RECIPES, RECIPES_BY_ID, howToGet } from '../src/config/recipes.js';
import { BLOCKS_BY_ID, stationOf, MASONS_BENCH } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';
import { BENCH_MACHINES, CHISEL_TAPS, chiselTap } from '../src/duilt/BenchWork.js';
import { StationWork, usesSpots } from '../src/duilt/StationWork.js';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

assert.equal(MASONS_BENCH, 538);
assert.equal(stationOf(MASONS_BENCH), 'masons_bench');
assert.equal(BLOCKS_BY_ID.get(MASONS_BENCH).name, "Mason's Bench");
assert.ok(PROP_SHAPES.masons_bench.length >= 10, 'drawn as a bench, not a cube');
assert.equal(ITEMS_BY_ID.get('masons_bench').block, MASONS_BENCH);
const bench = RECIPES_BY_ID.get('masons_bench');
assert.deepEqual(bench.inputs, { stone: 6, planks: 4 });
assert.equal(bench.age, 3);
assert.equal(bench.station, 'workbench', 'made by hand from Age 3, so at the placed Workbench');
assert.equal(stationName('masons_bench'), "mason's bench");
console.log("PASS the Mason's Bench is block 538, an item, and made from 6 stone and 4 planks at Age 3");

const SHAPED = ['stairs_stone', 'roof_stone', 'roof_brick',
  'wall_stone', 'wall_cobble', 'wall_brick', 'wall_dark', 'wall_stone_brick', 'wall_sandstone', 'wall_dark_brick',
  'wall_marble', 'wall_sky_marble', 'wall_white_stone', 'wall_grey_stone', 'wall_turquoise', 'wall_orange',
  'chimney_stone_brick', 'chimney_brick', 'pillar_stone', 'pillar_marble', 'pillar_dark', 'calcada_wave'];
assert.equal(SHAPED.length, 22);
for (const id of SHAPED) {
  const r = RECIPES_BY_ID.get(`mason_${id}`);
  assert.equal(r?.station, 'masons_bench', `${id} is shaped at the bench`);
  assert.ok(!RECIPES_BY_ID.has(`stone_mill_${id}`), `${id} left the mill`);
  assert.ok(!RECIPES.some((x) => x.output.id === id && !['masons_bench', 'hand'].includes(x.station)), `${id} is made nowhere else but by hand`);
}
assert.equal(RECIPES_BY_ID.get('marble').station, 'masons_bench');
assert.deepEqual(RECIPES_BY_ID.get('mason_slab_stone').inputs, { stone: 1 });
assert.equal(RECIPES_BY_ID.get('mason_slab_stone').output.count, 2, 'two slabs: a third would make stone from nothing');
// The plan's yields.
const yields = { mason_wall_stone: 6, mason_stairs_stone: 2, mason_roof_stone: 3, mason_pillar_stone: 3, mason_chimney_brick: 3, mason_roof_brick: 3, mason_calcada_wave: 5 };
for (const [id, n] of Object.entries(yields)) assert.equal(RECIPES_BY_ID.get(id).output.count, n, id);
assert.equal(RECIPES_BY_ID.get('mason_wall_marble').age, 8);
assert.equal(RECIPES_BY_ID.get('mason_pillar_stone').age, 4);
console.log("PASS 22 shaping recipes moved from the mill, marble too, and the stone slab is new at the bench");

// The 24 workbench copies are gone; the Age 1 roof slate by hand stays and gives less.
const COPIES = ['sandstone_brick', 'calcada', 'calcada_dark', ...SHAPED.filter((id) => id !== 'roof_stone')];
assert.equal(COPIES.length, 24);
for (const id of COPIES) assert.ok(!RECIPES_BY_ID.has(id), `the workbench copy ${id} is gone`);
const hand = RECIPES_BY_ID.get('roof_stone');
assert.equal(hand.station, 'hand');
assert.ok(RECIPES_BY_ID.get('mason_roof_stone').output.count > hand.output.count, 'cheaper at the bench than by hand');
assert.ok(RECIPES_BY_ID.get('stone_mill_stone_brick'), 'the stone brick (cut at the mill) stays');
for (const id of ['wall_stone', 'pillar_dark', 'chimney_stone_brick']) assert.match(howToGet(id), /at a mason's bench/);
console.log('PASS the 24 workbench copies are gone; the hand roof slate gives 2, the bench 3; howToGet names the bench');

// Chisel taps: three marks, the third makes the batch, nothing is spent before, nothing spoils.
{
  const bag = new Inventory();
  bag.add('stone', 3);
  const c = new Crafting({ inventory: bag, world: { getBlock: () => 0 } });
  const at = { atStations: ['masons_bench'], age: 3 };
  assert.equal(BENCH_MACHINES.masons_bench.taps, CHISEL_TAPS);
  assert.deepEqual(chiselTap(c, 'mason_wall_stone', 0, at), { result: 'tap', done: 1 });
  assert.deepEqual(chiselTap(c, 'mason_wall_stone', 1, at), { result: 'tap', done: 2 });
  assert.equal(bag.countOf('stone'), 3, 'tapping the marks spends nothing');
  const made = chiselTap(c, 'mason_wall_stone', 2, at);
  assert.equal(made.result, 'made');
  assert.deepEqual([bag.countOf('stone'), bag.countOf('wall_stone')], [0, 6]);
  assert.equal(chiselTap(c, 'mason_wall_stone', 0, at).result, 'none', 'no stone left: no tap');
  bag.add('stone', 3);
  assert.equal(chiselTap(c, 'mason_wall_stone', 0, { atStations: [], age: 3 }).result, 'none', 'away from the bench, nothing');
  assert.equal(chiselTap(c, 'mason_pillar_stone', 0, at).result, 'none', 'pillars wait for Age 4');
}
console.log('PASS three chisel taps make one batch; nothing spent before the third; nothing at the wrong place or age');

// A saved stone mill spot on a shaping recipe moves to the bench recipe, and the prune refunds it.
{
  const bag = new Inventory();
  const w = new StationWork({ inventory: bag });
  w.loadJSON([
    { key: '1,2,3', station: 'stone_mill', recipeId: 'stone_mill_wall_stone', batches: 2, progress: 0.4, out: 6 },
    { key: '4,5,6', station: 'stone_mill', recipeId: 'marble', batches: 1, progress: 0, out: 1 },
    { key: '7,8,9', station: 'stone_mill', recipeId: 'stone_mill_stone_brick', batches: 1, progress: 0, out: 0 },
  ]);
  assert.deepEqual([w.spot('1,2,3').station, w.spot('1,2,3').recipeId], ['masons_bench', 'mason_wall_stone']);
  assert.equal(w.spot('4,5,6').station, 'masons_bench');
  assert.ok(usesSpots(RECIPES_BY_ID.get('mason_wall_stone')));
  // Each spot still stands at a stone mill: no bench there, so its stone and walls come back.
  w.prune((key, station) => station === 'stone_mill');
  assert.deepEqual([bag.countOf('stone'), bag.countOf('wall_stone'), bag.countOf('marble')], [3 * 2 + 4, 6, 1]);
  assert.ok(w.spot('7,8,9'), 'the mill keeps its brick work');
}
console.log('PASS saved mill shaping work is handed back on load; brick work stays at the mill');

// Old worlds: one bench, once, at Age 3 or later.
{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const scene = new THREE.Scene();
  const fresh = new DuiltGame({ world, scene, bus: null });
  const save = JSON.parse(JSON.stringify(fresh.toJSON()));
  assert.equal(save.masonsBench, true, 'a save from now on is marked');
  const old = (age) => { const s = JSON.parse(JSON.stringify(save)); delete s.masonsBench; s.territory.age = age; return s; };
  const g = new DuiltGame({ world, scene, bus: null });
  g.loadJSON(old(3));
  assert.equal(g.inventory.countOf('masons_bench'), 1, 'an Age 3 world from before gets one');
  assert.equal(g.gifted, 'masons_bench');
  const again = JSON.parse(JSON.stringify(g.toJSON()));
  const g2 = new DuiltGame({ world, scene, bus: null });
  g2.loadJSON(again);
  assert.equal(g2.inventory.countOf('masons_bench'), 1, 'given once');
  assert.equal(g2.gifted, null);
  const young = new DuiltGame({ world, scene, bus: null });
  young.loadJSON(old(2));
  assert.equal(young.inventory.countOf('masons_bench'), 0, 'an Age 2 world makes its own later');
  assert.equal(young.toJSON().masonsBench, true);
  const sandbox = new DuiltGame({ world, scene, bus: null, sandbox: true });
  sandbox.loadJSON(old(5));
  assert.equal(sandbox.gifted, null, 'not in creative');
}
console.log("PASS a world from before at Age 3 or later gets one Mason's Bench, once");

const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
world.setBlock(10, 5, 10, MASONS_BENCH);
const near = DuiltGame.prototype.stationsNear.call({ world, structures: { list: () => [] } }, { x: 10.5, y: 5, z: 12 });
assert.ok(near.includes('masons_bench'));
console.log('PASS standing by a placed bench counts as being at it');
