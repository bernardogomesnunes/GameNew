/**
 * One ready-made design per building type.
 *
 * These are the second route in from the notebook: build it yourself and claim
 * it, or take a design that was made to pass. They earn their place twice over
 * — as a shortcut for anyone who would rather get on with it, and as a worked
 * example, because stamping the starter farm once makes the rules stop being
 * abstract.
 *
 * Blocks are offsets from the design's corner, so a design drops straight into
 * the same stamping path saved templates already use.
 */

import { ITEM_FOR_BLOCK } from './items.js';
import { doorBlock, roofBlock } from './blocks.js';
import { ROOFS_BY_ID } from './roofs.js';
import { roofBlocks, roofTypeFor } from '../tools/RoofTool.js';

const DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, PLANKS = 7, COBBLE = 8,
      BRICK = 9, GOLD = 13, MARBLE = 17, SAPLING = 20, FARMLAND = 21, FENCE = 47, GATE = 48;

// Requested directly: "we should revisit improving the templates of the
// buildings, adding a roof and door to every building is minimum." Every
// building you walk into has a door hung in its doorway and a pitched roof
// of tiles over its ceiling — slate on the early ones, since brick doesn't
// exist until the workshop, brick from then on.
const SLATE = roofBlock({ mat: 1 }), TILE = roofBlock({ mat: 0 });

/** A door in a doorway at (dx, dy, dz) — both halves, facing in from -z. */
function door(dx, dy, dz) {
  return [
    { dx, dy, dz, type: doorBlock({ facing: 2 }) },
    { dx, dy: dy + 1, dz, type: doorBlock({ facing: 2, top: true }) },
  ];
}

/**
 * A gable of roof tiles over a w × d footprint whose top is at dy — laid by
 * the Roof tool's own rules (tools/RoofTool.js), so a design's roof is the
 * roof you'd get pointing the tool at it. The ridge runs the long way; the
 * gable ends are filled in the building's own walling.
 */
function gable(x0, z0, w, d, dy, tile, wall) {
  const spans = new Map();
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < d; z++) spans.set(`${x0 + x},${z0 + z}`, { xm: x + 1, xp: w - x, zm: z + 1, zp: d - z });
  }
  return roofBlocks({ spans }, { shape: ROOFS_BY_ID.get('gable'), turn: w > d ? 1 : 0 })
    .map((b) => ({ dx: b.x, dy: dy + b.dy, dz: b.z, type: b.slope ? roofTypeFor(tile, b) : wall }));
}

/** A solid rectangle of one block, at one height. */
function slab(x0, z0, w, d, dy, type) {
  const out = [];
  for (let dx = x0; dx < x0 + w; dx++) for (let dz = z0; dz < z0 + d; dz++) out.push({ dx, dy, dz, type });
  return out;
}

/** The outline of a rectangle — walls without a floor inside them. */
function ring(x0, z0, w, d, dy, type) {
  return slab(x0, z0, w, d, dy, type)
    .filter((b) => b.dx === x0 || b.dx === x0 + w - 1 || b.dz === z0 || b.dz === z0 + d - 1);
}

/** Moves a block list to a corner other than its own — how a compound design is built from smaller pieces. */
function shifted(blocks, dx0, dz0) {
  return blocks.map((b) => ({ ...b, dx: b.dx + dx0, dz: b.dz + dz0 }));
}

/**
 * A walled room with a doorway, which is what most of these are.
 *
 * The doorway matters to more than looks: the shelter test asks for cells with
 * a roof and four walls, and every cell in line with the door has three. A 5×5
 * shell loses six of its eighteen sheltered cells that way and lands exactly on
 * the limit, so these are all a size up from where they look like they should
 * be.
 */
function room({ w, h, wall, floor = null, roof = wall, door: hasDoor = true, tiles = null }) {
  const blocks = [];
  if (floor != null) blocks.push(...slab(0, 0, w, w, 0, floor));
  const base = floor != null ? 1 : 0;
  for (let dy = base; dy < base + h; dy++) blocks.push(...ring(0, 0, w, w, dy, wall));
  blocks.push(...slab(0, 0, w, w, base + h, roof));
  if (tiles != null) blocks.push(...gable(0, 0, w, w, base + h + 1, tiles, wall));
  if (!hasDoor) return blocks;
  const mid = Math.floor(w / 2);
  return [
    ...blocks.filter((b) => !(b.dz === 0 && b.dx === mid && b.dy >= base && b.dy < base + Math.min(2, h))),
    ...(h >= 2 ? door(mid, base, 0) : []),
  ];
}

