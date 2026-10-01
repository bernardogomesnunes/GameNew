import { hash01 } from './ChunkGen.js';
import { BIOMES } from '../config/biomes.js';

/**
 * The Stone Kingdom (Phase 7e, docs/plan-phase7-lore.md): "a walled city of
 * dark stone, placed by the world seed away from home ... walls with towers
 * and a gatehouse; streets; houses, a market, an armoury and barracks, in
 * the new dark style; a keep with the Stone King."
 *
 * The landmarks (landmarks.js) are small enough to write out whole for any
 * chunk that touches one. The city isn't: it's ninety blocks across. So it's
 * a "big site" — planned once per world from the seed (where it stands, how
 * high its floor is, every block of it, bucketed by the chunk it falls in),
 * then each chunk, as it's made, levels its share of the ground and lays its
 * share of the blocks. The same city, whichever chunk is made first.
 *
 * Nothing about it is saved; a chunk you change is saved like any other.
 */

/** Its walls stand this far either side of its middle... */
export const CITY_HALF = 40;
/** ...and the ground eases back to the land's own over this many more. */
export const CITY_BLEND = 12;
/** How far from the middle of the world it stands. */
const KINGDOM_AT = [1000, 1400];
/** Country no city is built in. */
const NOT_HERE = new Set(['ocean', 'mountains2']);

const AIR = 0, GRASS = 1, DIRT = 2, COBBLE = 8, GOLD = 13, LANTERN = 26, PLANK_SLAB = 28,
      RED_RUG = 35, FENCE = 47, CHEST = 148, DARK_WOOD = 43,
      DARK_STONE = 156, DARK_BRICK = 157, GOLD_TRIM = 159, DARK_WALL = 164, DARK_PILLAR = 167,
      WINDOW = 176, BANNER_BLACK = 186, NIGHTSTONE_ORE = 192, BED = 193, BED_HEAD = 197,
      CALCADA = 209, CALCADA_DARK = 210, CALCADA_WAVE = 211;

/** Every block the city puts down, by kind of block — for the far-off skyline's colours. */
export const DARK_COLOUR = 0x45424c;

/**
 * Where the city stands, and everything in it — worked out once per
 * generator and kept. Null in a world with nowhere to put it.
 *
 * { kind: 'kingdom', x, z, y, half, byChunk: Map("cx,cz" -> [[x, y, z, id]]),
 *   skyline: Map("x>>2,z>>2" -> top), king, posts, keep } — and `blocks`,
 * the same as any landmark's ([dx, dy, dz, id] from its middle), made only
 * if something asks.
 */
export function kingdomFor(gen) {
  if (gen.kingdomCache !== undefined) return gen.kingdomCache;
  gen.kingdomCache = null;
  const site = findSite(gen);
  if (site) gen.kingdomCache = plan(gen, site);
  return gen.kingdomCache;
}

/**
 * The flattest stretch of country, a long way out: tries a ring of places
 * round the compass and keeps the one whose ground varies least. Its floor
 * is the middle of the heights it sampled, so as little land as possible is
 * cut away or built up.
 */
function findSite(gen) {
  const seed = gen.seed ?? 0;
  const start = hash01(seed, 71, 0x5701) * Math.PI * 2;
  const r = KINGDOM_AT[0] + hash01(seed, 72, 0x5702) * (KINGDOM_AT[1] - KINGDOM_AT[0]);
  const home = { x: gen.biomes?.centreX ?? 0, z: gen.biomes?.centreZ ?? 0 };
  let best = null;
  for (let k = 0; k < 24; k++) {
    const a = start + (k / 24) * Math.PI * 2;
    const cx = Math.round(home.x + Math.cos(a) * r), cz = Math.round(home.z + Math.sin(a) * r);
    const heights = [];
    let bad = 0, wet = 0;
    for (let i = -4; i <= 4; i++) {
      for (let j = -4; j <= 4; j++) {
        const x = cx + i * 11, z = cz + j * 11;
        if (NOT_HERE.has(BIOMES[gen.biomeIndexAt(x, z)]?.id)) bad++;
        if (gen.waterLevelAt(x, z)) wet++;
        heights.push(gen.heightAt(x, z));
      }
    }
    if (bad > 4 || wet > 12) continue;
    heights.sort((p, q) => p - q);
    const spread = heights[heights.length - 5] - heights[4];
    const y = heights[heights.length >> 1];
    if (!best || spread < best.spread) best = { x: cx, z: cz, y, spread };
  }
  return best;
}

// ---- the plan ------------------------------------------------------------------------

