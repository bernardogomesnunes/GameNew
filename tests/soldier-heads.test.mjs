// IMP-17: "the warriors ... are headless". A soldier's id is text ('d1'),
// and the idle head turn was worked out from the id as a number: NaN, so the
// head's matrix was NaN and nothing was drawn. The turn now comes from the
// person's hash, a number for any id.
import assert from 'node:assert/strict';
import * as THREE from 'three';

const { SettlerView } = await import('../src/render/SettlerView.js');
const { addKit } = await import('../src/render/Models.js');

const scene = { add() {} };
const finite = (mesh, i) => { const m = new THREE.Matrix4(); mesh.getMatrixAt(i, m); return m.elements.every(Number.isFinite); };

const view = new SettlerView(scene, 'defenders');
const people = [{ id: 'd1', kind: 'shield_guard', x: 1, y: 2, z: 3 }, { id: 7, kind: 'settler', x: 4, y: 2, z: 3 }];
view.update(people);
assert.ok(finite(view.heads, 0), 'a text id still gives a drawable head');
assert.ok(finite(view.heads, 1));
console.log('PASS a standing soldier with a text id keeps its head (boxes)');

// With a model: a head bone posed from a text id.
const geometry = new THREE.BoxGeometry(1, 1, 1);
const bone = (name, parent) => ({ name, parent, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1), geometry: name === 'root' ? null : geometry });
addKit('footman', { id: 'footman', root: null, material: new THREE.MeshBasicMaterial(), bones: [bone('root', -1), bone('body', 0), bone('head', 1)] });
const modelled = new SettlerView(scene, 'defenders');
modelled.update([{ id: 'd2', kind: 'footman', x: 0, y: 0, z: 0 }]);
const crowd = modelled.crowds.byId.get('footman');
assert.ok(finite(crowd.meshes[2], 0), 'the model head bone has a real matrix');
console.log('PASS a modelled soldier with a text id keeps its head');

// IMP-16: stopping, they finish the step and stand with both legs straight.
{
  const v = new SettlerView(scene, 'settlers');
  const p = { id: 3, kind: 'settler', x: 0, y: 0, z: 0, target: { x: 10, z: 0 } };
  for (let i = 0; i < 7; i++) { p.x += 0.13; v.update([p]); }
  p.target = null;
  for (let i = 0; i < 30; i++) v.update([p]);
  assert.equal(p._stride, 0);
  assert.ok(Math.abs(Math.sin(p._walk * 5)) < 1e-9, 'legs together, straight');
  console.log('PASS stopping, they finish the step and stand with both legs straight');
}
{
  const v = new SettlerView(scene, 'settlers');
  const p = { id: 4, kind: 'settler', x: 0, y: 0, z: 0, facing: 0, target: { x: -5, z: 0 } };
  v.update([p]);
  assert.ok(p.facing < 0 && p.facing > -Math.PI / 2, 'a turn takes more than a frame');
  for (let i = 0; i < 40; i++) v.update([p]);
  assert.ok(Math.abs(p.facing + Math.PI / 2) < 0.03, 'and ends facing the way they walk');
  console.log('PASS they turn towards where they walk over a few frames');
}

// IMP-16: the models were saved mid-stride; their limbs rest straight.
{
  const { makeKit } = await import('../src/render/Models.js');
  const root = new THREE.Group(); root.name = 'walker';
  const leg = new THREE.Group(); leg.name = 'walker_leg_l'; leg.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.49);
  const head = new THREE.Group(); head.name = 'walker_head'; head.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.3);
  root.add(leg, head);
  const kit = makeKit('walker', root, () => null);
  const bone = (n) => kit.bones.find((b) => b.name === n);
  assert.ok(bone('leg_l').quaternion.equals(new THREE.Quaternion()), 'a leg rests straight');
  assert.ok(!bone('head').quaternion.equals(new THREE.Quaternion()), 'other bones keep their pose');
  console.log('PASS limbs saved mid-stride rest straight; nothing else is touched');
}
