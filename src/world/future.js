import {
  PAVEMENT, ASPHALT, TINTED_GLASS, STEEL_PANEL, NEON_PINK, NEON_CYAN, SCREEN, MAGLEV_RAIL, LIT_WINDOW, FUTURE_LAMP, ARCHIVE,
} from '../config/blocks.js';

/**
 * The Future (backlog batch 4, D3: "Future: a city ... flying cars, trams,
 * a university you can take knowledge back from"). Asked for directly:
 * "Next fix ... time travel"; "Nice keep going".
 *
 * Like the Past, it's land of its own laid out far from home — FUTURE_AWAY
 * blocks due west — and saved and streamed like the rest of the world. All
 * of it is one city, on flat ground: a grid of streets with maglev rails
 * down the ones running east–west, pavements with lamps, and a glass tower
 * on nearly every block. You arrive in the plaza; the university is the
 * block east of it, and its Archive is what you came for.
 *
 * Pure: where it is, and what stands on each column (futureColumn). The
 * generator lays it (stampFuture); Game sends you there.
 */

/** How far west of home the Future begins, in blocks. */
export const FUTURE_AWAY = 120000;
/** Where its land starts, short of FUTURE_AWAY. */
export const FUTURE_EDGE = 2000;
/** Its streets' level: the first open cell above them. */
export const FUTURE_GROUND = 108;

/** One city block: a street, then a pavement, then the lot, then the far pavement. */
export const CELL = 48;
const STREET = 8, WALK = 2;
const LOT_LO = STREET + WALK, LOT_HI = CELL - WALK; // 10..45: the lot itself
/** The lots with something of their own: the plaza you arrive in, and the university east of it. */
export const PLAZA = [0, 0], UNIVERSITY = [1, 0];

const GRASS = 1, WOOD = 4, LEAVES = 5, MARBLE = 17;

/** A number in 0..1 from a position and a salt (ChunkGen's own, kept here so the two don't import each other). */
function hash01(x, z, salt) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Whether x (at a world whose home is at `centreX`) is in the Future. */
export function inFuture(x, centreX = 0) {
  return centreX - x >= FUTURE_AWAY - FUTURE_EDGE;
}

/** Where you arrive in the Future: due west of home, FUTURE_AWAY out — the middle of its plaza. */
export function futureArrival(centreX = 0, centreZ = 0) {
  return { x: Math.round(centreX - FUTURE_AWAY), z: Math.round(centreZ) };
}

/** Which lot a coordinate (from the arrival) is in, and where in it: 0..CELL-1, the lot's middle at CELL/2. */
function split(n) {
  const i = Math.floor((n + CELL / 2) / CELL);
  return [i, n + CELL / 2 - i * CELL];
}

/** What's built on one lot: its kind, and for a tower, its shape. Pure in (i, j, seed). */
export function lotPlan(i, j, seed = 0) {
  if (i === PLAZA[0] && j === PLAZA[1]) return { kind: 'plaza' };
  if (i === UNIVERSITY[0] && j === UNIVERSITY[1]) return { kind: 'university' };
  const r = (salt) => hash01(i, j, seed ^ salt);
  if (r(0x7a11) < 0.12) return { kind: 'park' };
  const size = 18 + 2 * Math.floor(r(0x51e5) * 7); // 18..30, even
  // Mostly mid-rise, a few very tall — and taller the nearer the middle.
  const near = Math.max(0, 1 - Math.hypot(i, j) / 12);
  const height = 24 + Math.round(Math.min(1, r(0x4e19) ** 1.6 + near * 0.35) * 56); // 24..80
  return {
    kind: 'tower', size, height,
    setback: height > 50 && r(0x5e7b) < 0.5 ? Math.round(height * 0.68) : 0,
    neon: r(0x6e0a) < 0.5 ? NEON_PINK : NEON_CYAN,
    screen: r(0x5c4e) < 0.45,
    lit: 0.18 + r(0x117e) * 0.3,
    salt: Math.floor(r(0x3a17) * 65536),
  };
}

/**
 * One column of the city, `u`, `v` from the arrival: calls put(dy, block)
 * for its ground (dy -1) and everything standing on it (dy 0 up), dy
 * counted from FUTURE_GROUND. Only what's there is put; the rest is air.
 */
