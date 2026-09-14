import { AIR, isSystemBlock } from '../config/blocks.js';

export const CHUNK_SIZE = 16;

const NON_COLLIDABLE = new Set([AIR, 11]); // air, water

export class Chunk {
  constructor(cx, cz, height) {
    this.cx = cx;
    this.cz = cz;
    this.height = height;
    this.data = new Uint8Array(CHUNK_SIZE * height * CHUNK_SIZE);
    this.dirty = true;
    this.mesh = null; // populated by ChunkMesher: Map<blockId, InstancedMesh>
  }

  index(lx, ly, lz) {
    return (ly * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
  }

  get(lx, ly, lz) {
    if (ly < 0 || ly >= this.height) return AIR;
    return this.data[this.index(lx, ly, lz)];
  }

  set(lx, ly, lz, value) {
    this.data[this.index(lx, ly, lz)] = value;
  }
}

export class World {
  constructor({ sizeX = 64, sizeZ = 64, height = 64 } = {}) {
    this.sizeX = sizeX;
    this.sizeZ = sizeZ;
    this.height = height;
    this.chunksX = Math.ceil(sizeX / CHUNK_SIZE);
    this.chunksZ = Math.ceil(sizeZ / CHUNK_SIZE);
    this.chunks = new Map();
    this.surfaceHeightMap = new Int16Array(sizeX * sizeZ);
    // Which biome each column ended up in. Derived at generation, but saved
    // rather than recomputed: everything that asks — the site finder, the
    // settlers — asks long after the seed has gone.
    this.biomeMap = new Uint8Array(sizeX * sizeZ);
    for (let cx = 0; cx < this.chunksX; cx++) {
      for (let cz = 0; cz < this.chunksZ; cz++) {
        this.chunks.set(this.chunkKey(cx, cz), new Chunk(cx, cz, height));
      }
    }
  }

  /**
   * Numeric, not a template string. getBlock is the hottest call in the engine
   * — meshing, raycasting and collision all go through it — and building a
   * string key allocated on every single lookup.
   */
  chunkKey(cx, cz) {
    return cx * this.chunksZ + cz;
  }

  getChunk(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= this.chunksX || cz >= this.chunksZ) return undefined;
    return this.chunks.get(this.chunkKey(cx, cz));
  }

  inBounds(x, y, z) {
    return x >= 0 && x < this.sizeX && y >= 0 && y < this.height && z >= 0 && z < this.sizeZ;
  }

  getBlock(x, y, z) {
    x |= 0; y |= 0; z |= 0;
    if (!this.inBounds(x, y, z)) return AIR;
    const cx = x >> 4, cz = z >> 4;
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return AIR;
    return chunk.get(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE);
  }

  isCollidable(x, y, z) {
    if (y < 0) return true; // treat below-world as solid floor
    if (!this.inBounds(x, y, z)) return false;
    return !NON_COLLIDABLE.has(this.getBlock(x, y, z));
  }

  isSolid(x, y, z) {
    return this.getBlock(x, y, z) !== AIR;
  }

  /** World furniture such as the Campaign ground plane: can't be broken or sold. */
  isIndestructible(x, y, z) {
    return isSystemBlock(this.getBlock(x, y, z));
  }

  surfaceHeight(x, z) {
    x |= 0; z |= 0;
    if (x < 0 || x >= this.sizeX || z < 0 || z >= this.sizeZ) return 0;
    return this.surfaceHeightMap[x * this.sizeZ + z];
  }

  /** Sets a block, marks the owning chunk (and touching neighbors) dirty for remeshing. Returns previous value. */
  setBlock(x, y, z, value) {
    x |= 0; y |= 0; z |= 0;
    if (!this.inBounds(x, y, z)) return AIR;
    const cx = x >> 4, cz = z >> 4;
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return AIR;
    const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
    const prev = chunk.get(lx, y, lz);
    chunk.set(lx, y, lz, value);
    chunk.dirty = true;
    if (lx === 0) this.getChunk(cx - 1, cz) && (this.getChunk(cx - 1, cz).dirty = true);
    if (lx === CHUNK_SIZE - 1) this.getChunk(cx + 1, cz) && (this.getChunk(cx + 1, cz).dirty = true);
    if (lz === 0) this.getChunk(cx, cz - 1) && (this.getChunk(cx, cz - 1).dirty = true);
    if (lz === CHUNK_SIZE - 1) this.getChunk(cx, cz + 1) && (this.getChunk(cx, cz + 1).dirty = true);
    return prev;
  }

  dirtyChunks() {
    const list = [];
    for (const chunk of this.chunks.values()) if (chunk.dirty) list.push(chunk);
    return list;
  }

  *allChunks() {
    yield* this.chunks.values();
  }

  serialize() {
    const chunks = [];
    for (const chunk of this.chunks.values()) {
      chunks.push({ cx: chunk.cx, cz: chunk.cz, rle: rleEncode(chunk.data) });
    }
    return {
      sizeX: this.sizeX,
      sizeZ: this.sizeZ,
      height: this.height,
      surfaceHeightMap: Array.from(this.surfaceHeightMap),
      biomeMap: Array.from(this.biomeMap),
      chunks,
    };
  }

  static deserialize(json) {
    const world = new World({ sizeX: json.sizeX, sizeZ: json.sizeZ, height: json.height });
    world.surfaceHeightMap = Int16Array.from(json.surfaceHeightMap);
    // Worlds saved before biomes existed have none; they are all meadow, which
    // is what index 0 is and what they actually look like.
    world.biomeMap = json.biomeMap
      ? Uint8Array.from(json.biomeMap)
      : new Uint8Array(world.sizeX * world.sizeZ);
    for (const c of json.chunks) {
      const chunk = world.getChunk(c.cx, c.cz);
      if (!chunk) continue;
      chunk.data = rleDecode(c.rle, chunk.data.length);
      chunk.dirty = true;
    }
    return world;
  }
}

export function rleEncode(uint8arr) {
  const out = [];
  let i = 0;
  while (i < uint8arr.length) {
    const value = uint8arr[i];
    let run = 1;
    while (i + run < uint8arr.length && uint8arr[i + run] === value && run < 65535) run++;
    out.push(value, run);
    i += run;
  }
  return out;
}

export function rleDecode(pairs, length) {
  const out = new Uint8Array(length);
  let i = 0;
  for (let p = 0; p < pairs.length; p += 2) {
    const value = pairs[p], run = pairs[p + 1];
    out.fill(value, i, i + run);
    i += run;
  }
  return out;
}
