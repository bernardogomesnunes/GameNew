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
import { CROPS, CROP_BASE, RIPE } from './crops.js';

/** Flowing water of level L is block FLOW_BASE + L, for L in 1..7. */
const FLOW_BASE = 49;
/** Flowing lava of level L is block LAVA_FLOW_BASE + L, for L in 1..3. */
const LAVA_FLOW_BASE = 115;
export const LAVA = 45;

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
  // Dark, turned earth in furrows — requested directly: "Farm should be
  // dirt." It used to be a pale tan you could take for sand.
  { id: 21, name: 'Farmland', glyph: 'farmland', color: 0x8d6645, material: 'dirt', cost: { wood: 1 }, unlock: null },
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
    // Reported directly: "the lantern is super weird, we should follow the
    // same modelation that we have for other items, and light is coming from
    // the bottom of the block." It was a plain glowing cube with its light
    // buried inside it; now it's a real lantern (see propShapes), lit from
    // its glass. `y` is where in the cell the light sits.
    // Reported directly: the light "should not be such a circle in the
    // centre, it should be blurred and luminosity should reach a bit further
    // ... and should go from more light to less light." So it falls off with
    // distance rather than distance squared (`decay` 1), gently, over some
    // twenty blocks, and shines from just above the lantern (`y` over 1)
    // rather than from inside it on the floor — right under a light an inch
    // off the ground is where the white disc came from.
    light: { color: 0xffcf8c, intensity: 5, distance: 20, decay: 1, y: 1.1 },
    shape: 'lantern',
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
    light: { color: 0xff8040, intensity: 5, distance: 14, decay: 1 },
    material: 'stone', unlock: null,
  },

  // The Dark Forest's own floor — reusing Moss would leave two of the three
  // new forests reading as the exact same ground, in world and on the map
  // alike (caught by mapdraw.test.mjs's own "no two biomes share a colour"
  // check). A deeper, shadier green than ordinary Moss, the way a canopy
  // thick enough to earn "dark" in its name would actually shade its floor.
  { id: 46, name: 'Dark Moss', glyph: 'moss', color: 0x4a6045, soil: true, material: 'dirt', unlock: null },
  // The Giant Grove's floor: a deep bed of fallen leaves under trees too big
  // to let much grass grow. Its own ground so the grove reads as somewhere
  // else underfoot and on the map (every biome has its own top block).
  { id: 147, name: 'Forest Floor', glyph: 'litter', color: 0x8a7a48, soil: true, material: 'dirt', unlock: null },

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
  // Flowing lava, the way flowing water runs off a pool — requested
  // directly: "lava is not fluid like water, it should." Thicker than water:
  // it only runs three blocks from its source, and slowly (see
  // world/WaterFlow.js). Level 3 beside the source or falling, 1 at the end.
  ...[1, 2, 3].map((level) => ({
    id: LAVA_FLOW_BASE + level, name: 'Flowing Lava', glyph: 'water', color: 0xe8672c,
    light: { color: 0xff8040, intensity: 3, distance: 9, decay: 1 },
    shape: 'lava_flow', stateOf: 45, level, material: 'stone', unlock: null,
  })),

  // Hung from the ceiling, not stood on the floor: an iron ring of four
  // candles on a chain, lighting the room from above.
  {
    id: 85, name: 'Chandelier', glyph: 'chandelier', color: 0x5d5552, shape: 'chandelier', material: 'stone',
    // Below its candles, not above them — a light just under the ceiling
    // burns a white patch into it.
    light: { color: 0xffd79a, intensity: 6, distance: 22, decay: 1, y: 0.3 }, cost: { wood: 2 }, unlock: null,
  },

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

// Roof tiles — telhas. Requested directly: "we should have something
// similar [to stairs] but with telhas. roofing can be done with bricks and
// stone." A real slope rather than steps, laid in rows of tiles, in fired
// brick or in slate. Placed by hand it faces the way you look, like a stair
// (and makes corners with its neighbours the same way — see world/slopes.js);
// laid by the Roof tool it also comes as the half-pitch pieces a shallow
// roof needs and the caps that go along a ridge and on a peak. Only the
// first is ever held: the rest are states of it.
//
// `wall` is what fills in under the slope where a roof needs solid courses —
// the ends of a gable — so a brick roof has brick gable ends.
export const ROOF_MATERIALS = [
  { key: 'brick', name: 'Brick Roof Tiles', color: 0xc9765c, wall: 9 },
  { key: 'stone', name: 'Stone Roof Tiles', color: 0x8e93a0, wall: 8 },
];
/** The pieces of one roof material, in the order their ids run. */
const ROOF_KINDS = ['steep', 'steep', 'steep', 'steep', 'lo', 'lo', 'lo', 'lo', 'hi', 'hi', 'hi', 'hi', 'ridge_x', 'ridge_z', 'peak'];
const ROOF_SHAPE = { steep: 'roof', lo: 'roof_lo', hi: 'roof_hi', ridge_x: 'roof_ridge_x', ridge_z: 'roof_ridge_z', peak: 'roof_peak' };
/** Piece i of roof material m is block ROOF_BASE + 15m + i. */
const ROOF_BASE = 86;
ROOF_MATERIALS.forEach((mat, m) => {
  const base = ROOF_BASE + 15 * m;
  ROOF_KINDS.forEach((kind, i) => {
    const turnsWay = i < 12;
    BLOCKS.push({
      id: base + i, name: mat.name, glyph: 'rooftile', color: mat.color, shape: ROOF_SHAPE[kind], material: 'stone',
      roof: { mat: m, kind }, ...(turnsWay ? { facing: i % 4 } : {}),
      ...(i === 0 ? { cost: { stone: 1 } } : { stateOf: base }), unlock: null,
    });
  });
});

