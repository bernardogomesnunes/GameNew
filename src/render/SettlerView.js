import * as THREE from 'three';
import { SETTLERS } from '../config/settlers.js';
import { SKINS, HAIRS } from '../config/avatar.js';

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

const MAX = 64;
const HURT_RED = new THREE.Color(0xd23a2a);   // beds run out long before this; the cap is just for the buffer
const FROST = new THREE.Color(0x9fe6ff), EMBER = new THREE.Color(0xff7a3a), SPARK = new THREE.Color(0xffe066);

/** A number that's the same for a person every frame — from their name, or where they began. */
function personHash(p) {
  if (p._hash != null) return p._hash;
  const key = p.name ?? p.id ?? `${Math.round(p.x)},${Math.round(p.z)}`;
  let h = 2166136261;
  for (let i = 0; i < String(key).length; i++) h = Math.imul(h ^ String(key).charCodeAt(i), 16777619);
  return (p._hash = h >>> 0);
}

export class SettlerView {
  constructor(scene) {
    this.scene = scene;
    const { height, width } = SETTLERS.build;
    // Legs, a body, a head with hair, and two arms (playtest, P3: "people
    // ... with arms and legs that swing as they walk").
    const legH = height * 0.4, bodyH = height * 0.32, headH = height * 0.28;

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
    this.bodies = new THREE.InstancedMesh(box(width, bodyH, width * 0.62), mat(), MAX);
    this.heads = new THREE.InstancedMesh(box(width * 0.72, headH, width * 0.72), mat(), MAX);
    this.hair = new THREE.InstancedMesh(box(width * 0.76, headH * 0.32, width * 0.76), mat(), MAX);
    // A limb is a unit box, scaled and swung per instance: two legs, two arms.
    this.limbs = new THREE.InstancedMesh(box(1, 1, 1), mat(), MAX * 4);
    this.meshes = [this.bodies, this.heads, this.hair, this.limbs];
    for (const m of this.meshes) {
      m.frustumCulled = false;
      m.castShadow = false;
      m.count = 0;
      scene.add(m);
    }
    this.legH = legH;
    this.bodyH = bodyH;
    this.headH = headH;
    this.width = width;
    this._m = new THREE.Matrix4();
    this._t = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._pos = new THREE.Vector3();
    this._scale = new THREE.Vector3(1, 1, 1);
    this._colour = new THREE.Color();
  }

  /** Redraws every settler where they now are. Called each frame. */
  update(people) {
    const n = Math.min(people.length, MAX);
    for (const m of this.meshes) m.count = m === this.limbs ? n * 4 : n;
    if (!n) return;
    const { legH, bodyH, headH, width } = this;

    for (let i = 0; i < n; i++) {
      const p = people[i];
      // Face the way they are walking; standing still keeps the last heading.
      if (p.target) {
        const dx = p.target.x - p.x, dz = p.target.z - p.z;
        if (dx || dz) p.facing = Math.atan2(dx, dz);
      }
      // How far they've walked, for the swing of their arms and legs.
      const moved = p._lx == null ? 0 : Math.hypot(p.x - p._lx, p.z - p._lz);
      p._lx = p.x; p._lz = p.z;
      p._walk = (p._walk ?? 0) + Math.min(moved, 0.5);
      p._stride = Math.max(0, Math.min(1, (p._stride ?? 0) + (moved > 0.002 ? 0.15 : -0.1)));
      const swing = Math.sin(p._walk * 5) * 0.6 * p._stride;

      this._e.set(0, p.facing ?? 0, 0);
      this._q.setFromEuler(this._e);
      const base = this._m;

      const place = (mesh, x, y, z) => {
        this._pos.set(x, y, z).applyQuaternion(this._q);
        base.compose(this._pos.set(p.x + this._pos.x, p.y + this._pos.y, p.z + this._pos.z), this._q, this._scale);
        mesh.setMatrixAt(i, base);
      };
      place(this.bodies, 0, legH + bodyH / 2, 0);
      place(this.heads, 0, legH + bodyH + headH / 2, 0);
      place(this.hair, 0, legH + bodyH + headH * 0.86, -width * 0.02);

      // Limbs: each hangs from its joint and swings about it.
      const limb = (k, x, top, len, w, angle) => {
        this._pos.set(x, top, 0).applyQuaternion(this._q);
        base.compose(this._pos.set(p.x + this._pos.x, p.y + this._pos.y, p.z + this._pos.z), this._q, this._scale);
        base.multiply(this._t.makeRotationX(angle));
        base.multiply(this._t.makeTranslation(0, -len / 2, 0));
        base.multiply(this._t.makeScale(w, len, w));
        this.limbs.setMatrixAt(i * 4 + k, base);
      };
      const lw = width * 0.36, aw = width * 0.26;
      limb(0, -width * 0.24, legH, legH, lw, swing);
      limb(1, width * 0.24, legH, legH, lw, -swing);
      limb(2, -width * 0.64, legH + bodyH * 0.95, bodyH * 0.95, aw, -swing * 0.8);
      limb(3, width * 0.64, legH + bodyH * 0.95, bodyH * 0.95, aw, swing * 0.8);

      // Coat, trousers a shade darker, a face of their own, and hair.
      const coat = this.coatColour(p);
      this.bodies.setColorAt(i, coat);
      this.limbs.setColorAt(i * 4 + 2, coat);
      this.limbs.setColorAt(i * 4 + 3, coat);
      this._colour.copy(coat).offsetHSL(0, -0.1, -0.18);
      this.limbs.setColorAt(i * 4, this._colour);
      this.limbs.setColorAt(i * 4 + 1, this._colour);
      const who = personHash(p);
      this._colour.setHex(SKINS[who % SKINS.length]);
      if (p.hurt > 0) this._colour.lerp(HURT_RED, 0.5);
      this.heads.setColorAt(i, this._colour);
      // A soldier's helm (or an archer's hood) where hair would be.
      this._colour.setHex(p.helm ?? HAIRS[(who >> 3) % HAIRS.length]);
      this.hair.setColorAt(i, this._colour);
    }

    for (const m of this.meshes) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /** A person's coat colour this frame: their own, flashing when struck. */
  coatColour(p) {
    const c = this._coat ?? (this._coat = new THREE.Color());
    c.setHex(p.colour);
    // Struck: a flash of red, the same as a hunted animal.
    if (p.hurt > 0) c.lerp(HURT_RED, 0.7);
    // Struck by an upgraded sword (playtest, P6): frost blue, a burning
    // flicker, or the crackle of a stun.
    if (p.frozen > 0) c.lerp(FROST, 0.65);
    if (p.burning > 0) c.lerp(EMBER, 0.35 + 0.3 * Math.abs(Math.sin(performance.now() / 90)));
    if (p.stunned > 0 && Math.sin(performance.now() / 45) > 0.2) c.lerp(SPARK, 0.75);
    return c;
  }

  /** The settler nearest a look ray, for naming whoever you point at. */
  pick(people, origin, direction, maxDistance = 12) {
    return this.pickAt(people, origin, direction, maxDistance)?.person ?? null;
  }

  /** The same, with how far along the ray they are — for hitting one. */
  pickAt(people, origin, direction, maxDistance = 12) {
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
    return best ? { person: best, t: bestT } : null;
  }

  setVisible(on) {
    for (const m of this.meshes) m.visible = on;
  }

  dispose() {
    for (const m of this.meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}
