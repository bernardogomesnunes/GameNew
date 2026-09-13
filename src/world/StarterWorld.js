import { World } from './World.js';
import { generateTerrain } from './TerrainGenerator.js';
import { planSites, outlook } from './siteFinder.js';
import { buildSites } from './features.js';
import { SITES } from '../config/sites.js';

/**
 * The world Duilt starts in: generated, not flattened — but with a river.
 *
 * Natural terrain is what makes the place worth looking at, so the land is
 * rolled as usual. What is *not* left to chance is water: a river is routed
 * across the whole map and pinned to pass close to where you begin. It needn't
 * run through your first 32 blocks — near enough to farm from the edge is
 * enough — and because it spans the map, every ring you unlock later has water
 * in it too, without any further arrangement.
 *
 * Everything else the plot needs — somewhere to land, a grove, outcrops, the
 * riverside scrub — is declared in config/sites.js and found by siteFinder.js.
 * This file's job is the water, because a river has to be cut across the whole
 * map in one pass and cannot be expressed as "a spot that satisfies X".
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
  return {
    minX, minZ, size: STARTER_SIZE,
    rivers,
    sites,
    trees: countTrees(world, region),
    spawn: standingSpawn(world, spawn, region),
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
 * Two things the site finder can't do on its own. Sites are block coordinates,
 * but a player standing on a block corner straddles four columns and a
 * neighbouring hill can trap them on arrival, so this centres them. And the
 * plan was made before the grove was planted, which means the facing was
 * scored against bare ground — so the view is measured again now that the
 * trees are up, and you are not left staring into a wood that grew in front
 * of you.
 */
function standingSpawn(world, site, region) {
  if (!site) {
    const cx = region.minX + STARTER_SIZE / 2, cz = region.minZ + STARTER_SIZE / 2;
    return { x: cx + 0.5, y: world.surfaceHeight(cx, cz), z: cz + 0.5, yaw: 0, pitch: -0.16 };
  }
  const view = outlook(world, site.x, site.z, { at: 2, range: 16 });
  return {
    x: site.x + 0.5,
    y: world.surfaceHeight(site.x, site.z),
    z: site.z + 0.5,
    yaw: view.best >= 4 ? view.yaw : site.yaw,
    pitch: site.pitch ?? -0.16,
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
  const at = (i, c) => (axis === 'z' ? [c, i] : [i, c]);   // -> [x, z]

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
        world.surfaceHeightMap[x * world.sizeZ + z] = surface + 1;
      } else {
        // Bank: flatten to the water's shoulder so the edge is walkable.
        const shoulder = surface + 1;
        for (let y = shoulder + 1; y < world.height; y++) world.setBlock(x, y, z, 0);
        for (let y = Math.max(0, shoulder - 3); y < shoulder; y++) {
          if (world.getBlock(x, y, z) === 0) world.setBlock(x, y, z, DIRT);
        }
        world.setBlock(x, shoulder, z, SAND);
        world.surfaceHeightMap[x * world.sizeZ + z] = shoulder + 1;
      }
    }
  }
}
