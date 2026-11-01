// CRAFT3D-1, Task 3: the counter's rules — pay at the first cut, cut each
// part with the saw, fit every part, carve patterned pieces, finish.
import assert from 'node:assert/strict';
import { Counters } from '../src/duilt/Counter.js';
import { partsFor, COST } from '../src/config/furnitureParts.js';
import { Inventory } from '../src/items/Inventory.js';

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('PASS ' + name); } catch (e) { failures++; console.log('FAIL ' + name + '\n  ' + e.message); } };
function setup({ planks = 8, saw = true, chisel = false, deliver = () => false } = {}) {
  const bag = new Inventory();
  if (planks) bag.add('planks', planks);
  if (saw) bag.add('carpentry_saw', 1);
  if (chisel) bag.add('carpentry_chisel', 1);
  return { bag, c: new Counters({ bag: () => bag, deliver }) };
}
const K = '1,2,3';
const cutAll = (c, key) => { let r; do r = c.cut(key); while (r.ok && c.work(key).cut < partsFor(c.work(key).item).length); return r; };
const fitAll = (c, key) => partsFor(c.work(key).item).forEach((_, i) => c.fit(key, i));

check('pays once at the first cut', () => {
  const { bag, c } = setup();
  assert.equal(c.choose(K, 'table_oak').ok, true);
  assert.equal(bag.countOf('planks'), 8, 'choosing costs nothing');
  c.cut(K);
  assert.equal(bag.countOf('planks'), 8 - COST.get('table_oak').planks);
  cutAll(c, K);
  assert.equal(bag.countOf('planks'), 8 - COST.get('table_oak').planks, 'only once');
  assert.equal(c.work(K).cut, 5);
});

check('refuses without saw or planks', () => {
  const a = setup({ saw: false });
  a.c.choose(K, 'table_oak');
  assert.match(a.c.cut(K).reason, /Saw/i);
  const b = setup({ planks: 1 });
  b.c.choose(K, 'table_oak');
  assert.match(b.c.cut(K).reason, /plank/i);
});

check('finishes only when every part is fitted', () => {
  const { bag, c } = setup();
  c.choose(K, 'table_oak'); cutAll(c, K);
  assert.equal(c.fit(K, 0).done, false);
  assert.equal(c.fit(K, 0).ok, true, 'fitting twice is harmless');
  for (let i = 1; i < 4; i++) assert.equal(c.fit(K, i).done, false);
  assert.equal(c.fit(K, 4).done, true);
  assert.equal(c.take(K), true);
  assert.equal(bag.countOf('table_oak'), 1);
  assert.equal(c.work(K), null, 'the counter is clear for the next piece');
});

check('a part is fitted only once it is cut', () => {
  const { c } = setup();
  c.choose(K, 'table_oak'); c.cut(K);
  assert.equal(c.fit(K, 3).ok, false);
});

check('carves only patterned pieces', () => {
  const t = setup();
  t.c.choose(K, 'table_oak'); cutAll(t.c, K); fitAll(t.c, K);
  assert.equal(t.c.carve(K).ok, false);
  const p = setup({ chisel: true });
  p.c.choose(K, 'panel_pattern'); cutAll(p.c, K); fitAll(p.c, K);
  assert.equal(p.c.work(K).done, false, 'not done before the chisel');
  assert.equal(p.c.carve(K).ok, true);
  assert.equal(p.c.work(K).done, true);
});

check('saves and loads mid-piece', () => {
  const { bag, c } = setup();
  c.choose(K, 'table_oak'); c.cut(K); c.cut(K); c.fit(K, 0);
  const c2 = new Counters({ bag: () => bag, deliver: () => false });
  c2.loadJSON(JSON.parse(JSON.stringify(c.toJSON())));
  assert.equal(c2.work(K).cut, 2);
  assert.deepEqual(c2.work(K).fitted.slice(0, 2), [true, false]);
});

