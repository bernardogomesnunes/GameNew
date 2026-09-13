/**
 * Item registry for Duilt.
 *
 * Everything a player can hold lives here — raw materials, tools, food. Adding
 * an item is adding an entry, the same way blocks and achievements work.
 *
 * `stackTo` belongs to the item, not the inventory: a uniform stack limit would
 * give you a slot holding five hundred axes. Bulk material stacks deep, finished
 * goods shallow, tools not at all.
 *
 * `block` links an item to the block it places, so "wood" in your bag and
 * "wood" in the world are the same substance. Items without one are things you
 * carry but cannot build with.
 *
 * `durability` marks a tool: it wears with use and can be repaired rather than
 * re-made, because re-crafting the same pickaxe for the ninth time is the
 * definition of tedious.
 */

export const STACK_BULK = 500;
export const STACK_GOODS = 100;
export const STACK_FOOD = 50;
export const STACK_TOOL = 1;

export const ITEMS = [
  // --- raw materials, gathered from the world -----------------------------
  { id: 'dirt', name: 'Dirt', kind: 'raw', stackTo: STACK_BULK, color: 0x7a5230, block: 2, madeBy: 'Foraged from the ground' },
  { id: 'wood', name: 'Wood', kind: 'raw', stackTo: STACK_BULK, color: 0x8a5a2b, block: 4, madeBy: 'Cut from trees' },
  { id: 'leaves', name: 'Leaves', kind: 'raw', stackTo: STACK_BULK, color: 0x3f7d34, block: 5, madeBy: 'Stripped from trees' },
  { id: 'stone', name: 'Stone', kind: 'raw', stackTo: STACK_BULK, color: 0x8a8a8d, block: 3, madeBy: 'Mined from rock' },
  { id: 'sand', name: 'Sand', kind: 'raw', stackTo: STACK_BULK, color: 0xdcc57a, block: 6, madeBy: 'Dug from the riverbank' },
  { id: 'grass', name: 'Turf', kind: 'raw', stackTo: STACK_BULK, color: 0x5b9c3f, block: 1, madeBy: 'Cut from meadow' },

  // --- growing things ------------------------------------------------------
  { id: 'seeds', name: 'Seeds', kind: 'raw', stackTo: STACK_GOODS, color: 0xc8b560, madeBy: 'Shaken from a forest, or saved from a harvest' },
  { id: 'sapling', name: 'Sapling', kind: 'raw', stackTo: STACK_GOODS, color: 0x6aa84f, block: 20, madeBy: 'Grown from seed' },

  // --- food. Fruit spoils, preserves do not -------------------------------
  { id: 'fruit', name: 'Fruit', kind: 'food', stackTo: STACK_FOOD, color: 0xd9534f, feeds: 12, madeBy: 'Picked from a forest' },
  { id: 'vegetables', name: 'Vegetables', kind: 'food', stackTo: STACK_FOOD, color: 0xe08c3c, feeds: 22, madeBy: 'Harvested from a farm' },

  // --- tools. One per slot, and they wear ---------------------------------
  {
    id: 'axe', name: 'Axe', kind: 'tool', stackTo: STACK_TOOL, color: 0xa07850,
    durability: 120, madeBy: 'Crafted from wood', unlocks: 'Cutting trees quickly',
  },
  {
    id: 'bucket', name: 'Bucket', kind: 'tool', stackTo: STACK_TOOL, color: 0x9aa7ad,
    durability: null, madeBy: 'Crafted from wood', unlocks: 'Carrying water',
    holds: 'water',
  },
  {
    id: 'bucket_water', name: 'Bucket of Water', kind: 'tool', stackTo: STACK_TOOL, color: 0x2f6fbf,
    durability: null, madeBy: 'Filled at a river', unlocks: 'Pouring water where you need it',
  },
];

export const ITEMS_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

/** Items that place a block, keyed by block id — the reverse lookup for mining. */
export const ITEM_FOR_BLOCK = new Map(
  ITEMS.filter((i) => i.block != null).map((i) => [i.block, i.id]),
);

export function itemName(id) {
  return ITEMS_BY_ID.get(id)?.name ?? id;
}

export function stackLimit(id) {
  return ITEMS_BY_ID.get(id)?.stackTo ?? STACK_BULK;
}

export function isTool(id) {
  return ITEMS_BY_ID.get(id)?.kind === 'tool';
}

export function isFood(id) {
  return ITEMS_BY_ID.get(id)?.kind === 'food';
}

/** How much hunger one unit of this item restores, or 0 if it isn't food. */
export function feedValue(id) {
  return ITEMS_BY_ID.get(id)?.feeds ?? 0;
}
