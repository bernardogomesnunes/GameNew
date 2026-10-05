import { pickFootprint } from './PointerPick.js';
import { roofPart, roofBlock, ROOF_MATERIALS, BLOCKS_BY_ID } from '../config/blocks.js';

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

/**
 * The shape's blocks over a pick, as `{ x, dy, z, slope }` — dy above the
 * eave. `slope` is set on the top block of each column: which way the roof
 * climbs there and what piece it is (see slopeAt), for when it's laid in
 * roof tiles rather than in plain blocks.
 */
export function roofBlocks(pick, { shape, turn = 0 }) {
  if (!pick || !shape) return [];
  const run = shape.run ?? 1;
  const t = ((turn % shape.turns) + shape.turns) % shape.turns;
  const out = [];
  for (const [cell, d] of pick.spans) {
    const comma = cell.indexOf(',');
    const x = Number(cell.slice(0, comma)), z = Number(cell.slice(comma + 1));
    const rises = shape.rises({ ...d, turn: t, run });
    const top = Math.max(...rises);
    for (const dy of rises) out.push({ x, dy, z, slope: dy === top ? slopeAt(shape, d, t) : null });
  }
  return out;
}

/**
 * What a roof tile should be at the top of a column: { kind, facing }, or
 * null where a slope doesn't belong (a flat roof). Worked out from the same
 * distances to the edges the shape reads its heights from — a slope climbs
 * away from the nearest eave, and where two eaves are equally near it's the
 * top: a ridge, or the peak of a hipped roof. Corners where two slopes meet
 * are left to the tiles themselves, which turn them (see world/slopes.js).
 */
export function slopeAt(shape, { xm, xp, zm, zp }, turn) {
  // Facing climbs: 0 towards -z, 1 +x, 2 +z, 3 -x — so away from the -x
  // eave is facing 1, and so on.
  if (shape.id === 'gable') {
    const alongX = turn % 2 === 1;
    const [lo, hi, up, down] = alongX ? [zm, zp, 2, 0] : [xm, xp, 1, 3];
    if (lo === hi) return { kind: alongX ? 'ridge_x' : 'ridge_z' };
    return { kind: 'steep', facing: lo < hi ? up : down };
  }
  if (shape.id === 'hip') {
    const near = Math.min(xm, xp, zm, zp);
    const onX = xm === near && xp === near, onZ = zm === near && zp === near;
    if (onX && onZ) return { kind: 'peak' };
    if (onX) return (zm === near || zp === near) ? { kind: 'peak' } : { kind: 'ridge_z' };
    if (onZ) return (xm === near || xp === near) ? { kind: 'peak' } : { kind: 'ridge_x' };
    const facing = xm === near ? 1 : xp === near ? 3 : zm === near ? 2 : 0;
    return { kind: 'steep', facing };
  }
  if (shape.id === 'lean') {
    // A shallow pitch rises half a block a column: the low half, then the high.
    const away = [xm, zm, xp, zp][turn % 4];
    const facing = [1, 2, 3, 0][turn % 4];
    return { kind: (away - 1) % 2 === 0 ? 'lo' : 'hi', facing };
  }
  return null;
}

/**
 * The block to lay for one of roofBlocks' blocks, holding `type`. Anything
 * but roof tiles is laid as it is. Roof tiles go on top as the right piece
 * turned the right way, with the matching brick or stone under them where a
 * roof needs solid courses — the ends of a gable — and on a flat roof.
 */
export function roofTypeFor(type, block, under = null) {
  const part = roofPart(type);
  if (!part) return type;
  if (!block.slope) return gableFill(under) ?? ROOF_MATERIALS[part.mat].wall;
  return roofBlock({ mat: part.mat, ...block.slope });
}

/**
 * What the solid courses under a roof are made of: the wall they stand on.
 * Asked for directly: "can't we know which block is below and fill the space
 * with that texture? I know that this might be weird in some cases but
 * majority will be fine" — a gable end in brick over a plank house was the
 * one thing that gave a hand-built roof away. Only a plain whole block will
 * do; anything else (air, glass, a door, a stair) falls back to the tiles'
 * own brick or stone.
 */
export function gableFill(id) {
  const spec = id ? BLOCKS_BY_ID.get(id) : null;
  if (!spec || spec.shape || spec.transparent || spec.roof || spec.stateOf != null) return null;
  return id;
}

/** The block a roof column stands on: the top of its wall, just under the eave. */
export function roofUnder(world, x, eave, z) {
  return world.getBlock(x, eave - 1, z);
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
    const next = roofTypeFor(type, b, roofUnder(world, b.x, eave, b.z));
    if (prev === next) continue;
    changes.push({ x: b.x, y, z: b.z, prev, next });
  }
  return changes;
}

/** How tall the shape goes over the eave — for the preview's outline. */
export function roofPeak(blocks) {
  let peak = 0;
  for (const b of blocks) if (b.dy > peak) peak = b.dy;
  return peak;
}
