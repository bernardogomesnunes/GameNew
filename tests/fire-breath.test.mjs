// IMP-47 (owner, 15 November: "the dragons need fable then they are odd
// looking"): the fire is a stream of small flickering tongues, white-yellow at
// the mouth, orange, then red and dark smoke at the far end, thinning out.
// A fixed pool made once; a frame allocates nothing.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FireBreathView, flameColour, STREAMS, TONGUES, SMOKE } from '../src/render/FireBreathView.js';
import { MOBS_BY_ID } from '../src/config/mobs.js';
import { BREATH_SECONDS } from '../src/world/Mobs.js';
import { dragonPose } from '../src/render/MobView.js';

const hex = (f) => flameColour(f, new THREE.Color()).getHexString();
const c = (f) => flameColour(f, new THREE.Color());
assert.equal(hex(0), 'fff8dc', 'white-yellow at the mouth');
assert.ok(c(0.42).r > 0.9 && c(0.42).g < c(0.1).g && c(0.42).b < 0.1, 'orange two fifths of the way');
assert.ok(c(0.88).g < 0.05 && c(0.88).r > 0.3, 'red near the far end');
assert.ok(c(1).r < c(0.8).r, 'dark red at the far end');
console.log(`PASS the flame runs white-yellow (#${hex(0)}), orange (#${hex(0.42)}), red (#${hex(0.88)}), dark red (#${hex(1)})`);

const scene = new THREE.Scene();
const view = new FireBreathView(scene);
const made = scene.children.length;
assert.equal(made, 2, 'two instanced meshes hold every stream');
assert.equal(view.flames.instanceMatrix.count, STREAMS * TONGUES);
assert.equal(view.smoke.instanceMatrix.count, STREAMS * SMOKE);

const spec = MOBS_BY_ID.get('fire_drake');
const drake = { type: 'fire_drake', x: 0, y: 20, z: 0, facing: 0, breathing: BREATH_SECONDS * 0.5, breathAt: { x: 0, y: 2, z: 16 } };
view.update([drake], 4000);
const mouth = view.mouthOf(drake, spec, new THREE.Vector3());
assert.ok(Math.abs(mouth.z - spec.mouth.out) < 1e-6 && Math.abs(mouth.y - 20 - spec.mouth.up) < 1e-6, 'the fire leaves the mouth the model has');
const n = view.flames.count;
assert.ok(n > TONGUES * 0.5 && n <= TONGUES, `one dragon, ${n} tongues`);
assert.ok(view.smoke.count > 0 && view.smoke.count <= SMOKE, `${view.smoke.count} puffs of smoke`);

// Each tongue: how far along it is, how wide, what colour.
const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), col = new THREE.Color();
const span = Math.hypot(drake.breathAt.y - mouth.y, drake.breathAt.z - mouth.z);
const tongues = [];
for (let i = 0; i < n; i++) {
  view.flames.getMatrixAt(i, m4); m4.decompose(p, q, s); view.flames.getColorAt(i, col);
  tongues.push({ along: (p.z - mouth.z) / (drake.breathAt.z - mouth.z), wide: s.x, long: s.z, g: col.g, r: col.r });
}
const near = tongues.filter((t) => t.along < 0.2), mid = tongues.filter((t) => t.along >= 0.3 && t.along < 0.6), far = tongues.filter((t) => t.along > 0.8);
const mean = (list, key) => list.reduce((a, t) => a + t[key], 0) / list.length;
assert.ok(near.length && mid.length && far.length, 'flames the whole way');
assert.ok(mean(near, 'g') > 0.6 && mean(mid, 'g') < mean(near, 'g') && mean(far, 'g') < 0.12, 'pale at the mouth, red at the far end');
assert.ok(tongues.every((t) => t.wide * 0.84 < 0.6 && t.long * 1.5 > t.wide * 0.84), `small pointed tongues (the widest ${(Math.max(...tongues.map((t) => t.wide)) * 0.84).toFixed(2)} of a block across)`);
assert.ok(near.length > far.length * 1.5, `thinning out: ${near.length} in the first fifth, ${far.length} in the last`);
console.log(`PASS ${n} tongues over ${span.toFixed(0)} blocks: ${near.length} pale ones at the mouth, ${far.length} red ones at the far end, ${view.smoke.count} puffs of smoke`);

// Flicker: a sixtieth of a second later the same tongue is a different length.
view.flames.getMatrixAt(0, m4); m4.decompose(p, q, s);
const before = s.z / s.x;
view.update([drake], 4000 + 1000 / 60);
view.flames.getMatrixAt(0, m4); m4.decompose(p, q, s);
assert.ok(Math.abs(s.z / s.x - before) > 0.02, 'the tongues flicker');
console.log('PASS the tongues flicker from frame to frame');

// A fixed pool: the same buffers after 600 frames with more dragons than streams, and nothing added to the scene.
const buffers = () => [view.flames.instanceMatrix.array, view.flames.instanceColor.array, view.smoke.instanceMatrix.array, view.smoke.instanceColor.array];
const first = buffers();
const many = Array.from({ length: 5 }, (_, i) => ({ ...drake, x: i * 30, type: i ? 'fire_drake' : 'elder_dragon' }));
for (let i = 0; i < 600; i++) view.update(many, 5000 + i * 16);
assert.ok(view.flames.count <= STREAMS * TONGUES && view.flames.count > TONGUES * 1.5, `${STREAMS} streams at most (${view.flames.count} tongues)`);
assert.ok(buffers().every((b, i) => b === first[i]), 'the same buffers');
assert.equal(scene.children.length, made);
view.update([{ ...drake, breathing: 0 }], 9000);
assert.equal(view.flames.count + view.smoke.count, 0, 'no breath, nothing drawn');
view.update(null, 9000);
// In the air the model is tipped and banked (MobView); the mouth goes with it.
const level = view.mouthOf({ ...drake, airborne: true, climb: 0, bank: 0 }, spec, new THREE.Vector3()).clone();
const diving = view.mouthOf({ ...drake, airborne: true, climb: -4, bank: 0.3 }, spec, new THREE.Vector3());
assert.ok(level.distanceTo(mouth) < 1e-6 && diving.y < level.y - 0.3 && Math.abs(diving.x) > 0.3, 'the mouth follows the dive and the bank');
console.log('PASS a fixed pool: three streams at most, the same buffers after 600 frames, nothing drawn without a breath');

const pose = {};
dragonPose(pose, { type: 'fire_drake', airborne: true, climb: 0, dying: 0, breathing: 0.5 }, 1, 0, 0, 0);
assert.equal(pose.jaw[0], 0.6, 'its mouth is open while it breathes');
console.log('PASS a dragon breathing fire holds its mouth open');
