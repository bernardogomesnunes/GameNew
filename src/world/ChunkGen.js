import { createNoise2D } from 'simplex-noise';
import { BIOMES, surfaceFor } from '../config/biomes.js';
import { BiomeMap } from './biomeMap.js';
import { CHUNK_SIZE } from './World.js';

/**
 * One chunk of land, made from nothing but its coordinates and the seed.
 *
 * This is what an endless world needs and the old generator could not give.
 * That one filled a fixed array in scan order and drew its tree placements
 * from a running random number generator — so where a tree landed depended on
 * how many columns had been visited before it. Generate the same chunk on its
 * own and you got different trees; generate chunks in a different order and
 * you got a different world. Fine when the whole map is made in one pass, and
 * useless the moment chunks arrive as you walk towards them.
 *
 * So nothing here is sequential. Every decision — the height of a column, the
 * biome, whether a tree stands there and how tall it is — is a pure hash of
 * the position and the seed. Ask twice, in any order, from any chunk, and you
 * get the same answer.
 *
 * The one thing that is not column-local is a tree's canopy, which reaches
 * into its neighbours. A chunk therefore runs the planting pass over a margin
 * of columns around itself and keeps only what falls inside its own walls.
 */

/** How far a tree's leaves can reach. The margin a chunk has to look past. */
export const FEATURE_MARGIN = 4;

/**
 * A number in 0..1 from a position and a salt, with no state.
 *
 * Integer hashing rather than a seeded PRNG: the point is that the answer
 * depends only on where you ask, never on what was asked before.
 */
