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

const GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, SAND = 6, SNOW = 12, SAPLING = 20;

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
    surface: { top: GRASS, under: DIRT, depth: 3, rock: STONE },
    // Dense enough to read as woodland from a distance without being a wall.
    trees: { chance: 0.055, trunk: [5, 8], canopy: 2, wood: WOOD, leaves: LEAVES },
    scatter: [{ block: SAPLING, chance: 0.004 }],
  },
  {
    id: 'highlands',
    name: 'Highlands',
    niche: { temp: 0.35, wet: 0.35 },
    base: 27, amplitude: 13, rough: 4,
    // Bare rock above the soil line is what makes a hill read as a hill, so
    // the top block is chosen by height rather than fixed. See `surfaceFor`.
    surface: { top: GRASS, under: DIRT, depth: 2, rock: STONE, bareAbove: 32 },
    trees: { chance: 0.008, trunk: [4, 6], canopy: 1, wood: WOOD, leaves: LEAVES },
    scatter: [{ block: STONE, chance: 0.006 }],
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
    surface: { top: GRASS, under: DIRT, depth: 4, rock: STONE },
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
