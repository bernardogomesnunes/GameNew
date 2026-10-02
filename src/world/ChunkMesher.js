import * as THREE from 'three';
import { blockTextureArray, layerFor, topLayerFor } from '../render/BlockTextures.js';
import {
  BLOCKS_BY_ID, AIR, isTransparent, shapeOf, facingOf, isWater, isFlowing, waterLevel, isLava, isLavaFlow, lavaLevel, LAVA,
  roofPart,
} from '../config/blocks.js';
import { boxesFor, fenceBoxes, rugBoxes, wallBoxes, pillarBoxes, turn } from './propShapes.js';
import { SLOPE_KIND, cornerOf, slopeGeometry, orient } from './slopes.js';
import { textureFor } from '../config/textures.js';
import { CHUNK_SIZE } from './World.js';

const SOLID_SENTINEL = -1; // below the world: never draw a face against it

// Directional shading baked into vertex colours. Flat-lit voxels read as mush
// without it, and it costs nothing at runtime.
const SHADE = { px: 0.86, nx: 0.86, py: 1.0, ny: 0.6, pz: 0.94, nz: 0.94 };
/**
 * Stairs' own, harder shade: reported directly, "the difference between
 * faces is very minimal" — with the ordinary shade a run of stairs read as
 * one smooth ramp. The treads catch the light, the risers fall into shade,
 * and each step down is a little darker than the one above it, so every
 * step stands out from the next.
 */
export const STAIR_SHADE = { py: 1.06, ny: 0.55, px: 0.66, pz: 0.74 };
export const STAIR_STEP_TONE = [0.86, 0.93, 1];

/*
 * Per-id lookups for the mesher's inner loop, which runs a few hundred
 * thousand times a chunk — a Map lookup per cell there was most of the cost
 * of building one. Ids are bytes (Chunk stores a Uint8Array).
 */
const IS_CUBE = new Uint8Array(256);
const IS_TRANSPARENT = new Uint8Array(256);
for (let id = 0; id < 256; id++) {
  IS_CUBE[id] = shapeOf(id) === 'cube' ? 1 : 0;
  IS_TRANSPARENT[id] = isTransparent(id) ? 1 : 0;
}
// The padded copy of a chunk the sweep reads: CHUNK_SIZE plus a one-block
// border each side, laid out x fastest, then z, then y.
const PAD = CHUNK_SIZE + 2;
// Cells light passes through, for skyFill: anything but a solid opaque cube.
const OPEN = new Uint8Array(256);
for (let id = 0; id < 256; id++) OPEN[id] = !IS_CUBE[id] || IS_TRANSPARENT[id] || id === AIR ? 1 : 0;
// What a fence or gate joins up with: another fence or gate, or a solid wall.
const JOINS_FENCE = new Uint8Array(256);
for (let id = 1; id < 256; id++) {
  const shape = shapeOf(id);
  JOINS_FENCE[id] = shape === 'fence' || shape === 'gate' || shape === 'gate_open' || shape === 'wall'
    || (IS_CUBE[id] && !IS_TRANSPARENT[id]) ? 1 : 0;
}
/** Cubes with something drawn over them — the ring ores' crystals (blocks.js `overlay`). */
const OVERLAY = new Array(256).fill(null);
for (const [id, b] of BLOCKS_BY_ID) if (b.overlay) OVERLAY[id] = b.overlay;
/** Pillars, which stack into one column (see propShapes' pillarBoxes). */
const IS_PILLAR = new Uint8Array(256);
for (const id of BLOCKS_BY_ID.keys()) IS_PILLAR[id] = shapeOf(id) === 'pillar' ? 1 : 0;
/**
 * Leaves, and anything else with holes in its texture: a face beside one is
 * drawn even though a solid block stands there, because you can see it
 * through the holes — the next leaf in, or the trunk inside the canopy.
 */
const CUTOUT = new Uint8Array(256);
for (const [id, b] of BLOCKS_BY_ID) {
  const t = textureFor(b.glyph);
  CUTOUT[id] = IS_CUBE[id] && t && (t.gaps || t.bite) ? 1 : 0;
}
/** Rugs, which run into each other (see propShapes' rugBoxes). */
const IS_RUG = new Uint8Array(256);
for (const id of BLOCKS_BY_ID.keys()) IS_RUG[id] = shapeOf(id) === 'rug' ? 1 : 0;
/** Stairs and roof tiles, which turn corners with each other (see world/slopes.js). */
const SLOPE = new Uint8Array(256);
const SLOPED = new Uint8Array(256);
for (const id of BLOCKS_BY_ID.keys()) {
  const shape = shapeOf(id);
  SLOPE[id] = SLOPE_KIND[shape] ?? 0;
  SLOPED[id] = shape === 'stair' || shape.startsWith('roof') ? 1 : 0;
}
/** Quarter-turns a stair, chair or door is drawn at. */
const FACING = new Uint8Array(256);
for (const id of BLOCKS_BY_ID.keys()) FACING[id] = facingOf(id);
// Water of any kind, flowing water, and the still water flowing water is
// drawn with — see emitFlowingWater.
const IS_WATER = new Uint8Array(256);
const IS_FLOWING = new Uint8Array(256);
for (let id = 1; id < 256; id++) {
  IS_WATER[id] = isWater(id) ? 1 : 0;
  IS_FLOWING[id] = isFlowing(id) ? 1 : 0;
}
const STILL_WATER = 11;
/** How high flowing water stands in its cell, by level 1..7. */
const flowHeight = (level) => 0.1 + level * 0.11;
/** The same for lava, which runs thicker and shorter: level 1..3. */
const IS_LAVA = new Uint8Array(256);
const IS_LAVA_FLOW = new Uint8Array(256);
for (let id = 1; id < 256; id++) {
  IS_LAVA[id] = isLava(id) ? 1 : 0;
  IS_LAVA_FLOW[id] = isLavaFlow(id) ? 1 : 0;
}
/** Each fluid's cells, running cells, how high a running cell stands, and the source it's drawn as. */
const FLUIDS = [
  { any: IS_WATER, flow: IS_FLOWING, height: (id) => flowHeight(waterLevel(id)), still: STILL_WATER },
  { any: IS_LAVA, flow: IS_LAVA_FLOW, height: (id) => 0.25 + lavaLevel(id) * 0.2, still: LAVA },
];
// A mask bit marking a face that looks into a sealed cave.
const DEEP = 0x100;
/** Mask flag: a leaf face open to the air — drawn on its own (playtest, P2). */
const EXPOSED = 0x200;
const PAD_STRIDE = [1, PAD * PAD, PAD];