function plan(gen, site) {
  const seed = gen.seed ?? 0;
  const h = (a, b) => hash01(site.x * 7 + a, site.z * 13 + b, seed ^ 0x5703);
  const cells = new Map(); // "dx,dy,dz" -> id, relative to the site's floor
  const put = (dx, dy, dz, id) => cells.set(`${dx},${dy},${dz}`, id);
  const fill = (x0, x1, y0, y1, z0, z1, id) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, id);
  };
  const posts = [];

  // The ground inside the walls: cobbled.
  fill(-CITY_HALF, CITY_HALF, -1, -1, -CITY_HALF, CITY_HALF, COBBLE);

  // Streets: one from the gate to the keep, one across, in dark calçada
  // edged with white; a lantern on a post every eight blocks along each.
  for (let d = -CITY_HALF + 2; d <= CITY_HALF - 2; d++) {
    for (let w = -2; w <= 2; w++) {
      const edge = Math.abs(w) === 2;
      if (d >= -12) put(w, -1, d, edge ? CALCADA : CALCADA_DARK);
      put(d, -1, w, edge ? CALCADA : CALCADA_DARK);
    }
    if (d % 8 === 0 && Math.abs(d) > 4) {
      if (d >= -10) { lampPost(put, -3, d); lampPost(put, 3, d); }
      lampPost(put, d, -3); lampPost(put, d, 3);
    }
  }

  walls(put, fill, h);
  gatehouse(put, fill, posts);
  const keep = keepAt(put, fill, posts);
  darkTemple(put, fill);
  armoury(put, fill, posts);
  barracks(put, fill);
  market(put, fill, h);

  // Houses on what's left of each quarter: a grid of plots, skipping any
  // that would land on something already built.
  const taken = (x0, z0, x1, z1) => {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      for (let y = 0; y <= 2; y++) if (cells.has(`${x},${y},${z}`)) return true;
      const g = cells.get(`${x},-1,${z}`);
      if (g === CALCADA || g === CALCADA_DARK || g === CALCADA_WAVE) return true;
    }
    return false;
  };
  let n = 0;
  // Plots of seven with a lane of two between, laid out from the streets.
  const PLOTS = [-37, -28, -19, -10, 4, 13, 22, 31];
  for (const gx of PLOTS) {
    for (const gz of PLOTS) {
      if (taken(gx, gz, gx + 6, gz + 6)) continue;
      if (h(gx, gz) < 0.12) continue; // the odd empty yard
      house(put, fill, gx, gz, h(gz, gx), n++);
    }
  }

  // Write it out in world coordinates, by chunk; and the skyline, the top
  // of every 4×4 patch, for the far-off view (see FarTerrain).
  const blocks = new Map();
  const skyline = new Map();
  for (const [key, id] of cells) {
    const [dx, dy, dz] = key.split(',').map(Number);
    const x = site.x + dx, y = site.y + dy, z = site.z + dz;
    const ck = `${x >> 4},${z >> 4}`;
    let list = blocks.get(ck);
    if (!list) blocks.set(ck, (list = []));
    list.push([x, y, z, id]);
    if (id !== AIR) {
      const sk = `${x >> 2},${z >> 2}`;
      if ((skyline.get(sk) ?? -Infinity) < y + 1) skyline.set(sk, y + 1);
    }
  }
  let relative = null;
  return {
    kind: 'kingdom', x: site.x, z: site.z, y: site.y, half: CITY_HALF + CITY_BLEND,
    byChunk: blocks, skyline, count: cells.size,
    get blocks() {
      relative ??= [...cells].map(([key, id]) => [...key.split(',').map(Number), id]);
      return relative;
    },
    // On the dais, just in front of his throne, facing the door.
    king: { x: site.x + 0.5, z: site.z + keep.throneZ + 1.5, dy: 1, facing: 0 },
    posts: posts.map((p) => ({ ...p, x: site.x + p.x + 0.5, z: site.z + p.z + 0.5 })),
    keep: { minX: site.x + keep.minX, maxX: site.x + keep.maxX, minZ: site.z + keep.minZ, maxZ: site.z + keep.maxZ },
  };
}

function lampPost(put, x, z) {
  put(x, 0, z, DARK_WALL);
  put(x, 1, z, DARK_WALL);
  put(x, 2, z, LANTERN);
}

/**
 * The walls: two thick and ten high, dark brick on a dark stone footing,
 * crenellated along the top; a tower on every corner and halfway along
 * three sides (the fourth has the gate), each hollow, with slits for windows.
 */
