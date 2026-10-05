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
  coin: 'M12 5a7 7 0 1 0 .01 0M12 8.5v7M14 9.5h-3a1.3 1.3 0 0 0 0 2.6h2a1.3 1.3 0 0 1 0 2.6h-3',
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
  // Homes (playtest, P1).
  bed: 'M3.5 18.5v-7h17v7M3.5 15.5h17M3.5 11.5V7.5M6 11.5c0-1.6 1.3-2.5 3-2.5h2v2.5M20.5 11.5h-9',
  painting: 'M4.5 5.5h15v13h-15ZM6.5 15.5l4-4.5 3 3 2-2 2.5 3.5M15 9a1.2 1.2 0 1 0 .01 0',
  // Phase 7c: the Temple.
  devotion: 'M12 3.5c2.5 3.2 4.5 5.6 4.5 9a4.5 4.5 0 0 1-9 0c0-3.4 2-5.8 4.5-9ZM12 14a1.6 1.6 0 1 0 .01 0M12 18.5V21',
  rack: 'M5 4v16M19 4v16M4 7h16M4 16h16M9 5v13M12 3v16M15 6v12M8 3.5h2',
  dummy: 'M12 4a2 2 0 1 0 .01 0M12 8v11M6 10h12M9 9h6v6H9ZM8 20h8',
  target: 'M12 6a6 6 0 1 0 .01 0M12 9a3 3 0 1 0 .01 0M12 12h.01M8 18l-2 3M16 18l2 3M12 18v3',
  tent: 'M3 19h18M5 19l7-13 7 13M12 6v13M9.5 19l2.5-5 2.5 5M12 6V3.5l3 1-3 1',
  campfire: 'M5 19l14-4M5 15l14 4M12 14c-2.5-1.5-2-4 0-7 .5 2 2.5 3 2 5.5-.3 1.2-1 1.4-2 1.5Z',
  chain: 'M10 3h4v5h-4ZM10 10h4v5h-4ZM10 17h4v4h-4ZM12 8v2M12 15v2',
  lift: 'M5 20h14M7 20V9M17 20V9M7 11h10v4H7ZM12 3v6M17 13h3',
  horn: 'M4.5 8.5c4 0 9-1.5 13-5l1.5 1.5v13L17.5 19.5c-4-3.5-9-5-13-5ZM4.5 8.5v6M17.5 3.5v16M9 9v5',
  flask: 'M10 3.5h4M10.5 3.5V8L6.5 15.5A3 3 0 0 0 9.2 20h5.6a3 3 0 0 0 2.7-4.5L13.5 8V3.5M8 14h8',
  // Phase 7b: armour.
  helm: 'M6 15.5V12a6 6 0 0 1 12 0v3.5ZM6 15.5h12M9 12.5h6M12 6V4',
  cuirass: 'M8 5h8l3 3-2 2v9H7v-9L5 8ZM9.5 5c0 1.5 1 2.5 2.5 2.5S14.5 6.5 14.5 5M7 12h10',
  greaves: 'M6 5h12v3H6ZM7 8h4v11H7ZM13 8h4v11h-4ZM7 13h4M13 13h4',
  boots: 'M6 5h5v9h4l4 3v2H6ZM6 17h13M8 5v9',
  ring: 'M12 9a5.5 5.5 0 1 0 .01 0M12 9 10 6h4ZM10 6l2-2 2 2',
  // Phase 7a.
  firefly: 'M12 9.5a2 2.6 0 1 0 .01 0M12 15v3.5M9 9.5 5.5 7M15 9.5 18.5 7M9.5 12.5 6 14M14.5 12.5 18 14M5 19h.01M19 4h.01M4 11h.01',
  wall: 'M4 19.5h16M4 19.5V11h4v8.5M16 19.5V11h4v8.5M8 13h8M8 16.5h8',
  pillar: 'M6 5h12M7.5 7h9M6 19.5h12M7.5 17.5h9M9 7v10.5M12 7v10.5M15 7v10.5',
  trapdoor: 'M4 11h16v4H4ZM7 11v4M11 11v4M15 11v4M5.5 9.5h3',
  window: 'M5.5 4h13v16h-13ZM12 4v16M5.5 12h13M4 20h16',
  vase: 'M10 4h4M10.5 4v2.5C7 8 6.5 12 7.5 15.5S10 20 12 20s3.5-1 4.5-4.5-.5-7.5-4-9V4M7.5 12.5h9',
  urn: 'M9.5 4h5M12 4v1.5M6.5 7.5h11M7 7.5c0 6 1.5 9 5 9s5-3 5-9M10 16.5V19h4v-2.5M5 10h2M17 10h2',
  banner: 'M6 3.5v17M5 4h14M7 4.5h10v11l-2.5-2-2.5 2-2.5-2L7 15.5ZM12 8a1.6 1.6 0 1 0 .01 0',
  trim: 'M4 5h16v14H4ZM4 9h16M4 15h16',
  timber: 'M4 4h16v16H4ZM4 4l16 16M12 4v16',
  calcada: 'M4 4h16v16H4ZM4 9h16M4 14h16M9 4v5M15 4v5M7 9v5M12 9v5M17 9v5M9 14v6M15 14v6',
  calcada_wave: 'M4 4h16v16H4ZM4 12c3-4 5-4 8 0s5 4 8 0M4 16c3-4 5-4 8 0s5 4 8 0',
  catapult: 'M3.5 16.5h17M7 19a2 2 0 1 0 .01 0M17 19a2 2 0 1 0 .01 0M12 16.5l5-10M14.5 6.5h5M16.5 4.5a1.6 1.6 0 1 0 .01 0M8.5 16.5v-6h7',
  sword: 'M19 5 10 14M19 5h-3.5M19 5v3.5M7.5 11.5l5 5M10 14l-4.5 4.5',
  // The flying machine: a keel, and two ribbed wings off it.
  glider: 'M12 5v14M12 9C9 6 5 6 2 9l3 1 2 3 2-1 3 1M12 9c3-3 7-3 10 0l-3 1-2 3-2-1-3 1M9 19h6',
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
  // A cabinet of drawers, each with its pull: every storehouse in one place.
  controller: 'M5 3.5h14v17H5ZM5 9.2h14M5 14.8h14M10.5 6.4h3M10.5 12h3M10.5 17.6h3',
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
