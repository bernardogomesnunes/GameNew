// CRAFT3D-3, Task 3: the crucible's rules — load, melt, pour in the window.
import assert from 'node:assert/strict';
import { Crucibles, POUR_MIN, POUR_MAX, MAX_BATCHES, meltSeconds } from '../src/duilt/Crucible.js';
import { RECIPES_BY_ID } from '../src/config/recipes.js';
import { Inventory } from '../src/items/Inventory.js';

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('PASS ' + name); } catch (e) { failures++; console.log('FAIL ' + name + '\n  ' + e.message); } };
const K = '3,4,5';
function setup({ ore = 6, heated = true, deliver = () => false, endless = false } = {}) {
  const bag = new Inventory();
  if (endless) bag.endless = true;
  if (ore) bag.add('iron_ore', ore);
  const c = new Crucibles({ bag: () => bag, deliver, heated: () => heated });
  return { bag, c };
}
const melt = (c) => { c.tick(meltSeconds(RECIPES_BY_ID.get(c.state(K).recipeId)) + 0.01); };

check('the window and limits are the spec\'s', () => {
  assert.equal(POUR_MIN, 0.90); assert.equal(POUR_MAX, 1.05); assert.equal(MAX_BATCHES, 16);
  assert.equal(meltSeconds(RECIPES_BY_ID.get('smelt_iron')), 45);
  assert.equal(meltSeconds(RECIPES_BY_ID.get('strike_coins')), 25);
  assert.equal(meltSeconds(RECIPES_BY_ID.get('charcoal')), 30);
});
check('loads as many as the bag pays, up to 16', () => {
  const { bag, c } = setup({ ore: 40 });
  assert.equal(c.load(K, 'smelt_iron', 99).batches, 16);
  assert.equal(bag.countOf('iron_ore'), 40 - 32);
  assert.equal(c.state(K).waiting, 16);
});
check('one recipe at a time', () => {
  const { bag, c } = setup();
  bag.add('copper_ore', 4);
  c.load(K, 'smelt_iron', 1);
  assert.equal(c.load(K, 'smelt_copper', 1).ok, false);
});
check('melts only through tick, 45 s for iron', () => {
  const { c } = setup();
  c.load(K, 'smelt_iron', 2);
  assert.equal(c.state(K).molten, 0);
  c.tick(44.9); assert.equal(c.state(K).molten, 0);
  c.tick(0.2); assert.equal(c.state(K).molten, 1);
  assert.equal(c.state(K).waiting, 1);
});
check('no foundry, no melting', () => {
  const { c } = setup({ heated: false });
  c.load(K, 'smelt_iron', 1);
  c.tick(100);
  assert.equal(c.state(K).molten, 0);
});
check('pour 0.89 is short and keeps the metal', () => {
  const { bag, c } = setup();
  c.load(K, 'smelt_iron', 1); melt(c);
  assert.equal(c.pour(K, 0.89).result, 'short');
  assert.equal(c.state(K).molten, 1);
  assert.equal(bag.countOf('iron_ingot'), 0);
});
check('pour 0.90 and 1.05 make an ingot', () => {
  const { bag, c } = setup();
  c.load(K, 'smelt_iron', 2); melt(c); melt(c);
  assert.equal(c.pour(K, 0.90).result, 'made');
  assert.equal(c.pour(K, 1.05).result, 'made');
  assert.equal(bag.countOf('iron_ingot'), 2);
});
check('pour 1.06 spills the batch', () => {
  const { bag, c } = setup();
  c.load(K, 'smelt_iron', 1); melt(c);
  assert.equal(c.pour(K, 1.06).result, 'spilt');
  assert.equal(c.state(K), null, 'nothing left in the pot');
  assert.equal(bag.countOf('iron_ingot'), 0);
});
check('the wrong mould pours nothing', () => {
  const { bag, c } = setup();
  bag.add('gold', 1);
  c.load(K, 'strike_coins', 1); c.tick(25.1);
  c.setMould(K, 'ingot');
  assert.equal(c.pour(K, 1).result, 'none');
  assert.equal(c.state(K).molten, 1);
  c.setMould(K, 'coin');
  assert.equal(c.pour(K, 1).result, 'made');
  assert.equal(bag.countOf('coin'), 10);
});
check('charcoal is taken, not poured', () => {
  const { bag, c } = setup({ ore: 0 });
  bag.add('wood', 4);
  c.load(K, 'charcoal', 1); c.tick(30.1);
  assert.equal(c.pour(K, 1).result, 'none');
  assert.equal(c.state(K).out, 1);
  assert.equal(c.take(K), 1);
  assert.equal(bag.countOf('coal'), 1);
});
check('a poured ingot waits when there is no room', () => {
  const { bag, c } = setup();
  c.load(K, 'smelt_iron', 1); melt(c);
  for (let i = 0; bag.add('stone', 999) === 0 && i < 99; i++);
  assert.equal(c.pour(K, 1).result, 'made');
  assert.equal(c.state(K).out, 1, 'waits in the mould');
  bag.remove('stone', 999);
  assert.equal(c.take(K), 1);
  assert.equal(bag.countOf('iron_ingot'), 1);
});
check('saves and loads mid-melt', () => {
  const { bag, c } = setup();
  c.load(K, 'smelt_iron', 3); c.tick(50);
  const c2 = new Crucibles({ bag: () => bag, heated: () => true });
  c2.loadJSON(JSON.parse(JSON.stringify(c.toJSON())));
  assert.deepEqual({ ...c2.state(K) }, { ...c.state(K) });
});
check('breaking gives back the unmelted and the waiting, not the molten', () => {
  const { bag, c } = setup({ ore: 8 });
  c.load(K, 'smelt_iron', 4); melt(c); melt(c);
  c.pour(K, 1);            // 1 ingot out (to the bag)
  bag.remove('iron_ingot', 1);
  c.tick(0.01);
  // 1 molten (lost), 2 waiting (back: 4 ore)
  c.prune(() => false);
  assert.equal(c.state(K), null);
  assert.equal(bag.countOf('iron_ore'), 4);
});
check('creative loads 16 and still pours by hand', () => {
  const { bag, c } = setup({ ore: 1, endless: true }); // the Creative kit holds one of everything
  assert.equal(c.load(K, 'smelt_iron', 99).batches, 16);
  melt(c);
  assert.equal(c.pour(K, 0.5).result, 'short');
});
process.exitCode = failures ? 1 : 0;

// In the world: heated only inside a foundry, and saved.
{
  const THREE = await import('three');
  const { DuiltGame } = await import('../src/duilt/DuiltGame.js');
  const { World } = await import('../src/world/World.js');
  const world = new World({ sizeX: 32, sizeZ: 32, height: 24 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  const foundry = { id: 70, type: 'foundry', valid: true, region: { minX: 2, maxX: 8, minY: 1, maxY: 5, minZ: 2, maxZ: 8 }, lastPaidAt: 0 };
  g.structures.structures.push(foundry);
  check('a crucible is heated only inside a valid foundry', () => {
    assert.equal(g.inFoundry('4,2,4'), true);
    assert.equal(g.inFoundry('20,2,20'), false);
    foundry.valid = false;
    assert.equal(g.inFoundry('4,2,4'), false);
    foundry.valid = true;
  });
  check('the world saves its crucibles', () => {
    g.inventory.add('iron_ore', 2);
    g.crucibles.load('4,2,4', 'smelt_iron', 1);
    assert.equal(JSON.parse(JSON.stringify(g.toJSON())).crucibles[0].key, '4,2,4');
  });
}
process.exitCode = failures ? 1 : 0;