const materialCache = new Map();
const colorCache = new Map();

// Every opaque block type shares one material, because the block's colour is
// already baked into its vertices. That lets a whole chunk's opaque geometry go
// out as a single draw call instead of one per block type.
const OPAQUE_KEY = 'opaque';
const opaqueMaterial = withBlockTextures(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }));

/**
 * What a non-cube block (slab, stair, table, chair, rug) actually draws with
 * — untextured, unlike the terrain material above, since a handful of small
 * boxes per chunk doesn't carry the same "a whole floor is one draw call"
 * pressure that made baking texture tiles into the block material worth it.
 */
const propMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
// The lit parts of a prop — a lantern's glass, a chandelier's candles — are
// drawn at their own colour whatever light is on them, so they still glow in
// the dark of night.
const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
// Glass in a prop — a framed window's pane, a firefly lantern's case: seen
// through, drawn after everything solid.
const paneMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.38, depthWrite: false });
/** A box's own colour (an iron frame on a lantern), or the block's. */
const hexColor = new Map();
function colorOfHex(hex) {
  let c = hexColor.get(hex);
  if (!c) {
    const t = new THREE.Color(hex);
    c = { r: t.r, g: t.g, b: t.b };
    hexColor.set(hex, c);
  }
  return c;
}

function bufferKeyFor(blockId) {
  return isTransparent(blockId) ? blockId : OPAQUE_KEY;
}

/**
 * Teaches a stock Lambert material to read the layered texture.
 *
 * Three's own materials take one flat texture, and a flat texture cannot hold
 * twenty-three tiles that each have to repeat across a merged quad. So the
 * shader is patched: a `layer` attribute rides through to the fragment stage
 * and picks the slice, and `fract` on the UV does the tiling within it.
 *
 * A patch rather than a material of our own, because everything else Lambert
 * does — the lighting, the fog that sells the distance — is wanted exactly as
 * it is. A layer of -1 means a material with no recipe, and it is left alone.
 */
/** How far a texel's slope tilts the surface — how deep the depth looks. */
const BUMP_STRENGTH = 1.6;

function withBlockTextures(mat) {
  const { texture, bumps } = blockTextureArray();
  if (!texture) return mat;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.blockTiles = { value: texture };
    shader.uniforms.blockBumps = { value: bumps };
    // Our own attribute names and our own varyings. Three only declares `uv`
    // and `vMapUv` for a material that has a `map`, and this one deliberately
    // does not have one — the tiles are an array, which `map` cannot hold. The
    // first attempt leaned on those and the shader would not compile at all.
    shader.vertexShader = `
      attribute vec2 tileUv;
      attribute float layer;
      varying vec2 vTileUv;
      varying float vLayer;
      ${shader.vertexShader}
    `.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vTileUv = tileUv;
      vLayer = layer;
    `);
    // Injected after the vertex colour has been folded in, so the tile shades
    // the colour the block actually ended up — variation and all — rather than
    // the flat registry colour.
    shader.fragmentShader = `
      precision highp sampler2DArray;
      uniform sampler2DArray blockTiles;
      uniform sampler2DArray blockBumps;
      varying vec2 vTileUv;
      varying float vLayer;
      ${shader.fragmentShader}
    `.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      // Depth. Requested directly: cobblestone "can you give it some depth
      // or 3d texture like the tiles?" Real stones in the mesh would be
      // thousands of triangles on every cobbled wall and mountainside, so
      // the depth is in the light instead: each texel has a height (see
      // BlockTextures.packBumps) and the surface is tilted by its slope, so
      // a stone catches the sun on one side and falls into shade on the
      // other, and moves with the sun through the day. The slope is taken
      // texel to texel, not per screen pixel, so it is blocky like
      // everything else and doesn't crawl as you move.
      {
        // The face's own directions for the tile's across and up, from how
        // the position and the tile coordinates change over the screen.
        vec3 dp1 = dFdx(-vViewPosition), dp2 = dFdy(-vViewPosition);
        vec2 duv1 = dFdx(vTileUv), duv2 = dFdy(vTileUv);
        if (vLayer > -0.5) {
          vec2 uvT = fract(vTileUv);
          vec4 here = textureLod(blockBumps, vec3(uvT, vLayer), 0.0);
          if (here.a > 0.5) {
            const float TEXEL = 1.0 / 16.0;
            float hx = textureLod(blockBumps, vec3(uvT + vec2(TEXEL, 0.0), vLayer), 0.0).r
                     - textureLod(blockBumps, vec3(uvT - vec2(TEXEL, 0.0), vLayer), 0.0).r;
            float hy = textureLod(blockBumps, vec3(uvT + vec2(0.0, TEXEL), vLayer), 0.0).r
                     - textureLod(blockBumps, vec3(uvT - vec2(0.0, TEXEL), vLayer), 0.0).r;
            vec3 N = normal;
            vec3 dp2perp = cross(dp2, N), dp1perp = cross(N, dp1);
            vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
            vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
            float invmax = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12));
            normal = normalize(N - (T * hx + B * hy) * invmax * ${BUMP_STRENGTH.toFixed(2)});
          }
        }
      }
    `).replace('#include <color_fragment>', `
      #include <color_fragment>
      if (vLayer > -0.5) {
        vec4 tile = texture(blockTiles, vec3(fract(vTileUv), vLayer));
        // A leaf's holes: nothing drawn there, so you see through.
        if (tile.a < 0.5) discard;
        diffuseColor.rgb *= tile.rgb;
      }
    `);
  };
  // Changing the shader invalidates anything already compiled for it.
  mat.customProgramCacheKey = () => 'block-tiles-v3';
  mat.needsUpdate = true;
  return mat;
}

