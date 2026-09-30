import * as THREE from 'three';
import { biomeCssColours, waterCssColour } from './biomePalette.js';
import { BIOMES, surfaceFor } from '../config/biomes.js';
import { BLOCKS_BY_ID } from '../config/blocks.js';
import { hash01 } from '../world/ChunkGen.js';

/**
 * The country past where the blocks stop.
 *
 * Real chunks cost memory and meshing time, so only a few hundred blocks of
 * them can be alive at once. Past them stands this: a coarse, terraced
 * heightfield of the ground, sampled straight from the generator, out to the
 * horizon.
 *
 * It used to be one big ring rebuilt around you every 96 blocks, with a hole
 * in the middle whose size depended on how many chunks were still waiting to
 * be meshed. Reported directly: "the terrain moves with me... blocks
 * flicker", worst when flying. Three things were wrong with that. The hole
 * flipped between two sizes as the queue crossed a threshold, so a whole
 * band of fake ground popped in and out on top of the real one. Where the
 * two overlapped they fought over the same pixels. And each rebuild sampled
 * tens of thousands of points in one frame.
 *
 * Now it's tiles fixed in the world, made a few at a time as you travel and
 * never moved or remade once they exist — the ground stays where it is and
 * only your view of it changes. It never overlaps a real chunk, either: the
 * shader discards itself over any chunk that is drawn, from a small mask
 * Game keeps up to date (see setChunkMask), so it only ever fills in where
 * the blocks aren't — past render distance, or a chunk not meshed yet.
 *
 * Two layers, coarser further out. They split along a circle round the
 * player: the fine one draws inside it, the coarse one outside.
 *
 * And it's made of blocks. Reported directly: "I still dont like the render
 * distance fake shapes. They should be blocky. Cant we like check for whats
 * rendered, and make a fake image out of it" — the way Minecraft's distant-
 * terrain mods do. It used to be a smooth sheet sloping between samples,
 * coloured by biome. Now every cell is a column: flat on top at the real
 * ground height, square-sided down to its lower neighbours, the colour of
 * the block that's really on top there (grass, sand, snow, the sea), and
 * forests stand up as blocky masses of their own leaves. From a distance
 * it reads as the same world, only bigger blocks.
 */

const LAYERS = [
  { step: 8, tile: 128, heightStep: 2 },
  { step: 24, tile: 384, heightStep: 4 },
];
/** Where the fine layer hands over to the coarse one, in blocks from you. */
export const SPLIT = 448;
/** How far out the coarse layer reaches — past the fog's far end. */
export const REACH = 1536;
/**
 * How far below the sampled height the fake ground sits. Its terraces are
 * interpolated between samples 8 blocks apart, so right at the edge of the
 * real chunks it can come out a little above the real ground — which would
 * leave a sliver of sky under its edge. Sinking it keeps that edge below.
 */
export const SINK = 1;
/** Milliseconds a frame may spend making tiles, once the first lot exist. */
const BUDGET_MS = 3;

export class FarTerrain {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.colours = biomeCssColours().map((css) => new THREE.Color(css));
    this.waterColour = new THREE.Color(waterCssColour());
    this.gen = null;

