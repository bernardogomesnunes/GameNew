import * as THREE from 'three';
import { lookColours } from '../config/avatar.js';
import { ITEMS_BY_ID } from '../config/items.js';
import { heldGeometryFor } from './heldModel.js';

/**
 * You, drawn (playtest, P3 and P7): seen only from the third-person views.
 * A head with hair and a face, a body, two arms and two legs a little apart,
 * each swinging on its joint; whatever armour you wear over the top of them,
 * in its own colours; in your right hand, whatever you're holding, and on
 * your left arm a shield.
 *
 * The body, arms and head hang from the hips (`torso`), so it can lean into a
 * run, turn into a blow, and bend to sneak while the legs stay under it.
 * It moves the way everyone else does (render/personPose.js): a walk and a
 * run, a jump and a fall, a swing, a bow drawn, a blow caught on the shield,
 * and standing still it breathes and shifts its weight.
 *
 * One person, a few dozen boxes.
 */

const box = (w, h, d, y = 0, z = 0, x = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
};

const HIP = 0.78, LEG = 0.78;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const toward = (from, to, k) => from + (to - from) * Math.min(1, k);

export class AvatarView {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    const mat = (color = 0xffffff) => new THREE.MeshLambertMaterial({ color });
    this.mats = {
      skin: mat(), skinShade: mat(), hair: mat(), shirt: mat(), shirtShade: mat(), trousers: mat(), shoes: mat(),
      eyes: mat(0x2a2a30), white: mat(0xf4f0e6), belt: mat(0x3a2a1c),
    };
    this.armourMats = { head: mat(), body: mat(), legs: mat(), feet: mat() };

