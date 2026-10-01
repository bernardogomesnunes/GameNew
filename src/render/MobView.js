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
/** The most details any one animal has. */
const DETAIL_CAP = 9;
const EYE = 0x1e1a1c, HORN = 0xd8cdb4, PINK = 0xe79a96;

/**
 * What each animal has besides a body, a head and legs: [x, y, z, sx, sy,
 * sz, colour, tilt, onHead]. On the head, positions are from its middle
 * (+z its front); on the body, from the body's middle (+z the front, -z the
 * tail end). Sizes are in the head's (or body's) own units — see featuresOf.
 */
const FEATURES = {
  deer: (s) => [ears(s, 0.3, 0.45), antler(s, -1), antler(s, 1), tail(s, 0.12, 0.2, 0xf2ede4), snout(s, 0.45, 0.35, s.headColour)],
  rabbit: (s) => [[-0.18, 0.6, -0.05, 0.14, 0.8, 0.1, s.headColour, -0.2, true], [0.18, 0.6, -0.05, 0.14, 0.8, 0.1, s.headColour, -0.2, true], tail(s, 0.3, 0.3, 0xffffff), snout(s, 0.4, 0.3, PINK)],
  boar: (s) => [ears(s, 0.25, 0.25), snout(s, 0.55, 0.45, 0x4a3a30), tusk(s, -1), tusk(s, 1), tail(s, 0.08, 0.35, s.colour)],
  goat: (s) => [horn(s, -1), horn(s, 1), [0, -0.55, 0.35, 0.18, 0.35, 0.12, 0xcfc8ba, 0, true], ears(s, 0.3, 0.2), tail(s, 0.1, 0.18, s.colour)],
  sheep: (s) => [[-0.55, 0.15, 0, 0.3, 0.14, 0.18, s.headColour, 0, true], [0.55, 0.15, 0, 0.3, 0.14, 0.18, s.headColour, 0, true], tail(s, 0.14, 0.2, s.colour)],
  cow: (s) => [horn(s, -1, 0.5), horn(s, 1, 0.5), ears(s, 0.25, 0.2), snout(s, 0.6, 0.4, PINK), tail(s, 0.06, 0.7, s.colour), [0, -0.25, -0.5, 0.12, 0.18, 0.12, 0x3a2a20, 0, false]],
  pig: (s) => [ears(s, 0.3, 0.22), snout(s, 0.5, 0.4, 0xd88a84), tail(s, 0.1, 0.16, s.colour)],
  chicken: (s) => [[0, -0.05, 0.6, 0.3, 0.2, 0.35, 0xe0a64a, 0, true], [0, 0.6, 0.05, 0.12, 0.3, 0.45, 0xd23a2a, 0, true], [0, -0.35, 0.45, 0.12, 0.25, 0.12, 0xd23a2a, 0, true], [0, 0.35, -0.55, 0.6, 0.7, 0.35, s.colour, -0.5, false]],
};
const ears = (s, size, up) => [[-0.42, up, -0.1, size, size, 0.1, s.headColour], [0.42, up, -0.1, size, size, 0.1, s.headColour]].map((e) => [...e, 0, true]);
const antler = (s, side) => [side * 0.28, 0.85, -0.1, 0.08, 0.9, 0.08, 0x8a6a4a, -0.35, true];
const horn = (s, side, len = 0.7) => [side * 0.25, 0.6, -0.15, 0.12, len, 0.12, HORN, -0.7, true];
const tusk = (s, side) => [side * 0.22, -0.2, 0.75, 0.08, 0.22, 0.08, 0xf2ede4, 0.3, true];
const snout = (s, w, h, colour) => [0, -0.15, 0.55, w, h, 0.25, colour, 0, true];
const tail = (s, w, len, colour) => [0, 0.25, -0.5, w, len, w, colour, -0.6, false];

/** An animal's details, scaled to it: on the head in head units, on the body in body units. */
function featuresOf(spec, m) {
  const list = (FEATURES[spec.id] ?? (() => []))(spec);
  const hd = spec.head, { w, h, l } = spec.body;
  const out = [];
  // Eyes, on every one: either side of the head, towards the front.
  for (const side of [-1, 1]) out.push([side * hd * 0.51, hd * 0.12, hd * 0.22, hd * 0.06, hd * 0.12, hd * 0.12, EYE, 0, true]);
  for (const [x, y, z, sx, sy, sz, colour, tilt, onHead] of list) {
    out.push(onHead
      ? [x * hd, y * hd, z * hd, sx * hd, sy * hd, sz * hd, colour, tilt, true]
      : [x * w, y * h, z * l, sx * w, sy * h, sz * l, colour, tilt, false]);
  }
  return out;
}
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
    // The rest of each animal (playtest, P3: "All mobs need remodelling for
    // more detailed visuals"): eyes, a snout or beak, ears, horns or antlers,
    // a tail — see FEATURES. One more instanced mesh for all of it.
    this.details = new THREE.InstancedMesh(cube, mat, MAX * DETAIL_CAP);
    for (const m of [this.bodies, this.heads, this.legs, this.details]) {
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
    let d = 0;
    if (!n) { this.details.count = 0; return; }

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

      // The details, each placed off the head (h: true) or the body.
      for (const [x, y, z, sx, sy, sz, colour, tilt, onHead] of featuresOf(spec, m)) {
        if (d >= MAX * DETAIL_CAP) break;
        const oy = onHead ? hy : leg + h / 2, oz = onHead ? hz : 0;
        this._part.makeTranslation(x, oy + y, oz + z);
        if (tilt) this._part.multiply(this._tmp.makeRotationX(tilt));
        this._part.multiply(this._tmp.makeScale(sx, sy, sz));
        this._part.premultiply(this._base);
        this.details.setMatrixAt(d, this._part);
        this.details.setColorAt(d, this.tint(colour, flash));
        d++;
      }

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
    this.details.count = d;
    for (const m of [this.bodies, this.heads, this.legs, this.details]) {
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
    for (const m of [this.bodies, this.heads, this.legs, this.details]) m.visible = on;
  }
}
