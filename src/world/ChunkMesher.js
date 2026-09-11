import * as THREE from 'three';
import { BLOCKS_BY_ID, AIR, isTransparent } from '../config/blocks.js';
import { CHUNK_SIZE } from './World.js';

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const materialCache = new Map();

function getMaterial(blockId) {
  if (materialCache.has(blockId)) return materialCache.get(blockId);
  const cfg = BLOCKS_BY_ID.get(blockId);
  const mat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: !!cfg?.transparent,
    opacity: cfg?.opacity ?? 1,
    depthWrite: !cfg?.transparent,
  });
  materialCache.set(blockId, mat);
  return mat;
}

function hash3(x, y, z) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

const tmpMatrix = new THREE.Matrix4();
const tmpColor = new THREE.Color();

export class ChunkMesher {
  constructor(scene) {
    this.scene = scene;
  }

  rebuild(world, chunk) {
    if (chunk.mesh) {
      for (const mesh of chunk.mesh.values()) {
        this.scene.remove(mesh);
      }
    }
    const byType = new Map();
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let ly = 0; ly < chunk.height; ly++) {
          const id = chunk.get(lx, ly, lz);
          if (id === AIR) continue;
          const wx = baseX + lx, wy = ly, wz = baseZ + lz;
          if (!this.isExposed(world, wx, wy, wz, id)) continue;
          if (!byType.has(id)) byType.set(id, []);
          byType.get(id).push([wx, wy, wz]);
        }
      }
    }

    const meshes = new Map();
    for (const [id, positions] of byType) {
      const mesh = new THREE.InstancedMesh(cubeGeometry, getMaterial(id), positions.length);
      const cfg = BLOCKS_BY_ID.get(id);
      const base = new THREE.Color(cfg?.color ?? 0xffffff);
      for (let i = 0; i < positions.length; i++) {
        const [x, y, z] = positions[i];
        tmpMatrix.makeTranslation(x + 0.5, y + 0.5, z + 0.5);
        mesh.setMatrixAt(i, tmpMatrix);
        const j = 0.9 + hash3(x, y, z) * 0.2;
        tmpColor.setRGB(base.r * j, base.g * j, base.b * j);
        mesh.setColorAt(i, tmpColor);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.frustumCulled = true;
      mesh.userData.blockId = id;
      this.scene.add(mesh);
      meshes.set(id, mesh);
    }

    chunk.mesh = meshes;
    chunk.dirty = false;
  }

  isExposed(world, x, y, z, id) {
    const transparent = isTransparent(id);
    return (
      neighborIsOpen(world, x + 1, y, z, id, transparent) ||
      neighborIsOpen(world, x - 1, y, z, id, transparent) ||
      neighborIsOpen(world, x, y + 1, z, id, transparent) ||
      neighborIsOpen(world, x, y - 1, z, id, transparent) ||
      neighborIsOpen(world, x, y, z + 1, id, transparent) ||
      neighborIsOpen(world, x, y, z - 1, id, transparent)
    );
  }
}

function neighborIsOpen(world, x, y, z, selfId, selfTransparent) {
  if (y < 0) return false;
  if (!world.inBounds(x, y, z)) return true;
  const neighborId = world.getBlock(x, y, z);
  if (neighborId === AIR) return true;
  if (selfTransparent && neighborId !== selfId) return true;
  if (!selfTransparent && isTransparent(neighborId)) return true;
  return false;
}
