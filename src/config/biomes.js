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
 * Requested directly, and rebuilt from scratch to it: bigger biomes (region
 * *size* comes from biomeMap.js's shared climate frequency — turned down
 * there for everyone except the two mountain biomes, which keep the separate,
 * already-tuned-rare `range` gate they had), a named, exact list of country
 * — Plains, Desert, Ocean, three kinds of Forest, and two tiers of mountain —
 * and real depth: the world is three times as tall as it was so there is
 * room for a genuinely deep ocean, a 100-block layer of diggable rock for
 * caves, and a second mountain tier that actually towers.
 *
 * How to read one:
 *
 *   niche     where it sits in climate: temp and wet, each 0..1
 *   base      the height it sits at before the hills are added
 *   amplitude how hard the land rolls; 0 is a plain
 *   rough     detail on top of the roll, for scree and dunes
 *   flat      how much more (or less) than usual this biome favours a local
 *             flat patch — see ChunkGen.flatFactor. 1 is ordinary.
 *   surface   the block on top, then what is under it
 *   trees     how often a column gets one, and what it looks like — `giants`
 *             is the share of them that are giants (1 in 50 if not given)
 *   rare      a gate that only lets this biome in where a patchy noise of its
 *             own is high — see biomeMap.js's rareFactor
 *   treeMaxHeight  if set, a tree only takes root below this ground height —
 *             the "only near the foot of the mountain" rule for both tiers.
 *   scatter   the odd boulder or patch, as { block, chance }
 *
 * Adding one is an entry here. Nothing else needs to know it exists.
 */

const GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, SAND = 6, COBBLE = 8, SANDSTONE = 333;
// No saplings in the wild: a sapling is only ever one somebody planted
// (playtest, P8 — see duilt/Saplings.js).
const MOSS = 22, GRAVEL = 23, CLAY = 24, SILT = 25;
const WHITE_WOOD = 41, WHITE_LEAVES = 42, DARK_WOOD = 43, DARK_LEAVES = 44, DARK_MOSS = 46;
const FOREST_FLOOR = 147;
const IRON_ORE = 38, COPPER_ORE = 39, GOLD_ORE = 40;

