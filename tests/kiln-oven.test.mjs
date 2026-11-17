// CRAFT-9 part 6: the Kiln Oven. Block 539, made by hand in Age 4; brick,
// glass and a vase fired in it (loaded, fired, drawn), cheaper than before;
// the close-up is the crucible's, with an oven and a tray.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { KILN_OVEN, BLOCKS_BY_ID, stationOf } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES, RECIPES_BY_ID, howToGet } from '../src/config/recipes.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';
import { Crucibles, POUR_MIN, POUR_MAX, meltSeconds, mouldFor } from '../src/duilt/Crucible.js';
import { CrucibleView, FILL_SECONDS } from '../src/render/CrucibleView.js';
import { Inventory } from '../src/items/Inventory.js';

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('PASS ' + name); } catch (e) { failures++; console.log('FAIL ' + name + '\n  ' + e.message); } };
const K = '2,3,4', AT = { x: 2, y: 3, z: 4 };
function setup({ heated = true, deliver = () => false } = {}) {
  const bag = new Inventory();
  bag.add('clay', 4); bag.add('sand', 4);
  const k = new Crucibles({ station: 'kiln_oven', bag: () => bag, deliver, heated: () => heated });
  return { bag, k };
}

check('block 539 is the Kiln Oven, a station with a low-poly shape and glow', () => {
  assert.equal(KILN_OVEN, 539);
  const b = BLOCKS_BY_ID.get(539);
  assert.equal(b.name, 'Kiln Oven');
  assert.equal(stationOf(539), 'kiln_oven');
  assert.ok(PROP_SHAPES[b.shape]?.length >= 8, 'its own shape');
  assert.ok(PROP_SHAPES[b.shape].some((x) => x.glow), 'the fire glows');
  assert.equal(BLOCKS_BY_ID.get(538)?.name !== 'Kiln Oven', true);
});
check('the kiln_oven item places block 539, made at the Workbench in Age 4 from what exists', () => {
  assert.equal(ITEMS_BY_ID.get('kiln_oven').block, 539);
  const r = RECIPES_BY_ID.get('kiln_oven');
  assert.equal(r.station, 'workbench'); assert.equal(r.age, 4);
  for (const id of Object.keys(r.inputs)) assert.ok(ITEMS_BY_ID.has(id), id);
});
check('brick, glass and vase are fired in the Kiln Oven, none at the workshop', () => {
  assert.equal(RECIPES_BY_ID.get('brick').station, 'kiln_oven');
  assert.equal(RECIPES_BY_ID.get('glass').station, 'kiln_oven');
  assert.equal(RECIPES_BY_ID.get('kiln_vase').station, 'kiln_oven');
  for (const id of ['brick', 'glass', 'vase']) assert.equal(RECIPES.filter((r) => r.output.id === id && r.station === 'workshop').length, 0, id);
});
check('the oven costs less than any other way to make the same thing', () => {
  assert.deepEqual(RECIPES_BY_ID.get('brick').inputs, { clay: 1 });
  assert.equal(RECIPES_BY_ID.get('brick').output.count, 2);
  assert.deepEqual(RECIPES_BY_ID.get('glass').inputs, { sand: 2 });
  assert.deepEqual(RECIPES_BY_ID.get('kiln_vase').inputs, { clay: 1 });
  const other = RECIPES.filter((r) => r.output.id === 'vase' && r.station !== 'kiln_oven');
  assert.ok(other.length && other.every((r) => r.inputs.clay > 1));
});
check('the texts name the Kiln Oven', () => {
  assert.match(howToGet('brick'), /kiln oven/);
  assert.match(howToGet('glass'), /kiln oven/);
  for (const id of ['brick', 'glass', 'vase']) assert.match(ITEMS_BY_ID.get(id).madeBy, /Kiln Oven/, id);
  assert.match(ITEMS_BY_ID.get('kiln_oven').madeBy, /Workbench/);
});
check('only kiln recipes load, and each draws onto the tray', () => {
  const { k } = setup();
  assert.equal(k.load(K, 'smelt_iron', 1).ok, false);
  assert.equal(mouldFor(RECIPES_BY_ID.get('brick')), 'tray');
  assert.equal(k.load(K, 'brick', 9).batches, 4);
  assert.equal(k.state(K).mould, 'tray');
});
check('it fires only inside a kiln, for the recipe\'s seconds', () => {
  const cold = setup({ heated: false });
  cold.k.load(K, 'brick', 1); cold.k.tick(100);
  assert.equal(cold.k.state(K).molten, 0);
  const { k } = setup();
  k.load(K, 'glass', 1);
  assert.equal(meltSeconds(RECIPES_BY_ID.get('glass')), 25);
  k.tick(24.9); assert.equal(k.state(K).molten, 0);
  k.tick(0.2); assert.equal(k.state(K).molten, 1);
});
check('drawn in the window it is made; short it stays; too far it cracks', () => {
  const { bag, k } = setup();
  k.load(K, 'brick', 3); k.tick(3 * 20 + 0.1);
  assert.equal(k.pour(K, POUR_MIN - 0.01).result, 'short');
  assert.equal(k.state(K).molten, 3);
  assert.equal(k.pour(K, 0.95).result, 'made');
  assert.equal(bag.countOf('brick'), 2);
  assert.equal(k.pour(K, POUR_MAX + 0.01).result, 'spilt');
  assert.equal(k.state(K).molten, 1);
});
check('a broken oven gives back clay, and fired ware whole', () => {
  const { bag, k } = setup();
  k.load(K, 'brick', 3); k.tick(20.1);
  k.prune(() => false);
  assert.equal(bag.countOf('clay'), 4 - 3 + 2);
  assert.equal(bag.countOf('brick'), 2);
  assert.equal(k.state(K), null);
});
check('saved and loaded, crucible and kiln pots stay apart', () => {
  const { k } = setup();
  k.load(K, 'brick', 2); k.tick(20.1);
  const again = new Crucibles({ station: 'kiln_oven', bag: () => new Inventory() });
  again.loadJSON(k.toJSON());
  assert.deepEqual(again.state(K), k.state(K));
  const pot = new Crucibles({ bag: () => new Inventory() });
  pot.loadJSON(k.toJSON());
  assert.equal(pot.state(K), null);
});
check('the close-up: an oven, a door, a tray drawn out as Draw is held', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1, 0.05, 500);
  const { k } = setup();
  const view = new CrucibleView({ scene, camera, crucibles: k, kind: 'kiln' });
  let n0 = 0; scene.traverse((o) => { if (o.isMesh) n0++; });
  k.load(K, 'brick', 1); k.tick(20.1);
  view.start(K, AT); view.update(0.016);
  let n = 0; scene.traverse((o) => { if (o.isMesh) n++; });
  assert.ok(n - n0 <= 16, `${n - n0} meshes`);
  const z0 = view.tray.position.z;
  view.holdPour(true);
  for (let t = 0; t < FILL_SECONDS - 1e-9; t += 0.1) view.update(0.1);
  assert.ok(view.tray.position.z > z0 + 0.4, 'the tray came out');
  assert.ok(view.doorPivot.rotation.y > 1, 'the door is open');
  assert.equal(view.holdPour(false).result, 'made');
  view.end();
  let n1 = 0; scene.traverse((o) => { if (o.isMesh) n1++; });
  assert.equal(n1, n0);
});
const { Crafting } = await import('../src/duilt/Crafting.js');
check('the oven is never crafted from a list', () => {
  assert.equal(Crafting.prototype.atStation.call({}, RECIPES_BY_ID.get('brick'), ['kiln_oven']), false);
});
process.exitCode = failures ? 1 : 0;
