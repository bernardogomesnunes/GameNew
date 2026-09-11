import * as THREE from 'three';
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
const opaqueMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });

function bufferKeyFor(blockId) {
  return isTransparent(blockId) ? blockId : OPAQUE_KEY;
}

function getMaterial(key) {
  if (key === OPAQUE_KEY) return opaqueMaterial;
  if (materialCache.has(key)) return materialCache.get(key);
  const cfg = BLOCKS_BY_ID.get(key);
  const mat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: cfg?.opacity ?? 1,
    depthWrite: false,
  });
  materialCache.set(key, mat);
  return mat;
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
      geo.setIndex(buf.index);
      geo.computeBoundingSphere();

      const mesh = new THREE.Mesh(geo, getMaterial(key));
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
      buf = { position: [], normal: [], color: [], index: [] };
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
    const r = col.r * shade, g = col.g * shade, b = col.b * shade;

    for (let k = 0; k < 4; k++) {
      buf.normal.push(nx, ny, nz);
      buf.color.push(r, g, b);
    }

    // Reverse the winding for negative faces so both stay counter-clockwise
    // seen from outside and back-face culling keeps working.
    if (sign > 0) buf.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else buf.index.push(base, base + 3, base + 2, base, base + 2, base + 1);
  }
}
