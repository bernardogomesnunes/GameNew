import { AIR } from '../config/blocks.js';

/**
 * Turning a roof shape into blocks over whatever the selector is framing.
 *
 * Two decisions live here rather than in the shapes, because both are about
 * the world and the shapes know nothing about it:
 *
 * Where the eave sits. Not the bottom of the selector box — the box snaps to a
 * grid of its own size, so its floor lands wherever the grid happens to be and
 * almost never on top of your walls. So the roof sits on the highest thing
 * inside the box, which is the wall top if you framed the wall top.
 *
 * That rule on its own has one bad day, and it is the common one: you put a
 * gable up, see it facing the wrong way, turn it and place again — and the
 * second roof sits on the first, because the first is now the highest thing in
 * the box. So the caller can pass the eave it used last time (see the relay in
 * Game), and the tool re-lays at that height and clears what the new shape no
 * longer covers. Anything else about the box changes, and it falls back to the
 * plain rule.
 *
 * And what it is made of: whatever you are holding. A roof out of a fixed
 * material would be one more thing to fight, and the block in your hand is
 * already the answer to "what do you want this made of".
 */

/** The y the eaves sit on: one above the highest block inside the box. */
export function roofBase(world, bounds) {
  let top = null;
  for (let x = bounds.minX; x <= bounds.maxX; x++) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
      for (let y = bounds.maxY; y >= bounds.minY; y--) {
        if (world.getBlock(x, y, z) === AIR) continue;
        if (top === null || y > top) top = y;
        break; // nothing lower in this column can be the highest
      }
    }
  }
  return top === null ? bounds.minY : top + 1;
}

/**
 * The `{ x, y, z, prev, next }` changes for roofing the box, or an empty list.
 *
 * Offsets rather than blocks, in local form, are what a preview wants, so
 * `roofBlocks` does the shape work and this one puts it in the world.
 */
export function roofPlan(world, bounds, { shape, turn = 0, type, base = null }) {
  if (base === null) base = roofBase(world, bounds);
  const changes = [];
  for (const b of roofBlocks(bounds, { shape, turn })) {
    const x = bounds.minX + b.dx, y = base + b.dy, z = bounds.minZ + b.dz;
    if (!world.inBounds(x, y, z)) continue;
    const prev = world.getBlock(x, y, z);
    if (prev === type) continue;
    changes.push({ x, y, z, prev, next: type });
  }
  return changes;
}

/** The shape's blocks as `{ dx, dy, dz }` from the box's low corner and the eave. */
export function roofBlocks(bounds, { shape, turn = 0 }) {
  if (!shape) return [];
  const w = bounds.maxX - bounds.minX + 1;
  const l = bounds.maxZ - bounds.minZ + 1;
  const run = shape.run ?? 1;
  const out = [];
  for (let ix = 0; ix < w; ix++) {
    for (let iz = 0; iz < l; iz++) {
      for (const dy of shape.rises({ ix, iz, w, l, turn: turn % shape.turns, run })) {
        out.push({ dx: ix, dy, dz: iz });
      }
    }
  }
  return out;
}

/** How tall the shape goes over the eave — for the preview's outline. */
export function roofPeak(blocks) {
  let peak = 0;
  for (const b of blocks) if (b.dy > peak) peak = b.dy;
  return peak;
}
