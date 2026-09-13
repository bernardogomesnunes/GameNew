import { AIR, BLOCKS } from '../config/blocks.js';

/**
 * Finding places in the world that satisfy a description.
 *
 * Every generated thing needs somewhere to go, and the question is always the
 * same shape: flat enough, the right ground, not in the river, not on top of
 * something already placed, with room above and a view out. Written by hand
 * that becomes one bespoke search loop per feature — which is exactly what this
 * file replaces. Three of them had already accumulated, each with its own
 * slightly different idea of "flat", and a fourth was due with every new
 * feature.
 *
 * So: features declare what they need (see config/sites.js) and this finds it.
 * Adding woodland, a ruin, an ore seam or a landmark is then a config entry,
 * not a new algorithm.
 *
 * Nothing here writes to the world. It answers "where", and the caller decides
 * what to build there.
 */

const BY_NAME = new Map(BLOCKS.map((b) => [b.name.toLowerCase(), b.id]));

/** Block ids for a list of names, so specs can say 'grass' instead of 1. */
export function idsOf(names) {
  return names.map((n) => {
    const id = BY_NAME.get(String(n).toLowerCase());
    if (id == null) throw new Error(`No block named "${n}"`);
    return id;
  });
}

// ---------------------------------------------------------------------------
// The vocabulary: small questions about one spot, shared by every spec.
// ---------------------------------------------------------------------------

/** The block you would be standing on, and the first free cell above it. */
export function footing(world, x, z) {
  const y = world.surfaceHeight(x, z);
  return { y, ground: world.getBlock(x, y - 1, z) };
}

/** Clear cells above the surface. Stops counting at `want` — it's a gate, not a survey. */
export function headroom(world, x, z, want) {
  const { y } = footing(world, x, z);
  for (let i = 0; i < want; i++) {
    if (!world.inBounds(x, y + i, z) || world.getBlock(x, y + i, z) !== AIR) return i;
  }
  return want;
}

/**
 * Total height change to the four neighbours at `reach`. Lower is flatter.
 * Summed rather than maxed so a spot that slopes gently in every direction
 * still scores worse than one that is level, which is what you want for
 * anything with a footprint.
 */
export function roughness(world, x, z, reach = 1) {
  const h = world.surfaceHeight(x, z);
  let total = 0;
  for (const [dx, dz] of [[reach, 0], [-reach, 0], [0, reach], [0, -reach]]) {
    total += Math.abs(world.surfaceHeight(x + dx, z + dz) - h);
  }
  return total;
}

const R2 = Math.SQRT1_2;
// Unit vectors. A diagonal taken as [1,1] walks corner to corner through a
// different set of blocks than a camera ray does, which is how a direction that
// measured clear turned out to be a wall.
const DIRECTIONS = [
  [0, -1], [R2, -R2], [1, 0], [R2, R2], [0, 1], [-R2, R2], [-1, 0], [-R2, -R2],
];

/**
 * How far you can see from a spot, and which way is clearest.
 *
 * Cast from the middle of the block, because that is where things stand. A spot
 * can be perfectly flat and still be a terrible place to arrive, because it sits
 * at the foot of a hill and the whole view is one wall.
 */
export function outlook(world, x, z, { at = 1, range = 14 } = {}) {
  const { y } = footing(world, x, z);
  const eye = y + at - 1;
  let open = 0, best = -1, bestDir = DIRECTIONS[0];

  for (const dir of DIRECTIONS) {
    let run = 0;
    for (let k = 1; k <= range; k++) {
      const px = Math.floor(x + 0.5 + dir[0] * k);
      const pz = Math.floor(z + 0.5 + dir[1] * k);
      if (!world.inBounds(px, eye, pz) || world.getBlock(px, eye, pz) !== AIR) break;
      run = k;
    }
    open += run;
    if (run > best) { best = run; bestDir = dir; }
  }
  // Forward is (-sin yaw, 0, -cos yaw), so this points the camera down bestDir.
  return { open, best, yaw: Math.atan2(-bestDir[0], -bestDir[1]) };
}

/**
 * Distance to the nearest block of a kind, searched outward in rings so a close
 * match costs almost nothing. Returns `max + 1` when there is none in range,
 * which keeps callers from having to special-case Infinity.
 */
