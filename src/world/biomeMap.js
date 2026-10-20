import { inPast } from './past.js';
import { inFuture } from './future.js';
import { createNoise2D } from 'simplex-noise';
import { BIOMES, BIOME_INDEX, HOME_BIOME } from '../config/biomes.js';
import {massifAt} from './massifs.js';

/**
 * Which biome is where, and how much of it.
 *
 * Two slow noise fields — warmth and wet — put every column somewhere in a
 * climate square, and each biome claims a patch of that square. The nearest
 * claim wins the column.
 *
 * The part that matters is that it does not *only* return a winner. A hard
 * pick gives you a cliff wherever two biomes meet, because Plains sitting at
 * 104 and Mountains 1 at 112 would step eight blocks in one column. So the
 * height is blended across every biome by how close its claim is, and only
 * the surface block comes from the winner. Borders end up as slopes, which is
 * what they look like from the ground.
 */

/**
 * Which shape of land a world is made with. A saved world only keeps the
 * chunks somebody changed and makes the rest again from its seed, so new
 * land rules would reshape the country round an old world's builds, with
 * cliffs where a kept chunk meets a remade one. So a world keeps the shape it
 * was made with, and only new worlds get the latest.
 *
 *   1: before 20 October 2026.
 *   2: WORLD-1 and WORLD-3 — wider ranges with rare huge peaks (massifs.js),
 *      broader plains and flatter deserts — and WORLD-2's giant tree forms.
 */
export const TERRAIN = 2;

/**
 * Each shape's climate and mountain wavelengths. `freq` is the one knob every
 * non-mountain biome's size comes from; `detail` is kept in the same ratio to
 * it, so the border wobble scales with the regions. See RANGE_POWER and
 * SUMMIT_POWER below for what the range and summit numbers do.
 */
const SHAPES = {
  1: { freq: 0.0032, detail: 0.0116, rangeFreq: 0.0016, rangeBase: 0.55, rangeBoost: 1, summitFreq: 0.02, summitBase: 0.48, massifs: false },
  // WORLD-3: open country another 28% wider. WORLD-1: ranges wider, three
  // times as strong against their neighbours, and their summits broader.
  2: { freq: 0.0025, detail: 0.0091, rangeFreq: 0.0010, rangeBase: 0.58, rangeBoost: 3, summitFreq: 0.008, summitBase: 0.55, massifs: true },
};

/**
 * The mountains' own placement, independent of climate.
 *
 * Requested directly: "fewer bigger ranges, and mountains wider too." Every
 * biome's region size otherwise comes from `freq` in SHAPES above, shared by all of
 * them — there's no way to make just the mountains bigger by moving a niche
 * around, since niche placement only decides *which* biome wins a column,
 * never how large the climate region it's competing over is. `rangeFreq` is
 * a second, much lower-frequency noise field that multiplies straight into
 * a biome's ordinary niche weight (see weigh()) rather than replacing the
 * pick outright — so the two still blend at a range's edge the same smooth
 * way any other biome border does, just gated to occur much more rarely and
 * across a much wider footprint. `rangeBase` cuts off the bottom of that
 * noise entirely (most of the map is simply not eligible); RANGE_POWER then
 * sharpens what's left, so a range reads as a real feature rather than a
 * gradient with no edge.
 */
const RANGE_POWER = 2;

/**
 * Mountains 2, nested inside an eligible Mountains 1 range rather than
 * placed on its own — see biomes.js's own note on `summitOnly`. The same
 * base/cutoff/power shape the range gate itself uses, just at a higher
 * frequency and a stricter cutoff, so it reads as the rare, tall heart of a
 * range rather than a whole separate tier of mountains with its own
 * footprint.
 */
const SUMMIT_POWER = 1.4;

