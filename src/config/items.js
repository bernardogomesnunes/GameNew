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
  { id: 'dirt', name: 'Dirt', kind: 'raw', stackTo: STACK_BULK, color: 0x7a5230, glyph: 'dirt', block: 2, madeBy: 'Foraged from the ground' },
  { id: 'wood', name: 'Wood', kind: 'raw', stackTo: STACK_BULK, color: 0x8a5a2b, glyph: 'log', block: 4, madeBy: 'Cut from trees' },
  { id: 'leaves', name: 'Leaves', kind: 'raw', stackTo: STACK_BULK, color: 0x3f7d34, glyph: 'leaf', block: 5, madeBy: 'Stripped from trees' },
  { id: 'stone', name: 'Stone', kind: 'raw', stackTo: STACK_BULK, color: 0x8a8a8d, glyph: 'stone', block: 3, madeBy: 'Mined from rock' },
  { id: 'sand', name: 'Sand', kind: 'raw', stackTo: STACK_BULK, color: 0xdcc57a, glyph: 'sand', block: 6, madeBy: 'Dug from the riverbank' },
  { id: 'grass', name: 'Turf', kind: 'raw', stackTo: STACK_BULK, color: 0x5b9c3f, glyph: 'grass', block: 1, madeBy: 'Cut from meadow' },
  // What the other kinds of country are made of. Without these, digging up a
  // forest floor or a river bank would hand you nothing at all.
  { id: 'moss', name: 'Moss', kind: 'raw', stackTo: STACK_BULK, color: 0x3c6b31, glyph: 'moss', block: 22, madeBy: 'Lifted from a forest floor' },
  { id: 'gravel', name: 'Gravel', kind: 'raw', stackTo: STACK_BULK, color: 0x9a948a, glyph: 'gravel', block: 23, madeBy: 'Scraped off the highlands' },
  { id: 'clay', name: 'Clay', kind: 'raw', stackTo: STACK_BULK, color: 0x8d9aa0, glyph: 'clay', block: 24, madeBy: 'Dug from wet ground' },

  // --- worked materials ----------------------------------------------------
  { id: 'planks', name: 'Planks', kind: 'refined', stackTo: STACK_BULK, color: 0xb98a4b, glyph: 'planks', block: 7, madeBy: 'Sawn from wood' },
  { id: 'farmland', name: 'Turned Soil', kind: 'refined', stackTo: STACK_BULK, color: 0x6b4a2a, glyph: 'farmland', block: 21, madeBy: 'Dirt broken up for planting' },

  // --- what the quarry, kiln and mine give back ----------------------------
  { id: 'cobblestone', name: 'Cobblestone', kind: 'raw', stackTo: STACK_BULK, color: 0x6b6b6e, glyph: 'cobble', block: 8, madeBy: 'Split from quarried stone' },
  { id: 'brick', name: 'Brick', kind: 'refined', stackTo: STACK_BULK, color: 0xa8422f, glyph: 'brick', block: 9, madeBy: 'Fired from earth in a kiln' },
  { id: 'glass', name: 'Glass', kind: 'refined', stackTo: STACK_BULK, color: 0xbfe3f0, glyph: 'pane', block: 10, madeBy: 'Fired from sand in a kiln' },
  { id: 'marble', name: 'Marble', kind: 'refined', stackTo: STACK_BULK, color: 0xe9e6de, glyph: 'marble', block: 17, madeBy: 'Cut and dressed at a workshop' },
  { id: 'gold', name: 'Gold', kind: 'raw', stackTo: STACK_GOODS, color: 0xf4c542, glyph: 'gold', block: 13, madeBy: 'Brought up from a mine' },

  // --- growing things ------------------------------------------------------
  { id: 'seeds', name: 'Seeds', kind: 'raw', stackTo: STACK_GOODS, color: 0xc8b560, glyph: 'seeds', madeBy: 'Shaken from a forest, or saved from a harvest' },
  { id: 'sapling', name: 'Sapling', kind: 'raw', stackTo: STACK_GOODS, color: 0x6aa84f, glyph: 'sprout', block: 20, madeBy: 'Grown from seed' },

  // --- food. Fruit spoils, preserves do not -------------------------------
  { id: 'fruit', name: 'Fruit', kind: 'food', stackTo: STACK_FOOD, color: 0xd9534f, glyph: 'fruit', feeds: 12, madeBy: 'Picked from a forest' },
  { id: 'vegetables', name: 'Vegetables', kind: 'food', stackTo: STACK_FOOD, color: 0xe08c3c, glyph: 'vegetable', feeds: 22, madeBy: 'Harvested from a farm' },

  // --- tools. One per slot, and they wear ---------------------------------
  {
    id: 'axe', name: 'Axe', kind: 'tool', stackTo: STACK_TOOL, color: 0xa07850, glyph: 'axe',
    durability: 120, madeBy: 'Crafted from wood', unlocks: 'Cutting trees quickly',
  },
  {
    id: 'pickaxe', name: 'Pickaxe', kind: 'tool', stackTo: STACK_TOOL, color: 0x8c8c90, glyph: 'pickaxe',
    durability: 120, madeBy: 'Crafted from wood and stone', unlocks: 'Mining stone quickly',
  },
  {
    id: 'shovel', name: 'Shovel', kind: 'tool', stackTo: STACK_TOOL, color: 0x9a9aa0, glyph: 'shovel',
    durability: 120, madeBy: 'Crafted from wood', unlocks: 'Digging dirt and sand quickly',
  },
  {
    id: 'bucket', name: 'Bucket', kind: 'tool', stackTo: STACK_TOOL, color: 0x9aa7ad, glyph: 'bucket',
    durability: null, madeBy: 'Crafted from wood', unlocks: 'Carrying water',
    holds: 'water',
  },
  {
    id: 'bucket_water', name: 'Bucket of Water', kind: 'tool', stackTo: STACK_TOOL, color: 0x2f6fbf, glyph: 'bucketFull',
    durability: null, madeBy: 'Filled at a river', unlocks: 'Pouring water where you need it',
  },

  // --- building tools -------------------------------------------------------
  //
  // Clearing a hillside and mirroring a wall were buttons that were simply
  // there, in a game whose whole shape is that you make the thing before you
  // can use it. They are made now, like the axe, and the button appears when
  // you own one.
  {
    id: 'pry_bar', name: 'Pry bar', kind: 'tool', stackTo: STACK_TOOL, color: 0x8c6f4a, glyph: 'clear',
    durability: null, madeBy: 'Crafted at the bench', unlocks: 'Clearing a lot of blocks at once',
    grants: 'clear',
  },
  {
    id: 'chalk_line', name: 'Chalk line', kind: 'tool', stackTo: STACK_TOOL, color: 0xd8d2c4, glyph: 'symmetry',
    durability: null, madeBy: 'Crafted at the bench', unlocks: 'Mirroring what you place',
    grants: 'mirror',
  },
];

/** What a tool lets you do, if it lets you do anything: 'clear' -> 'pry_bar'. */
export const TOOL_FOR = new Map(
  ITEMS.filter((i) => i.grants).map((i) => [i.grants, i.id]),
);

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
