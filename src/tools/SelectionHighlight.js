import * as THREE from 'three';
import { AIR } from '../config/blocks.js';

/**
 * The selector's visuals.
 *
 * A thin wireframe cube was the wrong answer: WebGL ignores line widths, the
 * lines sat behind the terrain, and the box could enclose nothing but sky, so
 * turning the selector on looked like nothing happening at all.
 *
 * This draws three things instead:
 *   - a translucent shell, so the volume reads as a volume;
 *   - its edges, drawn over everything, so the box is findable even from inside
 *     a build or through a wall;
 *   - a skin over the solid blocks the selection actually contains, which is
 *     what tells you what a save would capture.
 *
 * The skin is the expensive part, so it is rebuilt only when the anchor, size
 * or world contents change — not per frame.
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
   * Positions the cage and, when the selection has moved or the world under it
   * changed, re-skins the blocks inside.
   */
  update(bounds, size, world, { force = false } = {}) {
    if (!bounds) return this.hide();

    this.shell.scale.set(size, size, size);
    this.edges.scale.set(size, size, size);
    const cx = bounds.minX + size / 2, cy = bounds.minY + size / 2, cz = bounds.minZ + size / 2;
    this.shell.position.set(cx, cy, cz);
    this.edges.position.set(cx, cy, cz);
    this.group.visible = true;

    const key = `${bounds.minX},${bounds.minY},${bounds.minZ},${size}`;
    if (key !== this.key || force) {
      this.key = key;
      this.rebuildSkin(bounds, world);
    }
  }

  /** Emits the exposed faces of the contained blocks — the surface you can see. */
  rebuildSkin(bounds, world) {
    const positions = [];
    let count = 0;

    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
          if (world.getBlock(x, y, z) === AIR) continue;
          count++;
          for (const face of FACES) {
            const nx = x + face.n[0], ny = y + face.n[1], nz = z + face.n[2];
            // Only faces open to air. Skinning the selection's cut planes too
            // turns a buried selection into a solid cyan wall across the screen.
            if (world.getBlock(nx, ny, nz) !== AIR) continue;
            const [a, b, c, d] = face.v;
            for (const [ox, oy, oz] of [a, b, c, a, c, d]) {
              positions.push(x + ox, y + oy, z + oz);
            }
          }
        }
      }
    }

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