export function hash01(x, z, salt) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class ChunkGen {
  /**
   * @param seed     the world's seed; everything derives from it
   * @param height   how tall a column may be
   * @param homePull how hard the middle of the world is dragged towards the
   *   home biome, so the starting plot is buildable ground
   */
  constructor({ seed = 1, height = 64, homePull = 1, homeX = 0, homeZ = 0 } = {}) {
    this.seed = seed | 0;
    this.height = height;
    this.shape = createNoise2D(seeded(seed));
    this.detail = createNoise2D(seeded(seed + 1337));
    this.river = createNoise2D(seeded(seed + 4201));
    // The biome map is already stateless — it answers per column from noise —
    // so it needs nothing but a centre to bias towards.
    this.biomes = new BiomeMap({ sizeX: 1, sizeZ: 1, seed, homePull });
    this.biomes.centreX = homeX;
    this.biomes.centreZ = homeZ;
    this.biomes.homeRadius = HOME_RADIUS;
  }

  /** The ground height at a column, before anything is planted on it. */
  heightAt(x, z) {
    const { weights } = this.biomes.weigh(x, z);
    const base = this.biomes.blend(weights, 'base');
    const amplitude = this.biomes.blend(weights, 'amplitude');
    const rough = this.biomes.blend(weights, 'rough');
    const n = this.shape(x * FREQ, z * FREQ);
    const d = this.detail(x * FREQ_DETAIL, z * FREQ_DETAIL);
    let h = Math.round(base + n * amplitude + d * rough);
    // A river cuts the ground down towards its bed rather than being painted
    // on afterwards, so the banks slope into it like the rest of the terrain.
    const cut = this.riverCut(x, z);
    if (cut > 0) h -= Math.round(cut);
    return Math.max(4, Math.min(this.height - 10, h));
  }

  /** Which biome a column belongs to. */
  biomeIndexAt(x, z) {
    return this.biomes.weigh(x, z).index;
  }

  /**
   * How deep the water has worn the ground here, in blocks. Zero away from a
   * river.
   *
   * A ridge of noise rather than a drawn path: a path has two ends, and a
   * world with no edges cannot have a river that stops.
   */
  riverCut(x, z) {
    const v = Math.abs(this.river(x * FREQ_RIVER, z * FREQ_RIVER));
    if (v > RIVER_WIDTH) return 0;
    // Deepest along the centre line, feathering out to nothing at the banks.
    const t = 1 - v / RIVER_WIDTH;
    return t * t * RIVER_DEPTH;
  }

  /** Whether a column is river bed, and the water level over it. */
  waterLevelAt(x, z) {
    return this.riverCut(x, z) > RIVER_DEPTH * 0.35 ? this.heightAt(x, z) + 1 : 0;
  }

  /**
   * The tree standing on a column, or null. Pure in (x, z).
   *
   * Returns the style and a trunk height so a neighbouring chunk can work out
   * exactly the same tree without asking this one.
   */
  treeAt(x, z) {
    const biome = BIOMES[this.biomeIndexAt(x, z)];
    const t = biome.trees;
    if (!t?.chance) return null;
    if (hash01(x, z, this.seed ^ 0x5f3a) >= t.chance) return null;
    // Not in the water, and not on ground that is about to be water.
    if (this.waterLevelAt(x, z)) return null;
    const [lo, hi] = t.trunk ?? [4, 6];
    const trunk = lo + Math.floor(hash01(x, z, this.seed ^ 0x1b9d) * (hi - lo + 1));
    return { style: t, trunk, ground: this.heightAt(x, z) };
  }

  /** What is scattered on a column — a boulder, a sapling — or 0. */
  scatterAt(x, z) {
    const biome = BIOMES[this.biomeIndexAt(x, z)];
    let n = 0;
    for (const sc of biome.scatter ?? []) {
      if (hash01(x, z, this.seed ^ (0x2c01 + n++)) < sc.chance) return sc.block;
    }
    return 0;
  }

  /**
   * Fills a chunk with land: ground, water, scatter, and the trees whose
   * canopies reach into it from outside.
   *
   * Generation writes with `byHand: false`, so a chunk nobody has touched
   * stays untouched and need never be saved.
   */
  fill(world, chunk) {
    const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const x = ox + lx, z = oz + lz;
        const h = this.heightAt(x, z);
        const index = this.biomeIndexAt(x, z);
        const biome = BIOMES[index];
        chunk.surface[lz * CHUNK_SIZE + lx] = h;
        chunk.biomes[lz * CHUNK_SIZE + lx] = index;

        const s = biome.surface;
        const top = surfaceFor(biome, h);
        const water = this.waterLevelAt(x, z);
        for (let y = 0; y < h; y++) {
          let block;
          if (y < h - 1 - s.depth) block = s.rock;
          else if (y < h - 1) block = s.under;
          else block = water ? RIVERBED : top;
          chunk.set(lx, y, lz, block);
        }
        // A river fills the trough it cut. The level is the bed plus one, so
        // the water sits in the channel rather than flooding the banks.
        if (water) {
          for (let y = h; y < Math.min(water, this.height); y++) chunk.set(lx, y, lz, WATER);
        } else {
          const sc = this.scatterAt(x, z);
          if (sc && h < this.height) chunk.set(lx, h, lz, sc);
        }
      }
    }

    // Trees. Every column within a canopy's reach of this chunk is asked
    // whether it holds one, and only the blocks that land inside these walls
    // are written — the same tree gets written again, identically, by each
    // chunk it overhangs.
    for (let x = ox - FEATURE_MARGIN; x < ox + CHUNK_SIZE + FEATURE_MARGIN; x++) {
      for (let z = oz - FEATURE_MARGIN; z < oz + CHUNK_SIZE + FEATURE_MARGIN; z++) {
        const tree = this.treeAt(x, z);
        if (tree) this.plant(chunk, x, z, tree);
      }
    }

    chunk.dirty = true;
  }

  /** Writes one tree, keeping only what falls inside the given chunk. */
  plant(chunk, x, z, { style, trunk, ground }) {
    const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;
    const put = (bx, by, bz, block, fillAirOnly) => {
      const lx = bx - ox, lz = bz - oz;
      if (lx < 0 || lz < 0 || lx >= CHUNK_SIZE || lz >= CHUNK_SIZE) return;
      if (by < 0 || by >= chunk.height) return;
      if (fillAirOnly && chunk.get(lx, by, lz) !== 0) return;
      chunk.set(lx, by, lz, block);
    };

    for (let i = 0; i < trunk; i++) put(x, ground + i, z, style.wood, false);

    const canopy = style.canopy ?? 2;
    const topY = ground + trunk;
    for (let dy = -1; dy <= 1; dy++) {
      const r = dy === 1 ? Math.max(1, canopy - 1) : canopy;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (r > 1 && Math.abs(dx) === r && Math.abs(dz) === r) continue;
          put(x + dx, topY + dy, z + dz, style.leaves, true);
        }
      }
    }
    put(x, topY + 2, z, style.leaves, true);
  }

  /**
   * Recomputes a loaded chunk's surface and biome columns.
   *
   * A saved chunk carries its blocks but not these, and they are cheap to work
   * out again from the seed — cheaper than storing two more arrays per chunk in
   * every save.
   */
  resurface(chunk) {
    const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        // From the blocks rather than the seed: the player may have dug the
        // ground away or piled it up, and the surface is where it is now.
        //
        // Skipping what grows on it, though. The surface is the ground you
        // walk on, and counting a tree would have every wooded column report
        // the top of its canopy — which is where the settlers would then try
        // to walk and where a building would be checked for a roof.
        let h = 0;
        for (let y = chunk.height - 1; y >= 0; y--) {
          const b = chunk.get(lx, y, lz);
          if (b !== 0 && !GROWS_ON_TOP.has(b)) { h = y + 1; break; }
        }
        chunk.surface[lz * CHUNK_SIZE + lx] = h;
        chunk.biomes[lz * CHUNK_SIZE + lx] = this.biomeIndexAt(ox + lx, oz + lz);
      }
    }
  }
}

function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tuned on the fixed-size generator and carried over unchanged, so an endless
// world is made of the same country the old one was.
const FREQ = 0.045;
const FREQ_DETAIL = 0.12;
const FREQ_RIVER = 0.006;
const RIVER_WIDTH = 0.045;
const RIVER_DEPTH = 6;
// The bias that keeps the settlement on buildable ground. In blocks now rather
// than a fraction of the map, because an endless map has no fraction to take.
const HOME_RADIUS = 51;
const WATER = 11;
const RIVERBED = 6;   // sand under the water, the way a bank looks
/** Wood, leaves and saplings: standing on the ground rather than part of it. */
const GROWS_ON_TOP = new Set([4, 5, 20]);

export { CHUNK_SIZE, surfaceFor };
