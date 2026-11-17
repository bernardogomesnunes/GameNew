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
 * CRAFT3D-1, CRAFT-9: the furniture made at the Carpenter's Table, and its parts.
 *
 * A piece's parts are the boxes its block is drawn from (world/propShapes.js),
 * so every piece, a new one included, can be cut and fitted with no data of
 * its own. Matching boxes are one part (the 4 legs of a table fit with one
 * tap), and the rest merge down to MAX_PARTS: a piece is at most 4 fits.
 */
export const FURNITURE = [...FURNITURE_ITEM.values(), 'bed', 'painting', 'chair_red', 'panel_twotone'];
export const MAX_PARTS = 4;
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
});

/** What a part is called, from its shape and place. */
function nameOf(b, shape) {
  const w = Math.min(b.maxX - b.minX, b.maxZ - b.minZ), h = b.maxY - b.minY;
  if (b.minY === 0 && Math.max(b.maxX - b.minX, b.maxZ - b.minZ) < 0.3 && h > w) return 'leg';
  if (h < 0.15 && b.minY >= 0.3) return /chair/.test(shape) ? 'seat' : 'top';
  if (h > 0.3 && w < 0.15 && b.minY > 0.3) return 'back';
  return 'panel';
}

const size = (b) => [b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ];
/** Two boxes of one size, one name and one colour are the same part, cut twice. */
const matching = (a, b, shape) => size(a).every((n, i) => Math.abs(n - size(b)[i]) < 1e-6)
  && a.tone === b.tone && a.color === b.color && nameOf(a, shape) === nameOf(b, shape);
const volumeOf = (boxes) => boxes.reduce((n, b) => n + volume(b), 0);
const touching = (a, b) => a.some((x) => b.some((y) => touch(x, y)));

/**
 * The parts of `itemId`, at most MAX_PARTS, lowest first (legs, then the top).
 * Each is { name, count, boxes, box }: `boxes` are what is drawn (each with its
 * own tone or colour), `box` is the space they take together, and `count` is
 * how many matching boxes it is (4 for a table's legs), 1 for a mixed part.
 */
export function partsFor(itemId) {
  const shape = BLOCKS_BY_ID.get(ITEMS_BY_ID.get(itemId)?.block)?.shape ?? '';
  const boxes = boxesOf(itemId).map(({ minX, maxX, minY, maxY, minZ, maxZ, tone, color }) => ({ minX, maxX, minY, maxY, minZ, maxZ, tone, color }));
  let groups = [];
  for (const b of boxes) {
    const g = groups.find((g) => matching(g.boxes[0], b, shape));
    if (g) g.boxes.push(b);
    else groups.push({ name: nameOf(b, shape), boxes: [b], same: true });
  }
  while (groups.length > MAX_PARTS) {
    // The two smallest that touch become one; with nothing touching, the two smallest.
    let best = null;
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const v = volumeOf(groups[i].boxes) + volumeOf(groups[j].boxes), near = touching(groups[i].boxes, groups[j].boxes);
      if (!best || (near && !best.near) || (near === best.near && v < best.v)) best = { i, j, v, near };
    }
    const a = groups[best.i], b = groups[best.j], big = volumeOf(a.boxes) >= volumeOf(b.boxes) ? a : b;
    groups = groups.filter((_, k) => k !== best.i && k !== best.j).concat({ name: big.name, boxes: [...a.boxes, ...b.boxes], same: false });
  }
  return groups.map((g) => ({ name: g.name, count: g.same ? g.boxes.length : 1, boxes: g.boxes, box: g.boxes.reduce(hull) }))
    .sort((a, b) => a.box.minY - b.box.minY || volume(b.box) - volume(a.box));
}

/** What a part is called on a button: "Top", "4 legs". */
export function partLabel(part) {
  const name = part.count > 1 ? `${part.count} ${part.name}s` : part.name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