/** A trunk with a leafy crown, at a local offset. */
function tree(ox, oz, h = 4) {
  const blocks = [];
  for (let y = 0; y < h; y++) blocks.push({ dx: ox, dy: y, dz: oz, type: WOOD });
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = h - 1; dy <= h + 1; dy++) {
        if (dy === h + 1 && (dx !== 0 || dz !== 0)) continue;
        blocks.push({ dx: ox + dx, dy, dz: oz + dz, type: LEAVES });
      }
    }
  }
  return blocks;
}

function farmBlocks() {
  const blocks = [];
  for (let dx = 0; dx < 4; dx++) for (let dz = 0; dz < 4; dz++) blocks.push({ dx, dy: 0, dz, type: FARMLAND });
  return blocks;
}

function forestBlocks() {
  // Four trees on a bed of soil — comfortably past the trunk and canopy counts.
  const blocks = [];
  for (let dx = 0; dx < 8; dx++) for (let dz = 0; dz < 8; dz++) blocks.push({ dx, dy: 0, dz, type: DIRT });
  return [
    ...blocks,
    ...tree(1, 1, 5), ...tree(6, 1, 4), ...tree(1, 6, 4), ...tree(6, 6, 5),
    { dx: 3, dy: 1, dz: 3, type: SAPLING }, { dx: 4, dy: 1, dz: 4, type: SAPLING },
  ];
}

function houseBlocks() {
  // A 5x5 shell, four high, with a doorway punched in one wall.
  const blocks = [];
  for (let dx = 0; dx < 5; dx++) {
    for (let dz = 0; dz < 5; dz++) {
      for (let dy = 0; dy < 4; dy++) {
        const shell = dx === 0 || dx === 4 || dz === 0 || dz === 4 || dy === 0 || dy === 3;
        if (shell) blocks.push({ dx, dy, dz, type: WOOD });
      }
    }
  }
  // The doorway, with its door. A house needs a way in, and the rules only
  // ask that the room above it stays sealed.
  return [
    ...blocks.filter((b) => !(b.dz === 0 && b.dx === 2 && (b.dy === 1 || b.dy === 2))),
    ...door(2, 1, 0),
    ...gable(0, 0, 5, 5, 4, SLATE, WOOD),
  ];
}

/**
 * A cut face of rock, open to the sky.
 *
 * A quarry has to be a hole in something — the rules ask for air inside it as
 * well as stone, so this places a pad and takes a bite out of the top of it.
 */
function quarryBlocks() {
  return [
    ...slab(0, 0, 6, 6, 0, STONE),
    ...slab(0, 0, 6, 6, 1, STONE).filter((b) => b.dx < 1 || b.dx > 3 || b.dz < 1 || b.dz > 3),
  ];
}

/** A stone hearth with a sealed cobble chamber standing on it. */
function kilnBlocks() {
  const blocks = [...slab(0, 0, 5, 5, 0, DIRT)];
  blocks.push(...slab(1, 1, 3, 3, 1, COBBLE));
  blocks.push(...ring(1, 1, 3, 3, 2, COBBLE));
  blocks.push(...ring(1, 1, 3, 3, 3, COBBLE));
  blocks.push(...slab(1, 1, 3, 3, 4, COBBLE));
  return blocks;   // the two cells left at (2,2,2) and (2,2,3) are the chamber
}

/** A taller, thicker-walled kiln — the chamber holds three cells instead of two. */
function foundryBlocks() {
  const blocks = [...slab(0, 0, 5, 5, 0, STONE)];
  blocks.push(...slab(1, 1, 3, 3, 1, STONE));
  blocks.push(...ring(1, 1, 3, 3, 2, STONE));
  blocks.push(...ring(1, 1, 3, 3, 3, STONE));
  blocks.push(...ring(1, 1, 3, 3, 4, STONE));
  blocks.push(...slab(1, 1, 3, 3, 5, STONE));
  return blocks;   // three cells left, at (2,2,2), (2,2,3) and (2,2,4)
}

/** A roofed stall on a laid floor, with the rest of the square left open. */
function marketBlocks() {
  const blocks = [...slab(0, 0, 7, 7, 0, PLANKS)];
  blocks.push(...ring(1, 1, 5, 5, 1, PLANKS));
  blocks.push(...ring(1, 1, 5, 5, 2, PLANKS));
  blocks.push(...slab(1, 1, 5, 5, 3, PLANKS));
  return [
    ...blocks.filter((b) => !(b.dz === 1 && b.dx === 3 && (b.dy === 1 || b.dy === 2))),
    ...door(3, 1, 1),
    ...gable(1, 1, 5, 5, 4, TILE, PLANKS),
  ];
}

