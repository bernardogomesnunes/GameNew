// Block type registry. Adding a new block = adding an entry here.
// id 0 is reserved for air (empty space) and must never be used below.
//
// `cost` is left over from Campaign mode, which is gone. Nothing reads it any
// more; it stays only because the economy it fed is still written into saves.
// `unlock` gates the block in Creative: a level or an achievement.
// `soil` is ground a tree will take root in. It used to be a hard-coded pair
// of ids in features.js, so the moment the world grew a third kind of soil the
// groves stopped planting on it — hence the flag, which a new block sets for
// itself.
// `system` blocks are world furniture — never sold, never breakable, hidden
// from the hotbar.
// `glyph` names the mark drawn over the colour wherever the block is shown —
// four browns and three greens are not told apart by colour at 26 pixels. The
// marks themselves live in config/glyphs.js.
export const BLOCKS = [
  { id: 1, name: 'Grass', glyph: 'grass', color: 0x5b9c3f, soil: true, cost: { wood: 1 }, unlock: null },
  { id: 2, name: 'Dirt', glyph: 'dirt', color: 0x7a5230, soil: true, cost: { wood: 1 }, unlock: null },
  { id: 3, name: 'Stone', glyph: 'stone', color: 0x8a8a8d, cost: { stone: 1 }, unlock: null },
  { id: 4, name: 'Wood', glyph: 'log', color: 0x8a5a2b, cost: { wood: 2 }, unlock: null },
  // Opaque on purpose. At 0.9 the transparency was invisible, but it put every
  // tree in the game into the depth-write-disabled transparent pass, which the
  // renderer re-sorts on every camera move — the shimmer you saw walking
  // through a forest. Opaque leaves also merge into the single opaque draw call.
  { id: 5, name: 'Leaves', glyph: 'leaf', color: 0x3f7d34, cost: { wood: 1 }, unlock: null },
  { id: 6, name: 'Sand', glyph: 'sand', color: 0xdcc57a, cost: { wood: 1 }, unlock: null },
  { id: 7, name: 'Planks', glyph: 'planks', color: 0xb98a4b, cost: { wood: 1 }, unlock: null },
  { id: 8, name: 'Cobblestone', glyph: 'cobble', color: 0x6b6b6e, cost: { stone: 1 }, unlock: null },
  { id: 9, name: 'Brick', glyph: 'brick', color: 0xa8422f, cost: { brick: 1 }, unlock: null },
  { id: 10, name: 'Glass', glyph: 'pane', color: 0xbfe3f0, transparent: true, opacity: 0.35, cost: { glass: 1 }, unlock: null },
  // Thin enough to read as water over a sandy bed, but not so thin that the
  // sand shows through and turns the rivers grey, which is what 0.6 did.
  { id: 11, name: 'Water', glyph: 'water', color: 0x2f7fd0, transparent: true, opacity: 0.78, cost: { wood: 3 }, unlock: null },
  { id: 12, name: 'Snow', glyph: 'snow', color: 0xf2f6fa, cost: { wood: 1 }, unlock: { type: 'level', value: 3 } },
  { id: 13, name: 'Gold Block', glyph: 'gold', color: 0xf4c542, cost: { gold: 1 }, unlock: { type: 'level', value: 6 } },
  { id: 14, name: 'Obsidian', glyph: 'obsidian', color: 0x1c1424, cost: { stone: 4 }, unlock: { type: 'achievement', value: 'underground' } },
  { id: 15, name: 'Red Glass', glyph: 'pane', color: 0xe0554f, transparent: true, opacity: 0.45, cost: { glass: 2 }, unlock: { type: 'level', value: 4 } },
  { id: 16, name: 'Blue Glass', glyph: 'pane', color: 0x4f7fe0, transparent: true, opacity: 0.45, cost: { glass: 2 }, unlock: { type: 'level', value: 4 } },
  { id: 17, name: 'Marble', glyph: 'marble', color: 0xe9e6de, cost: { stone: 3 }, unlock: { type: 'achievement', value: 'architect' } },
  { id: 18, name: 'Amethyst', glyph: 'crystal', color: 0x9a5fd9, transparent: true, opacity: 0.55, cost: { gold: 2 }, unlock: { type: 'level', value: 8 } },
  { id: 19, name: 'Ground', color: 0x4a7c3f, system: true },
  // Duilt blocks. Saplings grow into forests; farmland is soil that has been
  // turned, which is what a farm is actually made of.
  { id: 20, name: 'Sapling', glyph: 'sprout', color: 0x6aa84f, cost: { wood: 1 }, unlock: null },
  { id: 21, name: 'Farmland', glyph: 'farmland', color: 0x6b4a2a, cost: { wood: 1 }, unlock: null },
  // Ground the biomes are made of. Six kinds of country used to share four
  // top blocks between them, so a meadow, a forest, the highlands and a
  // wetland were all the same green: you could walk from one to another and
  // the only thing that changed was how many trees there were. These are what
  // let each one have its own floor.
  { id: 22, name: 'Moss', glyph: 'moss', color: 0x3c6b31, soil: true, unlock: null },
  { id: 23, name: 'Gravel', glyph: 'gravel', color: 0x9a948a, unlock: null },
  { id: 24, name: 'Clay', glyph: 'clay', color: 0x8d9aa0, soil: true, unlock: null },
];

export const BLOCKS_BY_ID = new Map(BLOCKS.map((b) => [b.id, b]));

/** Ground a tree will take root in. */
export const SOIL_IDS = BLOCKS.filter((b) => b.soil).map((b) => b.id);
export const SOIL_NAMES = BLOCKS.filter((b) => b.soil).map((b) => b.name.toLowerCase());
export function isSoil(id) {
  return !!BLOCKS_BY_ID.get(id)?.soil;
}
export const AIR = 0;
export const GROUND = 19;
export const WATER = 11;

/** Blocks a player can hold and place — everything except world furniture. */
export const PLACEABLE_BLOCKS = BLOCKS.filter((b) => !b.system);

export function isTransparent(id) {
  const b = BLOCKS_BY_ID.get(id);
  return !!(b && b.transparent);
}

export function isSystemBlock(id) {
  return !!BLOCKS_BY_ID.get(id)?.system;
}

export function blockName(id) {
  const b = BLOCKS_BY_ID.get(id);
  return b ? b.name : 'Air';
}

/** The resource a block is bought and refunded in, or null for system blocks. */
export function costResourceOf(id) {
  const cost = BLOCKS_BY_ID.get(id)?.cost;
  return cost ? Object.keys(cost)[0] : null;
}
