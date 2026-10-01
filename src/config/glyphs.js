/**
 * A mark for each material, so a colour is not the only thing telling them
 * apart.
 *
 * Grass, Leaves and Sapling are three greens; Dirt, Wood, Planks and Farmland
 * are four browns; Stone and Cobblestone are two greys. In a 26px swatch they
 * were guesses, and on a phone in daylight they were not even that. So each one
 * carries a small drawing of what it is.
 *
 * Drawn on a 24×24 grid at one weight, like the interface icons, but these are
 * marks *on* a colour rather than buttons: they sit over the swatch in whatever
 * ink reads against it, which `inkOn` picks. Keep them to a few strokes — at
 * 26px anything finer turns to mud.
 */

export const GLYPHS = {
  // ground
  // A tuft standing on ground. Without the baseline the three blades read as
  // a lowercase "ıl" at 26px.
  grass: 'M4 19.5h16M12 19.5V9.5M8 19.5c0-2.8.5-4.6 1.6-6M16 19.5c0-2.8-.5-4.6-1.6-6',
  dirt: 'M8 10h.01M14.5 8.5h.01M6 15h.01M12.5 14h.01M17.5 14.5h.01M10 19h.01',
  sand: 'M6.5 10h.01M12 8h.01M17.5 11h.01M9 14.5h.01M15.5 15h.01M12 19h.01',
  farmland: 'M4 9c4 2.5 12 2.5 16 0M4 14c4 2.5 12 2.5 16 0M4 19c4 2.5 12 2.5 16 0',
  // Low tufts, for a forest floor.
  moss: 'M4 19h16M7 19c0-2.4 1-4 2.4-4.4M12 19c0-3.4 1.2-5.6 3-6.2M17 19c0-2 .8-3.4 2-3.8',
  // Loose stones, smaller and more of them than cobble.
  gravel: 'M7 10.5a1.5 1.5 0 1 0 .01 0M13 8.6a1.3 1.3 0 1 0 .01 0M17.3 12.4a1.5 1.5 0 1 0 .01 0M9.6 15.2a1.4 1.4 0 1 0 .01 0M15 17a1.3 1.3 0 1 0 .01 0',
  // A soft bank, the way wet ground slumps.
  clay: 'M4.5 18.5c1.5-6 4-9 7.5-9s6 3 7.5 9ZM8 18.5c.8-3.5 2.2-5.2 4-5.2s3.2 1.7 4 5.2',

  // stone
  stone: 'M4 17l4.5-8 4 3.5 3.5-5.5L20 17Z',
  cobble: 'M8.5 9.5a2.6 2.6 0 1 0 .01 0M16 10.5a2.2 2.2 0 1 0 .01 0M11.5 16.5a2.6 2.6 0 1 0 .01 0',
  // Two courses in a running bond. Three lines and one stagger read as an
  // equals sign; it is the offset between courses that says brick.
  brick: 'M4 9h16M4 12.5h16M4 16h16M11 9v3.5M7.5 12.5V16M15.5 12.5V16',
  obsidian: 'M12 4l6 8-6 8-6-8Z',
  marble: 'M5 5h14v14H5zM7.5 14.5c3-4.5 5 1 10-4.5',

  // wood
  log: 'M12 5a7 7 0 1 0 .01 0M12 9.5a2.5 2.5 0 1 0 .01 0',
  planks: 'M4 8h16M4 12h16M4 16h16M11 8v4M15.5 12v4',
  leaf: 'M19 5c0 8-5.5 13.5-13.5 13.5C5.5 10.5 11 5 19 5ZM7.5 17 16.5 8',
  sprout: 'M12 20v-6.5M12 13.5c-4 0-5.5-2.5-5.5-5 3.5 0 5.5 2 5.5 5ZM12 13.5c4 0 5.5-2.5 5.5-5-3.5 0-5.5 2-5.5 5Z',

  // liquid and light
  water: 'M4 10.5c3-2.5 5 2 8 0s5-2.5 8 0M4 16c3-2.5 5 2 8 0s5-2.5 8 0',
  pane: 'M5 5h14v14H5zM8.5 16 16 8.5',
  snow: 'M12 4v16M5 8l14 8M19 8 5 16',
  gold: 'M6.5 16h11l-2-7h-7l-2 7Z',
  crystal: 'M12 4l5 5.5-5 10.5-5-10.5ZM7 9.5h10',

  // things you carry
  seeds: 'M10 7c3 1 3.5 4.5 1.5 7C8.5 13 8 9.5 10 7ZM14.5 12c3 1 3.5 4.5 1.5 7-3-1-3.5-4.5-1.5-7Z',
  fruit: 'M12 8.5c4-3 8 1 6 6-1.2 3-4 5-6 5s-4.8-2-6-5c-2-5 2-9 6-6ZM12 8.5V4M12 4c2 0 3-1 4-2',
  vegetable: 'M11 20 7.5 9.5c3-2 6.5-2 9.5 0L11 20M14.5 6.5 17.5 4M14.5 6.5 13.5 3.5',
  // Handle and a wedge of a head. The curved blade read as a tick.
  axe: 'M6 19.5 13.5 12M13.2 11.6 12.3 7.2l5.9-2.4 1.6 5.7Z',
  // A handle up into an arched head with a point on each side — the arch is
  // what says pickaxe rather than axe.
  pickaxe: 'M12 20 12.5 12.5M8 8c1.5-3 6-3 7.5 0M8 8 5 11.5M15.5 8 18.5 11.5',
  // Straight shaft into a blade that tapers to a rounded point.
  shovel: 'M12 4v10M8.5 14h7L15 18.5a3 3 0 0 1-6 0Z',
  // Tapered, with a handle over the rim. Straight sides made it a waste bin.
  // A pry bar (the Clear tool) and a chalk line (the Symmetry tool) had no
  // mark of their own and showed as blank squares in the bag.
  clear: 'M6 20 17 6.5M17 6.5c1-1.2 2.6-1.2 3 0M6 20l-2-1.2',
  symmetry: 'M12 3.5v17M6.5 8 3.5 12l3 4M17.5 8l3 4-3 4M8 12h8',
  bucket: 'M5 8.5h14l-2.4 11h-9.2L5 8.5ZM8 8.5a4 4.5 0 0 1 8 0',
  bucketFull: 'M5 8.5h14l-2.4 11h-9.2L5 8.5ZM8 13.5c2-1.6 4.8 1.6 6.8 0',

  // Phase 4: shapes and light.
  // A body with a ring handle and a flame inside — the ring is what keeps it
  // from reading as a plain box.
  lantern: 'M9.5 8.5h5v9h-5zM10.5 5c0-1.3.7-2 1.5-2s1.5.7 1.5 2M12 11.5c-1 1-1 2 0 3 1-1 1-2 0-3Z',
  // A low bar, most of the swatch left empty above it — a slab only fills
  // the bottom half of the block it comes from.
  slab: 'M4 14.5h16v5H4Z',
  // Two risers, ascending — the silhouette a stair actually casts, at one
  // fixed orientation the same way nothing else in this registry rotates.
  stair: 'M4 19.5h5v-5h5v-5h6v10Z',
  // A tabletop over two legs — enough to read as furniture rather than a
  // plain block at swatch size.
  table: 'M4 8.5h16M6.5 8.5v10M17.5 8.5v10',
  // A seat with a back, over two front legs.
  chair: 'M6 12.5h10v3H6zM7 20v-4.5M17 20v-4.5M9 12.5V6h6v6.5',
  // A bordered rectangle, laid flat.
  rug: 'M4 7.5h16v9H4ZM7 10.5h10v3H7Z',

  // ranching
  fence: 'M6.5 5v15M17.5 5v15M4 9.5h16M4 14.5h16',
  gate: 'M5 5v15M19 5v15M5 9h14M5 15h14M5 15l14-6',
  chandelier: 'M12 3v5M5 12h14M5 12v-2.5M19 12v-2.5M12 12V9.5M8.5 12l-.5 4h8l-.5-4M12 16v3',
  rooftile: 'M3 17 12 7l9 10M6 13.6l9 3.4M9 10.2l9 3.4M3 17h18',
  door: 'M7 3.5h10v17H7ZM9.5 6h5v5h-5ZM14.5 13.5h.01',
  chest: 'M4 9.5h16v10H4ZM4.5 9.5c0-2.5 2-4 4-4h7c2 0 4 1.5 4 4M4 12.5h16M11 11h2v3h-2Z',
  egg: 'M12 4c3.6 0 6 5.2 6 9a6 6 0 0 1-12 0c0-3.8 2.4-9 6-9Z',
  milk: 'M9 4h6M9.5 4v3L7 10.5V20h10v-9.5L14.5 7V4M7 13.5h10',

  // from animals
  meat: 'M9 14.5c-3-3-2-8.5 2.5-9.5s8 3 6.5 7.5-6 5-9 2ZM9 14.5 5.5 18M4.5 16.5l2.5 2.5',
  hide: 'M7 5h10l-1.5 3.5L18 12l-2.5 3.5L17 19H7l1.5-3.5L6 12l2.5-3.5Z',
  wool: 'M7.5 15a3 3 0 0 1 0-6 3.5 3.5 0 0 1 6.5-1.5A3 3 0 0 1 17 13a2.5 2.5 0 0 1-1 4.5H8.5A2.5 2.5 0 0 1 7.5 15Z',
  feather: 'M18.5 4.5C11 5 6.5 10.5 6 19.5M18.5 4.5c.5 7-4.5 11.5-11.5 12.5M10 13l3.5-.5M8.5 16.5l3-.3',
};

/**
 * Ink that reads against a given block colour.
 *
 * Sand, Snow and Marble are near-white and Obsidian is near-black; one ink
 * cannot serve both. Relative luminance decides, weighted for how the eye
 * actually sees the channels rather than by a flat average, which puts the
 * boundary in the wrong place for saturated greens.
 */
export function inkOn(color) {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? 'rgba(12,16,20,0.62)' : 'rgba(255,255,255,0.82)';
}

/** The mark for a material, as SVG, ready to lay over its swatch. */
export function glyphSvg(name, { size = 22, color = 0x808080, ink = null } = {}) {
  const d = GLYPHS[name];
  if (!d) return '';
  return `<svg class="glyph" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"`
    + ` stroke="${ink ?? inkOn(color)}" stroke-width="1.9" stroke-linecap="round"`
    + ` stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

export function hasGlyph(name) {
  return !!GLYPHS[name];
}