function walls(put, fill, h) {
  const H = CITY_HALF;
  for (let a = -H; a <= H; a++) {
    for (const b of [-H, -H + 1, H - 1, H]) {
      for (let y = 0; y < 10; y++) {
        const id = y < 2 ? DARK_STONE : DARK_BRICK;
        put(a, y, b, id);
        put(b, y, a, id);
      }
    }
    // Battlements on the outer edge, every other block.
    if (a % 2 === 0) for (const b of [-H, H]) { put(a, 10, b, DARK_BRICK); put(b, 10, a, DARK_BRICK); }
  }
  const towers = [[-H, -H], [H, -H], [-H, H], [H, H], [0, -H], [-H, 0], [H, 0]];
  for (const [cx, cz] of towers) tower(put, cx, cz, 4, 16);
}

/** A square tower, `r` out from its middle each way, `tall` high, hollow, crenellated. */
function tower(put, cx, cz, r, tall) {
  for (let x = cx - r; x <= cx + r; x++) {
    for (let z = cz - r; z <= cz + r; z++) {
      const edge = Math.abs(x - cx) === r || Math.abs(z - cz) === r;
      for (let y = 0; y < tall; y++) {
        if (!edge && y > 0 && y < tall - 1) { put(x, y, z, AIR); continue; }
        // Slits for windows halfway along each face, twice up the tower.
        const slit = edge && (x === cx || z === cz) && (y === 6 || y === 7 || y === 11 || y === 12);
        put(x, y, z, slit ? AIR : y % 5 === 4 ? DARK_BRICK : DARK_STONE);
      }
      if (edge && (x + z) % 2 === 0) put(x, tall, z, DARK_BRICK);
    }
  }
  put(cx, tall - 1, cz, LANTERN);
}

/**
 * The gate, in the middle of the south wall: a way through five wide and six
 * high, two towers either side of it, black banners on them, and lanterns.
 */
function gatehouse(put, fill, posts) {
  const H = CITY_HALF;
  fill(-2, 2, 0, 5, H - 1, H, AIR);
  for (const side of [-1, 1]) {
    tower(put, side * 6, H, 3, 14);
    put(side * 6, 7, H + 4, BANNER_BLACK + 2);
    put(side * 3, 2, H + 1, LANTERN);
    posts.push({ x: side * 4, z: H + 5, role: 'gate' });
    posts.push({ x: side * 4, z: H - 4, role: 'gate' });
  }
  fill(-2, 2, 6, 6, H - 1, H, GOLD_TRIM);
}

/**
 * The keep, at the north end of the main street: a great hall of dark
 * stone with a turret on each corner, a red carpet from its door to the
 * throne, and the Stone King on it.
 */
function keepAt(put, fill, posts) {
  const minX = -9, maxX = 9, minZ = -36, maxZ = -14, tall = 18;
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      const edge = x === minX || x === maxX || z === minZ || z === maxZ;
      put(x, -1, z, DARK_BRICK);
      for (let y = 0; y < tall; y++) {
        if (!edge && y < tall - 1) { put(x, y, z, AIR); continue; }
        const window = edge && y >= 6 && y <= 8 && (x % 4 === 0 || z % 4 === 0) && !(x === minX && z === minZ);
        put(x, y, z, window ? (x === minX || x === maxX ? WINDOW + 1 : WINDOW) : y % 6 === 5 ? DARK_BRICK : DARK_STONE);
      }
      if (edge && (x + z) % 2 === 0) put(x, tall, z, DARK_BRICK);
    }
  }
  for (const [cx, cz] of [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ]]) tower(put, cx, cz, 2, 24);
  // The door, and black banners either side of it.
  fill(-1, 1, 0, 3, maxZ, maxZ, AIR);
  put(-3, 4, maxZ + 1, BANNER_BLACK + 2);
  put(3, 4, maxZ + 1, BANNER_BLACK + 2);
  // Inside: pillars down the hall, a carpet, lanterns, the throne.
  for (let z = minZ + 4; z <= maxZ - 3; z += 4) {
    for (const x of [-5, 5]) for (let y = 0; y < tall - 1; y++) put(x, y, z, DARK_PILLAR);
    put(-4, 3, z, LANTERN); put(4, 3, z, LANTERN);
  }
  for (let z = minZ + 3; z <= maxZ - 1; z++) for (let x = -1; x <= 1; x++) put(x, 0, z, RED_RUG);
  const throneZ = minZ + 2;
  fill(-2, 2, 0, 0, throneZ - 1, throneZ + 1, DARK_BRICK);  // the dais, with room to stand on
  put(0, 1, throneZ, GOLD_TRIM);                        // the seat
  fill(-1, 1, 1, 4, throneZ - 1, throneZ - 1, DARK_STONE); // its back
  put(0, 5, throneZ - 1, GOLD);
  for (const x of [-2, 2]) put(x, 1, throneZ, GOLD_TRIM);
  for (const x of [-6, 6]) put(x, 6, minZ + 1, BANNER_BLACK);
  posts.push({ x: -3, z: maxZ + 2, role: 'keep' }, { x: 3, z: maxZ + 2, role: 'keep' });
  posts.push({ x: -3, z: throneZ + 3, role: 'throne' }, { x: 3, z: throneZ + 3, role: 'throne' });
  return { minX, maxX, minZ, maxZ, throneZ };
}

