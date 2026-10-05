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
import { CROPS, RIPE, cropBaseOf } from './crops.js';

/** Flowing water of level L is block FLOW_BASE + L, for L in 1..7. */
const FLOW_BASE = 49;
/** Flowing lava of level L is block LAVA_FLOW_BASE + L, for L in 1..3. */
const LAVA_FLOW_BASE = 115;
export const LAVA = 45;

export const BLOCKS = [
  { id: 1, name: 'Grass', glyph: 'grass', color: 0x7fc254, soil: true, material: 'dirt', cost: { wood: 1 }, unlock: null },
  { id: 2, name: 'Dirt', glyph: 'dirt', color: 0x9c6e48, soil: true, material: 'dirt', cost: { wood: 1 }, unlock: null },
  { id: 3, name: 'Stone', glyph: 'stone', color: 0x9d9b97, material: 'stone', cost: { stone: 1 }, unlock: null },
  { id: 4, name: 'Wood', glyph: 'log', color: 0x7d5a3a, material: 'wood', cost: { wood: 2 }, unlock: null },
  // Opaque on purpose. At 0.9 the transparency was invisible, but it put every
  // tree in the game into the depth-write-disabled transparent pass, which the
  // renderer re-sorts on every camera move — the shimmer you saw walking
  // through a forest. Opaque leaves also merge into the single opaque draw call.
  { id: 5, name: 'Leaves', glyph: 'leaf', color: 0x5dab45, material: 'plant', cost: { wood: 1 }, unlock: null },
  { id: 6, name: 'Sand', glyph: 'sand', color: 0xe4cf92, material: 'dirt', cost: { wood: 1 }, unlock: null },
  { id: 7, name: 'Planks', glyph: 'planks', color: 0xc49360, material: 'wood', cost: { wood: 1 }, unlock: null },
  { id: 8, name: 'Cobblestone', glyph: 'cobble', color: 0xa1a1aa, material: 'stone', cost: { stone: 1 }, unlock: null },
  { id: 9, name: 'Brick', glyph: 'brick', color: 0xb5583f, material: 'stone', cost: { brick: 1 }, unlock: null },
  { id: 10, name: 'Glass', glyph: 'pane', color: 0xc2e5f2, transparent: true, opacity: 0.35, cost: { glass: 1 }, unlock: null },
  // Thin enough to read as water over a sandy bed, but not so thin that the
  // sand shows through and turns the rivers grey, which is what 0.6 did.
  { id: 11, name: 'Water', glyph: 'water', color: 0x4f97d8, transparent: true, opacity: 0.78, cost: { wood: 3 }, unlock: null },
  // Requested directly: "Snow should be white." The old 0xceddec read as a
  // pale lavender-blue next to Glass and Water rather than snow.
  { id: 12, name: 'Snow', glyph: 'snow', color: 0xf4f8fb, cost: { wood: 1 }, unlock: { type: 'level', value: 3 } },
  { id: 13, name: 'Gold Block', glyph: 'gold', color: 0xeec43e, material: 'stone', cost: { gold: 1 }, unlock: { type: 'level', value: 6 } },
  { id: 14, name: 'Obsidian', glyph: 'obsidian', color: 0x2b163f, material: 'stone', cost: { stone: 4 }, unlock: { type: 'achievement', value: 'underground' } },
  { id: 15, name: 'Red Glass', glyph: 'pane', color: 0xe86a62, transparent: true, opacity: 0.45, cost: { glass: 2 }, unlock: { type: 'level', value: 4 } },
  { id: 16, name: 'Blue Glass', glyph: 'pane', color: 0x6a92e6, transparent: true, opacity: 0.45, cost: { glass: 2 }, unlock: { type: 'level', value: 4 } },
  { id: 17, name: 'Marble', glyph: 'marble', color: 0xece4d3, material: 'stone', cost: { stone: 3 }, unlock: { type: 'achievement', value: 'architect' } },
  { id: 18, name: 'Amethyst', glyph: 'crystal', color: 0xa77de2, transparent: true, opacity: 0.55, cost: { gold: 2 }, unlock: { type: 'level', value: 8 } },
  { id: 19, name: 'Ground', color: 0x7fc254, system: true },
  // Duilt blocks. Saplings grow into forests; farmland is soil that has been
  // turned, which is what a farm is actually made of.
  { id: 20, name: 'Sapling', glyph: 'sprout', color: 0x6fbf4a, shape: 'sapling', material: 'plant', cost: { wood: 1 }, unlock: null },
  // Dark, turned earth in furrows — requested directly: "Farm should be
  // dirt." It used to be a pale tan you could take for sand.
  { id: 21, name: 'Farmland', glyph: 'farmland', color: 0x6a4529, material: 'dirt', cost: { wood: 1 }, unlock: null },
  // Ground the biomes are made of. Six kinds of country used to share four
  // top blocks between them, so a meadow, a forest, the highlands and a
  // wetland were all the same green: you could walk from one to another and
  // the only thing that changed was how many trees there were. These are what
  // let each one have its own floor.
  { id: 22, name: 'Moss', glyph: 'moss', color: 0x6ea844, soil: true, material: 'dirt', unlock: null },
  { id: 23, name: 'Gravel', glyph: 'gravel', color: 0x98928a, material: 'stone', unlock: null },
  // Warm earthen clay, the kind bricks are fired from. It was a pale blue
  // (Minecraft's), which read as "weird blue blocks that I don't recognise".
  { id: 24, name: 'Clay', glyph: 'clay', color: 0xb39882, soil: true, material: 'dirt', unlock: null },
  // The ocean's own floor — everything else underwater already borrowed Sand
  // (see ChunkGen's RIVERBED), which is fine for a riverbed but wrong once a
  // whole biome is the seabed: Sand is the Sands biome's own top block, and
  // sharing it would be the exact "two biomes read as one" problem the rest
  // of this file exists to avoid.
  { id: 25, name: 'Silt', glyph: 'clay', color: 0x84927a, material: 'dirt', unlock: null },

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
  { id: 27, name: 'Stone Slab', glyph: 'slab', color: 0x9d9b97, shape: 'slab', material: 'stone', cost: { stone: 1 }, unlock: null },
  { id: 28, name: 'Plank Slab', glyph: 'slab', color: 0xc49360, shape: 'slab', material: 'wood', cost: { wood: 1 }, unlock: null },
  { id: 29, name: 'Stone Stairs', glyph: 'stair', color: 0x9d9b97, shape: 'stair', material: 'stone', cost: { stone: 1 }, unlock: null },
  { id: 30, name: 'Plank Stairs', glyph: 'stair', color: 0xc49360, shape: 'stair', material: 'wood', cost: { wood: 1 }, unlock: null },

  // Furniture: a shape shared across recoloured variants, the same pattern
  // Glass/Red Glass/Blue Glass above already uses — a distinct 3D prop shape
  // (see PropRenderer) that comes in more than one finish.
  { id: 31, name: 'Oak Table', glyph: 'table', color: 0xc49360, shape: 'table', material: 'wood', cost: { wood: 4 }, unlock: null },
  { id: 32, name: 'Marble Table', glyph: 'table', color: 0xece4d3, shape: 'table', material: 'stone', cost: { stone: 3 }, unlock: null },
  { id: 33, name: 'Oak Chair', glyph: 'chair', color: 0xc49360, shape: 'chair', material: 'wood', cost: { wood: 3 }, unlock: null },
  { id: 34, name: 'Red Chair', glyph: 'chair', color: 0xb5503c, shape: 'chair', material: 'wood', cost: { wood: 3 }, unlock: null },
  { id: 35, name: 'Red Rug', glyph: 'rug', color: 0xb8443a, shape: 'rug', material: 'plant', cost: { wood: 1 }, unlock: null },
  { id: 36, name: 'Blue Rug', glyph: 'rug', color: 0x4f74c4, shape: 'rug', material: 'plant', cost: { wood: 1 }, unlock: null },
  { id: 37, name: 'Green Rug', glyph: 'rug', color: 0x4f9a40, shape: 'rug', material: 'plant', cost: { wood: 1 }, unlock: null },

  // Ore. Embedded in the rock of the Summit biome only (see ChunkGen.oreAt) —
  // a vein you find, not a block anyone places, the same way Moss or Clay are
  // natural ground with an item behind them but no cost to place. `gravel`'s
  // speckled mark already reads as flecks in rock; gold ore borrows the
  // existing gold mark instead, so it reads as kin to Gold Block without
  // being the same colour — ore is duller, unrefined, still in the stone.
  { id: 38, name: 'Iron Ore', glyph: 'gravel', color: 0xa69a92, material: 'stone', unlock: null },
  { id: 39, name: 'Copper Ore', glyph: 'gravel', color: 0xa39684, material: 'stone', unlock: null },
  { id: 40, name: 'Gold Ore', glyph: 'gold', color: 0xaaa088, material: 'stone', unlock: null },

  // Two more trees, requested directly so the forest reads as more than one
  // kind of wood: a pale trunk and canopy for a birch-like grove, and a
  // deep, dark pairing for a denser one. Same `cost`/`unlock` shape as the
  // original Wood/Leaves so they behave identically once cut and carried.
  { id: 41, name: 'White Wood', glyph: 'log', color: 0xe4dfd4, material: 'wood', cost: { wood: 2 }, unlock: null },
  { id: 42, name: 'White Leaves', glyph: 'leaf', color: 0xc6dc80, material: 'plant', cost: { wood: 1 }, unlock: null },
  { id: 43, name: 'Dark Wood', glyph: 'log', color: 0x553826, material: 'wood', cost: { wood: 2 }, unlock: null },
  { id: 44, name: 'Dark Leaves', glyph: 'leaf', color: 0x2f6a3a, material: 'plant', cost: { wood: 1 }, unlock: null },

  // Found in the deep caverns under the tall mountains, never placed from a
  // recipe — the same natural-only shape the three ores above already use.
  // Lights itself the way a Lantern does (see LightManager) rather than
  // needing its own render special-case.
  {
    id: 45, name: 'Lava', glyph: 'water', color: 0xf26a18,
    light: { color: 0xff8040, intensity: 5, distance: 14, decay: 1 },
    material: 'stone', unlock: null,
  },

  // The Dark Forest's own floor — reusing Moss would leave two of the three
  // new forests reading as the exact same ground, in world and on the map
  // alike (caught by mapdraw.test.mjs's own "no two biomes share a colour"
  // check). A deeper, shadier green than ordinary Moss, the way a canopy
  // thick enough to earn "dark" in its name would actually shade its floor.
  { id: 46, name: 'Dark Moss', glyph: 'moss', color: 0x47683a, soil: true, material: 'dirt', unlock: null },
  // The Giant Grove's floor: a deep bed of fallen leaves under trees too big
  // to let much grass grow. Its own ground so the grove reads as somewhere
  // else underfoot and on the map (every biome has its own top block).
  { id: 147, name: 'Forest Floor', glyph: 'litter', color: 0x7a643a, soil: true, material: 'dirt', unlock: null },

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
  { id: 47, name: 'Fence', glyph: 'fence', color: 0xb3844f, shape: 'fence', material: 'wood', cost: { wood: 1 }, unlock: null },
  { id: 48, name: 'Gate', glyph: 'gate', color: 0x9a6c40, shape: 'gate', material: 'wood', cost: { wood: 2 }, unlock: null },
  { id: 49, name: 'Open Gate', glyph: 'gate', color: 0x9a6c40, shape: 'gate_open', material: 'wood', stateOf: 48, unlock: null },

  // Flowing water, one block per level: 7 right beside a source (or falling
  // straight down), 1 at the thin end of a spill. Water (11) is the still
  // source every river, lake and sea is made of; these are what runs off it
  // once something opens a way — see world/WaterFlow.js. Drawn lower the
  // weaker they are (ChunkMesher.emitFlowingWater), walked and swum through
  // like any water, and never placed or carried on their own.
  ...[1, 2, 3, 4, 5, 6, 7].map((level) => ({
    id: FLOW_BASE + level, name: 'Flowing Water', glyph: 'water', color: 0x4f97d8, transparent: true, opacity: 0.78,
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
    id: LAVA_FLOW_BASE + level, name: 'Flowing Lava', glyph: 'water', color: 0xf26a18,
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

  { id: 69, name: 'Door', glyph: 'door', color: 0xa5763f, shape: 'door', material: 'wood', cost: { wood: 3 }, facing: 0, unlock: null },
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
  { key: 'brick', name: 'Brick Roof Tiles', color: 0xb04c34, wall: 9 },
  { key: 'stone', name: 'Stone Roof Tiles', color: 0x5b6577, wall: 8 },
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
CROPS.forEach((c) => {
  const base = cropBaseOf(c);
  for (let stage = 0; stage <= RIPE; stage++) {
    BLOCKS.push({
      id: base + stage, name: stage === RIPE ? `Ripe ${c.name}` : `${c.name} Plant`,
      glyph: 'sprout', color: c.leaf, shape: `crop_${c.kind}_${stage}`, material: 'plant',
      crop: { kind: c.kind, stage }, ...(stage ? { stateOf: base } : {}), unlock: null,
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

// A catapult (Phase 6c): a small siege engine on wheels. Place mans it; you
// aim by looking where you want the stone to come down, and Break throws.
// It turns to face the way it's thrown; its other facings are states of it.
export const CATAPULT = 152;
BLOCKS.push({ id: CATAPULT, name: 'Catapult', glyph: 'catapult', color: 0x8a6440, shape: 'catapult', material: 'wood', cost: { planks: 10 }, facing: 0, catapult: true, unlock: null });
for (let f = 1; f <= 3; f++) {
  BLOCKS.push({ ...BLOCKS.find((b) => b.id === CATAPULT), id: CATAPULT + f, stateOf: CATAPULT, facing: f, cost: undefined });
}
/** Whether a block is a catapult, whichever way it faces. */
export function isCatapult(id) {
  return id >= CATAPULT && id <= CATAPULT + 3;
}

// ---- Phase 7a: the decorative pack ------------------------------------------
//
// What the two kingdoms are built from, and what makes a house more than a
// box: dark stone and dark brick for the Stone Kingdom; sky-marble, gold
// trim and firefly lanterns for the Sky Kingdom; and, for anyone, walls that
// join like fences, pillars that grow a base and a capital, trapdoors,
// framed windows, timber framing, vases, urns and banners.
export const DARK_STONE = 156;
export const DARK_BRICK = 157;
export const SKY_MARBLE = 158;
BLOCKS.push(
  { id: DARK_STONE, name: 'Dark Stone', glyph: 'stone', color: 0x4e5666, material: 'stone', unlock: null },
  { id: DARK_BRICK, name: 'Dark Brick', glyph: 'brick', color: 0x58322a, material: 'stone', unlock: null },
  { id: SKY_MARBLE, name: 'Sky Marble', glyph: 'marble', color: 0xeaf0fa, material: 'stone', unlock: null },
  { id: 159, name: 'Gold Trim', glyph: 'trim', color: 0xecc040, material: 'stone', unlock: null },
  // Plaster between dark oak beams — the beams are painted into the
  // texture (see textures.js `timber`), so it lays like any block.
  { id: 160, name: 'Timber Frame', glyph: 'timber', color: 0xf2e8d2, material: 'wood', unlock: null },
);

// Walls: a thick, low stone fence. They join each other, fences, gates and
// solid blocks, with a post wherever the run turns, ends or meets another
// (see propShapes' wallBoxes); like a fence, nothing climbs over one.
export const WALLS = [
  { id: 161, name: 'Cobblestone Wall', color: 0xa1a1aa },
  { id: 162, name: 'Stone Wall', color: 0x9d9b97 },
  { id: 163, name: 'Brick Wall', color: 0xb5583f },
  { id: 164, name: 'Dark Stone Wall', color: 0x4e5666 },
];
for (const w of WALLS) BLOCKS.push({ ...w, glyph: 'wall', shape: 'wall', material: 'stone', unlock: null });

// Pillars: stacked, they read as one column — a base at the bottom, a
// capital at the top and plain shaft between (see ChunkMesher, which looks
// above and below each one).
export const PILLARS = [
  { id: 165, name: 'Stone Pillar', color: 0xb8b4ac },
  { id: 166, name: 'Marble Pillar', color: 0xece4d3 },
  { id: 167, name: 'Dark Pillar', color: 0x4e5666 },
];
for (const c of PILLARS) BLOCKS.push({ ...c, glyph: 'pillar', shape: 'pillar', material: 'stone', unlock: null });

// The rest face a way, four ids each: the one you hold is facing 0, the
// others are states of it. `quad` is the first of the four, which is all
// `turned` needs.
function quad(base, spec) {
  BLOCKS.push({ ...spec, id: base, facing: 0, quad: base });
  for (let f = 1; f <= 3; f++) BLOCKS.push({ ...spec, id: base + f, facing: f, quad: base, stateOf: spec.stateOf ?? base, cost: undefined });
}
// A trapdoor: shut it's a floor you stand on, high in its cell; Place
// swings it up against the side its hinges are on (see Game.toggleGate).
export const TRAPDOOR = 168;
export const TRAPDOOR_OPEN = 172;
quad(TRAPDOOR, { name: 'Trapdoor', glyph: 'trapdoor', color: 0xa5763f, shape: 'trapdoor', material: 'wood', unlock: null });
quad(TRAPDOOR_OPEN, { name: 'Open Trapdoor', glyph: 'trapdoor', color: 0xa5763f, shape: 'trapdoor_open', material: 'wood', stateOf: TRAPDOOR, unlock: null });
// A window in a wooden frame with crossbars, glazed — the glass is drawn
// see-through (ChunkMesher's pane material).
quad(176, { name: 'Framed Window', glyph: 'window', color: 0x9a7350, shape: 'window', unlock: null });
BLOCKS.push(
  { id: 180, name: 'Vase', glyph: 'vase', color: 0xc9825c, shape: 'vase', material: 'stone', unlock: null },
  { id: 181, name: 'Urn', glyph: 'urn', color: 0xb08d57, shape: 'urn', material: 'stone', unlock: null },
);
// Banners on a pole: white with a gold sun for the sky, black with a red
// tower for the stone.
quad(182, { name: 'White Banner', glyph: 'banner', color: 0xf4f1ea, shape: 'banner_white', material: 'plant', unlock: null });
quad(186, { name: 'Black Banner', glyph: 'banner', color: 0x2e2a33, shape: 'banner_black', material: 'plant', unlock: null });
// A glass lantern with fireflies in it, for the Sky Kingdom: a cooler,
// greener light than a candle's.
BLOCKS.push({
  id: 190, name: 'Firefly Lantern', glyph: 'lantern', color: 0xd9ec9a, shape: 'firefly', material: 'wood',
  light: { color: 0xd8ff8a, intensity: 4, distance: 16, decay: 1, y: 0.8 }, unlock: null,
});

// The ring ores (Phase 7c), decided with the user: each ring needs an ore
// of its own, "very rare", found "deep in the caves" or in a chest. Rock
// studded with crystals that glow, so one is seen in the dark of a cave
// before it's reached — only ever on a cave wall near the bottom of the
// world (see ChunkGen.ringOreAt). The rock is an ordinary cube, lit like
// the cave round it; `overlay` names the crystals drawn on top of it (see
// ChunkMesher.buildProps), which glow whatever the light.
/**
 * Rock as it lies underground (asked for directly: "There should be different
 * rock types, like grey, white, dark grey, marbled, turquoise, and orangey.
 * Ordered by rarity to find naturally."). Grey is plain Stone and marbled
 * Marble; these are the other four. See ChunkGen's rock
 * layers for where each lies.
 */
export const WHITE_STONE = 235, TURQUOISE_STONE = 236, ORANGE_STONE = 237;
// Dark grey rock — its own natural block. The layer used to be the Stone
// Kingdom's Dark Stone, a slate-blue cut block with mortar lines, which read
// as "weird blue blocks" in the ground (reported directly) and handed out a
// crafted material for nothing.
export const GREY_STONE = 238;
BLOCKS.push(
  { id: WHITE_STONE, name: 'White Stone', glyph: 'stone', color: 0xe4e0d8, material: 'stone', unlock: null },
  { id: TURQUOISE_STONE, name: 'Turquoise Stone', glyph: 'stone', color: 0x63b5ab, material: 'stone', unlock: null },
  { id: ORANGE_STONE, name: 'Orange Stone', glyph: 'stone', color: 0xd38d57, material: 'stone', unlock: null },
  { id: GREY_STONE, name: 'Dark Grey Stone', glyph: 'stone', color: 0x6c6b6a, material: 'stone', unlock: null },
);

export const SUNSTONE_ORE = 191;
export const NIGHTSTONE_ORE = 192;
BLOCKS.push(
  {
    id: SUNSTONE_ORE, name: 'Sunstone Ore', glyph: 'gravel', color: 0x9a9488, overlay: 'sunstone_ore', material: 'stone',
    light: { color: 0xffd98a, intensity: 2.5, distance: 9, decay: 1, y: 0.5 }, unlock: null,
  },
  {
    id: NIGHTSTONE_ORE, name: 'Nightstone Ore', glyph: 'gravel', color: 0x403a4c, overlay: 'nightstone_ore', material: 'stone',
    light: { color: 0xa77bff, intensity: 2.5, distance: 9, decay: 1, y: 0.5 }, unlock: null,
  },
);

// A bed (playtest, P1): two blocks long, put down the way you face — the
// foot where you aimed, the head beyond it. Like a door's two halves, the
// head is a state of the foot and goes with it (Game.withBedHalves).
export const BED = 193;
export const BED_HEAD = 197;
quad(BED, { name: 'Bed', glyph: 'bed', color: 0xb84a3e, shape: 'bed_foot', material: 'wood', unlock: null });
quad(BED_HEAD, { name: 'Bed', glyph: 'bed', color: 0xb84a3e, shape: 'bed_head', material: 'wood', stateOf: BED, part: 'head', unlock: null });
/** { head, facing } for either half of a bed, or null. */
export function bedPart(id) {
  if (id < BED || id > BED_HEAD + 3) return null;
  return { head: id >= BED_HEAD, facing: (id - BED) & 3 };
}
/** Quarter-turn facing to a step: 0 is -z, 1 +x, 2 +z, 3 -x. */
export const FACING_STEP = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// A painting (playtest, P1): hung flat on the wall you face. Place on it
// sets where you wake after you fall (Game.setSpawn).
export const PAINTING = 201;
quad(PAINTING, { name: 'Painting', glyph: 'painting', color: 0x8a6440, shape: 'painting', material: 'wood', unlock: null });
// Calçada portuguesa (playtest, P9): small setts of white and black stone,
// laid in waves. White, dark, and the classic wave of dark through white.
// Asked for directly: "a road block looking like calçada portuguesa".
export const CALCADA = 209, CALCADA_DARK = 210, CALCADA_WAVE = 211;
BLOCKS.push(
  { id: CALCADA, name: 'Calçada', glyph: 'calcada', color: 0xf2eee3, material: 'stone', unlock: null },
  { id: CALCADA_DARK, name: 'Dark Calçada', glyph: 'calcada', color: 0x1d1c20, material: 'stone', unlock: null },
  { id: CALCADA_WAVE, name: 'Calçada Wave', glyph: 'calcada_wave', color: 0xf2eee3, material: 'stone', unlock: null },
);

// The defence buildings' furnishings (White path): a rack of arms for a
// barracks wall, a straw dummy to beat in the yard, and a target to shoot
// at. Each faces you the way a chair does.
export const WEAPON_RACK = 212, TRAINING_DUMMY = 216, ARCHERY_TARGET = 220;
quad(WEAPON_RACK, { name: 'Weapon Rack', glyph: 'rack', color: 0x7a5636, shape: 'weapon_rack', material: 'wood', unlock: null });
quad(TRAINING_DUMMY, { name: 'Training Dummy', glyph: 'dummy', color: 0xd9b866, shape: 'training_dummy', material: 'plant', unlock: null });
quad(ARCHERY_TARGET, { name: 'Archery Target', glyph: 'target', color: 0xe9e2cf, shape: 'archery_target', material: 'wood', unlock: null });

// The dark path's camp: a war tent you pitch on the march — where you wake,
// and where the army rallies — and a campfire to cook their rations on.
export const WAR_TENT = 224, CAMPFIRE = 228;
quad(WAR_TENT, { name: 'War Tent', glyph: 'tent', color: 0x6b5a48, shape: 'war_tent', material: 'plant', unlock: null });
BLOCKS.push({
  id: CAMPFIRE, name: 'Campfire', glyph: 'campfire', color: 0x6b4a2e, shape: 'campfire', material: 'wood',
  light: { color: 0xffa04a, intensity: 4, distance: 14, decay: 1, y: 0.4 }, unlock: null,
});
// Two blocks long (backlog batch 2): the front, with its flap, where you
// aim, and the back behind it — a state of the front, like a bed's head.
export const WAR_TENT_BACK = 231;
quad(WAR_TENT_BACK, { name: 'War Tent', glyph: 'tent', color: 0x6b5a48, shape: 'war_tent_back', material: 'plant', stateOf: WAR_TENT, part: 'back', unlock: null });
export function isTent(id) {
  return (id >= WAR_TENT && id <= WAR_TENT + 3) || (id >= WAR_TENT_BACK && id <= WAR_TENT_BACK + 3);
}

/**
 * The things that are one thing in two blocks, side by side: a bed (its
 * head the way it faces from the foot) and a war tent (its back the other
 * way from the flap). `step` is which way the second half lies from the
 * first along the facing: +1 ahead, -1 behind.
 */
export const PAIRS = [
  { base: BED, second: BED_HEAD, step: 1, name: 'bed' },
  { base: WAR_TENT, second: WAR_TENT_BACK, step: -1, name: 'tent' },
];
/** { pair, second, facing } for either half of a two-block thing, or null. */
export function pairPart(id) {
  for (const pair of PAIRS) {
    if (id >= pair.base && id <= pair.base + 3) return { pair, second: false, facing: (id - pair.base) & 3 };
    if (id >= pair.second && id <= pair.second + 3) return { pair, second: true, facing: (id - pair.second) & 3 };
  }
  return null;
}
/** Where the other half of a two-block thing is, from this half at (x, z). */
export function pairOther(part, x, z) {
  const [sx, sz] = FACING_STEP[part.facing];
  const k = part.pair.step * (part.second ? -1 : 1);
  return { x: x + sx * k, z: z + sz * k };
}

// The Sky Kingdom's (the dark path): the great chains it hangs on, running
// down to its anchor towers, and the lift at the top of each tower that
// winds you up a chain to the island — and back down.
export const CHAIN = 229, SKY_LIFT = 230;
BLOCKS.push(
  { id: CHAIN, name: 'Chain', glyph: 'chain', color: 0x5a5f66, shape: 'chain', material: 'stone', unlock: null },
  { id: SKY_LIFT, name: 'Sky Lift', glyph: 'lift', color: 0xe2c26a, shape: 'sky_lift', material: 'wood', unlock: null },
);

export function isPainting(id) {
  return id >= PAINTING && id <= PAINTING + 3;
}

/** Whether a block is a trapdoor, open or shut, whichever way it faces. */
export function isTrapdoor(id) {
  return id >= TRAPDOOR && id <= TRAPDOOR_OPEN + 3;
}
/** The same trapdoor swung the other way. */
export function swungTrapdoor(id) {
  return id < TRAPDOOR_OPEN ? id + 4 : id - 4;
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
  if (isCatapult(id)) return CATAPULT + facing;
  if (b.quad != null) return b.quad + facing;
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