/** A working with timber holding the roof up. Aim it deep — the rules check. */
function mineBlocks() {
  const blocks = [...slab(0, 0, 6, 6, 0, STONE)];
  for (const dy of [1, 2]) {
    blocks.push(...ring(0, 0, 6, 6, dy, STONE));
    for (const [dx, dz] of [[1, 1], [4, 1], [1, 4], [4, 4]]) blocks.push({ dx, dy, dz, type: PLANKS });
  }
  return blocks;
}

/**
 * A stepped obelisk. Brick at the base where the bulk is, marble up the shaft,
 * gold at the cap — the rule counts all three, and doing it in marble alone
 * would cost four hundred stone.
 */
function monumentBlocks() {
  const blocks = [...ring(0, 0, 7, 7, 0, BRICK)];
  blocks.push(...ring(1, 1, 5, 5, 1, BRICK));
  blocks.push(...ring(1, 1, 5, 5, 2, BRICK));
  for (const dy of [3, 4, 5]) blocks.push(...slab(2, 2, 3, 3, dy, MARBLE));
  blocks.push({ dx: 3, dy: 6, dz: 3, type: GOLD });
  blocks.push({ dx: 3, dy: 7, dz: 3, type: GOLD });
  return blocks;
}

/** A bigger, better-finished room than a house's — three households' worth. */
function townhouseBlocks() {
  return room({ w: 8, h: 3, wall: PLANKS, floor: STONE, tiles: TILE });
}

/** A room with a brick hearth for a floor — the brick is the hearth the rule asks for. */
function tavernBlocks() {
  return room({ w: 6, h: 2, wall: PLANKS, floor: BRICK, tiles: TILE });
}

/** A stone shell tall enough to watch from, sealed and open to the sky. */
function militaryBlocks() {
  return room({ w: 6, h: 5, wall: STONE });
}

/**
 * A forest, a farm, three houses and a shed, laid out side by side rather
 * than stacked — big enough that the pieces read as their own buildings
 * rather than one room wearing four labels.
 */
function villageBlocks() {
  const house = () => room({ w: 5, h: 2, wall: WOOD, floor: PLANKS, tiles: TILE });
  const shed = () => room({ w: 5, h: 2, wall: PLANKS, floor: PLANKS, tiles: TILE });
  return [
    ...shifted(farmBlocks(), 0, 0),
    ...shifted(forestBlocks(), 0, 5),
    ...shifted(house(), 9, 3),
    ...shifted(house(), 9, 9),
    ...shifted(house(), 15, 3),
    ...shifted(shed(), 15, 9),
  ];
}

