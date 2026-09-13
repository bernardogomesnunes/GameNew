// Block type registry. Adding a new block = adding an entry here.
// id 0 is reserved for air (empty space) and must never be used below.
//
// `cost` is what one block costs in Campaign mode, and is refunded in full when
// broken. The resource it costs also decides which tier gates it: a stone-cost
// block can't be placed until the stone tier is unlocked.
// `unlock` gates the block in Creative mode only.
// `system` blocks are world furniture — never sold, never breakable, hidden
// from the hotbar.
export const BLOCKS = [
  { id: 1, name: 'Grass', color: 0x5b9c3f, cost: { wood: 1 }, unlock: null },
  { id: 2, name: 'Dirt', color: 0x7a5230, cost: { wood: 1 }, unlock: null },
  { id: 3, name: 'Stone', color: 0x8a8a8d, cost: { stone: 1 }, unlock: null },
  { id: 4, name: 'Wood', color: 0x8a5a2b, cost: { wood: 2 }, unlock: null },
  { id: 5, name: 'Leaves', color: 0x3f7d34, transparent: true, opacity: 0.9, cost: { wood: 1 }, unlock: null },
  { id: 6, name: 'Sand', color: 0xdcc57a, cost: { wood: 1 }, unlock: null },
  { id: 7, name: 'Planks', color: 0xb98a4b, cost: { wood: 1 }, unlock: null },
  { id: 8, name: 'Cobblestone', color: 0x6b6b6e, cost: { stone: 1 }, unlock: null },
  { id: 9, name: 'Brick', color: 0xa8422f, cost: { brick: 1 }, unlock: null },
  { id: 10, name: 'Glass', color: 0xbfe3f0, transparent: true, opacity: 0.35, cost: { glass: 1 }, unlock: null },
  { id: 11, name: 'Water', color: 0x2f6fbf, transparent: true, opacity: 0.6, cost: { wood: 3 }, unlock: null },
  { id: 12, name: 'Snow', color: 0xf2f6fa, cost: { wood: 1 }, unlock: { type: 'level', value: 3 } },
  { id: 13, name: 'Gold Block', color: 0xf4c542, cost: { gold: 1 }, unlock: { type: 'level', value: 6 } },
  { id: 14, name: 'Obsidian', color: 0x1c1424, cost: { stone: 4 }, unlock: { type: 'achievement', value: 'underground' } },
  { id: 15, name: 'Red Glass', color: 0xe0554f, transparent: true, opacity: 0.45, cost: { glass: 2 }, unlock: { type: 'level', value: 4 } },
  { id: 16, name: 'Blue Glass', color: 0x4f7fe0, transparent: true, opacity: 0.45, cost: { glass: 2 }, unlock: { type: 'level', value: 4 } },
  { id: 17, name: 'Marble', color: 0xe9e6de, cost: { stone: 3 }, unlock: { type: 'achievement', value: 'architect' } },
  { id: 18, name: 'Amethyst', color: 0x9a5fd9, transparent: true, opacity: 0.55, cost: { gold: 2 }, unlock: { type: 'level', value: 8 } },
  { id: 19, name: 'Ground', color: 0x4a7c3f, system: true },
  // Duilt blocks. Saplings grow into forests; farmland is soil that has been
  // turned, which is what a farm is actually made of.
  { id: 20, name: 'Sapling', color: 0x6aa84f, transparent: true, opacity: 0.95, cost: { wood: 1 }, unlock: null },
  { id: 21, name: 'Farmland', color: 0x6b4a2a, cost: { wood: 1 }, unlock: null },
];

export const BLOCKS_BY_ID = new Map(BLOCKS.map((b) => [b.id, b]));
export const AIR = 0;
export const GROUND = 19;

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
