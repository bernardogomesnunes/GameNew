import * as THREE from 'three';
import { BIOMES } from '../config/biomes.js';
import { BLOCKS_BY_ID } from '../config/blocks.js';

/**
 * The country past where the blocks stop.
 *
 * Real chunks cost memory and meshing time, so only a few hundred blocks of
 * them can be alive at once. That used to be the end of the world, literally:
 * the land stopped and the sky began, and no amount of fog hid the fact that
 * you were standing on a plate.
 *
 * This is what stands in beyond it — one coarse mesh of the ground surface,
 * sampled straight from the generator rather than from any blocks, stretching
 * out to the horizon. It is a lie in exactly one respect: it has no blocks in
 * it, so it is smooth where the real world is stepped, and holds no trees.
 * From a quarter of a mile away, under fog, that difference is invisible and
 * the horizon is a long way off.
 *
 * Two rings, coarser as they go out, because detail you cannot resolve is
 * detail you are paying for and not seeing. The inner ring starts where the
 * real chunks end so there is no gap to fall through, and both are drawn
 * under everything else — a real chunk always wins where the two overlap.
 */

/** Sampling step and outer edge of each ring, in blocks. */
const RINGS = [
  { step: 8, to: 420 },
  { step: 24, to: 1400 },
];

/** How far the player moves before the whole thing is rebuilt around them. */
export const REBUILD_AFTER = 96;

export class FarTerrain {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    // Drawn first and never into the depth buffer's favour: where a real chunk
    // exists it must win, and it will, because it is nearer.
    this.group.renderOrder = -1;
    scene.add(this.group);
    this.meshes = [];
    this.builtAt = null;
    this.colours = biomeColours();
  }

  /**
   * Rebuilds the rings around a point, if the player has moved far enough.
   *
   * @param innerFrom how far out the real chunks reach, so the near ring can
   *   start beyond them rather than fighting for the same ground.
   */
  update(gen, x, z, innerFrom) {
    if (!gen) return false;
    if (this.builtAt
      && Math.abs(this.builtAt.x - x) < REBUILD_AFTER
      && Math.abs(this.builtAt.z - z) < REBUILD_AFTER
      && this.builtAt.innerFrom === innerFrom) return false;
    this.build(gen, x, z, innerFrom);
    return true;
  }

  build(gen, x, z, innerFrom) {
    this.dispose(false);
    let from = innerFrom;
    for (const ring of RINGS) {
      if (ring.to <= from) continue;
      const mesh = this.buildRing(gen, x, z, from, ring.to, ring.step);
      if (mesh) { this.group.add(mesh); this.meshes.push(mesh); }
      from = ring.to;
    }
    this.builtAt = { x, z, innerFrom };
  }

  /**
   * One square annulus of ground, sampled on a grid.
   *
   * Square rather than round because the grid is square: a circular cut would
   * leave a ragged edge of half-quads, and the fog has long since taken the
   * corners anyway.
   */
  buildRing(gen, cx, cz, from, to, step) {
    const n = Math.ceil((to * 2) / step) + 1;
    const half = to;
    // Snap the grid to the world rather than the player, so walking does not
    // make the whole surface shimmer as every vertex slides to a new height.
    const ox = Math.round((cx - half) / step) * step;
    const oz = Math.round((cz - half) / step) * step;

    const positions = [];
    const colours = [];
    const indices = [];
    const at = new Map();          // grid index -> vertex number

    const heightCache = new Map();
    const sample = (gx, gz) => {
      const key = gx * 100003 + gz;
      let v = heightCache.get(key);
      if (v === undefined) {
        const wx = ox + gx * step, wz = oz + gz * step;
        v = { h: gen.heightAt(wx, wz), b: gen.biomeIndexAt(wx, wz), wx, wz };
        heightCache.set(key, v);
      }
      return v;
    };

    const vertex = (gx, gz) => {
      const key = gx * 100003 + gz;
      let i = at.get(key);
      if (i !== undefined) return i;
      const s = sample(gx, gz);
      i = positions.length / 3;
      positions.push(s.wx, s.h, s.wz);
      const c = this.colours[s.b] ?? this.colours[0];
      colours.push(c.r, c.g, c.b);
      at.set(key, i);
      return i;
    };

    const inner = from;
    for (let gx = 0; gx < n - 1; gx++) {
      for (let gz = 0; gz < n - 1; gz++) {
        // The middle is left to the real blocks.
        const mx = ox + (gx + 0.5) * step, mz = oz + (gz + 0.5) * step;
        if (Math.abs(mx - cx) < inner && Math.abs(mz - cz) < inner) continue;
        const a = vertex(gx, gz), b = vertex(gx + 1, gz);
        const c = vertex(gx + 1, gz + 1), d = vertex(gx, gz + 1);
        indices.push(a, d, b, b, d, c);
      }
    }
    if (!indices.length) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return mesh;
  }

  /** How many triangles are standing in for the distance. */
  get triangles() {
    return this.meshes.reduce((n, m) => n + (m.geometry.index?.count ?? 0) / 3, 0);
  }

  setVisible(on) {
    this.group.visible = on;
  }

  dispose(removeGroup = true) {
    for (const m of this.meshes) {
      this.group.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    this.meshes = [];
    if (removeGroup) {
      this.scene.remove(this.group);
      this.builtAt = null;
    }
  }
}

/**
 * A colour per biome, taken from whatever that biome puts on top.
 *
 * Read from the block registry rather than written out again here, so the
 * distance is made of the same greens and greys as the ground under your feet
 * and cannot drift away from it.
 */
function biomeColours() {
  return BIOMES.map((b) => {
    const block = BLOCKS_BY_ID.get(b.surface.top);
    const c = new THREE.Color(block?.color ?? 0x5b9c3f);
    // A shade flatter than the real blocks: at this distance every face is lit
    // the same and the unshaded colour reads brighter than the stepped ground
    // it is continuing.
    c.multiplyScalar(0.92);
    return c;
  });
}
