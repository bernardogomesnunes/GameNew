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

const DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, PLANKS = 7, COBBLE = 8,
      BRICK = 9, GOLD = 13, MARBLE = 17, SAPLING = 20, FARMLAND = 21;

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

/**
 * A walled room with a doorway, which is what most of these are.
 *
 * The doorway matters to more than looks: the shelter test asks for cells with
 * a roof and four walls, and every cell in line with the door has three. A 5×5
 * shell loses six of its eighteen sheltered cells that way and lands exactly on
 * the limit, so these are all a size up from where they look like they should
 * be.
 */
function room({ w, h, wall, floor = null, roof = wall, door = true }) {
  const blocks = [];
  if (floor != null) blocks.push(...slab(0, 0, w, w, 0, floor));
  const base = floor != null ? 1 : 0;
  for (let dy = base; dy < base + h; dy++) blocks.push(...ring(0, 0, w, w, dy, wall));
  blocks.push(...slab(0, 0, w, w, base + h, roof));
  if (!door) return blocks;
  const mid = Math.floor(w / 2);
  return blocks.filter((b) => !(b.dz === 0 && b.dx === mid && b.dy >= base && b.dy < base + Math.min(2, h)));
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
  // The doorway. A house needs a way in, and the rules only ask that the room
  // above it stays sealed.
  return blocks.filter((b) => !(b.dz === 0 && b.dx === 2 && (b.dy === 1 || b.dy === 2)));
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

/** A roofed stall on a laid floor, with the rest of the square left open. */
function marketBlocks() {
  const blocks = [...slab(0, 0, 7, 7, 0, PLANKS)];
  blocks.push(...ring(1, 1, 5, 5, 1, PLANKS));
  blocks.push(...ring(1, 1, 5, 5, 2, PLANKS));
  blocks.push(...slab(1, 1, 5, 5, 3, PLANKS));
  return blocks.filter((b) => !(b.dz === 1 && b.dx === 3 && (b.dy === 1 || b.dy === 2)));
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
    id: 'starter_workshop',
    structure: 'workshop',
    name: 'Starter workshop',
    size: 6,
    footprint: '6 × 6',
    note: 'Stand inside it to use the recipes it unlocks.',
    blocks: room({ w: 6, h: 2, wall: PLANKS, floor: STONE }),
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
    blocks: room({ w: 6, h: 3, wall: PLANKS }),
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
