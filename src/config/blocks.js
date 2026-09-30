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
/** Flowing water of level L is block FLOW_BASE + L, for L in 1..7. */
const FLOW_BASE = 49;

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
  // Requested directly: "Snow should be white." The old 0xceddec read as a
  // pale lavender-blue next to Glass and Water rather than snow.
  { id: 12, name: 'Snow', glyph: 'snow', color: 0xf5f7f8, cost: { wood: 1 }, unlock: { type: 'level', value: 3 } },
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
  // Stairs are three steps with the back filled to the top, so a flight of
  // them has no gap between one block and the next; their hitbox is the
  // whole cell, flagged as a stair so you walk straight up it. They face the
  // way you placed them — see TURNS below.
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

  // Two more trees, requested directly so the forest reads as more than one
  // kind of wood: a pale trunk and canopy for a birch-like grove, and a
  // deep, dark pairing for a denser one. Same `cost`/`unlock` shape as the
  // original Wood/Leaves so they behave identically once cut and carried.
  { id: 41, name: 'White Wood', glyph: 'log', color: 0xe8e0d0, material: 'wood', cost: { wood: 2 }, unlock: null },
  { id: 42, name: 'White Leaves', glyph: 'leaf', color: 0xd7e3ab, material: 'plant', cost: { wood: 1 }, unlock: null },
  { id: 43, name: 'Dark Wood', glyph: 'log', color: 0x6b4a3a, material: 'wood', cost: { wood: 2 }, unlock: null },
  { id: 44, name: 'Dark Leaves', glyph: 'leaf', color: 0x4a7a52, material: 'plant', cost: { wood: 1 }, unlock: null },

  // Found in the deep caverns under the tall mountains, never placed from a
  // recipe — the same natural-only shape the three ores above already use.
  // Lights itself the way a Lantern does (see LightManager) rather than
  // needing its own render special-case.
  {
    id: 45, name: 'Lava', glyph: 'water', color: 0xe8672c,
    light: { color: 0xff8040, intensity: 20, distance: 10 },
    material: 'stone', unlock: null,
  },

  // The Dark Forest's own floor — reusing Moss would leave two of the three
  // new forests reading as the exact same ground, in world and on the map
  // alike (caught by mapdraw.test.mjs's own "no two biomes share a colour"
  // check). A deeper, shadier green than ordinary Moss, the way a canopy
  // thick enough to earn "dark" in its name would actually shade its floor.
  { id: 46, name: 'Dark Moss', glyph: 'moss', color: 0x4a6045, soil: true, material: 'dirt', unlock: null },

  // Ranching. A fence stands a block and a half tall to anything walking
  // into it (see World.collisionBoxAt) — too high for you to jump or an
  // animal to step — and joins up with the fences and walls beside it. A
  // gate is a piece of fence you can open: pointed at, Place swings it open
  // (block 49, which anyone walks through) or shut again (see
  // Game.toggleGate). Shut is how a pen keeps its animals in.
  //
  // `stateOf` marks a block that is another block in a different state: it
  // has no item or recipe of its own, and breaking it gives back the item of
  // the block it's a state of.
  { id: 47, name: 'Fence', glyph: 'fence', color: 0xc9a67c, shape: 'fence', material: 'wood', cost: { wood: 1 }, unlock: null },
  { id: 48, name: 'Gate', glyph: 'gate', color: 0xa9825a, shape: 'gate', material: 'wood', cost: { wood: 2 }, unlock: null },
  { id: 49, name: 'Open Gate', glyph: 'gate', color: 0xa9825a, shape: 'gate_open', material: 'wood', stateOf: 48, unlock: null },

  // Flowing water, one block per level: 7 right beside a source (or falling
  // straight down), 1 at the thin end of a spill. Water (11) is the still
  // source every river, lake and sea is made of; these are what runs off it
  // once something opens a way — see world/WaterFlow.js. Drawn lower the
  // weaker they are (ChunkMesher.emitFlowingWater), walked and swum through
  // like any water, and never placed or carried on their own.
  ...[1, 2, 3, 4, 5, 6, 7].map((level) => ({
    id: FLOW_BASE + level, name: 'Flowing Water', glyph: 'water', color: 0x83add7, transparent: true, opacity: 0.78,
    shape: 'water_flow', stateOf: 11, level, unlock: null,
  })),

  // A door: two blocks tall, placed as one. The bottom half is the item; the
  // top half comes with it, has no item of its own (`part: 'top'`), and goes
  // when the bottom does. Place, pointed at either half, swings both open or
  // shut (Game.toggleGate) — shut is solid, open anyone walks through. Every
  // part comes in four facings, generated below.
  { id: 69, name: 'Door', glyph: 'door', color: 0xb08a60, shape: 'door', material: 'wood', cost: { wood: 3 }, facing: 0, unlock: null },
];

