import { World } from './World.js';
import { ChunkGen } from './ChunkGen.js';
import { generateTerrain } from './TerrainGenerator.js';
import { planSites, outlook } from './siteFinder.js';
import { buildSites } from './features.js';
import { SITES } from '../config/sites.js';

/**
 * The world Duilt starts in: generated, not flattened, and no longer with a
 * river carved to order.
 *
 * Water used to be pinned — a river routed across the whole map and forced
 * to pass close to wherever you began, because a farm needs water within six
 * blocks and noise makes no promises about where a river runs. Asked
 * directly to stop guaranteeing it and let rivers and the sea (see
 * config/biomes.js's ocean) be genuinely random instead: the settlement now
 * moves to meet real water rather than water being carved to meet the
 * settlement. See settleOrigin/findNearbyWater below for how, and
 * World.js's own note on why the border and the biome bias that keeps the
 * plot buildable both have to move with it rather than staying pinned to
 * the world's raw origin.
 *
 * Everything else the plot needs — somewhere to land, a grove, outcrops, the
 * riverside scrub — is declared in config/sites.js and found by siteFinder.js.
 */

const DIRT = 2, WOOD = 4, SAND = 6, WATER = 11;

export const STARTER_SIZE = 32;
const RIVER_NEAR = 8;      // how close the river must pass to the settlement
const RIVER_DEPTH = 3;

function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A world with no edges, and a settlement wherever real water turned out to
 * be nearby.
 *
 * The land itself comes from the seed as you walk into it — rivers and the
 * sea both, entirely noise, nothing painted on. What still has to be
 * arranged is the first thirty-two blocks: Age 1 asks you to claim a forest
 * and break ground on a farm, and a farm needs water within six blocks. That
 * used to be guaranteed by carving a river through the plot; asked directly
 * to stop, the plot instead moves to wherever the nearest real water is —
 * see findNearbyWater and settleOrigin.
 *
 * Those chunks are marked as changed so they are written down. They are the
 * one part of an endless world the seed cannot make again, and there are
 * roughly nine of them.
 */
export function generateEndlessWorld({ height = 64, seed = Date.now() % 1000000 } = {}) {
  const gen = new ChunkGen({ seed, height, homeX: 0, homeZ: 0 });
  const world = new World({ height, gen });
  const origin = settleOrigin(world, seed);
  return { world, origin };
}

/** How far around the settlement to have real land before the plot is arranged. */
const PLOT_MARGIN = 48;

// How far outward to search for real water before giving up on finding any
// nearby, and how coarse the search is — fine enough to catch a river a few
// blocks wide without checking every single column across a wide radius.
const WATER_SEARCH_RADIUS = 160;
const WATER_SEARCH_STEP = 4;

/**
 * The nearest column with real water — a river or the sea, whichever the
 * terrain actually made — searching outward in rings from (cx, cz). Null if
 * nothing turns up within WATER_SEARCH_RADIUS.
 *
 * `gen.waterLevelAt` is pure noise math with no chunk state behind it, so
 * this costs nothing in generation: it can run, and settleOrigin can act on
 * it, before a single chunk of the world exists.
 */
function findNearbyWater(gen, cx, cz) {
  if (gen.waterLevelAt(cx, cz) > 0) return { x: cx, z: cz };
  for (let r = WATER_SEARCH_STEP; r <= WATER_SEARCH_RADIUS; r += WATER_SEARCH_STEP) {
    for (let dx = -r; dx <= r; dx += WATER_SEARCH_STEP) {
      for (let dz = -r; dz <= r; dz += WATER_SEARCH_STEP) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = cx + dx, z = cz + dz;
        if (gen.waterLevelAt(x, z) > 0) return { x, z };
      }
    }
  }
  return null;
}