export function futureColumn(u, v, seed, put) {
  const [i, lu] = split(u), [j, lv] = split(v);
  // Streets: north–south ones down the west of each lot, east–west ones
  // along its north. The east–west ones carry the trams' rails.
  if (lu < STREET || lv < STREET) {
    if (lv < STREET && (lv === 2 || lv === 5)) return put(-1, MAGLEV_RAIL);
    // A dashed line down the middle of a north–south street.
    if (lv >= STREET && (lu === 3 || lu === 4) && (lv % 6) < 3) return put(-1, PAVEMENT);
    return put(-1, ASPHALT);
  }
  const plan = lotPlan(i, j, seed);
  const walk = lu < LOT_LO || lu >= LOT_HI || lv < LOT_LO || lv >= LOT_HI;
  if (walk) {
    put(-1, PAVEMENT);
    // A lamp every twelve along the kerb.
    // (Off the middle of the lot, so none stands in front of a door.)
    const kerb = (lu === LOT_LO - 1 && lv % 12 === 8) || (lv === LOT_LO - 1 && lu % 12 === 8);
    if (kerb && plan.kind !== 'park') { put(0, STEEL_PANEL); put(1, STEEL_PANEL); put(2, STEEL_PANEL); put(3, FUTURE_LAMP); }
    return;
  }
  if (plan.kind === 'plaza') return plaza(u, v, lu, lv, put);
  if (plan.kind === 'university') return university(lu, lv, put);
  if (plan.kind === 'park') return park(lu, lv, put);
  return tower(plan, lu, lv, put);
}

/** The plaza: paving, a ring of light round where you land, lamps at its corners. */
function plaza(u, v, lu, lv, put) {
  const d = Math.round(Math.hypot(u, v));
  put(-1, d === 8 || d === 12 ? NEON_CYAN : PAVEMENT);
  const corner = (lu === LOT_LO + 2 || lu === LOT_HI - 3) && (lv === LOT_LO + 2 || lv === LOT_HI - 3);
  if (corner) { for (let y = 0; y < 4; y++) put(y, STEEL_PANEL); put(4, FUTURE_LAMP); }
}

/**
 * The university: a long white hall, glass along its sides, a door on the
 * plaza side (level with the street, so you walk straight in), and the
 * Archive in the middle of its floor with lamps over it.
 */
const UNI_LO = LOT_LO + 2, UNI_HI = LOT_HI - 3, UNI_TALL = 14;
export const ARCHIVE_AT = { lu: (LOT_LO + LOT_HI) >> 1, lv: (LOT_LO + LOT_HI) >> 1 };
function university(lu, lv, put) {
  put(-1, PAVEMENT);
  if (lu < UNI_LO || lu > UNI_HI || lv < UNI_LO || lv > UNI_HI) return;
  const wall = lu === UNI_LO || lu === UNI_HI || lv === UNI_LO || lv === UNI_HI;
  const mid = ARCHIVE_AT.lv;
  if (wall) {
    const door = lu === UNI_LO && Math.abs(lv - mid) <= 1;
    for (let y = 0; y < UNI_TALL; y++) {
      if (door && y <= 3) continue;
      const corner = (lu === UNI_LO || lu === UNI_HI) && (lv === UNI_LO || lv === UNI_HI);
      const glass = !corner && y >= 3 && y <= 10 && (lu + lv) % 4 !== 0;
      put(y, y === UNI_TALL - 1 ? NEON_CYAN : glass ? TINTED_GLASS : MARBLE);
    }
    put(UNI_TALL, STEEL_PANEL);
    return;
  }
  if (lu === ARCHIVE_AT.lu && lv === ARCHIVE_AT.lv) put(0, ARCHIVE);
  // The east wall inside is screens, the knowledge shown.
  if (lu === UNI_HI - 1 && lv > UNI_LO + 2 && lv < UNI_HI - 2) for (let y = 3; y <= 7; y++) put(y, SCREEN);
  if ((lu - UNI_LO) % 6 === 3 && (lv - UNI_LO) % 6 === 3) put(UNI_TALL - 1, FUTURE_LAMP);
  put(UNI_TALL, STEEL_PANEL);
}

/** A little park: grass and a few trees in rows. */
function park(lu, lv, put) {
  put(-1, GRASS);
  const near = (n) => Math.min(LOT_HI - 4, Math.max(LOT_LO + 3, LOT_LO + 3 + 8 * Math.round((n - LOT_LO - 3) / 8)));
  const tu = near(lu), tv = near(lv);
  const du = Math.abs(lu - tu), dv = Math.abs(lv - tv);
  if (du > 1 || dv > 1) return;
  if (du === 0 && dv === 0) { for (let y = 0; y < 4; y++) put(y, WOOD); put(6, LEAVES); }
  put(4, LEAVES); put(5, LEAVES);
}