/**
 * The dark god's temple, west of the keep: dark brick round a court of
 * pillars, an altar with a heart of Nightstone, lit low. The dark path's
 * oath is sworn here.
 */
function darkTemple(put, fill) {
  const minX = -32, maxX = -16, minZ = -36, maxZ = -22;
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      const edge = x === minX || x === maxX || z === minZ || z === maxZ;
      put(x, -1, z, DARK_STONE);
      for (let y = 0; y < 9; y++) put(x, y, z, edge ? (y % 4 === 3 ? DARK_STONE : DARK_BRICK) : AIR);
      put(x, 9, z, DARK_BRICK);
    }
  }
  fill(maxX, maxX, 0, 3, -30, -28, AIR); // the door, onto the street side
  for (const [x, z] of [[-29, -33], [-19, -33], [-29, -25], [-19, -25]]) for (let y = 0; y < 9; y++) put(x, y, z, DARK_PILLAR);
  fill(-26, -22, 0, 0, -32, -31, DARK_BRICK);
  put(-24, 1, -32, NIGHTSTONE_ORE);
  put(-26, 1, -32, LANTERN); put(-22, 1, -32, LANTERN);
  put(-24, 4, -35, BANNER_BLACK);
}

/** The armoury, east of the keep: racks of arms, and chests of them. */
function armoury(put, fill, posts) {
  const minX = 16, maxX = 30, minZ = -36, maxZ = -24;
  building(put, minX, maxX, minZ, maxZ, 7, DARK_STONE, DARK_BRICK);
  fill(minX, minX, 0, 2, -31, -29, AIR); // door, facing the keep
  for (let x = minX + 3; x <= maxX - 2; x += 3) { put(x, 0, minZ + 1, FENCE); put(x, 1, minZ + 1, FENCE); }
  for (const x of [20, 24, 28]) put(x, 0, maxZ - 1, CHEST + 2);
  put(23, 4, -30, LANTERN);
  posts.push({ x: minX - 2, z: -30, role: 'armoury' });
}

/** The barracks: one long room of beds. */
function barracks(put, fill) {
  const minX = 14, maxX = 36, minZ = -16, maxZ = -6;
  building(put, minX, maxX, minZ, maxZ, 6, DARK_BRICK, DARK_STONE);
  fill(24, 26, 0, 2, maxZ, maxZ, AIR);
  for (let x = minX + 2; x <= maxX - 2; x += 3) {
    put(x, 0, minZ + 2, BED);       // foot, head to the north wall
    put(x, 0, minZ + 1, BED_HEAD);
  }
  put(19, 3, -11, LANTERN); put(31, 3, -11, LANTERN);
}

/** The market: a square of calçada waves with stalls round it. */
function market(put, fill, h) {
  for (let x = 8; x <= 26; x++) for (let z = 8; z <= 26; z++) put(x, -1, z, CALCADA_WAVE);
  const stalls = [[10, 10], [20, 10], [10, 20], [20, 20]];
  for (const [sx, sz] of stalls) {
    for (const [dx, dz] of [[0, 0], [4, 0], [0, 4], [4, 4]]) { put(sx + dx, 0, sz + dz, FENCE); put(sx + dx, 1, sz + dz, FENCE); }
    fill(sx, sx + 4, 2, 2, sz, sz + 4, PLANK_SLAB);
    put(sx + 2, 0, sz + 2, CHEST + Math.floor(h(sx, sz) * 4));
  }
  put(17, 0, 17, DARK_WALL); put(17, 1, 17, DARK_WALL); put(17, 2, 17, LANTERN);
}

/** A plain building: walls, a floor and a flat roof with a lip. */
function building(put, minX, maxX, minZ, maxZ, tall, wall, band) {
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      const edge = x === minX || x === maxX || z === minZ || z === maxZ;
      put(x, -1, z, DARK_STONE);
      for (let y = 0; y < tall; y++) put(x, y, z, edge ? (y === tall - 2 ? band : wall) : AIR);
      put(x, tall, z, DARK_BRICK);
      if (edge && (x + z) % 2 === 0) put(x, tall + 1, z, DARK_BRICK);
    }
  }
}

