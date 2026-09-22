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
  bucket: 'M5 8.5h14l-2.4 11h-9.2L5 8.5ZM8 8.5a4 4.5 0 0 1 8 0',
  bucketFull: 'M5 8.5h14l-2.4 11h-9.2L5 8.5ZM8 13.5c2-1.6 4.8 1.6 6.8 0',
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
