import { inPast } from './past.js';
import { inFuture } from './future.js';
import { createNoise2D } from 'simplex-noise';
import { BIOMES, BIOME_INDEX, HOME_BIOME } from '../config/biomes.js';
import { mountainRangeAt } from './mountainRanges.js';

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

// Lower frequency means a bigger region of one climate — the one shared knob
// every non-mountain biome's size comes from. WORLD-3 ("plains bigger") made
// it another 28% wider; mountains take their size from the ridge landform.
const FREQ = 0.0025;
// Kept in the same ratio to FREQ as before, so the border wobble scales with
// the bigger regions instead of looking proportionally smoother or jaggier.
const FREQ_DETAIL = 0.0091;

// Mountain geography comes from the connected ridge landform. Climate chooses
// the lowland foundation; ridge relief decides mountain surfaces afterwards.

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
    this.seed = seed;
    this.sizeX = sizeX;
    this.sizeZ = sizeZ;
    this.temp = createNoise2D(mulberry32(seed + 101));
    this.wet = createNoise2D(mulberry32(seed + 977));
    this.warp = createNoise2D(mulberry32(seed + 5501));
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
   * 0..1: the connected range's broad foothill apron. Most of the map is
   * outside a range, and the settlement is protected by the landform itself.
   */
  rangeFactor(x, z) {
    return mountainRangeAt(this, x, z)?.influence ?? 0;
  }

  /**
   * 0..1: the ridge profile within the foothill apron, including saddles.
   */
  summitFactor(x, z) {
    return mountainRangeAt(this, x, z)?.ridge ?? 0;
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
   * Climate selects the blended lowland foundation. Connected ridge relief
   * then adds mountain surfaces above it; the two sets of weights are kept
   * separate so mountain biomes cannot create a second height blob.
   */
  weigh(x, z) {
    const { temp, wet } = this.climate(x, z);
    // The Past (world/past.js) and the Future (world/future.js): their own
    // biomes there, and only there.
    const past = inPast(x, this.centreX ?? 0);
    const era = past ? 'past' : inFuture(x, this.centreX ?? 0) ? 'future' : null;
    const massif = era ? null : mountainRangeAt(this, x, z, wet);
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
      // Mountain locations and relief come from a connected landform, not
      // isolated climate patches. Climate still chooses the lowland beneath.
      if (b.range) w = 0;
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
    const terrainWeights = weights.map(w => w / total);
    if(massif) {
      // Grass and the local biome survive on the broad foothill apron;
      // stone and snow belong to the crest, independent of climate niches.
      const share=Math.min(1,Math.max(0,(massif.ridge-.12)/.55))*massif.influence;
      const summit=Math.min(1,Math.max(0,(massif.ridge-.70)/.20));
      for(let i=0;i<weights.length;i++)weights[i]*=1-share;
      weights[BIOME_INDEX.get('mountains1')]+=total*share*(1-summit);
      weights[BIOME_INDEX.get('mountains2')]+=total*share*summit;
      best=0;
      for(let i=1;i<weights.length;i++)if(weights[i]>weights[best])best=i;
    }
    for (let i = 0; i < weights.length; i++) weights[i] /= total;
    return { weights, terrainWeights, index: best, temp, wet, massif };
  }

  /** A blended value of one numeric field across the biomes at a column. */
  blend(weights, field) {
    let v = 0;
    for (let i = 0; i < BIOMES.length; i++) v += weights[i] * BIOMES[i][field];
    return v;
  }
}
