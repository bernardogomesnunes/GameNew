import { AIR, isSystemBlock } from '../config/blocks.js';

export const CHUNK_SIZE = 16;

const NON_COLLIDABLE = new Set([AIR, 11]); // air, water

export class Chunk {
  constructor(cx, cz, height) {
    this.cx = cx;
    this.cz = cz;
    this.height = height;
    this.data = new Uint8Array(CHUNK_SIZE * height * CHUNK_SIZE);
    // Per-chunk rather than one array across the map, because an endless map
    // has no across. Filled at generation and kept, since everything that asks
    // later — the site finder, the settlers, the border — asks long after.
    this.surface = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    this.biomes = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    this.dirty = true;
    this.mesh = null; // populated by ChunkMesher: Map<blockId, InstancedMesh>
    /**
     * Whether a person has changed anything in here.
     *
     * This is what makes an endless world saveable. Land that is exactly what
     * the seed says it is need not be written down at all — it can be made
     * again from the seed in a millisecond. Only the chunks somebody has dug
     * into or built on have to survive, and in a normal game that is a few
     * dozen out of however many thousand you walked across.
     */
    this.touched = false;
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

  surfaceAt(lx, lz) {
    return this.surface[lz * CHUNK_SIZE + lx];
  }

  biomeAt(lx, lz) {
    return this.biomes[lz * CHUNK_SIZE + lx];
  }
}

/**
 * The world, which no longer ends.
 *
 * It used to be a fixed grid of chunks made in one pass and serialised whole,
 * which capped it at 256 blocks a side: 512 came to 4.2MB and would not
 * reliably survive a browser's storage. That cap was visible from inside the
 * game — standing in the middle you could see the edge of the map, because
 * there were only 128 blocks of land in any direction and the fog started
 * eating them at 95.
 *
 * Now chunks are made when something asks for one, from a generator that
 * needs only a position and the seed, and they are forgotten again when you
 * walk far enough away. What gets written down is the seed plus the handful of
 * chunks you actually changed. A world is a few kilobytes however far you walk
 * across it.
 *
 * Worlds saved under the old scheme still load. They carry their own blocks
 * and their own bounds and stay exactly the size they were — there is no seed
 * behind them to regrow the rest from.
 */
export class World {
  /**
   * @param gen    a ChunkGen. With one, the world is endless. Without, it is a
   *               fixed grid of the given size — which is what a save from
   *               before this change comes back as.
   * @param keep   how many chunks to hold in memory around the player before
   *               forgetting the far ones. Touched chunks are never forgotten.
   */
  constructor({ sizeX = null, sizeZ = null, height = 64, gen = null, keep = 1600 } = {}) {
    this.height = height;
    this.gen = gen;
    this.keep = keep;
    this.endless = !!gen;
    // A fixed world keeps its bounds; an endless one has none.
    this.sizeX = this.endless ? null : sizeX ?? 64;
    this.sizeZ = this.endless ? null : sizeZ ?? 64;
    this.chunks = new Map();

    if (this.endless) {
      // The settlement sits at the origin. Everything that used to ask "where
      // is the middle of the map" asks for this instead.
      this.centreX = 0;
      this.centreZ = 0;
    } else {
      this.chunksX = Math.ceil(this.sizeX / CHUNK_SIZE);
      this.chunksZ = Math.ceil(this.sizeZ / CHUNK_SIZE);
      this.centreX = Math.floor(this.sizeX / 2);
      this.centreZ = Math.floor(this.sizeZ / 2);
      // A fixed world keeps the flat maps it always had. It is the old thing,
      // unchanged — there is no seed behind it and nothing to gain by moving
      // its bookkeeping into the chunks.
      this.surfaceHeightMap = new Int16Array(this.sizeX * this.sizeZ);
      this.biomeMap = new Uint8Array(this.sizeX * this.sizeZ);
      for (let cx = 0; cx < this.chunksX; cx++) {
        for (let cz = 0; cz < this.chunksZ; cz++) {
          this.chunks.set(chunkKey(cx, cz), new Chunk(cx, cz, height));
        }
      }
    }
  }

  /**
   * The chunk covering a chunk coordinate, made on the spot if it does not
   * exist yet and the world is endless.
   *
   * `create: false` asks without causing generation — what the mesher and the
   * cull pass want, since neither should drag a continent into being by
   * looking at it.
   */
  getChunk(cx, cz, create = true) {
    const key = chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;
    if (!this.endless || !create) return undefined;
    const chunk = new Chunk(cx, cz, this.height);
    this.chunks.set(key, chunk);
    this.gen.fill(this, chunk);
    return chunk;
  }

