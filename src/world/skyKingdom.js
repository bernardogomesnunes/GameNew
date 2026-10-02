import { hash01 } from './ChunkGen.js';

/**
 * The Sky Kingdom (the dark path, docs/plan-phase7-lore.md): where you come
 * from — "a mystical floating island 5,000 blocks away. Its underside is
 * rock, with waterfalls pouring off its edge. On top are white marble halls
 * and gold roofs, with fireflies drifting over it ... Its great chains run
 * down to anchor towers on the ground."
 *
 * Like the Stone Kingdom it's a big site, planned once per world and laid
 * chunk by chunk as each is made (see kingdom.js). Unlike it, it only exists
 * on the dark path (and in Creative, to look at): the generator lays it only
 * while `gen.sky` is set, which Game sets from your ring. On the white path
 * you never see it, as decided.
 *
 *   island  ~92 across, its floor at FLOOR; rock below tapering to points,
 *           three waterfalls off the rim
 *   palace  marble on a gilt-edged terrace in the middle, a stepped gold
 *           roof, the throne room inside with the Sky King
 *   halls   four smaller marble halls with gold roofs, white trees, white
 *           calçada paths, firefly lanterns, banners
 *   towers  four anchor towers on the ground round it, each with a chain up
 *           to the rim and a lift at the top; a lift at each landing on the
 *           island takes you back down
 */

/** How far out from home it hangs. */
export const SKY_AT = 5000;
/** Its floor: the first open cell over its grass. */
export const FLOOR = 172;
/** Its rough radius. */
export const ISLAND_R = 46;
/** How far out from its middle the anchor towers stand, on the ground. */
const TOWER_OUT = ISLAND_R + 26;

const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, GOLD = 13, WATER = 11, COBBLE = 8, MOSS = 22,
      MARBLE = 17, SKY_MARBLE = 158, GOLD_TRIM = 159, MARBLE_PILLAR = 166, WHITE_WOOD = 41, WHITE_LEAVES = 42,
      BLUE_RUG = 36, FIREFLY = 190, WHITE_BANNER = 182, WINDOW = 176, CALCADA = 209, MARBLE_TABLE = 32,
      STONE_STAIRS = 29, CHAIN = 229, SKY_LIFT = 230;
const STAIR_FACING = [29, 57, 58, 59]; // stone stairs facing 0..3 — see blocks.js (quads)

/**
 * The island, its towers and everything on them — worked out once per
 * generator and kept. { kind: 'sky', x, z, y: FLOOR, half, byChunk, king,
 * posts, towers: [{ x, y, z, lift, landing }], landings, palace }.
 */
export function skyFor(gen) {
  if (gen.skyCache !== undefined) return gen.skyCache;
  const { x, z } = skyAt(gen);
  gen.skyCache = plan(gen, x, z);
  return gen.skyCache;
}

/** Where its middle hangs, without planning any of it — cheap. */
export function skyAt(gen) {
  const seed = gen.seed ?? 0;
  const home = { x: gen.biomes?.centreX ?? 0, z: gen.biomes?.centreZ ?? 0 };
  const a = hash01(seed, 91, 0x5c01) * Math.PI * 2;
  return { x: Math.round(home.x + Math.cos(a) * SKY_AT), y: FLOOR, z: Math.round(home.z + Math.sin(a) * SKY_AT) };
}

/** How far out from its middle anything of it reaches: the towers and their footings. */
export const SKY_REACH = TOWER_OUT + 6;

/** The island's rim radius at an angle — lobed, the same for a world every time. */
function rimAt(seed, theta) {
  const p1 = hash01(seed, 92, 0x5c02) * 6.28, p2 = hash01(seed, 93, 0x5c03) * 6.28;
  return ISLAND_R * (0.86 + 0.09 * Math.sin(3 * theta + p1) + 0.05 * Math.sin(5 * theta + p2));
}

