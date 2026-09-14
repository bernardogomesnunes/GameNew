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
 *   band      a darker strip along one edge, for a block with a lip
 *   depth     how dark the darkest mark goes, 0..1 off white
 *   scale     how many tile-pixels across; 16 unless the pattern needs room
 */

export const TEXTURES = {
  grass:     { marks: 26, depth: 0.16, speck: 0.06, scale: 16 },
  moss:      { marks: 34, depth: 0.20, speck: 0.07, scale: 16 },
  dirt:      { marks: 22, depth: 0.18, scale: 16 },
  farmland:  { lines: 'h', every: 4, marks: 10, depth: 0.16, scale: 16 },
  sand:      { marks: 30, depth: 0.09, scale: 16 },
  gravel:    { marks: 38, depth: 0.22, blobs: 5, scale: 16 },
  clay:      { marks: 12, depth: 0.10, scale: 16 },
  stone:     { marks: 14, depth: 0.15, cracks: 2, scale: 16 },
  cobble:    { blobs: 7, depth: 0.24, scale: 16 },
  brick:     { lines: 'brick', every: 4, depth: 0.22, scale: 16 },
  marble:    { veins: 2, depth: 0.08, scale: 16 },
  snow:      { marks: 8, depth: 0.05, scale: 16 },
  planks:    { lines: 'h', every: 4, marks: 8, depth: 0.15, scale: 16 },
  log:       { lines: 'v', every: 3, marks: 6, depth: 0.17, scale: 16 },
  leaf:      { marks: 44, depth: 0.22, speck: 0.10, holes: 3, scale: 16 },
  water:     { lines: 'h', every: 6, depth: 0.06, scale: 16 },
  pane:      { band: 1, depth: 0.10, scale: 16 },
  crystal:   { veins: 3, depth: 0.12, scale: 16 },
  obsidian:  { marks: 10, depth: 0.20, scale: 16 },
  gold:      { marks: 8, depth: 0.10, scale: 16 },
  sprout:    { marks: 16, depth: 0.18, scale: 16 },
  seeds:     { marks: 18, depth: 0.14, scale: 16 },
};

/** The recipe for a material, or null when it should stay perfectly flat. */
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
