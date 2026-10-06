import * as THREE from 'three';
import { SkyClouds } from '../src/render/SkyClouds.js';

/**
 * Reported directly: "The clouds tickle whenever I move the camera they
 * should move smoothly no matter my movement. And they should be transparent
 * or cloudy."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const clouds = new SkyClouds(new THREE.Scene());
const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
const snapshot = () => {
  const out = new Map();
  for (let i = 0; i < clouds.count; i++) {
    clouds.mesh.getMatrixAt(i, m); m.decompose(p, q, sc);
    out.set(`${sc.x.toFixed(3)},${sc.z.toFixed(3)}`, { x: p.x, z: p.z });
  }
  return out;
};

// Walk 400 blocks across many cell borders, a frame at a time.
let worst = 0, x = 0;
clouds.update(1 / 60, x, 0);
let before = snapshot();
for (let frame = 0; frame < 2400; frame++) {
  x += 400 / 2400;
  clouds.update(1 / 60, x, 0);
  const now = snapshot();
  for (const [k, a] of now) {
    const b = before.get(k);
    if (b) worst = Math.max(worst, Math.hypot(a.x - b.x, a.z - b.z));
  }
  before = now;
}
ok(`walking, no cloud ever jumps (most any moved in a frame: ${worst.toFixed(3)} blocks)`, worst < 0.05);

// And drifting for a long time while you stand still: never snapped back.
let worstDrift = 0;
clouds.update(0, 0, 0);
before = snapshot();
for (let t = 0; t < 200 * 60; t++) {
  clouds.update(1 / 60, 0, 0);
  const now = snapshot();
  for (const [k, a] of now) {
    const b = before.get(k);
    if (b) worstDrift = Math.max(worstDrift, Math.hypot(a.x - b.x, a.z - b.z));
  }
  before = now;
}
ok(`drifting, every cloud moves smoothly — no snap back every cell (${worstDrift.toFixed(3)})`, worstDrift < 0.05);
const shapes = new Set();
for (let i = 0; i < clouds.count; i++) { clouds.mesh.getMatrixAt(i, m); m.decompose(p, q, sc); shapes.add(`${sc.x.toFixed(3)},${sc.z.toFixed(3)}`); }
ok(`no two clouds in the sky are the same (${shapes.size} of ${clouds.count})`, shapes.size === clouds.count);
ok('see-through, and not hiding the one behind it', clouds.mesh.material.transparent && clouds.mesh.material.opacity < 1 && clouds.mesh.material.depthWrite === false);

process.exit(f ? 1 : 0);
