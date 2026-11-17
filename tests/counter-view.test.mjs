// CRAFT3D-1, Task 4, and CRAFT-9 part 3: the Carpenter's Table close-up in the
// game's own scene and camera: one held saw stroke, tap to fit, a wider snap.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CounterView, SAW_SECONDS, SAW_HOLD_SECONDS, FLY_SECONDS } from '../src/render/CounterView.js';
import { CounterMachine } from '../src/render/CounterMachine.js';
import { Counters } from '../src/duilt/Counter.js';
import { partsFor } from '../src/config/furnitureParts.js';
import { Inventory } from '../src/items/Inventory.js';
import { EventBus } from '../src/core/EventBus.js';

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('PASS ' + name); } catch (e) { failures++; console.log('FAIL ' + name + '\n  ' + e.stack.split('\n').slice(0, 3).join('\n  ')); } };
function setup() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1, 0.05, 500);
  const bag = new Inventory(); bag.add('planks', 8); bag.add('carpentry_saw', 1);
  const counters = new Counters({ bag: () => bag });
  const bus = new EventBus();
  const view = new CounterView({ scene, camera, counters, bus });
  return { scene, camera, counters, bus, view, bag };
}
const at = { x: 10, y: 5, z: 20 };
const meshes = (scene) => { let n = 0; scene.traverse((o) => { if (o.isMesh) n++; }); return n; };

check('start puts the camera over the counter, looking at its top', () => {
  const { view, camera } = setup();
  view.start('10,5,20', at);
  assert.equal(view.active, true);
  view.update(0.016);
  const top = new THREE.Vector3(10.5, 6, 20.5);
  assert.ok(Math.abs(camera.position.y - (top.y + 2.2)) < 1e-6 && Math.abs(camera.position.z - (top.z + 1.8)) < 1e-6);
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const toTop = top.clone().sub(camera.position).normalize();
  assert.ok(dir.dot(toTop) > 0.999, 'looking at the top');
});

check('at most 7 top-level pieces, and all gone on end', () => {
  const { view, scene, counters } = setup();
  const before = meshes(scene);
  counters.choose('10,5,20', 'table_oak');
  view.start('10,5,20', at);
  view.pick('table_oak');
  assert.ok(view.group.children.length <= 7, `${view.group.children.length} top-level pieces`);
  view.pick('wardrobe');
  assert.ok(view.group.children.length <= 7, `${view.group.children.length} top-level pieces for a wardrobe`);
  view.end();
  assert.equal(meshes(scene), before);
  assert.equal(view.active, false);
});

check('the saw stroke takes SAW_SECONDS, then every part lies on the table', () => {
  const { view } = setup();
  view.start('10,5,20', at);
  view.pick('table_oak');
  assert.equal(SAW_SECONDS, 0.8);
  assert.equal(view.saw().ok, true);
  assert.equal(view.partMesh(0).visible, false, 'not yet');
  assert.equal(view.saw().ok, false, 'one stroke at a time');
  view.update(0.5); assert.equal(view.partMesh(0).visible, false);
  view.update(0.31);
  assert.deepEqual(view.parts.map((m) => m.visible), [true, true], 'both parts off after 0.8 s');
  assert.equal(view.saw().ok, false, 'one stroke cuts every part: there is no second');
});

check('Saw held and let go in the window cuts; short or too far spends nothing', () => {
  const { view, bag, counters } = setup();
  view.start('10,5,20', at);
  view.pick('table_oak');
  assert.equal(view.hold().ok, true);
  view.update(SAW_HOLD_SECONDS * 0.4);
  assert.deepEqual(view.letGo(), { result: 'short' });
  view.hold(); view.update(SAW_HOLD_SECONDS * 1.2);
  assert.deepEqual(view.letGo(), { result: 'far' });
  assert.equal(bag.countOf('planks'), 8, 'nothing spent by either');
  assert.equal(counters.work('10,5,20').cut, 0);
  view.hold(); view.update(SAW_HOLD_SECONDS * 0.95);
  assert.ok(view.level > 0.85 && view.level < 1.05);
  assert.deepEqual(view.letGo(), { result: 'cut' });
  assert.equal(bag.countOf('planks'), 4, 'paid at the stroke');
  view.update(0.25);
  assert.deepEqual(view.parts.map((m) => m.visible), [true, true]);
  assert.equal(view.letGo(), null, 'not held: nothing to let go');
  assert.equal(view.hold().ok, false, 'every part is cut');
});