function getMaterial(key) {
  if (key === OPAQUE_KEY) return opaqueMaterial;
  if (materialCache.has(key)) return materialCache.get(key);
  const cfg = BLOCKS_BY_ID.get(key);
  const mat = withBlockTextures(new THREE.MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: cfg?.opacity ?? 1,
    depthWrite: false,
  }));
  materialCache.set(key, mat);
  return mat;
}

/*
 * Leaves (playtest, P2). Reported directly: "When looking at a forest, I
 * think the leaves lack shadows and light because they look like a mesh of
 * green. Maybe some different tones of green and more contrast between
 * surfaces." So a leaf block is never merged with its neighbours into one
 * big flat quad — each is drawn on its own, with a tone of its own (lighter,
 * darker, warmer, cooler), a lean of hue shared by the leaves of one tree,
 * harder shade on its undersides and sides, and darker the deeper it sits
 * in the canopy.
 */
const LEAFY = new Uint8Array(256);
for (const id of [5, 42, 44]) LEAFY[id] = 1;
/** Face shade for leaves: the same light, more contrast than stone. */
const LEAF_SHADE = { side: 0.78, under: 0.42 };
/** How much each solid neighbour darkens a leaf, and leaves two above it. */
const LEAF_BURIED = 0.065, LEAF_UNDER_CANOPY = 0.08;
/** The faces inside a canopy, between leaf and leaf. */
const LEAF_INNER = 0.62;
/** The six cells round one, as steps through the padded volume. */
const NEIGHBOURS = [1, -1, PAD * PAD, -(PAD * PAD), PAD, -PAD];

/**
 * How much each material's colour is allowed to wander, as a fraction.
 *
 * Ground gets the most: grass and moss are the blocks you see by the thousand,
 * and a field of exactly one green is the thing that makes a voxel world look
 * printed. Worked stone and glass get none — a brick wall with mottled bricks
 * looks damaged rather than natural.
 */
const VARIATION = new Float32Array(256);
for (const [id, amount] of Object.entries({
  1: 0.26, 22: 0.26,           // grass, moss — the big open surfaces
  2: 0.18, 21: 0.15,           // dirt, farmland
  6: 0.16, 23: 0.20, 24: 0.15, // sand, gravel, clay
  3: 0.17, 8: 0.19,            // stone, cobblestone
  5: 0.28, 42: 0.28, 44: 0.28, // leaves vary most of all — every kind of them
  4: 0.13, 41: 0.13, 43: 0.13, // wood a little
  12: 0.07,                    // snow, barely — it is meant to read as clean
})) VARIATION[id] = amount;


/**
 * A repeatable wobble from a block's position, in 0..1.
 *
 * Two scales added together: a broad one that makes patches of a field lighter
 * or darker than their neighbours, and a fine one so no two adjacent blocks
 * are identical. Cheap integer hashing — this runs once per quad on every
 * chunk build and cannot afford to be interesting.
 */
function patchNoise(x, z) {
  const fine = hashInt(x, z);
  const broad = hashInt(x >> 3, z >> 3);
  return fine * 0.4 + broad * 0.6;
}

function hash3(x, y, z) {
  return hashInt(x * 3 + Math.imul(y | 0, 0x2f), z - Math.imul(y | 0, 0x61));
}

function hashInt(x, z) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function baseColor(blockId) {
  let c = colorCache.get(blockId);
  if (!c) {
    const srgb = new THREE.Color(BLOCKS_BY_ID.get(blockId)?.color ?? 0xffffff);
    c = { r: srgb.r, g: srgb.g, b: srgb.b };
    colorCache.set(blockId, c);
  }
  return c;
}

/**
 * One material's worth of quads for a chunk, in typed arrays that double when
 * full — pushing into plain JS arrays and converting at the end was a third
 * of the time it took to build a chunk, most of it in the conversion and the
 * garbage it left.
 */
class QuadBuffer {
  constructor() {
    this.quads = 0;
    this.cap = 0;
    this.grow(64);
  }

  grow(cap) {
    const copy = (Type, old, per) => {
      const next = new Type(cap * per);
      if (old) next.set(old.subarray(0, this.quads * per));
      return next;
    };
    this.position = copy(Float32Array, this.position, 12);
    this.normal = copy(Float32Array, this.normal, 12);
    this.color = copy(Float32Array, this.color, 12);
    this.uv = copy(Float32Array, this.uv, 8);
    this.layer = copy(Float32Array, this.layer, 4);
    this.cap = cap;
  }

  /** The quads as geometry: four vertices each, two triangles each. */
  toGeometry() {
    const q = this.quads;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.position.slice(0, q * 12), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.normal.slice(0, q * 12), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.color.slice(0, q * 12), 3));
    geo.setAttribute('tileUv', new THREE.BufferAttribute(this.uv.slice(0, q * 8), 2));
    geo.setAttribute('layer', new THREE.BufferAttribute(this.layer.slice(0, q * 4), 1));
    // Winding is already baked into the vertex order (see emitQuad), so the
    // index is the same 0-1-2 0-2-3 pattern for every quad.
    const index = q * 4 > 65535 ? new Uint32Array(q * 6) : new Uint16Array(q * 6);
    for (let k = 0, b = 0, o = 0; k < q; k++, b += 4, o += 6) {
      index[o] = b; index[o + 1] = b + 1; index[o + 2] = b + 2;
      index[o + 3] = b; index[o + 4] = b + 2; index[o + 5] = b + 3;
    }
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeBoundingSphere();
    return geo;
  }
}

let LAYER = null; // block id -> texture layer, filled on first use
function layerTable() {
  if (LAYER) return LAYER;
  LAYER = new Float32Array(256);
  for (let id = 0; id < 256; id++) LAYER[id] = layerFor(id);
  return LAYER;
}
let TOP_LAYER = null; // the same for top and bottom faces (a log's rings)
function topLayerTable() {
  if (TOP_LAYER) return TOP_LAYER;
  TOP_LAYER = new Float32Array(256);
  for (let id = 0; id < 256; id++) TOP_LAYER[id] = topLayerFor(id);
  return TOP_LAYER;
}