export function distanceTo(world, x, z, ids, max = 24) {
  const set = new Set(ids);
  const { y } = footing(world, x, z);
  for (let r = 0; r <= max; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const px = x + dx, pz = z + dz;
        if (!world.inBounds(px, 0, pz)) continue;
        // Look a little above and below the local surface: a river sits lower
        // than the bank you are standing on.
        for (let dy = -3; dy <= 1; dy++) {
          if (set.has(world.getBlock(px, y + dy, pz))) return r;
        }
      }
    }
  }
  return max + 1;
}

/** Every cell of a footprint sits on the right ground and is level enough. */
function footprintOk(world, x, z, fp, groundIds, maxStep) {
  const half = { w: Math.floor(fp.w / 2), d: Math.floor(fp.d / 2) };
  const base = world.surfaceHeight(x, z);
  for (let dx = -half.w; dx <= half.w; dx++) {
    for (let dz = -half.d; dz <= half.d; dz++) {
      const px = x + dx, pz = z + dz;
      if (!world.inBounds(px, 0, pz)) return false;
      if (Math.abs(world.surfaceHeight(px, pz) - base) > maxStep) return false;
      if (groundIds && !groundIds.has(world.getBlock(px, world.surfaceHeight(px, pz) - 1, pz))) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// The search
// ---------------------------------------------------------------------------

/**
 * Scores one spot against a spec. Returns null when a hard requirement fails,
 * otherwise a score where lower is better, plus whatever the caller may want.
 *
 * `relax` loosens the requirements that are worth loosening — a dense wood may
 * genuinely have no spot with a fifteen block view, and refusing to place
 * anything is a worse answer than placing it somewhere merely decent.
 */
function assess(world, x, z, spec, ctx, relax) {
  const needs = spec.needs ?? {};
  const { y, ground } = footing(world, x, z);

  // What each relaxation step actually gives up. Ground type goes last,
  // because a grove on sand is odd but a world with no grove in it cannot be
  // finished — one of its Age 1 goals is to claim a forest.
  const anyGround = relax >= 3;
  if (ctx.groundIds && !anyGround && !ctx.groundIds.has(ground)) return null;
  if (anyGround && ground === AIR) return null;

  if (needs.headroom && headroom(world, x, z, needs.headroom) < needs.headroom) return null;

  const rough = roughness(world, x, z, needs.reach ?? 1);
  if (needs.flatness != null && rough > needs.flatness + relax * 2) return null;

  if (needs.footprint) {
    // Shrink the footprint as well as loosening its tolerance: a big feature
    // in a broken landscape can always be built a little smaller.
    const shrink = Math.min(relax, Math.floor(Math.min(needs.footprint.w, needs.footprint.d) / 2) - 1);
    const fp = { w: needs.footprint.w - shrink * 2, d: needs.footprint.d - shrink * 2 };
    if (!footprintOk(world, x, z, fp, anyGround ? null : ctx.groundIds,
        (needs.footprintStep ?? 1) + relax)) return null;
  }

  let waterDist = null;
  if (needs.water) {
    const max = needs.water.max ?? 24;
    waterDist = distanceTo(world, x, z, ctx.waterIds, max + relax * 4);
    if (waterDist < Math.max(0, (needs.water.min ?? 0) - relax)) return null;
    if (waterDist > max + relax * 4) return null;
  }

  // The view is the expensive question, so it is asked last.
  let view = null;
  if (needs.view != null || spec.facing === 'openest' || spec.prefer?.view) {
    view = outlook(world, x, z, { at: needs.viewAt ?? 2, range: needs.viewRange ?? 14 });
    if (needs.view != null && view.best < Math.max(1, needs.view - relax * 3)) return null;
  }

  const w = spec.prefer ?? {};
  let score = 0;
  score += (w.flat ?? 0) * rough;
  if (view) score += (w.view ?? 0) * -view.open;
  if (waterDist != null && w.water) score += w.water * Math.abs(waterDist - (needs.water.ideal ?? waterDist));

  return { x, z, y, score, rough, view, waterDist };
}

/** Chebyshev distance, which is the right one for square footprints. */
function apart(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}

/**
 * Finds where one spec's instances go.
 *
 * Candidates are gathered on a stride, scored, then taken best-first while
 * honouring the spacing rules. If that yields fewer than asked for, the
 * requirements are loosened a step and it tries again — so a spec is a
 * preference with a floor, not a promise the terrain may be unable to keep.
 */
export function findSites(world, spec, { region, placed = [], rand = Math.random }) {
  const ctx = {
    groundIds: spec.needs?.ground ? new Set(idsOf(spec.needs.ground)) : null,
    waterIds: idsOf(['water']),
  };
  const want = typeof spec.count === 'number'
    ? spec.count
    : (spec.count?.min ?? 1) + Math.floor(rand() * (((spec.count?.max ?? 1) - (spec.count?.min ?? 1)) + 1));
  if (want <= 0) return [];

  const stride = spec.stride ?? 1;
  const margin = spec.margin ?? 1;

  const steps = spec.relaxSteps ?? 3;
  for (let relax = 0; relax <= steps; relax++) {
    const candidates = [];
    for (let x = region.minX + margin; x <= region.maxX - margin; x += stride) {
      for (let z = region.minZ + margin; z <= region.maxZ - margin; z += stride) {
        const hit = assess(world, x, z, spec, ctx, relax);
        if (hit) candidates.push(hit);
      }
    }
    if (!candidates.length) continue;

    // A little noise in the ordering, so two worlds with the same terrain do
    // not put everything in exactly the same place.
    for (const c of candidates) c.score += (rand() - 0.5) * (spec.jitter ?? 0);
    candidates.sort((a, b) => a.score - b.score);

    // Crowding is the cheapest thing to give up, so it loosens fastest.
    const spacing = Math.max(1, (spec.spacing ?? 1) - relax * 2);
    const clearBy = Math.max(1, (spec.clearOfDistance ?? spec.spacing ?? 1) - relax * 2);
    const taken = [];
    const others = placed.filter((p) => (spec.clearOf ?? []).includes(p.spec));
    for (const c of candidates) {
      if (taken.some((t) => apart(t, c) < spacing)) continue;
      if (others.some((o) => apart(o, c) < clearBy)) continue;
      taken.push(c);
      if (taken.length >= want) break;
    }
    if (taken.length >= want || (relax === steps && taken.length)) {
      return taken.map((t) => site(spec, t, relax, world));
    }
  }

  // A spec marked essential must land somewhere: the game has goals that
  // depend on it existing, so "nowhere in this world suited it" is not an
  // answer the player can do anything with. Anything solid, dry and level
  // enough to stand a feature on will do.
  if (spec.essential) {
    const spot = anywhereSolid(world, region, margin, ctx, rand, spec);
    if (spot) return [site(spec, spot, (spec.relaxSteps ?? 3) + 1, world)];
  }
  return [];
}

function site(spec, spot, relaxed, world) {
  let yaw = 0;
  if (spec.facing === 'openest') {
    // The scored candidates already carry a view; the fallback does not, so
    // work one out rather than leaving it facing north into whatever is there.
    yaw = spot.view?.yaw ?? (world ? outlook(world, spot.x, spot.z, { at: 2 }).yaw : 0);
  }
  return {
    spec: spec.id,
    x: spot.x, y: spot.y, z: spot.z,
    yaw,
    pitch: spec.pitch ?? 0,
    relaxed,
  };
}

/**
 * The last resort: the flattest ground in the region that is still fit to
 * stand a feature on.
 *
 * "Fit to stand on" is not negotiable even here. An earlier version took the
 * flattest solid ground and nothing else, which put the player inside a tree
 * or ankle-deep in the river on the worlds where it fired — a worse outcome
 * than the missing feature it existed to prevent. So the hard floor is: dry,
 * solid underfoot, and whatever headroom the spec asked for.
 */
function anywhereSolid(world, region, margin, ctx, rand, spec) {
  const want = spec?.needs?.headroom ?? 1;
  let best = null;
  for (let x = region.minX + margin; x <= region.maxX - margin; x++) {
    for (let z = region.minZ + margin; z <= region.maxZ - margin; z++) {
      const { y, ground } = footing(world, x, z);
      if (ground === AIR || ctx.waterIds.includes(ground)) continue;
      if (headroom(world, x, z, want) < want) continue;
      const rough = roughness(world, x, z) + (rand() - 0.5);
      if (!best || rough < best.rough) best = { x, z, y, rough };
    }
  }
  // A region with nowhere to stand at all is better served by a shorter margin
  // than by refusing: the plot is the player's whole world at this point.
  if (!best && margin > 0) return anywhereSolid(world, region, 0, ctx, rand, spec);
  return best;
}

/**
 * Runs a whole list of specs in order, so later ones can be told to keep clear
 * of earlier ones. Returns every placement, tagged with the spec that asked
 * for it.
 */
export function planSites(world, specs, { region, rand = Math.random }) {
  const placed = [];
  for (const spec of specs) {
    for (const site of findSites(world, spec, { region, placed, rand })) placed.push(site);
  }
  return placed;
}
