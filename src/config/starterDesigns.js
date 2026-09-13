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

const DIRT = 2, WOOD = 4, LEAVES = 5, SAPLING = 20, FARMLAND = 21;

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
