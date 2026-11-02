// CRAFT3D-3, Task 4: the crucible close-up — the pot, fire and moulds, and the pour.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CrucibleView, FILL_SECONDS } from '../src/render/CrucibleView.js';
import { Crucibles } from '../src/duilt/Crucible.js';
import { Inventory } from '../src/items/Inventory.js';

let failures = 0;
const check = (name, fn) => { try { fn(); console.log('PASS ' + name); } catch (e) { failures++; console.log('FAIL ' + name + '\n  ' + e.message); } };
const meshes = (scene) => { let n = 0; scene.traverse((o) => { if (o.isMesh) n++; }); return n; };
function setup() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1, 0.05, 500);
  const bag = new Inventory(); bag.add('iron_ore', 4);
  const crucibles = new Crucibles({ bag: () => bag, heated: () => true });
  const pours = [];
  const real = crucibles.pour.bind(crucibles);
  crucibles.pour = (key, level) => { pours.push(level); return real(key, level); };
  const view = new CrucibleView({ scene, camera, crucibles });
  return { scene, camera, bag, crucibles, view, pours };
}
const K = '4,2,4', AT = { x: 4, y: 2, z: 4 };

check('the camera is over the crucible, looking at it', () => {
  const { view, camera } = setup();
  view.start(K, AT); view.update(0.016);
  const top = new THREE.Vector3(4.5, 3, 4.5), dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  assert.ok(dir.dot(top.clone().sub(camera.position).normalize()) > 0.999);
});
check('at most 6 meshes, all gone on end', () => {
  const { view, scene } = setup();
  const before = meshes(scene);
  view.start(K, AT);
  assert.ok(meshes(scene) - before <= 6, `${meshes(scene) - before} meshes`);
  view.end();
  assert.equal(meshes(scene), before);
});
check(`a hold of ${FILL_SECONDS} s fills the mould`, () => {
  const { view, crucibles, pours } = setup();
  crucibles.load(K, 'smelt_iron', 1); crucibles.tick(45.1);
  view.start(K, AT);
  view.holdPour(true);
  for (let t = 0; t < FILL_SECONDS - 1e-9; t += 0.1) view.update(0.1);
  assert.ok(Math.abs(view.level - 1) < 0.01, `level ${view.level}`);
  view.holdPour(false);
  assert.equal(pours.length, 1);
  assert.ok(Math.abs(pours[0] - 1) < 0.01);
  assert.equal(view.level, 0);
});
check('leaving mid-pour pours nothing', () => {
  const { view, crucibles, pours } = setup();
  crucibles.load(K, 'smelt_iron', 1); crucibles.tick(45.1);
  view.start(K, AT);
  view.holdPour(true); view.update(0.5);
  view.end();
  assert.equal(pours.length, 0);
  assert.equal(view.level, 0);
});
check('nothing molten: holding does not fill', () => {
  const { view } = setup();
  view.start(K, AT);
  view.holdPour(true); view.update(1);
  assert.equal(view.level, 0);
});
process.exitCode = failures ? 1 : 0;

// While the close-up is open the world waits, but the pot keeps melting.
{
  const { CrucibleMachine } = await import('../src/render/CrucibleMachine.js');
  globalThis.document ??= undefined;
  const { scene, camera, crucibles } = setup();
  const uiRoot = { append() {} };
  const fakeDoc = { createElement: () => ({ className: '', hidden: true, addEventListener() {}, append() {}, querySelector: () => null, set innerHTML(v) {} }) };
  const was = globalThis.document; globalThis.document = fakeDoc;
  try {
    const m = new CrucibleMachine({ scene, camera, uiRoot, crucibles });
    crucibles.load(K, 'smelt_iron', 1);
    m.start(K, AT);
    m.update(45.1);
    check('the pot melts while you watch it', () => assert.equal(crucibles.state(K).molten, 1));
  } finally { globalThis.document = was; }
}
process.exitCode = failures ? 1 : 0;
