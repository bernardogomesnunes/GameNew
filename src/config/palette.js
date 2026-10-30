/**
 * The storybook palette: the look of the world, in one place.
 *
 * Asked for directly: the game should feel "whimsical and mystical", after two
 * pictures — a witch's cottage at night (indigo sky, lavender slate, glowing
 * amber windows, pink spotted mushrooms) and a watercolour village by day
 * (pastel roofs, rainbow cobbles, soft spring grass). The old world was lime
 * grass and flat blue sky, saturated and bright even at night.
 *
 * So: stone and cobble lean lavender, wood leans plum, leaves are mint-teal,
 * birch is in pink blossom, roofs are rose and slate-violet, the grass is a
 * softer spring green, and the sky goes powder blue by day, pink at dusk and
 * indigo at night. Lamps and windows stay warm amber: the one warm light in a
 * cool night is most of the mood.
 *
 * Blocks take their colour from BLOCK_COLOURS by name (config/blocks.js);
 * an item made of a block follows it (config/items.js); the sky and the light
 * are SKY (render/DayCycle.js, render/atmosphere.js). The greens were pulled
 * back a second time ("greens are still too saturated"): grass and leaves sit
 * near chroma 20 to 28, soft like the watercolour village. Then, with
 * Hytale as the picture, the grass came back fresher (chroma ~42) once its
 * texture lost the grain that had made it look dull.
 */

/** The named colours everything else is picked from. */
export const PALETTE = {
  // The night.
  indigo: 0x1f1b4a, plum: 0x4a3570, violet: 0x6e58a8, lavender: 0x9d8fd0, lilac: 0xc7b8ea, mist: 0xe6def5,
  // The warm lights in it.
  lantern: 0xffd27a, candle: 0xffe7a8, butter: 0xf5dc8a,
  // Pinks and warm earth.
  rose: 0xd8687c, bubblegum: 0xf2a5c0, blush: 0xf8d3dc, peach: 0xf4b48c, apricot: 0xeb9a64, terracotta: 0xc46a5e,
  // Greens and teals.
  spring: 0xa8d48a, sage: 0x9fbf98, moss: 0x92b48a, mint: 0xa8d8c4, teal: 0x86b4a0, deepTeal: 0x527f84,
  // Wood and stone.
  honey: 0xdcb48a, cocoa: 0x9a6a58, plumwood: 0xa07a5a, stone: 0xb8b2c6, slate: 0x7a74a8,
  // Sky and water.
  cloud: 0xfff7f2, powder: 0xa9cdf2, water: 0x6aa8de,
};

const P = PALETTE;

/**
 * Every block's colour, by name. Variants (stairs, slabs, walls, open doors,
 * flowing water, a crop's stages) are looked up by their base name — see
 * blockColour. A block not listed keeps the colour it was given.
 */
