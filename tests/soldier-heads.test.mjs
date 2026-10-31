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
