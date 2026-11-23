// PLAY-16: the Dehydrator (docs/design/play-14-21.md). Block 568, mushrooms
// loaded, dried on their own, taken out on the tray: the Kiln Oven's pattern.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BLOCKS_BY_ID, stationOf } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES, RECIPES_BY_ID } from '../src/config/recipes.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';
import { Crucibles, POUR_MIN, POUR_MAX, meltSeconds, mouldFor } from '../src/duilt/Crucible.js';
import { Crafting } from '../src/duilt/Crafting.js';
import { Inventory } from '../src/items/Inventory.js';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('PASS ' + name); } catch (e) { failures++; console.log('FAIL ' + name + '\n  ' + e.message); } };
const K = '2,3,4';
function setup({ deliver = () => false } = {}) {
  const bag = new Inventory();
  bag.add('mushroom_red', 12); bag.add('mushroom_pale', 8);
  const d = new Crucibles({ station: 'dehydrator', bag: () => bag, deliver, heated: () => true });
  return { bag, d };
}

check('block 568 is the Dehydrator: a wood station with a shape of at most 12 boxes', () => {
  const b = BLOCKS_BY_ID.get(568);
  assert.equal(b.name, 'Dehydrator');
  assert.equal(stationOf(568), 'dehydrator');
  assert.equal(b.material, 'wood');
  assert.ok(PROP_SHAPES[b.shape].length <= 12 && PROP_SHAPES[b.shape].length >= 8);
  assert.ok(!PROP_SHAPES[b.shape].some((x) => x.glow), 'no glow');
  assert.equal(ITEMS_BY_ID.get('dehydrator').block, 568);
});
check('the hand recipe: Age 2, planks 6 and string 2', () => {
  const r = RECIPES_BY_ID.get('dehydrator');
  assert.equal(r.station, 'hand'); assert.equal(r.age, 2);
  assert.deepEqual(r.inputs, { planks: 6, string: 2 });
});
check('three drying recipes, 4 fresh to 2 dried, 30 s, at the dehydrator only', () => {
  for (const [id, fresh, dried] of [['dry_red', 'mushroom_red', 'dried_red'], ['dry_lilac', 'mushroom_lilac', 'dried_lilac'], ['dry_pale', 'mushroom_pale', 'dried_pale']]) {
    const r = RECIPES_BY_ID.get(id);
    assert.equal(r.station, 'dehydrator'); assert.deepEqual(r.inputs, { [fresh]: 4 });
    assert.equal(r.output.id, dried); assert.equal(r.output.count, 2); assert.equal(meltSeconds(r), 30);
    assert.equal(RECIPES.filter((x) => x.output.id === dried).length, 1, 'no other way to dried ' + dried);
  }
});
check('only dehydrator recipes load, and each draws onto the tray', () => {
  const { d } = setup();
  assert.equal(d.load(K, 'brick').ok, false);
  assert.match(d.load(K, 'brick').reason, /Dehydrator/);
  assert.equal(d.load(K, 'dry_red', 1).ok, true);
  assert.equal(d.state(K).mould, 'tray');
});
check('mouldFor is tray for the kiln oven and the dehydrator', () => {
  assert.equal(mouldFor(RECIPES_BY_ID.get('brick')), 'tray');
  assert.equal(mouldFor(RECIPES_BY_ID.get('dry_pale')), 'tray');
  assert.equal(mouldFor(RECIPES_BY_ID.get('iron_ingot') ?? RECIPES.find((r) => r.station === 'crucible' && r.output.id !== 'coal' && r.output.id !== 'coin')), 'ingot');
});
check('loading 2 batches spends 8; after 60 s two are ready; pour at 1.0 makes 2 dried', () => {
  const { bag, d } = setup();
  assert.equal(d.load(K, 'dry_red', 2).batches, 2);
  assert.equal(bag.countOf('mushroom_red'), 4);
  d.tick(30); assert.equal(d.state(K).molten, 1);
  d.tick(30); assert.equal(d.state(K).molten, 2);
  const r = d.pour(K, 1.0);
  assert.equal(r.result, 'made'); assert.equal(r.made.id, 'dried_red'); assert.equal(r.made.count, 2);
  assert.equal(bag.countOf('dried_red'), 2);
});
check('at 0.5 it is short, and at 1.2 it is lost', () => {
  const { bag, d } = setup();
  d.load(K, 'dry_red', 2); d.tick(60);
  assert.equal(d.pour(K, 0.5).result, 'short');
  assert.equal(d.state(K).molten, 2);
  assert.equal(d.pour(K, 1.2).result, 'spilt');
  assert.equal(d.state(K).molten, 1);
  assert.equal(bag.countOf('dried_red'), 0);
  assert.ok(POUR_MIN < 1 && POUR_MAX > 1 && POUR_MAX < 1.2);
});
check('the bench never lists dehydrator recipes', () => {
  const c = Object.create(Crafting.prototype);
  for (const id of ['dry_red', 'dry_lilac', 'dry_pale']) assert.equal(c.atStation(RECIPES_BY_ID.get(id), ['dehydrator', 'workbench']), false);
  assert.equal(c.atStation(RECIPES_BY_ID.get('dehydrator'), []), true);
});
check('broken with ware waiting: unloaded mushrooms back, dried ware whole', () => {
  const { bag, d } = setup();
  d.load(K, 'dry_red', 3); d.tick(35); // one dried and waiting, two still waiting
  assert.equal(bag.countOf('mushroom_red'), 0);
  d.prune(() => false);
  assert.equal(bag.countOf('mushroom_red'), 8, 'two unloaded batches back');
  assert.equal(bag.countOf('dried_red'), 2, 'the dried batch whole');
  assert.equal(d.pots.size, 0);
});
check('saved and loaded with the world', () => {
  const { d } = setup();
  d.load(K, 'dry_pale', 2); d.tick(40);
  const json = JSON.parse(JSON.stringify(d.toJSON()));
  const { d: back } = setup();
  back.loadJSON(json);
  assert.deepEqual(back.state(K), d.state(K));
  assert.equal(back.state(K).mould, 'tray');
  // And through the game: it is a part of the save.
  const world = new World({ sizeX: 8, sizeZ: 8, height: 16 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: false });
  g.inventory.add('mushroom_lilac', 4);
  g.dehydrators.load('1,1,1', 'dry_lilac', 1);
  const g2 = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  g2.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  assert.equal(g2.dehydrators.state('1,1,1')?.recipeId, 'dry_lilac');
});

process.exit(failures ? 1 : 0);
