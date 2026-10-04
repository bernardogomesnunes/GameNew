/**
 * What each material looks like close up, as a recipe rather than a picture.
 *
 * No texture pack. Minecraft's are copyrighted, and a downloaded set would
 * arrive with its own palette and fight the one this game already has — every
 * block colour here is derived from the block registry, so a tile painted
 * somewhere else would be the one thing on screen that could not follow it.
 *
 * So: a recipe per material, painted at load into a small greyscale tile that
 * *multiplies* the block's colour. The colour still comes from the registry and
 * the per-block hue variation still applies on top; this only says where the
 * surface is a shade darker. Keeping it to shading is what lets it stay a flat
 * palette with detail in it rather than becoming a textured one.
 *
 * How to read a recipe:
 *
 *   marks     scattered pixels — dots of dirt, chips of stone, blades of grass
 *   lines     'h', 'v' or 'grid', for planks, trunks and masonry
 *   furrows   rows of tilled soil, every N pixels
 *   bump      how much depth it has, lit by the sun as it moves (0 = flat)
 *   cobbles   rounded stones of mixed sizes bedded in dirt (N sets how many big ones it tries)
 *   bark      N furrows wandering up a trunk (with `knots`)
 *   rings     growth rings round the middle, every N pixels — a log's end
 *   top       a recipe of its own for the top and bottom faces
 *   band      a darker strip along one edge, for a block with a lip
 *   beams     timber framing: brown beams N pixels wide round the edge and across
 *   setts     calçada: little square stones N pixels across, joints between, each a shade its own
 *   wave      a band of dark setts swinging across the tile, the calçada's wave
 *   shine     metal: how much the face shines, 0..1, its dark marks less
 *   glints    N bright flecks that shine at full strength — gold in ore
 *   depth     how dark the darkest mark goes, 0..1 off white
 *   scale     how many tile-pixels across; 16 unless the pattern needs room
 */

export const TEXTURES = {
  grass:     { marks: 26, depth: 0.16, speck: 0.06, scale: 16 },
  moss:      { marks: 34, depth: 0.20, speck: 0.07, scale: 16 },
  litter:    { marks: 40, blobs: 4, depth: 0.24, speck: 0.1, scale: 16 },
  dirt:      { marks: 22, depth: 0.18, scale: 16 },
  farmland:  { furrows: 4, marks: 34, blobs: 2, depth: 0.28, speck: 0.08, scale: 16 },
  sand:      { marks: 30, depth: 0.09, scale: 16 },
  gravel:    { marks: 38, depth: 0.22, blobs: 5, scale: 16 },
  clay:      { marks: 12, depth: 0.10, scale: 16 },
  stone:     { marks: 14, depth: 0.15, cracks: 2, scale: 16 },
  cobble:    { cobbles: 6, speck: 0.03, depth: 0.28, bump: 1, scale: 16 },
  brick:     { lines: 'brick', every: 4, depth: 0.22, bump: 0.7, scale: 16 },
  marble:    { veins: 2, depth: 0.08, scale: 16 },
  // Phase 7a. Gold trim: a framed band with a line through it. Timber:
  // plaster between dark beams (`beams` wide), the beams tinted brown.
  // Backlog batch 2: gold "looks like wood" — so gold shines (`shine`, the
  // whole face; `glints`, single bright flecks; see BlockTextures.paint).
  trim:      { band: 2, lines: 'h', every: 8, depth: 0.24, bump: 0.6, shine: 0.8, scale: 16 },
  timber:    { beams: 2, marks: 10, depth: 0.08, bump: 0.5, scale: 16 },
  // Playtest, P9: calçada portuguesa — setts of limestone in mortar, and
  // the wave of dark basalt through it.
  calcada:      { setts: 3, depth: 0.26, bump: 0.6, scale: 16 },
  calcada_wave: { setts: 3, wave: true, depth: 0.26, bump: 0.6, scale: 16 },
  snow:      { marks: 8, depth: 0.05, scale: 16 },
  planks:    { lines: 'h', every: 4, marks: 8, depth: 0.15, scale: 16 },
  // Requested directly: "the wood trunk has similar texture as the planks,
  // we should change it to wooden logs texture." Bark up the sides —
  // wandering furrows, a crack or two, a knot — and growth rings on the cut
  // ends (`top`, painted as a layer of its own).
  log:       { bark: 4, knots: 1, marks: 6, depth: 0.24, scale: 16, top: { rings: 2.2, depth: 0.2 } },
  // Requested directly: "Leaves block could have small holes in it like
  // trees have and be somehow more rounded instead of sharp cubes." `gaps`
  // are real holes you see through, and `bite` takes the corners off each
  // face so a canopy's edge reads soft instead of as a row of squares.
  leaf:      { marks: 44, depth: 0.22, speck: 0.10, holes: 3, gaps: 7, bite: 3, scale: 16 },
  water:     { lines: 'h', every: 6, depth: 0.06, scale: 16 },
  pane:      { band: 1, depth: 0.10, scale: 16 },
  crystal:   { veins: 3, depth: 0.12, scale: 16 },
  obsidian:  { marks: 10, depth: 0.20, scale: 16 },
  gold:      { marks: 8, depth: 0.10, shine: 0.7, glints: 4, scale: 16 },
  gold_ore:  { marks: 14, depth: 0.2, cracks: 2, shine: 0.12, glints: 9, scale: 16 },
  sprout:    { marks: 16, depth: 0.18, scale: 16 },
  seeds:     { marks: 18, depth: 0.14, scale: 16 },
};

/**
 * The recipe for a material, or null when it should stay perfectly flat. Keyed
 * by the block's glyph, or its own `texture` when its icon and its surface
 * differ (Gold Ore: the gold icon, but rock with flecks in it).
 */
export function textureFor(glyph) {
  return TEXTURES[glyph] ?? null;
}

/**
 * The lightest a tile ever gets, as a fraction.
 *
 * Tiles are painted near white and multiply the block's colour, so the surface
 * is only ever darkened. Anything else would need the colours lifted to
 * compensate, and then a block with no recipe would not match one with.
 */
export const TILE_BASE = 0.98;