    const part = (geo, m, parent = this.group) => { const mesh = new THREE.Mesh(geo, m); parent.add(mesh); return mesh; };
    // Legs, pivoting at the hip, a gap between them; shoes with a toe.
    this.legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.125, HIP, 0);
      this.group.add(hip);
      part(box(0.22, LEG, 0.25, -LEG / 2), this.mats.trousers, hip);
      part(box(0.235, 0.13, 0.31, -LEG + 0.065, -0.025), this.mats.shoes, hip);
      const greave = part(box(0.255, 0.5, 0.285, -0.3), this.armourMats.legs, hip);
      const boot = part(box(0.265, 0.22, 0.33, -0.67, -0.02), this.armourMats.feet, hip);
      return { hip, greave, boot };
    });
    // Everything above the hips.
    this.torso = new THREE.Group();
    this.torso.position.set(0, HIP, 0);
    this.group.add(this.torso);
    part(box(0.52, 0.62, 0.28, 0.31), this.mats.shirt, this.torso);
    part(box(0.54, 0.07, 0.3, 0.035), this.mats.belt, this.torso);
    part(box(0.2, 0.05, 0.3, 0.6), this.mats.shirtShade, this.torso);          // the collar
    this.cuirass = part(box(0.57, 0.58, 0.33, 0.33), this.armourMats.body, this.torso);
    // Arms, pivoting at the shoulder; the right one holds things.
    this.pauldrons = [];
    this.arms = [-1, 1].map((side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.36, 0.58, 0);
      this.torso.add(shoulder);
      part(box(0.18, 0.42, 0.2, -0.17), this.mats.shirt, shoulder);
      part(box(0.19, 0.05, 0.21, -0.37), this.mats.shirtShade, shoulder);      // the cuff
      part(box(0.16, 0.2, 0.18, -0.5), this.mats.skin, shoulder);
      this.pauldrons.push(part(box(0.24, 0.17, 0.26, 0), this.armourMats.body, shoulder));
      return shoulder;
    });
    this.hand = new THREE.Group();
    this.hand.position.set(0, -0.6, -0.1);
    // Held upright, tipped forward; turned so a blade (-x in the model, see
    // heldModel.js) faces ahead of you.
    this.hand.rotation.set(-0.7, 0, 0);
    this.arms[1].add(this.hand);
    this.held = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.held.scale.setScalar(0.42);
    this.held.rotation.y = -Math.PI / 2;
    this.hand.add(this.held);
    // The left hand (IMP-23): a shield strapped on the forearm, its face
    // forward and a little out, the way the Garrison's spear guards carry theirs.
    this.shield = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.shield.scale.setScalar(0.72);
    this.shield.position.set(-0.06, -0.78, -0.17);
    // Half a turn: the model's face is +z, the avatar faces -z.
    this.shield.rotation.set(-0.3, Math.PI - 0.12, 0);
    this.shield.visible = false;
    this.arms[0].add(this.shield);
    this.shieldKey = null;
    // Head: face forward is -z, the way the camera looks at yaw 0.
    this.head = new THREE.Group();
    this.head.position.set(0, 0.62, 0);
    this.torso.add(this.head);
    part(box(0.42, 0.42, 0.42, 0.21), this.mats.skin, this.head);
    part(box(0.44, 0.12, 0.44, 0.38), this.mats.hair, this.head);
    part(box(0.44, 0.3, 0.08, 0.27, 0.19), this.mats.hair, this.head);
    part(box(0.44, 0.05, 0.03, 0.305, -0.215), this.mats.hair, this.head);       // a fringe
    for (const side of [-1, 1]) {
      part(box(0.03, 0.16, 0.14, 0.24, 0.09, side * 0.215), this.mats.hair, this.head);            // down past the ear
      part(box(0.09, 0.07, 0.02, 0.24, -0.213, side * 0.105), this.mats.white, this.head);
      part(box(0.05, 0.07, 0.02, 0.24, -0.217, side * 0.09), this.mats.eyes, this.head);
      part(box(0.1, 0.025, 0.02, 0.292, -0.216, side * 0.105), this.mats.hair, this.head);         // a brow
    }
    part(box(0.05, 0.07, 0.035, 0.175, -0.222), this.mats.skinShade, this.head);  // the nose
    part(box(0.12, 0.025, 0.02, 0.1, -0.213), this.mats.skinShade, this.head);    // the mouth
    this.helm = part(box(0.48, 0.22, 0.48, 0.38), this.armourMats.head, this.head);
    part(box(0.06, 0.2, 0.03, 0.2, -0.245), this.armourMats.head, this.helm);     // its nose guard
    part(box(0.48, 0.16, 0.06, 0.2, 0.22), this.armourMats.head, this.helm);      // and the back of the neck

    this.phase = 0;
    this.swing = 0;
    this.blocked = 0;
    this.heldKey = null;
    this.clock = 0;
    this.air = 0;       // 0 on the ground .. 1 in the air
    this.stride = 0;
    this.crouch = 0;
    this.land = 0;      // a dip on coming down
    this._last = null;  // where a figure with no velocity of its own (a friend) was
  }

  /** Strike or place: the right arm swings. */
  strike() {
    this.swing = 1;
  }

  /** A blow caught on the shield: it's thrown up in front of you. */
  block() {
    this.blocked = 1;
  }

  /**
   * Brings the figure in line with the player: where, which way, how its
   * limbs are moving, what it's wearing and holding. `draw` (0..1) is how
   * far a bow is drawn.
   */
  update(dt, player, { look, worn = {}, held = {}, visible, draw = 0 }) {
    this.group.visible = visible;
    if (!visible) { this._last = null; return; }
    const p = player.position;
    this.group.position.set(p.x, p.y + (player.seatHeight || 0), p.z);
    this.group.rotation.y = player.yaw;

    const c = lookColours(look);
    const m = this.mats;
    m.skin.color.setHex(c.skin);
    m.skinShade.color.setHex(c.skin).multiplyScalar(0.72);
    m.hair.color.setHex(c.hair);
    m.shirt.color.setHex(c.shirt);
    m.shirtShade.color.setHex(c.shirt).multiplyScalar(0.78);
    m.trousers.color.setHex(c.trousers);
    m.shoes.color.setHex(c.trousers).multiplyScalar(0.5);

    // Armour over the top, in each piece's colour.
    const piece = (slot) => ITEMS_BY_ID.get(worn[slot]?.id);
    const show = (mesh, slot) => {
      const spec = piece(slot);
      mesh.visible = !!spec;
      if (spec) this.armourMats[slot].color.setHex(spec.color);
    };
    show(this.helm, 'head');
    show(this.cuirass, 'body');
    for (const pad of this.pauldrons) pad.visible = this.cuirass.visible;
    for (const leg of this.legs) { show(leg.greave, 'legs'); show(leg.boot, 'feet'); }

    // How fast: your own velocity, or for a friend, how far they've come.
    let vx = 0, vy = 0, vz = 0;
    if (player.velocity) { vx = player.velocity.x; vy = player.velocity.y ?? 0; vz = player.velocity.z; }
    else if (this._last && dt > 0) { vx = (p.x - this._last.x) / dt; vz = (p.z - this._last.z) / dt; }
    (this._last ??= { x: 0, z: 0 }).x = p.x; this._last.z = p.z;
    const speed = Math.hypot(vx, vz);
    const flying = !!player.flying, swimming = !!player.swimming;
    const airborne = !flying && !swimming && player.grounded === false;
    const k = dt * 10;
    const wasAir = this.air;
    this.air = toward(this.air, airborne || flying ? 1 : 0, k);
    if (wasAir > 0.6 && !airborne && !flying && this.land <= 0) this.land = 1;
    this.land = Math.max(0, this.land - dt * 5);
    this.crouch = toward(this.crouch, player.sneaking ? 1 : 0, k);
    this.stride = toward(this.stride, Math.min(1, speed / 4.3), k);
    const run = Math.min(1, Math.max(0, (speed - 4.6) / 2.5));
    this.clock += dt;
    this.phase += dt * (2 + speed * 1.6) * (swimming ? 0.7 : 1);
    const t = this.clock, stride = this.stride, still = 1 - stride, air = this.air, ground = 1 - air;
    const sin = Math.sin(this.phase);

    // Legs: a stride on the ground; split in a jump, trailing in flight, kicking in water.
    const reach = (0.7 + 0.25 * run) * stride * ground;
    let legL = sin * reach, legR = -legL;
    if (flying) { legL += -0.35 * air * Math.min(1, speed / 6); legR = legL - 0.1 * air; }
    else if (airborne || air > 0.01) { legL += 0.55 * air; legR += -0.3 * air; }
    if (swimming) { legL = Math.sin(this.phase * 2) * 0.45 - 0.2; legR = -Math.sin(this.phase * 2) * 0.45 - 0.2; }
    const crouch = this.crouch;
    this.legs[0].hip.rotation.x = legL + 0.35 * crouch;
    this.legs[1].hip.rotation.x = legR - 0.25 * crouch;
    // Straight legs lift the feet as they swing: the hips come down to meet
    // the ground, and dip again on landing.
    const dipLand = Math.sin(this.land * Math.PI) * 0.07;
    this.group.position.y -= LEG * (1 - Math.cos(sin * reach)) * 0.7 + 0.05 * crouch + dipLand;

    // The body: into a run, round with each step, breathing and shifting its weight at rest.
    const breath = Math.sin(t * 1.7), shift = Math.sin(t * 0.45) * 0.03 * still * ground;
    const swingK = this.swing > 0 ? 1 - this.swing : -1;      // 0..1 through a blow
    const pull = Math.max(0, Math.min(1, draw));
    const aim = ease(pull);
    this.blocked = Math.max(0, this.blocked - dt * 4);
    const jerk = Math.sin(this.blocked * Math.PI);
    let lean = -(0.04 + 0.13 * run) * stride * ground + breath * 0.012 * still - 0.4 * crouch;
    let twist = sin * 0.08 * stride * ground;
    if (flying) lean -= 0.5 * air * Math.min(1, speed / 6);
    if (swimming) lean -= 0.9 * Math.min(1, speed / 2);
    if (airborne) lean += Math.max(-0.12, Math.min(0.15, -vy * 0.02)) * air;
    if (swingK >= 0) {
      // Back and up, then through and round.
      const back = ease(swingK / 0.25), through = ease((swingK - 0.25) / 0.3), home = ease((swingK - 0.55) / 0.45);
      lean += swingK < 0.25 ? 0.1 * back : swingK < 0.55 ? 0.1 - 0.3 * through : -0.2 * (1 - home);
      twist += swingK < 0.25 ? -0.3 * back : swingK < 0.55 ? -0.3 + 0.65 * through : 0.35 * (1 - home);
    }
    twist += 0.5 * aim;                       // side on to draw a bow
    lean += 0.12 * jerk + dipLand * 1.5;
    this.torso.rotation.set(lean, twist, Math.cos(this.phase) * 0.02 * stride * ground + shift);
    // The head looks where you look, whatever the body is doing under it.
    this.head.rotation.set(player.pitch * 0.6 - lean * 0.8, -twist + Math.sin(t * 0.31) * 0.1 * still * ground * (1 - aim), -shift * 0.6);

    // Arms: against the legs; up in a jump, out in a fall, back in flight.
    const armSwing = Math.sin(this.phase - 0.25) * (0.55 + 0.35 * run) * stride * ground;
    const out = 0.05 + 0.03 * stride + 0.015 * breath * still + (airborne ? (vy > 0 ? 0.25 : 0.7) : 0) * air + 0.2 * dipLand * 10 * 0.3;
    let armL = -armSwing, armR = armSwing, outL = -out, outR = out;
    if (airborne) { const up = (vy > 0 ? 0.5 : 0.2) * air; armL += up; armR += up; }
    if (flying) { const backArm = -0.6 * air * Math.min(1, speed / 6); armL += backArm; armR += backArm; }
    if (swimming) { armL = 1.6 + Math.sin(this.phase) * 1.1; armR = 1.6 - Math.sin(this.phase) * 1.1; }
    const shielded = ITEMS_BY_ID.get(worn.offhand?.id)?.wears === 'offhand';
    // With a shield on, the left arm is held forward, the shield before you;
    // a blow caught on it throws it up.
    if (shielded) { armL = 0.3 - armSwing * 0.25 + 0.75 * jerk; outL = -0.02 + 0.25 * jerk; }
    const shieldId = shielded ? worn.offhand.id : null;
    if (shieldId !== this.shieldKey) {
      this.shieldKey = shieldId;
      const geo = shieldId ? heldGeometryFor({ itemId: shieldId }) : null;
      this.shield.visible = !!geo;
      if (geo) this.shield.geometry = geo;
    }
    // The right arm: a swing on a strike, else the walk, raised a little to hold.
    this.swing = Math.max(0, this.swing - dt * 3.2);
    const holding = !!(held.itemId || held.blockId != null);
    if (holding && !swimming) armR = armR * 0.4 + 0.35;
    if (swingK >= 0) {
      const back = ease(swingK / 0.25), through = ease((swingK - 0.25) / 0.3), home = ease((swingK - 0.55) / 0.45);
      const rest = armR, up = 2.2, down = 0.25;
      armR = swingK < 0.25 ? rest + (up - rest) * back : swingK < 0.55 ? up + (down - up) * through : down + (rest - down) * home;
    }
    if (aim > 0) {
      // The bow out ahead along where you look; the other hand back to the cheek.
      const level = 1.5 + player.pitch * 0.8;
      armR += (level - armR) * aim; outR += (0.5 * aim - outR) * aim;
      armL += (level - 0.08 - armL) * aim; outL += (0.5 + 0.45 + 0.55 * pull * pull - outL) * aim;
    }
    this.arms[0].rotation.set(armL, 0, outL);
    this.arms[1].rotation.set(armR, 0, outR);

    // What's in the hand.
    const key = held.itemId ?? held.blockId ?? null;
    if (key !== this.heldKey) {
      this.heldKey = key;
      const geo = heldGeometryFor(held);
      this.held.visible = !!geo;
      if (geo) this.held.geometry = geo;
    }
  }
}