export const STARTER_DESIGNS = [
  {
    id: 'starter_forest',
    structure: 'forest',
    name: 'Starter grove',
    size: 8,
    footprint: '8 × 8',
    blocks: forestBlocks(),
  },
  {
    id: 'starter_farm',
    structure: 'farm',
    name: 'Starter plot',
    size: 4,
    footprint: '4 × 4',
    note: 'Place it within 6 blocks of the river.',
    blocks: farmBlocks(),
  },
  {
    id: 'starter_pen',
    structure: 'pen',
    name: 'Paddock',
    size: 6,
    footprint: '6 × 6',
    note: 'Then lead animals in through the gate with vegetables or seeds in your hand.',
    // A ring of fence with a gate in the middle of one side.
    blocks: ring(0, 0, 6, 6, 0, FENCE).map((b) => (b.dx === 2 && b.dz === 0 ? { ...b, type: GATE } : b)),
  },
  {
    id: 'starter_house',
    structure: 'house',
    name: 'Starter cabin',
    size: 5,
    footprint: '5 × 5',
    blocks: houseBlocks(),
  },
  {
    id: 'starter_quarry',
    structure: 'quarry',
    name: 'Starter cut',
    size: 6,
    footprint: '6 × 6',
    note: 'Put it where the sky can see it — not in a cave.',
    blocks: quarryBlocks(),
  },
  {
    id: 'starter_storehouse',
    structure: 'storehouse',
    name: 'Starter shed',
    size: 5,
    footprint: '5 × 5',
    note: 'Put it where you walk past it — your buildings deliver here when your bag is full.',
    blocks: room({ w: 5, h: 2, wall: WOOD, floor: PLANKS, tiles: SLATE }),
  },
  {
    id: 'starter_workshop',
    structure: 'workshop',
    name: 'Starter workshop',
    size: 6,
    footprint: '6 × 6',
    note: 'Stand inside it to use the recipes it unlocks.',
    blocks: room({ w: 6, h: 2, wall: PLANKS, floor: STONE, tiles: TILE }),
  },
  {
    id: 'starter_kiln',
    structure: 'kiln',
    name: 'Starter kiln',
    size: 5,
    footprint: '5 × 5',
    note: 'Needs sand or earth within 6 blocks; the hearth it sits on counts.',
    blocks: kilnBlocks(),
  },
  {
    id: 'starter_market',
    structure: 'market',
    name: 'Starter market',
    size: 7,
    footprint: '7 × 7',
    note: 'Put it among your buildings — it will not count on its own in a field.',
    blocks: marketBlocks(),
  },
  {
    id: 'starter_townhouse',
    structure: 'townhouse',
    name: 'Starter townhouse',
    size: 8,
    footprint: '8 × 8',
    blocks: townhouseBlocks(),
  },
  {
    id: 'starter_tavern',
    structure: 'tavern',
    name: 'Starter tavern',
    size: 6,
    footprint: '6 × 6',
    note: 'Put it among your buildings — it will not count on its own in a field.',
    blocks: tavernBlocks(),
  },
  {
    id: 'starter_foundry',
    structure: 'foundry',
    name: 'Starter foundry',
    size: 5,
    footprint: '5 × 5',
    note: 'Put it among your buildings, near the workbench you already visit.',
    blocks: foundryBlocks(),
  },
  {
    id: 'starter_mine',
    structure: 'mine',
    name: 'Starter working',
    size: 6,
    footprint: '6 × 6',
    note: 'Aim it low. The floor has to reach y 12 or below.',
    blocks: mineBlocks(),
  },
  {
    id: 'starter_granary',
    structure: 'granary',
    name: 'Starter granary',
    size: 6,
    footprint: '6 × 6',
    note: 'Build it within 16 blocks of your fields.',
    blocks: room({ w: 6, h: 3, wall: PLANKS, tiles: TILE }),
  },
  {
    id: 'starter_military',
    structure: 'military',
    name: 'Starter garrison',
    size: 6,
    footprint: '6 × 6',
    note: 'Nothing may stand over the watch.',
    blocks: militaryBlocks(),
  },
  {
    id: 'starter_village',
    structure: 'village',
    name: 'Starter village',
    size: 20,
    footprint: '20 × 14',
    note: 'Needs fresh water within 8 blocks — build nearer the river.',
    blocks: villageBlocks(),
  },
  {
    id: 'starter_monument',
    structure: 'monument',
    name: 'Obelisk',
    size: 7,
    footprint: '7 × 7',
    note: 'Nothing may stand over it.',
    blocks: monumentBlocks(),
  },
];

// The real bounding box of each design's blocks. Claiming a cube instead would
// wrap a house in an empty layer and break the "is it sealed?" test.
for (const d of STARTER_DESIGNS) {
  let mx = 0, my = 0, mz = 0;
  for (const b of d.blocks) {
    if (b.dx > mx) mx = b.dx;
    if (b.dy > my) my = b.dy;
    if (b.dz > mz) mz = b.dz;
  }
  d.extent = { x: mx, y: my, z: mz };
  d.cost = costOf(d.blocks);
}

/**
 * What a design costs, counted from the blocks it actually places.
 *
 * These used to be written out by hand beside each design, and every one of
 * them had drifted: the grove asked for 64 dirt, 18 wood and 40 leaves while
 * really taking 60, 14 and 76 — and two saplings it never mentioned at all.
 * The panel would light the button up, and then placing it would refuse and
 * name a material the player had never been told about.
 *
 * A count from the block list cannot drift, so nothing here is written twice.
 * Overlapping entries — two tree crowns sharing a leaf — are counted once,
 * because the world only stores one block per cell and only charges for one.
 */
function costOf(blocks) {
  const cells = new Map();
  for (const b of blocks) cells.set(`${b.dx},${b.dy},${b.dz}`, b.type);
  const bill = {};
  for (const type of cells.values()) {
    const item = ITEM_FOR_BLOCK.get(type);
    if (item) bill[item] = (bill[item] ?? 0) + 1;
  }
  return bill;
}

export const DESIGN_FOR_STRUCTURE = new Map(STARTER_DESIGNS.map((d) => [d.structure, d]));