export function settleOrigin(world, seed = 1) {
  const rand = rng(seed);
  const half = STARTER_SIZE / 2;

  // Water is no longer carved to order — see this file's own top note. The
  // settlement is centred on wherever the nearest real water actually is,
  // found by searching outward from the world's raw origin. The biome bias
  // that keeps the plot on buildable ground, and the border that encloses
  // it, both move to match rather than staying pinned to (0, 0) — see
  // World.js's own note on why that has to happen before a single chunk is
  // generated, not after.
  const found = findNearbyWater(world.gen, 0, 0);
  let centreX = 0, centreZ = 0;
  if (found) {
    // Set back from the water rather than centred on it — the same way the
    // old pinned river was routed to pass within RIVER_NEAR of the
    // settlement rather than straight through the middle of it, so most of
    // the plot is still clear ground to build on.
    const angle = rand() * Math.PI * 2;
    const setback = half - RIVER_NEAR;
    centreX = Math.round(found.x + Math.cos(angle) * setback);
    centreZ = Math.round(found.z + Math.sin(angle) * setback);
    world.gen.biomes.centreX = centreX;
    world.gen.biomes.centreZ = centreZ;
    world.centreX = centreX;
    world.centreZ = centreZ;
  }
  // No real water turned up within WATER_SEARCH_RADIUS — rare, but with no
  // guarantee left to fall back on the plot simply stays at the origin,
  // dry. A bucket can still carry water in by hand; nothing here pretends
  // otherwise by conjuring a river that isn't part of the world's own noise.

  const minX = centreX - half, minZ = centreZ - half;
  const region = { minX, minZ, maxX: minX + STARTER_SIZE - 1, maxZ: minZ + STARTER_SIZE - 1 };

  // The plot is arranged against real ground, so the ground has to exist.
  world.ensureAround(centreX, centreZ, PLOT_MARGIN + STARTER_SIZE);

  const plan = planSites(world, SITES, { region, rand });
  const sites = buildSites(world, plan, rand);

  const spawn = sites.find((s) => s.spec === 'spawn');
  const standing = standingSpawn(world, spawn, region);
  if (spawn) {
    const moved = Math.floor(standing.x) !== spawn.x || Math.floor(standing.z) !== spawn.z;
    spawn.x = Math.floor(standing.x);
    spawn.z = Math.floor(standing.z);
    spawn.y = standing.y;
    spawn.yaw = standing.yaw;
    if (moved) spawn.relaxed = Math.max(spawn.relaxed ?? 0, 1);
  }

  // Nothing to mark by hand: building the sites went through setBlock, which
  // marks exactly the chunks it wrote to. A blanket region would have kept
  // fifty chunks of untouched meadow along with them.

  return {
    minX, minZ, size: STARTER_SIZE,
    sites,
    trees: countTrees(world, region),
    spawn: standing,
  };
}

export function generateDuiltWorld({ sizeX = 256, sizeZ = 256, height = 64, seed = Date.now() % 1000000 } = {}) {
  const world = new World({ sizeX, sizeZ, height });
  generateTerrain(world, seed);
  const origin = carveRiverAndSettle(world, seed);
  return { world, origin };
}

/**
 * Cuts a river the length of the map, then makes sure the starting plot has
 * trees and somewhere safe to stand.
 */
export function carveRiverAndSettle(world, seed = 1) {
  const rand = rng(seed);
  const half = STARTER_SIZE / 2;
  const centreX = Math.floor(world.sizeX / 2);
  const centreZ = Math.floor(world.sizeZ / 2);
  const minX = centreX - half, minZ = centreZ - half;

  // One river is pinned near the settlement; the rest wander the map so water
  // looks like a feature of the world rather than a convenience placed for you.
  const rivers = [riverPath(world, centreX, centreZ, rand)];
  // Three more, spread across fixed bands rather than dropped at random:
  // left to chance, they bunch and leave a corner of the map bone dry.
  for (let i = 0; i < 3; i++) rivers.push(wildRiver(world, rand, i));
  for (const r of rivers) carveRiver(world, r);

  // Everything else in the plot — where you land, the grove, the outcrops, the
  // riverside scrub — comes from the declarations in config/sites.js. Adding a
  // feature is an entry there and a builder in features.js; nothing in this
  // file has to know about it.
  const region = { minX, minZ, maxX: minX + STARTER_SIZE - 1, maxZ: minZ + STARTER_SIZE - 1 };
  const plan = planSites(world, SITES, { region, rand });
  const sites = buildSites(world, plan, rand);

  const spawn = sites.find((s) => s.spec === 'spawn');
  const standing = standingSpawn(world, spawn, region);
  // Keep the plan honest: if the spawn had to move because something grew over
  // it, the recorded site moves with it, so nothing downstream reads a
  // position the player was never put in.
  if (spawn) {
    const moved = Math.floor(standing.x) !== spawn.x || Math.floor(standing.z) !== spawn.z;
    spawn.x = Math.floor(standing.x);
    spawn.z = Math.floor(standing.z);
    spawn.y = standing.y;
    spawn.yaw = standing.yaw;
    // A spawn that had to move no longer satisfies the spec it was picked
    // under — it was chosen for its flatness and its distance from everything
    // else, and it has left that spot. Recording it as relaxed is the honest
    // description, and keeps it out of the checks that hold placements to the
    // letter of their spec.
    if (moved) spawn.relaxed = Math.max(spawn.relaxed ?? 0, 1);
  }
  return {
    minX, minZ, size: STARTER_SIZE,
    rivers,
    sites,
    trees: countTrees(world, region),
    spawn: standing,
  };
}