export class ChunkMesher {
  constructor(scene) {
    this.scene = scene;
    this.tone = [0, 0, 0]; // leafTone's answer, reused rather than allocated per face
    this.activeMeshes = new Set();
    this.origin = [0, 0, 0];
  }

  /**
   * Drops every mesh this mesher has added. Replacing the World creates fresh
   * Chunk objects with no mesh references, so without this the previous world's
   * geometry stays in the scene forever.
   */
  clearAll() {
    for (const mesh of this.activeMeshes) this.disposeMesh(mesh);
    this.activeMeshes.clear();
  }

  disposeMesh(mesh) {
    this.scene.remove(mesh);
    mesh.geometry.dispose(); // geometry is rebuilt per chunk, so it must be freed
  }

  /**
   * Greedy meshing: sweeps each axis, builds a per-slice mask of visible faces,
   * then merges runs of the same block type into the largest rectangles it can.
   * A flat 16x16 floor collapses from 256 quads to 1, which is what makes large
   * worlds affordable — naive per-face meshing would drown a phone.
   */
  /**
   * Throws away a chunk's meshes without building new ones.
   *
   * What an endless world needs when you walk far enough that a chunk is
   * forgotten: the blocks go, and the geometry on the GPU has to go with them
   * or the memory grows for as long as you keep walking.
   */
  remove(chunk) {
    if (chunk?.mesh) {
      for (const mesh of chunk.mesh.values()) {
        this.disposeMesh(mesh);
        this.activeMeshes.delete(mesh);
      }
      chunk.mesh = null;
    }
    if (chunk?.propMesh) {
      this.disposeMesh(chunk.propMesh);
      this.activeMeshes.delete(chunk.propMesh);
      chunk.propMesh = null;
    }
  }

  rebuild(world, chunk) {
    if (chunk.mesh || chunk.propMesh) this.remove(chunk);

    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const byType = new Map();
    const deepByType = new Map();

    // Nothing above the chunk's own highest block can have a face of this
    // chunk's, and with the world 200 tall that's routinely half the column
    // — so the sweep stops there.
    const top = this.fillPadded(world, chunk);
    this.top = top;
    const lo = this.bottom;
    const dims = [CHUNK_SIZE, top - lo + 1, CHUNK_SIZE];
    const vol = this.padded;
    const S = PAD_STRIDE;
    const sky = this.skyFill(top);
    const yBase = lo * S[1];
    this.yBase = yBase;
    this.baseX = baseX;
    this.baseZ = baseZ;
    this.yOffset = lo;
    this.releaseBuffers();

    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3;
      const v = (d + 2) % 3;
      const du = dims[u], dv = dims[v];
      const mask = this.maskFor(du * dv);

      for (const sign of [1, -1]) {
        const step = sign * S[d];
        for (let slice = 0; slice < dims[d]; slice++) {
          // --- build the visible-face mask for this slice ---
          let n = 0;
          for (let j = 0; j < dv; j++) {
            let idx = yBase + (slice + 1) * S[d] + (j + 1) * S[v] + S[u];
            for (let i = 0; i < du; i++, n++, idx += S[u]) {
              const self = vol[idx];
              // A shaped block (slab, stair, furniture) never emits its own
              // cube face — its real geometry comes from buildProps below —
              // and it doesn't hide a neighbour's face either: it only fills
              // part of its cell, so the rest of that face is on show.
              if (self <= 0 || !IS_CUBE[self]) { mask[n] = 0; continue; }
              const other = vol[idx + step];
              let face;
              if (other === AIR) face = self;
              else if (other === SOLID_SENTINEL) face = 0;
              else if (IS_TRANSPARENT[self]) face = other !== self ? self : 0;
              else face = IS_TRANSPARENT[other] || !IS_CUBE[other] || CUTOUT[other] ? self : 0;
              // A face is only ever seen from the cell it faces. If that cell
              // can't be reached from open sky, the face belongs to a sealed
              // cave and goes in the deep mesh — see skyFill.
              // A leaf's outside face — open air beyond it — is drawn on its
              // own, with its own tone (see leafTone); one facing another
              // leaf, seen only through the gaps, still merges.
              if (face && LEAFY[self] && other === AIR) face |= EXPOSED;
              mask[n] = face && !sky[idx + step] ? face | DEEP : face;
            }
          }

          // --- merge the mask into maximal rectangles ---
          n = 0;
          for (let j = 0; j < dv; j++) {
            for (let i = 0; i < du;) {
              const id = mask[n];
              if (id === 0) { i++; n++; continue; }

              let w = 1;
              const single = id & EXPOSED;
              while (!single && i + w < du && mask[n + w] === id) w++;

              let h = 1;
              grow: while (!single && j + h < dv) {
                for (let k = 0; k < w; k++) {
                  if (mask[n + k + h * du] !== id) break grow;
                }
                h++;
              }

              this.emitQuad(id & DEEP ? deepByType : byType, id & 0xff, d, u, v, sign, slice, i, j, w, h, id & EXPOSED);

              for (let l = 0; l < h; l++) {
                for (let k = 0; k < w; k++) mask[n + k + l * du] = 0;
              }
              i += w; n += w;
            }
          }
        }
      }
    }

    for (const fluid of FLUIDS) this.emitFlowing(byType, lo, top, fluid);

    const meshes = new Map();
    for (const [deep, types] of [[false, byType], [true, deepByType]]) {
      for (const [key, buf] of types) {
        // The surface detail rides along as tileUv (where on its tile each
        // corner sits) and layer (which material's tile). A quad that greedy
        // meshing merged across ten blocks gets a UV running 0..10, so the
        // tile repeats rather than being stretched over the whole floor.
        const geo = buf.toGeometry();
        const mesh = new THREE.Mesh(geo, getMaterial(key));
        // Greedy quads are emitted in chunk-local space, so the mesh carries
        // the chunk's world offset. Without this every chunk draws at the
        // origin and the whole map piles up in one column.
        mesh.position.set(baseX, 0, baseZ);
        mesh.frustumCulled = true;
        mesh.userData.chunk = chunk;
        mesh.userData.deep = deep;
        this.scene.add(mesh);
        this.activeMeshes.add(mesh);
        meshes.set(deep ? `deep:${key}` : key, mesh);
      }
    }

