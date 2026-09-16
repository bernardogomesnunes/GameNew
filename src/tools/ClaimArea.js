/**
 * Two corners on the ground, and the building that stands in them.
 *
 * Claiming used to mean pointing at what you built and letting the game follow
 * the blocks outwards. That works for a house, which is a thing you stacked up
 * on the ground — and it cannot work at all for a quarry or a mine, which are
 * holes. The flood fill refuses to leave the original ground level (see
 * PointerPick.pickBuild, which only walks blocks *above* the terrain height),
 * so every attempt to claim something you dug answered "point at what you
 * built" no matter where you stood. That is Age 2 unfinishable.
 *
 * So a claim can also be an area you draw: tap one corner, tap the opposite
 * one. The two taps give the footprint, because a footprint is the thing you
 * can see and stand next to. The height is then whatever is actually there
 * within it — from the lowest solid block to the highest — which means the
 * same two taps round a house take its walls and roof, and round a pit take
 * the pit.
 */

/** The box two corners make on the ground, regardless of which was tapped first. */
export function footprintOf(a, b) {
  if (!a || !b) return null;
  return {
    minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x),
    minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z),
  };
}

/** How many blocks across the footprint is, on its longer side. */
export function spanOf(foot) {
  if (!foot) return 0;
  return Math.max(foot.maxX - foot.minX + 1, foot.maxZ - foot.minZ + 1);
}

/**
 * The region a footprint claims: the ground you drew, and what stands in it.
 *
 * Anchored on the corners you tapped and grown *upward* only. Searching both
 * ways looks reasonable and is not: below the floor of a quarry is the rest of
 * the mountain, so a box that reached down took a solid cube of rock with
 * nothing cut out of it, and the claim failed on its own contents.
 *
 * `lift` is the least height a flat pair of corners gets, so tapping two
 * points on the floor of a pit claims the air above them — the hole is the
 * thing you dug, and a claim with no air in it has not been dug at all.
 * `reach` caps the climb, so a box drawn at the foot of a tower does not
 * swallow the tower.
 */
export function claimRegion(world, a, b, { reach = 16, lift = 3 } = {}) {
  const foot = footprintOf(a, b);
  if (!world || !foot) return null;

  const minY = Math.min(a.y, b.y);
  const ceiling = Math.min(world.height - 1, minY + reach);

  let top = Math.max(a.y, b.y);
  for (let x = foot.minX; x <= foot.maxX; x++) {
    for (let z = foot.minZ; z <= foot.maxZ; z++) {
      for (let y = ceiling; y > top; y--) {
        if (world.inBounds(x, y, z) && world.getBlock(x, y, z) !== 0) { top = y; break; }
      }
    }
  }
  return { ...foot, minY, maxY: Math.min(ceiling, Math.max(top, minY + lift)) };
}

/** Every solid block inside a region, which is what the claim tests read. */
export function blocksIn(world, region) {
  const out = [];
  if (!world || !region) return out;
  for (let x = region.minX; x <= region.maxX; x++) {
    for (let y = region.minY; y <= region.maxY; y++) {
      for (let z = region.minZ; z <= region.maxZ; z++) {
        const type = world.getBlock(x, y, z);
        if (type !== 0) out.push({ x, y, z, type });
      }
    }
  }
  return out;
}

/**
 * What to say while somebody is drawing one.
 *
 * Two taps is only obvious once you have done it, so the readout says which
 * tap it is waiting for, and then how big the thing you have drawn is.
 */
export function claimHint(a, aim) {
  if (!a) return { name: 'Claim an area', target: 'Tap one corner', hint: 'Then the opposite corner' };
  if (!aim) return { name: 'Claim an area', target: 'Now the opposite corner', hint: 'Point at the ground' };
  const foot = footprintOf(a, aim);
  const w = foot.maxX - foot.minX + 1, d = foot.maxZ - foot.minZ + 1;
  return { name: 'Claim an area', target: `${w} × ${d}`, hint: 'Tap to take this area' };
}
