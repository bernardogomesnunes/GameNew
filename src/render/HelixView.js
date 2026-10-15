import * as THREE from 'three';
import { dress, poseBone } from './Models.js';

/**
 * The Helix, drawn (asked for directly: "Flying machine should for sure be
 * turned into a more helicopter form ... a diff flying machine called
 * helix"): a blocky helicopter — a red cabin you stand in with a glass
 * front and side windows, skids under it, a tail boom with its fin and
 * little rotor, and two long blades crossed on a mast over the roof.
 *
 * In its own frame the cabin floor is at y = 0 (where your feet are when
 * you fly it), its nose down -z, its tail down +z — the way you face is
 * -z, as with the glider. The rotors turn while it's flown and stand still
 * parked.
 */
const BODY = 0xc8402e, DARK = 0x2e3036, TRIM = 0xe8e2d4, GLASS = 0x9fd3ff;
/** How far below the cabin floor the skids reach: a parked one stands this high. */
export const HELIX_SKIDS = 0.9;

export class HelixView {
  constructor(scene) {
    const body = new THREE.MeshLambertMaterial({ color: BODY });
    const dark = new THREE.MeshLambertMaterial({ color: DARK });
    const trim = new THREE.MeshLambertMaterial({ color: TRIM });
    const glass = new THREE.MeshLambertMaterial({ color: GLASS, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
    this.mats = [body, dark, trim, glass];
    const g = new THREE.Group();
    const box = (w, h, d, x, y, z, m, parent = g) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y + h / 2, z);
      parent.add(mesh);
      return mesh;
    };
    // The skids, and the struts up to the floor.
    for (const x of [-0.85, 0.85]) {
      box(0.12, 0.1, 2.6, x, -HELIX_SKIDS, 0, dark);
      for (const z of [-0.7, 0.7]) box(0.1, HELIX_SKIDS - 0.25, 0.1, x, -HELIX_SKIDS + 0.1, z, dark);
    }
    // The cabin: floor, a back wall, sides to the waist with a window band
    // over them, a roof above your head, and a glass nose.
    // The roof stands well over your head (eyes at about 1.6), so from
    // inside you look out through the glass, not at the ceiling.
    const R = 2.4;
    box(1.8, 0.25, 2.2, 0, -0.25, 0, body);
    box(1.8, R + 0.25, 0.14, 0, -0.25, 1.05, body);
    for (const x of [-0.86, 0.86]) {
      box(0.1, 0.9, 2.2, x, 0, 0, body);
      box(0.1, 0.12, 2.2, x, 0.9, 0, trim);
      box(0.06, R - 1.02, 1.9, x, 1.02, -0.1, glass);
      box(0.12, R - 1.02, 0.12, x, 1.02, -1.05, body);
    }
    box(1.8, 0.5, 0.14, 0, 0, -1.1, body);
    box(1.6, R - 0.5, 0.06, 0, 0.5, -1.12, glass);
    box(1.9, 0.18, 2.4, 0, R, 0, body);
    box(1.2, 0.14, 1.6, 0, R + 0.18, 0.1, trim);
    // The tail boom out the back, stepped thinner, its fin and tail rotor.
    box(0.5, 0.5, 1.6, 0, 1.3, 1.9, body);
    box(0.32, 0.32, 2.0, 0, 1.4, 3.6, body);
    box(0.1, 0.9, 0.5, 0, 1.5, 4.45, body);
    box(0.7, 0.08, 0.4, 0, 1.55, 4.4, trim);
    this.tailRotor = new THREE.Group();
    this.tailRotor.position.set(0.12, 1.85, 4.45);
    box(0.04, 1.1, 0.14, 0, -0.55, 0, dark, this.tailRotor);
    box(0.04, 0.14, 1.1, 0, -0.07, 0, dark, this.tailRotor);
    g.add(this.tailRotor);
    // The mast and the main rotor: two long blades crossed, a cap on the hub.
    box(0.2, 0.4, 0.2, 0, R + 0.32, 0.1, dark);
    this.rotor = new THREE.Group();
    this.rotor.position.set(0, R + 0.74, 0.1);
    box(7.2, 0.06, 0.32, 0, 0, 0, dark, this.rotor);
    box(0.32, 0.06, 7.2, 0, 0, 0, dark, this.rotor);
    box(0.36, 0.14, 0.36, 0, 0.04, 0, trim, this.rotor);
    g.add(this.rotor);
    this.group = g;
    this.group.visible = false;
    scene.add(this.group);
    this.spin = 0;
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => o.geometry?.dispose());
    for (const m of this.mats) m.dispose();
  }

  /**
   * `pose` { position, yaw } — the cabin floor's middle and the way it
   * faces; `mode` 'fly' (rotors turning), 'parked' (still) or null (hidden).
   */
  update(pose, mode, dt) {
    this.group.visible = !!mode;
    if (!mode || !pose) return;
    const p = pose.position;
    this.group.position.set(p.x, p.y, p.z);
    this.group.rotation.set(0, pose.yaw ?? 0, 0);
    // Up to speed in a second or so when flown, winding down when not.
    const want = mode === 'fly' ? 22 : 0;
    this.spin += (want - this.spin) * Math.min(1, dt * 1.5);
    this.rotor.rotation.y += this.spin * dt;
    this.tailRotor.rotation.x += this.spin * 1.6 * dt;
    // Its model (render/Models.js), once loaded: nose down -z like this one,
    // scaled to the cabin you stand in, its skids on the ground.
    const model = dress(this.group, 'helix', { turn: 0, scale: 1.8, y: -HELIX_SKIDS });
    if (model) {
      poseBone(model.bones.rotor, 0, this.rotor.rotation.y, 0);
      poseBone(model.bones.tail_rotor, this.tailRotor.rotation.x, 0, 0);
    }
  }
}
