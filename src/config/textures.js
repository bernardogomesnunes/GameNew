/**
 * What each material looks like close up, as a recipe rather than a picture.
 *
 * No texture pack. Minecraft's are copyrighted, and a downloaded set would
 * arrive with its own palette and fight the one this game already has — every
 * block colour here is derived from the block registry, so a tile painted
 * somewhere else would be the one thing on screen that could not follow it.
 *
 * So: a recipe per material, painted at load (render/BlockTextures.js) into a
 * 32×32 tile that multiplies the block's colour. The recipes are drawn from
 * life, the way the cobblestone first was from a photo of a cobbled street:
 * what a brick wall, a plank floor or a birch trunk actually has in it — the
 * mortar, the seams, the grain, the warm and cool stones, the moss in the
 * cracks — written down as a few numbers each.
 *
 * Colour lives in the tile now, not only shading. Every recipe paints in
 * multipliers of the block's own colour, so a tint of [1.1, 1, 0.85] is "a
 * warmer fleck of this", and the tile is then evened out so that its average
 * *is* the registry colour (see BlockTextures' normalise). That is what keeps
 * one palette in charge: the far hills, the map, a slab and a bag icon all use
 * the plain registry colour and still match the textured block, because that
 * colour is what the texture averages to.
 *
 * How to read a recipe (all lengths in tile pixels, 32 to a block):
 *
 *   depth     how dark the darkest marks go, 0..1 off the block's colour
 *   mottle    broad, soft unevenness, 0..1 — the thing that stops a face reading as paint
 *   hue       broad patches swinging warmer and cooler, 0..1
 *   marks     scattered flecks, coloured from `flecks` (multipliers of the block colour)
 *   speck     a fine grain over everything
 *   cracks    short wandering cracks, a lit lip above each
 *   edge      a bevel round the block: dark outer line, lit top-left
 *   blades    grass: short upright blades, some sunlit, some in shade
 *   fringe    a grass side: dirt (`under`, a block id) with the turf hanging over the top
 *   pebbles   gravel: little stones packed edge to edge, N to a row
 *   furrows   tilled soil, a ridge every N pixels
 *   ripples   sand: wind ripples, N to a tile
 *   litter    fallen leaves and twigs, N of them
 *   clumps    moss: soft cushions, lit on top
 *   strata    clay: faint layers
 *   cobbles   rounded stones of mixed sizes bedded in earth, `moss` in the gaps
 *   lines     'brick' (courses of bricks), 'ashlar' (big cut blocks), 'planks' (boards)
 *   mortar    the colour of a brick's mortar, as a multiplier of the brick's
 *   bark      N furrows wandering up a trunk (with `knots`); `birch` for white bark
 *   rings     growth rings round the middle, every N pixels — a log's end
 *   heart     the colour of the wood inside the bark, as a multiplier
 *   top       a recipe of its own for the top and bottom faces
 *   leaves    a canopy: N little leaves overlapping, `blossom` for flowers among them
 *   veins     marble: N meandering veins, coloured `vein`
 *   plate     a metal block: bevelled plate with a brushed face and a sheen
 *   band      gold trim: rails top and bottom, a groove and studs between
 *   beams     timber framing: dark beams N pixels wide round the edge and across
 *   setts     calçada: little stones about N pixels across, `joint` between them
 *   wave      a band of dark setts swinging across the tile, the calçada's wave
 *   facets    obsidian, amethyst: glassy fractured faces with a `sheen` on them
 *   ore       nuggets of `nugget` colour set in stone
 *   crust     lava: dark crust plates with glowing cracks between
 *   frame     glass: a thin frame and streaks of reflection
 *   bump      how much depth it has, lit by the sun as it moves (0 = flat)
 *   lift      what the tile averages to; 1 unless it is a face that should
 *             not follow the block colour (a log's light cut end on dark bark)
 *   gaps, bite, holes   leaves: real holes, corners taken off, light through them
 */

