import * as THREE from 'three';
import { SETTLERS } from '../config/settlers.js';

/**
 * The settlers, drawn.
 *
 * A population you can only read as a number on a panel is a spreadsheet. The
 * point of them is looking up from what you are building and seeing somebody
 * walking to the quarry, so they are figures in the world — two boxes, a coat
 * colour each, facing where they are going.
 *
 * Two instanced meshes for the lot of them, because a settlement of thirty is
 * sixty draw calls done the naive way and this is a game that has to hold up
 * on a phone.
 */

const MAX = 64;   // beds run out long before this; the cap is just for the buffer

export class SettlerView {
  constructor(scene) {
    this.scene = scene;
    const { height, width } = SETTLERS.build;
    const bodyH = height * 0.62, headH = height * 0.28;

    /**
     * An instanced colour only reaches the shader when the material has
     * vertexColors on — and with that on, a geometry carrying no colour
     * attribute renders black. So each box gets a plain white one for the
     * instance colour to multiply into. Without the attribute they came out
     * black silhouettes; without vertexColors, all the same grey.
     */
    const box = (w, h, d) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const white = new Float32Array(g.attributes.position.count * 3).fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(white, 3));
      return g;
    };
    const mat = () => new THREE.MeshLambertMaterial({ vertexColors: true });
    this.bodies = new THREE.InstancedMesh(box(width, bodyH, width * 0.7), mat(), MAX);
    this.heads = new THREE.InstancedMesh(box(width * 0.72, headH, width * 0.72), mat(), MAX);
    for (const m of [this.bodies, this.heads]) {
      m.frustumCulled = false;
      m.castShadow = false;
      m.count = 0;
      scene.add(m);
    }
    this.bodyH = bodyH;
    this.headH = headH;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._pos = new THREE.Vector3();
    this._scale = new THREE.Vector3(1, 1, 1);
    this._colour = new THREE.Color();
  }

  /** Redraws every settler where they now are. Called each frame. */
  update(people) {
    const n = Math.min(people.length, MAX);
    this.bodies.count = n;
    this.heads.count = n;
    if (!n) return;

    for (let i = 0; i < n; i++) {
      const p = people[i];
      // Face the way they are walking; standing still keeps the last heading.
      if (p.target) {
        const dx = p.target.x - p.x, dz = p.target.z - p.z;
        if (dx || dz) p.facing = Math.atan2(dx, dz);
      }
      this._e.set(0, p.facing ?? 0, 0);
      this._q.setFromEuler(this._e);

      this._pos.set(p.x, p.y + this.bodyH / 2, p.z);
      this._m.compose(this._pos, this._q, this._scale);
      this.bodies.setMatrixAt(i, this._m);

      this._pos.set(p.x, p.y + this.bodyH + this.headH / 2, p.z);
      this._m.compose(this._pos, this._q, this._scale);
      this.heads.setMatrixAt(i, this._m);

      this._colour.setHex(p.colour);
      this.bodies.setColorAt(i, this._colour);
      // A head a shade lighter than the coat, so the figure has a top to it.
      this._colour.offsetHSL(0, -0.15, 0.22);
      this.heads.setColorAt(i, this._colour);
    }

    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
  }

  /** The settler nearest a look ray, for naming whoever you point at. */
  pick(people, origin, direction, maxDistance = 12) {
    // Aim at the chest rather than the feet, and allow a person's width of
    // slack: a figure you have to hit dead centre is one you never name.
    let best = null, bestT = Infinity;
    for (const p of people) {
      const dx = p.x - origin.x, dy = (p.y + SETTLERS.build.height * 0.6) - origin.y, dz = p.z - origin.z;
      const t = dx * direction.x + dy * direction.y + dz * direction.z;
      if (t < 0 || t > maxDistance) continue;
      // How far the settler sits off the line of sight at their closest point.
      const off = Math.hypot(dx - direction.x * t, dy - direction.y * t, dz - direction.z * t);
      if (off < 1.1 && t < bestT) { bestT = t; best = p; }
    }
    return best;
  }

  setVisible(on) {
    this.bodies.visible = on;
    this.heads.visible = on;
  }

  dispose() {
    for (const m of [this.bodies, this.heads]) {
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}
