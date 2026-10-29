import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SettlerView } from '../src/render/SettlerView.js';
import { addKit } from '../src/render/Models.js';
const people = Array.from({ length: 160 }, (_, id) => ({ id, kind: 'footman', x: id * 2, y: 1,
  z: 0, colour: 0x8899aa, facing: 0, hurt: 0 }));
const scene = new THREE.Scene(), view = new SettlerView(scene, 'defenders');
const shadows = () => scene.children.filter(mesh => mesh.material?.opacity === 0.28);
view.update(people.slice(0, 80));
assert.equal(shadows().reduce((n, m) => n + m.count, 0), 80, 'two full posts must draw all eighty soldiers');
const positions = [];
for (const mesh of shadows()) for (let i=0;i<mesh.count;i++) {
  const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); positions.push(matrix.elements[12]);
}
assert.deepEqual(positions.sort((a,b)=>a-b), people.slice(0,80).map(p=>p.x));
console.log('PASS two full military posts draw eighty distinct soldiers without clipping at sixty-four');
view.setVisible(false); view.update(people);
assert.equal(scene.children.every(mesh=>!mesh.visible), true, 'new batches inherit hidden state');
view.setVisible(true);
assert.equal(shadows().reduce((n,m)=>n+m.count,0), 160);
const expandedMeshes = scene.children.length;
let disposedInstances = 0;
for (const mesh of scene.children) mesh.addEventListener('dispose',()=>disposedInstances++);
view.update(people.slice(0,10));
assert.ok(scene.children.length < expandedMeshes, 'unneeded batches must release scene resources');
assert.ok(disposedInstances > 0, 'batch removal disposes GPU instance buffers');
assert.equal(shadows().reduce((n,m)=>n+m.count,0), 10);
view.dispose(); assert.equal(scene.children.length,0);
console.log('PASS crowd batches inherit visibility and release unused instance buffers');

const geometry = new THREE.BoxGeometry(), material = new THREE.MeshLambertMaterial();
addKit('footman', { id:'footman', root:new THREE.Group(), material, bones:[{name:'root',parent:-1,
  position:new THREE.Vector3(),quaternion:new THREE.Quaternion(),scale:new THREE.Vector3(1,1,1),geometry}] });
let sharedDisposed = 0; geometry.addEventListener('dispose',()=>sharedDisposed++);
const modeled = new SettlerView(scene,'defenders'); modeled.update(people);
const modelMeshes = scene.children.filter(mesh=>mesh.material===material);
assert.equal(modelMeshes.reduce((n,m)=>n+m.count,0),160,'loaded models must draw every soldier too');
assert.ok(modelMeshes.every(mesh=>mesh.count<=64),'keep each instanced batch bounded');
modeled.dispose();assert.equal(scene.children.length,0);assert.equal(sharedDisposed,0);
console.log('PASS model crowds draw all troops in bounded batches and retain shared geometry');
