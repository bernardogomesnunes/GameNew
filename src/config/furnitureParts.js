import { PROP_SHAPES, boxesFor } from '../world/propShapes.js';
import { ITEMS_BY_ID, FURNITURE_ITEM } from './items.js';
import { BLOCKS_BY_ID } from './blocks.js';

import { FURNITURE_AGE } from './recipes.js';
import { STARTER_DESIGNS } from './starterDesigns.js';
import { STRUCTURES_BY_ID } from './structures.js';
import { ITEM_FOR_BLOCK } from './items.js';

/** What each piece costs, as its old recipe did (captured in recipes.js before those went). */
export { FURNITURE_COST as COST } from './recipes.js';

/**
 * The age each piece opens at the Counter. Never later than the first
 * building whose design has it in (owner, 12 November, a new world: the
 * Starter cabin wants a bed and a painting and the Work Hall a table and a
 * chair, all Age 1, while the Counter and the table only came at Ages 3 and 4).
 */
export const AGE = new Map(FURNITURE_AGE);
for (const d of STARTER_DESIGNS) {
  const age = STRUCTURES_BY_ID.get(d.structure)?.age ?? 1;
  for (const b of d.blocks) {
    const id = ITEM_FOR_BLOCK.get(b.type);
    if (AGE.has(id) && AGE.get(id) > age) AGE.set(id, age);
  }
}

/**
 * CRAFT3D-1: the furniture made at the carpentry counter, and its parts.
 *
 * A piece's parts are the boxes its block is drawn from (world/propShapes.js),
 * so every piece, a new one included, can be cut and fitted with no data of
 * its own. Merged down to MAX_PARTS, so a piece is never more than 8 cuts.
 */
export const FURNITURE = [...FURNITURE_ITEM.values(), 'bed', 'painting', 'chair_red', 'panel_twotone'];
export const MAX_PARTS = 8;
const PATTERNED = new Set(['panel_pattern', 'panel_pattern_white', 'panel_pattern_dark']);

/** Whether the piece ends with the chisel (carved patterns). */
export function isPatterned(itemId) {
  return PATTERNED.has(itemId);
}

function boxesOf(itemId) {
  if (itemId === 'bed') {
    // Two cells, foot then head, side by side along z.
    return [...PROP_SHAPES.bed_foot, ...PROP_SHAPES.bed_head.map((b) => ({ ...b, minZ: b.minZ + 1, maxZ: b.maxZ + 1 }))];
  }
  const shape = BLOCKS_BY_ID.get(ITEMS_BY_ID.get(itemId)?.block)?.shape;
  return shape ? boxesFor(shape) : [];
}

const volume = (b) => (b.maxX - b.minX) * (b.maxY - b.minY) * (b.maxZ - b.minZ);
const touch = (a, b) => a.minX <= b.maxX + 1e-6 && b.minX <= a.maxX + 1e-6 && a.minY <= b.maxY + 1e-6
  && b.minY <= a.maxY + 1e-6 && a.minZ <= b.maxZ + 1e-6 && b.minZ <= a.maxZ + 1e-6;
const hull = (a, b) => ({
  minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX),
  minY: Math.min(a.minY, b.minY), maxY: Math.max(a.maxY, b.maxY),
  minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ),
  tone: a.tone ?? b.tone,
});

/** What a part is called, from its shape and place. */
function nameOf(b, shape) {
  const w = Math.min(b.maxX - b.minX, b.maxZ - b.minZ), h = b.maxY - b.minY;
  if (b.minY === 0 && w < 0.3 && h > w) return 'leg';
  if (h < 0.15 && b.minY >= 0.3) return /chair/.test(shape) ? 'seat' : 'top';
  if (h > 0.3 && w < 0.15 && b.minY > 0.3) return 'back';
  return 'panel';
}

/** The parts of `itemId`: { name, box, tone }, top and seat first, at most MAX_PARTS. */
export function partsFor(itemId) {
  let boxes = boxesOf(itemId).map(({ minX, maxX, minY, maxY, minZ, maxZ, tone }) => ({ minX, maxX, minY, maxY, minZ, maxZ, tone }));
  while (boxes.length > MAX_PARTS) {
    let best = null;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      if (!touch(boxes[i], boxes[j])) continue;
      const v = volume(boxes[i]) + volume(boxes[j]);
      if (!best || v < best.v) best = { i, j, v };
    }
    // Nothing touching: the two smallest merge anyway.
    if (!best) { const by = boxes.map((b, i) => [volume(b), i]).sort((a, b) => a[0] - b[0]); best = { i: by[0][1], j: by[1][1] }; }
    const merged = hull(boxes[best.i], boxes[best.j]);
    boxes = boxes.filter((_, k) => k !== best.i && k !== best.j).concat(merged);
  }
  const shape = BLOCKS_BY_ID.get(ITEMS_BY_ID.get(itemId)?.block)?.shape ?? '';
  return boxes.map((box) => ({ name: nameOf(box, shape), box, ...(box.tone ? { tone: box.tone } : {}) }));
}
