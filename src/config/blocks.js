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
// `material` is what a tool actually cuts, digs or mines — see
// TOOL_EFFECTIVENESS in config/items.js. Not every block has one: glass,
// snow and amethyst are worked materials, not something you'd point an axe
// or a shovel at, so they break at the same bare-handed pace no matter what
// is selected.
// Colours are a pastel palette rather than the saturated, mid-toned set the
// game shipped with — lighter and softer across the board, with two
// deliberate exceptions: Stone/Cobblestone/Gravel are pulled back toward
// neutral instead of the same lift everyone else gets (a low-saturation
// colour amplified by the general pastel treatment reads as an arbitrary
// tint, not a soft grey), and Obsidian keeps most of its depth so the
// palette still has one dark anchor rather than every block converging on
// the same pale middle.
export const BLOCKS = [
  { id: 1, name: 'Grass', glyph: 'grass', color: 0x97cc81, soil: true, material: 'dirt', cost: { wood: 1 }, unlock: null },
  { id: 2, name: 'Dirt', glyph: 'dirt', color: 0xc69972, soil: true, material: 'dirt', cost: { wood: 1 }, unlock: null },
  { id: 3, name: 'Stone', glyph: 'stone', color: 0xafafb6, material: 'stone', cost: { stone: 1 }, unlock: null },
  { id: 4, name: 'Wood', glyph: 'log', color: 0xcc9e72, material: 'wood', cost: { wood: 2 }, unlock: null },
  // Opaque on purpose. At 0.9 the transparency was invisible, but it put every
  // tree in the game into the depth-write-disabled transparent pass, which the
  // renderer re-sorts on every camera move — the shimmer you saw walking
  // through a forest. Opaque leaves also merge into the single opaque draw call.
  { id: 5, name: 'Leaves', glyph: 'leaf', color: 0x82c675, material: 'plant', cost: { wood: 1 }, unlock: null },
  { id: 6, name: 'Sand', glyph: 'sand', color: 0xded09f, material: 'dirt', cost: { wood: 1 }, unlock: null },
  { id: 7, name: 'Planks', glyph: 'planks', color: 0xd1b38c, material: 'wood', cost: { wood: 1 }, unlock: null },
  { id: 8, name: 'Cobblestone', glyph: 'cobble', color: 0xa1a1aa, material: 'stone', cost: { stone: 1 }, unlock: null },
  { id: 9, name: 'Brick', glyph: 'brick', color: 0xd1887a, material: 'stone', cost: { brick: 1 }, unlock: null },
  { id: 10, name: 'Glass', glyph: 'pane', color: 0xb9dce8, transparent: true, opacity: 0.35, cost: { glass: 1 }, unlock: null },
  // Thin enough to read as water over a sandy bed, but not so thin that the
  // sand shows through and turns the rivers grey, which is what 0.6 did.
  { id: 11, name: 'Water', glyph: 'water', color: 0x83add7, transparent: true, opacity: 0.78, cost: { wood: 3 }, unlock: null },
  { id: 12, name: 'Snow', glyph: 'snow', color: 0xceddec, cost: { wood: 1 }, unlock: { type: 'level', value: 3 } },
  { id: 13, name: 'Gold Block', glyph: 'gold', color: 0xe5cd8c, material: 'stone', cost: { gold: 1 }, unlock: { type: 'level', value: 6 } },
  { id: 14, name: 'Obsidian', glyph: 'obsidian', color: 0x372648, material: 'stone', cost: { stone: 4 }, unlock: { type: 'achievement', value: 'underground' } },
  { id: 15, name: 'Red Glass', glyph: 'pane', color: 0xde9390, transparent: true, opacity: 0.45, cost: { glass: 2 }, unlock: { type: 'level', value: 4 } },
  { id: 16, name: 'Blue Glass', glyph: 'pane', color: 0x90aade, transparent: true, opacity: 0.45, cost: { glass: 2 }, unlock: { type: 'level', value: 4 } },
  { id: 17, name: 'Marble', glyph: 'marble', color: 0xe3dbc8, material: 'stone', cost: { stone: 3 }, unlock: { type: 'achievement', value: 'architect' } },
  { id: 18, name: 'Amethyst', glyph: 'crystal', color: 0xb895dc, transparent: true, opacity: 0.55, cost: { gold: 2 }, unlock: { type: 'level', value: 8 } },
  { id: 19, name: 'Ground', color: 0x89c47c, system: true },
  // Duilt blocks. Saplings grow into forests; farmland is soil that has been
  // turned, which is what a farm is actually made of.
  { id: 20, name: 'Sapling', glyph: 'sprout', color: 0x9fcd8b, material: 'plant', cost: { wood: 1 }, unlock: null },
  { id: 21, name: 'Farmland', glyph: 'farmland', color: 0xc4986c, material: 'dirt', cost: { wood: 1 }, unlock: null },
  // Ground the biomes are made of. Six kinds of country used to share four
  // top blocks between them, so a meadow, a forest, the highlands and a
  // wetland were all the same green: you could walk from one to another and
  // the only thing that changed was how many trees there were. These are what
  // let each one have its own floor.
  { id: 22, name: 'Moss', glyph: 'moss', color: 0x81c271, soil: true, material: 'dirt', unlock: null },
  { id: 23, name: 'Gravel', glyph: 'gravel', color: 0xbbb6ae, material: 'stone', unlock: null },
  { id: 24, name: 'Clay', glyph: 'clay', color: 0xa3beca, soil: true, material: 'dirt', unlock: null },
  // The ocean's own floor — everything else underwater already borrowed Sand
  // (see ChunkGen's RIVERBED), which is fine for a riverbed but wrong once a
  // whole biome is the seabed: Sand is the Sands biome's own top block, and
  // sharing it would be the exact "two biomes read as one" problem the rest
  // of this file exists to avoid.
  { id: 25, name: 'Silt', glyph: 'clay', color: 0x8b9a8a, material: 'dirt', unlock: null },

  // Phase 4: real dynamic light, real half-height shapes, and furniture.
  //
  // `light` names a block that actually casts light — see LightManager, which
  // keeps a small pool of real THREE.PointLights on whichever placed lights
  // are nearest the player, rather than trying to light every one at once.
  //
  // `shape` marks a block that is not a full cube, for two systems at once:
  // ChunkMesher stops emitting the block's own cube face (its real geometry
  // comes from PropRenderer instead, as a small separate mesh) while the
  // block still occludes its neighbours' faces exactly like a solid cube —
  // a deliberate simplification, see ChunkMesher's own note — and World's
  // collisionBoxAt gives it a matching hitbox instead of the full cell.
  // Stairs share the slab's flat half-height hitbox rather than a stepped
  // one, and always render facing the same way — there is no facing/rotation
  // concept anywhere else in this block registry either.
  {
    id: 26, name: 'Lantern', glyph: 'lantern', color: 0xffd27a, material: 'wood',
    // Three's PointLight intensity is physically-based (candela): against the
    // scene's fixed daylight (Ambient 0.6 + Directional 0.85 + Hemisphere
    // 0.4, none of which use that scale), 1-2 was invisible and 40+ started
    // blowing out anything within a block of it. 24 read as a real warm
    // glow — visible, not garish — across several calibration renders.
    light: { color: 0xffcf8c, intensity: 24, distance: 14 },
    cost: { wood: 2 }, unlock: null,
  },
  { id: 27, name: 'Stone Slab', glyph: 'slab', color: 0xafafb6, shape: 'slab', material: 'stone', cost: { stone: 1 }, unlock: null },
  { id: 28, name: 'Plank Slab', glyph: 'slab', color: 0xd1b38c, shape: 'slab', material: 'wood', cost: { wood: 1 }, unlock: null },
  { id: 29, name: 'Stone Stairs', glyph: 'stair', color: 0xafafb6, shape: 'stair', material: 'stone', cost: { stone: 1 }, unlock: null },
  { id: 30, name: 'Plank Stairs', glyph: 'stair', color: 0xd1b38c, shape: 'stair', material: 'wood', cost: { wood: 1 }, unlock: null },

  // Furniture: a shape shared across recoloured variants, the same pattern
  // Glass/Red Glass/Blue Glass above already uses — a distinct 3D prop shape
  // (see PropRenderer) that comes in more than one finish.
  { id: 31, name: 'Oak Table', glyph: 'table', color: 0xd1b38c, shape: 'table', material: 'wood', cost: { wood: 4 }, unlock: null },
  { id: 32, name: 'Marble Table', glyph: 'table', color: 0xe3dbc8, shape: 'table', material: 'stone', cost: { stone: 3 }, unlock: null },
  { id: 33, name: 'Oak Chair', glyph: 'chair', color: 0xd1b38c, shape: 'chair', material: 'wood', cost: { wood: 3 }, unlock: null },
  { id: 34, name: 'Red Chair', glyph: 'chair', color: 0xd1887a, shape: 'chair', material: 'wood', cost: { wood: 3 }, unlock: null },
  { id: 35, name: 'Red Rug', glyph: 'rug', color: 0xd1887a, shape: 'rug', material: 'plant', cost: { wood: 1 }, unlock: null },
  { id: 36, name: 'Blue Rug', glyph: 'rug', color: 0x90aade, shape: 'rug', material: 'plant', cost: { wood: 1 }, unlock: null },
  { id: 37, name: 'Green Rug', glyph: 'rug', color: 0x82c675, shape: 'rug', material: 'plant', cost: { wood: 1 }, unlock: null },

  // Ore. Embedded in the rock of the Summit biome only (see ChunkGen.oreAt) —
  // a vein you find, not a block anyone places, the same way Moss or Clay are
  // natural ground with an item behind them but no cost to place. `gravel`'s
  // speckled mark already reads as flecks in rock; gold ore borrows the
  // existing gold mark instead, so it reads as kin to Gold Block without
  // being the same colour — ore is duller, unrefined, still in the stone.
  { id: 38, name: 'Iron Ore', glyph: 'gravel', color: 0xa9948d, material: 'stone', unlock: null },
  { id: 39, name: 'Copper Ore', glyph: 'gravel', color: 0xbb8a67, material: 'stone', unlock: null },
  { id: 40, name: 'Gold Ore', glyph: 'gold', color: 0xc8b686, material: 'stone', unlock: null },
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

/** 'cube' unless the block registered a real shape (slab, stair, table, chair, rug). */
export function shapeOf(id) {
  return BLOCKS_BY_ID.get(id)?.shape ?? 'cube';
}

/** { color, intensity, distance } for a block that casts real light, or null. */
export function lightOf(id) {
  return BLOCKS_BY_ID.get(id)?.light ?? null;
}

export function blockName(id) {
  const b = BLOCKS_BY_ID.get(id);
  return b ? b.name : 'Air';
}

/** What a tool actually cuts, digs or mines here — or null for a worked material no tool specialises in. */
export function materialOf(id) {
  return BLOCKS_BY_ID.get(id)?.material ?? null;
}

/** The resource a block is bought and refunded in, or null for system blocks. */
export function costResourceOf(id) {
  const cost = BLOCKS_BY_ID.get(id)?.cost;
  return cost ? Object.keys(cost)[0] : null;
}