    chunk.mesh = meshes;
    chunk.dirty = false;
    this.buildProps(chunk);
  }

  /**
   * Copies the chunk plus a one-block border from its neighbours into one
   * flat array, so the sweep reads plain indexed memory instead of calling
   * through chunk.get / world.getBlock twice per cell. Row y = -1 is the
   * below-the-world sentinel. Returns the highest y with anything in it.
   */
  fillPadded(world, chunk) {
    const H = chunk.height;
    const P2 = PAD * PAD;
    const size = P2 * (H + 2);
    if (!this.padded || this.padded.length < size) this.padded = new Int16Array(size);
    const vol = this.padded;
    const data = chunk.data;
    const C = CHUNK_SIZE, last = C - 1;
    // The four neighbours whose edge columns border this chunk. getChunk
    // makes one that doesn't exist yet in an endless world, same as the
    // world.getBlock this replaced; a fixed world's edge has none, and reads
    // as air there, also the same.
    const west = world.getChunk(chunk.cx - 1, chunk.cz)?.data;
    const east = world.getChunk(chunk.cx + 1, chunk.cz)?.data;
    const north = world.getChunk(chunk.cx, chunk.cz - 1)?.data;
    const south = world.getChunk(chunk.cx, chunk.cz + 1)?.data;
    let top = -1;
    let lowestOpen = -1;
    vol.fill(SOLID_SENTINEL, 0, P2);
    for (let y = 0; y < H; y++) {
      const row = (y + 1) * P2;
      const src = y * C * C;
      vol.fill(AIR, row, row + P2);
      let any = false, open = false;
      for (let lz = 0; lz < C; lz++) {
        const at = row + (lz + 1) * PAD + 1;
        const from = src + lz * C;
        for (let lx = 0; lx < C; lx++) {
          const id = data[from + lx];
          vol[at + lx] = id;
          if (id) any = true;
          if (OPEN[id]) open = true;
        }
        const w = west ? west[from + last] : AIR, e = east ? east[from] : AIR;
        vol[at - 1] = w;
        vol[at + C] = e;
        if (OPEN[w] || OPEN[e]) open = true;
      }
      for (let lx = 0; lx < C; lx++) {
        const n = north ? north[src + last * C + lx] : AIR, so = south ? south[src + lx] : AIR;
        vol[row + lx + 1] = n;
        vol[row + (C + 1) * PAD + lx + 1] = so;
        if (OPEN[n] || OPEN[so]) open = true;
      }
      if (any) top = y;
      if (open && lowestOpen < 0) lowestOpen = y;
    }
    // Below the lowest open cell (this chunk's or the neighbours' edge) is
    // solid rock through and through, with no face in it — the sweep starts
    // just under it rather than at bedrock.
    this.bottom = Math.max(0, Math.min(lowestOpen < 0 ? top : lowestOpen, top) - 1);
    // The row just above the top is read as the neighbour of the topmost
    // faces; when the top is the world's ceiling that row is past the data.
    if (top + 1 >= H) vol.fill(AIR, (H + 1) * P2, (H + 2) * P2);
    return Math.max(top, 0);
  }

  /**
   * Which cells of the padded copy can be reached from open sky, moving
   * through anything that isn't a solid opaque cube.
   *
   * Nearly nine in ten of a chunk's faces are the walls of caves sealed
   * inside the rock, which nobody on the surface can ever see — and they
   * were drawn for every chunk out to the horizon. Faces that look into air
   * this can't reach go in a separate deep mesh, which Game only draws
   * near the player (see DEEP_RANGE there). A cave that opens to the
   * surface is reached, so its walls stay in the ordinary mesh.
   */
  skyFill(top) {
    const P2 = PAD * PAD;
    if (!this.sky || this.sky.length < this.padded.length) {
      this.sky = new Uint8Array(this.padded.length);
      this.stack = new Int32Array(this.padded.length);
    }
    const sky = this.sky, stack = this.stack, vol = this.padded;
    sky.fill(0, 0, P2 * (top + 3)); // rows y = -1 .. top + 1
    let sp = 0;
    const seedRow = (top + 2) * P2;
    for (let idx = seedRow; idx < seedRow + P2; idx++) {
      const id = vol[idx];
      if (id >= 0 && OPEN[id]) { sky[idx] = 1; stack[sp++] = idx; }
    }
    while (sp) {
      const idx = stack[--sp];
      const px = idx % PAD;
      const pz = ((idx / PAD) | 0) % PAD;
      const row = (idx / P2) | 0;
      if (px > 0) sp = visit(idx - 1, sp);
      if (px < PAD - 1) sp = visit(idx + 1, sp);
      if (pz > 0) sp = visit(idx - PAD, sp);
      if (pz < PAD - 1) sp = visit(idx + PAD, sp);
      if (row > 1) sp = visit(idx - P2, sp);
      if (row < top + 2) sp = visit(idx + P2, sp);
    }
    return sky;

    function visit(n, at) {
      if (sky[n]) return at;
      const id = vol[n];
      if (id < 0 || !OPEN[id]) return at;
      sky[n] = 1;
      stack[at] = n;
      return at + 1;
    }
  }

  /**
   * Flowing water (and lava), drawn as low as it is weak and full height
   * where it's falling, into the same mesh and material as the still source
   * it runs from. Only the faces that show: none against solid ground or
   * against the same fluid standing at least as high.
   */
  emitFlowing(byType, lo, top, { any, flow, height, still }) {
    const vol = this.padded, P2 = PAD * PAD;
    const heightOf = (i) => {
      const id = vol[i];
      if (!any[id]) return 0;
      if (!flow[id] || any[vol[i + P2]]) return 1;
      return height(id);
    };
    const solid = (id) => id > 0 && IS_CUBE[id] && !IS_TRANSPARENT[id];
    const col = baseColor(still);
    const layer = layerTable()[still];
    const key = bufferKeyFor(still);
    let buf = null;
    for (let y = lo; y <= top; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const idx = (y + 1) * P2 + (lz + 1) * PAD + lx + 1;
          if (!flow[vol[idx]]) continue;
          if (!buf) {
            buf = byType.get(key);
            if (!buf) { buf = this.takeBuffer(); byType.set(key, buf); }
          }
          const h = heightOf(idx);
          const x0 = lx, x1 = lx + 1, y0 = y, y1 = y + h, z0 = lz, z1 = lz + 1;
          const face = (pts, n, shade, w, hh) => this.pushQuad(buf, pts, n, col, shade, layer, w, hh);
          if (!any[vol[idx + P2]]) face([x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0], [0, 1, 0], SHADE.py, 1, 1);
          if (vol[idx - P2] === AIR) face([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], [0, -1, 0], SHADE.ny, 1, 1);
          const side = (off) => !solid(vol[idx + off]) && heightOf(idx + off) < h;
          if (side(1)) face([x1, y0, z0, x1, y1, z0, x1, y1, z1, x1, y0, z1], [1, 0, 0], SHADE.px, 1, h);
          if (side(-1)) face([x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0], SHADE.nx, 1, h);
          if (side(PAD)) face([x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1], SHADE.pz, 1, h);
          if (side(-PAD)) face([x0, y0, z0, x0, y1, z0, x1, y1, z0, x1, y0, z0], [0, 0, -1], SHADE.nz, 1, h);
        }
      }
    }
  }

  /** One quad, its corners already in outward-facing order, into a buffer. */
  pushQuad(buf, pts, [nx, ny, nz], col, shade, layer, w, h) {
    if (buf.quads === buf.cap) buf.grow(buf.cap * 2);
    const q = buf.quads, p = q * 12;
    buf.position.set(pts, p);
    const r = col.r * shade, g = col.g * shade, b = col.b * shade;
    for (let k = 0; k < 12; k += 3) {
      buf.normal[p + k] = nx; buf.normal[p + k + 1] = ny; buf.normal[p + k + 2] = nz;
      buf.color[p + k] = r; buf.color[p + k + 1] = g; buf.color[p + k + 2] = b;
    }
    buf.uv.set([0, 0, w, 0, w, h, 0, h], q * 8);
    buf.layer.fill(layer, q * 4, q * 4 + 4);
    buf.quads = q + 1;
  }

  /**
   * Quad buffers are kept between rebuilds rather than grown from nothing
   * every time: toGeometry copies out exactly what it needs, so the same
   * big arrays serve every chunk.
   */
  takeBuffer() {
    const buf = this.spare?.pop() ?? new QuadBuffer();
    buf.quads = 0;
    (this.inUse ??= []).push(buf);
    return buf;
  }

  releaseBuffers() {
    if (!this.inUse?.length) return;
    (this.spare ??= []).push(...this.inUse);
    this.inUse.length = 0;
  }

  maskFor(n) {
    if (!this.mask || this.mask.length < n) this.mask = new Int32Array(n);
    return this.mask;
  }

  /**
   * The non-cube half of a chunk's geometry: every slab, stair and piece of
   * furniture, as a handful of small boxes each rather than the greedy cube
   * pass above — there's no run of ten identical chairs to merge the way a
   * floor of stone merges, so plain per-block boxes cost nothing extra.
   */
  buildProps(chunk) {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const buf = { position: [], normal: [], color: [], index: [] };
    const glow = { position: [], normal: [], color: [], index: [] };
    const pane = { position: [], normal: [], color: [], index: [] };
    // Reads the padded copy rebuild just made, so a fence at a chunk's edge
    // sees the fence in the next chunk and joins up with it.
    const vol = this.padded, P2 = PAD * PAD;
    for (let ly = this.bottom; ly <= this.top; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const idx = (ly + 1) * P2 + (lz + 1) * PAD + lx + 1;
          const id = vol[idx];
          // Running water and lava are drawn with their sources (emitFlowing).
          if (id <= 0 || (IS_CUBE[id] && !OVERLAY[id]) || IS_FLOWING[id] || IS_LAVA_FLOW[id]) continue;
          const shape = OVERLAY[id] ?? shapeOf(id);
          if (SLOPED[id]) {
            const at = (dx, dz) => {
              const n = vol[idx + dx + dz * PAD];
              return n > 0 && SLOPE[n] ? { kind: SLOPE[n], facing: FACING[n] } : null;
            };
            const corner = SLOPE[id] ? cornerOf(SLOPE[id], FACING[id], at) : null;
            // A roof piece over a solid wall fills in down to it, in the
            // wall's colour; anywhere else it's a shell with timber under it.
            const below = vol[idx - P2];
            const filled = below > 0 && IS_CUBE[below] && !IS_TRANSPARENT[below];
            const style = roofPart(id)?.mat === 1 ? 'slate' : 'clay';
            const g = slopeGeometry(shape, FACING[id], corner, { filled, style });
            const col = baseColor(id), belowCol = filled ? baseColor(below) : col;
            const stair = shape === 'stair';
            for (const b of g.boxes) {
              // A stair's step: its tone by how high it is, its faces by STAIR_SHADE.
              const tone = stair ? STAIR_STEP_TONE[Math.max(0, Math.min(2, Math.round(b.maxY * 3) - 1))] : 1;
              this.emitPropBox(buf, lx + b.minX, ly + b.minY, lz + b.minZ, lx + b.maxX, ly + b.maxY, lz + b.maxZ, col, false, stair ? STAIR_SHADE : null, tone);
            }
            for (const f of g.faces) {
              const c = f.color === 'below' ? belowCol : f.color != null ? colorOfHex(f.color) : col;
              this.emitFace(buf, lx, ly, lz, f, c);
            }
            continue;
          }
          const boxes = shape === 'wall'
            ? wallBoxes({
              px: JOINS_FENCE[vol[idx + 1]], nx: JOINS_FENCE[vol[idx - 1]],
              pz: JOINS_FENCE[vol[idx + PAD]], nz: JOINS_FENCE[vol[idx - PAD]],
            })
            : shape === 'pillar'
              ? pillarBoxes({ base: !IS_PILLAR[vol[idx - P2]], capital: !IS_PILLAR[vol[idx + P2]] })
            : shape === 'fence' || shape === 'gate' || shape === 'gate_open'
            ? fenceBoxes(shape, {
              px: JOINS_FENCE[vol[idx + 1]], nx: JOINS_FENCE[vol[idx - 1]],
              pz: JOINS_FENCE[vol[idx + PAD]], nz: JOINS_FENCE[vol[idx - PAD]],
            })
            : IS_RUG[id]
              ? rugBoxes({
                px: IS_RUG[vol[idx + 1]], nx: IS_RUG[vol[idx - 1]],
                pz: IS_RUG[vol[idx + PAD]], nz: IS_RUG[vol[idx - PAD]],
              })
              : turn(boxesFor(shape), FACING[id]);
          const col = baseColor(id);
          for (const b of boxes) {
            this.emitPropBox(b.glow ? glow : b.pane ? pane : buf, lx + b.minX, ly + b.minY, lz + b.minZ, lx + b.maxX, ly + b.maxY, lz + b.maxZ,
              b.color != null ? colorOfHex(b.color) : col, b.glow);
          }
        }
      }
    }
    if (!buf.position.length && !glow.position.length && !pane.position.length) return;

    // One mesh, three materials: the ordinary lit props, the glowing parts,
    // then the glass.
    const litIndices = buf.index.length;
    for (const part of [glow, pane]) {
      const offset = buf.position.length / 3;
      for (const k of ['position', 'normal', 'color']) for (const v of part[k]) buf[k].push(v);
      for (const i of part.index) buf.index.push(i + offset);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.position, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normal, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.color, 3));
    geo.setIndex(buf.index);
    geo.addGroup(0, litIndices, 0);
    geo.addGroup(litIndices, glow.index.length, 1);
    if (pane.index.length) geo.addGroup(litIndices + glow.index.length, pane.index.length, 2);
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, [propMaterial, glowMaterial, paneMaterial]);
    mesh.position.set(baseX, 0, baseZ);
    mesh.frustumCulled = true;
    mesh.userData.chunk = chunk;
    this.scene.add(mesh);
    this.activeMeshes.add(mesh);
    chunk.propMesh = mesh;
  }

  /**
   * One flat polygon of a sloped piece (see world/slopes.js), shaded by which
   * way it faces the same way a box's faces are.
   */
  emitFace(buf, ox, oy, oz, face, col) {
    const { pts, n } = orient(face.pts, face.out);
    const [nx, ny, nz] = n;
    const shade = (nx * nx * SHADE.px + ny * ny * (ny > 0 ? SHADE.py : SHADE.ny) + nz * nz * SHADE.pz) * (face.tone ?? 1);
    const r = col.r * shade, g = col.g * shade, b = col.b * shade;
    const base = buf.position.length / 3;
    for (const [x, y, z] of pts) {
      buf.position.push(ox + x, oy + y, oz + z);
      buf.normal.push(nx, ny, nz);
      buf.color.push(r, g, b);
    }
    for (let i = 1; i < pts.length - 1; i++) buf.index.push(base, base + i, base + i + 1);
  }

  /**
   * One axis-aligned box, all six faces, in chunk-local space — the same
   * origin/du/dv-and-winding math emitQuad above uses for a full block face,
   * just run over continuous bounds instead of a grid slice, so the winding
   * is proven correct rather than hand-guessed per face.
   */
  emitPropBox(buf, x0, y0, z0, x1, y1, z1, col, flat = false, shades = null, tone = 1) {
    const S = shades ?? SHADE;
    const min = [x0, y0, z0], max = [x1, y1, z1];
    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3, v = (d + 2) % 3;
      for (const sign of [1, -1]) {
        const origin = [0, 0, 0];
        origin[d] = sign > 0 ? max[d] : min[d];
        origin[u] = min[u];
        origin[v] = min[v];
        const du = [0, 0, 0]; du[u] = max[u] - min[u];
        const dv = [0, 0, 0]; dv[v] = max[v] - min[v];

        const nx = d === 0 ? sign : 0, ny = d === 1 ? sign : 0, nz = d === 2 ? sign : 0;
        // Something glowing is lit from inside: barely shaded at all.
        const shade = tone * (flat ? (d === 1 && sign < 0 ? 0.9 : 1)
          : d === 1 ? (sign > 0 ? S.py : S.ny) : d === 0 ? S.px : S.pz);
        const r = col.r * shade, g = col.g * shade, b = col.b * shade;

        const base = buf.position.length / 3;
        buf.position.push(
          origin[0], origin[1], origin[2],
          origin[0] + du[0], origin[1] + du[1], origin[2] + du[2],
          origin[0] + du[0] + dv[0], origin[1] + du[1] + dv[1], origin[2] + du[2] + dv[2],
          origin[0] + dv[0], origin[1] + dv[1], origin[2] + dv[2],
        );
        for (let k = 0; k < 4; k++) {
          buf.normal.push(nx, ny, nz);
          buf.color.push(r, g, b);
        }
        if (sign > 0) buf.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
        else buf.index.push(base, base + 3, base + 2, base, base + 2, base + 1);
      }
    }
  }

  /**
   * The colour of one leaf face: its block's own tone, its tree's lean of
   * hue, harder face shade than stone gets, and darker the more of it is
   * buried — leaves or wood packed round it, and canopy over its head.
   */
  leafTone(col, d, u, v, sign, slice, i, j) {
    const S = PAD_STRIDE, vol = this.padded;
    const idx = this.yBase + (slice + 1) * S[d] + (j + 1) * S[v] + (i + 1) * S[u];
    const at = (axis) => (axis === d ? slice : axis === u ? i : j);
    const x = this.baseX + at(0), y = at(1) + this.yOffset, z = this.baseZ + at(2);

    const face = d === 1 ? (sign > 0 ? 1 : LEAF_SHADE.under) : LEAF_SHADE.side;
    let buried = 0;
    for (let k = 0; k < 6; k++) if (vol[idx + NEIGHBOURS[k]] > 0) buried++;
    const canopy = vol[idx + 2 * S[1]] > 0 ? LEAF_UNDER_CANOPY : 0;
    const light = face * (1 - LEAF_BURIED * buried - canopy) * (0.8 + 0.4 * hash3(x, y, z));
    // A lean of hue per tree (near enough: per few blocks), and a little
    // per leaf — warmer here, cooler there.
    const lean = (hashInt(x >> 2, z >> 2) - 0.5) * 0.2 + (hash3(z, x, y) - 0.5) * 0.1;
    const t = this.tone;
    t[0] = col.r * light * (1 + lean); t[1] = col.g * light * (1 + lean * 0.25); t[2] = col.b * light * (1 - lean);
    return t;
  }

  emitQuad(byType, id, d, u, v, sign, slice, i, j, w, h, exposed = 0) {
    const key = bufferKeyFor(id);
    let buf = byType.get(key);
    if (!buf) {
      buf = this.takeBuffer();
      byType.set(key, buf);
    }
    if (buf.quads === buf.cap) buf.grow(buf.cap * 2);

    const o = this.origin;
    o[d] = slice + (sign > 0 ? 1 : 0); // the face sits on the far side for +d
    o[u] = i;
    o[v] = j;
    o[1] += this.yOffset;
    const ox = o[0], oy = o[1], oz = o[2];
    const ux = u === 0 ? w : 0, uy = u === 1 ? w : 0, uz = u === 2 ? w : 0;
    const vx = v === 0 ? h : 0, vy = v === 1 ? h : 0, vz = v === 2 ? h : 0;

    // Reverse the winding for negative faces so both stay counter-clockwise
    // seen from outside and back-face culling keeps working. Baked into the
    // vertex order rather than the index, so every quad shares one index
    // pattern: a positive face runs origin, +u, +u+v, +v; a negative one
    // runs origin, +v, +u+v, +u.
    let ax, ay, az, bx, by, bz;
    if (sign > 0) { ax = ux; ay = uy; az = uz; bx = vx; by = vy; bz = vz; }
    else { ax = vx; ay = vy; az = vz; bx = ux; by = uy; bz = uz; }

    const q = buf.quads;
    const P = buf.position, p = q * 12;
    P[p] = ox; P[p + 1] = oy; P[p + 2] = oz;
    P[p + 3] = ox + ax; P[p + 4] = oy + ay; P[p + 5] = oz + az;
    P[p + 6] = ox + ux + vx; P[p + 7] = oy + uy + vy; P[p + 8] = oz + uz + vz;
    P[p + 9] = ox + bx; P[p + 10] = oy + by; P[p + 11] = oz + bz;

    const nx = d === 0 ? sign : 0, ny = d === 1 ? sign : 0, nz = d === 2 ? sign : 0;
    const shade = d === 1 ? (sign > 0 ? SHADE.py : SHADE.ny) : d === 0 ? SHADE.px : SHADE.pz;
    const col = baseColor(id);
    // A patch of ground was one flat colour over hundreds of blocks, which is
    // what made a meadow read as a painted plane rather than a field.
    //
    // Two wobbles, both fixed to the block's position so nothing shimmers as
    // you walk. One moves the lightness; the other pulls the channels apart a
    // little, which is what turns "the same green, dimmer" into "a different
    // green". Brightness alone left a field looking like one colour under
    // patchy cloud — the hue has to move as well, or it is still one colour.
    const vary = VARIATION[id];
    let r = col.r * shade, g = col.g * shade, b = col.b * shade;
    if (LEAFY[id] && exposed) {
      [r, g, b] = this.leafTone(col, d, u, v, sign, slice, i, j);
    } else if (LEAFY[id]) {
      // Inside the canopy, glimpsed through its gaps: in its shade.
      r *= LEAF_INNER; g *= LEAF_INNER; b *= LEAF_INNER;
    } else if (vary) {
      const light = 1 + vary * (patchNoise(ox, oz) - 0.5);
      const skew = vary * 0.55 * (patchNoise(oz + 8191, ox - 3137) - 0.5);
      r *= light - skew;
      g *= light + skew * 0.7;
      b *= light - skew * 0.35;
    }

    const N = buf.normal, C = buf.color;
    for (let k = 0; k < 12; k += 3) {
      N[p + k] = nx; N[p + k + 1] = ny; N[p + k + 2] = nz;
      C[p + k] = r; C[p + k + 1] = g; C[p + k + 2] = b;
    }
    const layer = (d === 1 ? topLayerTable() : layerTable())[id];
    const L = buf.layer, l = q * 4;
    L[l] = layer; L[l + 1] = layer; L[l + 2] = layer; L[l + 3] = layer;
    // Corners of the quad in tile space: 0,0 to w,h along u and v, so one
    // tile covers one block however many blocks the quad ended up spanning.
    // They follow the vertex order above, which swaps u and v for a
    // negative face.
    //
    // A face across x has u running up the world (y) and v along it, so
    // there the tile is laid the other way round: its across always runs
    // across the wall and its up always up. Without the swap, bark ran
    // sideways and brick courses stood on end on every east and west face
    // — a log looked like planks.
    const U = buf.uv, t = q * 8;
    const swap = d === 0;
    const put = (k, a, b) => { U[t + k] = swap ? b : a; U[t + k + 1] = swap ? a : b; };
    if (sign > 0) {
      put(0, 0, 0); put(2, w, 0); put(4, w, h); put(6, 0, h);
    } else {
      put(0, 0, 0); put(2, 0, h); put(4, w, h); put(6, w, 0);
    }
    buf.quads = q + 1;
  }
}