function plan(gen, cx, cz) {
  const seed = gen.seed ?? 0;
  const cells = new Map();
  const put = (x, y, z, id) => cells.set(`${x},${y},${z}`, id);
  const get = (x, y, z) => cells.get(`${x},${y},${z}`);
  const fill = (x0, x1, y0, y1, z0, z1, id) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, id);
  };
  const h = (a, b, salt = 0) => hash01(cx * 31 + a, cz * 17 + b, seed ^ 0x5c00 ^ salt);

  // ---- the rock --------------------------------------------------------------------
  const R = ISLAND_R + 6;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const rho = Math.hypot(dx, dz), rim = rimAt(seed, Math.atan2(dz, dx));
      if (rho > rim) continue;
      const t = rho / rim;
      const depth = Math.round(5 + 30 * Math.pow(1 - t * t, 1.3) + h(dx, dz) * 3);
      const x = cx + dx, z = cz + dz;
      for (let y = FLOOR - 1 - depth; y < FLOOR - 3; y++) put(x, y, z, h(dx, y, 7) < 0.08 ? MOSS : STONE);
      put(x, FLOOR - 3, z, DIRT); put(x, FLOOR - 2, z, DIRT);
      put(x, FLOOR - 1, z, t > 0.94 && h(dx, dz, 3) < 0.5 ? MOSS : GRASS);
      // The odd spike of rock hanging lower under the middle.
      if (t < 0.5 && h(dx, dz, 9) < 0.03) {
        const spike = 4 + Math.floor(h(dz, dx, 11) * 9);
        for (let y = FLOOR - 1 - depth - spike; y < FLOOR - 1 - depth; y++) put(x, y, z, STONE);
      }
    }
  }

  // ---- waterfalls: a basin on the rim and its water pouring off ------------------------
  for (let k = 0; k < 3; k++) {
    const theta = h(k, 40) * 6.28 + k * 2.1;
    const rim = rimAt(seed, theta);
    const bx = cx + Math.round(Math.cos(theta) * (rim - 2)), bz = cz + Math.round(Math.sin(theta) * (rim - 2));
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) put(bx + i, FLOOR - 1, bz + j, WATER);
    const ox = cx + Math.round(Math.cos(theta) * (rim + 1)), oz = cz + Math.round(Math.sin(theta) * (rim + 1));
    for (let y = FLOOR - 1; y > FLOOR - 26; y--) put(ox, y, oz, WATER);
  }

  // ---- the paths, out from the palace to the four landings ------------------------------
  const base = h(0, 50) * Math.PI * 2;
  const landings = [];
  for (let k = 0; k < 4; k++) {
    const theta = base + k * Math.PI / 2;
    const rim = rimAt(seed, theta);
    for (let r = 10; r < rim - 3; r++) {
      for (let w = -1; w <= 1; w++) {
        const x = cx + Math.round(Math.cos(theta) * r - Math.sin(theta) * w), z = cz + Math.round(Math.sin(theta) * r + Math.cos(theta) * w);
        put(x, FLOOR - 1, z, CALCADA);
      }
      if (r % 9 === 0) {
        const lx = cx + Math.round(Math.cos(theta) * r - Math.sin(theta) * 2), lz = cz + Math.round(Math.sin(theta) * r + Math.cos(theta) * 2);
        put(lx, FLOOR, lz, MARBLE_PILLAR); put(lx, FLOOR + 1, lz, FIREFLY);
      }
    }
    // The landing: a lift back down, at the end of the path.
    const lr = rim - 5;
    const lx = cx + Math.round(Math.cos(theta) * lr), lz = cz + Math.round(Math.sin(theta) * lr);
    fill(lx - 1, lx + 1, FLOOR - 1, FLOOR - 1, lz - 1, lz + 1, SKY_MARBLE);
    put(lx, FLOOR, lz, SKY_LIFT);
    landings.push({ x: lx, y: FLOOR, z: lz, theta, arrive: { x: cx + Math.cos(theta) * (lr - 3), y: FLOOR, z: cz + Math.sin(theta) * (lr - 3) } });
  }

  // ---- the palace ---------------------------------------------------------------------------
  // A terrace edged in gold, the hall on it, the stepped gold roof.
  fill(cx - 11, cx + 11, FLOOR - 1, FLOOR - 1, cz - 11, cz + 11, SKY_MARBLE);
  for (let i = -11; i <= 11; i++) for (const e of [-11, 11]) { put(cx + i, FLOOR - 1, cz + e, GOLD_TRIM); put(cx + e, FLOOR - 1, cz + i, GOLD_TRIM); }
  const PW = 8, PD = 7, TALL = 8; // half-width, half-depth, wall height
  for (let x = cx - PW; x <= cx + PW; x++) {
    for (let z = cz - PD; z <= cz + PD; z++) {
      const edge = x === cx - PW || x === cx + PW || z === cz - PD || z === cz + PD;
      for (let y = FLOOR; y < FLOOR + TALL; y++) put(x, y, z, edge ? (y === FLOOR + TALL - 2 ? GOLD_TRIM : SKY_MARBLE) : AIR);
    }
  }
  for (const [x, z] of [[cx - PW, cz - PD], [cx + PW, cz - PD], [cx - PW, cz + PD], [cx + PW, cz + PD]]) {
    fill(x, x, FLOOR, FLOOR + TALL - 1, z, z, MARBLE_PILLAR);
  }
  // Windows down both long sides, and the great door at the front (-z).
  for (let x = cx - PW + 2; x <= cx + PW - 2; x += 3) { put(x, FLOOR + 2, cz - PD, WINDOW); put(x, FLOOR + 2, cz + PD, WINDOW); put(x, FLOOR + 3, cz - PD, WINDOW); put(x, FLOOR + 3, cz + PD, WINDOW); }
  fill(cx - 1, cx + 1, FLOOR, FLOOR + 3, cz - PD, cz - PD, AIR);
  // The roof: a gold step pyramid over the hall.
  for (let k = 0; k <= PD; k++) {
    fill(cx - PW + k, cx + PW - k, FLOOR + TALL + k, FLOOR + TALL + k, cz - PD + k, cz + PD - k, k % 2 ? GOLD_TRIM : GOLD);
  }
  // Inside: an aisle of blue rug to the throne, firefly lamps down both sides, the throne on its dais.
  fill(cx - 1, cx + 1, FLOOR, FLOOR, cz - PD + 1, cz + PD - 3, BLUE_RUG);
  for (let z = cz - PD + 2; z <= cz + PD - 2; z += 3) { put(cx - PW + 1, FLOOR, z, MARBLE_PILLAR); put(cx - PW + 1, FLOOR + 1, z, FIREFLY); put(cx + PW - 1, FLOOR, z, MARBLE_PILLAR); put(cx + PW - 1, FLOOR + 1, z, FIREFLY); }
  fill(cx - 2, cx + 2, FLOOR, FLOOR, cz + PD - 3, cz + PD - 1, GOLD_TRIM);           // the dais
  put(cx, FLOOR + 1, cz + PD - 1, GOLD); put(cx, FLOOR + 2, cz + PD - 1, GOLD);        // the throne
  put(cx - 1, FLOOR + 1, cz + PD - 1, MARBLE_TABLE); put(cx + 1, FLOOR + 1, cz + PD - 1, MARBLE_TABLE);
  put(cx - 3, FLOOR + 1, cz + PD - 1, WHITE_BANNER + 2); put(cx + 3, FLOOR + 1, cz + PD - 1, WHITE_BANNER + 2);
  // Banners either side of the door, outside.
  put(cx - 3, FLOOR, cz - PD - 1, WHITE_BANNER); put(cx + 3, FLOOR, cz - PD - 1, WHITE_BANNER);

  // ---- four halls -------------------------------------------------------------------------------
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const hx = cx + sx * 24, hz = cz + sz * 22;
    for (let x = hx - 3; x <= hx + 3; x++) {
      for (let z = hz - 3; z <= hz + 3; z++) {
        const edge = x === hx - 3 || x === hx + 3 || z === hz - 3 || z === hz + 3;
        put(x, FLOOR - 1, z, SKY_MARBLE);
        for (let y = FLOOR; y < FLOOR + 5; y++) put(x, y, z, edge ? SKY_MARBLE : AIR);
      }
    }
    for (const [x, z] of [[hx - 3, hz - 3], [hx + 3, hz - 3], [hx - 3, hz + 3], [hx + 3, hz + 3]]) fill(x, x, FLOOR, FLOOR + 4, z, z, MARBLE_PILLAR);
    // Its door towards the palace, a window each side, a lamp inside.
    const dx = -sx, dz = -sz;
    if (Math.abs(dx) >= Math.abs(dz)) fill(hx + dx * 3, hx + dx * 3, FLOOR, FLOOR + 1, hz, hz, AIR);
    fill(hx, hx, FLOOR, FLOOR + 1, hz + dz * 3, hz + dz * 3, AIR);
    put(hx + 3 * sx, FLOOR + 2, hz, WINDOW + 1); put(hx, FLOOR + 2, hz + 3 * sz, WINDOW);
    put(hx, FLOOR, hz, FIREFLY);
    for (let k = 0; k <= 3; k++) fill(hx - 3 + k, hx + 3 - k, FLOOR + 5 + k, FLOOR + 5 + k, hz - 3 + k, hz + 3 - k, k % 2 ? GOLD_TRIM : GOLD);
  }

  // ---- white trees, where there's nothing else ----------------------------------------------------
  for (let dx = -ISLAND_R + 4; dx <= ISLAND_R - 4; dx += 5) {
    for (let dz = -ISLAND_R + 4; dz <= ISLAND_R - 4; dz += 5) {
      const ox = Math.round((h(dx, dz, 21) - 0.5) * 3), oz = Math.round((h(dz, dx, 22) - 0.5) * 3);
      const x = cx + dx + ox, z = cz + dz + oz;
      if (Math.hypot(x - cx, z - cz) > rimAt(seed, Math.atan2(z - cz, x - cx)) - 4) continue;
      if (h(dx, dz, 23) > 0.45) continue;
      let clear = get(x, FLOOR - 1, z) === GRASS;
      for (let i = -2; i <= 2 && clear; i++) for (let j = -2; j <= 2 && clear; j++) {
        if (get(x + i, FLOOR, z + j) != null || get(x + i, FLOOR - 1, z + j) !== GRASS && get(x + i, FLOOR - 1, z + j) !== MOSS) clear = false;
      }
      if (!clear) continue;
      const tall = 4 + Math.floor(h(x, z, 24) * 3);
      fill(x, x, FLOOR, FLOOR + tall - 1, z, z, WHITE_WOOD);
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let y = tall - 2; y <= tall + 1; y++) {
        if (Math.abs(i) + Math.abs(j) + Math.max(0, y - tall) * 2 > 3) continue;
        if (i === 0 && j === 0 && y < tall) continue;
        if (get(x + i, FLOOR + y, z + j) == null) put(x + i, FLOOR + y, z + j, WHITE_LEAVES);
      }
    }
  }

  // ---- the anchor towers, and their chains --------------------------------------------------------
  const towers = [];
  for (const l of landings) {
    const tx = cx + Math.round(Math.cos(l.theta) * TOWER_OUT), tz = cz + Math.round(Math.sin(l.theta) * TOWER_OUT);
    const gy = Math.max(gen.heightAt(tx, tz), gen.waterLevelAt?.(tx, tz) ?? 0);
    const top = Math.min(FLOOR - 24, gy + 26);
    // Footings down into the ground, a shaft of sky marble with gold at the
    // corners, hollow, a stair winding up inside to a platform.
    for (let x = tx - 3; x <= tx + 3; x++) for (let z = tz - 3; z <= tz + 3; z++) for (let y = gy - 4; y < gy; y++) put(x, y, z, COBBLE);
    for (let x = tx - 2; x <= tx + 2; x++) {
      for (let z = tz - 2; z <= tz + 2; z++) {
        const edge = x === tx - 2 || x === tx + 2 || z === tz - 2 || z === tz + 2;
        for (let y = gy; y < top; y++) put(x, y, z, edge ? ((Math.abs(x - tx) === 2 && Math.abs(z - tz) === 2) ? GOLD_TRIM : SKY_MARBLE) : AIR);
      }
    }
    // The door, on the side away from the island; (ux, uz) points that way.
    const ux = Math.sign(Math.round(Math.cos(l.theta) * 2)), uz = Math.sign(Math.round(Math.sin(l.theta) * 2));
    fill(tx + ux * 2, tx + ux * 2, gy, gy + 1, tz + uz * 2, tz + uz * 2, AIR);
    // The stair, round a pillar: up a step a cell, the eight cells round the middle.
    const RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
    fill(tx, tx, gy, top - 1, tz, tz, MARBLE_PILLAR);
    const steps = top - gy;
    for (let k = 0; k < steps; k++) {
      const i = k % 8, prev = RING[(i + 7) % 8], at = RING[i];
      const facing = at[0] > prev[0] ? 1 : at[0] < prev[0] ? 3 : at[1] > prev[1] ? 2 : 0;
      put(tx + at[0], gy + k, tz + at[1], STAIR_FACING[facing]);
    }
    // The platform on top, open over the last of the stair; a gold rail, the
    // lift on the island's side, lamps on the corners.
    fill(tx - 3, tx + 3, top, top, tz - 3, tz + 3, SKY_MARBLE);
    const last = RING[(steps - 1) % 8];
    put(tx + last[0], top, tz + last[1], AIR);
    const prevLast = RING[(steps + 6) % 8];
    put(tx + prevLast[0], top, tz + prevLast[1], AIR);
    for (let i = -3; i <= 3; i += 2) for (const e of [-3, 3]) { put(tx + i, top + 1, tz + e, GOLD_TRIM); put(tx + e, top + 1, tz + i, GOLD_TRIM); }
    for (const [i, j] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) put(tx + i, top + 2, tz + j, FIREFLY);
    // The lift off to the side, clear of the chain (which leaves the middle
    // for the island), and where it sets you down two along from it — so
    // nothing hangs between you and it.
    const side = { x: -uz * 2, z: ux * 2 };
    const lift = { x: tx + Math.sign(side.x) * 2, y: top + 1, z: tz + Math.sign(side.z) * 2 };
    const step = [[2, 0], [-2, 0], [0, 2], [0, -2]].find(([i, j]) => {
      const x = lift.x - tx + i, z = lift.z - tz + j;
      return Math.abs(x) <= 2 && Math.abs(z) <= 2 && (Math.abs(x) === 2 || Math.abs(z) === 2);
    });
    put(lift.x, lift.y, lift.z, SKY_LIFT);
    // The chain: from the platform up to the underside of the rim, a link a cell.
    const from = { x: tx, y: top + 2, z: tz };
    const to = { x: l.x, y: FLOOR - 6, z: l.z };
    const n = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z));
    for (let s = 0; s <= n; s++) {
      const x = Math.round(from.x + (to.x - from.x) * s / n), y = Math.round(from.y + (to.y - from.y) * s / n), z = Math.round(from.z + (to.z - from.z) * s / n);
      if (get(x, y, z) == null || get(x, y, z) === AIR) put(x, y, z, CHAIN);
    }
    towers.push({ x: tx, y: top + 1, z: tz, ground: gy, lift, landing: l, arrive: { x: lift.x + step[0] + 0.5, y: top + 1, z: lift.z + step[1] + 0.5 } });
  }

  // Out by chunk.
  const byChunk = new Map();
  for (const [key, id] of cells) {
    const [x, y, z] = key.split(',').map(Number);
    const ck = `${x >> 4},${z >> 4}`;
    let list = byChunk.get(ck);
    if (!list) byChunk.set(ck, (list = []));
    list.push([x, y, z, id]);
  }
  // Who stands where: guards at the palace door, down the paths and at the landings.
  const posts = [{ x: cx - 2, z: cz - PD - 2 }, { x: cx + 2, z: cz - PD - 2 }];
  for (const l of landings) {
    posts.push({ x: Math.round(cx + Math.cos(l.theta) * 20), z: Math.round(cz + Math.sin(l.theta) * 20) });
    // Beside where the lift sets you down, not on it.
    posts.push({ x: Math.round(l.arrive.x - Math.sin(l.theta) * 3), z: Math.round(l.arrive.z + Math.cos(l.theta) * 3) });
  }
  return {
    kind: 'sky', x: cx, z: cz, y: FLOOR, half: TOWER_OUT + 4,
    byChunk, count: cells.size,
    // On the dais, a step up, before his throne.
    king: { x: cx + 0.5, z: cz + PD - 2.5, dy: 1, facing: Math.PI },
    posts: posts.map((p) => ({ x: p.x + 0.5, z: p.z + 0.5 })),
    towers, landings,
    palace: { minX: cx - PW, maxX: cx + PW, minZ: cz - PD, maxZ: cz + PD },
  };
}

/** Lays the island's share of this chunk — only while the generator has it (the dark path). */
export function stampSky(gen, chunk, size) {
  if (!gen.sky) return;
  // Nowhere near: don't even plan it.
  const at = skyAt(gen), half = size / 2;
  if (Math.abs(chunk.cx * size + half - at.x) > SKY_REACH + size || Math.abs(chunk.cz * size + half - at.z) > SKY_REACH + size) return;
  const s = skyFor(gen);
  const list = s?.byChunk.get(`${chunk.cx},${chunk.cz}`);
  if (!list) return;
  const ox = chunk.cx * size, oz = chunk.cz * size;
  for (const [x, y, z, id] of list) if (y >= 0 && y < chunk.height) chunk.set(x - ox, y, z - oz, id);
}

/** The anchor tower or island landing whose lift is at (x, y, z), and where it takes you. */
export function liftAt(gen, x, y, z) {
  const s = skyFor(gen);
  if (!s) return null;
  for (const t of s.towers) {
    if (t.lift.x === x && t.lift.y === y && t.lift.z === z) return { up: true, to: t.landing.arrive, tower: t };
    const l = t.landing;
    if (l.x === x && l.y === y && l.z === z) return { up: false, to: t.arrive, tower: t };
  }
  return null;
}
