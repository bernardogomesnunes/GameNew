import * as THREE from 'three';

/**
 * Arrows in the air, and stuck where they landed: a shaft with a grey head
 * and pale fletching, pointing the way it's flying. One batch.
 */
const MAX_ARROWS = 48;

function arrowGeometry() {
  // Along +z, its middle at the origin: shaft, head forward, fletching back.
  const parts = [
    [0.035, 0.035, 0.7, 0, 0x9a7448],
    [0.07, 0.07, 0.12, 0.38, 0x8c9096],
    [0.16, 0.012, 0.16, -0.28, 0xe8e2d4],
    [0.012, 0.16, 0.16, -0.28, 0xc94a3e],
  ];
  const geos = parts.map(([w, h, d, z, color]) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.translate(0, 0, z);
    const c = new THREE.Color(color), n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const out = new THREE.BufferGeometry();
  const total = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  for (const name of ['position', 'normal', 'color']) {
    const arr = new Float32Array(total * 3);
    let o = 0;
    for (const g of geos) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  geos.forEach((g) => g.dispose());
  return out;
}

export class ArrowView {
  constructor(scene) {
    this.scene = scene;
    this.mesh = new THREE.InstancedMesh(arrowGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), MAX_ARROWS);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._z = new THREE.Vector3(0, 0, 1);
  }

  update(arrows) {
    const n = Math.min(arrows.length, MAX_ARROWS);
    this.mesh.count = n;
    for (let i = 0; i < n; i++) {
      const a = arrows[i];
      // A stuck arrow keeps the way it was flying when it hit.
      if (!a.stuck) a.dir = { x: a.vx, y: a.vy, z: a.vz };
      const d = a.dir ?? { x: a.vx, y: a.vy, z: a.vz };
      this._d.set(d.x, d.y, d.z).normalize();
      this._q.setFromUnitVectors(this._z, this._d);
      this._p.set(a.x, a.y, a.z);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
