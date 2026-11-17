// CRAFT3D-1, Task 3, and CRAFT-9 part 3: the Carpenter's Table's rules. One
// saw stroke pays and cuts every part, a piece has 4 parts at most (matching
// parts are one), fit every part, carve patterned pieces, finish, make another.
import assert from 'node:assert/strict';
import { Counters } from '../src/duilt/Counter.js';
import { partsFor, COST, FURNITURE, MAX_PARTS } from '../src/config/furnitureParts.js';
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
const cutAll = (c, key) => c.cut(key);
const fitAll = (c, key) => partsFor(c.work(key).item).forEach((_, i) => c.fit(key, i));

check('no piece has more than 4 parts, and matching parts are one', () => {
  assert.equal(MAX_PARTS, 4);
  for (const id of FURNITURE) {
    const n = partsFor(id).length;
    assert.ok(n >= 1 && n <= 4, `${id}: ${n} parts`);
  }
  const table = partsFor('table_oak');
  assert.deepEqual(table.map((p) => [p.name, p.count]), [['leg', 4], ['top', 1]], 'the 4 legs of a table are one part');
  assert.deepEqual(partsFor('chair_oak').map((p) => [p.name, p.count]), [['leg', 4], ['seat', 1], ['back', 1]]);
});

check('one saw stroke pays once and cuts every part', () => {
  const { bag, c } = setup();
  assert.equal(c.choose(K, 'table_oak').ok, true);
  assert.equal(bag.countOf('planks'), 8, 'choosing costs nothing');
  assert.equal(c.cut(K).ok, true);
  assert.equal(bag.countOf('planks'), 8 - COST.get('table_oak').planks);
  assert.equal(c.work(K).cut, partsFor('table_oak').length, 'every part is cut');
  assert.match(c.cut(K).reason, /Every part is cut/);
  assert.equal(bag.countOf('planks'), 8 - COST.get('table_oak').planks, 'only once');
  const w = setup();
  w.c.choose(K, 'wardrobe'); w.c.cut(K);
  assert.equal(w.c.work(K).cut, partsFor('wardrobe').length, 'a wardrobe too: one stroke');
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
  c.choose(K, 'chair_oak'); cutAll(c, K);
  assert.equal(c.next(K), 0, 'the legs are next');
  assert.equal(c.fit(K, 0).done, false);
  assert.equal(c.fit(K, 0).ok, true, 'fitting twice is harmless');
  assert.equal(c.next(K), 1);
  assert.equal(c.fit(K, 1).done, false);
  assert.equal(c.fit(K, 2).done, true);
  assert.equal(c.next(K), -1);
  assert.equal(c.take(K), true);
  assert.equal(bag.countOf('chair_oak'), 1);
  c.choose(K, 'table_oak'); cutAll(c, K); fitAll(c, K);
  assert.equal(c.take(K), true);
  assert.equal(bag.countOf('table_oak'), 1);
  assert.equal(c.work(K), null, 'the counter is clear for the next piece');
});

check('a part is fitted only once the piece is cut', () => {
  const { c } = setup();
  c.choose(K, 'table_oak');
  assert.equal(c.fit(K, 0).ok, false);
  assert.equal(c.next(K), -1);
  c.cut(K);
  assert.equal(c.fit(K, 9).ok, false, 'no such part');
  assert.equal(c.fit(K, 1).ok, true);
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
  c.choose(K, 'chair_oak'); c.cut(K); c.fit(K, 0);
  const c2 = new Counters({ bag: () => bag, deliver: () => false });
  c2.loadJSON(JSON.parse(JSON.stringify(c.toJSON())));
  assert.equal(c2.work(K).cut, 3);
  assert.deepEqual(c2.work(K).fitted, [true, false, false]);
  assert.equal(c2.work(K).paid, true);
});

check('an old world: a half-built piece keeps what was paid, its parts back in the row', () => {
  const { bag, c } = setup({ planks: 0 });
  // As saved before CRAFT-9: a table of 5 parts, 3 cut, 2 fitted, paid.
  c.loadJSON([{ key: K, item: 'table_oak', cut: 3, fitted: [true, true, false, false, false], carved: false, paid: true },
    { key: '2,2,2', item: 'chair_oak', cut: 0, fitted: [false, false, false, false, false, false], carved: false, paid: false },
    { key: '3,3,3', item: 'table_oak', cut: 5, fitted: [true, true, true, true, true], carved: false, paid: true }]);
  const w = c.work(K);
  assert.equal(w.paid, true, 'paid stays paid');
  assert.equal(w.cut, partsFor('table_oak').length, 'every part is cut: no second payment, no second stroke');
  assert.deepEqual(w.fitted, [false, false], 'the parts are back in the row');
  assert.equal(c.cut(K).ok, false);
  fitAll(c, K);
  assert.equal(c.take(K), true);
  assert.equal(bag.countOf('table_oak'), 1, 'finished with no planks in the bag');
  assert.deepEqual([c.work('2,2,2').paid, c.work('2,2,2').cut, c.work('2,2,2').fitted.length], [false, 0, 3], 'a piece only picked is still only picked');
  assert.equal(c.work('3,3,3').done, true, 'a finished piece stays finished');
  // A world saved now loads as it was.
  const again = new Counters({ bag: () => bag });
  again.loadJSON(JSON.parse(JSON.stringify(c.toJSON())));
  assert.equal(again.work('3,3,3').done, true);
});

check('Make another: the same piece, one stroke, one fit places every part', () => {
  const { bag, c } = setup({ planks: 9 });
  assert.equal(c.again(K).ok, false, 'nothing made here yet');
  c.choose(K, 'chair_oak'); c.cut(K); fitAll(c, K); c.take(K);
  assert.equal(c.lastMade(K), 'chair_oak');
  assert.equal(c.again(K).ok, true);
  assert.equal(c.work(K).item, 'chair_oak');
  assert.equal(bag.countOf('planks'), 9 - COST.get('chair_oak').planks, 'the second is paid at its own stroke');
  c.cut(K);
  assert.equal(c.fit(K, 1).done, true, 'one fit, every part');
  assert.equal(c.take(K), true);
  assert.equal(bag.countOf('chair_oak'), 2);
  assert.equal(bag.countOf('planks'), 9 - 2 * COST.get('chair_oak').planks);
});

check('a piece picked and not sawn can be put away', () => {
  const { bag, c } = setup();
  c.choose(K, 'table_oak');
  assert.equal(c.unchoose(K), true);
  assert.equal(c.work(K), null);
  c.choose(K, 'table_oak'); c.cut(K);
  assert.equal(c.unchoose(K), false, 'not once it is paid');
  assert.equal(bag.countOf('planks'), 8 - COST.get('table_oak').planks);
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
  c.choose(K, 'table_oak'); cutAll(c, K); c.fit(K, 0);
  c.prune(() => false);
  assert.equal(c.work(K), null);
  // 1 of 2 parts unfitted: half of 4 planks.
  assert.equal(bag.countOf('planks'), 2);
  const f = setup({ planks: 4 });
  f.c.choose(K, 'table_oak'); cutAll(f.c, K); fitAll(f.c, K);
  f.c.prune(() => false);
  assert.equal(f.bag.countOf('table_oak'), 1, 'a finished piece comes back whole');
});

check('a missing tool stops cutting, not fitting', () => {
  const { bag, c } = setup();
  c.choose(K, 'table_oak');
  bag.remove('carpentry_saw', 1);
  assert.equal(c.cut(K).ok, false);
  bag.add('carpentry_saw', 1);
  assert.equal(c.cut(K).ok, true);
  bag.remove('carpentry_saw', 1);
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
