import * as THREE from 'three';
import { MOBS_BY_ID } from '../config/mobs.js';

/**
 * The animals, drawn: a body, a head and four legs each, out of one unit
 * cube scaled per part — so every species shares three instanced meshes and
 * the whole lot is three draw calls, the same bargain SettlerView makes.
 *
 * The legs swing while an animal walks, its head drops while it grazes, it
 * flashes red when hit and tips over when it dies.
 */

const MAX = 48;
const HURT_COLOUR = new THREE.Color(0xd9534f);

export class MobView {
  constructor(scene) {
    this.scene = scene;
    // Instance colour only reaches the shader with vertexColors on, and then
    // a geometry with no colour attribute renders black — see SettlerView.
    const cube = new THREE.BoxGeometry(1, 1, 1);
    cube.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cube.attributes.position.count * 3).fill(1), 3));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.bodies = new THREE.InstancedMesh(cube, mat, MAX);
    this.heads = new THREE.InstancedMesh(cube, mat, MAX);
    this.legs = new THREE.InstancedMesh(cube, mat, MAX * 4);
    for (const m of [this.bodies, this.heads, this.legs]) {
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
    }
    this._base = new THREE.Matrix4();
    this._part = new THREE.Matrix4();
    this._tmp = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this._one = new THREE.Quaternion();
  }

  update(mobs) {
    const n = Math.min(mobs.length, MAX);
    this.bodies.count = n;
    this.heads.count = n;
    this.legs.count = n * 4;
    if (!n) return;

    for (let i = 0; i < n; i++) {
      const m = mobs[i];
      const spec = MOBS_BY_ID.get(m.type);
      const { w, h, l } = spec.body;
      const leg = spec.leg, head = spec.head;
      // Toppling: rolls onto its side over the dying time.
      const roll = m.dying > 0 ? (1 - m.dying / 0.6) * (Math.PI / 2) : 0;
      this._e.set(0, m.facing, roll);
      this._q.setFromEuler(this._e);
      this._base.compose(this._v.set(m.x, m.y, m.z), this._q, this._s.set(1, 1, 1));

      const flash = m.hurt > 0 ? Math.min(1, m.hurt / 0.25) * 0.7 : 0;

      // body
      this.local(0, leg + h / 2, 0, w, h, l);
      this.bodies.setMatrixAt(i, this._part);
      this.bodies.setColorAt(i, this.tint(spec.colour, flash));

      // head: at the front, dropped to the ground while grazing
      const hy = m.grazing ? Math.max(head / 2, leg * 0.5) : leg + h * 0.85;
      const hz = l / 2 + head * (m.grazing ? 0.25 : 0.3);
      this.local(0, hy, hz, head, head, head);
      this.heads.setMatrixAt(i, this._part);
      this.heads.setColorAt(i, this.tint(spec.headColour, flash));

      // legs: pivot at the hip, diagonal pairs swinging together
      const lw = Math.max(0.06, Math.min(w, l) * 0.2);
      const swing = m.speed > 0 ? Math.sin(m.stride * (5 / Math.max(0.3, leg + 0.2))) * 0.55 : 0;
      const corners = [[-1, -1, 1], [1, 1, 1], [1, -1, -1], [-1, 1, -1]];
      for (let k = 0; k < 4; k++) {
        const [sx, sz, dir] = corners[k];
        this._part.makeTranslation(sx * (w / 2 - lw / 2), leg, sz * (l / 2 - lw / 2));
        this._part.multiply(this._tmp.makeRotationX(swing * dir));
        this._part.multiply(this._tmp.makeTranslation(0, -leg / 2, 0));
        this._part.multiply(this._tmp.makeScale(lw, leg, lw));
        this._part.premultiply(this._base);
        this.legs.setMatrixAt(i * 4 + k, this._part);
        this.legs.setColorAt(i * 4 + k, this.tint(spec.legColour, flash));
      }
    }
    for (const m of [this.bodies, this.heads, this.legs]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /** A box in the animal's own space, placed into the world by the base matrix. */
  local(x, y, z, sx, sy, sz) {
    this._part.compose(this._v.set(x, y, z), this._one, this._s.set(sx, sy, sz));
    this._part.premultiply(this._base);
  }

  tint(hex, flash) {
    this._c.setHex(hex);
    if (flash) this._c.lerp(HURT_COLOUR, flash);
    return this._c;
  }

  setVisible(on) {
    for (const m of [this.bodies, this.heads, this.legs]) m.visible = on;
  }
}
