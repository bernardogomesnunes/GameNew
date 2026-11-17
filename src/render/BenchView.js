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
/** CRAFT-9 part 4: the stone on the Mason's Bench is drawn larger, so its chalk marks read on a phone. */
const CHISEL_INPUT_SIZE = 0.42;
const CHALK = 0xf4f1ea, GROOVE = 0x4a4642;

export class BenchView {
  constructor({ scene, camera }) {
    this.scene = scene;
    this.camera = camera;
    this.group = null;
    this.level = 0;
    this.holding = false;
    this.flash = 0;
    this.marks = [];
    this.tapsDone = 0;
    this.strike = 0;
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
    this.marks = [];
    this.tapsDone = 0;
    this.strike = 0;
    this.level = 0;
    this.holding = false;
  }

  /** What goes in (left) and what comes out (right), for `recipe`. */
  show(recipe) {
    if (!this.group) return;
    for (const m of [this.input, this.output]) if (m) { this.group.remove(m); m.material.dispose(); }
    const first = recipe ? Object.keys(recipe.inputs)[0] : null;
    const taps = this.machine?.taps ?? 0;
    this.input = first ? this.item(first, taps ? -0.12 : -0.2, taps ? CHISEL_INPUT_SIZE : INPUT_SIZE) : null;
    this.output = recipe ? this.item(recipe.output.id, taps ? 0.36 : 0.3, 0.26) : null;
    if (this.output) this.output.visible = false;
    this.chalk(this.input ? taps : 0);
  }

  /**
   * CRAFT-9 part 4: `n` chalk lines across the top of the stone, white until
   * tapped, then a dark groove. The chisel stands on the next one.
   */
  chalk(n) {
    for (const m of this.marks) { this.group.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.marks = [];
    this.tapsDone = 0;
    const s = CHISEL_INPUT_SIZE, x0 = this.input?.position.x ?? 0, z0 = this.input?.position.z ?? 0;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, s * 0.8), new THREE.MeshBasicMaterial({ color: CHALK }));
      m.position.set(x0 + (i - (n - 1) / 2) * s * 0.3, s + 0.006, z0);
      this.group.add(m);
      this.marks.push(m);
    }
  }

  /** `done` marks have been tapped: they are grooves now, and the chisel strikes. */
  tapped(done) {
    this.tapsDone = done;
    this.marks.forEach((m, i) => m.material.color.setHex(i < done ? GROOVE : CHALK));
    this.strike = done ? 0.22 : 0;
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
    // CRAFT-9 part 4: a chisel standing on its point, a wooden mallet head above it.
    else if (kind === 'chisel') { box(0.03, 0.2, 0.03, STEEL, 0, 0.1, 0); box(0.05, 0.12, 0.05, HANDLE, 0, 0.26, 0); box(0.16, 0.09, 0.09, 0x9c7348, 0, 0.42, 0); }
    else { box(0.22, 0.14, 0.22, 0x8a6a4a, 0, 0.07, 0); box(0.18, 0.02, 0.18, WATER, 0, 0.13, 0); }
    g.position.set(-0.18, 0.18, 0.05);
    return g;
  }

  /** The chisel over the next chalk mark, its point down; it drops onto the mark as a tap strikes. */
  placeChisel(dt) {
    const mark = this.marks[Math.min(this.tapsDone, this.marks.length - 1)];
    this.strike = Math.max(0, this.strike - dt);
    if (!mark) { this.tool.visible = false; return; }
    this.tool.visible = true;
    const lift = this.strike > 0 ? (0.22 - this.strike) / 0.22 * 0.1 : 0.1;
    this.tool.position.set(mark.position.x, mark.position.y + lift, mark.position.z + 0.08);
    this.tool.rotation.z = 0;
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
    if (kind === 'chisel') this.placeChisel(dt);
    else if (this.input) this.input.scale.setScalar(INPUT_SIZE * (1 - Math.min(this.level, 1) * 0.35));
    // The batch shown, the marks are chalked afresh for the next one.
    if (this.flash > 0 && this.flash - dt <= 0 && this.marks.length && this.tapsDone >= this.marks.length) this.tapped(0);
    this.flash = Math.max(0, this.flash - dt);
    if (this.output) this.output.visible = this.flash > 0;
  }
}
