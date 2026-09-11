// Block type registry. Adding a new block = adding an entry here.
// id 0 is reserved for air (empty space) and must never be used below.
export const BLOCKS = [
  { id: 1, name: 'Grass', color: 0x5b9c3f, unlock: null },
  { id: 2, name: 'Dirt', color: 0x7a5230, unlock: null },
  { id: 3, name: 'Stone', color: 0x8a8a8d, unlock: null },
  { id: 4, name: 'Wood', color: 0x8a5a2b, unlock: null },
  { id: 5, name: 'Leaves', color: 0x3f7d34, transparent: true, opacity: 0.9, unlock: null },
  { id: 6, name: 'Sand', color: 0xdcc57a, unlock: null },
  { id: 7, name: 'Planks', color: 0xb98a4b, unlock: null },
  { id: 8, name: 'Cobblestone', color: 0x6b6b6e, unlock: null },
  { id: 9, name: 'Brick', color: 0xa8422f, unlock: null },
  { id: 10, name: 'Glass', color: 0xbfe3f0, transparent: true, opacity: 0.35, unlock: null },
  { id: 11, name: 'Water', color: 0x2f6fbf, transparent: true, opacity: 0.6, unlock: null },
  { id: 12, name: 'Snow', color: 0xf2f6fa, unlock: { type: 'level', value: 3 } },
  { id: 13, name: 'Gold Block', color: 0xf4c542, unlock: { type: 'level', value: 6 } },
  { id: 14, name: 'Obsidian', color: 0x1c1424, unlock: { type: 'achievement', value: 'underground' } },
  { id: 15, name: 'Red Glass', color: 0xe0554f, transparent: true, opacity: 0.45, unlock: { type: 'level', value: 4 } },
  { id: 16, name: 'Blue Glass', color: 0x4f7fe0, transparent: true, opacity: 0.45, unlock: { type: 'level', value: 4 } },
  { id: 17, name: 'Marble', color: 0xe9e6de, unlock: { type: 'achievement', value: 'architect' } },
  { id: 18, name: 'Amethyst', color: 0x9a5fd9, transparent: true, opacity: 0.55, unlock: { type: 'level', value: 8 } },
];

export const BLOCKS_BY_ID = new Map(BLOCKS.map((b) => [b.id, b]));
export const AIR = 0;

export function isTransparent(id) {
  const b = BLOCKS_BY_ID.get(id);
  return !!(b && b.transparent);
}

export function blockName(id) {
  const b = BLOCKS_BY_ID.get(id);
  return b ? b.name : 'Air';
}
