import * as THREE from 'three';
import { biomeCssColours, waterCssColour } from './biomePalette.js';

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
 * out to the horizon. It has no blocks in it and holds no trees, but it no
 * longer pretends to be smooth: heights are quantised to a step and each grid
 * cell keeps its own corners instead of sharing them with its neighbours, so
 * shading breaks at the same edges the steps do rather than blending across
 * them — rolling hills read as terraces, the way the real, blocky ground
 * they are standing in for actually looks from a distance.
 *
 * Two rings, coarser as they go out, because detail you cannot resolve is
 * detail you are paying for and not seeing. The inner ring starts where the
 * real chunks end so there is no gap to fall through, and both are drawn
 * under everything else — a real chunk always wins where the two overlap.
 */

/**
 * Sampling step, outer edge and height quantisation of each ring, in blocks.
 * `heightStep` grows with `step`: a ring already sampling every 24 blocks
 * gains nothing from a 1-block-fine terrace and pays for it in extra risers.
 */
const RINGS = [
  { step: 8, to: 420, heightStep: 2 },
  { step: 24, to: 1400, heightStep: 4 },
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
    this.waterColour = waterColour();
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
      const mesh = this.buildRing(gen, x, z, from, ring.to, ring.step, ring.heightStep);
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
  buildRing(gen, cx, cz, from, to, step, heightStep) {
    const n = Math.ceil((to * 2) / step) + 1;
    const half = to;
    // Snap the grid to the world rather than the player, so walking does not
    // make the whole surface shimmer as every vertex slides to a new height.
    const ox = Math.round((cx - half) / step) * step;
    const oz = Math.round((cz - half) / step) * step;

    const positions = [];
    const colours = [];
    const indices = [];

    const heightCache = new Map();
    const sample = (gx, gz) => {
      const key = gx * 100003 + gz;
      let v = heightCache.get(key);
      if (v === undefined) {
        const wx = ox + gx * step, wz = oz + gz * step;
        // A lake or the sea isn't a colour the biome carries — it's ground
        // that dipped below water level, the same way the real chunks flood
        // it (see ChunkGen.waterLevelAt). Skipping this was the bug: past
        // render distance, every body of water quietly turned back into dry,
        // wrongly-coloured land, so the shoreline you could actually see
        // water in just stopped at a border with nothing standing in for it.
        const water = gen.waterLevelAt(wx, wz);
        // Quantised, so a hillside comes in terraces rather than a ramp —
        // the shading break below is what makes each one read as a step
        // rather than a crease, but it needs an actual step to break at.
        // Water is already flat, so it skips the quantising rather than
        // being rounded down into the ground it is floating on.
        const h = water || Math.round(gen.heightAt(wx, wz) / heightStep) * heightStep;
        v = { h, b: gen.biomeIndexAt(wx, wz), wx, wz, water: !!water };
        heightCache.set(key, v);
      }
      return v;
    };

    const inner = from;
    for (let gx = 0; gx < n - 1; gx++) {
      for (let gz = 0; gz < n - 1; gz++) {
        // The middle is left to the real blocks.
        const mx = ox + (gx + 0.5) * step, mz = oz + (gz + 0.5) * step;
        if (Math.abs(mx - cx) < inner && Math.abs(mz - cz) < inner) continue;

        const sa = sample(gx, gz), sb = sample(gx + 1, gz);
        const sc = sample(gx + 1, gz + 1), sd = sample(gx, gz + 1);
        // Each cell owns four corners of its own rather than sharing them
        // with its neighbours. The positions still line up exactly — same
        // sampled corners, same coordinates — so nothing pulls apart, but
        // the *shading* no longer blends across the seam: computeVertexNormals
        // below only ever sees this one flat quad at each of these vertices,
        // never the differently-tilted quad next door.
        const base = positions.length / 3;
        positions.push(sa.wx, sa.h, sa.wz, sb.wx, sb.h, sb.wz, sc.wx, sc.h, sc.wz, sd.wx, sd.h, sd.wz);
        // One colour for the whole quad, same approximation the land already
        // makes from its own corner (sa) — a cell is either standing in for
        // water or for ground, not blended between the two.
        const c = sa.water ? this.waterColour : (this.colours[sa.b] ?? this.colours[0]);
        for (let i = 0; i < 4; i++) colours.push(c.r, c.g, c.b);
        indices.push(base, base + 3, base + 1, base + 1, base + 3, base + 2);
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
 * The shared land/water palette (see biomePalette.js), as THREE.Color —
 * this is the one consumer that needs it in that form, for vertex colours
 * rather than canvas fill styles.
 */
function biomeColours() {
  return biomeCssColours().map((css) => new THREE.Color(css));
}

function waterColour() {
  return new THREE.Color(waterCssColour());
}