/** Warm and cool flecks for grey stone: river-stone browns, slate blues, a little rust. */
const STONE_FLECKS = [[1.08, 1.0, 0.88], [0.9, 0.96, 1.08], [1.1, 1.04, 0.95], [0.82, 0.82, 0.86]];
const EARTH_FLECKS = [[0.72, 0.64, 0.58], [1.12, 1.04, 0.92], [0.9, 0.86, 0.95], [1.05, 0.92, 0.8]];

export const TEXTURES = {
  grass:     { marks: 20, flecks: [[1.12, 1.08, 0.7], [0.86, 1, 0.98]], depth: 0.3, mottle: 0.12, speck: 0.05,
               fringe: { under: 2, turf: 6 },
               top: { blades: 150, marks: 10, flecks: [[1.18, 1.12, 0.62], [1.2, 1.0, 1.1], [0.84, 1.0, 1.0]], depth: 0.32, mottle: 0.14, speck: 0.05 } },
  moss:      { clumps: 18, marks: 24, flecks: [[1.15, 1.12, 0.7], [0.82, 0.95, 0.9]], depth: 0.34, mottle: 0.14, speck: 0.06 },
  litter:    { litter: 70, marks: 30, flecks: EARTH_FLECKS, depth: 0.38, mottle: 0.14, speck: 0.08 },
  dirt:      { marks: 46, flecks: EARTH_FLECKS, depth: 0.34, mottle: 0.16, hue: 0.3, speck: 0.07 },
  farmland:  { furrows: 8, marks: 30, flecks: EARTH_FLECKS, depth: 0.42, mottle: 0.1, speck: 0.08 },
  sand:      { ripples: 3, hue: 0.2, marks: 60, flecks: [[0.72, 0.66, 0.6], [1.08, 0.92, 0.88], [1.12, 1.12, 1.1], [0.95, 0.9, 1.0]], depth: 0.22, mottle: 0.06, speck: 0.05 },
  gravel:    { pebbles: 6, marks: 10, flecks: [[1.06, 1.0, 0.9], [0.9, 0.95, 1.06], [1.14, 1.06, 0.94], [0.72, 0.72, 0.75], [1.12, 1.1, 1.08]], depth: 0.42, speck: 0.05 },
  clay:      { strata: 4, marks: 16, flecks: [[1.06, 1.0, 0.94], [0.9, 0.94, 1.0]], depth: 0.16, mottle: 0.08, speck: 0.03 },
  stone:     { mottle: 0.16, hue: 0.5, marks: 40, flecks: STONE_FLECKS, cracks: 2, depth: 0.3, speck: 0.05, bump: 0.25 },
  // The first cobblestone, exactly (render/legacyCobble.js): asked for twice.
  // Painted at the full 32px with the same stones: four times as many to a
  // face ("more cobble per square").
  cobble:    { legacy: 'cobble', size: 32, bump: 1 },
  brick:     { lines: 'brick', mortar: [1.5, 1.62, 1.7], depth: 0.3, speck: 0.05, marks: 18, bump: 0.7 },
  marble:    { veins: 3, vein: [0.78, 0.76, 0.74], mottle: 0.05, edge: 0.07, depth: 0.2, speck: 0.015 },
  // Phase 7a. Gold trim: a framed band with a groove through it. Timber:
  // plaster between dark beams (`beams` wide), the beams tinted brown.
  // Backlog batch 2: gold "looks like wood" — so gold shines (`shine`, the
  // whole face; `glints`, bright flecks; see BlockTextures.finish).
  trim:      { band: 4, depth: 0.4, speck: 0.03, bump: 0.6, shine: 0.8 },
  timber:    { beams: 4, beamTint: [0.42, 0.3, 0.2], marks: 14, flecks: [[0.94, 0.92, 0.88]], depth: 0.12, mottle: 0.05, cracks: 1, bump: 0.5 },
  // Playtest, P9: calçada portuguesa — setts of limestone in mortar, and
  // the wave of dark basalt through it.
  calcada:      { setts: 5, joint: [0.62, 0.6, 0.57], depth: 0.3, speck: 0.03, bump: 0.6 },
  calcada_wave: { setts: 5, joint: [0.62, 0.6, 0.57], wave: true, depth: 0.3, speck: 0.03, bump: 0.6 },
  snow:      { mottle: 0.05, marks: 18, flecks: [[0.9, 0.94, 1.0], [1.04, 1.04, 1.04]], depth: 0.06, speck: 0.02 },
  planks:    { lines: 'planks', marks: 6, flecks: [[0.8, 0.7, 0.62]], depth: 0.42, speck: 0.03, bump: 0.45 },
  // Requested directly: "the wood trunk has similar texture as the planks,
  // we should change it to wooden logs texture." Bark up the sides —
  // wandering furrows, a crack or two, a knot — and growth rings on the cut
  // ends (`top`, painted as a layer of its own), pale wood inside dark bark.
  log:       { bark: 7, knots: 1, marks: 14, flecks: [[0.86, 0.94, 0.8], [1.1, 1.0, 0.9]], depth: 0.45, speck: 0.05, bump: 0.6,
               top: { rings: 3, heart: [1.6, 1.52, 1.4], depth: 0.25, speck: 0.04, lift: 0 } },
  // Requested directly: "Leaves block could have small holes in it like
  // trees have and be somehow more rounded instead of sharp cubes." `gaps`
  // are real holes you see through, and `bite` takes the corners off each
  // face so a canopy's edge reads soft instead of as a row of squares.
  leaf:      { leaves: 120, flecks: [[1.14, 1.12, 0.74], [1, 1, 1], [0.86, 1.0, 1.02]], depth: 0.42, speck: 0.04, holes: 6, gaps: 14, bite: 6 },
  water:     { ripples: 2, mottle: 0.08, depth: 0.08, speck: 0.02 },
  pane:      { frame: 2, depth: 0.22, speck: 0.01 },
  crystal:   { facets: 3, sheen: [1.3, 1.15, 1.4], depth: 0.3, speck: 0.02 },
  obsidian:  { facets: 3, sheen: [1.7, 1.25, 1.88], marks: 10, flecks: [[1.5, 1.2, 1.8]], depth: 0.4, speck: 0.03, bump: 0.3 },
  gold:      { plate: 3, depth: 0.42, speck: 0.03, bump: 0.5, shine: 0.7, glints: 4 },
  sprout:    { marks: 30, flecks: [[1.1, 1.08, 0.8]], depth: 0.3, mottle: 0.1 },
  seeds:     { marks: 30, depth: 0.28, mottle: 0.1 },
};

