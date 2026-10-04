import * as THREE from 'three';
import { SETTLERS } from '../config/settlers.js';
import { SKINS, HAIRS } from '../config/avatar.js';
import { outfitOf } from '../config/outfits.js';

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
/**
 * The small parts of a person (docs/plan-look-and-sound.md, section 5: "faces:
 * eyes and a mouth ... hands ... outfits that say who they are ... a weapon or
 * tool in hand"), all one instanced mesh, this many slots a person. A part
 * someone hasn't got is scaled to nothing.
 */
const SLOTS = 15;
const EYE_L = 0, EYE_R = 1, MOUTH = 2, HAND_L = 3, HAND_R = 4, BOOT_L = 5, BOOT_R = 6, BELT = 7,
  HAT = 8, HAT_EXTRA = 9, PLUME = 10, CAPE = 11, BEARD = 12, GEAR = 13, GEAR_2 = 14;
const EYE = 0x231c22, BOOT = 0x3a2a20, BELT_LEATHER = 0x2e2620, STEEL = 0xc9ced6, WOOD = 0x6b4a2e, GOLD = 0xe8c04f;
const NOTHING = new THREE.Matrix4().makeScale(0, 0, 0);
const HURT_RED = new THREE.Color(0xd23a2a);   // beds run out long before this; the cap is just for the buffer
const WINDUP_GLOW = new THREE.Color(0xfff6d8);
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
    // A soft shadow on the ground under each of them: what makes a figure
    // read as standing in the world rather than pasted over it.
    const shadowGeo = new THREE.CircleGeometry(width * 0.62, 14).rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), MAX);
    this.shadows.renderOrder = 1;
    this.parts = new THREE.InstancedMesh(box(1, 1, 1), mat(), MAX * SLOTS);
    this.meshes = [this.bodies, this.heads, this.hair, this.limbs, this.shadows, this.parts];
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
    this._size = new THREE.Vector3();
  }

  /** Redraws every settler where they now are. Called each frame. */
  update(people) {
    const n = Math.min(people.length, MAX);
    for (const m of this.meshes) m.count = m === this.limbs ? n * 4 : m === this.parts ? n * SLOTS : n;
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
      place(this.shadows, 0, 0.03, 0);
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
      // Arms: swinging as they walk; raised overhead winding up a heavy
      // blow (the Sky King's — Wanderers.fight), and brought down striking.
      const raised = p.windup > 0 && p.winding ? -2.7 : p.strike > 0 ? -1.6 * (p.strike / 0.3) : null;
      limb(2, -width * 0.64, legH + bodyH * 0.95, bodyH * 0.95, aw, raised ?? -swing * 0.8);
      limb(3, width * 0.64, legH + bodyH * 0.95, bodyH * 0.95, aw, raised ?? swing * 0.8);

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
      const hairHex = HAIRS[(who >> 3) % HAIRS.length];
      this._colour.setHex(p.helm ?? hairHex);
      this.hair.setColorAt(i, this._colour);

      this.dressUp(i, p, who, hairHex, { limbArm: [-width * 0.64, width * 0.64], limbLeg: [-width * 0.24, width * 0.24], swing, raised });
    }

    for (const m of this.meshes) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /**
   * The small parts: a face, hands and boots, a belt, and what they wear and
   * carry for who they are (config/outfits.js). Everything is placed in the
   * person's own frame — +z is the way they face — and the hands, boots and
   * what's in the hand follow the swing of the limb they're on.
   */
  dressUp(i, p, who, hairHex, { limbArm, limbLeg, swing, raised }) {
    const { legH, bodyH, headH, width } = this;
    const o = outfitOf(p) ?? {};
    const parts = this.parts, base = this._m, at = i * SLOTS;
    const headW = width * 0.72, hc = legH + bodyH + headH / 2, front = headW / 2;
    const skin = SKINS[who % SKINS.length];
    const put = (slot, x, y, z, sx, sy, sz, hex) => {
      this._pos.set(x, y, z).applyQuaternion(this._q);
      base.compose(this._pos.set(p.x + this._pos.x, p.y + this._pos.y, p.z + this._pos.z), this._q, this._size.set(sx, sy, sz));
      parts.setMatrixAt(at + slot, base);
      parts.setColorAt(at + slot, this._colour.setHex(hex));
    };
    // On a limb: from its joint, swung, then down it by dy and out by dz.
    const onLimb = (slot, x, top, angle, dy, dz, sx, sy, sz, hex) => {
      this._pos.set(x, top, 0).applyQuaternion(this._q);
      base.compose(this._pos.set(p.x + this._pos.x, p.y + this._pos.y, p.z + this._pos.z), this._q, this._scale);
      base.multiply(this._t.makeRotationX(angle));
      base.multiply(this._t.makeTranslation(0, dy, dz));
      base.multiply(this._t.makeScale(sx, sy, sz));
      parts.setMatrixAt(at + slot, base);
      parts.setColorAt(at + slot, this._colour.setHex(hex));
    };
    const none = (slot) => parts.setMatrixAt(at + slot, NOTHING);

    // The face: two eyes and a mouth on the front of the head.
    const eyeY = hc + headH * 0.04;
    put(EYE_L, -headW * 0.2, eyeY, front + 0.006, 0.07, 0.075, 0.02, EYE);
    put(EYE_R, headW * 0.2, eyeY, front + 0.006, 0.07, 0.075, 0.02, EYE);
    this._colour.setHex(skin).offsetHSL(0, 0.05, -0.22);
    put(MOUTH, 0, hc - headH * 0.24, front + 0.006, 0.13, 0.03, 0.02, this._colour.getHex());

    // Hands at the ends of the arms, boots at the ends of the legs.
    const armTop = legH + bodyH * 0.95, armLen = bodyH * 0.95, aw = width * 0.26, lw = width * 0.36;
    const armL = raised ?? -swing * 0.8, armR = raised ?? swing * 0.8;
    onLimb(HAND_L, limbArm[0], armTop, armL, -armLen - 0.03, 0, aw * 1.15, 0.1, aw * 1.15, skin);
    onLimb(HAND_R, limbArm[1], armTop, armR, -armLen - 0.03, 0, aw * 1.15, 0.1, aw * 1.15, skin);
    onLimb(BOOT_L, limbLeg[0], legH, swing, -legH + 0.06, 0.03, lw * 1.12, 0.12, lw * 1.4, BOOT);
    onLimb(BOOT_R, limbLeg[1], legH, -swing, -legH + 0.06, 0.03, lw * 1.12, 0.12, lw * 1.4, BOOT);
    put(BELT, 0, legH + bodyH * 0.12, 0, width * 1.04, 0.06, width * 0.66, o.hat === 'crown' ? GOLD : BELT_LEATHER);

    // What's on their head: a hat hides the hair under it.
    const hatHex = o.hatColour ?? p.helm ?? 0x6d6a73;
    const top = hc + headH / 2;
    if (o.hat) this.hair.setMatrixAt(i, NOTHING);
    if (o.hat === 'crown') {
      // A band, and its points standing up from it (two crossed bars, so
      // they show from every side).
      put(HAT, 0, top + headH * 0.08, 0, headW * 1.08, headH * 0.24, headW * 1.08, o.hatColour ?? GOLD);
      put(HAT_EXTRA, 0, top + headH * 0.3, 0, headW * 1.08, headH * 0.22, headW * 0.22, o.hatColour ?? GOLD);
      put(PLUME, 0, top + headH * 0.3, 0, headW * 0.22, headH * 0.22, headW * 1.08, o.hatColour ?? GOLD);
    } else if (o.hat === 'helm') {
      // Down over the eyes behind a visor, or up above them.
      const low = o.visor ? hc - headH * 0.22 : hc + headH * 0.14, high = top + headH * 0.1;
      put(HAT, 0, (low + high) / 2, 0, headW * 1.12, high - low, headW * 1.12, hatHex);
      if (o.visor) put(HAT_EXTRA, 0, eyeY, headW * 0.56 + 0.008, headW * 0.82, 0.05, 0.02, EYE);
      else put(HAT_EXTRA, 0, low + 0.02, headW * 0.5, headW * 0.9, 0.04, headW * 0.14, hatHex);
    } else if (o.hat === 'hood') {
      // Over the head and behind it, the face showing in front.
      put(HAT, 0, hc + headH * 0.1, -headW * 0.1, headW * 1.26, headH * 1.2, headW * 1.06, hatHex);
      put(HAT_EXTRA, 0, legH + bodyH * 0.9, -width * 0.05, width * 1.1, bodyH * 0.22, width * 0.72, hatHex);
    } else if (o.hat === 'cap') {
      put(HAT, 0, top + headH * 0.02, 0, headW * 1.06, headH * 0.24, headW * 1.06, hatHex);
      put(HAT_EXTRA, 0, top - headH * 0.06, front + headW * 0.12, headW * 0.9, 0.03, headW * 0.3, hatHex);
    } else { none(HAT); none(HAT_EXTRA); }
    if (o.plume) put(PLUME, 0, top + headH * 0.42, -headW * 0.05, 0.07, headH * 0.6, headW * 0.7, o.plume);
    else if (o.hat !== 'crown') none(PLUME);

    // A cape down the back.
    if (o.cape) {
      const capeH = bodyH + legH * 0.75;
      put(CAPE, 0, legH + bodyH - capeH / 2, -width * 0.34 - 0.025, width * 0.96, capeH, 0.04, o.cape);
    } else none(CAPE);

    // A beard: theirs always, or one man in four among everybody else.
    const beard = o.beard ?? (!o.hat && ((who >> 5) % 4 === 0) ? hairHex : null);
    if (beard != null) put(BEARD, 0, hc - headH * 0.32, front + 0.015, headW * 0.82, headH * 0.4, 0.06, beard);
    else none(BEARD);

    // What's in the right hand, swinging with the arm.
    const hand = -armLen - 0.03;
    if (o.gear === 'sword') {
      onLimb(GEAR, limbArm[1], armTop, armR, hand, 0.34, 0.045, 0.09, 0.62, o.gearColour ?? STEEL);
      onLimb(GEAR_2, limbArm[1], armTop, armR, hand, 0.04, 0.2, 0.05, 0.05, o.gearColour ?? GOLD);
    } else if (o.gear === 'spear') {
      onLimb(GEAR, limbArm[1], armTop, armR, hand + 0.45, 0, 0.045, 1.7, 0.045, WOOD);
      onLimb(GEAR_2, limbArm[1], armTop, armR, hand + 1.36, 0, 0.09, 0.2, 0.09, o.gearColour ?? STEEL);
    } else if (o.gear === 'staff') {
      onLimb(GEAR, limbArm[1], armTop, armR, hand + 0.4, 0, 0.06, 1.55, 0.06, WOOD);
      onLimb(GEAR_2, limbArm[1], armTop, armR, hand + 1.2, 0, 0.11, 0.11, 0.11, 0x8a6a48);
    } else if (o.gear === 'bow') {
      onLimb(GEAR, limbArm[1], armTop, armR, hand, 0.06, 0.05, 0.95, 0.06, 0x7a5232);
      onLimb(GEAR_2, limbArm[1], armTop, armR, hand, -0.05, 0.012, 0.88, 0.012, 0xe8e2d0);
    } else { none(GEAR); none(GEAR_2); }
  }

  /** A person's coat colour this frame: their own, flashing when struck. */
  coatColour(p) {
    const c = this._coat ?? (this._coat = new THREE.Color());
    c.setHex(p.colour);
    // Struck: a flash of red, the same as a hunted animal.
    if (p.hurt > 0) c.lerp(HURT_RED, 0.7);
    // Winding up a heavy blow: a white glow builds, so you see it coming.
    if (p.windup > 0 && p.winding) c.lerp(WINDUP_GLOW, 0.5);
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
