/**
 * The kinds of country a world is made of.
 *
 * Every world was one green landscape at one height with trees sprinkled at a
 * flat 1.2% — which meant every direction looked the same, and walking
 * anywhere told you nothing. Biomes are the fix: the land is still one
 * continuous surface, but what it is made of and how hard it rolls comes from
 * where you are standing.
 *
 * Which biome a spot gets is decided by two slow noise fields — how warm it is
 * and how wet — so the same kinds of country turn up together the way they do
 * on a map, rather than being scattered at random. Each biome claims a patch of
 * that climate square, and the nearest claim wins.
 *
 * How to read one:
 *
 *   niche     where it sits in climate: temp and wet, each 0..1
 *   base      the height it sits at before the hills are added
 *   amplitude how hard the land rolls; 0 is a plain
 *   rough     detail on top of the roll, for scree and dunes
 *   surface   the block on top, then what is under it
 *   trees     how often a column gets one, and what it looks like
 *   scatter   the odd boulder or patch, as { block, chance }
 *
 * Adding one is an entry here. Nothing else needs to know it exists.
 */

const GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, SAND = 6, COBBLE = 8;
const SNOW = 12, SAPLING = 20, MOSS = 22, GRAVEL = 23, CLAY = 24, SILT = 25;
const IRON_ORE = 38, COPPER_ORE = 39, GOLD_ORE = 40;