/**
 * A tower: glass between steel columns and floor bands, some of its windows
 * lit, a door in each side, floors inside every four; a roof with a ring of
 * neon round it and a mast in the middle. Some step in two-thirds of the way
 * up; some carry a great screen on their south face.
 */
function tower(t, lu, lv, put) {
  const mid = (LOT_LO + LOT_HI) / 2;
  const lo = Math.round(mid - t.size / 2), hi = lo + t.size - 1;
  if (lu < lo || lu > hi || lv < lo || lv > hi) return void put(-1, PAVEMENT);
  put(-1, PAVEMENT);
  const centre = Math.floor((lo + hi) / 2);
  for (let y = 0; y <= t.height; y++) {
    // Above a setback the tower is narrower.
    const inset = t.setback && y >= t.setback ? 3 : 0;
    const a = lo + inset, b = hi - inset;
    if (lu < a || lu > b || lv < a || lv > b) {
      // The setback's ledge: a floor, and a rail of neon round its edge.
      if (inset && y === t.setback) {
        put(y, STEEL_PANEL);
        if (lu === lo || lu === hi || lv === lo || lv === hi) put(y + 1, t.neon);
      }
      continue;
    }
    if (y === t.height) {
      put(y, STEEL_PANEL);
      const rim = lu === a || lu === b || lv === a || lv === b;
      if (rim) put(y + 1, t.neon);
      if (lu === centre && lv === centre) {
        for (let k = 1; k <= 6; k++) put(y + k, STEEL_PANEL);
        put(y + 7, t.neon === NEON_PINK ? NEON_CYAN : NEON_PINK);
      }
      break;
    }
    const xEdge = lu === a || lu === b, zEdge = lv === a || lv === b;
    if (!xEdge && !zEdge) {
      if (y > 0 && y % 4 === 0) put(y, STEEL_PANEL);
      continue;
    }
    if (xEdge && zEdge) { put(y, STEEL_PANEL); continue; }
    const along = xEdge ? lv : lu;
    // A door in the middle of each side, at the street.
    if (y <= 2 && !inset && Math.abs(along - centre) <= 1) continue;
    if (y % 4 === 0 || (along - a) % 5 === 0) { put(y, STEEL_PANEL); continue; }
    // The screen, high on the south face.
    if (t.screen && lv === b && !inset && y >= t.height - 16 && y <= t.height - 8 && Math.abs(lu - centre) <= 4) { put(y, SCREEN); continue; }
    const lit = hash01(lu * 31 + lv, Math.floor(y / 4), t.salt) < t.lit;
    put(y, lit ? LIT_WINDOW : TINTED_GLASS);
  }
}

/**
 * Lays the city into a chunk, where the chunk is in the Future. The ground
 * under it was made flat at FUTURE_GROUND (ChunkGen.heightAt); this writes
 * its top and everything standing on it.
 */
export function stampFuture(gen, chunk, size) {
  const centreX = gen.biomes.centreX ?? 0, centreZ = gen.biomes.centreZ ?? 0;
  const ox = chunk.cx * size, oz = chunk.cz * size;
  if (!inFuture(ox, centreX)) return;
  const at = futureArrival(centreX, centreZ);
  for (let lx = 0; lx < size; lx++) {
    if (!inFuture(ox + lx, centreX)) continue;
    for (let lz = 0; lz < size; lz++) {
      futureColumn(ox + lx - at.x, oz + lz - at.z, gen.seed, (dy, id) => {
        const y = FUTURE_GROUND + dy;
        if (y >= 0 && y < chunk.height) chunk.set(lx, y, lz, id);
      });
    }
  }
}

/** Where the Archive stands, in the world. */
export function archiveAt(centreX = 0, centreZ = 0) {
  const at = futureArrival(centreX, centreZ);
  return {
    x: at.x + UNIVERSITY[0] * CELL + ARCHIVE_AT.lu - CELL / 2,
    y: FUTURE_GROUND,
    z: at.z + UNIVERSITY[1] * CELL + ARCHIVE_AT.lv - CELL / 2,
  };
}
