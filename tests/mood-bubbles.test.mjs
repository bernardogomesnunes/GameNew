// PLAY-13 chunk 4: thought bubbles over the heads of villagers below Content.
import * as THREE from 'three';
import { SettlerView, MAX } from '../src/render/SettlerView.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const scene = new THREE.Scene();
const view = new SettlerView(scene, 'settlers');
const person = (id, band, hungry = false) => ({ id, name: `P${id}`, x: 10 + id, y: 5, z: 10, hungry, band, workId: null });
const bubbleMeshes = () => scene.children.filter((m) => m.isInstancedMesh && m === view.bubbles);

ok('one bubble mesh in the scene', bubbleMeshes().length === 1 && view.bubbles.isInstancedMesh);
ok('with room for every villager', view.bubbles.instanceMatrix.count === MAX);

const crowd = [person(1, 'content'), person(2, 'grumbling'), person(3, 'angry', true), person(4, 'furious'), person(5, 'content'), person(6, undefined)];
view.update(crowd);
ok('bubble count equals villagers below Content (3 of 6)', view.bubbles.count === 3);
ok('and the mesh shows', view.bubbles.visible === true);

const colour = new THREE.Color();
const at = (i) => { view.bubbles.getColorAt(i, colour); return `#${colour.getHexString()}`; };
ok('colours by band: yellow, orange, red', [at(0), at(1), at(2)].join() === '#e0b43a,#e07a2e,#d23a2a');
const cells = view.bubbles.geometry.getAttribute('cell');
ok('icon by reason: hungry is the bowl, jobless the hammer', [0, 1, 2].map((i) => cells.getX(i)).join() === '0.5,0,0.5');

const pos = new THREE.Vector3(), m = new THREE.Matrix4();
view.bubbles.getMatrixAt(1, m);
pos.setFromMatrixPosition(m);
ok('over the head', pos.x === 13 && pos.z === 10 && pos.y > 5 + 1.8);

// Faces the camera.
const cam = new THREE.PerspectiveCamera();
cam.quaternion.setFromEuler(new THREE.Euler(0.3, 1.2, 0));
view.bubbles.onBeforeRender(null, scene, cam);
const q = new THREE.Quaternion(), s = new THREE.Vector3();
view.bubbles.getMatrixAt(0, m);
m.decompose(pos, q, s);
ok('billboarded to the camera', Math.abs(q.angleTo(cam.quaternion)) < 1e-5);

view.update([person(1, 'content'), person(2, 'content')]);
ok('everyone Content: no bubbles and nothing drawn', view.bubbles.count === 0 && view.bubbles.visible === false);

// Draw calls: one extra mesh, whatever the crowd.
const many = Array.from({ length: 40 }, (_, i) => person(i, i % 2 ? 'angry' : 'grumbling'));
view.update(many);
const before = scene.children.length;
view.update(many);
ok('40 bubbles are still one mesh', view.bubbles.count === 40 && scene.children.length === before);

// Only the villagers' view has bubbles.
const other = new SettlerView(new THREE.Scene(), 'defenders');
ok('other crowds draw none', other.bubbles === null);
other.update([person(1, 'angry')]);

view.dispose();
ok('dispose removes it', !scene.children.includes(view.bubbles));

console.log(f ? `${f} FAILED` : 'ok');
process.exit(f ? 1 : 0);