/** Trunks standing in the plot, which is what the forest claim counts. */
function countTrees(world, region) {
  let n = 0;
  for (let x = region.minX; x <= region.maxX; x++) {
    for (let z = region.minZ; z <= region.maxZ; z++) {
      if (world.getBlock(x, world.surfaceHeight(x, z), z) === WOOD) n++;
    }
  }
  return n;
}

/**
 * Turns a chosen site into somewhere the player can actually stand.
 *
 * The plan is made before anything is built, so this is where it meets the
 * finished world. Three things it has to settle.
 *
 * Sites are block coordinates, but a player standing on a block corner
 * straddles four columns and a neighbouring hill can trap them on arrival, so
 * they are centred.
 *
 * The facing was scored against bare ground, so the view is measured again now
 * that the trees are up — otherwise you arrive looking into a wood that grew
 * in front of you.
 *
 * And the spot itself may no longer be standable: the grove is planted after
 * the spawn is chosen, and a crown that spread over the spot left the player
 * inside a canopy. Rather than teach every builder to avoid the spawn — which
 * would be a rule to remember for every feature added later — the spawn is
 * simply re-checked against what is actually there, and moved to the nearest
 * clear spot if it has to be.
 */
const SPAWN_HEADROOM = 3;
// How open the view has to be to count as clear — the same bar
// standingSpawn already holds a measured yaw to before trusting it.
const MIN_SPAWN_VIEW = 4;

function standable(world, x, z) {
  if (!world.inBounds(x, 0, z)) return false;
  const y = world.surfaceHeight(x, z);
  const under = world.getBlock(x, y - 1, z);
  if (under === 0 || under === WATER) return false;
  for (let i = 0; i < SPAWN_HEADROOM; i++) {
    if (!world.inBounds(x, y + i, z) || world.getBlock(x, y + i, z) !== 0) return false;
  }
  return true;
}

/**
 * The nearest spot to (x, z) that is still fit to stand on.
 *
 * The exact point is only taken as-is if it's also got a clear view — sites
 * are scored against bare ground and the grove is planted afterwards (see
 * this function's own doc comment above), so a spot that was open when it
 * was chosen can end up facing straight into a trunk that grew there since.
 * Reported directly as landing nose-first in a tree on arrival: the same
 * ring search that already runs when the point isn't standable at all now
 * also runs when it's standable but blind, so a facing check away is one
 * more thing this doesn't have to hope never happens.
 */
function nearestStandable(world, x, z, region) {
  if (standable(world, x, z) && outlook(world, x, z, { at: 2, range: 16 }).open >= MIN_SPAWN_VIEW) {
    return { x, z };
  }
  // The first ring out with *any* standable candidate isn't necessarily a
  // clear one — a lone flat spot with a trunk right behind it used to win by
  // default over an equally near ring with real sightlines one step further
  // out, because the old version stopped at the first radius that had
  // anything at all. This keeps the best candidate seen so far and keeps
  // searching outward — still bounded by the same STARTER_SIZE cap either
  // way — until the view actually clears MIN_SPAWN_VIEW, only settling for
  // whatever it found if nothing in the whole plot does.
  let best = null;
  for (let r = 1; r <= STARTER_SIZE; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const px = x + dx, pz = z + dz;
        if (px < region.minX || px > region.maxX || pz < region.minZ || pz > region.maxZ) continue;
        if (!standable(world, px, pz)) continue;
        const view = outlook(world, px, pz, { at: 2, range: 16 }).open;
        if (!best || view > best.view) best = { x: px, z: pz, view };
      }
    }
    if (best && best.view >= MIN_SPAWN_VIEW) return best;
  }
  return best ?? { x, z };
}

function standingSpawn(world, site, region) {
  const planned = site
    ? { x: site.x, z: site.z }
    : { x: region.minX + STARTER_SIZE / 2, z: region.minZ + STARTER_SIZE / 2 };

  const spot = nearestStandable(world, planned.x, planned.z, region);
  const view = outlook(world, spot.x, spot.z, { at: 2, range: 16 });
  return {
    x: spot.x + 0.5,
    y: world.surfaceHeight(spot.x, spot.z),
    z: spot.z + 0.5,
    yaw: view.best >= 4 ? view.yaw : (site?.yaw ?? 0),
    pitch: site?.pitch ?? -0.16,
  };
}

/**
 * The river's centre-line, one x per z, wandering but pinned to pass within
 * RIVER_NEAR of the settlement so the first farm is always possible.
 */
