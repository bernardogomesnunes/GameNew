import * as THREE from 'three';
import { lookColours } from '../config/avatar.js';
import { ITEMS_BY_ID } from '../config/items.js';
import { heldGeometryFor } from './heldModel.js';

/**
 * You, drawn (playtest, P3 and P7): seen only from the third-person views.
 * A head with hair and a face, a body, two arms and two legs, each swinging
 * on its joint as you walk; whatever armour you wear over the top of them,
 * in its own colours; and in your right hand, whatever you're holding.
 *
 * Six boxes and a few overlays — one person, a handful of draw calls.
 */

const box = (w, h, d, y = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, y, 0);
  return g;
};

export class AvatarView {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    const mat = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mats = { skin: mat(), hair: mat(), shirt: mat(), trousers: mat(), eyes: new THREE.MeshLambertMaterial({ color: 0x2a2a30 }) };
    this.armourMats = { head: mat(), body: mat(), legs: mat(), feet: mat() };

    const part = (geo, m, parent = this.group) => { const mesh = new THREE.Mesh(geo, m); parent.add(mesh); return mesh; };
    // Legs, pivoting at the hip.
    this.legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.13, 0.78, 0);
      this.group.add(hip);
      part(box(0.24, 0.78, 0.26, -0.39), this.mats.trousers, hip);
      const greave = part(box(0.27, 0.5, 0.29, -0.3), this.armourMats.legs, hip);
      const boot = part(box(0.27, 0.22, 0.31, -0.67), this.armourMats.feet, hip);
      return { hip, greave, boot };
    });
    // Body.
    part(box(0.56, 0.62, 0.3, 1.09), this.mats.shirt);
    this.cuirass = part(box(0.6, 0.58, 0.34, 1.1), this.armourMats.body);
    // Arms, pivoting at the shoulder; the right one holds things.
    this.arms = [-1, 1].map((side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.39, 1.36, 0);
      this.group.add(shoulder);
      part(box(0.2, 0.44, 0.22, -0.2), this.mats.shirt, shoulder);
      part(box(0.18, 0.2, 0.2, -0.52), this.mats.skin, shoulder);
      return shoulder;
    });
    this.hand = new THREE.Group();
    this.hand.position.set(0, -0.6, -0.1);
    this.hand.rotation.set(-Math.PI / 2, 0, 0);
    this.arms[1].add(this.hand);
    this.held = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.held.scale.setScalar(0.42);
    this.hand.add(this.held);
    // Head: face forward is -z, the way the camera looks at yaw 0.
    this.head = new THREE.Group();
    this.head.position.set(0, 1.4, 0);
    this.group.add(this.head);
    part(box(0.42, 0.42, 0.42, 0.21), this.mats.skin, this.head);
    part(box(0.44, 0.12, 0.44, 0.38), this.mats.hair, this.head);
    part(box(0.44, 0.3, 0.08, 0.27).translate(0, 0, 0.19), this.mats.hair, this.head);
    for (const side of [-1, 1]) part(box(0.07, 0.07, 0.02, 0.24).translate(side * 0.1, 0, -0.215), this.mats.eyes, this.head);
    this.helm = part(box(0.48, 0.22, 0.48, 0.38), this.armourMats.head, this.head);

    this.phase = 0;
    this.swing = 0;
    this.heldKey = null;
  }

  /** Strike or place: the right arm swings. */
  strike() {
    this.swing = 1;
  }

  /**
   * Brings the figure in line with the player: where, which way, how its
   * limbs are swinging, what it's wearing and holding.
   */
  update(dt, player, { look, worn = {}, held = {}, visible }) {
    this.group.visible = visible;
    if (!visible) return;
    const p = player.position;
    this.group.position.set(p.x, p.y, p.z);
    this.group.rotation.y = player.yaw;
    this.head.rotation.x = player.pitch * 0.6;

    const c = lookColours(look);
    this.mats.skin.color.setHex(c.skin);
    this.mats.hair.color.setHex(c.hair);
    this.mats.shirt.color.setHex(c.shirt);
    this.mats.trousers.color.setHex(c.trousers);

    // Armour over the top, in each piece's colour.
    const piece = (slot) => ITEMS_BY_ID.get(worn[slot]?.id);
    const show = (mesh, slot) => {
      const spec = piece(slot);
      mesh.visible = !!spec;
      if (spec) this.armourMats[slot].color.setHex(spec.color);
    };
    show(this.helm, 'head');
    show(this.cuirass, 'body');
    for (const leg of this.legs) { show(leg.greave, 'legs'); show(leg.boot, 'feet'); }

    // Walking: legs and arms swing opposite, as far as you're going fast.
    const v = player.velocity ?? { x: 0, z: 0 };
    const speed = Math.hypot(v.x, v.z);
    const stride = Math.min(1, speed / 4.3);
    this.phase += dt * (2 + speed * 1.6);
    const s = Math.sin(this.phase) * 0.7 * stride;
    this.legs[0].hip.rotation.x = s;
    this.legs[1].hip.rotation.x = -s;
    this.arms[0].rotation.x = -s * 0.8;
    // The right arm: a swing on a strike, else the walk, raised a little to hold.
    this.swing = Math.max(0, this.swing - dt * 4);
    const holding = !!(held.itemId || held.blockId != null);
    this.arms[1].rotation.x = s * 0.8 * (holding ? 0.4 : 1) + (holding ? 0.35 : 0) + Math.sin(this.swing * Math.PI) * 1.4;

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
