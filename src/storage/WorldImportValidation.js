import { ID_LIMIT } from '../config/blocks.js';
import { CAR_SLOTS, MAX_CARS } from '../world/Trains.js';

// Bound both the input and the expanded blocks: a tiny RLE file can otherwise
// request gigabytes before the importer has a chance to show an error.
export const MAX_WORLD_FILE_BYTES = 128 * 1024 * 1024;
const MAX_CELLS = 64 * 1024 * 1024;
const MAX_COORD = (1 << 20) - 1;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
function requireWorld(condition, reason) {
  if (!condition) throw new Error(`That world file ${reason}.`);
}

/** Validate before constructing a World, allocating chunks, or generating land. */
export function validateWorldImport(data) {
  requireWorld(record(data), 'must contain a world object');
  requireWorld(data.version === 1 || data.version === 2, 'uses an unsupported world format version');
  const w = data.world;
  requireWorld(record(w) && Array.isArray(w.chunks), 'is missing its block data');
  requireWorld(integer(w.height, 1, 512), 'has an invalid height');
  requireWorld(w.endless === undefined || typeof w.endless === 'boolean', 'has invalid terrain settings');
  const cells = 256 * w.height;
  let count;
  if (w.endless) {
    requireWorld(integer(w.seed, -2147483648, 2147483647), 'has an invalid terrain seed');
    for (const key of ['homeX', 'homeZ']) requireWorld(w[key] == null || integer(w[key], -MAX_COORD * 16, MAX_COORD * 16), 'has an invalid home position');
    count = w.chunks.length;
  } else {
    requireWorld(integer(w.sizeX, 1, 16384) && integer(w.sizeZ, 1, 16384), 'has invalid dimensions');
    count = Math.ceil(w.sizeX / 16) * Math.ceil(w.sizeZ / 16);
    for (const [key, max] of [['surfaceHeightMap', w.height], ['biomeMap', 255]]) {
      if (w[key] != null) requireWorld(Array.isArray(w[key]) && w[key].length === w.sizeX * w.sizeZ && w[key].every(v => integer(v, 0, max)), `has invalid ${key} data`);
    }
  }
  requireWorld(count * cells <= MAX_CELLS && w.chunks.length <= count, 'is too large to import safely');
  const seen = new Set();
  for (const c of w.chunks) {
    requireWorld(record(c) && integer(c.cx, -MAX_COORD, MAX_COORD) && integer(c.cz, -MAX_COORD, MAX_COORD), 'has invalid chunk coordinates');
    if (!w.endless) requireWorld(c.cx >= 0 && c.cz >= 0 && c.cx < Math.ceil(w.sizeX / 16) && c.cz < Math.ceil(w.sizeZ / 16), 'has a chunk outside its bounds');
    const key = `${c.cx},${c.cz}`;
    requireWorld(!seen.has(key), 'has duplicate chunks');
    seen.add(key);
    requireWorld(Array.isArray(c.rle) && c.rle.length > 0 && c.rle.length % 2 === 0 && c.rle.length <= cells * 2, 'has invalid block runs');
    let total = 0;
    for (let i = 0; i < c.rle.length; i += 2) {
      requireWorld(integer(c.rle[i], 0, ID_LIMIT - 1) && integer(c.rle[i + 1], 1, cells), 'has invalid block runs');
      total += c.rle[i + 1];
      requireWorld(total <= cells, 'has overflowing block runs');
    }
    requireWorld(total === cells, 'has incomplete block runs');
    if (c.surface != null) requireWorld(Array.isArray(c.surface) && c.surface.length === 256 && c.surface.every(v => integer(v, 0, w.height)), 'has invalid surface data');
  }
  requireWorld(record(data.player) && ['x', 'y', 'z'].every(k => Number.isFinite(data.player[k]) && Math.abs(data.player[k]) <= MAX_COORD * 16), 'has an invalid player position');
  for (const key of ['yaw', 'pitch']) requireWorld(data.player[key] == null || (Number.isFinite(data.player[key]) && Math.abs(data.player[key]) <= 1e6), 'has an invalid player direction');
  for (const key of ['gamification', 'economy', 'duilt']) requireWorld(data[key] == null || record(data[key]), `has invalid ${key} data`);
  requireWorld(data.name == null || (typeof data.name === 'string' && data.name.length <= 200), 'has an invalid name');
  requireWorld(data.templates == null || Array.isArray(data.templates), 'has invalid designs');
  // Buildings are re-scanned on load. Bound the volume they can ask the world
  // to visit, even if their RLE terrain is perfectly small and valid.
  const savedStructures = data.duilt?.structures?.structures;
  const waiting = data.duilt?.waiting;
  requireWorld(savedStructures == null || Array.isArray(savedStructures), 'has invalid buildings');
  requireWorld(waiting == null || Array.isArray(waiting), 'has invalid unfinished buildings');
  const structures = [...(savedStructures ?? []), ...(waiting ?? [])];
  if (structures != null) {
    requireWorld(Array.isArray(structures) && structures.length <= 4096, 'has too many buildings');
    let volume = 0;
    for (const s of structures) {
      requireWorld(record(s) && record(s.region), 'has an invalid building');
      let size = 1;
      for (const axis of ['X', 'Y', 'Z']) {
        const lo = s.region[`min${axis}`], hi = s.region[`max${axis}`];
        requireWorld(integer(lo, -MAX_COORD * 16, MAX_COORD * 16) && integer(hi, lo, MAX_COORD * 16), 'has invalid building bounds');
        size *= hi - lo + 1;
      }
      volume += size;
      requireWorld(size <= 1024 * 1024 && volume <= 4 * 1024 * 1024, 'has buildings too large to import safely');
      if (w.endless) {
        const r = s.region;
        const minCX = Math.floor(r.minX / 16), maxCX = Math.floor(r.maxX / 16);
        const minCZ = Math.floor(r.minZ / 16), maxCZ = Math.floor(r.maxZ / 16);
        requireWorld((maxCX - minCX + 1) * (maxCZ - minCZ + 1) <= 256, 'has a building spread over too much land');
        for (let cx = minCX; cx <= maxCX; cx++) for (let cz = minCZ; cz <= maxCZ; cz++) seen.add(`${cx},${cz}`);
        requireWorld(seen.size * cells <= MAX_CELLS, 'needs too much terrain to load its buildings');
      }
    }
  }
  let designBlocks = 0;
  for (const t of data.templates ?? []) {
    requireWorld(record(t) && typeof t.id === 'string' && integer(t.size, 1, 1024) && Array.isArray(t.blocks), 'has an invalid design');
    designBlocks += t.blocks.length;
    requireWorld(designBlocks <= 1024 * 1024, 'has too many design blocks');
    for (const b of t.blocks) requireWorld(record(b) && ['dx', 'dy', 'dz'].every(k => integer(b[k], 0, t.size - 1)) && integer(b.type, 0, ID_LIMIT - 1), 'has invalid design blocks');
  }
  // Inventories occur in bags, chests, carts and building stores. Check every
  // occurrence, rather than trusting an object with an attacker-chosen length.
  let nodes = 0, slots = 0;
  const trains = data.duilt?.trains;
  if (trains != null) {
    requireWorld(Array.isArray(trains) && trains.length <= 256, 'has too many trains');
    for (const t of trains) {
      requireWorld(record(t) && integer(t.cars, 0, MAX_CARS), 'has invalid train cars');
      slots += t.cars * CAR_SLOTS;
    }
    requireWorld(slots <= 100000, 'has too many train inventory slots');
  }
  function state(value, depth = 0) {
    requireWorld(++nodes <= 500000 && depth <= 32, 'has too much nested game data');
    if (typeof value === 'number') requireWorld(Number.isFinite(value), 'has invalid numeric game data');
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      requireWorld(value.length <= 100000, 'has too many saved game records');
      for (const v of value) state(v, depth + 1);
    } else {
      if ('x' in value && 'z' in value) {
        requireWorld(Number.isFinite(value.x) && Number.isFinite(value.z) && Math.abs(value.x) <= MAX_COORD * 16 && Math.abs(value.z) <= MAX_COORD * 16, 'has invalid saved positions');
        if (w.endless) {
          seen.add(`${Math.floor(value.x / 16)},${Math.floor(value.z / 16)}`);
          requireWorld(seen.size * cells <= MAX_CELLS, 'needs too much terrain for saved positions');
        }
      }
      for (const [key, v] of Object.entries(value)) {
        requireWorld(!['__proto__', 'constructor', 'prototype'].includes(key), 'has invalid game data keys');
        if (key === 'slots') {
          requireWorld(Array.isArray(v) && v.length <= 4096, 'has invalid inventory slots');
          slots += v.length;
          requireWorld(slots <= 100000, 'has too many inventory slots');
        }
        state(v, depth + 1);
      }
    }
  }
  for (const key of ['duilt', 'gamification', 'economy']) state(data[key]);
}
