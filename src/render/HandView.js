import * as THREE from 'three';
import { lookColours } from '../config/avatar.js';
import { heldGeometryFor, heldCubeFor } from './heldModel.js';
import { ITEMS_BY_ID } from '../config/items.js';

/**
 * What you hold, in first person (playtest, P7): drawn in your right hand
 * at the bottom right of the screen — a sword, a tool, the bucket, a fruit,
 * the block you're about to place — or your bare fist when there's nothing.
 * It bobs as you walk, and swings when you strike or place.
 *
 * It hangs off the camera, so it goes wherever you look.
 */

/** How far a held tool leans away from you, in radians — as your avatar holds one. */
const HOLD_TIP = -0.6;
/**
 * And how far it's turned in towards the middle of the screen: straight
 * ahead, a blade seen from behind its own haft is edge on and all but
 * hidden — a stick. A little turn shows its face and still points it ahead.
 */
const HOLD_TURN = 0.4;
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
    // Turned first, then tipped: the quarter-turn about the haft puts the
    // blade ahead of you, and the tip leans the whole thing away from you.
    this.item.rotation.order = 'XYZ';
    this.group.add(this.item);
    // A plain block, textured like its icon (heldCubeFor) — the item mesh's
    // boxes can only be flat colours.
    this.cube = new THREE.Mesh(new THREE.BufferGeometry(), []);
    this.cube.rotation.order = 'XYZ';
    this.cube.visible = false;
    this.group.add(this.cube);
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

  /**
   * `draw` (0..1) is how far a bow is drawn: it comes up in front of you and
   * in towards the middle, upright, with an arrow on the string pulled back
   * as far as you've drawn it.
   */
  update(dt, player, { held = {}, look, visible, draw = 0 }) {
    this.group.visible = visible;
    if (!visible) return;
    const key = held.itemId ?? held.blockId ?? null;
    if (key !== this.key) {
      this.key = key;
      const cube = heldCubeFor(held);
      const geo = cube ? null : heldGeometryFor(held);
      this.item.visible = !!geo;
      this.cube.visible = !!cube;
      this.fist.visible = !geo && !cube;
      if (geo) this.item.geometry = geo;
      if (cube) { this.cube.geometry = cube.geometry; this.cube.material = cube.materials; }
      // A tool or a sword is held the way your avatar holds it in third
      // person (asked for directly: "the blade should be pointing front
      // like in the third person, not facing right"): the handle in your
      // fist, the head up and leaning away from you, and its blade (always
      // -x, see heldModel.js) turned a quarter round to face ahead, into
      // the screen. Anything else — a block, food, a bucket — sits upright.
      const pointing = ITEMS_BY_ID.get(held.itemId)?.kind === 'tool' && held.itemId !== 'bucket' && held.itemId !== 'bucket_water';
      if (pointing) this.item.rotation.set(HOLD_TIP, -Math.PI / 2 + HOLD_TURN, 0);
      else this.item.rotation.set(0.1, 0.35, 0.15);
      // A block sits smaller in the hand than a sword is long.
      this.item.scale.setScalar(pointing ? 0.34 : held.itemId ? 0.24 : 0.18);
      this.cube.rotation.copy(this.item.rotation);
      this.cube.scale.setScalar(0.18);
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
    // Drawn, the bow comes up and in, steadier the further it's pulled.
    const pull = Math.max(0, Math.min(1, draw));
    const settle = 1 - pull * 0.7;
    this.group.position.set(
      halfW * (0.62 - 0.4 * pull) + Math.sin(this.phase) * 0.025 * bob * settle,
      -halfH * (0.62 - 0.3 * pull) - Math.abs(Math.cos(this.phase)) * 0.03 * bob * settle - chop * 0.08,
      -REACH + chop * 0.06 + pull * 0.08,
    );
    this.group.rotation.set(-chop * 0.9, chop * 0.25, pull * 0.25);
    // The arrow on the string, its tail coming back towards you as you draw.
    if (!this.nocked) {
      this.nocked = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.42), new THREE.MeshLambertMaterial({ color: 0x9a7a52 }));
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.05), new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
      tip.position.z = -0.23;
      const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.04, 0.08), new THREE.MeshLambertMaterial({ color: 0xe6e0d2 }));
      fletch.position.z = 0.18;
      this.nocked.add(shaft, tip, fletch);
      this.group.add(this.nocked);
    }
    this.nocked.visible = pull > 0;
    if (pull > 0) this.nocked.position.set(-0.02, 0.06, 0.02 + pull * 0.14);
  }
}
