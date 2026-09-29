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

// Colours here mirror the block registry's pastel set exactly where an item
// places or comes from a block — a bag full of dirt should look like the
// ground it came from — with the same tool-only items (below) pastelised on
// their own since they have no block to match.
export const ITEMS = [
  // --- raw materials, gathered from the world -----------------------------
  { id: 'dirt', name: 'Dirt', kind: 'raw', stackTo: STACK_BULK, color: 0xc69972, glyph: 'dirt', block: 2, madeBy: 'Foraged from the ground' },
  { id: 'wood', name: 'Wood', kind: 'raw', stackTo: STACK_BULK, color: 0xcc9e72, glyph: 'log', block: 4, madeBy: 'Cut from trees' },
  { id: 'leaves', name: 'Leaves', kind: 'raw', stackTo: STACK_BULK, color: 0x82c675, glyph: 'leaf', block: 5, madeBy: 'Stripped from trees' },
  { id: 'stone', name: 'Stone', kind: 'raw', stackTo: STACK_BULK, color: 0xafafb6, glyph: 'stone', block: 3, madeBy: 'Mined from rock' },
  { id: 'sand', name: 'Sand', kind: 'raw', stackTo: STACK_BULK, color: 0xded09f, glyph: 'sand', block: 6, madeBy: 'Dug from the riverbank' },
  { id: 'grass', name: 'Turf', kind: 'raw', stackTo: STACK_BULK, color: 0x97cc81, glyph: 'grass', block: 1, madeBy: 'Cut from meadow' },
  // What the other kinds of country are made of. Without these, digging up a
  // forest floor or a river bank would hand you nothing at all.
  { id: 'moss', name: 'Moss', kind: 'raw', stackTo: STACK_BULK, color: 0x81c271, glyph: 'moss', block: 22, madeBy: 'Lifted from a forest floor' },
  { id: 'gravel', name: 'Gravel', kind: 'raw', stackTo: STACK_BULK, color: 0xbbb6ae, glyph: 'gravel', block: 23, madeBy: 'Scraped off the highlands' },
  { id: 'clay', name: 'Clay', kind: 'raw', stackTo: STACK_BULK, color: 0xa3beca, glyph: 'clay', block: 24, madeBy: 'Dug from wet ground' },

  // --- worked materials ----------------------------------------------------
  { id: 'planks', name: 'Planks', kind: 'refined', stackTo: STACK_BULK, color: 0xd1b38c, glyph: 'planks', block: 7, madeBy: 'Sawn from wood' },
  { id: 'farmland', name: 'Turned Soil', kind: 'refined', stackTo: STACK_BULK, color: 0xc4986c, glyph: 'farmland', block: 21, madeBy: 'Dirt broken up for planting' },

  // --- what the quarry, kiln and mine give back ----------------------------
  { id: 'cobblestone', name: 'Cobblestone', kind: 'raw', stackTo: STACK_BULK, color: 0xa1a1aa, glyph: 'cobble', block: 8, madeBy: 'Split from quarried stone' },
  { id: 'brick', name: 'Brick', kind: 'refined', stackTo: STACK_BULK, color: 0xd1887a, glyph: 'brick', block: 9, madeBy: 'Fired from earth in a kiln' },
  { id: 'glass', name: 'Glass', kind: 'refined', stackTo: STACK_BULK, color: 0xb9dce8, glyph: 'pane', block: 10, madeBy: 'Fired from sand in a kiln' },
  { id: 'marble', name: 'Marble', kind: 'refined', stackTo: STACK_BULK, color: 0xe3dbc8, glyph: 'marble', block: 17, madeBy: 'Cut and dressed at a workshop' },
  { id: 'gold', name: 'Gold', kind: 'raw', stackTo: STACK_GOODS, color: 0xe5cd8c, glyph: 'gold', block: 13, madeBy: 'Brought up from a mine' },

  // --- growing things ------------------------------------------------------
  { id: 'seeds', name: 'Seeds', kind: 'raw', stackTo: STACK_GOODS, color: 0xd7cb95, glyph: 'seeds', madeBy: 'Shaken from a forest, or saved from a harvest' },
  { id: 'sapling', name: 'Sapling', kind: 'raw', stackTo: STACK_GOODS, color: 0x9fcd8b, glyph: 'sprout', block: 20, madeBy: 'Grown from seed' },

  // --- food. Fruit spoils, preserves do not -------------------------------
  { id: 'fruit', name: 'Fruit', kind: 'food', stackTo: STACK_FOOD, color: 0xdc928f, glyph: 'fruit', feeds: 12, madeBy: 'Picked from a forest' },
  { id: 'vegetables', name: 'Vegetables', kind: 'food', stackTo: STACK_FOOD, color: 0xddb289, glyph: 'vegetable', feeds: 22, madeBy: 'Harvested from a farm' },

  // --- tools. One per slot, and they wear ---------------------------------
  //
  // `effectiveness` is what a tool is actually for: keyed by the material a
  // block declares in config/blocks.js, each entry is 'fast', 'slow' or
  // 'impossible'. A material a tool doesn't mention is 'normal' — the same
  // pace as bare hands, neither helped nor hurt. Bare hands themselves are
  // never in this table at all, because they're never gated: hold nothing
  // and everything breaks at the one baseline pace, an axe or a pickaxe only
  // ever making some of it faster, never anything impossible. See
  // TOOL_EFFECTIVENESS and Game.js's breakDelayFor.
  {
    id: 'axe', name: 'Axe', kind: 'tool', stackTo: STACK_TOOL, color: 0xcbaa8a, glyph: 'axe',
    durability: 120, madeBy: 'Crafted from wood', unlocks: 'Cutting trees quickly',
    effectiveness: { wood: 'fast', plant: 'fast', dirt: 'slow', stone: 'impossible' },
  },
  {
    id: 'pickaxe', name: 'Pickaxe', kind: 'tool', stackTo: STACK_TOOL, color: 0xafafb7, glyph: 'pickaxe',
    durability: 120, madeBy: 'Crafted from wood and stone', unlocks: 'Mining stone quickly',
    effectiveness: { stone: 'fast', wood: 'slow', plant: 'slow', dirt: 'slow' },
  },
  {
    id: 'shovel', name: 'Shovel', kind: 'tool', stackTo: STACK_TOOL, color: 0xb5b5bd, glyph: 'shovel',
    durability: 120, madeBy: 'Crafted from wood', unlocks: 'Digging dirt and sand quickly',
    effectiveness: { dirt: 'fast', wood: 'slow', plant: 'slow', stone: 'slow' },
  },
  {
    id: 'bucket', name: 'Bucket', kind: 'tool', stackTo: STACK_TOOL, color: 0xb5bec3, glyph: 'bucket',
    durability: null, madeBy: 'Crafted from wood', unlocks: 'Carrying water',
    holds: 'water',
  },
  {
    id: 'bucket_water', name: 'Bucket of Water', kind: 'tool', stackTo: STACK_TOOL, color: 0x7fa5d5, glyph: 'bucketFull',
    durability: null, madeBy: 'Filled at a river', unlocks: 'Pouring water where you need it',
  },

  // --- building tools -------------------------------------------------------
  //
  // Clearing a hillside and mirroring a wall were buttons that were simply
  // there, in a game whose whole shape is that you make the thing before you
  // can use it. They are made now, like the axe, and the button appears when
  // you own one.
  {
    id: 'pry_bar', name: 'Pry bar', kind: 'tool', stackTo: STACK_TOOL, color: 0xc6a984, glyph: 'clear',
    durability: null, madeBy: 'Crafted at the bench', unlocks: 'Clearing a lot of blocks at once',
    grants: 'clear',
  },
  {
    id: 'chalk_line', name: 'Chalk line', kind: 'tool', stackTo: STACK_TOOL, color: 0xddd3bd, glyph: 'symmetry',
    durability: null, madeBy: 'Crafted at the bench', unlocks: 'Mirroring what you place',
    grants: 'mirror',
  },

  // --- Phase 4: light, half-height shapes, furniture -----------------------
  { id: 'lantern', name: 'Lantern', kind: 'refined', stackTo: STACK_GOODS, color: 0xffd27a, glyph: 'lantern', block: 26, madeBy: 'Crafted from planks and glass' },
  { id: 'slab_stone', name: 'Stone Slab', kind: 'refined', stackTo: STACK_BULK, color: 0xafafb6, glyph: 'slab', block: 27, madeBy: 'Split from cut stone' },
  { id: 'slab_plank', name: 'Plank Slab', kind: 'refined', stackTo: STACK_BULK, color: 0xd1b38c, glyph: 'slab', block: 28, madeBy: 'Sawn thin from planks' },
  { id: 'stairs_stone', name: 'Stone Stairs', kind: 'refined', stackTo: STACK_BULK, color: 0xafafb6, glyph: 'stair', block: 29, madeBy: 'Cut into steps from stone' },
  { id: 'stairs_plank', name: 'Plank Stairs', kind: 'refined', stackTo: STACK_BULK, color: 0xd1b38c, glyph: 'stair', block: 30, madeBy: 'Cut into steps from planks' },
  { id: 'table_oak', name: 'Oak Table', kind: 'refined', stackTo: STACK_GOODS, color: 0xd1b38c, glyph: 'table', block: 31, madeBy: 'Built at the workshop' },
  { id: 'table_marble', name: 'Marble Table', kind: 'refined', stackTo: STACK_GOODS, color: 0xe3dbc8, glyph: 'table', block: 32, madeBy: 'Cut and dressed at the workshop' },
  { id: 'chair_oak', name: 'Oak Chair', kind: 'refined', stackTo: STACK_GOODS, color: 0xd1b38c, glyph: 'chair', block: 33, madeBy: 'Built at the workshop' },
  { id: 'chair_red', name: 'Red Chair', kind: 'refined', stackTo: STACK_GOODS, color: 0xd1887a, glyph: 'chair', block: 34, madeBy: 'Built at the workshop, finished in brick red' },
  { id: 'rug_red', name: 'Red Rug', kind: 'refined', stackTo: STACK_GOODS, color: 0xd1887a, glyph: 'rug', block: 35, madeBy: 'Woven at the workshop, dyed with brick' },
  { id: 'rug_blue', name: 'Blue Rug', kind: 'refined', stackTo: STACK_GOODS, color: 0x90aade, glyph: 'rug', block: 36, madeBy: 'Woven at the workshop, dyed with glass' },
  { id: 'rug_green', name: 'Green Rug', kind: 'refined', stackTo: STACK_GOODS, color: 0x82c675, glyph: 'rug', block: 37, madeBy: 'Woven at the workshop, left undyed' },

  // --- blocks that only ever had a place() unlock, never an item ----------
  //
  // Creative used to hand these out by iterating the block registry directly
  // rather than going through an item at all, so nobody had ever given them
  // one. A real Inventory can only hold items, so a sandbox kit needs every
  // placeable block to have one — see Game.js's grantCreativeKit.
  { id: 'water', name: 'Water', kind: 'raw', stackTo: STACK_BULK, color: 0x83add7, glyph: 'water', block: 11, madeBy: 'Scooped from a river' },
  { id: 'snow', name: 'Snow', kind: 'raw', stackTo: STACK_BULK, color: 0xceddec, glyph: 'snow', block: 12, madeBy: 'Gathered from a snowfield' },
  { id: 'obsidian', name: 'Obsidian', kind: 'raw', stackTo: STACK_BULK, color: 0x372648, glyph: 'obsidian', block: 14, madeBy: 'Found deep underground' },
  { id: 'glass_red', name: 'Red Glass', kind: 'refined', stackTo: STACK_BULK, color: 0xde9390, glyph: 'pane', block: 15, madeBy: 'Fired from sand, tinted red' },
  { id: 'glass_blue', name: 'Blue Glass', kind: 'refined', stackTo: STACK_BULK, color: 0x90aade, glyph: 'pane', block: 16, madeBy: 'Fired from sand, tinted blue' },
  { id: 'amethyst', name: 'Amethyst', kind: 'raw', stackTo: STACK_GOODS, color: 0xb895dc, glyph: 'crystal', block: 18, madeBy: 'Found deep underground' },
  { id: 'silt', name: 'Silt', kind: 'raw', stackTo: STACK_BULK, color: 0x8b9a8a, glyph: 'clay', block: 25, madeBy: 'Dug from the ocean floor' },
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

/**
 * How well a tool works on a material: 'fast', 'slow' or 'impossible', and
 * 'normal' — bare-hand pace — for a tool that has nothing to say about it,
 * or for no tool at all. See the effectiveness tables above.
 */
export function toolEffectiveness(toolId, material) {
  if (!material) return 'normal';
  return ITEMS_BY_ID.get(toolId)?.effectiveness?.[material] ?? 'normal';
}

/** How much hunger one unit of this item restores, or 0 if it isn't food. */
export function feedValue(id) {
  return ITEMS_BY_ID.get(id)?.feeds ?? 0;
}
