import * as THREE from 'three';

/**
 * POT-7: flames rising from a body. Fed a list of sources ({ x, y, z, w, h }:
 * feet position and size), it draws a few small tongues round each that rise,
 * shrink and start again. The same yellow-to-orange tongue as the campfire's
 * (FlameView), as one instanced mesh.
 */
const PER = 6, MAX_SOURCES = 12;

function tongue() {
  const g = new THREE.BufferGeometry();
  const pos = [-0.5, 0, 0, 0.5, 0, 0, 0.32, 0.45, 0, -0.32, 0.45, 0, 0, 1, 0];
  const col = [1, 0.5, 0.12, 1, 0.5, 0.12, 1, 0.75, 0.25, 1, 0.75, 0.25, 1, 0.95, 0.55];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]);
  return g;
}

export class BodyFlames {
  constructor(scene) {
    this.scene = scene;
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    this.mesh = new THREE.InstancedMesh(tongue(), material, MAX_SOURCES * PER);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
  }

  /** `sources` at time `now` (seconds). Empty hides it all. */
  update(sources, now = performance.now() / 1000) {
    const n = Math.min(sources.length, MAX_SOURCES);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const s = sources[i];
      const seed = (s.seed ?? i) * 1.37;
      for (let j = 0; j < PER; j++) {
        const phase = (now * 1.3 + j / PER + seed) % 1;
        const a = j * 2.4 + seed, r = (s.w ?? 0.6) * 0.45;
        this._p.set(s.x + Math.cos(a) * r, s.y + phase * (s.h ?? 1.8) * 0.9, s.z + Math.sin(a) * r);
        this._e.set(0, a + now, 0);
        this._q.setFromEuler(this._e);
        const size = (1 - phase) * 0.55 + 0.1;
        this._s.set(size, size * 1.3, size);
        this._m.compose(this._p, this._q, this._s);
        this.mesh.setMatrixAt(k++, this._m);
      }
    }
    this.mesh.count = k;
    this.mesh.visible = k > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
