import { AIR, isSoil } from '../config/blocks.js';

/**
 * What gets built once a site has been chosen.
 *
 * The pairing is by id: a spec in config/sites.js named 'grove' is built by the
 * 'grove' builder here. A feature that only marks a position — the spawn — has
 * no builder at all, and that is not an error.
 *
 * Builders receive a seeded random so a world is reproducible from its seed,
 * and they only ever fill air or replace surface blocks. Carving into terrain
 * is how you end up with a floating tree over a hole.
 */

const GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, COBBLE = 8, SAPLING = 20;

/** A trunk with a leafy crown. Returns false if there was no room. */
export function plantTree(world, x, groundY, z, rand) {
  const trunk = 4 + Math.floor(rand() * 2);
  const top = groundY + trunk;
  if (!world.inBounds(x, top + 1, z)) return false;
  for (let i = 0; i < trunk; i++) world.setBlock(x, groundY + i, z, WOOD);
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = -2; dy <= 1; dy++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (dy === 1 && (Math.abs(dx) > 1 || Math.abs(dz) > 1)) continue;
        const tx = x + dx, ty = top + dy, tz = z + dz;
        if (!world.inBounds(tx, ty, tz)) continue;
        if (world.getBlock(tx, ty, tz) === AIR) world.setBlock(tx, ty, tz, LEAVES);
      }
    }
  }
  return true;
}

/** Somewhere a tree can actually stand: right ground, nothing in the way. */
function plantable(world, x, z) {
  const y = world.surfaceHeight(x, z);
  return isSoil(world.getBlock(x, y - 1, z)) && world.getBlock(x, y, z) === AIR;
}

/**
 * Makes a spot plantable by putting soil under it, and says whether it worked.
 *
 * The grove is essential — Age 1 asks you to claim a forest — so when nothing
 * in the plot suits, the finder puts it on the best ground it can find. That
 * used to be fine while every kind of country was grass. Now the best ground
 * can be a gravel hillside, where no tree would take, and the grove came out
 * with four trunks instead of six: a world you cannot finish, placed by the
 * rule meant to guarantee you could.
 *
 * So a grove brings its own forest floor. One block of dirt under each trunk,
 * only where something solid is already standing.
 */
function makePlantable(world, x, z) {
  const y = world.surfaceHeight(x, z);
  if (world.getBlock(x, y, z) !== AIR) return false;
  const under = world.getBlock(x, y - 1, z);
  if (under === AIR || world.isIndestructible(x, y - 1, z)) return false;
  if (!isSoil(under)) world.setBlock(x, y - 1, z, DIRT);
  return true;
}

export const FEATURES = {
  /**
   * Six or so trees inside nine blocks. Scattered singles are not a forest —
   * the claim wants several trunks inside one box, and trees sprinkled evenly
   * over a plot almost never give you that.
   */
  grove(world, site, rand) {
    const SPAN = 4, WANT = 6;
    const planted = [];
    for (let attempt = 0; attempt < 300 && planted.length < WANT; attempt++) {
      const x = site.x + Math.round((rand() - 0.5) * SPAN * 2);
      const z = site.z + Math.round((rand() - 0.5) * SPAN * 2);
      if (planted.some((p) => Math.abs(p.x - x) < 2 && Math.abs(p.z - z) < 2)) continue;
      if (!makePlantable(world, x, z)) continue;
      if (plantTree(world, x, world.surfaceHeight(x, z), z, rand)) planted.push({ x, z });
    }
    // A couple of saplings, so the place reads as growing rather than placed.
    for (let i = 0; i < 2; i++) {
      const x = site.x + Math.round((rand() - 0.5) * SPAN);
      const z = site.z + Math.round((rand() - 0.5) * SPAN);
      if (plantable(world, x, z)) world.setBlock(x, world.surfaceHeight(x, z), z, SAPLING);
    }
    return planted.length;
  },

  /**
   * A low mound of stone. Built as a squashed blob rather than a cube so it
   * reads as weathered rock instead of masonry someone left behind.
   */
  boulders(world, site, rand) {
    const r = 1 + Math.round(rand() * 1.5);
    const h = 1 + Math.round(rand() * 2);
    let laid = 0;
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      for (let dz = -r - 1; dz <= r + 1; dz++) {
        // An elliptical falloff, nibbled by the random so no two match.
        const reach = Math.sqrt(dx * dx + dz * dz);
        if (reach > r + rand() * 0.9) continue;
        const x = site.x + dx, z = site.z + dz;
        if (!world.inBounds(x, 0, z)) continue;
        const base = world.surfaceHeight(x, z);
        const tall = Math.max(1, Math.round(h * (1 - reach / (r + 1.2))));
        for (let dy = 0; dy < tall; dy++) {
          if (!world.inBounds(x, base + dy, z)) break;
          if (world.getBlock(x, base + dy, z) !== AIR) continue;
          world.setBlock(x, base + dy, z, rand() < 0.75 ? STONE : COBBLE);
          laid++;
        }
      }
    }
    return laid;
  },

  /**
   * A scrub of saplings by the water. Cheap to build and it does real work:
   * it marks the riverbank from a distance, which is where the first farm has
   * to go.
   */
  berries(world, site, rand) {
    let placed = 0;
    for (let attempt = 0; attempt < 40 && placed < 5 + rand() * 4; attempt++) {
      const x = site.x + Math.round((rand() - 0.5) * 5);
      const z = site.z + Math.round((rand() - 0.5) * 5);
      if (!plantable(world, x, z)) continue;
      world.setBlock(x, world.surfaceHeight(x, z), z, SAPLING);
      placed++;
    }
    return placed;
  },
};

/**
 * Builds everything a plan asked for. Sites whose id has no builder are
 * positions only — the spawn is one — and are passed straight through.
 */
export function buildSites(world, sites, rand) {
  const built = [];
  for (const site of sites) {
    const make = FEATURES[site.spec];
    built.push({ ...site, made: make ? make(world, site, rand) : null });
  }
  return built;
}
