import * as THREE from 'three';

/**
 * Reported: "The axe still looks weird — the blade should be pointing front
 * like in the third person, not facing right as we have it now." So the
 * blade's direction is worked out from the views themselves: in first person
 * relative to the camera, in third person relative to the avatar, both at
 * rest.
 */

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { HandView } = await import('../src/render/HandView.js');
const { AvatarView } = await import('../src/render/AvatarView.js');

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const BLADE = new THREE.Vector3(-1, 0, 0);   // see heldModel.js: a blade always faces -x
const HAFT = new THREE.Vector3(0, 1, 0);

// First person: the blade relative to the camera (-z is into the screen).
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 390 / 780, 0.1, 100);
scene.add(camera);
const hand = new HandView(scene, camera);
hand.update(1 / 60, { velocity: { x: 0, z: 0 } }, { held: { itemId: 'axe' }, look: {}, visible: true });
hand.group.updateMatrixWorld(true);
const q1 = new THREE.Quaternion();
hand.item.getWorldQuaternion(q1);
camera.updateMatrixWorld(true);
const camQ = new THREE.Quaternion();
camera.getWorldQuaternion(camQ);
const toCam = q1.clone().premultiply(camQ.invert());
const blade1 = BLADE.clone().applyQuaternion(toCam), haft1 = HAFT.clone().applyQuaternion(toCam);
ok(`first person: the blade points ahead, into the screen (${blade1.toArray().map((n) => n.toFixed(2)).join(', ')})`, blade1.z < -0.65);
ok('not out to the right — turned just enough towards the middle to show its face', blade1.x < -0.1 && blade1.x > -0.45);
ok(`the head is up, leaning away from you (${haft1.toArray().map((n) => n.toFixed(2)).join(', ')})`, haft1.y > 0.6 && haft1.z < -0.2);

// Third person: the blade relative to the avatar, which faces -z.
const avatar = new AvatarView(scene);
const player = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), yaw: 0, pitch: 0, grounded: true, flying: false };
avatar.update(1 / 60, player, { look: {}, worn: {}, held: { itemId: 'axe' }, visible: true });
avatar.group.updateMatrixWorld(true);
const q3 = new THREE.Quaternion();
avatar.held.getWorldQuaternion(q3);
const blade3 = BLADE.clone().applyQuaternion(q3);
ok(`third person: the blade points ahead of the avatar too (${blade3.toArray().map((n) => n.toFixed(2)).join(', ')})`, blade3.z < -0.5 && Math.abs(blade3.x) < 0.2);
ok('the two agree: within a quarter turn of each other', blade1.angleTo(blade3) < Math.PI / 4);

process.exit(f ? 1 : 0);