export const BLOCK_COLOURS = {
  // The ground.
  Grass: P.spring, Ground: P.spring, Dirt: P.cocoa, Farmland: 0x7a4c40, Sand: 0xf0dca2, Snow: 0xf6f4fb,
  Moss: P.moss, 'Dark Moss': 0x66806e, 'Forest Floor': 0x6e5a52, 'Jungle Floor': 0x586e56, 'Fern Turf': 0xa6c288,
  Gravel: 0xa7a0b4, Clay: 0xc2988a, Silt: 0x8f9a8a, 'Sand Path': 0xe2c290,
  // Trees.
  Wood: P.plumwood, Leaves: P.teal, Sapling: 0x9cc08e,
  'White Wood': 0xefe6ea, 'White Leaves': 0xeeeef0, 'Pink Leaves': 0xf2b6cf, 'Dark Wood': 0x4e3646, 'Dark Leaves': P.deepTeal,
  'Stripped Oak Log': 0xd6a87e, 'Stripped White Log': 0xf2e8ee, 'Stripped Dark Log': 0x8a5e6a,
  // Stone.
  Stone: P.stone, Cobblestone: 0xc6bdd6, 'Stone Brick': 0xb2abc2, 'Stone Mill': 0xa29cb2,
  'Stone Pillar': P.stone, 'Stone Roof Tiles': P.slate,
  'White Stone': 0xebe5ec, 'Turquoise Stone': 0x6cc0b6, 'Orange Stone': 0xe8986a, 'Dark Grey Stone': 0x6e6a7e,
  // The Stone Kingdom stays dark and clearly four materials: slate-blue stone,
  // wine-red brick, purple-black obsidian, true-black calçada.
  'Dark Stone': 0x4c5068, 'Dark Pillar': 0x4c5068, Obsidian: 0x2b1d45, Godstone: 0x7a6aa0,
  Sandstone: 0xe3c08e, 'Sandstone Brick': 0xe8c896,
  Marble: 0xf3ecee, 'Marble Pillar': 0xf3ecee, 'Marble Table': 0xf3ecee, 'Sky Marble': 0xeef0fb,
  Calçada: 0xf5efe8, 'Calçada Wave': 0xf5efe8,
  // Ores: a little of the stone's lavender in each.
  'Iron Ore': 0xb0a8b8, 'Copper Ore': 0xb49a8c, 'Gold Ore': 0xb8ac90, 'Coal Ore': 0x948c96,
  'Diamond Ore': 0xa2b0bc, 'Ruby Ore': 0xaa8a96, 'Sunstone Ore': 0xa8a090, 'Nightstone Ore': 0x433a5e,
  // Brick and roofs.
  Brick: P.terracotta, 'Brick Chimney': P.terracotta, 'Brick Roof Tiles': 0xd98a8c,
  'Dark Brick': 0x6a3a40, 'Stone Brick Chimney': 0xb2abc2,
  // Wood worked.
  Planks: P.honey, 'Oak Table': P.honey, 'Oak Chair': P.honey, 'Wood Panel': P.honey, 'Patterned Panel': P.honey,
  'Two-tone Panel': 0xe0bf96, Fence: 0xc08a5e, Gate: 0xa47452, Door: 0xb07a56, Trapdoor: 0xb07a56,
  Chest: 0xa8724e, Cabinet: 0xb88a62, Wardrobe: 0xa06e52, 'Bedside Table': 0xc2946a, 'Framed Window': 0xa07a5c,
  'Wood Mill': 0xa07a5c, 'Timber Frame': 0xf5ebe0, 'Storage Controller': 0xb08458,
  'White Planks': 0xead9c6, 'White Table': 0xead9c6, 'White Chair': 0xead9c6, 'White Panel': 0xead9c6,
  'White Patterned Panel': 0xead9c6, 'White Fence': 0xdfcdb8, 'White Gate': 0xd6c2ab, 'White Trapdoor': 0xdccab0,
  'White Door': 0xdccab0, 'White Cabinet': 0xd2c4b8, 'White Wardrobe': 0xbba49a, 'White Bedside Table': 0xdcd0c6,
  'Dark Planks': 0x6e4a56, 'Dark Table': 0x6e4a56, 'Dark Chair': 0x6e4a56, 'Dark Panel': 0x6e4a56,
  'Dark Patterned Panel': 0x6e4a56, 'Dark Fence': 0x664456, 'Dark Gate': 0x5c3e4e, 'Dark Trapdoor': 0x5c3e4e,
  'Dark Door': 0x5c3e4e, 'Dark Cabinet': 0x664456, 'Dark Wardrobe': 0x573a48, 'Dark Bedside Table': 0x6a4a58,
  // Glass, water, lava, light.
  Glass: 0xd8e2f8, 'Red Glass': 0xec7a92, 'Blue Glass': 0x8a96e8, 'Tinted Glass': 0x5a8fbe,
  Water: P.water, Lava: 0xff7a3a, Lantern: P.lantern, 'Firefly Lantern': 0xe2f2a0, 'Lit Window': 0xffe2a0,
  Amethyst: 0xb48ae6, 'Way Out': 0xc4a8ff, 'Gold Block': 0xf6cf5a, 'Gold Trim': 0xf6cf5a, Chandelier: 0x5d5568, Chain: 0x5e5e74,
  // Cloth.
  'Red Chair': 0xc75a72, 'Red Rug': 0xc4566e, 'Blue Rug': 0x6c7fd0, 'Green Rug': 0x7fa894, Bed: 0xc4566e,
  'White Banner': 0xf7f2f4, 'Black Banner': 0x2e2a3e, 'War Tent': 0x6e5c5a, 'War Standard': 0xd0a84a,
  // Things.
  Vase: 0xd48a6c, Urn: 0xb8925e, Painting: 0x8a6448, Catapult: 0x8a6448, 'Weapon Rack': 0x7e5a48,
  'Training Dummy': 0xdcbc70, 'Archery Target': 0xece4d6, Campfire: 0x6e4a3a, 'Sky Lift': 0xead07a,
  'Time Machine': 0xd0aa5e, Rail: 0x8f8ca0, 'Maglev Rail': 0x747a8c,
  'Raptor Egg': 0x92a072, 'Triceratops Egg': 0xdcc6a0, 'Long-neck Egg': 0xbccae0,
  // Crops: softer greens.
  'Carrot Plant': 0x8cb27c, 'Potato Plant': 0x94b282, 'Cabbage Plant': 0x9cc08c, 'Lettuce Plant': 0xa8c890,
  'Pepper Plant': 0x80aa76, 'Zucchini Plant': 0x7ea67a, 'Broccoli Plant': 0x769c70, 'Coffee Plant': 0x648c6e,
  'Hemp Plant': 0x809a6a,
  // The Future keeps its neon, a touch nearer the rest.
  Pavement: 0xc8c8d6, Asphalt: 0x3c3a4a, 'Steel Panel': 0xa0a6b8, 'Neon Pink': 0xff5fbf, 'Neon Cyan': 0x4fe8ff,
  Screen: 0x4a7cff, 'Future Lamp': 0xe8faff, Archive: 0x64d2ff,
};

