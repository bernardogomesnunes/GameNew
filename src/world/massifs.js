import { inPast } from './past.js';
import { inFuture } from './future.js';
import { skyAt, TOWER_OUT } from './skyKingdom.js';

/**
 * Now and then a huge mountain (WORLD-1: "wider and bigger mountains, and now
 * and then a Kilimanjaro"): one chance in each 1024-block region, a broad
 * shoulder with a summit near the top of the world. Only in land of the
 * newer shape (biomeMap.js's TERRAIN).
 */
export const MASSIF_REGION = 1024;
const smooth = (t) => t * t * (3 - 2 * t);

function roll(x, z, seed) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(z, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A region's peak, or null: worked out once per region and kept. Each lies wholly inside its region. */
export function massifSite(map, rx, rz) {
  if (map._massifHomeX !== map.centreX || map._massifHomeZ !== map.centreZ || !map._massifSites) {
    map._massifSites = new Map();
    map._massifHomeX = map.centreX;
    map._massifHomeZ = map.centreZ;
  }
  // A number, not a string: this is asked for every column as land is made.
  const cache = map._massifSites, key = rx * 65536 + rz;
  if (cache.has(key)) return cache.get(key);
  if (cache.size >= 256) cache.clear();
  cache.set(key, placeMassif(map, rx, rz));
  return cache.get(key);
}

function placeMassif(map, rx, rz) {
  const seed = map.seed ?? 1;
  if (roll(rx, rz, seed ^ 0x3281) >= 0.4) return null;
  const x = rx * MASSIF_REGION + 512 + Math.floor(roll(rx, rz, seed ^ 0x12c3) * 193) - 96;
  const z = rz * MASSIF_REGION + 512 + Math.floor(roll(rx, rz, seed ^ 0x75a1) * 193) - 96;
  const radius = 210 + Math.floor(roll(rx, rz, seed ^ 0x48d3) * 71);
  if (inPast(x, map.centreX) || inFuture(x, map.centreX)) return null;
  // Its summit stands above the floating island's floor, so never under the
  // island or its towers.
  const sky = skyAt({ seed, biomes: map });
  if (Math.hypot(x - sky.x, z - sky.z) < radius + TOWER_OUT + 16) return null;
  // Not out at sea.
  for (const dx of [-radius, 0, radius]) for (const dz of [-radius, 0, radius]) {
    if (map.climate(x + dx, z + dz).wet > 0.87) return null;
  }
  // A plateau-and-shoulder shape, broad enough to read from the horizon.
  return { rx, rz, x, z, radius, peak: 174 + Math.floor(roll(rx, rz, seed ^ 0x49a7) * 13) };
}

/** A smooth 0..1 shoulder-and-summit profile at a column, or null outside a peak. */
export function massifAt(map, x, z) {
  if (inPast(x, map.centreX) || inFuture(x, map.centreX)) return null;
  const s = massifSite(map, Math.floor(x / MASSIF_REGION), Math.floor(z / MASSIF_REGION));
  if (!s) return null;
  const distance = Math.hypot((x - s.x) / s.radius, (z - s.z) / (s.radius * 0.85));
  if (distance >= 1) return null;
  let influence = 1 - smooth(Math.max(0, (distance - 0.1) / 0.9));
  // Never on the starting plot, rising only well clear of it.
  if (map.homePull > 0) {
    const away = Math.hypot(x - map.centreX, z - map.centreZ);
    if (away <= 180) return null;
    influence *= smooth(Math.min(1, (away - 180) / 160));
  }
  return { ...s, influence };
}
