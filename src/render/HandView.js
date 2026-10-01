import * as THREE from 'three';
import { lookColours } from '../config/avatar.js';
import { heldGeometryFor } from './heldModel.js';

/**
 * What you hold, in first person (playtest, P7): drawn in your right hand
 * at the bottom right of the screen — a sword, a tool, the bucket, a fruit,
 * the block you're about to place — or your bare fist when there's nothing.
 * It bobs as you walk, and swings when you strike or place.
 *
 * It hangs off the camera, so it goes wherever you look.
 */

/** How far in front of the eye the hand is held. */
const REACH = 0.62;

export class HandView {
  constructor(scene, camera) {
    if (!camera.parent) scene.add(camera);
    this.camera = camera;
    this.group = new THREE.Group();
    camera.add(this.group);
    this.item = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.item.scale.setScalar(0.3);
    this.item.rotation.set(0.15, -0.6, 0.2);
    this.group.add(this.item);
    this.fistMat = new THREE.MeshLambertMaterial({ color: 0xe0b48e });
    this.fist = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.34), this.fistMat);
    this.fist.position.set(0.04, -0.04, 0.08);
    this.fist.rotation.set(0.25, -0.15, 0);
    this.group.add(this.fist);
    this.phase = 0;
    this.swing = 0;
    this.key = undefined;
  }

  /** Strike or place: a quick chop down and back. */
  strike() {
    this.swing = 1;
  }

  update(dt, player, { held = {}, look, visible }) {
    this.group.visible = visible;
    if (!visible) return;
    const key = held.itemId ?? held.blockId ?? null;
    if (key !== this.key) {
      this.key = key;
      const geo = heldGeometryFor(held);
      this.item.visible = !!geo;
      this.fist.visible = !geo;
      if (geo) this.item.geometry = geo;
      // A block sits smaller in the hand than a sword is long.
      this.item.scale.setScalar(held.itemId ? 0.24 : 0.18);
    }
    this.fistMat.color.setHex(lookColours(look).skin);

    // Bob with your stride, side to side and up and down.
    const v = player.velocity ?? { x: 0, z: 0 };
    const speed = player.flying ? 0 : Math.hypot(v.x, v.z);
    this.phase += dt * speed * 1.9;
    const bob = Math.min(1, speed / 4.3);
    this.swing = Math.max(0, this.swing - dt * 5);
    const chop = Math.sin(this.swing * Math.PI);
    // Low and to the right of the middle — worked out from what the
    // camera can see, so a tall phone screen doesn't push it out of sight.
    const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * REACH;
    const halfW = halfH * this.camera.aspect;
    this.group.position.set(
      halfW * 0.62 + Math.sin(this.phase) * 0.025 * bob,
      -halfH * 0.62 - Math.abs(Math.cos(this.phase)) * 0.03 * bob - chop * 0.08,
      -REACH + chop * 0.06,
    );
    this.group.rotation.set(-chop * 0.9, chop * 0.25, 0);
  }
}
