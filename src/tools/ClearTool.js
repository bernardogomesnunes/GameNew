import { AIR } from '../config/blocks.js';
import { pickBuild } from './PointerPick.js';

/**
 * Working out which blocks a clear would take.
 *
 * Nothing here decides whether it is allowed — that is applyChanges' job, and
 * it already knows about the border, claimed buildings and bedrock. This only
 * answers "which blocks did you mean", and it answers it the same way the roof
 * tool does: from what you are pointing at, not from a box you drew.
 */

/** The `{ x, y, z, prev, next }` changes for a clear, or an empty list. */
export function clearPlan(world, hit, spec) {
  return clearCells(world, hit, spec).map((c) => ({
    x: c.x, y: c.y, z: c.z, prev: c.type, next: AIR,
  }));
}

/** The blocks a clear would take, as `{ x, y, z, type }`. */
export function clearCells(world, hit, spec) {
  if (!hit || !spec) return [];
  if (spec.kind === 'build') return pickBuild(world, hit)?.blocks ?? [];

  // A cube centred on the block you are pointing at, so what you aim at is
  // what goes — an offset box would mean aiming beside the thing you want.
  const r = (spec.size - 1) / 2;
  const out = [];
  for (let x = hit.x - r; x <= hit.x + r; x++) {
    for (let y = hit.y - r; y <= hit.y + r; y++) {
      for (let z = hit.z - r; z <= hit.z + r; z++) {
        if (!world.inBounds(x, y, z)) continue;
        const type = world.getBlock(x, y, z);
        if (type === AIR) continue;
        out.push({ x, y, z, type });
      }
    }
  }
  return out;
}

/** The box round a set of cells, for drawing a preview. Null when empty. */
export function cellBounds(cells) {
  if (!cells?.length) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
    if (c.z < minZ) minZ = c.z;
    if (c.z > maxZ) maxZ = c.z;
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}