check('finished piece waits when bag and stores are full', () => {
  const { bag, c } = setup();
  c.choose(K, 'table_oak'); cutAll(c, K); fitAll(c, K);
  for (let i = 0; bag.add('stone', 999) === 0 && i < 99; i++);
  assert.equal(c.take(K), false);
  assert.equal(c.work(K).done, true, 'still on the counter');
  const delivered = [];
  const d = new Counters({ bag: () => bag, deliver: (p) => { delivered.push(p); return true; } });
  d.loadJSON(c.toJSON());
  assert.equal(d.take(K), true);
  assert.deepEqual(delivered, [{ table_oak: 1 }], 'to a storehouse');
});

check('breaking gives back what was not used', () => {
  const { bag, c } = setup({ planks: 4 });
  c.choose(K, 'table_oak'); cutAll(c, K); c.fit(K, 0); c.fit(K, 1);
  c.prune(() => false);
  assert.equal(c.work(K), null);
  // 3 of 5 parts unfitted: 3/5 of 4 planks, rounded down.
  assert.equal(bag.countOf('planks'), Math.floor(4 * 3 / 5));
  const f = setup({ planks: 4 });
  f.c.choose(K, 'table_oak'); cutAll(f.c, K); fitAll(f.c, K);
  f.c.prune(() => false);
  assert.equal(f.bag.countOf('table_oak'), 1, 'a finished piece comes back whole');
});

check('a missing tool stops cutting, not fitting', () => {
  const { bag, c } = setup();
  c.choose(K, 'table_oak'); c.cut(K); c.cut(K);
  bag.remove('carpentry_saw', 1);
  assert.equal(c.cut(K).ok, false);
  assert.equal(c.fit(K, 1).ok, true);
});

check('two counters keep their own work', () => {
  const { c } = setup({ planks: 20 });
  c.choose('1,1,1', 'table_oak'); c.choose('9,9,9', 'chair_oak');
  c.cut('1,1,1');
  assert.equal(c.work('1,1,1').item, 'table_oak');
  assert.equal(c.work('9,9,9').cut, 0);
  assert.equal(c.choose('1,1,1', 'chair_oak').ok, false, 'one piece at a time on a counter');
});

process.exitCode = failures ? 1 : 0;

// Saved with the world, and a broken counter gives back.
{
  const { DuiltGame } = await import('../src/duilt/DuiltGame.js');
  const { World } = await import('../src/world/World.js');
  const world = new World({ sizeX: 32, sizeZ: 32, height: 24 });
  world.setBlock(4, 4, 4, 530);
  const THREE = await import('three');
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: true });
  g.inventory.add('planks', 4); g.inventory.add('carpentry_saw', 1);
  check('the world saves its counters', () => {
    g.counters.choose('4,4,4', 'table_oak'); g.counters.cut('4,4,4');
    const saved = JSON.parse(JSON.stringify(g.toJSON()));
    assert.equal(saved.counters[0].key, '4,4,4');
    assert.equal(g.spotStands('4,4,4', 'counter'), true);
    world.setBlock(4, 4, 4, 0);
    assert.equal(g.spotStands('4,4,4', 'counter'), false, 'broken: no longer stands');
  });
}
process.exitCode = failures ? 1 : 0;

check('breaking with a full bag sends the rest to a storehouse, else keeps it for later', () => {
  const full = () => { const b = new Inventory(); b.add('planks', 4); b.add('carpentry_saw', 1); return b; };
  const bag = full();
  const sent = [];
  let room = false;
  const c = new Counters({ bag: () => bag, deliver: (p) => { if (!room) return false; sent.push(p); return true; } });
  c.choose(K, 'table_oak'); cutAll(c, K); fitAll(c, K);
  for (let i = 0; bag.add('stone', 999) === 0 && i < 99; i++);
  c.prune(() => false);
  assert.ok(c.work(K), 'nowhere to put it: still kept, nothing lost');
  room = true;
  c.prune(() => false);
  assert.deepEqual(sent, [{ table_oak: 1 }]);
  assert.equal(c.work(K), null);
});
process.exitCode = failures ? 1 : 0;
