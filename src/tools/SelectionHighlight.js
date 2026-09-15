import * as THREE from 'three';
import { AIR } from '../config/blocks.js';

/**
 * Showing which build you are pointing at.
 *
 * This drew the selector box when there was one. There is not: you point at a
 * building and the game works out where it ends, so what has to be drawn is the
 * answer it came to — otherwise "save this design" is a promise about an
 * invisible set of blocks.
 *
 * Three things:
 *   - a translucent shell round the extent, so the volume reads as a volume;
 *   - its edges, drawn over everything, so it is findable from inside a build
 *     or through a wall;
 *   - a skin over the blocks themselves, which is what actually says *these*.
 *
 * The skin is the expensive part, so it is rebuilt only when the extent or the
 * world inside it changes — not per frame.
 */

const ACCENT = 0x4ddbc4;

// Face corner offsets in the same order the mesher uses: +X, -X, +Y, -Y, +Z, -Z.
const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [-1, 0, 0], v: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]] },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], v: [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]] },
  { n: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

export class SelectionHighlight {
  constructor(scene) {
    this.scene = scene;

    const shellGeo = new THREE.BoxGeometry(1, 1, 1);
    this.shell = new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0.06,
      // Back faces only: from outside you get the far walls, which reads as
      // depth, without a wash of colour over everything in front of them.
      side: THREE.BackSide,
      depthWrite: false, // a see-through box must not occlude what is inside it
    }));
    this.shell.renderOrder = 10;

    this.edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(shellGeo),
      // Drawn last with no depth test, so the cage is always legible against
      // the build it surrounds — that is the "boundaries on the blocks" read.
      new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.9, depthTest: false }),
    );
    this.edges.renderOrder = 12;

    this.skin = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.FrontSide,
      polygonOffset: true,       // the skin is coplanar with the block faces it
      polygonOffsetFactor: -1,   // covers, so nudge it forward out of the z-fight
      polygonOffsetUnits: -2,
    }));
    this.skin.renderOrder = 11;

    this.group = new THREE.Group();
    this.group.add(this.shell, this.edges, this.skin);
    this.group.visible = false;
    scene.add(this.group);

    this.key = null;      // anchor+size the current skin was built for
    this.blockCount = 0;  // solid blocks inside, surfaced in the HUD
  }

  hide() {
    this.group.visible = false;
    this.key = null;
  }

  /**
   * Draws a picked build: its extent, and the blocks it actually contains.
   *
   * `blocks` is the pick's own list rather than everything in the box, so an
   * L-shaped house is skinned as an L rather than as the rectangle round it.
   */
  update(bounds, blocks, world, { force = false } = {}) {
    if (!bounds || !blocks?.length) return this.hide();

    const w = bounds.maxX - bounds.minX + 1;
    const h = bounds.maxY - bounds.minY + 1;
    const d = bounds.maxZ - bounds.minZ + 1;
    this.shell.scale.set(w, h, d);
    this.edges.scale.set(w, h, d);
    const cx = bounds.minX + w / 2, cy = bounds.minY + h / 2, cz = bounds.minZ + d / 2;
    this.shell.position.set(cx, cy, cz);
    this.edges.position.set(cx, cy, cz);
    this.group.visible = true;

    const key = `${bounds.minX},${bounds.minY},${bounds.minZ},${w}x${h}x${d},${blocks.length}`;
    if (key !== this.key || force) {
      this.key = key;
      this.rebuildSkin(blocks, world);
    }
  }

  /** Emits the exposed faces of the picked blocks — the surface you can see. */
  rebuildSkin(blocks, world) {
    const positions = [];

    for (const { x, y, z } of blocks) {
      if (world.getBlock(x, y, z) === AIR) continue;
      for (const face of FACES) {
        const nx = x + face.n[0], ny = y + face.n[1], nz = z + face.n[2];
        // Only faces open to air. Skinning the inside too turns a build into a
        // solid cyan lump the moment you look at it from a doorway.
        if (world.getBlock(nx, ny, nz) !== AIR) continue;
        const [a, b, c, d] = face.v;
        for (const [ox, oy, oz] of [a, b, c, a, c, d]) {
          positions.push(x + ox, y + oy, z + oz);
        }
      }
    }

    const count = blocks.length;
    this.blockCount = count;
    const geo = this.skin.geometry;
    geo.dispose();
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    this.skin.geometry = next;
    this.skin.visible = count > 0;
  }

  dispose() {
    this.scene.remove(this.group);
    this.shell.geometry.dispose();
    this.edges.geometry.dispose();
    this.skin.geometry.dispose();
    for (const m of [this.shell, this.edges, this.skin]) m.material.dispose();
  }
}
