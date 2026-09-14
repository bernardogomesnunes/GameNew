import * as THREE from 'three';
import { BLOCKS_BY_ID } from '../config/blocks.js';

/**
 * A translucent copy of a building, floating where you are pointing.
 *
 * Moving a building by typing coordinates at it is not moving it. You want to
 * see the thing in the air and put it down, which means the preview has to be
 * the actual blocks in their actual colours rather than a box — a 7×7 outline
 * tells you nothing about whether the doorway ends up facing the river.
 *
 * One instanced box per block. A building is a few dozen to a few hundred
 * blocks, so the cost is nothing, and moving it is a single position change
 * rather than a rebuild.
 */

const OK_TINT = new THREE.Color(1, 1, 1);
const BAD_TINT = new THREE.Color(1.6, 0.5, 0.45);

export class BuildGhost {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.frame = null;
    this.blocks = null;
    this.valid = true;
  }

  /** Builds the preview for a set of `{dx, dy, dz, type}` blocks. */
  show(blocks, extent) {
    this.hide();
    if (!blocks?.length) return;
    this.blocks = blocks;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.55,
      depthWrite: false,   // it is a proposal, not a thing with volume yet
    });
    const mesh = new THREE.InstancedMesh(geo, mat, blocks.length);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;

    const m = new THREE.Matrix4();
    const colour = new THREE.Color();
    blocks.forEach((b, i) => {
      m.makeTranslation(b.dx + 0.5, b.dy + 0.5, b.dz + 0.5);
      mesh.setMatrixAt(i, m);
      colour.setHex(BLOCKS_BY_ID.get(b.type)?.color ?? 0x888888);
      mesh.setColorAt(i, colour);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // An outline round the whole footprint, drawn over everything, so you can
    // still find the building when it is behind a hill.
    const w = extent.x + 1, h = extent.y + 1, d = extent.z + 1;
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
      new THREE.LineBasicMaterial({ color: 0x4ddbc4, transparent: true, opacity: 0.9, depthTest: false }),
    );
    frame.position.set(w / 2, h / 2, d / 2);
    frame.renderOrder = 4;

    const group = new THREE.Group();
    group.add(mesh, frame);
    this.mesh = mesh;
    this.frame = frame;
    this.group = group;
    this.scene.add(group);
  }

  moveTo({ x, y, z }) {
    if (this.group) this.group.position.set(x, y, z);
  }

  /** Red means the spot is refused — the reason is said in words elsewhere. */
  setValid(ok) {
    if (!this.mesh || ok === this.valid) return;
    this.valid = ok;
    this.mesh.material.color.copy(ok ? OK_TINT : BAD_TINT);
    this.frame.material.color.setHex(ok ? 0x4ddbc4 : 0xe0554f);
  }

  get active() {
    return !!this.group;
  }

  hide() {
    if (!this.group) return;
    this.scene.remove(this.group);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.frame.geometry.dispose();
    this.frame.material.dispose();
    this.group = null;
    this.mesh = null;
    this.frame = null;
    this.blocks = null;
    this.valid = true;
  }
}