// Crops on farmland, a block per stage of growth — see config/crops.js. The
// seed is what you hold; the plant is never placed by hand any other way.
CROPS.forEach((c, k) => {
  for (let stage = 0; stage <= RIPE; stage++) {
    BLOCKS.push({
      id: CROP_BASE + 4 * k + stage, name: stage === RIPE ? `Ripe ${c.name}` : `${c.name} Plant`,
      glyph: 'sprout', color: c.leaf, shape: `crop_${c.kind}_${stage}`, material: 'plant',
      crop: { kind: c.kind, stage }, ...(stage ? { stateOf: CROP_BASE + 4 * k } : {}), unlock: null,
    });
  }
});

// A chest: slots you can open, in a wooden box with iron bands. Phase 6 —
// chosen directly: when you die, "we need to have a chest item, 3d
// modelled, that has slots; when we die the chest appears in place with my
// items". It's also something you make and put down yourself, for storage
// that isn't a whole storehouse. Like a chair it faces you when you put it
// down; its three other facings are states of it.
export const CHEST = 148;
BLOCKS.push({ id: CHEST, name: 'Chest', glyph: 'chest', color: 0x9a6b3f, shape: 'chest', material: 'wood', cost: { planks: 6 }, facing: 0, chest: true, unlock: null });
for (let f = 1; f <= 3; f++) {
  BLOCKS.push({ ...BLOCKS.find((b) => b.id === CHEST), id: CHEST + f, stateOf: CHEST, facing: f, cost: undefined });
}
/** Whether a block is a chest, whichever way it faces. */
export function isChest(id) {
  return id >= CHEST && id <= CHEST + 3;
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
// A crop is planted from its seeds, not picked from the blocks.
export const PLACEABLE_BLOCKS = BLOCKS.filter((b) => !b.system && b.stateOf == null && !b.crop);

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

/** Any lava: a source, or flowing. */
export function isLava(id) {
  return id === LAVA || (id > LAVA_FLOW_BASE && id <= LAVA_FLOW_BASE + 3);
}

/** Flowing lava only. */
export function isLavaFlow(id) {
  return id > LAVA_FLOW_BASE && id <= LAVA_FLOW_BASE + 3;
}

/** How strong a cell of lava is: 4 for a source, 1..3 flowing, 0 if it isn't lava. */
export function lavaLevel(id) {
  if (id === LAVA) return 4;
  return isLavaFlow(id) ? id - LAVA_FLOW_BASE : 0;
}

/** The block for flowing lava of a level, 1..3. */
export function flowingLava(level) {
  return LAVA_FLOW_BASE + level;
}

/** Anything you wade or swim through rather than stand on: water or lava. */
export function isFluid(id) {
  return isWater(id) || isLava(id);
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
  const roof = roofPart(id);
  if (roof) return roofBlock({ ...roof, facing });
  const door = doorPart(id);
  if (door) return doorBlock({ ...door, facing });
  if (isChest(id)) return CHEST + facing;
  const baseId = b.stateOf ?? id;
  const k = TURNS.indexOf(baseId);
  return facing === 0 ? baseId : TURN_BASE + 3 * k + facing;
}

/**
 * A block as it looks in a mirror. Requested directly: the symmetry tool
 * copied stairs, doors and roofs without turning them, so the mirrored half
 * of a building had its stairs climbing and its roofs sloping the wrong way.
 * Facing counts quarter-turns from -z (0, +x 1, +z 2, -x 3): a mirror
 * across x swaps +x and -x, one across z swaps -z and +z. Anything that
 * doesn't face a way is its own reflection.
 */
export function mirrored(id, { flipX = false, flipZ = false } = {}) {
  if (!turns(id) || (!flipX && !flipZ)) return id;
  let f = facingOf(id);
  if (flipX && (f & 1)) f ^= 2;
  if (flipZ && !(f & 1)) f ^= 2;
  return turned(id, f);
}

/** { mat, kind, facing } for any roof tile, or null. `kind` is steep, lo, hi, ridge_x, ridge_z or peak. */
export function roofPart(id) {
  const r = BLOCKS_BY_ID.get(id)?.roof;
  return r ? { mat: r.mat, kind: r.kind, facing: BLOCKS_BY_ID.get(id).facing ?? 0 } : null;
}

/** The block for a roof piece. */
export function roofBlock({ mat = 0, kind = 'steep', facing = 0 }) {
  const base = ROOF_BASE + 15 * mat;
  if (kind === 'ridge_x') return base + 12;
  if (kind === 'ridge_z') return base + 13;
  if (kind === 'peak') return base + 14;
  return base + { steep: 0, lo: 4, hi: 8 }[kind] + (facing & 3);
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
