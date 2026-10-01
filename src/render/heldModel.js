import * as THREE from 'three';
import { ITEM_MODELS } from '../config/itemModels.js';
import { ITEMS_BY_ID } from '../config/items.js';
import { BLOCKS_BY_ID } from '../config/blocks.js';
import { boxesFor } from '../world/propShapes.js';

/**
 * What you hold, as a little 3D thing (playtest, P7). Asked for directly:
 * "Weapons need 3D versions of them and they need to be shown on the UI
 * when the avatar is moving, in their hands, plus fruit, buckets and all
 * holding items."
 *
 * The same boxes the bag draws its icons from where there are some (food,
 * swords, armour, rings, drinks), a few made for the hand alone (the tools,
 * the bucket), a block's own shape or cube for a block, and for anything
 * else a lump of it in its colour. Built once per thing and kept.
 */

const box = (x0, y0, z0, x1, y1, z1, color) => ({ minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1, color });
const HAFT = 0x8a6440, IRON = 0xb9bec6, DARK = 0x5a5f66;

/** Models for the hand only — the bag keeps its drawings of these. */
/*
 * A head or a blade always faces -x — the way the hand swings it: towards
 * the middle of the screen in first person, forward from the avatar's hand.
 */
export const HELD_MODELS = {
  axe: [box(0.45, 0, 0.45, 0.55, 0.9, 0.55, HAFT), box(0.22, 0.6, 0.43, 0.45, 0.88, 0.57, IRON), box(0.16, 0.56, 0.44, 0.24, 0.92, 0.56, DARK)],
  pickaxe: [box(0.45, 0, 0.45, 0.55, 0.88, 0.55, HAFT), box(0.12, 0.8, 0.44, 0.88, 0.92, 0.56, IRON), box(0.08, 0.72, 0.45, 0.16, 0.84, 0.55, IRON), box(0.84, 0.72, 0.45, 0.92, 0.84, 0.55, IRON)],
  shovel: [box(0.46, 0.3, 0.46, 0.54, 1, 0.54, HAFT), box(0.36, 0, 0.47, 0.64, 0.34, 0.53, IRON)],
  pry_bar: [box(0.46, 0, 0.46, 0.54, 0.86, 0.54, DARK), box(0.3, 0.8, 0.46, 0.54, 0.88, 0.54, DARK)],
  chalk_line: [box(0.3, 0.2, 0.4, 0.7, 0.6, 0.6, 0xc94a3e), box(0.46, 0.6, 0.48, 0.54, 0.95, 0.52, 0xf2ede2)],
  bucket: [box(0.28, 0, 0.28, 0.72, 0.5, 0.72, IRON), box(0.3, 0.5, 0.48, 0.34, 0.66, 0.52, DARK), box(0.66, 0.5, 0.48, 0.7, 0.66, 0.52, DARK), box(0.3, 0.64, 0.48, 0.7, 0.68, 0.52, DARK)],
  bucket_water: [box(0.28, 0, 0.28, 0.72, 0.5, 0.72, IRON), box(0.31, 0.44, 0.31, 0.69, 0.48, 0.69, 0x5f8fc4), box(0.3, 0.5, 0.48, 0.34, 0.66, 0.52, DARK), box(0.66, 0.5, 0.48, 0.7, 0.66, 0.52, DARK), box(0.3, 0.64, 0.48, 0.7, 0.68, 0.52, DARK)],
};

/**
 * The boxes for what's held — an item id or a block id — in a unit cell,
 * each with a colour.
 */
export function heldBoxes({ itemId = null, blockId = null } = {}) {
  if (itemId) {
    const model = ITEM_MODELS[itemId] ?? HELD_MODELS[itemId];
    if (model) return model;
    const spec = ITEMS_BY_ID.get(itemId);
    if (spec?.block != null) return heldBoxes({ blockId: spec.block });
    // Anything else: a lump of it, in its colour.
    return [box(0.3, 0, 0.3, 0.7, 0.36, 0.7, spec?.color ?? 0x999999)];
  }
  if (blockId != null) {
    const b = BLOCKS_BY_ID.get(blockId);
    if (!b) return [];
    if (b.shape) return boxesFor(b.shape).map((x) => ({ ...x, color: x.color ?? b.color }));
    return [box(0, 0, 0, 1, 1, 1, b.color)];
  }
  return [];
}

const cache = new Map();

/**
 * One geometry for a set of boxes, coloured per box, centred on x and z and
 * standing on y = 0 — what the hand and the avatar both hold.
 */
export function heldGeometry(key, boxes) {
  if (cache.has(key)) return cache.get(key);
  const positions = [], normals = [], colors = [], index = [];
  const c = new THREE.Color();
  for (const b of boxes) {
    const g = new THREE.BoxGeometry(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ);
    g.translate((b.minX + b.maxX) / 2 - 0.5, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2 - 0.5);
    c.setHex(b.color ?? 0x999999);
    const base = positions.length / 3;
    positions.push(...g.attributes.position.array);
    normals.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i++) colors.push(c.r, c.g, c.b);
    for (const i of g.index.array) index.push(base + i);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  cache.set(key, geo);
  return geo;
}

/** The geometry for what's held, or null for empty hands. */
export function heldGeometryFor(held) {
  const key = held.itemId ? `i:${held.itemId}` : held.blockId != null ? `b:${held.blockId}` : null;
  if (!key) return null;
  const boxes = heldBoxes(held);
  return boxes.length ? heldGeometry(key, boxes) : null;
}
