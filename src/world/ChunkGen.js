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

export { CHUNK_SIZE, surfaceFor };
