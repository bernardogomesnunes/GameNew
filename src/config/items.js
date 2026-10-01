import { BLOCKS } from './blocks.js';
import { CROPS, cropBaseOf } from './crops.js';
import { ARMOUR_PIECES } from './armour.js';
import { ENCHANTMENTS, ENCHANTABLE_SWORDS, enchantedId } from './enchantments.js';

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
  { id: 'grass', name: 'Turf', kind: 'raw', stackTo: STACK_BULK, color: 0x97cc81, glyph: 'grass', block: 1, madeBy: 'Cut from the plains' },
  // What the other kinds of country are made of. Without these, digging up a
  // forest floor or a river bank would hand you nothing at all.
  { id: 'moss', name: 'Moss', kind: 'raw', stackTo: STACK_BULK, color: 0x81c271, glyph: 'moss', block: 22, madeBy: 'Lifted from a forest floor' },
  { id: 'gravel', name: 'Gravel', kind: 'raw', stackTo: STACK_BULK, color: 0xbbb6ae, glyph: 'gravel', block: 23, madeBy: 'Scraped off the mountainside' },
  { id: 'clay', name: 'Clay', kind: 'raw', stackTo: STACK_BULK, color: 0xa3beca, glyph: 'clay', block: 24, madeBy: 'Dug from wet ground' },
  // The two extra forests' own wood, and the tall mountain's own hazards —
  // added alongside the terrain overhaul. Same shape as Wood/Leaves above:
  // gathered, not crafted, which is why they carry no recipe (see
  // shapes.test.mjs's NATURAL set).
  { id: 'white_wood', name: 'White Wood', kind: 'raw', stackTo: STACK_BULK, color: 0xe8e0d0, glyph: 'log', block: 41, madeBy: 'Cut from birch trees' },
  { id: 'white_leaves', name: 'White Leaves', kind: 'raw', stackTo: STACK_BULK, color: 0xd7e3ab, glyph: 'leaf', block: 42, madeBy: 'Stripped from birch trees' },
  { id: 'dark_wood', name: 'Dark Wood', kind: 'raw', stackTo: STACK_BULK, color: 0x6b4a3a, glyph: 'log', block: 43, madeBy: 'Cut from the dark forest' },
  { id: 'dark_leaves', name: 'Dark Leaves', kind: 'raw', stackTo: STACK_BULK, color: 0x4a7a52, glyph: 'leaf', block: 44, madeBy: 'Stripped from the dark forest' },
  { id: 'lava', name: 'Lava', kind: 'raw', stackTo: STACK_GOODS, color: 0xe8672c, glyph: 'water', block: 45, madeBy: 'Scooped from a cavern' },
  { id: 'dark_moss', name: 'Dark Moss', kind: 'raw', stackTo: STACK_BULK, color: 0x4a6045, glyph: 'moss', block: 46, madeBy: 'Lifted from the dark forest floor' },
  { id: 'forest_floor', name: 'Forest Floor', kind: 'raw', stackTo: STACK_BULK, color: 0x8a7a48, glyph: 'moss', block: 147, madeBy: 'Raked up in a giant grove' },

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
  // Mixed seeds come up as whichever crop they turn out to be (see
  // Game.plantMixed); each crop's own seeds come up as that crop — see
  // config/crops.js.
  { id: 'seeds', name: 'Mixed Seeds', kind: 'raw', stackTo: STACK_GOODS, color: 0xd7cb95, glyph: 'seeds', madeBy: 'Shaken from a forest, or saved from a harvest' },
  ...CROPS.map((c) => ({
    id: `seeds_${c.kind}`, name: `${c.name} Seeds`, kind: 'raw', stackTo: STACK_GOODS, color: c.crop, glyph: 'seeds',
    block: cropBaseOf(c), madeBy: `Saved from a ripe ${c.name.toLowerCase()}`,
  })),
  { id: 'sapling', name: 'Sapling', kind: 'raw', stackTo: STACK_GOODS, color: 0x9fcd8b, glyph: 'sprout', block: 20, madeBy: 'Grown from seed' },

  // --- food. Fruit spoils, preserves do not -------------------------------
  { id: 'fruit', name: 'Fruit', kind: 'food', stackTo: STACK_FOOD, color: 0xdc928f, glyph: 'fruit', feeds: 12, madeBy: 'Picked from a forest' },
  // The farm's crops. Carrots are the vegetables the game always had — the
  // id stays so everything that already made or used them still does.
  { id: 'vegetables', name: 'Carrots', kind: 'food', stackTo: STACK_FOOD, color: 0xe8873a, glyph: 'vegetable', feeds: 22, madeBy: 'Harvested from a farm' },
  { id: 'coffee_beans', name: 'Coffee Beans', kind: 'food', stackTo: STACK_FOOD, color: 0xb8362e, glyph: 'seeds', feeds: 4, madeBy: 'Picked from a coffee plant — brew them, or chew them' },
  { id: 'potato', name: 'Potatoes', kind: 'food', stackTo: STACK_FOOD, color: 0xc9a46c, glyph: 'vegetable', feeds: 20, madeBy: 'Dug from a farm' },
  { id: 'cabbage', name: 'Cabbage', kind: 'food', stackTo: STACK_FOOD, color: 0xa9cf86, glyph: 'vegetable', feeds: 18, madeBy: 'Cut from a farm' },
  { id: 'lettuce', name: 'Lettuce', kind: 'food', stackTo: STACK_FOOD, color: 0xb6de86, glyph: 'vegetable', feeds: 12, madeBy: 'Picked from a farm' },
  { id: 'pepper', name: 'Peppers', kind: 'food', stackTo: STACK_FOOD, color: 0xd84a3c, glyph: 'vegetable', feeds: 14, madeBy: 'Picked from a farm' },
  { id: 'zucchini', name: 'Zucchini', kind: 'food', stackTo: STACK_FOOD, color: 0x3f7a35, glyph: 'vegetable', feeds: 16, madeBy: 'Cut from a farm' },
  { id: 'broccoli', name: 'Broccoli', kind: 'food', stackTo: STACK_FOOD, color: 0x3e7b3c, glyph: 'vegetable', feeds: 18, madeBy: 'Cut from a farm' },
  // Hunted. Raw is barely worth eating on purpose: the fire is what makes
  // meat worth the chase — see the cook_meat recipe.
  { id: 'raw_meat', name: 'Raw Meat', kind: 'food', stackTo: STACK_FOOD, color: 0xd98b85, glyph: 'meat', feeds: 5, madeBy: 'Hunted' },
  { id: 'cooked_meat', name: 'Cooked Meat', kind: 'food', stackTo: STACK_FOOD, color: 0xb7825c, glyph: 'meat', feeds: 32, madeBy: 'Roasted over a fire' },

  // --- what animals leave behind -------------------------------------------
  { id: 'hide', name: 'Hide', kind: 'raw', stackTo: STACK_GOODS, color: 0xb99372, glyph: 'hide', madeBy: 'Hunted from deer, boar, goats and cows' },
  { id: 'wool', name: 'Wool', kind: 'raw', stackTo: STACK_GOODS, color: 0xefebe2, glyph: 'wool', madeBy: 'Hunted from sheep' },
  { id: 'egg', name: 'Egg', kind: 'food', stackTo: STACK_FOOD, color: 0xf2e6cf, glyph: 'egg', feeds: 10, madeBy: 'Laid by hens in a pen' },
  { id: 'milk', name: 'Milk', kind: 'food', stackTo: STACK_FOOD, color: 0xf4f1ea, glyph: 'milk', feeds: 14, madeBy: 'From cows in a pen' },
  { id: 'feather', name: 'Feather', kind: 'raw', stackTo: STACK_GOODS, color: 0xe9e4da, glyph: 'feather', madeBy: 'Hunted from chickens' },

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
    damage: 3, // how hard it hits an animal; bare hands are 1 — see Game.hitMob
    effectiveness: { wood: 'fast', plant: 'fast', dirt: 'slow', stone: 'impossible' },
  },
  {
    id: 'pickaxe', name: 'Pickaxe', kind: 'tool', stackTo: STACK_TOOL, color: 0xafafb7, glyph: 'pickaxe',
    durability: 120, madeBy: 'Crafted from wood and stone', unlocks: 'Mining stone quickly',
    damage: 2,
    effectiveness: { stone: 'fast', wood: 'slow', plant: 'slow', dirt: 'slow' },
  },
  {
    id: 'shovel', name: 'Shovel', kind: 'tool', stackTo: STACK_TOOL, color: 0xb5b5bd, glyph: 'shovel',
    durability: 120, madeBy: 'Crafted from wood', unlocks: 'Digging dirt and sand quickly',
    damage: 2,
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

  // --- swords (Phase 6b) -----------------------------------------------------
  //
  // Chosen directly: wood, stone and iron, made at the bench, each hitting
  // harder than the last. Any tool hits; these are the ones made for it.
  // A bandit has 12 points: four blows of wood, two of stone or iron.
  {
    id: 'sword_wood', name: 'Wooden Sword', kind: 'tool', stackTo: STACK_TOOL, color: 0xcbaa8a, glyph: 'sword',
    durability: 100, madeBy: 'Crafted at the bench', unlocks: 'Fighting bandits',
    damage: 4, weapon: true,
    effectiveness: { plant: 'fast' },
  },
  {
    id: 'sword_stone', name: 'Stone Sword', kind: 'tool', stackTo: STACK_TOOL, color: 0xafafb7, glyph: 'sword',
    durability: 160, madeBy: 'Crafted at the bench', unlocks: 'Fighting bandits',
    damage: 6, weapon: true,
    effectiveness: { plant: 'fast' },
  },
  {
    id: 'sword_iron', name: 'Iron Sword', kind: 'tool', stackTo: STACK_TOOL, color: 0xc9ced6, glyph: 'sword',
    durability: 300, madeBy: 'Crafted at the bench from iron', unlocks: 'Fighting bandits',
    damage: 9, weapon: true,
    effectiveness: { plant: 'fast' },
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
  { id: 'roof_brick', name: 'Brick Roof Tiles', kind: 'refined', stackTo: STACK_BULK, color: 0xc9765c, glyph: 'rooftile', block: 86, madeBy: 'Fired from brick into curved tiles' },
  { id: 'roof_stone', name: 'Stone Roof Tiles', kind: 'refined', stackTo: STACK_BULK, color: 0x8e93a0, glyph: 'rooftile', block: 101, madeBy: 'Split from stone into slates' },
  { id: 'chandelier', name: 'Chandelier', kind: 'refined', stackTo: STACK_GOODS, color: 0x5d5552, glyph: 'chandelier', block: 85, madeBy: 'Wrought from iron and hung with candles' },
  { id: 'lantern', name: 'Lantern', kind: 'refined', stackTo: STACK_GOODS, color: 0xffd27a, glyph: 'lantern', block: 26, madeBy: 'Crafted from planks and glass' },
  { id: 'slab_stone', name: 'Stone Slab', kind: 'refined', stackTo: STACK_BULK, color: 0xafafb6, glyph: 'slab', block: 27, madeBy: 'Split from cut stone' },
  { id: 'slab_plank', name: 'Plank Slab', kind: 'refined', stackTo: STACK_BULK, color: 0xd1b38c, glyph: 'slab', block: 28, madeBy: 'Sawn thin from planks' },
  { id: 'stairs_stone', name: 'Stone Stairs', kind: 'refined', stackTo: STACK_BULK, color: 0xafafb6, glyph: 'stair', block: 29, madeBy: 'Cut into steps from stone' },
  { id: 'fence', name: 'Fence', kind: 'refined', stackTo: STACK_BULK, color: 0xc9a67c, glyph: 'fence', block: 47, madeBy: 'Knocked together from planks' },
  { id: 'gate', name: 'Gate', kind: 'refined', stackTo: STACK_GOODS, color: 0xa9825a, glyph: 'gate', block: 48, madeBy: 'Hung from planks — you pass, animals don\'t' },
  // --- Phase 7a: the decorative pack ----------------------------------------
  { id: 'dark_stone', name: 'Dark Stone', kind: 'refined', stackTo: STACK_BULK, color: 0x4f4b57, glyph: 'stone', block: 156, madeBy: 'Stone darkened over a dark-wood fire' },
  { id: 'dark_brick', name: 'Dark Brick', kind: 'refined', stackTo: STACK_BULK, color: 0x5c4b52, glyph: 'brick', block: 157, madeBy: 'Brick darkened over a dark-wood fire' },
  { id: 'sky_marble', name: 'Sky Marble', kind: 'refined', stackTo: STACK_BULK, color: 0xe8eef8, glyph: 'marble', block: 158, madeBy: 'Marble polished with powdered glass' },
  { id: 'gold_trim', name: 'Gold Trim', kind: 'refined', stackTo: STACK_BULK, color: 0xe2c26a, glyph: 'trim', block: 159, madeBy: 'Stone banded with gold' },
  { id: 'timber_frame', name: 'Timber Frame', kind: 'refined', stackTo: STACK_BULK, color: 0xf0e6cf, glyph: 'timber', block: 160, madeBy: 'Clay plaster set between planks' },
  { id: 'wall_cobble', name: 'Cobblestone Wall', kind: 'refined', stackTo: STACK_BULK, color: 0xa1a1aa, glyph: 'wall', block: 161, madeBy: 'Laid from cobblestone — joins up like a fence' },
  { id: 'wall_stone', name: 'Stone Wall', kind: 'refined', stackTo: STACK_BULK, color: 0xafafb6, glyph: 'wall', block: 162, madeBy: 'Laid from stone — joins up like a fence' },
  { id: 'wall_brick', name: 'Brick Wall', kind: 'refined', stackTo: STACK_BULK, color: 0xd1887a, glyph: 'wall', block: 163, madeBy: 'Laid from brick — joins up like a fence' },
  { id: 'wall_dark', name: 'Dark Stone Wall', kind: 'refined', stackTo: STACK_BULK, color: 0x4f4b57, glyph: 'wall', block: 164, madeBy: 'Laid from dark stone — joins up like a fence' },
  { id: 'pillar_stone', name: 'Stone Pillar', kind: 'refined', stackTo: STACK_BULK, color: 0xc4c4ca, glyph: 'pillar', block: 165, madeBy: 'Turned from stone — stack them into a column' },
  { id: 'pillar_marble', name: 'Marble Pillar', kind: 'refined', stackTo: STACK_BULK, color: 0xe3dbc8, glyph: 'pillar', block: 166, madeBy: 'Turned from marble — stack them into a column' },
  { id: 'pillar_dark', name: 'Dark Pillar', kind: 'refined', stackTo: STACK_BULK, color: 0x4f4b57, glyph: 'pillar', block: 167, madeBy: 'Turned from dark stone — stack them into a column' },
  { id: 'trapdoor', name: 'Trapdoor', kind: 'refined', stackTo: STACK_GOODS, color: 0xb08a60, glyph: 'trapdoor', block: 168, madeBy: 'Knocked together from planks — Place opens and shuts it' },
  { id: 'window', name: 'Framed Window', kind: 'refined', stackTo: STACK_GOODS, color: 0x9a7350, glyph: 'window', block: 176, madeBy: 'Glass set in a wooden frame' },
  { id: 'vase', name: 'Vase', kind: 'refined', stackTo: STACK_GOODS, color: 0xc9825c, glyph: 'vase', block: 180, madeBy: 'Thrown from clay and painted' },
  { id: 'urn', name: 'Urn', kind: 'refined', stackTo: STACK_GOODS, color: 0xb08d57, glyph: 'urn', block: 181, madeBy: 'Beaten from copper' },
  { id: 'banner_white', name: 'White Banner', kind: 'refined', stackTo: STACK_GOODS, color: 0xf4f1ea, glyph: 'banner', block: 182, madeBy: 'Woven white, with the gold sun of the sky' },
  { id: 'banner_black', name: 'Black Banner', kind: 'refined', stackTo: STACK_GOODS, color: 0x2e2a33, glyph: 'banner', block: 186, madeBy: 'Woven black, with the red tower of the stone' },
  { id: 'firefly_lantern', name: 'Firefly Lantern', kind: 'refined', stackTo: STACK_GOODS, color: 0xd9ec9a, glyph: 'lantern', block: 190, madeBy: 'Glass, with fireflies you caught in it' },
  { id: 'fireflies', name: 'Fireflies', kind: 'raw', stackTo: STACK_GOODS, color: 0xc8ff5a, glyph: 'firefly', madeBy: 'Caught at night — Break on a swarm' },
  // Homes (playtest, P1).
  { id: 'bed', name: 'Bed', kind: 'refined', stackTo: STACK_GOODS, color: 0xb84a3e, glyph: 'bed', block: 193, madeBy: 'Planks, stuffed with leaves — two blocks long, put down the way you face' },
  { id: 'painting', name: 'Painting', kind: 'refined', stackTo: STACK_GOODS, color: 0x8a6440, glyph: 'painting', block: 201, madeBy: 'A little landscape in a frame — Place on it to wake there when you fall' },
  { id: 'catapult', name: 'Catapult', kind: 'refined', stackTo: STACK_GOODS, color: 0x8a6440, glyph: 'catapult', block: 152, madeBy: 'Built at the bench — Place mans it, Break throws a stone' },
  { id: 'chest', name: 'Chest', kind: 'refined', stackTo: STACK_GOODS, color: 0x9a6b3f, glyph: 'chest', block: 148, madeBy: 'Knocked together from planks — Place opens it' },
  { id: 'door', name: 'Door', kind: 'refined', stackTo: STACK_GOODS, color: 0xb08a60, glyph: 'door', block: 69, madeBy: 'Hung from planks — Place opens and shuts it' },
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
  // "Gathered from a snowfield" dated back to a Snowfield biome the terrain
  // overhaul retired — nothing generates this block in the world any more,
  // only the level unlock does, so the flavour text no longer claims a place
  // to find it that doesn't exist.
  { id: 'snow', name: 'Snow', kind: 'raw', stackTo: STACK_BULK, color: 0xf5f7f8, glyph: 'snow', block: 12, madeBy: 'Found on the highest peaks' },
  { id: 'obsidian', name: 'Obsidian', kind: 'raw', stackTo: STACK_BULK, color: 0x372648, glyph: 'obsidian', block: 14, madeBy: 'Found deep underground' },
  { id: 'glass_red', name: 'Red Glass', kind: 'refined', stackTo: STACK_BULK, color: 0xde9390, glyph: 'pane', block: 15, madeBy: 'Fired from sand, tinted red' },
  { id: 'glass_blue', name: 'Blue Glass', kind: 'refined', stackTo: STACK_BULK, color: 0x90aade, glyph: 'pane', block: 16, madeBy: 'Fired from sand, tinted blue' },
  { id: 'amethyst', name: 'Amethyst', kind: 'raw', stackTo: STACK_GOODS, color: 0xb895dc, glyph: 'crystal', block: 18, madeBy: 'Found deep underground' },
  { id: 'silt', name: 'Silt', kind: 'raw', stackTo: STACK_BULK, color: 0x8b9a8a, glyph: 'clay', block: 25, madeBy: 'Dug from the ocean floor' },

  // --- ore, from the one mountain that has any --------------------------
  //
  // Raw ore mines the same way anything else does — break it, it's in your
  // bag — but it is only ever found on the Summit biome, and even there at
  // under 5% of the rock (see biomes.js's `ores` and ChunkGen.oreAt). A
  // foundry (config/structures.js) is what turns the raw ore into something
  // a recipe actually asks for.
  { id: 'iron_ore', name: 'Iron Ore', kind: 'raw', stackTo: STACK_GOODS, color: 0xa9948d, glyph: 'gravel', block: 38, madeBy: 'Mined from the Summit' },
  { id: 'copper_ore', name: 'Copper Ore', kind: 'raw', stackTo: STACK_GOODS, color: 0xbb8a67, glyph: 'gravel', block: 39, madeBy: 'Mined from the Summit' },
  { id: 'gold_ore', name: 'Gold Ore', kind: 'raw', stackTo: STACK_GOODS, color: 0xc8b686, glyph: 'gold', block: 40, madeBy: 'Mined from the Summit' },
  // The ring ores (Phase 7c) — see blocks.js. Each ring needs its own.
  { id: 'sunstone', name: 'Sunstone', kind: 'raw', stackTo: STACK_GOODS, color: 0xffd76a, glyph: 'crystal', block: 191, madeBy: 'Very rare — deep in the caves, or in a chest. For the White Ring' },
  { id: 'nightstone', name: 'Nightstone', kind: 'raw', stackTo: STACK_GOODS, color: 0x5a4a7a, glyph: 'crystal', block: 192, madeBy: 'Very rare — deep in the caves, or in a chest. For the Black Ring' },
  { id: 'iron_ingot', name: 'Iron Ingot', kind: 'refined', stackTo: STACK_GOODS, color: 0xc7c7cd, glyph: 'gold', madeBy: 'Smelted at a foundry' },
  { id: 'copper_ingot', name: 'Copper Ingot', kind: 'refined', stackTo: STACK_GOODS, color: 0xd69264, glyph: 'gold', madeBy: 'Smelted at a foundry' },

  // --- the Temple (Phase 7c) ------------------------------------------------
  //
  // Devotion is what a temple gathers — from worshippers and offerings —
  // and spends: on its own levels, on holy water, on a ring. Holy water
  // heals when you drink it. The rings are worn in the ring slot; you can
  // only ever forge one of the two.
  { id: 'devotion', name: 'Devotion', kind: 'raw', stackTo: STACK_GOODS, color: 0xffe3a0, glyph: 'devotion', madeBy: 'Gathered at a temple — from worshippers and offerings' },
  // Drinks that make you better for a while (playtest, P5) — see
  // config/drinks.js. Each gives its `boost` for a few minutes.
  { id: 'beer', name: 'Beer', kind: 'drink', stackTo: 10, color: 0xe0a83a, glyph: 'flask', boost: 'haste', madeBy: 'Brewed at a workshop from potatoes — quicker blows for three minutes' },
  { id: 'kombucha', name: 'Kombucha', kind: 'drink', stackTo: 10, color: 0xd0705a, glyph: 'flask', boost: 'strength', madeBy: 'Brewed at a workshop from fruit and leaves — +2 on every hit for three minutes' },
  { id: 'coffee', name: 'Coffee', kind: 'drink', stackTo: 10, color: 0x6b4630, glyph: 'flask', boost: 'speed', madeBy: 'Brewed at a workshop from coffee beans — faster on your feet for three minutes' },
  { id: 'holy_water', name: 'Holy Water', kind: 'drink', stackTo: 10, color: 0xbfe3f5, glyph: 'flask', heals: 8, madeBy: 'Blessed at a chapel — drink it to heal four hearts' },
  {
    id: 'ring_white', name: 'White Ring', kind: 'ring', stackTo: STACK_TOOL, color: 0xf2e2a4, glyph: 'ring', wears: 'ring', ring: 'white',
    madeBy: 'Gold and Sunstone, forged at the High Temple — you move faster and jump higher',
  },
  {
    id: 'ring_black', name: 'Black Ring', kind: 'ring', stackTo: STACK_TOOL, color: 0x3a3045, glyph: 'ring', wears: 'ring', ring: 'black',
    madeBy: 'Obsidian and Nightstone, forged at the High Temple — a dark spark hurts whoever strikes you',
  },

  // --- armour (Phase 7b) — see config/armour.js ---------------------------
  //
  // Worn, not held: `wears` is the slot it goes in, `armour` how many
  // points it adds. It wears with every blow it takes, like a tool with use.
  ...ARMOUR_PIECES.map((p) => ({
    id: p.id, name: p.name, kind: 'armour', stackTo: STACK_TOOL, color: p.main,
    glyph: { head: 'helm', body: 'cuirass', legs: 'greaves', feet: 'boots' }[p.slot],
    wears: p.slot, armour: p.points, set: p.set, durability: p.durability, madeBy: p.madeBy,
    ...(p.disguise ? { disguise: p.disguise } : {}),
  })),
];

// Enchanted pieces (playtest, P6) — see config/enchantments.js. Each is its
// piece with the enchantment's name in front and its power added.
for (const [key, e] of Object.entries(ENCHANTMENTS)) {
  const bases = e.weapon ? ENCHANTABLE_SWORDS.map((id) => ITEMS.find((i) => i.id === id))
    : ITEMS.filter((i) => i.kind === 'armour' && e.slots.includes(i.wears));
  for (const base of bases) {
    ITEMS.push({
      ...base, id: enchantedId(base.id, key), name: `${e.name} ${base.name}`, enchant: key,
      ...(e.armour ? { armour: base.armour + e.armour } : {}),
      ...(e.element ? { element: e.element } : {}),
      madeBy: `${base.name} enchanted at a temple — ${e.says}`,
    });
  }
}

/** Whether an item is something you wear, and where: 'head', 'body', 'legs' or 'ring', or null. */
export function wornOn(id) {
  return ITEMS_BY_ID.get(id)?.wears ?? null;
}

/** What a tool lets you do, if it lets you do anything: 'clear' -> 'pry_bar'. */
export const TOOL_FOR = new Map(
  ITEMS.filter((i) => i.grants).map((i) => [i.grants, i.id]),
);

export const ITEMS_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

/** Items that place a block, keyed by block id — the reverse lookup for mining. */
export const ITEM_FOR_BLOCK = new Map(
  ITEMS.filter((i) => i.block != null).map((i) => [i.block, i.id]),
);
// A block that's another block in a different state (an open gate) gives
// back that block's item. See blocks.js's `stateOf`. The top half of a door
// gives nothing: the door is its bottom half, and the two go together.
for (const b of BLOCKS) {
  if (b.stateOf != null && b.part == null && ITEM_FOR_BLOCK.has(b.stateOf)) ITEM_FOR_BLOCK.set(b.id, ITEM_FOR_BLOCK.get(b.stateOf));
}

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