/**
 * A townhouse on a 7×7 plot: dark stone or dark brick, four to six high, a
 * door onto whichever side faces the middle of the city, framed windows,
 * a lantern and a bed.
 */
function house(put, fill, x0, z0, r, n) {
  const tall = 4 + Math.floor(r * 3);
  const wall = r < 0.5 ? DARK_STONE : DARK_BRICK;
  building(put, x0, x0 + 6, z0, z0 + 6, tall, wall, wall === DARK_STONE ? DARK_BRICK : DARK_STONE);
  // The door faces the middle: along whichever axis it's further out.
  const cx = x0 + 3, cz = z0 + 3;
  if (Math.abs(cx) > Math.abs(cz)) fill(cx > 0 ? x0 : x0 + 6, cx > 0 ? x0 : x0 + 6, 0, 1, cz, cz, AIR);
  else fill(cx, cx, 0, 1, cz > 0 ? z0 : z0 + 6, cz > 0 ? z0 : z0 + 6, AIR);
  // Windows on the other two walls.
  put(x0 + 2, 2, z0, WINDOW); put(x0 + 4, 2, z0 + 6, WINDOW);
  put(x0, 2, z0 + 4, WINDOW + 1); put(x0 + 6, 2, z0 + 2, WINDOW + 1);
  put(cx, tall - 1, cz, LANTERN);
  put(x0 + 1, 0, z0 + 2, BED + 2); put(x0 + 1, 0, z0 + 3, BED_HEAD + 2);
  if (n % 3 === 0) put(x0 + 5, 0, z0 + 5, DARK_WOOD);
}

// ---- stamping ----------------------------------------------------------------------------

/**
 * Writes whatever part of the city falls in a chunk: the ground levelled to
 * the city's floor inside the walls and eased back to the land's own height
 * round them, the air above cleared, then the city's blocks. Called from
 * ChunkGen.fill after the trees and landmarks.
 */
export function stampKingdom(gen, chunk, size, roadTop = () => null) {
  const k = kingdomFor(gen);
  if (!k) return;
  const ox = chunk.cx * size, oz = chunk.cz * size;
  const R = CITY_HALF + CITY_BLEND;
  if (ox > k.x + R || ox + size <= k.x - R || oz > k.z + R || oz + size <= k.z - R) return;
  for (let lx = 0; lx < size; lx++) {
    for (let lz = 0; lz < size; lz++) {
      const x = ox + lx, z = oz + lz;
      const d = Math.max(Math.abs(x - k.x), Math.abs(z - k.z));
      if (d > R) continue;
      const natural = gen.heightAt(x, z);
      const water = gen.waterLevelAt(x, z);
      const inside = d <= CITY_HALF + 2;
      // In the ring round the walls, a river keeps its water.
      if (!inside && water) continue;
      const t = inside ? 0 : (d - CITY_HALF - 2) / (CITY_BLEND - 2);
      const g = Math.round(k.y + (natural - k.y) * t * t * (3 - 2 * t));
      const from = Math.max(0, Math.min(natural, g) - 4);
      const road = inside ? null : roadTop(x, z);
      for (let y = from; y < g; y++) chunk.set(lx, y, lz, y === g - 1 ? (inside ? COBBLE : road ?? GRASS) : DIRT);
      const top = Math.min(chunk.height, Math.max(natural, water, g) + 14);
      for (let y = g; y < top; y++) chunk.set(lx, y, lz, AIR);
      chunk.surface[lz * size + lx] = g;
    }
  }
  for (const [x, y, z, id] of k.byChunk.get(`${chunk.cx},${chunk.cz}`) ?? []) {
    if (y >= 0 && y < chunk.height) chunk.set(x - ox, y, z - oz, id);
  }
}

/** The tallest of the city over a far-off patch of country — null where there's none of it. */
export function skylineAt(gen, x0, z0, step) {
  const k = kingdomFor(gen);
  if (!k || x0 > k.x + CITY_HALF + 5 || x0 + step < k.x - CITY_HALF - 5 || z0 > k.z + CITY_HALF + 5 || z0 + step < k.z - CITY_HALF - 5) return null;
  let top = null;
  for (let x = x0; x < x0 + step; x += 4) {
    for (let z = z0; z < z0 + step; z += 4) {
      const t = k.skyline.get(`${x >> 2},${z >> 2}`);
      if (t != null && (top == null || t > top)) top = t;
    }
  }
  return top;
}