    // One mask texel per chunk: 255 where a real chunk is drawn.
    this.maskSize = 0;
    this.maskData = null;
    this.maskTexture = null;
    this.uniforms = {
      uCentre: { value: new THREE.Vector2() },
      uSplit: { value: SPLIT },
      uMask: { value: null },
      uMaskOrigin: { value: new THREE.Vector2() },
      uMaskBlocks: { value: 1 },
    };
    this.ensureMask(40);
    this.layers = LAYERS.map((spec, i) => ({
      ...spec,
      tiles: new Map(),
      material: this.material(i === 0),
    }));
  }

  /** The two materials: Lambert, plus the split and the chunk mask. */
  material(inner) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: true });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = `varying vec2 vFarXZ;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFarXZ = position.xz;');
      shader.fragmentShader = `
        varying vec2 vFarXZ;
        uniform vec2 uCentre;
        uniform float uSplit;
        uniform sampler2D uMask;
        uniform vec2 uMaskOrigin;
        uniform float uMaskBlocks;
        ${shader.fragmentShader}`
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          vec2 d = vFarXZ - uCentre;
          if (${inner ? 'dot(d, d) > uSplit * uSplit' : 'dot(d, d) <= uSplit * uSplit'}) discard;
          vec2 m = (vFarXZ - uMaskOrigin) / uMaskBlocks;
          if (m.x >= 0.0 && m.x < 1.0 && m.y >= 0.0 && m.y < 1.0 && texture2D(uMask, m).r > 0.5) discard;
        }`);
    };
    mat.customProgramCacheKey = () => (inner ? 'far-inner-v2' : 'far-outer-v2');
    return mat;
  }

  /**
   * Keeps the tiles around (x, z): makes the missing ones nearest first,
   * forgets the ones left far behind. Everything within reach is made at
   * once the first time; after that only a few milliseconds' worth a frame.
   */
  update(gen, x, z, { budgetMs = BUDGET_MS } = {}) {
    if (!gen) return;
    if (gen !== this.gen) {
      this.clear();
      this.gen = gen;
    }
    this.uniforms.uCentre.value.set(x, z);
    const first = this.layers.every((l) => !l.tiles.size);
    const deadline = first ? Infinity : performance.now() + budgetMs;
    this.layers.forEach((layer, i) => {
      const from = i === 0 ? 0 : SPLIT;
      const to = i === 0 ? SPLIT : REACH;
      this.forgetFar(layer, x, z, from, to);
      for (const [tx, tz] of this.wanted(layer, x, z, from, to)) {
        if (performance.now() > deadline) return;
        const key = `${tx},${tz}`;
        if (!layer.tiles.has(key)) this.makeTile(layer, tx, tz);
      }
    });
  }

  /** Tiles overlapping the band between `from` and `to` around (x, z), nearest first. */
  wanted(layer, x, z, from, to) {
    const t = layer.tile;
    const out = [];
    for (let tx = Math.floor((x - to) / t); tx <= Math.floor((x + to) / t); tx++) {
      for (let tz = Math.floor((z - to) / t); tz <= Math.floor((z + to) / t); tz++) {
        const near = distToTile(x, z, tx * t, tz * t, t);
        const far = farToTile(x, z, tx * t, tz * t, t);
        if (near < to && far > from) out.push([tx, tz, near]);
      }
    }
    return out.sort((a, b) => a[2] - b[2]);
  }

  forgetFar(layer, x, z, from, to) {
    const t = layer.tile;
    for (const [key, mesh] of layer.tiles) {
      const [tx, tz] = key.split(',').map(Number);
      // A tile's worth of slack either way, so wandering back and forth
      // over a line doesn't make and forget the same tile over and over.
      if (distToTile(x, z, tx * t, tz * t, t) > to + t || farToTile(x, z, tx * t, tz * t, t) < from - t) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        layer.tiles.delete(key);
      }
    }
  }

  /**
   * One square of the world on a fixed grid, in columns of `step` blocks: a
   * flat top at each column's ground, walls down to any lower neighbour
   * (including across the tile's edge, so tiles meet without a crack), and
   * a canopy block wherever the ground is wooded.
   */
  makeTile(layer, tx, tz) {
    const { step, tile } = layer;
    const cells = tile / step;
    const x0 = tx * tile, z0 = tz * tile;
    const gen = this.gen;

    // One ring beyond the tile, so a wall on its edge knows what's next door.
    const n = cells + 2;
    const cols = new Array(n * n);
    for (let gz = 0; gz < n; gz++) {
      for (let gx = 0; gx < n; gx++) {
        cols[gz * n + gx] = this.column(x0 + (gx - 1) * step, z0 + (gz - 1) * step, step);
      }
    }
    const at = (gx, gz) => cols[(gz + 1) * n + gx + 1];

    const out = { position: [], normal: [], color: [], index: [] };
    for (let gz = 0; gz < cells; gz++) {
      for (let gx = 0; gx < cells; gx++) {
        const c = at(gx, gz);
        const xa = x0 + gx * step, xb = xa + step, za = z0 + gz * step, zb = za + step;
        quad(out, [xa, c.top, za], [xa, c.top, zb], [xb, c.top, zb], [xb, c.top, za], [0, 1, 0], c.colour);
        // Water is a flat sheet: the ground under it shows through nowhere.
        if (c.water) continue;
        for (const [dx, dz, nx, nz] of [[1, 0, 1, 0], [-1, 0, -1, 0], [0, 1, 0, 1], [0, -1, 0, -1]]) {
          const o = at(gx + dx, gz + dz);
          const low = o.top;
          if (low >= c.top) continue;
          const x = dx > 0 ? xb : xa, z = dz > 0 ? zb : za;
          if (dx) quad(out, [x, low, za], [x, c.top, za], [x, c.top, zb], [x, low, zb], [nx, 0, nz], c.side);
          else quad(out, [xa, low, z], [xb, low, z], [xb, c.top, z], [xa, c.top, z], [nx, 0, nz], c.side);
        }
        if (c.canopy) this.canopy(out, xa, za, step, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(out.position, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(out.normal, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(out.color, 3));
    geo.setIndex(out.index);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, layer.material);
    mesh.userData.far = true;
    this.group.add(mesh);
    layer.tiles.set(`${tx},${tz}`, mesh);
    return mesh;
  }

  /**
   * What stands on one column of the world, asked of the generator the same
   * way ChunkGen.fill builds the real thing: how high the ground is, whether
   * it's under water, the block on top and the one showing down its sides,
   * and how wooded it is.
   */
  column(x, z, step) {
    const gen = this.gen;
    const cx = x + (step >> 1), cz = z + (step >> 1);
    const water = gen.waterLevelAt(cx, cz);
    const h = gen.heightAt(cx, cz);
    const index = gen.biomeIndexAt(cx, cz);
    const biome = BIOMES[index];
    if (water) return { top: water - SINK, water: true, colour: this.waterColour, side: this.waterColour };
    const beach = h <= SEA_LEVEL + BEACH_BAND;
    const topId = biome ? (beach ? SAND : surfaceFor(biome, h)) : null;
    const colour = topId != null ? colourOf(topId) : (this.colours[index] ?? this.colours[0]);
    const side = biome ? colourOf(beach ? SAND : biome.surface.under) : colour;
    const col = { top: h - SINK, water: false, colour, side, canopy: null };
    // Woods: each column is wooded as often as its biome grows trees, so a
    // forest is a solid roof of leaves and a meadow has a lone clump here
    // and there — seen from far off, which is all this is for.
    const trees = biome?.trees;
    if (gen.treeAt && trees?.chance && !beach && (biome.treeMaxHeight == null || h <= biome.treeMaxHeight)) {
      const density = Math.min(1, trees.chance * 28);
      const [lo, hi] = trees.trunk ?? [4, 6];
      col.canopy = { density, height: Math.round((lo + hi) / 2) + 2, colour: colourOf(trees.leaves), seed: gen.seed ?? 0 };
    }
    return col;
  }

  /** A column's woods, as leaf blocks over whichever quarters of it are wooded. */
  canopy(out, x0, z0, step, c) {
    const half = step / 2, top = c.top + c.canopy.height, bottom = c.top + 1, col = c.canopy.colour;
    const wooded = [];
    for (let qx = 0; qx < 2; qx++) {
      for (let qz = 0; qz < 2; qz++) {
        const xa = x0 + qx * half, za = z0 + qz * half;
        if (hash01(xa, za, c.canopy.seed ^ 0x7ee5) < c.canopy.density) wooded.push([xa, za]);
      }
    }
    // Deep in a forest every quarter is wooded: one block of leaves, not four.
    if (wooded.length === 4) return leafBox(out, x0, z0, x0 + step, z0 + step, bottom, top, col);
    for (const [xa, za] of wooded) leafBox(out, xa, za, xa + half, za + half, bottom, top, col);
  }

  /** A square mask of `size` chunks a side; remade only if the size changes. */
  ensureMask(size) {
    if (this.maskSize === size) return;
    this.maskTexture?.dispose();
    this.maskSize = size;
    this.maskData = new Uint8Array(size * size);
    this.maskTexture = new THREE.DataTexture(this.maskData, size, size, THREE.RedFormat, THREE.UnsignedByteType);
    this.maskTexture.magFilter = THREE.NearestFilter;
    this.maskTexture.minFilter = THREE.NearestFilter;
    this.maskTexture.needsUpdate = true;
    this.uniforms.uMask.value = this.maskTexture;
  }

  /**
   * Which chunks are drawn for real, so nothing is drawn over them: a square
   * of `size` chunks starting at chunk (cx0, cz0), and `drawn(cx, cz)`.
   * Only uploads when something actually changed.
   */
  setChunkMask(cx0, cz0, size, drawn, chunkSize) {
    this.ensureMask(size);
    const data = this.maskData;
    let changed = this.uniforms.uMaskOrigin.value.x !== cx0 * chunkSize
      || this.uniforms.uMaskOrigin.value.y !== cz0 * chunkSize;
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const v = drawn(cx0 + i, cz0 + j) ? 255 : 0;
        if (data[j * size + i] !== v) { data[j * size + i] = v; changed = true; }
      }
    }
    if (!changed) return;
    this.uniforms.uMaskOrigin.value.set(cx0 * chunkSize, cz0 * chunkSize);
    this.uniforms.uMaskBlocks.value = size * chunkSize;
    this.maskTexture.needsUpdate = true;
  }

  /** Every tile mesh standing, across both layers. */
  get meshes() {
    return this.layers.flatMap((l) => [...l.tiles.values()]);
  }

  /** How many triangles are standing in for the distance. */
  get triangles() {
    return this.meshes.reduce((n, m) => n + m.geometry.index.count / 3, 0);
  }

  setVisible(on) {
    this.group.visible = on;
  }

  clear() {
    for (const layer of this.layers) {
      for (const mesh of layer.tiles.values()) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
      }
      layer.tiles.clear();
    }
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
    for (const layer of this.layers) layer.material.dispose();
    this.maskTexture?.dispose();
  }
}

