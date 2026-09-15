import { pickFootprint } from './PointerPick.js';

/**
 * Turning a roof shape into blocks over the building you are pointing at.
 *
 * Where the eave sits is not a choice you make: it is the top of the wall you
 * aimed at, because that is what a roof rests on. No box to line up, no grid to
 * snap to, and a 7-wide house gets a 7-wide roof — which the old selector could
 * not do at all, since it only came in powers of two.
 *
 * That rule on its own has one bad day, and it is the common one: you put a
 * gable up, see it facing the wrong way, turn it and place again — and the
 * second roof sits on the first, because the first is now the top of the
 * building. So the caller can pass the eave it used last time (see the relay in
 * Game), and the tool re-lays at that height and clears what the new shape no
 * longer covers. Anything else about the pick changes, and it falls back.
 *
 * And what it is made of: whatever you are holding. A roof out of a fixed
 * material would be one more thing to fight, and the block in your hand is
 * already the answer to "what do you want this made of".
 */

/** The shape of the roof-to-be: where it sits and what it covers. Null off a build. */
export function roofPick(world, hit, opts) {
  return pickFootprint(world, hit, opts);
}

/** The shape's blocks over a pick, as `{ x, dy, z }` — dy above the eave. */
export function roofBlocks(pick, { shape, turn = 0 }) {
  if (!pick || !shape) return [];
  const run = shape.run ?? 1;
  const t = ((turn % shape.turns) + shape.turns) % shape.turns;
  const out = [];
  for (const [cell, d] of pick.spans) {
    const comma = cell.indexOf(',');
    const x = Number(cell.slice(0, comma)), z = Number(cell.slice(comma + 1));
    for (const dy of shape.rises({ ...d, turn: t, run })) out.push({ x, dy, z });
  }
  return out;
}

/** The `{ x, y, z, prev, next }` changes for roofing a pick at a given eave. */
export function roofPlan(world, pick, { shape, turn = 0, type, base = null }) {
  if (!pick) return [];
  const eave = base ?? pick.y + 1;
  const changes = [];
  for (const b of roofBlocks(pick, { shape, turn })) {
    const y = eave + b.dy;
    if (!world.inBounds(b.x, y, b.z)) continue;
    const prev = world.getBlock(b.x, y, b.z);
    if (prev === type) continue;
    changes.push({ x: b.x, y, z: b.z, prev, next: type });
  }
  return changes;
}

/** How tall the shape goes over the eave — for the preview's outline. */
export function roofPeak(blocks) {
  let peak = 0;
  for (const b of blocks) if (b.dy > peak) peak = b.dy;
  return peak;
}
