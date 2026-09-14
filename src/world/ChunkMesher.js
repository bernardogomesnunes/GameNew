import * as THREE from 'three';
import { blockTextureArray, layerFor } from '../render/BlockTextures.js';
import { BLOCKS_BY_ID, AIR, isTransparent } from '../config/blocks.js';
import { CHUNK_SIZE } from './World.js';

const SOLID_SENTINEL = -1; // below the world: never draw a face against it

// Directional shading baked into vertex colours. Flat-lit voxels read as mush
// without it, and it costs nothing at runtime.
const SHADE = { px: 0.86, nx: 0.86, py: 1.0, ny: 0.6, pz: 0.94, nz: 0.94 };

const materialCache = new Map();
const colorCache = new Map();

// Every opaque block type shares one material, because the block's colour is
// already baked into its vertices. That lets a whole chunk's opaque geometry go
// out as a single draw call instead of one per block type.
const OPAQUE_KEY = 'opaque';
const opaqueMaterial = withBlockTextures(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }));

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
function withBlockTextures(mat) {
  const { texture } = blockTextureArray();
  if (!texture) return mat;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.blockTiles = { value: texture };
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
      varying vec2 vTileUv;
      varying float vLayer;
      ${shader.fragmentShader}
    `.replace('#include <color_fragment>', `
      #include <color_fragment>
      if (vLayer > -0.5) {
        diffuseColor.rgb *= texture(blockTiles, vec3(fract(vTileUv), vLayer)).rgb;
      }
    `);
  };
  // Changing the shader invalidates anything already compiled for it.
  mat.customProgramCacheKey = () => 'block-tiles-v1';
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

/**
 * How much each material's colour is allowed to wander, as a fraction.
 *
 * Ground gets the most: grass and moss are the blocks you see by the thousand,
 * and a field of exactly one green is the thing that makes a voxel world look
 * printed. Worked stone and glass get none — a brick wall with mottled bricks
 * looks damaged rather than natural.
 */
const VARIATION = new Proxy({
  1: 0.26, 22: 0.26,           // grass, moss — the big open surfaces
  2: 0.18, 21: 0.15,           // dirt, farmland
  6: 0.16, 23: 0.20, 24: 0.15, // sand, gravel, clay
  3: 0.17, 8: 0.19,            // stone, cobblestone
  5: 0.28, 4: 0.13,            // leaves vary most of all; wood a little
  12: 0.07,                    // snow, barely — it is meant to read as clean
}, { get: (t, k) => t[k] ?? 0 });

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

/** Whether `selfId` shows a face toward `neighborId`. */
function faceVisible(selfId, neighborId) {
  if (selfId === AIR || selfId === SOLID_SENTINEL) return false;
  if (neighborId === SOLID_SENTINEL) return false;
  if (neighborId === AIR) return true;
  if (isTransparent(selfId)) return neighborId !== selfId;
  return isTransparent(neighborId);
}

export class ChunkMesher {
  constructor(scene) {
    this.scene = scene;
    this.activeMeshes = new Set();
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
    if (!chunk?.mesh) return;
    for (const mesh of chunk.mesh.values()) {
      this.disposeMesh(mesh);
      this.activeMeshes.delete(mesh);
    }
    chunk.mesh = null;
  }

  rebuild(world, chunk) {
    if (chunk.mesh) {
      for (const mesh of chunk.mesh.values()) {
        this.disposeMesh(mesh);
        this.activeMeshes.delete(mesh);
      }
    }

    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const dims = [CHUNK_SIZE, chunk.height, CHUNK_SIZE];
    const byType = new Map();

    const blockAt = (lx, ly, lz) => {
      if (ly < 0) return SOLID_SENTINEL;
      if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && ly < chunk.height) {
        return chunk.get(lx, ly, lz);
      }
      return world.getBlock(baseX + lx, ly, baseZ + lz);
    };

    const pos = [0, 0, 0];
    const neighbor = [0, 0, 0];

    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3;
      const v = (d + 2) % 3;
      const mask = new Int32Array(dims[u] * dims[v]);

      for (const sign of [1, -1]) {
        for (let slice = 0; slice < dims[d]; slice++) {
          // --- build the visible-face mask for this slice ---
          let n = 0;
          for (let j = 0; j < dims[v]; j++) {
            for (let i = 0; i < dims[u]; i++, n++) {
              pos[d] = slice; pos[u] = i; pos[v] = j;
              neighbor[d] = slice + sign; neighbor[u] = i; neighbor[v] = j;
              const self = blockAt(pos[0], pos[1], pos[2]);
              const other = blockAt(neighbor[0], neighbor[1], neighbor[2]);
              mask[n] = faceVisible(self, other) ? self : 0;
            }
          }

          // --- merge the mask into maximal rectangles ---
          n = 0;
          for (let j = 0; j < dims[v]; j++) {
            for (let i = 0; i < dims[u];) {
              const id = mask[n];
              if (id === 0) { i++; n++; continue; }

              let w = 1;
              while (i + w < dims[u] && mask[n + w] === id) w++;

              let h = 1;
              grow: while (j + h < dims[v]) {
                for (let k = 0; k < w; k++) {
                  if (mask[n + k + h * dims[u]] !== id) break grow;
                }
                h++;
              }

              this.emitQuad(byType, id, d, u, v, sign, slice, i, j, w, h);

              for (let l = 0; l < h; l++) {
                for (let k = 0; k < w; k++) mask[n + k + l * dims[u]] = 0;
              }
              i += w; n += w;
            }
          }
        }
      }
    }

    const meshes = new Map();
    for (const [key, buf] of byType) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.position, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normal, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.color, 3));
      // The surface detail: where on its tile each corner sits, and which
      // material's tile that is. A quad that greedy meshing merged across ten
      // blocks gets a UV running 0..10, so the tile repeats rather than being
      // stretched over the whole floor.
      geo.setAttribute('tileUv', new THREE.Float32BufferAttribute(buf.uv, 2));
      geo.setAttribute('layer', new THREE.Float32BufferAttribute(buf.layer, 1));
      geo.setIndex(buf.index);
      geo.computeBoundingSphere();

      const mesh = new THREE.Mesh(geo, getMaterial(key));
      // Greedy quads are emitted in chunk-local space, so the mesh carries the
      // chunk's world offset. Without this every chunk draws at the origin and
      // the whole map piles up in one column.
      mesh.position.set(baseX, 0, baseZ);
      mesh.frustumCulled = true;
      mesh.userData.chunk = chunk;
      this.scene.add(mesh);
      this.activeMeshes.add(mesh);
      meshes.set(key, mesh);
    }

    chunk.mesh = meshes;
    chunk.dirty = false;
  }

  emitQuad(byType, id, d, u, v, sign, slice, i, j, w, h) {
    const key = bufferKeyFor(id);
    let buf = byType.get(key);
    if (!buf) {
      buf = { position: [], normal: [], color: [], uv: [], layer: [], index: [] };
      byType.set(key, buf);
    }

    const origin = [0, 0, 0];
    origin[d] = slice + (sign > 0 ? 1 : 0); // the face sits on the far side for +d
    origin[u] = i;
    origin[v] = j;
    const du = [0, 0, 0]; du[u] = w;
    const dv = [0, 0, 0]; dv[v] = h;

    const base = buf.position.length / 3;
    buf.position.push(
      origin[0], origin[1], origin[2],
      origin[0] + du[0], origin[1] + du[1], origin[2] + du[2],
      origin[0] + du[0] + dv[0], origin[1] + du[1] + dv[1], origin[2] + du[2] + dv[2],
      origin[0] + dv[0], origin[1] + dv[1], origin[2] + dv[2],
    );

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
    const light = 1 + vary * (patchNoise(origin[0], origin[2]) - 0.5);
    const skew = vary * 0.55 * (patchNoise(origin[2] + 8191, origin[0] - 3137) - 0.5);
    const r = col.r * shade * (light - skew);
    const g = col.g * shade * (light + skew * 0.7);
    const b = col.b * shade * (light - skew * 0.35);

    const layer = layerFor(id);
    for (let k = 0; k < 4; k++) {
      buf.normal.push(nx, ny, nz);
      buf.color.push(r, g, b);
      buf.layer.push(layer);
    }
    // Corners of the quad in tile space: 0,0 to w,h, so one tile covers one
    // block however many blocks the quad ended up spanning.
    buf.uv.push(0, 0, w, 0, w, h, 0, h);

    // Reverse the winding for negative faces so both stay counter-clockwise
    // seen from outside and back-face culling keeps working.
    if (sign > 0) buf.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else buf.index.push(base, base + 3, base + 2, base, base + 2, base + 1);
  }
}