export const BIOMES = [
  {
    id: 'plains',
    name: 'Plains',
    niche: { temp: 0.55, wet: 0.42 },
    // Almost no roll of its own — what makes Plains read as open country is
    // the huge flat patches (see `flat`, and ChunkGen.flatFactor for how it
    // spends this), not a low amplitude alone.
    base: 104, amplitude: 3, rough: 1,
    flat: 1.5,
    surface: { top: GRASS, under: DIRT, depth: 3, rock: STONE },
    // Open ground you can actually build on: the starting plot lands here.
    // Fewer trees than before — requested directly, "green with fewer trees
    // just some."
    trees: { chance: 0.003, trunk: [4, 6], canopy: 2, wood: WOOD, leaves: LEAVES },
  },
  {
    // The everyday wood: same wood/leaves it always had, the middle of the
    // three forests' climate range.
    id: 'forestOak',
    name: 'Oak Forest',
    niche: { temp: 0.5, wet: 0.72 },
    base: 105, amplitude: 5, rough: 3,
    flat: 1.1,
    // Moss rather than grass: a forest you can tell you are in while looking
    // at your feet, not only by counting the trunks.
    surface: { top: MOSS, under: DIRT, depth: 3, rock: STONE },
    trees: { chance: 0.11, trunk: [5, 8], canopy: 2, wood: WOOD, leaves: LEAVES },
  },
  {
    // Cooler and drier than the oak wood, with a pale trunk and canopy —
    // requested directly as one of "two more trees."
    id: 'forestBirch',
    name: 'Birch Forest',
    niche: { temp: 0.38, wet: 0.6 },
    base: 103, amplitude: 4, rough: 2.5,
    flat: 1.2,
    // Grass, like the plains: it was bare dirt, and birch woods are a
    // quarter of the land — reported directly: "Most of the world should be
    // turf with dirt below."
    surface: { top: GRASS, under: DIRT, depth: 3, rock: STONE },
    // On the map, its pale leaves set it apart from the plains' same grass.
    mapTint: WHITE_LEAVES,
    trees: { chance: 0.1, trunk: [4, 7], canopy: 2, wood: WHITE_WOOD, leaves: WHITE_LEAVES },
  },
  {
    // Warmer, wetter, denser: the darkest and thickest of the three.
    id: 'forestDark',
    name: 'Dark Forest',
    niche: { temp: 0.58, wet: 0.85 },
    base: 107, amplitude: 6, rough: 3.5,
    flat: 1.0,
    // Its own deeper, shadier moss — see config/blocks.js's Dark Moss.
    surface: { top: DARK_MOSS, under: DIRT, depth: 3, rock: STONE },
    trees: { chance: 0.13, trunk: [6, 9], canopy: 2, wood: DARK_WOOD, leaves: DARK_LEAVES },
  },
  {
    // Requested directly: "we can have a biome full of gigantic trees that
    // is rare." It doesn't have a climate of its own to win: where a rare,
    // patchy noise is high (`rare`, see biomeMap.js) it takes over whatever
    // wooded, grassy or wet country is there — never the sea, the desert or
    // the mountains. Most of its trees are giants; the rest are tall.
    // Gently rolling, open under the canopy, on a floor of fallen leaves.
    id: 'giantGrove',
    name: 'Giant Grove',
    // Unused for placement (see above); kept so the biome has a climate
    // like every other, for anything that reads one.
    niche: { temp: 0.52, wet: 0.76 },
    rare: {
      freq: 0.0013, base: 0.82, power: 1.3, boost: 3, salt: 40411,
      in: ['plains', 'forestOak', 'forestBirch', 'forestDark', 'wetland'],
    },
    base: 106, amplitude: 4, rough: 2,
    flat: 1.1,
    surface: { top: FOREST_FLOOR, under: DIRT, depth: 3, rock: STONE },
    trees: { chance: 0.018, trunk: [7, 10], canopy: 3, wood: WOOD, leaves: LEAVES, giants: 0.7 },
  },
  {
    // Requested directly: "bigger flat areas even, and some steeper between
    // the flat areas." A higher `flat` than Plains for the first half, and a
    // higher `rough` than Plains for the second — the dunes between the
    // pans, not the pans themselves.
    id: 'desert',
    name: 'Desert',
    niche: { temp: 0.9, wet: 0.12 },
    base: 104, amplitude: 6, rough: 4,
    flat: 1.8,
    // Sandstone under the sand (#33), three down, and breaking through it
    // in outcrops where the ground's bones show.
    surface: { top: SAND, under: SAND, depth: 6, rock: STONE, bed: SANDSTONE, cover: 3, outcrop: SANDSTONE },
    trees: { chance: 0 },
    scatter: [],
  },
  {
    // The smaller bodies of water — praised directly as already looking
    // good, and kept exactly that way rather than folded into the ocean:
    // low and almost flat, so a pond sits in a real dip instead of being a
    // sheet of water floating over dry ground.
    id: 'wetland',
    name: 'Wetland',
    niche: { temp: 0.65, wet: 0.92 },
    base: 98, amplitude: 2, rough: 1,
    flat: 1.3,
    surface: { top: CLAY, under: DIRT, depth: 4, rock: STONE },
    trees: { chance: 0.012, trunk: [3, 4], canopy: 2, wood: WOOD, leaves: LEAVES },
  },
  {
    // Mountains 1: the short range — requested at "20 blocks tall," a range
    // that turns up often enough to sometimes carry a tree, and with a
    // stream running off it (see ChunkGen.streamCut) rather than being bare
    // rock. Its niche sits close to the ocean's own (both high `wet`) so the
    // nearest-claim placement in biomeMap.js tends to put a range near a
    // coastline rather than nowhere near one — see biomeMap's own note on
    // why niche distance, not a rule, is what "near the ocean" means here.
    id: 'mountains1',
    name: 'Mountains',
    niche: { temp: 0.45, wet: 0.82 },
    range: true,
    base: 112, amplitude: 12, rough: 4,
    flat: 0.7,
    // Bare rock above the tree line is what makes a hill read as a hill, so
    // the top block is chosen by height rather than fixed. See `surfaceFor`.
    surface: { top: GRAVEL, under: STONE, depth: 2, rock: COBBLE, bareAbove: 116 },
    trees: { chance: 0.02, trunk: [4, 6], canopy: 1, wood: WOOD, leaves: LEAVES },
    treeMaxHeight: 118,
    scatter: [{ block: STONE, chance: 0.01 }],
    streams: true,
  },
  {
    // Mountains 2: rare, "50 to 70 blocks high," ore-rich, and bare above the
    // foothills — trees only take root in the lower blend zone (see
    // `treeMaxHeight`), not partway up the real mass of it. Nested inside
    // the same `range` gate Mountains 1 shares (`summitOnly` in
    // biomeMap.js), so it stands inside the same ranges rather than needing
    // a rarer footprint of its own — and, per the direct instruction to
    // leave mountain footprints alone, that gate is untouched by the wider
    // regions every other biome above just got.
    id: 'mountains2',
    name: 'High Peaks',
    niche: { temp: 0.28, wet: 0.28 },
    range: true,
    summitOnly: true,
    base: 138, amplitude: 36, rough: 5,
    flat: 0.5,
    surface: { top: COBBLE, under: STONE, depth: 3, rock: STONE, bareAbove: 148 },
    trees: { chance: 0.008, trunk: [3, 5], canopy: 1, wood: WOOD, leaves: LEAVES },
    treeMaxHeight: 138,
    scatter: [],
    // Each entry rolls independently against the rock layer only (not the
    // soil above it) — see ChunkGen.oreAt. Requested directly as "lots of
    // ores here": roughly double the previous, rare-summit rate.
    ores: [
      { block: IRON_ORE, chance: 0.018, salt: 0x4f11 },
      { block: COPPER_ORE, chance: 0.014, salt: 0x4f22 },
      { block: GOLD_ORE, chance: 0.008, salt: 0x4f33 },
    ],
  },
  {
    // "Really big, and deep... maybe the deepest point 30 blocks. And it
    // should be surrounded by sand like a beach." The depth is base/
    // amplitude sitting well under the new, much higher SEA_LEVEL — see
    // ChunkGen's own constants. The beach isn't this biome's own doing: any
    // dry column near sea level turns to sand regardless of whose niche it
    // is (ChunkGen.fill's beach band), which is what makes the transition
    // read as a coastline rather than a hard biome edge.
    id: 'ocean',
    name: 'Ocean',
    niche: { temp: 0.5, wet: 1 },
    base: 72, amplitude: 6, rough: 2,
    flat: 0.6,
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
export const HOME_BIOME = 'plains';

/**
 * The surface block for a column of this biome at this height.
 *
 * Mountains go bare above the tree line — grass all the way to the top of a
 * seventy-block peak looks like carpet, and the rock is the whole point of it.
 */
export function surfaceFor(biome, height) {
  const s = biome.surface;
  if (s.bareAbove != null && height > s.bareAbove) return s.rock;
  return s.top;
}