function riverPath(world, centreX, centreZ, rand) {
  const amp = 14 + rand() * 22;
  const wavelength = 70 + rand() * 90;
  const phase = rand() * Math.PI * 2;
  const drift = (rand() - 0.5) * 0.12;

  // Offset chosen so the curve is close to the centre exactly where it matters.
  const atCentre = Math.sin((centreZ / wavelength) + phase) * amp + drift * centreZ;
  const side = rand() < 0.5 ? -1 : 1;
  const target = centreX + side * (2 + rand() * (RIVER_NEAR - 2));
  const offset = target - atCentre;

  const xs = new Int32Array(world.sizeZ);
  for (let z = 0; z < world.sizeZ; z++) {
    const x = Math.sin((z / wavelength) + phase) * amp + drift * z + offset;
    xs[z] = Math.max(3, Math.min(world.sizeX - 4, Math.round(x)));
  }
  return { axis: 'z', coords: xs, width: 2 + Math.round(rand() * 2) };
}

/**
 * A river with nowhere in particular to be. Alternates orientation so the map
 * gets crossings and islands rather than a set of parallel stripes.
 */
function wildRiver(world, rand, index) {
  const axis = index % 2 === 0 ? 'x' : 'z';
  const along = axis === 'z' ? world.sizeZ : world.sizeX;
  const across = axis === 'z' ? world.sizeX : world.sizeZ;

  const amp = 14 + rand() * 18;
  const wavelength = 60 + rand() * 110;
  const phase = rand() * Math.PI * 2;
  const drift = (rand() - 0.5) * 0.1;
  // Bands at roughly a fifth, a half and four fifths across, jittered a little.
  const band = 0.2 + index * 0.3 + (rand() - 0.5) * 0.1;
  const base = across * band;

  const coords = new Int32Array(along);
  for (let i = 0; i < along; i++) {
    const v = Math.sin((i / wavelength) + phase) * amp + drift * i + base;
    coords[i] = Math.max(3, Math.min(across - 4, Math.round(v)));
  }
  return { axis, coords, width: 1 + Math.round(rand() * 2) };
}

/** Distance from a column to the nearest river centre-line. */
function distanceToRivers(rivers, x, z) {
  let best = Infinity;
  for (const r of rivers) {
    const d = r.axis === 'z' ? Math.abs(x - r.coords[z]) : Math.abs(z - r.coords[x]);
    best = Math.min(best, d - r.width);
  }
  return best;
}

/**
 * Cuts the channel. The water surface follows a smoothed version of the land so
 * the river runs downhill in steps rather than leaping about with every bump.
 */
function carveRiver(world, river) {
  const { axis, coords, width } = river;
  const along = coords.length;
  // `from` shifts the whole run along its axis, so a river can start somewhere
  // other than zero — which is what a bounded river in an endless world needs.
  const base = river.from ?? 0;
  const at = (i, c) => (axis === 'z' ? [c, base + i] : [base + i, c]);   // -> [x, z]

  // Smooth the terrain height along the river's length.
  const raw = new Int32Array(along);
  for (let i = 0; i < along; i++) {
    const [x, z] = at(i, coords[i]);
    raw[i] = world.surfaceHeight(x, z) - 1;
  }
  const level = new Int32Array(along);
  const span = 12;
  for (let i = 0; i < along; i++) {
    let sum = 0, n = 0;
    for (let k = -span; k <= span; k++) {
      const j = i + k;
      if (j < 0 || j >= along) continue;
      sum += raw[j]; n++;
    }
    level[i] = Math.round(sum / n);
  }

  for (let i = 0; i < along; i++) {
    const cx = coords[i];
    const surface = level[i];
    const bed = Math.max(2, surface - RIVER_DEPTH);
    const bankAt = width + 1;

    for (let dx = -bankAt; dx <= bankAt; dx++) {
      const [x, z] = at(i, cx + dx);
      if (!world.inBounds(x, 0, z)) continue;
      const dist = Math.abs(dx);

      if (dist <= width) {
        // Channel: clear the column, lay a bed, fill to just under the bank.
        for (let y = bed; y < world.height; y++) world.setBlock(x, y, z, 0);
        world.setBlock(x, bed, z, SAND);
        for (let y = bed + 1; y <= surface; y++) world.setBlock(x, y, z, WATER);
        world.setSurfaceHeight(x, z, surface + 1);
      } else {
        // Bank: flatten to the water's shoulder so the edge is walkable.
        const shoulder = surface + 1;
        for (let y = shoulder + 1; y < world.height; y++) world.setBlock(x, y, z, 0);
        for (let y = Math.max(0, shoulder - 3); y < shoulder; y++) {
          if (world.getBlock(x, y, z) === 0) world.setBlock(x, y, z, DIRT);
        }
        world.setBlock(x, shoulder, z, SAND);
        world.setSurfaceHeight(x, z, shoulder + 1);
      }
    }
  }
}
