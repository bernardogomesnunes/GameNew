/**
 * Leaves that lose their tree fall (backlog batch 2: "leaves decay when
 * their tree is gone"). Cut the last of a trunk and the canopy it held does
 * not hang in the air for ever: each leaf that can no longer reach wood
 * through other leaves goes a moment later — one here, one there, so the
 * crown thins rather than vanishing in a frame.
 *
 * Only ever looked for round a trunk block that has just gone, so a hedge
 * you built from leaves, with no tree to lose, stays a hedge.
 */

export const LOGS = new Set([4, 41, 43]);
export const LEAVES = new Set([5, 42, 44]);
/**
 * How far a leaf can be from wood, counted through leaves, and still hold on.
 * Generous on purpose: a giant's crown (ChunkGen.plantGiant) runs a dozen
 * and more out from its trunk, so in practice this is "joined to any wood at
 * all" — and a canopy two trees share stays up while either still stands.
 */
export const LEAF_REACH = 16;
/** How far round a cut trunk to look for leaves left hanging. */
export const DECAY_RADIUS = 12;

const STEPS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** Whether the leaf at (x, y, z) still reaches wood through leaves within `reach` steps. */
export function leafHeld(world, x, y, z, reach = LEAF_REACH) {
  const seen = new Set([`${x},${y},${z}`]);
  let frontier = [[x, y, z]];
  for (let d = 0; d < reach && frontier.length; d++) {
    const next = [];
    for (const [cx, cy, cz] of frontier) {
      for (const [dx, dy, dz] of STEPS) {
        const nx = cx + dx, ny = cy + dy, nz = cz + dz;
        const key = `${nx},${ny},${nz}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const id = world.getBlock(nx, ny, nz);
        if (LOGS.has(id)) return true;
        if (LEAVES.has(id)) next.push([nx, ny, nz]);
      }
    }
    frontier = next;
  }
  return false;
}

/**
 * Every leaf round (x, y, z) left with no wood to hold on to.
 *
 * Only leaves joined, through leaves, to the cell that changed are looked at
 * — a hedge a few blocks off, touching nothing, is not this tree's. They are
 * gathered out to DECAY_RADIUS + LEAF_REACH, so a leaf near the edge that
 * holds on through leaves further out still counts as held. Then one pass
 * outward from the wood among them marks everything held; the rest, within
 * DECAY_RADIUS, are what falls.
 */
export function orphanLeaves(world, x, y, z, radius = DECAY_RADIUS) {
  const far = radius + LEAF_REACH;
  const key = (a, b, c) => `${a},${b},${c}`;
  const region = new Map();
  let frontier = [[x, y, z]];
  const start = new Set([key(x, y, z)]);
  while (frontier.length) {
    const next = [];
    for (const [cx, cy, cz] of frontier) {
      for (const [dx, dy, dz] of STEPS) {
        const nx = cx + dx, ny = cy + dy, nz = cz + dz;
        const k = key(nx, ny, nz);
        if (region.has(k) || start.has(k)) continue;
        if (Math.max(Math.abs(nx - x), Math.abs(ny - y), Math.abs(nz - z)) > far) continue;
        if (!LEAVES.has(world.getBlock(nx, ny, nz))) continue;
        region.set(k, [nx, ny, nz]);
        next.push([nx, ny, nz]);
      }
    }
    frontier = next;
  }

  // Held: one step from wood, then out through leaves up to LEAF_REACH.
  const held = new Set();
  let ring = [];
  for (const [k, p] of region) {
    if (STEPS.some(([dx, dy, dz]) => LOGS.has(world.getBlock(p[0] + dx, p[1] + dy, p[2] + dz)))) { held.add(k); ring.push(p); }
  }
  for (let d = 1; d < LEAF_REACH && ring.length; d++) {
    const next = [];
    for (const [cx, cy, cz] of ring) {
      for (const [dx, dy, dz] of STEPS) {
        const k = key(cx + dx, cy + dy, cz + dz);
        if (held.has(k) || !region.has(k)) continue;
        held.add(k);
        next.push(region.get(k));
      }
    }
    ring = next;
  }

  const out = [];
  for (const [k, [lx, ly, lz]] of region) {
    if (held.has(k)) continue;
    if (Math.max(Math.abs(lx - x), Math.abs(ly - y), Math.abs(lz - z)) > radius) continue;
    out.push({ x: lx, y: ly, z: lz });
  }
  return out;
}
