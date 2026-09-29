/**
 * What a non-cube block actually looks like: a handful of boxes in unit-cell
 * space (0..1 on every axis), assembled by PropRenderer into real geometry
 * instead of the plain cube ChunkMesher draws for everything else.
 *
 * Every shape here has a fixed orientation — there is no facing/rotation
 * concept anywhere else in this block registry either, so a stair always
 * steps the same way regardless of which side you placed it from. Stairs
 * only differ from a slab visually; their collision box is the same flat
 * half-height slab (see World.collisionBoxAt) rather than a stepped one —
 * a deliberate simplification, not an oversight.
 */
export const PROP_SHAPES = {
  slab: [
    { minX: 0, maxX: 1, minY: 0, maxY: 0.5, minZ: 0, maxZ: 1 },
  ],
  stair: [
    { minX: 0, maxX: 1, minY: 0, maxY: 0.5, minZ: 0, maxZ: 1 },
    { minX: 0, maxX: 1, minY: 0.5, maxY: 0.75, minZ: 0, maxZ: 0.5 },
  ],
  table: [
    { minX: 0.06, maxX: 0.94, minY: 0.52, maxY: 0.62, minZ: 0.06, maxZ: 0.94 }, // top
    { minX: 0.08, maxX: 0.18, minY: 0, maxY: 0.52, minZ: 0.08, maxZ: 0.18 },
    { minX: 0.82, maxX: 0.92, minY: 0, maxY: 0.52, minZ: 0.08, maxZ: 0.18 },
    { minX: 0.08, maxX: 0.18, minY: 0, maxY: 0.52, minZ: 0.82, maxZ: 0.92 },
    { minX: 0.82, maxX: 0.92, minY: 0, maxY: 0.52, minZ: 0.82, maxZ: 0.92 },
  ],
  chair: [
    { minX: 0.15, maxX: 0.85, minY: 0.42, maxY: 0.5, minZ: 0.15, maxZ: 0.85 }, // seat
    { minX: 0.15, maxX: 0.85, minY: 0.5, maxY: 0.95, minZ: 0.75, maxZ: 0.85 }, // backrest
    { minX: 0.18, maxX: 0.26, minY: 0, maxY: 0.42, minZ: 0.18, maxZ: 0.26 },
    { minX: 0.74, maxX: 0.82, minY: 0, maxY: 0.42, minZ: 0.18, maxZ: 0.26 },
    { minX: 0.18, maxX: 0.26, minY: 0, maxY: 0.42, minZ: 0.74, maxZ: 0.82 },
    { minX: 0.74, maxX: 0.82, minY: 0, maxY: 0.42, minZ: 0.74, maxZ: 0.82 },
  ],
  rug: [
    { minX: 0.03, maxX: 0.97, minY: 0, maxY: 0.04, minZ: 0.03, maxZ: 0.97 },
  ],
};

/** The boxes for a shape, or the slab's if a new shape id has none registered yet. */
export function boxesFor(shape) {
  return PROP_SHAPES[shape] ?? PROP_SHAPES.slab;
}