// Stairs, chairs and doors face a way: the way you were looking when you put
// them down (see Game.placeBlock). Requested directly: "chairs are only
// placed on one direction, would be nice to have them placed in multiple
// directions, same for stairs and doors." The block a player holds is facing
// 0; the other three facings are states of it, each its own block id so the
// chunk data stays one byte a cell. `facing` counts quarter-turns — see
// propShapes' `turn`.
const TURNS = [29, 30, 33, 34];
/** Facing f (1..3) of TURNS[k] is block TURN_BASE + 3k + f. */
const TURN_BASE = 56;
for (const [k, baseId] of TURNS.entries()) {
  const base = BLOCKS.find((b) => b.id === baseId);
  base.facing = 0;
  for (let f = 1; f <= 3; f++) {
    BLOCKS.push({ ...base, id: TURN_BASE + 3 * k + f, stateOf: baseId, facing: f, cost: undefined });
  }
}

/** Door part (open?, top?, facing) is block DOOR_BASE + 8·open + 4·top + facing. */
const DOOR_BASE = 69;
{
  const door = BLOCKS.find((b) => b.id === DOOR_BASE);
  for (let i = 1; i < 16; i++) {
    const open = i >= 8, top = (i & 4) !== 0, facing = i & 3;
    BLOCKS.push({
      ...door, id: DOOR_BASE + i, stateOf: DOOR_BASE, facing, cost: undefined,
      name: open ? 'Open Door' : 'Door',
      shape: `door${open ? '_open' : ''}${top ? '_top' : ''}`,
      ...(top ? { part: 'top' } : {}),
    });
  }
}

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
// A state of another block (an open gate) isn't placed on its own: you place
// the gate, then open it.
export const PLACEABLE_BLOCKS = BLOCKS.filter((b) => !b.system && b.stateOf == null);

/** Any water at all: a still source, or flowing. */
export function isWater(id) {
  return id === 11 || (id > FLOW_BASE && id <= FLOW_BASE + 7);
}

/** Flowing water only — not the still source it runs from. */
export function isFlowing(id) {
  return id > FLOW_BASE && id <= FLOW_BASE + 7;
}

/** How strong a cell of water is: 8 for a source, 1..7 flowing, 0 if it isn't water. */
export function waterLevel(id) {
  if (id === 11) return 8;
  return isFlowing(id) ? id - FLOW_BASE : 0;
}

/** The block for flowing water of a level, 1..7. */
export function flowingWater(level) {
  return FLOW_BASE + level;
}

/** Quarter-turns a block is placed at: 0..3, 0 for anything that doesn't turn. */
export function facingOf(id) {
  return BLOCKS_BY_ID.get(id)?.facing ?? 0;
}

/** Whether a block is put down facing the way you look. */
export function turns(id) {
  return BLOCKS_BY_ID.get(id)?.facing != null;
}

/** A turning block at another facing: the same block (or door part), turned. */
export function turned(id, facing) {
  const b = BLOCKS_BY_ID.get(id);
  if (!b || b.facing == null) return id;
  facing &= 3;
  const door = doorPart(id);
  if (door) return doorBlock({ ...door, facing });
  const baseId = b.stateOf ?? id;
  const k = TURNS.indexOf(baseId);
  return facing === 0 ? baseId : TURN_BASE + 3 * k + facing;
}

/** { open, top, facing } for any half of a door, or null. */
export function doorPart(id) {
  if (id < DOOR_BASE || id > DOOR_BASE + 15) return null;
  const i = id - DOOR_BASE;
  return { open: i >= 8, top: (i & 4) !== 0, facing: i & 3 };
}

/** The block for a door part. */
export function doorBlock({ open = false, top = false, facing = 0 }) {
  return DOOR_BASE + (open ? 8 : 0) + (top ? 4 : 0) + (facing & 3);
}

export function isTransparent(id) {
  const b = BLOCKS_BY_ID.get(id);
  return !!(b && b.transparent);
}

export function isSystemBlock(id) {
  return !!BLOCKS_BY_ID.get(id)?.system;
}

/** 'cube' unless the block registered a real shape (slab, stair, table, chair, rug, door...). */
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
