import { WORLDS_MODE_VALUES } from '../../db/schema.mjs';
import { validateEmergingDescriptors, validateEmergingState } from '../world/emergingPlaceState.js';

/** @typedef {{seed:number, homeX?:number, homeZ?:number}} TerrainMetadata */
/** @typedef {{name:string, mode:'creative'|'campaign'|'duilt', height:number, sizeX:number|null, sizeZ:number|null, worldGen?:TerrainMetadata|null, spawn?:{x:number,y:number,z:number,yaw?:number,pitch?:number}|null}} SaveMetadata */
/** @typedef {{id:number,name:string,color:number,shape?:string,glyph?:string,material?:string,transparent?:boolean,opacity?:number,light?:{color:number,intensity:number,distance:number,decay?:number,y?:number}}} BlockMetadata */

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const int = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
function saveAssert(condition, field) {
  if (!condition) throw new TypeError(`Invalid save metadata: ${field}. The current world has not been replaced.`);
}

/** Checks the boundary before cloud IO or allocation; legacy campaign saves remain readable.
 * @param {SaveMetadata} meta
 */
export function validateSaveMetadata(meta) {
  saveAssert(record(meta), 'expected an object');
  saveAssert(typeof meta.name === 'string', 'name must be text');
  saveAssert(WORLDS_MODE_VALUES.includes(meta.mode), 'unsupported mode');
  saveAssert(int(meta.height, 1, 512), 'height must be an integer from 1 to 512');
  if (meta.worldGen != null) {
    saveAssert(record(meta.worldGen) && int(meta.worldGen.seed, -2147483648, 2147483647), 'invalid terrain seed');
    for (const field of ['homeX', 'homeZ']) saveAssert(meta.worldGen[field] == null || Number.isFinite(meta.worldGen[field]), `invalid ${field}`);
    validateEmergingDescriptors(meta.worldGen.emergingPlaces);
    saveAssert(meta.sizeX == null && meta.sizeZ == null, 'endless world must not have fixed dimensions');
  } else {
    for (const field of ['sizeX', 'sizeZ']) saveAssert(int(meta[field], 1, 4096), `invalid fixed ${field}`);
  }
  if (meta.spawn != null) {
    saveAssert(record(meta.spawn), 'spawn must be an object');
    for (const field of ['x', 'y', 'z']) saveAssert(Number.isFinite(meta.spawn[field]), `invalid spawn ${field}`);
    for (const field of ['yaw', 'pitch']) saveAssert(meta.spawn[field] == null || Number.isFinite(meta.spawn[field]), `invalid spawn ${field}`);
  }
  for (const field of ['economy', 'duilt']) saveAssert(meta[field] == null || record(meta[field]), `${field} must be an object`);
  validateEmergingState(meta.duilt?.emergingPlaces);
  return meta;
}

/** CI checks all registry entries and duplicate IDs before a Map can hide them.
 * @param {BlockMetadata[]} blocks
 * @param {number} idLimit
 */
export function validateBlockList(blocks, idLimit) {
  const ids = new Set();
  for (const block of blocks) {
    const fail = field => { throw new TypeError(`Invalid block ${block?.id}: ${field}`); };
    if (!record(block) || !int(block.id, 1, idLimit - 1)) fail('id');
    if (ids.has(block.id)) fail('duplicate id');
    ids.add(block.id);
    if (typeof block.name !== 'string' || !block.name.trim()) fail('name');
    if (!int(block.color, 0, 0xffffff)) fail('color');
    for (const field of ['shape', 'glyph', 'material']) if (block[field] != null && typeof block[field] !== 'string') fail(field);
    for (const field of ['transparent', 'system', 'soil', 'smoke']) if (block[field] != null && typeof block[field] !== 'boolean') fail(field);
    if (block.opacity != null && !(Number.isFinite(block.opacity) && block.opacity >= 0 && block.opacity <= 1)) fail('opacity');
    if (block.light != null) {
      if (!record(block.light) || !int(block.light.color, 0, 0xffffff)) fail('light color');
      for (const field of ['intensity', 'distance']) if (!Number.isFinite(block.light[field]) || block.light[field] < 0) fail(`light ${field}`);
      for (const field of ['decay', 'y']) if (block.light[field] != null && !Number.isFinite(block.light[field])) fail(`light ${field}`);
    }
  }
  return blocks;
}