/** Same generator the terrain uses, so one seed decides a whole world. */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class BiomeMap {
  /**
   * @param homePull how strongly the middle of the map is dragged towards the
   *   home biome. The settlement is placed at the centre and needs ground it
   *   can be built on — landing a new player in a desert with no wood is a
   *   world they cannot start. 0 turns it off.
   */
  constructor({ sizeX, sizeZ, seed = 1, homePull = 1, terrain = TERRAIN }) {
    this.seed = seed;
    this.terrain = SHAPES[terrain] ? terrain : TERRAIN;
    this.scale = SHAPES[this.terrain];
    // Each biome's numbers for this shape of land, in BIOMES order: see blend.
    this.fields = {};
    this.sizeX = sizeX;
    this.sizeZ = sizeZ;
    this.temp = createNoise2D(mulberry32(seed + 101));
    this.wet = createNoise2D(mulberry32(seed + 977));
    this.warp = createNoise2D(mulberry32(seed + 5501));
    this.range = createNoise2D(mulberry32(seed + 8887));
    this.summit = createNoise2D(mulberry32(seed + 19301));
    // One patchy noise field per rare biome, each from its own salt, and the
    // biomes it can take over as indexes.
    this.rareNoise = BIOMES.map((b) => (b.rare ? createNoise2D(mulberry32(seed + b.rare.salt)) : null));
    this.rareIndexes = BIOMES.flatMap((b, i) => (b.rare ? [i] : []));
    for (const b of BIOMES) {
      if (b.rare) b.rare.within = (b.rare.in ?? []).map((id) => BIOME_INDEX.get(id)).filter((j) => j != null);
    }
    this.homePull = homePull;
    this.home = BIOMES[BIOME_INDEX.get(HOME_BIOME) ?? 0];
    this.centreX = sizeX / 2;
    this.centreZ = sizeZ / 2;
    // The radius over which the centre is pulled home.
    //
    // This was a third of the map — 87 blocks on a 256 world — on the reasoning
    // that the whole claimable map should be buildable country. That was wrong,
    // and it is why a new world looked like one green field: the near field was
    // over 90% Plains out to 20 blocks and still most of it at 40, while the
    // fog starts eating the view at 72 on a phone. Every biome in the game sat
    // in the band that was already fading into sky.
    //
    // Only the *starting plot* has to be buildable, and that is 32 blocks
    // across. So the thumb covers the first ring with margin to spare and then
    // lets go, which puts the rest of the country where you can see it — and
    // makes the border moving out mean arriving somewhere that looks different.
    //
    // Swept rather than guessed, because both ends are bad. Too small and the
    // mountains come right up to the settlement and you arrive facing a wall
    // of gravel four blocks from your nose. At 0.20 the ring you land in is
    // mostly Plains — open ground to build on — and the country is properly
    // mixed by 32 to 48 blocks, which is inside the clear band on a phone.
    this.homeRadius = Math.min(sizeX, sizeZ) * 0.20;
  }

  /** Warmth and wet at a column, each 0..1. */
  climate(x, z) {
    const { freq, detail } = this.scale;
    const wx = this.warp(x * detail, z * detail) * 12;
    const wz = this.warp(z * detail + 40, x * detail - 40) * 12;
    let temp = (this.temp((x + wx) * freq, (z + wz) * freq) + 1) / 2;
    let wet = (this.wet((x - wz) * freq, (z - wx) * freq) + 1) / 2;

    if (this.homePull > 0) {
      const dx = x - this.centreX, dz = z - this.centreZ;
      const d = Math.sqrt(dx * dx + dz * dz) / this.homeRadius;
      // 1 at the centre, 0 past the radius, smooth in between so there is no
      // ring where the bias switches off.
      const pull = d >= 1 ? 0 : (1 - d) * (1 - d) * this.homePull;
      temp += (this.home.niche.temp - temp) * pull;
      wet += (this.home.niche.wet - wet) * pull;
    }
    return { temp: clamp01(temp), wet: clamp01(wet) };
  }

  /**
   * 0..1: how eligible this column is for a mountain range at all — low
   * frequency and cut off/sharpened so most of the map is simply 0 (see
   * `rangeFreq`'s note above). Suppressed near the settlement the same
   * way ordinary climate already is, and for the same reason: arriving to a
   * wall of stone four blocks from spawn is exactly what homePull exists to
   * prevent for every other biome too.
   */
  rangeFactor(x, z) {
    const { rangeFreq, rangeBase } = this.scale;
    const n = (this.range(x * rangeFreq, z * rangeFreq) + 1) / 2;
    let factor = Math.pow(Math.max(0, n - rangeBase) / (1 - rangeBase), RANGE_POWER);
    if (this.homePull > 0 && factor > 0) {
      const dx = x - this.centreX, dz = z - this.centreZ;
      const d = Math.sqrt(dx * dx + dz * dz) / this.homeRadius;
      const pull = d >= 1 ? 0 : (1 - d) * (1 - d) * this.homePull;
      factor *= 1 - pull;
    }
    return factor;
  }

  /**
   * 0..1: within an eligible range, how much of it is Mountains 2 rather
   * than ordinary Mountains 1 — see biomes.js's `summitOnly`.
   */
  summitFactor(x, z) {
    const { summitFreq, summitBase } = this.scale;
    const n = (this.summit(x * summitFreq, z * summitFreq) + 1) / 2;
    return Math.pow(Math.max(0, n - summitBase) / (1 - summitBase), SUMMIT_POWER);
  }

  /**
   * 0..1: how far a rare biome is let in at a column — the same cut-off and
   * sharpen as rangeFactor, on its own noise, and kept away from the
   * settlement the same way. See weigh for what it does with it.
   */
  rareFactor(i, x, z) {
    const r = BIOMES[i].rare;
    const n = (this.rareNoise[i](x * r.freq, z * r.freq) + 1) / 2;
    let factor = Math.pow(Math.max(0, n - r.base) / (1 - r.base), r.power);
    // None at all round the settlement, fading in past it: the starting
    // plot is for building, not for felling giants.
    if (this.homePull > 0 && factor > 0) {
      const dx = x - this.centreX, dz = z - this.centreZ;
      const d = Math.sqrt(dx * dx + dz * dz) / this.homeRadius;
      if (d < 1) return 0;
      if (d < 1.5) factor *= (d - 1) / 0.5;
    }
    return factor;
  }

  /**
   * Every biome's share of a column, plus the winner.
   *
   * Weight falls off with the square of the distance in climate space, which
   * makes the winner dominate near the middle of its patch and the two
   * neighbours share evenly right at a border. A `range` biome's weight is
   * also multiplied by how eligible the column is for a range at all — see
   * rangeFactor — which is what keeps the mountains fewer, bigger and wider
   * than every other biome's climate-only placement, while still blending
   * the same smooth way at the edges since it's a multiplier on the same
   * weight rather than a separate switch.
   */
  weigh(x, z) {
    const { temp, wet } = this.climate(x, z);
    // The Past (world/past.js) and the Future (world/future.js): their own
    // biomes there, and only there.
    const past = inPast(x, this.centreX ?? 0);
    const era = past ? 'past' : inFuture(x, this.centreX ?? 0) ? 'future' : null;
    const range = era ? 0 : this.rangeFactor(x, z);
    const summit = range > 0 ? this.summitFactor(x, z) : 0;
    const weights = new Array(BIOMES.length);
    let total = 0;
    let best = 0, bestW = -1;

    for (let i = 0; i < BIOMES.length; i++) {
      const b = BIOMES[i];
      const n = b.niche;
      const dt = temp - n.temp, dw = wet - n.wet;
      const d2 = dt * dt + dw * dw;
      // The epsilon keeps a column sitting exactly on a niche from going
      // infinite; 1/d^4 is sharp enough that biomes stay recognisable.
      let w = 1 / ((d2 + 0.0016) * (d2 + 0.0016));
      if (b.range) w *= b.summitOnly ? range * summit : range * this.scale.rangeBoost;
      // A rare biome doesn't compete on climate: it takes over land
      // afterwards, below.
      if (b.rare) w = 0;
      if ((b.era ?? null) !== era) w = 0;
      weights[i] = w;
      total += w;
      if (w > bestW) { bestW = w; best = i; }
    }
    // A rare biome takes over part of the country it grows in (its
    // `within` list) wherever its own patchy noise is high — a share of
    // those biomes' weight handed to it, so its edge blends like any other
    // border and the land never jumps. Only that country, so a giant grove
    // is always somewhere wooded or grassy, never out on the sea or a peak.
    for (const i of era ? [] : this.rareIndexes) {
      const f = this.rareFactor(i, x, z);
      if (f <= 0) continue;
      const within = BIOMES[i].rare.within;
      let mass = 0, top = 0, other = 0;
      for (let j = 0; j < weights.length; j++) {
        if (within.includes(j)) { mass += weights[j]; if (weights[j] > top) top = weights[j]; }
        else if (j !== i && weights[j] > other) other = weights[j];
      }
      // How clearly this is its kind of country: nothing unless one of its
      // biomes is winning here anyway, fading to nothing as the sea or a
      // mountain catches up — so the edge of a grove by the shore is a
      // slope, not a step, and a grove never stands where the sea would.
      const lead = top > 0 ? (top - other) / top : 0;
      if (lead <= 0) continue;
      const share = Math.min(1, f * BIOMES[i].rare.boost) * Math.min(1, lead * 3);
      for (const j of within) weights[j] *= 1 - share;
      weights[i] = mass * share;
      best = 0;
      for (let j = 1; j < weights.length; j++) if (weights[j] > weights[best]) best = j;
    }
    const massif = era || !this.scale.massifs ? null : massifAt(this, x, z);
    if(massif) {
      const share=massif.influence;
      const summit=Math.min(1,Math.max(0,(share-.82)/.15));
      for(let i=0;i<weights.length;i++)weights[i]*=1-share;
      weights[BIOME_INDEX.get('mountains1')]+=total*share*(1-summit);
      weights[BIOME_INDEX.get('mountains2')]+=total*share*summit;
      best=0;
      for(let i=1;i<weights.length;i++)if(weights[i]>weights[best])best=i;
    }
    for (let i = 0; i < weights.length; i++) weights[i] /= total;
    return { weights, index: best, temp, wet, massif };
  }

  /**
   * A blended value of one numeric field across the biomes at a column. A
   * biome's `before` holds what a field was in older shapes of land.
   */
  blend(weights, field) {
    const values = this.fields[field] ??= BIOMES.map((b) => (this.terrain < 2 ? b.before?.[field] : undefined) ?? b[field]);
    let v = 0;
    for (let i = 0; i < values.length; i++) v += weights[i] * values[i];
    return v;
  }
}
