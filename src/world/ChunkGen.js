import { createNoise2D, createNoise3D } from 'simplex-noise';
import { BIOMES, BIOME_INDEX, surfaceFor } from '../config/biomes.js';
import { BiomeMap } from './biomeMap.js';
import { CHUNK_SIZE } from './World.js';
import { stampLandmarks } from './landmarks.js';

/** Which BIOMES entry is the short range — used for its streams. */
const MOUNTAINS1_INDEX = BIOME_INDEX.get('mountains1');
/** Which BIOMES entry is the tall, ore-rich range — used for its caverns. */
const MOUNTAINS2_INDEX = BIOME_INDEX.get('mountains2');

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
  constructor({ seed = 1, height = WORLD_HEIGHT, homePull = 1, homeX = 0, homeZ = 0 } = {}) {
    this.seed = seed | 0;
    this.height = height;
    this.shape = createNoise2D(seeded(seed));
    this.detail = createNoise2D(seeded(seed + 1337));
    this.river = createNoise2D(seeded(seed + 4201));
    this.flat = createNoise2D(seeded(seed + 7331));
    // A separate, higher-frequency channel from the river's own — see
    // streamCut — so Mountains 1 gets its own short creeks rather than
    // sharing the single world-spanning river line.
    this.stream = createNoise2D(seeded(seed + 9001));
    // 3D: caves have to be able to open and close as you go down, not just
    // wander in x/z. See caveAt.
    this.cave = createNoise3D(seeded(seed + 2551));
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
    let h = base + n * amplitude + d * rough;
    // Requested directly: "every biome has some more flat areas, even
    // mountains on top could have a flat area" — and, this round, that
    // Plains and Desert specifically get much bigger ones. A patch of ground
    // somewhere in every biome, sized and weighted per-biome by `flat` (see
    // flatFactor) and blending toward `base` — this column's own blended
    // biome floor, whatever biome that is — rather than toward a fixed
    // height, which is what keeps a flattened patch of mountain sitting up
    // at the mountain's own elevation instead of every flat patch in the
    // world settling to the same height regardless of what it's in.
    const flat = this.flatFactor(x, z, weights);
    if (flat > 0) h += (base - h) * flat;
    h = Math.round(h);
    // A river or a mountain stream cuts the ground down towards its bed
    // rather than being painted on afterwards, so the banks slope into it
    // like the rest of the terrain.
    const cut = this.riverCut(x, z) + this.streamCut(x, z, weights);
    if (cut > 0) h -= Math.round(cut);
    return Math.max(MIN_HEIGHT, Math.min(this.height - 10, h));
  }

  /** Which biome a column belongs to. */
  biomeIndexAt(x, z) {
    return this.biomes.weigh(x, z).index;
  }

  /**
   * 0..1: how much this column is pulled toward a local flat patch —
   * ordinary noise, cut off and sharpened the same shape rangeFactor uses,
   * but tuned far less rare: this is meant to turn up reasonably often in
   * every biome, not to gate a whole feature the way a mountain range does.
   * `weights`, when given, blends in each biome's own `flat` multiplier —
   * Desert and Plains favour a flat patch more than most, mountains and
   * ocean less — the same way base/amplitude/rough are already blended in
   * heightAt, just capped back to 1 since a multiplier can push the raw
   * curve past it. See heightAt for what the result actually does to the
   * ground.
   */
  flatFactor(x, z, weights) {
    const n = (this.flat(x * FREQ_FLAT, z * FREQ_FLAT) + 1) / 2;
    const factor = Math.pow(Math.max(0, n - FLAT_BASE) / (1 - FLAT_BASE), FLAT_POWER);
    const mult = weights ? this.biomes.blend(weights, 'flat') : 1;
    return Math.min(1, factor * mult);
  }

  /**
   * The ore embedded at one block of rock, or 0 for none.
   *
   * Only ever asked for a column already in the rock layer (see fill's own
   * call site) and only ever finds anything on a biome that declared `ores`
   * — Mountains 2, currently. `y` rides along in the salt so the same column
   * doesn't return one verdict for its entire depth; a pure hash rather than
   * a seeded generator for the same reason every other placement here is —
   * ask twice, from any chunk, get the same answer.
   */
  oreAt(x, y, z, biomeIndex) {
    const biome = BIOMES[biomeIndex];
    for (const o of biome.ores ?? []) {
      if (hash01(x, z, this.seed ^ (o.salt + y * 0x9e37)) < o.chance) return o.block;
    }
    return 0;
  }

  /**
   * Whether one block of the rock layer is hollowed out, and with what —
   * open air, or, under Mountains 2 and only down in the deep band, flooded
   * with water or lava.
   *
   * A single 3D noise field, carved wherever it sits close enough to zero:
   * the classic cheap cave shape, tunnels rather than blobs because a thin
   * band around zero of a continuous field reads as connected sheets, not
   * isolated pockets. Requested directly as two different things at once —
   * "small caves everywhere" (the ordinary, narrow band) and, "on the bigger
   * mountain... enormous [caves], full of ores and water and lava" (the same
   * field, just a much wider band, gated to Mountains 2's own rock and to a
   * deep band under it rather than right under its peak) — both come from
   * this one function so a cavern's edge is still the same kind of shape a
   * small cave's is, just bigger.
   *
   * Ore already comes along for free: fill's own per-column loop only ever
   * calls this in place of solid rock, so whatever stays solid around a
   * cavern still rolls oreAt exactly as it always did — a cavern's walls are
   * exactly as likely to hold a vein as any other rock in the same biome.
   */
  caveAt(x, y, z, biomeIndex) {
    if (y < CAVE_FLOOR) return NOT_CARVED;
    const cavern = biomeIndex === MOUNTAINS2_INDEX && y < CAVERN_Y_MAX;
    const width = cavern ? CAVERN_WIDTH : CAVE_WIDTH;
    const n = this.cave(x * CAVE_FREQ, y * CAVE_FREQ_Y, z * CAVE_FREQ);
    if (Math.abs(n) >= width) return NOT_CARVED;
    if (!cavern) return AIR;
    // Which flavour of hollow this particular cavern cell gets — its own
    // roll, not the carve roll above, so the fill pattern inside a cavern
    // doesn't trace the same shape as the cavern's own walls.
    const roll = hash01(x, z, this.seed ^ (0x7ca0 + y * 131));
    if (y < CAVERN_LAVA_TOP && roll < CAVERN_LAVA_CHANCE) return LAVA;
    if (roll < CAVERN_LAVA_CHANCE + CAVERN_WATER_CHANCE) return WATER;
    return AIR;
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

  /** A river's own water level over this column, or 0 away from one. */
  riverLevelAt(x, z) {
    return this.riverCut(x, z) > RIVER_DEPTH * 0.35 ? this.heightAt(x, z) + 1 : 0;
  }

  /**
   * How deep a mountain stream has worn the ground here — the same shape
   * riverCut is, a narrower and shallower ridge of its own noise, but only
   * real where `weights` says this column is actually Mountains 1: the cut
   * is scaled straight by that blend weight, so a stream fades out at a
   * range's edge the same smooth way every other blended quantity here does,
   * rather than switching on or off at a hard biome line. See biomes.js's
   * `streams` note on Mountains 1 for why this exists as its own field
   * rather than just letting the ordinary river noise occasionally cross a
   * mountain by chance.
   */
  streamCut(x, z, weights) {
    const w = weights[MOUNTAINS1_INDEX] ?? 0;
    if (w <= 0) return 0;
    const v = Math.abs(this.stream(x * FREQ_STREAM, z * FREQ_STREAM));
    if (v > STREAM_WIDTH) return 0;
    const t = 1 - v / STREAM_WIDTH;
    return t * t * STREAM_DEPTH * w;
  }

  /** A mountain stream's own water level over this column, or 0 away from one. */
  streamLevelAt(x, z) {
    const { weights } = this.biomes.weigh(x, z);
    return this.streamCut(x, z, weights) > STREAM_DEPTH * 0.4 ? this.heightAt(x, z) + 1 : 0;
  }

  /**
   * The sea's water level over this column, or 0 on dry land.
   *
   * Not a drawn coastline — anywhere the blended terrain dips below sea
   * level floods, the same way a river cuts its own bed rather than being
   * painted on afterwards. The ocean biome (config/biomes.js) exists to
   * pull the blend low enough, over a real stretch of country, that this
   * actually happens there rather than nowhere — but any other biome's own
   * noise dipping this low floods too, the same way a real coastline
   * doesn't ask what county it's in.
   */
  seaLevelAt(x, z) {
    return this.heightAt(x, z) < SEA_LEVEL ? SEA_LEVEL : 0;
  }

  /** Whichever of a river, a mountain stream or the sea is deeper here, or 0 on dry land. */
  waterLevelAt(x, z) {
    return Math.max(this.riverLevelAt(x, z), this.streamLevelAt(x, z), this.seaLevelAt(x, z));
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
    const ground = this.heightAt(x, z);
    // Both mountain tiers only take root near their own foot — see
    // biomes.js's own note on why, requested directly for both.
    if (biome.treeMaxHeight != null && ground > biome.treeMaxHeight) return null;
    // Not in the water, and not on ground that is about to be water.
    if (this.waterLevelAt(x, z)) return null;
    const [lo, hi] = t.trunk ?? [4, 6];
    const trunk = lo + Math.floor(hash01(x, z, this.seed ^ 0x1b9d) * (hi - lo + 1));
    return { style: t, trunk, ground };
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
   * Fills a chunk with land: ground, water, scatter, the caves hollowed out
   * of its rock, and the trees whose canopies reach into it from outside.
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
        const riverLevel = this.riverLevelAt(x, z);
        const streamLevel = this.streamLevelAt(x, z);
        const seaLevel = this.seaLevelAt(x, z);
        const water = Math.max(riverLevel, streamLevel, seaLevel);
        // Two different beds for two different kinds of wet: a river or
        // stream cuts a channel (RIVERBED, sand — a bank), the sea just
        // floods low ground (SILT — see config/blocks.js's own note on why
        // it isn't Sand too). Whichever of the three actually won this
        // column decides which bed it gets, not just river-vs-sea as
        // before — a stream that's the deepest source here is still a
        // stream, not a sliver of seabed.
        const bed = seaLevel > 0 && seaLevel >= water ? SILT : RIVERBED;
        // "Surrounded by sand like a beach to transit to the next biome" —
        // requested for the ocean specifically, done generically: any dry
        // column low enough to be near sea level turns to sand regardless of
        // whose biome niche actually won it, which is what makes it read as
        // a coastline rather than a hard edge where one biome's own colour
        // just happens to stop. Only above water — a flooded column already
        // gets its own bed below.
        const beach = !water && h <= SEA_LEVEL + BEACH_BAND;
        const top = beach ? SAND : surfaceFor(biome, h);
        const under = beach ? SAND : s.under;
        const hasOres = biome.ores?.length > 0;
        const rockFloor = h - 1 - s.depth;
        for (let y = 0; y < h; y++) {
          let block;
          if (y < rockFloor) {
            // Caves only cut into deep rock — never within reach of the
            // soil sitting on top of it, so there is always a solid roof
            // between a cave and the surface.
            const cave = y < rockFloor - CAVE_SURFACE_BUFFER ? this.caveAt(x, y, z, index) : NOT_CARVED;
            if (cave !== NOT_CARVED) block = cave;
            else block = hasOres ? (this.oreAt(x, y, z, index) || s.rock) : s.rock;
          } else if (y < h - 1) block = under;
          else block = water ? bed : top;
          chunk.set(lx, y, lz, block);
        }
        // A river or stream fills the trough it cut. The level is the bed
        // plus one, so the water sits in the channel rather than flooding
        // the banks.
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
    // The hermit's hut and the bandits' camps, where they fall in this chunk.
    stampLandmarks(this, chunk, CHUNK_SIZE);

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

    // A rounded crown rather than a box. Requested directly: leaves "be
    // somehow more rounded instead of sharp cubes." Each layer is a disc, the
    // widest in the middle; the top is a small dome, not one block on a flat
    // lid; and the rim is ragged, a few of its leaves missing, so no two
    // trees are the same square.
    const canopy = style.canopy ?? 2;
    const topY = ground + trunk;
    const layers = [[-1, canopy + 0.25], [0, canopy + 0.55], [1, Math.max(1, canopy - 0.35)], [2, canopy > 1 ? 1 : 0]];
    for (const [dy, radius] of layers) {
      const r = Math.floor(radius + 0.5);
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          const d2 = dx * dx + dz * dz;
          if (d2 > radius * radius + 0.6) continue;
          const rim = d2 > (radius - 1) * (radius - 1) + 0.6;
          if (rim && (dx || dz) && hash01(x * 31 + dx, z * 17 + dz * 7 + dy * 131, this.seed ^ 0x3ea7) < 0.18) continue;
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
// A shorter, narrower ridge than the river's own — see streamCut. Several
// of these can cross one mountain range, unlike the single river line.
const FREQ_STREAM = 0.05;
const STREAM_WIDTH = 0.05;
const STREAM_DEPTH = 4;
// The bias that keeps the settlement on buildable ground. In blocks now rather
// than a fraction of the map, because an endless map has no fraction to take.
const HOME_RADIUS = 51;
const AIR = 0;
const SAND = 6;
const WATER = 11;
const LAVA = 45;
// caveAt's "nothing carved here" answer — distinct from AIR (also 0) so the
// caller can tell "leave the rock alone" apart from "this rock is now open
// air," which a bare falsy check on AIR could not.
const NOT_CARVED = -1;
const RIVERBED = 6;   // sand under the water, the way a bank looks
const SILT = 25;      // the sea's own bed, so it doesn't borrow Sand from the Desert biome
// Requested directly: three times the old 64, so there is genuine room for a
// deep ocean, a 100-block layer of diggable rock, and a mountain that
// actually reaches 70 blocks above the country around it — see SEA_LEVEL and
// every biome's own base/amplitude in config/biomes.js.
const WORLD_HEIGHT = 200;
// Anywhere the blended terrain dips below this floods — see seaLevelAt. Sits
// with roughly a hundred blocks of rock beneath it before bedrock, which is
// the "increase the depth of soil and rock" ask: not a separate constant,
// just what having this much world above y=0 already gives caves to work
// with. Kept under every biome's own floor except the two mountain tiers, so
// ordinary country never floods on its own noise.
const SEA_LEVEL = 100;
// How many blocks above sea level still counts as shore — see fill's own
// beach note.
const BEACH_BAND = 4;
// A small safety floor, not a real limit any biome's own numbers reach any
// more — see WORLD_HEIGHT.
const MIN_HEIGHT = 6;
// A finer, more common field than the mountain ranges' own — see
// flatFactor's own note on why this is tuned to turn up often rather than
// to gate a rare feature. Lower than before: "flat areas of 50 to 100
// blocks" needs a wider characteristic wavelength than the old 0.017 gave.
const FREQ_FLAT = 0.008;
const FLAT_BASE = 0.32;
const FLAT_POWER = 1.6;
// Caves: a narrow band around zero of a 3D field, everywhere, well below the
// surface — see caveAt.
const CAVE_FREQ = 0.06;
const CAVE_FREQ_Y = 0.09;
const CAVE_WIDTH = 0.05;
// How many blocks of solid roof always sit between a cave and the surface.
const CAVE_SURFACE_BUFFER = 6;
// Never carve within this many blocks of bedrock — a cave with no floor
// underneath it is a hole, not a cave.
const CAVE_FLOOR = 3;
// Mountains 2's own enormous caverns: the same field, a much wider band, and
// only down in a deep zone well under its peak — see caveAt.
const CAVERN_WIDTH = 0.15;
const CAVERN_Y_MAX = 95;
const CAVERN_LAVA_TOP = 40;
const CAVERN_LAVA_CHANCE = 0.15;
const CAVERN_WATER_CHANCE = 0.2;
/** Wood, leaves and saplings: standing on the ground rather than part of it. */
const GROWS_ON_TOP = new Set([4, 5, 20, 41, 42, 43, 44]);

export { CHUNK_SIZE, surfaceFor, WORLD_HEIGHT };
