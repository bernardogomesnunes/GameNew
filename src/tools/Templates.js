import { AIR } from '../config/blocks.js';

/**
 * Saved designs: reading one off a build, turning it, and putting it down.
 *
 * These used to live with the selector, because a design was whatever a
 * grid-snapped box happened to contain. It isn't any more — you point at a
 * build and the whole build is the design, however big it is and whatever
 * shape — so they live here instead, and a template's size is now the extent of
 * the thing you saved rather than the size of the box you drew round it.
 */

/** A template payload from picked blocks: offsets from the low corner, plus a size. */
export function captureBlocks(blocks, bounds) {
  if (!blocks?.length) return null;
  const size = Math.max(
    bounds.maxX - bounds.minX + 1,
    bounds.maxY - bounds.minY + 1,
    bounds.maxZ - bounds.minZ + 1,
  );
  return {
    size,
    blocks: blocks
      .filter((b) => b.type !== AIR)
      .map((b) => ({ dx: b.x - bounds.minX, dy: b.y - bounds.minY, dz: b.z - bounds.minZ, type: b.type })),
  };
}

/** Rotates a template's blocks 90 degrees clockwise about Y, in place of the old footprint. */
export function rotateTemplate(template, quarterTurns = 1) {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (!turns) return template;
  const s = template.size;
  let blocks = template.blocks;
  for (let t = 0; t < turns; t++) {
    blocks = blocks.map(({ dx, dy, dz, type }) => ({ dx: s - 1 - dz, dy, dz: dx, type }));
  }
  return { ...template, blocks };
}

/** Proposed { x, y, z, prev, next } changes for stamping a template at an anchor. */
export function buildTemplatePlacement(world, template, anchor) {
  const changes = [];
  for (const b of template.blocks) {
    const x = anchor.x + b.dx, y = anchor.y + b.dy, z = anchor.z + b.dz;
    if (!world.inBounds(x, y, z)) continue;
    const prev = world.getBlock(x, y, z);
    if (prev === b.type) continue;
    changes.push({ x, y, z, prev, next: b.type });
  }
  return changes;
}
