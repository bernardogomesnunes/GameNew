import { inPast } from './past.js';
import { inFuture } from './future.js';
import { skyAt, TOWER_OUT } from './skyLocation.js';

/**
 * Now and then a huge mountain (WORLD-1: "wider and bigger mountains, and now
 * and then a Kilimanjaro"): one chance in each 1024-block region, a broad
 * shoulder with a summit near the top of the world.
 *
 * Not a dome (reported: "mountains look too blobby, they could benefit from
 * some randomness"): its outline bulges and pinches, ridges run down its
 * sides with valleys between them, and a lower second summit stands off to
 * one side. All of it broad — a ridge is tens of blocks across — so it reads
 * from the horizon without making the slopes ragged up close, which is what
 * costs a phone the most to draw.
 */
export const MASSIF_REGION = 1024;
/** Ridges: how far apart, crest to crest, and how far a valley between them drops. */
const RIDGE_FREQ = 1 / 64, VALLEY = 26;
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
  const r = (salt) => roll(rx, rz, seed ^ salt);
  if (r(0x3281) >= 0.4) return null;
  const x = rx * MASSIF_REGION + 512 + Math.floor(r(0x12c3) * 193) - 96;
  const z = rz * MASSIF_REGION + 512 + Math.floor(r(0x75a1) * 193) - 96;
  const radius = 210 + Math.floor(r(0x48d3) * 71);
  // The outline: two, three and five bulges round it, each turned its own way.
  const lobes = [[2, 0.1, r(0x51a3) * Math.PI * 2], [3, 0.16, r(0x62b4) * Math.PI * 2], [5, 0.07, r(0x73c5) * Math.PI * 2]];
  // As far as a bulge reaches: still inside the region (512 - 96 > 280 × 1.33).
  const outer = radius * (1 + lobes.reduce((s, [, a]) => s + a, 0));
  if (inPast(x, map.centreX) || inFuture(x, map.centreX)) return null;
  // Its summit stands above the floating island's floor, so never under the
  // island or its towers.
  const sky = skyAt({ seed, biomes: map });
  if (Math.hypot(x - sky.x, z - sky.z) < outer + TOWER_OUT + 16) return null;
  // Not out at sea.
  for (const dx of [-radius, 0, radius]) for (const dz of [-radius, 0, radius]) {
    if (map.climate(x + dx, z + dz).wet > 0.87) return null;
  }
  const peak = 174 + Math.floor(r(0x49a7) * 13);
  // The second summit: on the main one's shoulder, a third of the way out.
  const turn = r(0x84d6) * Math.PI * 2, out = radius * (0.32 + r(0x95e7) * 0.1);
  const second = {
    x: x + Math.cos(turn) * out, z: z + Math.sin(turn) * out,
    radius: radius * (0.46 + r(0xa6f8) * 0.1), peak: peak - 16 - Math.floor(r(0xb709) * 14),
  };
  return { rx, rz, x, z, radius, outer, peak, lobes, second };
}

/**
 * 0..1 at `distance` (1 at the rim) from a summit. A dome raised to a power:
 * a narrower top and slopes that sweep out at the foot, rather than a
 * table-topped blob.
 */
function rise(distance) {
  return distance >= 1 ? 0 : (1 - smooth(Math.max(0, (distance - 0.05) / 0.95))) ** 1.8;
}

/**
 * A huge peak's say at a column, or null outside one: `influence` 0..1 (how
 * far it takes the land over, which biomeMap uses for its mountain blend),
 * and what raiseFor needs.
 */
export function massifAt(map, x, z) {
  if (inPast(x, map.centreX) || inFuture(x, map.centreX)) return null;
  const s = massifSite(map, Math.floor(x / MASSIF_REGION), Math.floor(z / MASSIF_REGION));
  if (!s) return null;
  const dx = x - s.x, dz = z - s.z;
  if (Math.abs(dx) >= s.outer || Math.abs(dz) >= s.outer) return null;
  const theta = Math.atan2(dz, dx);
  let reach = 1;
  for (const [k, a, turn] of s.lobes) reach += a * Math.sin(k * theta + turn);
  const distance = Math.hypot(dx / s.radius, dz / (s.radius * 0.85)) / reach;
  let main = rise(distance);
  let side = rise(Math.hypot(x - s.second.x, z - s.second.z) / s.second.radius);
  if (!main && !side) return null;
  // Never on the starting plot, rising only well clear of it.
  if (map.homePull > 0) {
    const away = Math.hypot(x - map.centreX, z - map.centreZ);
    if (away <= 180) return null;
    const fade = smooth(Math.min(1, (away - 180) / 160));
    main *= fade; side *= fade;
  }
  // Ridges down the flanks with valleys between, none on the summit itself:
  // a crest where the noise crosses zero, rounded rather than knife-edged,
  // which would step the ground several blocks at a time.
  const n = map.warp(x * RIDGE_FREQ + 913, z * RIDGE_FREQ - 577);
  const valley = VALLEY * n * n * smooth(Math.min(1, Math.max(0, (distance - 0.06) / 0.4)));
  return { influence: Math.max(main, side), main, side, peak: s.peak - valley, sidePeak: s.second.peak - valley };
}

/** The ground at a column raised by a huge peak's say there (massifAt). */
export function raiseFor(h, m) {
  return Math.max(h, h + Math.max(0, m.peak - h) * m.main, h + Math.max(0, m.sidePeak - h) * m.side);
}