export const BIOMES = [
  {
    id: 'meadow',
    name: 'Meadow',
    niche: { temp: 0.55, wet: 0.45 },
    base: 20, amplitude: 5, rough: 1.5,
    surface: { top: GRASS, under: DIRT, depth: 3, rock: STONE },
    // Open ground you can actually build on: the starting plot lands here.
    trees: { chance: 0.004, trunk: [4, 6], canopy: 2, wood: WOOD, leaves: LEAVES },
    scatter: [{ block: SAPLING, chance: 0.002 }],
  },
  {
    id: 'forest',
    name: 'Forest',
    niche: { temp: 0.5, wet: 0.8 },
    base: 21, amplitude: 7, rough: 2,
    // Moss rather than grass: a forest you can tell you are in while looking
    // at your feet, not only by counting the trunks.
    surface: { top: MOSS, under: DIRT, depth: 3, rock: STONE },
    // Dense enough to read as woodland from a distance without being a wall.
    trees: { chance: 0.11, trunk: [5, 8], canopy: 2, wood: WOOD, leaves: LEAVES },
    scatter: [{ block: SAPLING, chance: 0.006 }],
  },
  {
    id: 'sands',
    name: 'Sands',
    niche: { temp: 0.9, wet: 0.12 },
    base: 18, amplitude: 4, rough: 2.5,
    surface: { top: SAND, under: SAND, depth: 5, rock: STONE },
    trees: { chance: 0 },
    scatter: [],
  },
  {
    id: 'wetland',
    name: 'Wetland',
    niche: { temp: 0.7, wet: 0.95 },
    // Low and almost flat, so the rivers that cross it spread out instead of
    // cutting through.
    base: 16, amplitude: 2, rough: 1,
    surface: { top: CLAY, under: DIRT, depth: 4, rock: STONE },
    trees: { chance: 0.012, trunk: [3, 4], canopy: 2, wood: WOOD, leaves: LEAVES },
    scatter: [{ block: SAPLING, chance: 0.012 }],
  },
  {
    id: 'snowfield',
    name: 'Snowfield',
    niche: { temp: 0.08, wet: 0.5 },
    base: 26, amplitude: 9, rough: 2.5,
    surface: { top: SNOW, under: DIRT, depth: 3, rock: STONE },
    // Tall and narrow: a pine, as much as this block set allows.
    trees: { chance: 0.02, trunk: [6, 9], canopy: 1, wood: WOOD, leaves: LEAVES },
    scatter: [],
  },
  {
    // Requested directly: "fewer bigger ranges, and mountains wider too,
    // with some buff step mountains too." Region *size* for every biome
    // here comes from one shared climate frequency (biomeMap.js's FREQ),
    // so there is no way to make just the mountains bigger by moving a
    // niche around — `range: true` is a second, independent gate biomeMap
    // multiplies into highlands' and peaks' weight on top of the ordinary
    // climate pick, at its own much lower frequency. See BiomeMap.weigh
    // and rangeFactor for the mechanism; the niche below still decides
    // which of the two wins *inside* an eligible range, and still governs
    // how far each blends into ordinary climate country at the edges.
    id: 'highlands',
    name: 'Highlands',
    niche: { temp: 0.35, wet: 0.35 },
    range: true,
    base: 27, amplitude: 13, rough: 4,
    // Bare rock above the soil line is what makes a hill read as a hill, so
    // the top block is chosen by height rather than fixed. See `surfaceFor`.
    surface: { top: GRAVEL, under: STONE, depth: 2, rock: COBBLE, bareAbove: 32 },
    trees: { chance: 0.008, trunk: [4, 6], canopy: 1, wood: WOOD, leaves: LEAVES },
    scatter: [{ block: STONE, chance: 0.01 }],
  },
  {
    // The "buff step" variant — a second, narrower gate (`peaksOnly` in
    // biomeMap.js) picks out a minority of an eligible range for this
    // instead of ordinary highlands, so a range reads as mostly rolling
    // hills with real terraced buffs standing out of some of it rather
    // than either everywhere or nowhere. The terracing itself is a height
    // post-process in ChunkGen.heightAt, faded in by this biome's own
    // blend weight rather than a hard line.
    id: 'peaks',
    name: 'Buff Peaks',
    niche: { temp: 0.3, wet: 0.3 },
    range: true,
    peaksOnly: true,
    base: 31, amplitude: 15, rough: 5,
    surface: { top: STONE, under: STONE, depth: 2, rock: STONE, bareAbove: 22 },
    trees: { chance: 0.002, trunk: [3, 5], canopy: 1, wood: WOOD, leaves: LEAVES },
    scatter: [{ block: COBBLE, chance: 0.02 }],
  },
  {
    // Requested directly: "a very high mountain which should have ores."
    // Gated the same depth as the buff-step peaks — both multiply straight
    // into `range`, never into each other (see biomeMap.js's summitFactor)
    // — so a summit shares the same mountain ranges the ordinary peaks
    // already stand in rather than needing a rarer range of its own
    // somewhere territory will never reach. Broken rock throughout, bared
    // to solid stone right at the peak — and it's the one biome with
    // `ores`: real veins embedded in its rock layer, well under 5% of it
    // (see ChunkGen.oreAt).
    id: 'summit',
    name: 'Summit',
    niche: { temp: 0.28, wet: 0.3 },
    range: true,
    summitOnly: true,
    base: 42, amplitude: 8, rough: 3,
    surface: { top: COBBLE, under: STONE, depth: 3, rock: STONE, bareAbove: 36 },
    trees: { chance: 0 },
    scatter: [],
    // Each entry rolls independently against the rock layer only (not the
    // soil above it) — see ChunkGen.oreAt. Combined, under a quarter of the
    // 5% ceiling that was asked for: rare enough that finding a seam still
    // means something.
    ores: [
      { block: IRON_ORE, chance: 0.010, salt: 0x4f11 },
      { block: COPPER_ORE, chance: 0.008, salt: 0x4f22 },
      { block: GOLD_ORE, chance: 0.005, salt: 0x4f33 },
    ],
  },
  {
    // Requested alongside the mountains: an ocean, appearing "anywhere but
    // rarer, like a plains biome" — an ordinary niche like any other, not a
    // separate system, so how much of the map it covers is tuned the same
    // way every other biome's frequency already is (see biomes.test.mjs's
    // coverage check). What makes it read as sea rather than a low field is
    // ChunkGen.seaLevelAt: anywhere the blended height dips below sea level
    // floods, the same way a river cuts its own bed instead of being
    // painted on — this biome's job is only to pull the blend low enough,
    // over real country, that it actually happens.
    id: 'ocean',
    name: 'Ocean',
    niche: { temp: 0.5, wet: 1 },
    base: 8, amplitude: 3, rough: 1,
    surface: { top: SILT, under: SILT, depth: 4, rock: STONE },
    trees: { chance: 0 },
    scatter: [],
  },
];

export const BIOMES_BY_ID = new Map(BIOMES.map((b) => [b.id, b]));

/** Index in BIOMES, which is what the per-column map stores. */
export const BIOME_INDEX = new Map(BIOMES.map((b, i) => [b.id, i]));

export function biomeAt(index) {
  return BIOMES[index] ?? BIOMES[0];
}

/** Where a new world's settlement goes: the one biome meant to be built on. */
export const HOME_BIOME = 'meadow';

/**
 * The surface block for a column of this biome at this height.
 *
 * Highlands go bare above the soil line — grass all the way to the top of a
 * 40-block crag looks like carpet, and the rock is the whole point of them.
 */
export function surfaceFor(biome, height) {
  const s = biome.surface;
  if (s.bareAbove != null && height > s.bareAbove) return s.rock;
  return s.top;
}