  /** Whether a chunk has been made yet. Never generates. */
  hasChunk(cx, cz) {
    return this.chunks.has(chunkKey(cx, cz));
  }

  inBounds(x, y, z) {
    if (y < 0 || y >= this.height) return false;
    if (this.endless) return true;
    return x >= 0 && x < this.sizeX && z >= 0 && z < this.sizeZ;
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

  /** World furniture such as bedrock: can't be broken or sold. */
  isIndestructible(x, y, z) {
    return isSystemBlock(this.getBlock(x, y, z));
  }

  surfaceHeight(x, z) {
    x |= 0; z |= 0;
    if (!this.endless) {
      if (x < 0 || x >= this.sizeX || z < 0 || z >= this.sizeZ) return 0;
      return this.surfaceHeightMap[x * this.sizeZ + z];
    }
    const cx = x >> 4, cz = z >> 4;
    return this.getChunk(cx, cz).surfaceAt(x - cx * CHUNK_SIZE, z - cz * CHUNK_SIZE);
  }

  /** Records a new ground height for a column, after something reshaped it. */
  setSurfaceHeight(x, z, h) {
    x |= 0; z |= 0;
    if (!this.endless) {
      if (x < 0 || x >= this.sizeX || z < 0 || z >= this.sizeZ) return;
      this.surfaceHeightMap[x * this.sizeZ + z] = h;
      return;
    }
    const cx = x >> 4, cz = z >> 4;
    const chunk = this.getChunk(cx, cz);
    chunk.surface[(z - cz * CHUNK_SIZE) * CHUNK_SIZE + (x - cx * CHUNK_SIZE)] = h;
  }

  /** Marks every chunk overlapping a region as changed, so it gets saved. */
  keepRegion(minX, minZ, maxX, maxZ) {
    for (let cx = minX >> 4; cx <= maxX >> 4; cx++) {
      for (let cz = minZ >> 4; cz <= maxZ >> 4; cz++) {
        const chunk = this.getChunk(cx, cz);
        if (chunk) chunk.touched = true;
      }
    }
  }

  /** The biome index a column ended up in. */
  biomeIndex(x, z) {
    x |= 0; z |= 0;
    if (!this.endless) {
      if (x < 0 || x >= this.sizeX || z < 0 || z >= this.sizeZ) return 0;
      return this.biomeMap[x * this.sizeZ + z];
    }
    const cx = x >> 4, cz = z >> 4;
    return this.getChunk(cx, cz).biomeAt(x - cx * CHUNK_SIZE, z - cz * CHUNK_SIZE);
  }

  /** Sets a block, marks the owning chunk (and touching neighbors) dirty for remeshing. Returns previous value. */
  setBlock(x, y, z, value, { byHand = true } = {}) {
    x |= 0; y |= 0; z |= 0;
    if (!this.inBounds(x, y, z)) return AIR;
    const cx = x >> 4, cz = z >> 4;
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return AIR;
    const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
    const prev = chunk.get(lx, y, lz);
    chunk.set(lx, y, lz, value);
    chunk.dirty = true;
    // Generation writes with byHand: false. Everything else is somebody
    // changing the world, and a changed chunk has to be written down.
    if (byHand) chunk.touched = true;
    const edge = (ox, oz) => {
      const n = this.getChunk(cx + ox, cz + oz, false);
      if (n) n.dirty = true;
    };
    if (lx === 0) edge(-1, 0);
    if (lx === CHUNK_SIZE - 1) edge(1, 0);
    if (lz === 0) edge(0, -1);
    if (lz === CHUNK_SIZE - 1) edge(0, 1);
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

  /**
   * Makes sure every chunk within `radius` blocks of a point exists.
   * Returns the ones it had to make, so the caller can queue them for meshing.
   */
  ensureAround(x, z, radius) {
    if (!this.endless) return [];
    const made = [];
    const c = Math.ceil(radius / CHUNK_SIZE);
    const px = Math.floor(x) >> 4, pz = Math.floor(z) >> 4;
    for (let dx = -c; dx <= c; dx++) {
      for (let dz = -c; dz <= c; dz++) {
        if (dx * dx + dz * dz > c * c) continue;
        if (this.hasChunk(px + dx, pz + dz)) continue;
        made.push(this.getChunk(px + dx, pz + dz));
      }
    }
    return made;
  }

  /**
   * Drops chunks further than `radius` from a point, so walking a long way
   * does not fill memory with country nobody is looking at.
   *
   * Never drops a chunk somebody has changed: that one is the only copy of
   * what they did until the next save, and the seed cannot make it again.
   */
  forgetBeyond(x, z, radius) {
    if (!this.endless) return [];
    const dropped = [];
    const c = radius / CHUNK_SIZE;
    const px = Math.floor(x) / CHUNK_SIZE, pz = Math.floor(z) / CHUNK_SIZE;
    for (const [key, chunk] of this.chunks) {
      if (chunk.touched) continue;
      const dx = chunk.cx - px, dz = chunk.cz - pz;
      if (dx * dx + dz * dz <= c * c) continue;
      this.chunks.delete(key);
      dropped.push(chunk);
    }
    return dropped;
  }

  /**
   * `keepBounds` — a claimed-land rectangle, in block coordinates — asks for
   * every chunk touching it to come along too, touched or not.
   *
   * Untouched land regenerating from the seed is fine right up until the
   * generator itself changes between sessions: the code that reshapes a
   * chunk on demand is whatever is running *now*, not whatever was running
   * when the player last saw it, so ground they built next to could be
   * gone or a different height entirely the next time it comes back into
   * memory. That only matters where somebody has something at stake in the
   * ground staying put — their own claimed land — so this keeps the save
   * bounded to that rather than to everywhere anyone has ever walked.
   */
  serialize({ keepBounds = null } = {}) {
    if (this.endless) {
      // The seed is the world. Only what somebody changed has to come with it
      // — plus their own claimed land, in full, so it can never shift under them.
      const chunks = [];
      const included = new Set();
      const push = (chunk) => {
        if (included.has(chunk)) return;
        included.add(chunk);
        // The ground heights come along rather than being worked out again
        // from the blocks. Guessing got 96% of them right, and the 4% it
        // missed are the ones somebody had reshaped — which is the only
        // reason this chunk is being saved at all. It is 256 numbers, and
        // they run-length encode to almost nothing on level ground.
        chunks.push({
          cx: chunk.cx,
          cz: chunk.cz,
          rle: rleEncode(chunk.data),
          surface: Array.from(chunk.surface),
        });
      };
      for (const chunk of this.chunks.values()) {
        if (chunk.touched) push(chunk);
      }
      if (keepBounds) {
        for (let cx = keepBounds.minX >> 4; cx <= keepBounds.maxX >> 4; cx++) {
          for (let cz = keepBounds.minZ >> 4; cz <= keepBounds.maxZ >> 4; cz++) {
            push(this.getChunk(cx, cz));
          }
        }
      }
      return {
        endless: true,
        height: this.height,
        seed: this.gen.seed,
        homeX: this.gen.biomes.centreX,
        homeZ: this.gen.biomes.centreZ,
        chunks,
      };
    }
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

  static deserialize(json, { makeGen } = {}) {
    if (json.endless) {
      const world = new World({
        height: json.height,
        gen: makeGen({ seed: json.seed, height: json.height, homeX: json.homeX ?? 0, homeZ: json.homeZ ?? 0 }),
      });
      for (const c of json.chunks) {
        // Generate the land first, then lay the player's changes over it, so a
        // chunk they half-dug keeps the ground around the hole.
        const chunk = world.getChunk(c.cx, c.cz);
        chunk.data = rleDecode(c.rle, chunk.data.length);
        chunk.touched = true;
        chunk.dirty = true;
        if (c.surface) chunk.surface.set(c.surface);
        else world.gen.resurface(chunk);   // saves from before the heights rode along
      }
      return world;
    }
    const world = new World({ sizeX: json.sizeX, sizeZ: json.sizeZ, height: json.height });
    if (json.surfaceHeightMap) world.surfaceHeightMap = Int16Array.from(json.surfaceHeightMap);
    // Worlds saved before biomes existed have none; they are all meadow, which
    // is what index 0 is and what they actually look like.
    if (json.biomeMap) world.biomeMap = Uint8Array.from(json.biomeMap);
    for (const c of json.chunks) {
      const chunk = world.getChunk(c.cx, c.cz);
      if (!chunk) continue;
      chunk.data = rleDecode(c.rle, chunk.data.length);
      chunk.dirty = true;
    }
    return world;
  }
}

/**
 * A key for a chunk coordinate that works for negative coordinates too.
 *
 * Numeric rather than a template string: getBlock is the hottest call in the
 * engine — meshing, raycasting and collision all go through it — and a string
 * key allocates on every single lookup. The offset keeps both halves positive
 * so the pair packs into one exact number.
 */
const KEY_OFFSET = 1 << 20;
function chunkKey(cx, cz) {
  return (cx + KEY_OFFSET) * (KEY_OFFSET * 2) + (cz + KEY_OFFSET);
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