check('a tapped part flies to its place; the next part glows and its place is lit', () => {
  const { view, counters, bag } = setup();
  view.start('10,5,20', at);
  view.pick('chair_oak');
  view.saw(); view.update(0.81);
  assert.ok(view.partMesh(0).material.emissiveIntensity > 0, 'the legs glow first');
  assert.equal(view.partMesh(1).material.emissiveIntensity, 0);
  assert.ok(view.slots[0].material.opacity > view.slots[1].material.opacity, 'and their place is lit');
  const home = view.partMesh(0).position.clone();
  assert.equal(view.tapFit(0), true);
  assert.equal(counters.work('10,5,20').fitted[0], true);
  assert.equal(view.flying, true);
  view.update(FLY_SECONDS / 2);
  const mid = view.partMesh(0).position;
  assert.ok(mid.distanceTo(home) > 0.01 && mid.distanceTo(view.partMesh(0).userData.slot) > 0.01, 'on its way');
  view.update(FLY_SECONDS);
  assert.ok(view.partMesh(0).position.distanceTo(view.partMesh(0).userData.slot) < 1e-6, 'in its place');
  assert.equal(view.partMesh(0).scale.x, 1);
  assert.equal(view.flying, false);
  assert.equal(view.tapFit(0), false, 'a fitted part stays put');
  assert.ok(view.partMesh(1).material.emissiveIntensity > 0, 'the seat glows next');
  assert.equal(view.slots[0].visible, false, 'a filled place is no longer drawn');
  view.tapFit(1); view.tapFit(2);
  view.update(0.016);
  assert.equal(bag.countOf('chair_oak'), 0, 'not taken while a part is in the air');
  view.update(FLY_SECONDS + 0.1); view.update(0.016);
  assert.equal(bag.countOf('chair_oak'), 1, 'a chair: 1 stroke and 3 taps');
});

check('a tap on the picture fits, a drag carries; keys 1 to 4 tap a part and Space holds Saw', () => {
  if (typeof document === 'undefined') {
    const el = () => ({ className: '', hidden: true, innerHTML: '', append() {}, addEventListener() {}, querySelector: () => null });
    globalThis.document = { createElement: el };
  }
  const { scene, camera, counters, bus, bag } = setup();
  const m = new CounterMachine({ scene, camera, uiRoot: { append() {} }, counters, bus });
  m.start('10,5,20', at);
  m.view.pick('chair_oak');
  assert.equal(m.key('Space', true), true);
  m.update(SAW_HOLD_SECONDS * 0.95);
  m.key('Space', false);
  assert.equal(counters.work('10,5,20').cut, 3, 'Space held and let go in the window saws');
  m.update(0.25); m.view.group.updateMatrixWorld(true);
  const screen = (i) => m.view.partMesh(i).getWorldPosition(new THREE.Vector3()).project(camera);
  let p = screen(0);
  m.pointerDown(p.x, p.y); m.pointerUp();
  assert.equal(counters.work('10,5,20').fitted[0], true, 'a tap fits');
  m.update(FLY_SECONDS + 0.1); m.view.group.updateMatrixWorld(true);
  p = screen(1);
  m.pointerDown(p.x, p.y); m.pointerMove(p.x + 0.5, p.y + 0.9); m.pointerUp();
  assert.equal(counters.work('10,5,20').fitted[1], false, 'a drag let go far away goes back to the row');
  assert.equal(m.key('Digit2', true), true);
  assert.equal(counters.work('10,5,20').fitted[1], true, 'key 2 taps the second part');
  assert.equal(m.key('Digit3', true, true), true, 'a held key repeats nothing');
  assert.equal(counters.work('10,5,20').fitted[2], false);
  m.key('Numpad3', true);
  assert.equal(m.key('KeyW', true), false, 'other keys are not the table\'s');
  m.update(FLY_SECONDS + 0.2); m.update(0.016);
  assert.equal(bag.countOf('chair_oak'), 1);
  m.end();
});

check('Make another: one stroke, then one tap sends every part to its place', () => {
  const { view, counters, bag } = setup();
  view.start('10,5,20', at);
  view.pick('table_oak');
  view.saw(); view.update(0.81);
  view.tapFit(0); view.tapFit(1);
  view.update(FLY_SECONDS + 0.2); view.update(0.016);
  assert.equal(bag.countOf('table_oak'), 1);
  assert.equal(view.group, null, 'the top is clear');
  assert.equal(view.again().ok, true);
  assert.equal(counters.work('10,5,20').item, 'table_oak');
  view.saw(); view.update(0.81);
  assert.ok(view.parts.every((m) => m.material.emissiveIntensity > 0), 'every part glows');
  assert.equal(view.tapFit(1), true);
  assert.deepEqual(counters.work('10,5,20').fitted, [true, true]);
  view.update(FLY_SECONDS + 0.3); view.update(0.016);
  assert.equal(bag.countOf('table_oak'), 2, 'two touches for the second table');
});