/** Distance from (x, z) to the nearest point of a square tile. */
function distToTile(x, z, tx, tz, size) {
  const dx = Math.max(tx - x, 0, x - (tx + size));
  const dz = Math.max(tz - z, 0, z - (tz + size));
  return Math.hypot(dx, dz);
}

/** Distance from (x, z) to the furthest corner of a square tile. */
function farToTile(x, z, tx, tz, size) {
  const dx = Math.max(Math.abs(tx - x), Math.abs(tx + size - x));
  const dz = Math.max(Math.abs(tz - z), Math.abs(tz + size - z));
  return Math.hypot(dx, dz);
}

const SAND = 6;
/** The same shoreline ChunkGen draws: dry ground this close to the sea is sand. */
const SEA_LEVEL = 100, BEACH_BAND = 4;
const blockColours = new Map();
function colourOf(id) {
  let c = blockColours.get(id);
  if (!c) {
    c = new THREE.Color(BLOCKS_BY_ID.get(id)?.color ?? 0x888888);
    blockColours.set(id, c);
  }
  return c;
}

/**
 * One flat face, its corners in any order round it; wound to face `n`.
 */
function quad(out, a, b, c, d, n, colour) {
  const base = out.position.length / 3;
  for (const p of [a, b, c, d]) {
    out.position.push(p[0], p[1], p[2]);
    out.normal.push(n[0], n[1], n[2]);
    out.color.push(colour.r, colour.g, colour.b);
  }
  // Which way round the corners go decides which side is the front.
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const dot = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
  if (dot >= 0) out.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  else out.index.push(base, base + 2, base + 1, base, base + 3, base + 2);
}

/** A box of leaves: its top and four sides (never seen from below). */
function leafBox(out, xa, za, xb, zb, bottom, top, col) {
  quad(out, [xa, top, za], [xa, top, zb], [xb, top, zb], [xb, top, za], [0, 1, 0], col);
  quad(out, [xb, bottom, za], [xb, top, za], [xb, top, zb], [xb, bottom, zb], [1, 0, 0], col);
  quad(out, [xa, bottom, zb], [xa, top, zb], [xa, top, za], [xa, bottom, za], [-1, 0, 0], col);
  quad(out, [xa, bottom, zb], [xb, bottom, zb], [xb, top, zb], [xa, top, zb], [0, 0, 1], col);
  quad(out, [xb, bottom, za], [xa, bottom, za], [xa, top, za], [xb, top, za], [0, 0, -1], col);
}
