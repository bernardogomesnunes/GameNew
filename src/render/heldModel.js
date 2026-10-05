import * as THREE from 'three';
import { ITEM_MODELS } from '../config/itemModels.js';
import { ITEMS_BY_ID } from '../config/items.js';
import { BLOCKS_BY_ID } from '../config/blocks.js';
import { boxesFor } from '../world/propShapes.js';
import { tileFor, TILE_SIZE, tileValue } from './BlockTextures.js';

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
  cart: [box(0.2, 0.2, 0.25, 0.8, 0.5, 0.75, 0xa77b4f), box(0.1, 0.05, 0.4, 0.2, 0.35, 0.6, DARK), box(0.8, 0.05, 0.4, 0.9, 0.35, 0.6, DARK)],
  flying_machine: [box(0.46, 0.2, 0.2, 0.54, 0.3, 0.8, HAFT), box(0.05, 0.3, 0.35, 0.95, 0.34, 0.6, 0xefe6d2), box(0.05, 0.34, 0.35, 0.95, 0.37, 0.38, HAFT)],
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

/** sRGB to light and back, so the tile multiplies the colour the way the block shader does (as the icons do, config/cubes.js). */
const toLight = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toByte = (v) => Math.round(255 * Math.min(1, v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));

const faceTextures = new Map();
/** A block's tile tinted its colour, as a texture — the picture its icon shows. */
function faceTexture(blockId, color, top) {
  const key = `${blockId}:${top ? 'top' : 'side'}`;
  if (faceTextures.has(key)) return faceTextures.get(key);
  const tile = tileFor(blockId, { top });
  let tex = null;
  if (tile) {
    const n = TILE_SIZE, data = new Uint8Array(n * n * 4);
    const [r, g, b] = [16, 8, 0].map((sh) => toLight(((color >> sh) & 255) / 255));
    for (let i = 0; i < n * n; i++) {
      data[i * 4] = toByte(r * tileValue(tile[i * 4]));
      data[i * 4 + 1] = toByte(g * tileValue(tile[i * 4 + 1]));
      data[i * 4 + 2] = toByte(b * tileValue(tile[i * 4 + 2]));
      data[i * 4 + 3] = 255;
    }
    tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
  }
  faceTextures.set(key, tex);
  return tex;
}

const cubes = new Map();
let cubeGeometry = null;
/**
 * A plain block held in the hand, textured the way it is in the world and in
 * its icon. Asked for directly: "Blocks the player is holding should be the
 * same as the icon." Null for a shaped block (a stair, a door, a lantern) or
 * one with no texture, which keep their boxes.
 *
 * Returns { geometry, materials }: a unit cube standing on y = 0, centred on
 * x and z like heldGeometry, with one material per face (+x -x +y -y +z -z)
 * — the top its top tile, the rest its side tile.
 */
export function heldTexturedCube(blockId) {
  if (cubes.has(blockId)) return cubes.get(blockId);
  const b = BLOCKS_BY_ID.get(blockId);
  let out = null;
  if (b && !b.shape) {
    const side = faceTexture(blockId, b.color, false);
    if (side) {
      const top = faceTexture(blockId, b.color, true) ?? side;
      const mat = (map) => new THREE.MeshLambertMaterial({ map });
      const s = mat(side);
      if (!cubeGeometry) cubeGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      out = { geometry: cubeGeometry, materials: [s, s, mat(top), s, s, s] };
    }
  }
  cubes.set(blockId, out);
  return out;
}

/** The block a held thing is, if it's a plain textured cube — see heldTexturedCube. */
export function heldCubeFor({ itemId = null, blockId = null } = {}) {
  if (itemId) {
    if (ITEM_MODELS[itemId] || HELD_MODELS[itemId]) return null;
    const block = ITEMS_BY_ID.get(itemId)?.block;
    return block != null ? heldTexturedCube(block) : null;
  }
  return blockId != null ? heldTexturedCube(blockId) : null;
}
