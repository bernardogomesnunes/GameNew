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
 * pick gives you a cliff wherever two biomes meet, because a meadow sitting at
 * 20 and highlands at 27 would step seven blocks in one column. So the height
 * is blended across every biome by how close its claim is, and only the
 * surface block comes from the winner. Borders end up as slopes, which is what
 * they look like from the ground.
 */

const FREQ = 0.0055;        // how big a region of one climate is
const FREQ_DETAIL = 0.02;   // wobble, so borders are not smooth ovals

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
    this.homePull = homePull;
    this.home = BIOMES[BIOME_INDEX.get(HOME_BIOME) ?? 0];
    this.centreX = sizeX / 2;
    this.centreZ = sizeZ / 2;
    // The radius over which the centre is pulled home.
    //
    // This was a third of the map — 87 blocks on a 256 world — on the reasoning
    // that the whole claimable map should be buildable country. That was wrong,
    // and it is why a new world looked like one green field: the near field was
    // 93% meadow out to 20 blocks and still 67% at 40, while the fog starts
    // eating the view at 72 on a phone. Every biome in the game sat in the band
    // that was already fading into sky.
    //
    // Only the *starting plot* has to be buildable, and that is 32 blocks
    // across. So the thumb covers the first ring with margin to spare and then
    // lets go, which puts the rest of the country where you can see it — and
    // makes the border moving out mean arriving somewhere that looks different.
    //
    // Swept rather than guessed, because both ends are bad. At 0.13 the
    // highlands come right up to the settlement and you arrive facing a wall
    // of gravel four blocks from your nose. At 0.20 the ring you land in is
    // 88% meadow — open ground to build on — and the country is properly
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
   * Every biome's share of a column, plus the winner.
   *
   * Weight falls off with the square of the distance in climate space, which
   * makes the winner dominate near the middle of its patch and the two
   * neighbours share evenly right at a border.
   */
  weigh(x, z) {
    const { temp, wet } = this.climate(x, z);
    const weights = new Array(BIOMES.length);
    let total = 0;
    let best = 0, bestW = -1;

    for (let i = 0; i < BIOMES.length; i++) {
      const n = BIOMES[i].niche;
      const dt = temp - n.temp, dw = wet - n.wet;
      const d2 = dt * dt + dw * dw;
      // The epsilon keeps a column sitting exactly on a niche from going
      // infinite; 1/d^4 is sharp enough that biomes stay recognisable.
      const w = 1 / ((d2 + 0.0016) * (d2 + 0.0016));
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