/**
 * Blocks that share a glyph (the mark drawn in the bag) but not a look. Dark
 * Stone is "stone" to the bag but is cut into blocks for a castle; Dark Brick
 * has darker mortar than red brick; the ores are stone with metal in it.
 * Keyed by block name; each is a whole recipe, not a patch on the glyph's.
 */
export const BLOCK_TEXTURES = {
  // The Stone Kingdom. Four dark materials that used to read as one grey:
  // big cut blocks with cool flecks; small warm bricks in darker mortar;
  // glassy purple-black with a sheen; and black basalt setts.
  'Dark Stone':    { lines: 'ashlar', mottle: 0.14, hue: 0.25, marks: 46, flecks: [[0.86, 0.94, 1.12], [1.12, 1.12, 1.16], [0.8, 0.84, 0.92]], depth: 0.42, speck: 0.05, bump: 0.6 },
  'Dark Brick':    { lines: 'brick', mortar: [0.5, 0.46, 0.46], depth: 0.32, speck: 0.05, marks: 22, bump: 0.8 },
  'Dark Calçada':  { setts: 5, joint: [1.85, 1.8, 1.72], depth: 0.3, speck: 0.03, bump: 0.6 },
  'Sky Marble':    { veins: 2, vein: [0.84, 0.9, 1.06], marks: 10, flecks: [[1.24, 1.08, 0.66]], mottle: 0.04, edge: 0.06, depth: 0.14, speck: 0.012 },
  // Birch: white bark with dark dashes. Dark oak: deeper furrows.
  'White Wood':    { bark: 4, birch: true, marks: 10, flecks: [[0.6, 0.6, 0.62]], depth: 0.5, speck: 0.03, bump: 0.3,
                     top: { rings: 3, heart: [1.04, 0.98, 0.86], depth: 0.2, speck: 0.03, lift: 0 } },
  'Dark Wood':     { bark: 9, knots: 2, marks: 10, flecks: [[0.86, 0.95, 0.82]], depth: 0.55, speck: 0.05, bump: 0.8,
                     top: { rings: 2.5, heart: [1.85, 1.7, 1.55], depth: 0.25, speck: 0.04, lift: 0 } },
  'White Leaves':  { leaves: 120, blossom: 14, flecks: [[1.1, 1.08, 0.8], [1, 1, 1], [0.94, 1.0, 0.96]], depth: 0.36, speck: 0.03, holes: 6, gaps: 14, bite: 6 },
  'Dark Leaves':   { leaves: 140, flecks: [[1.08, 1.1, 0.86], [1, 1, 1], [0.84, 0.98, 1.06]], depth: 0.46, speck: 0.04, holes: 4, gaps: 12, bite: 6 },
  'Gold Ore':      { mottle: 0.14, marks: 24, flecks: STONE_FLECKS, ore: 6, nugget: [1.55, 1.3, 0.55], depth: 0.32, speck: 0.04, bump: 0.4, shine: 0.1, glints: 10 },
  'Iron Ore':      { mottle: 0.14, marks: 24, flecks: STONE_FLECKS, ore: 6, nugget: [1.3, 1.02, 0.86], depth: 0.32, speck: 0.04, bump: 0.4 },
  'Copper Ore':    { mottle: 0.14, marks: 24, flecks: STONE_FLECKS, ore: 6, nugget: [1.4, 0.98, 0.62], depth: 0.32, speck: 0.04, bump: 0.4 },
  'Sunstone Ore':  { mottle: 0.14, marks: 30, flecks: STONE_FLECKS, cracks: 2, depth: 0.32, speck: 0.04 },
  'Nightstone Ore': { mottle: 0.14, marks: 30, flecks: [[0.9, 0.86, 1.12], [1.1, 1.06, 1.14]], cracks: 2, depth: 0.32, speck: 0.04 },
  'Lava':          { crust: 5, glow: [1.08, 1.75, 1.85], depth: 0.5, speck: 0.03 },
  'Flowing Lava':  { crust: 5, glow: [1.08, 1.75, 1.85], depth: 0.5, speck: 0.03 },
  'Dark Moss':     { clumps: 18, marks: 24, flecks: [[1.12, 1.1, 0.8], [0.8, 0.92, 0.9]], depth: 0.36, mottle: 0.14, speck: 0.06 },
};

/**
 * The recipe for a material, or null when it should stay perfectly flat. Keyed
 * by the block's glyph, or its own `texture` when its icon and its surface
 * differ (Gold Ore: the gold icon, but rock with flecks in it).
 */
export function textureFor(glyph) {
  return TEXTURES[glyph] ?? null;
}

/** The recipe a particular block is painted with: its own if it has one, else its glyph's. */
export function blockTexture(spec) {
  if (!spec) return null;
  return BLOCK_TEXTURES[spec.name] ?? textureFor(spec.glyph);
}

/**
 * How far past the block's colour a tile can reach, as a multiple.
 *
 * Tiles are bytes, so a tile that could only darken would top out at the
 * block's colour — and then light mortar on red brick, pale wood inside dark
 * bark or a glowing crack in lava could not be painted at all. So a byte of
 * 255 means four times the colour, 64 means the colour itself, and the block
 * shader multiplies by this to undo it.
 */
export const TILE_SCALE = 4;