check('a piece picked and not sawn goes back to the list', () => {
  const { view, counters, scene } = setup();
  const before = meshes(scene);
  view.start('10,5,20', at);
  view.pick('table_oak');
  assert.equal(view.back(), true);
  assert.equal(counters.work('10,5,20'), null);
  assert.equal(meshes(scene), before);
  view.pick('chair_oak'); view.saw();
  assert.equal(view.back(), false, 'not once it is sawn');
});

check('dropping a part within 0.4 of its place fits it; farther it goes back, nothing lost', () => {
  const { view, counters } = setup();
  view.start('10,5,20', at);
  view.pick('table_oak');
  view.saw(); view.update(0.81);
  const home = view.partMesh(0).position.clone();
  view.dragTo(0, view.slotOf(0).clone().add(new THREE.Vector3(0.5, 0, 0)));
  assert.equal(view.drop(0), false);
  assert.ok(view.partMesh(0).position.distanceTo(home) < 1e-6, 'back where it lay');
  view.dragTo(0, view.slotOf(0).clone().add(new THREE.Vector3(0.3, 0, 0.2)));
  assert.equal(view.drop(0), true, 'the snap is 0.4 of a block (it was 0.15)');
  assert.equal(counters.work('10,5,20').fitted[0], true);
  view.group.updateMatrixWorld(true);
  assert.ok(view.partMesh(0).getWorldPosition(new THREE.Vector3()).distanceTo(view.slotOf(0)) < 1e-6, 'snapped in');
});

check('a whole table: 1 stroke, 2 drops, then it goes to the bag', () => {
  const { view, bag } = setup();
  view.start('10,5,20', at);
  view.pick('table_oak');
  const n = partsFor('table_oak').length;
  assert.equal(n, 2);
  assert.equal(view.saw().ok, true); view.update(0.81);
  for (let i = 0; i < n; i++) { view.dragTo(i, view.slotOf(i)); view.drop(i); }
  view.update(0.016);
  assert.equal(bag.countOf('table_oak'), 1);
});

check('damage ends the counter view', () => {
  const { view, bus } = setup();
  view.start('10,5,20', at);
  bus.emit('health:change', { value: 5, hurt: 1 });
  assert.equal(view.active, false);
});

process.exitCode = failures ? 1 : 0;

// The pointer over a part's place, read at that part's level, lands on its place.
{
  const { view } = setup();
  view.start('10,5,20', at);
  view.pick('table_oak');
  view.saw(); view.update(0.81);
  view.group.updateMatrixWorld(true);
  const slot = view.slotOf(0), screen = slot.clone().project(view.camera);
  const p = view.pointOnTop(screen.x, screen.y, 0);
  if (Math.hypot(p.x - slot.x, p.z - slot.z) > 1e-6) { failures++; console.log('FAIL pointer over a place lands on it'); }
  else console.log('PASS pointer over a place lands on it');
}
process.exitCode = failures ? 1 : 0;

// A finished piece that did not fit in the bag is handed over when the counter is opened again.
{
  const { view, counters, bag } = setup();
  view.start('10,5,20', at); view.pick('table_oak');
  const n = partsFor('table_oak').length;
  view.saw(); view.update(0.81);
  for (let i = 0; i < n - 1; i++) { view.dragTo(i, view.slotOf(i)); view.drop(i); }
  for (let i = 0; bag.add('stone', 999) === 0 && i < 99; i++);
  view.dragTo(n - 1, view.slotOf(n - 1)); view.drop(n - 1);
  view.update(0.016);
  const waiting = !!counters.work('10,5,20')?.done;
  view.end();
  bag.remove('stone', 999);
  view.start('10,5,20', at);
  view.update(0.016);
  const ok = waiting && bag.countOf('table_oak') === 1 && counters.work('10,5,20') === null;
  if (!ok) { failures++; console.log('FAIL a waiting piece is handed over on the next visit'); } else console.log('PASS a waiting piece is handed over on the next visit');
}
// Leaving in the frame after the last fit does not carry the hand-over to the next counter.
{
  const { view, counters } = setup();
  view.start('10,5,20', at); view.pick('table_oak');
  const n = partsFor('table_oak').length;
  view.saw(); view.update(0.81);
  for (let i = 0; i < n; i++) { view.dragTo(i, view.slotOf(i)); view.drop(i); }
  view.end();
  const done = [];
  view.onDone = (e) => done.push(e);
  view.start('1,1,1', { x: 1, y: 1, z: 1 });
  view.update(0.016);
  if (done.length || !counters.work('10,5,20')?.done) { failures++; console.log('FAIL leaving clears the pending hand-over'); } else console.log('PASS leaving clears the pending hand-over');
}
process.exitCode = failures ? 1 : 0;
