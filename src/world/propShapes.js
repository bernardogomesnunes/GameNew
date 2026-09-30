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
  // Unjoined defaults; the mesher uses fenceBoxes, which joins them up.
  fence: [
    { minX: 0.375, maxX: 0.625, minY: 0, maxY: 1, minZ: 0.375, maxZ: 0.625 },
  ],
  gate: [
    { minX: 0, maxX: 1, minY: 0.25, maxY: 0.375, minZ: 0.4375, maxZ: 0.5625 },
    { minX: 0, maxX: 1, minY: 0.5, maxY: 0.625, minZ: 0.4375, maxZ: 0.5625 },
    { minX: 0, maxX: 1, minY: 0.75, maxY: 0.875, minZ: 0.4375, maxZ: 0.5625 },
  ],
  rug: [
    { minX: 0.03, maxX: 0.97, minY: 0, maxY: 0.04, minZ: 0.03, maxZ: 0.97 },
  ],
};

/**
 * A fence or gate, joined to whichever of its four sides has another fence,
 * a gate or a wall beside it — so a line of them reads as one fence rather
 * than a row of posts. `joins` is { px, nx, pz, nz } (east, west, south,
 * north). A fence always has its post; a gate has no post and spans its
 * cell along whichever way it joins, as three rails.
 */
export function fenceBoxes(shape, joins) {
  const boxes = [];
  if (shape === 'fence') {
    boxes.push({ minX: 0.375, maxX: 0.625, minY: 0, maxY: 1, minZ: 0.375, maxZ: 0.625 });
    for (const [lo, hi] of [[0.375, 0.5625], [0.75, 0.9375]]) {
      if (joins.px) boxes.push({ minX: 0.625, maxX: 1, minY: lo, maxY: hi, minZ: 0.4375, maxZ: 0.5625 });
      if (joins.nx) boxes.push({ minX: 0, maxX: 0.375, minY: lo, maxY: hi, minZ: 0.4375, maxZ: 0.5625 });
      if (joins.pz) boxes.push({ minX: 0.4375, maxX: 0.5625, minY: lo, maxY: hi, minZ: 0.625, maxZ: 1 });
      if (joins.nz) boxes.push({ minX: 0.4375, maxX: 0.5625, minY: lo, maxY: hi, minZ: 0, maxZ: 0.375 });
    }
    return boxes;
  }
  // A gate runs along z only when it joins that way and not along x.
  const alongZ = (joins.pz || joins.nz) && !(joins.px || joins.nx);
  for (const [lo, hi] of [[0.25, 0.375], [0.5, 0.625], [0.75, 0.875]]) {
    boxes.push(alongZ
      ? { minX: 0.4375, maxX: 0.5625, minY: lo, maxY: hi, minZ: 0, maxZ: 1 }
      : { minX: 0, maxX: 1, minY: lo, maxY: hi, minZ: 0.4375, maxZ: 0.5625 });
  }
  // A brace across the middle, so it reads as a gate and not a gap in the rails.
  boxes.push(alongZ
    ? { minX: 0.4375, maxX: 0.5625, minY: 0.2, maxY: 0.9, minZ: 0.45, maxZ: 0.55 }
    : { minX: 0.45, maxX: 0.55, minY: 0.2, maxY: 0.9, minZ: 0.4375, maxZ: 0.5625 });
  return boxes;
}

/** The boxes for a shape, or the slab's if a new shape id has none registered yet. */
export function boxesFor(shape) {
  return PROP_SHAPES[shape] ?? PROP_SHAPES.slab;
}