/** A variant's base name: "Open Dark Door" → "Dark Door", "Ripe Carrot" → "Carrot Plant", "Stone Stairs" → "Stone". */
export function blockColour(name) {
  if (BLOCK_COLOURS[name] != null) return BLOCK_COLOURS[name];
  let n = name.replace(/^Open /, '').replace(/^Flowing /, '');
  if (BLOCK_COLOURS[n] != null) return BLOCK_COLOURS[n];
  const ripe = n.match(/^Ripe (.+)$/);
  if (ripe && BLOCK_COLOURS[`${ripe[1]} Plant`] != null) return BLOCK_COLOURS[`${ripe[1]} Plant`];
  n = n.replace(/ (Slab|Stairs|Wall)$/, '');
  if (BLOCK_COLOURS[n] != null) return BLOCK_COLOURS[n];
  if (n === 'Plank') return BLOCK_COLOURS.Planks;
  return null;
}

/**
 * Tool and weapon tiers (config/tiers.js): iron with the stone's lavender in
 * it, and the dark tier's guard the dark god's violet rather than blood red.
 */
export const TIER_COLOURS = {
  iron: { color: 0xc8c8dc, edge: 0xf0eefa },
  dark: { color: 0x3e3858, edge: 0x6e6490, guard: 0x7a4aa8 },
};

/** The sky and the light over a day (render/DayCycle.js) and the mist (render/atmosphere.js). */
export const SKY = {
  horizonDay: 0xdcecfb, horizonDusk: 0xffbfa6, horizonNight: 0x3d2c74,
  midDay: 0xa6c8f7, midDusk: 0xe596bf, midNight: 0x281f62,
  zenithDay: 0x5c9cec, zenithDusk: 0x5a48ac, zenithNight: 0x0e0b30,
  washDay: 0xf8d2e6, washDusk: 0xffd29a, washNight: 0x6a46b0,
  glowDay: 0x4a3f3a, glowDusk: 0xff8f8a,
  sunDay: 0xfff2d8, sunLow: 0xffb48e, moon: 0xb9a8f0,
  ambientDay: 0xfff1e2, ambientDusk: 0xeac4dc, ambientNight: 0x8a7cc4,
  cloudDay: 0xfff7f2, cloudDusk: 0xf7b8c8, cloudNight: 0x4a3f7a,
  groundDay: 0x8a6a5a, groundNight: 0x241c3a,
  mistDay: 0xebe6f6, mistDawn: 0xf6d6e2, mistNight: 0x3a2f62,
};

/**
 * The colour grade (render/atmosphere.js): brighter than the light alone, and
 * a saturation lift. The old 1.32 and 1.14 turned the grass neon; these keep
 * the palette near the colours it's painted, with the faintest lift.
 */
export const GRADE = {
  exposure: 1.16, saturation: 1.04,
  // Split toning (asked for: shader packs like Complementary as inspiration):
  // shade leans lavender, light leans warm peach.
  shadowTint: 0x8a7ad8, shadowAmount: 0.14, lightTint: 0xffd9b8, lightAmount: 0.12,
};
