import { createNoise2D } from 'simplex-noise';
import { BIOMES, BIOME_INDEX, HOME_BIOME } from '../config/biomes.js';

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

// Requested directly: "increase the distances of each biome... they can get
// bigger in footprint. All of them except the mountains." Lower frequency
// means a bigger region of one climate — this is the one shared knob every
// non-mountain biome's size comes from, so turning it down grows all of
// them together. Roughly 1.7x the region radius of the previous 0.0055 (and
// so about 3x the area) — mountains are untouched because their own size
// comes from RANGE_FREQ below instead, on a separate, already-tuned-rare
// gate that this multiplies into rather than replaces.
const FREQ = 0.0032;
// Kept in the same ratio to FREQ as before, so the border wobble scales with
// the bigger regions instead of looking proportionally smoother or jaggier.
const FREQ_DETAIL = 0.0116;

/**
 * The mountains' own placement, independent of climate.
 *
 * Requested directly: "fewer bigger ranges, and mountains wider too." Every
 * biome's region size otherwise comes from FREQ above, shared by all of
 * them — there's no way to make just the mountains bigger by moving a niche
 * around, since niche placement only decides *which* biome wins a column,
 * never how large the climate region it's competing over is. RANGE_FREQ is
 * a second, much lower-frequency noise field that multiplies straight into
 * a biome's ordinary niche weight (see weigh()) rather than replacing the
 * pick outright — so the two still blend at a range's edge the same smooth
 * way any other biome border does, just gated to occur much more rarely and
 * across a much wider footprint. RANGE_BASE cuts off the bottom of that
 * noise entirely (most of the map is simply not eligible); RANGE_POWER then
 * sharpens what's left, so a range reads as a real feature rather than a
 * gradient with no edge.
 */
const RANGE_FREQ = 0.0016;
const RANGE_BASE = 0.55;
const RANGE_POWER = 2;

/**
 * Mountains 2, nested inside an eligible Mountains 1 range rather than
 * placed on its own — see biomes.js's own note on `summitOnly`. The same
 * base/cutoff/power shape the range gate itself uses, just at a higher
 * frequency and a stricter cutoff, so it reads as the rare, tall heart of a
 * range rather than a whole separate tier of mountains with its own
 * footprint.
 */
const SUMMIT_FREQ = 0.02;
const SUMMIT_BASE = 0.48;
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
  constructor({ sizeX, sizeZ, seed = 1, homePull = 1 }) {
    this.sizeX = sizeX;
    this.sizeZ = sizeZ;
    this.temp = createNoise2D(mulberry32(seed + 101));
    this.wet = createNoise2D(mulberry32(seed + 977));
    this.warp = createNoise2D(mulberry32(seed + 5501));
    this.range = createNoise2D(mulberry32(seed + 8887));
    this.summit = createNoise2D(mulberry32(seed + 19301));
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
    const wx = this.warp(x * FREQ_DETAIL, z * FREQ_DETAIL) * 12;
    const wz = this.warp(z * FREQ_DETAIL + 40, x * FREQ_DETAIL - 40) * 12;
    let temp = (this.temp((x + wx) * FREQ, (z + wz) * FREQ) + 1) / 2;
    let wet = (this.wet((x - wz) * FREQ, (z - wx) * FREQ) + 1) / 2;

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
   * RANGE_FREQ's own note above). Suppressed near the settlement the same
   * way ordinary climate already is, and for the same reason: arriving to a
   * wall of stone four blocks from spawn is exactly what homePull exists to
   * prevent for every other biome too.
   */
  rangeFactor(x, z) {
    const n = (this.range(x * RANGE_FREQ, z * RANGE_FREQ) + 1) / 2;
    let factor = Math.pow(Math.max(0, n - RANGE_BASE) / (1 - RANGE_BASE), RANGE_POWER);
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
    const n = (this.summit(x * SUMMIT_FREQ, z * SUMMIT_FREQ) + 1) / 2;
    return Math.pow(Math.max(0, n - SUMMIT_BASE) / (1 - SUMMIT_BASE), SUMMIT_POWER);
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
    const range = this.rangeFactor(x, z);
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
      if (b.range) w *= b.summitOnly ? range * summit : range;
      weights[i] = w;
      total += w;
      if (w > bestW) { bestW = w; best = i; }
    }
    for (let i = 0; i < weights.length; i++) weights[i] /= total;
    return { weights, index: best, temp, wet };
  }

  /** A blended value of one numeric field across the biomes at a column. */
  blend(weights, field) {
    let v = 0;
    for (let i = 0; i < BIOMES.length; i++) v += weights[i] * BIOMES[i][field];
    return v;
  }
}
