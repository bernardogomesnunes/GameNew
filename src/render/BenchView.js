import * as THREE from 'three';
import { heldBoxes, heldGeometry } from './heldModel.js';

/**
 * The bench close-up (duilt/BenchWork.js): the machine's block in the world,
 * the camera over it, what goes in standing on its top and what comes out
 * beside it, and the machine's tool moving as you hold the action. A handful
 * of meshes, made at start or when the recipe changes; nothing per frame.
 */
const CAMERA_UP = 1.7, CAMERA_BACK = 1.5;
/** What goes in is drawn this size on the top, small enough to see the tool work on it. */
const INPUT_SIZE = 0.3;
const STEEL = 0xb9bec6, HANDLE = 0x6b4a2e, IRON = 0x4a4340, WATER = 0xcfe8f2;

export class BenchView {
  constructor({ scene, camera }) {
    this.scene = scene;
    this.camera = camera;
    this.group = null;
    this.level = 0;
    this.holding = false;
    this.flash = 0;
  }

  get active() { return this.group != null; }

  start(at, machine) {
    this.end();
    this.machine = machine;
    this.top = new THREE.Vector3(at.x + 0.5, at.y + 1, at.z + 0.5);
    this.group = new THREE.Group();
    this.group.position.copy(this.top);
    this.tool = this.makeTool(machine.tool);
    this.group.add(this.tool);
    this.scene.add(this.group);
  }

  end() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => { if (o.isMesh) { if (!o.userData.shared) o.geometry.dispose(); o.material.dispose(); } });
    }
    this.group = this.input = this.output = this.tool = null;
    this.level = 0;
    this.holding = false;
  }

  /** What goes in (left) and what comes out (right), for `recipe`. */
  show(recipe) {
    if (!this.group) return;
    for (const m of [this.input, this.output]) if (m) { this.group.remove(m); m.material.dispose(); }
    const first = recipe ? Object.keys(recipe.inputs)[0] : null;
    this.input = first ? this.item(first, -0.2, INPUT_SIZE) : null;
    this.output = recipe ? this.item(recipe.output.id, 0.3, 0.26) : null;
    if (this.output) this.output.visible = false;
  }

  item(id, x, size) {
    const geo = heldGeometry(`i:${id}`, heldBoxes({ itemId: id }));
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.userData.shared = true;
    m.scale.setScalar(size);
    m.position.set(x, 0, 0.05);
    this.group.add(m);
    return m;
  }

  /** The machine's tool, as a few boxes: a saw, a plane, a hammer, a wheel or a ladle of water. */
  makeTool(kind) {
    const g = new THREE.Group();
    const box = (w, h, d, color, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    if (kind === 'saw') { box(0.5, 0.14, 0.02, STEEL, 0, 0.07, 0); box(0.14, 0.12, 0.05, HANDLE, 0.31, 0.08, 0); }
    else if (kind === 'plane') { box(0.3, 0.08, 0.14, HANDLE, 0, 0.04, 0); box(0.08, 0.1, 0.06, HANDLE, 0.08, 0.13, 0); box(0.02, 0.03, 0.12, STEEL, -0.06, 0.01, 0); }
    else if (kind === 'hammer') { box(0.05, 0.4, 0.05, HANDLE, 0, 0.2, 0); box(0.2, 0.09, 0.09, IRON, 0, 0.42, 0); }
    else if (kind === 'wheel') { box(0.42, 0.42, 0.06, 0x9a8a78, 0, 0.26, -0.22); box(0.08, 0.08, 0.1, IRON, 0, 0.26, -0.18); }
    else { box(0.22, 0.14, 0.22, 0x8a6a4a, 0, 0.07, 0); box(0.18, 0.02, 0.18, WATER, 0, 0.13, 0); }
    g.position.set(-0.18, 0.18, 0.05);
    return g;
  }

  /** A batch was made: the result shows for a moment. */
  made() { this.flash = 0.9; }

  update(dt) {
    if (!this.group) return;
    this.camera.position.set(this.top.x, this.top.y + CAMERA_UP, this.top.z + CAMERA_BACK);
    this.camera.lookAt(this.top);
    if (this.holding) this.level = Math.min(1.25, this.level + dt / this.machine.seconds);
    const t = this.level * Math.PI * 6, k = this.tool.position, kind = this.machine.tool;
    // Each tool works at the speed of the gauge: the more you hold, the further the work goes.
    if (kind === 'saw' || kind === 'plane') k.x = -0.18 + Math.sin(t) * 0.16;
    else if (kind === 'hammer') this.tool.rotation.z = this.holding ? Math.max(0, Math.sin(t)) * 0.9 : 0;
    else if (kind === 'wheel') this.tool.rotation.z = -t;
    else k.y = 0.18 + (this.holding ? Math.abs(Math.sin(t)) * -0.12 : 0);
    if (this.input) this.input.scale.setScalar(INPUT_SIZE * (1 - Math.min(this.level, 1) * 0.35));
    this.flash = Math.max(0, this.flash - dt);
    if (this.output) this.output.visible = this.flash > 0;
  }
}
