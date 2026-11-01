// CRAFT3D-1, Task 4: the counter close-up in the game's own scene and camera.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CounterView, SAW_SECONDS } from '../src/render/CounterView.js';
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

check('at most 9 extra meshes, and all gone on end', () => {
  const { view, scene, counters } = setup();
  const before = meshes(scene);
  counters.choose('10,5,20', 'table_oak');
  view.start('10,5,20', at);
  view.pick('table_oak');
  assert.ok(view.group.children.length <= 9, `${view.group.children.length} top-level pieces`);
  view.end();
  assert.equal(meshes(scene), before);
  assert.equal(view.active, false);
});

check('a saw cut takes SAW_SECONDS, then the part lies on the counter', () => {
  const { view } = setup();
  view.start('10,5,20', at);
  view.pick('table_oak');
  assert.equal(SAW_SECONDS, 0.8);
  assert.equal(view.saw().ok, true);
  assert.equal(view.partMesh(0).visible, false, 'not yet');
  assert.equal(view.saw().ok, false, 'one cut at a time');
  view.update(0.5); assert.equal(view.partMesh(0).visible, false);
  view.update(0.31); assert.equal(view.partMesh(0).visible, true, 'off after 0.8 s');
});

check('dropping a part near its place fits it; elsewhere it goes back', () => {
  const { view, counters } = setup();
  view.start('10,5,20', at);
  view.pick('table_oak');
  view.saw(); view.update(0.81);
  const home = view.partMesh(0).position.clone();
  view.dragTo(0, view.slotOf(0).clone().add(new THREE.Vector3(0.5, 0, 0)));
  assert.equal(view.drop(0), false);
  assert.ok(view.partMesh(0).position.distanceTo(home) < 1e-6, 'back where it lay');
  view.dragTo(0, view.slotOf(0).clone().add(new THREE.Vector3(0.05, 0, 0.05)));
  assert.equal(view.drop(0), true);
  assert.equal(counters.work('10,5,20').fitted[0], true);
  view.group.updateMatrixWorld(true);
  assert.ok(view.partMesh(0).getWorldPosition(new THREE.Vector3()).distanceTo(view.slotOf(0)) < 1e-6, 'snapped in');
});

check('a whole table: 5 cuts, 5 drops, then it goes to the bag', () => {
  const { view, bag } = setup();
  view.start('10,5,20', at);
  view.pick('table_oak');
  const n = partsFor('table_oak').length;
  for (let i = 0; i < n; i++) { assert.equal(view.saw().ok, true); view.update(0.81); }
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
  for (let i = 0; i < n; i++) { view.saw(); view.update(0.81); }
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
  for (let i = 0; i < n; i++) { view.saw(); view.update(0.81); }
  for (let i = 0; i < n; i++) { view.dragTo(i, view.slotOf(i)); view.drop(i); }
  view.end();
  const done = [];
  view.onDone = (e) => done.push(e);
  view.start('1,1,1', { x: 1, y: 1, z: 1 });
  view.update(0.016);
  if (done.length || !counters.work('10,5,20')?.done) { failures++; console.log('FAIL leaving clears the pending hand-over'); } else console.log('PASS leaving clears the pending hand-over');
}
process.exitCode = failures ? 1 : 0;
