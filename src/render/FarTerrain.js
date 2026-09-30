import * as THREE from 'three';
import { biomeCssColours, waterCssColour } from './biomePalette.js';

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
export const SINK = 3;
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
   * One square of terraced ground on a world-fixed grid. Each cell owns its
   * four corners rather than sharing them, so shading breaks at the terrace
   * edges instead of blending across them — hills read as steps, the way the
   * blocky ground they stand in for does.
   */
  makeTile(layer, tx, tz) {
    const { step, tile, heightStep } = layer;
    const cells = tile / step;
    const x0 = tx * tile, z0 = tz * tile;
    const gen = this.gen;

    const n = cells + 1;
    const samples = new Array(n * n);
    for (let gz = 0; gz < n; gz++) {
      for (let gx = 0; gx < n; gx++) {
        const wx = x0 + gx * step, wz = z0 + gz * step;
        // A lake or the sea is ground below water level, the same way the
        // real chunks flood it (see ChunkGen.waterLevelAt): flat at the
        // water's surface, and water-coloured, not dry land.
        const water = gen.waterLevelAt(wx, wz);
        const h = water || Math.round(gen.heightAt(wx, wz) / heightStep) * heightStep;
        samples[gz * n + gx] = { h: h - SINK, b: gen.biomeIndexAt(wx, wz), wx, wz, water: !!water };
      }
    }

    const quads = cells * cells;
    const positions = new Float32Array(quads * 12);
    const colours = new Float32Array(quads * 12);
    const index = new Uint16Array(quads * 6);
    let q = 0;
    for (let gz = 0; gz < cells; gz++) {
      for (let gx = 0; gx < cells; gx++, q++) {
        const sa = samples[gz * n + gx], sb = samples[gz * n + gx + 1];
        const sc = samples[(gz + 1) * n + gx + 1], sd = samples[(gz + 1) * n + gx];
        positions.set([sa.wx, sa.h, sa.wz, sb.wx, sb.h, sb.wz, sc.wx, sc.h, sc.wz, sd.wx, sd.h, sd.wz], q * 12);
        const c = sa.water ? this.waterColour : (this.colours[sa.b] ?? this.colours[0]);
        for (let k = 0; k < 4; k++) colours.set([c.r, c.g, c.b], q * 12 + k * 3);
        const b = q * 4;
        index.set([b, b + 3, b + 1, b + 1, b + 3, b + 2], q * 6);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, layer.material);
    mesh.userData.far = true;
    this.group.add(mesh);
    layer.tiles.set(`${tx},${tz}`, mesh);
    return mesh;
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
