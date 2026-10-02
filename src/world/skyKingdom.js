import { hash01 } from './ChunkGen.js';
import { doorBlock, turned, roofBlock, BED, BED_HEAD, FACING_STEP, PAINTING, WEAPON_RACK, TRAINING_DUMMY, ARCHERY_TARGET } from '../config/blocks.js';
import { ROOFS_BY_ID } from '../config/roofs.js';
import { roofBlocks, roofTypeFor } from '../tools/RoofTool.js';

/**
 * The Sky Kingdom (the dark path, docs/plan-phase7-lore.md): where you come
 * from — "a mystical floating island 5,000 blocks away. Its underside is
 * rock, with waterfalls pouring off its edge. On top are white marble halls
 * and gold roofs, with fireflies drifting over it ... Its great chains run
 * down to anchor towers on the ground."
 *
 * A whole city on it (asked for in the playtest: "that island needs to be
 * way bigger — houses, military houses and walls too"):
 *
 *   island    ~220 across, its floor at FLOOR; rock below, deepest in the
 *             middle, three waterfalls off the rim
 *   city wall a white wall round the island a little in from its edge, with
 *             towers along it and a gatehouse on each of the four avenues
 *   avenues   four broad calçada roads from the gates to the citadel, lamps
 *             down both sides
 *   districts three quarters of houses — cottages, two-storey townhouses,
 *             villas with porticos — with gardens and fountain squares
 *   military  the fourth quarter: barracks with bunks and racks of arms,
 *             armouries, and training yards with dummies and targets
 *   citadel   a walled square in the middle, towers at its corners, round
 *             the palace: gold step roof and spire, the throne room inside
 *             with the Sky King
 *   towers    four anchor towers on the ground round it, each with a chain
 *             up to the rim and a lift at the top; a lift at each landing
 *             outside the gates takes you back down
 *
 * Like the Stone Kingdom it's planned once per world and laid chunk by chunk
 * (see kingdom.js) — its rock and grass worked out column by column as each
 * chunk is made, everything built on it from the plan. It only exists on the
 * dark path (and in Creative, to look at): the generator lays it only while
 * `gen.sky` is set, which Game sets from your ring.
 */

/** How far out from home it hangs. */
export const SKY_AT = 5000;
/** Its floor: the first open cell over its grass. */
export const FLOOR = 172;
/** Its rough radius. */
export const ISLAND_R = 112;
/** How far out from its middle the anchor towers stand, on the ground. */
const TOWER_OUT = ISLAND_R + 30;
/** How far out from its middle anything of it reaches: the towers and their footings. */
export const SKY_REACH = TOWER_OUT + 6;
/** The city wall stands this far in from the rim. */
const WALL_IN = 12;
/** The citadel's wall: its half-width. */
const CITADEL = 28;
/** The districts' plots: square, this big, with lanes between, starting this far off the avenues. */
const PLOT = 13, LANE = 2, FIRST = 8;
/** The avenues' half-width. */
const AVENUE = 2;
/** The palace: half-width, half-depth, wall height. */
const PW = 13, PD = 11, TALL = 10;

const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, PLANKS = 7, COBBLE = 8, WATER = 11, GOLD = 13, MARBLE = 17, MOSS = 22, GRAVEL = 23,
      LANTERN = 26, STONE_STAIRS = 29, OAK_TABLE = 31, MARBLE_TABLE = 32, OAK_CHAIR = 33, RED_RUG = 35, BLUE_RUG = 36,
      WHITE_WOOD = 41, WHITE_LEAVES = 42, FENCE = 47, GATE = 48, CHANDELIER = 85, SKY_MARBLE = 158, GOLD_TRIM = 159,
      MARBLE_PILLAR = 166, WINDOW = 176, VASE = 180, URN = 181, WHITE_BANNER = 182, FIREFLY = 190,
      CALCADA = 209, DARK_CALCADA = 210, CALCADA_WAVE = 211, CHAIN = 229, SKY_LIFT = 230;
const SLATE = roofBlock({ mat: 1 });
/** The four avenues' ways out from the middle: +x, +z, -x, -z. */
const AXES = [[1, 0], [0, 1], [-1, 0], [0, -1]];

/**
 * The island, its towers and everything on them — worked out once per
 * generator and kept. { kind: 'sky', x, z, y: FLOOR, half, byChunk, king,
 * posts, plots, towers: [{ x, y, z, lift, landing, arrive }], landings, palace }.
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

/** The island's rim radius at an angle — gently lobed, the same for a world every time. */
export function rimAt(seed, theta) {
  const p1 = hash01(seed, 92, 0x5c02) * 6.28, p2 = hash01(seed, 93, 0x5c03) * 6.28;
  return ISLAND_R * (0.93 + 0.05 * Math.sin(3 * theta + p1) + 0.02 * Math.sin(5 * theta + p2));
}

/**
 * The island's own ground at (x, z), its middle at (cx, cz): the lowest
 * cell of its rock and what's on top — or null off its edge.
 */
export function skyColumn(seed, cx, cz, x, z) {
  const dx = x - cx, dz = z - cz, rho = Math.hypot(dx, dz);
  const rim = rimAt(seed, Math.atan2(dz, dx));
  if (rho > rim) return null;
  const t = rho / rim;
  let depth = Math.round(6 + 40 * Math.pow(1 - t * t, 1.2) + hash01(x, z, seed ^ 0x5c11) * 3);
  // The odd spike of rock hanging lower under the middle.
  if (t < 0.6 && hash01(z, x, seed ^ 0x5c12) < 0.03) depth += 4 + Math.floor(hash01(x + 7, z, seed ^ 0x5c13) * 12);
  return { bottom: FLOOR - 1 - depth, top: t > 0.95 && hash01(x, z, seed ^ 0x5c14) < 0.5 ? MOSS : GRASS };
}

function plan(gen, cx, cz) {
  const seed = gen.seed ?? 0;
  const cells = new Map();
  const put = (x, y, z, id) => cells.set(`${x},${y},${z}`, id);
  const get = (x, y, z) => cells.get(`${x},${y},${z}`);
  const fill = (x0, x1, y0, y1, z0, z1, id) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) put(x, y, z, id);
    }
  };
  const h = (a, b, salt = 0) => hash01(cx * 31 + a, cz * 17 + b, seed ^ 0x5c00 ^ salt);
  const rim = (dx, dz) => rimAt(seed, Math.atan2(dz, dx));
  const F = FLOOR;
  // The city wall's inner face, out from the middle at the angle of (dx, dz).
  const wallAt = (dx, dz) => rim(dx, dz) - WALL_IN;

  /** Walls round a rectangle: its outline, y0..y1. */
  const shell = (x0, z0, x1, z1, y0, y1, id) => {
    for (let x = x0; x <= x1; x++) for (const z of [z0, z1]) fill(x, x, y0, y1, z, z, id);
    for (let z = z0; z <= z1; z++) for (const x of [x0, x1]) fill(x, x, y0, y1, z, z, id);
  };
  /** A stepped gold roof over a rectangle, from y: each step a ring, the top one filled. */
  const goldRoof = (x0, z0, x1, z1, y) => {
    for (let k = 0; x0 + k <= x1 - k && z0 + k <= z1 - k; k++) {
      const top = x0 + k + 1 > x1 - k - 1 || z0 + k + 1 > z1 - k - 1;
      if (top) fill(x0 + k, x1 - k, y + k, y + k, z0 + k, z1 - k, k % 2 ? GOLD_TRIM : GOLD);
      else shell(x0 + k, z0 + k, x1 - k, z1 - k, y + k, y + k, k % 2 ? GOLD_TRIM : GOLD);
    }
  };
  /** A gable of slate over a rectangle from y — the Roof tool's own rules; the gable ends in `wall`. */
  const slateRoof = (x0, z0, x1, z1, y, wall) => {
    const w = x1 - x0 + 1, d = z1 - z0 + 1, spans = new Map();
    for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) spans.set(`${x0 + x},${z0 + z}`, { xm: x + 1, xp: w - x, zm: z + 1, zp: d - z });
    for (const b of roofBlocks({ spans }, { shape: ROOFS_BY_ID.get('gable'), turn: w > d ? 1 : 0 })) put(b.x, y + b.dy, b.z, b.slope ? roofTypeFor(SLATE, b) : wall);
  };
  /** A white tree: a pale trunk and a round crown. */
  const tree = (x, z) => {
    const tall = 4 + Math.floor(h(x, z, 24) * 3);
    fill(x, x, F, F + tall - 1, z, z, WHITE_WOOD);
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let y = tall - 2; y <= tall + 1; y++) {
      if (Math.abs(i) + Math.abs(j) + Math.max(0, y - tall) * 2 > 3) continue;
      if (i === 0 && j === 0 && y < tall) continue;
      if (get(x + i, F + y, z + j) == null) put(x + i, F + y, z + j, WHITE_LEAVES);
    }
  };
  /** A fountain round (x, z): a marble basin of water, a gold-topped pillar in it, a firefly lamp on that. */
  const fountain = (x, z) => {
    shell(x - 2, z - 2, x + 2, z + 2, F, F, SKY_MARBLE);
    fill(x - 1, x + 1, F - 1, F - 1, z - 1, z + 1, WATER);
    fill(x, x, F - 1, F + 1, z, z, MARBLE_PILLAR);
    put(x, F + 2, z, GOLD_TRIM); put(x, F + 3, z, FIREFLY);
  };
  const lamp = (x, z) => { fill(x, x, F, F + 1, z, z, MARBLE_PILLAR); put(x, F + 2, z, FIREFLY); };

  /**
   * One plot of a district, PLOT square, its front (where its door is)
   * towards the island's east–west avenue. Its own put/fill take plot
   * coordinates: lx across, lz back from the front.
   */
  const lot = (x0, z0, flip) => {
    const at = (lx, lz) => [x0 + lx, flip ? z0 + PLOT - 1 - lz : z0 + lz];
    // Facings: 0 is towards the front (-lz), 2 towards the back.
    const face = (f) => (flip && (f === 0 || f === 2) ? 2 - f : f);
    const L = {
      at,
      put(lx, y, lz, id) { const [x, z] = at(lx, lz); put(x, y, z, id); },
      fill(lx0, lx1, y0, y1, lz0, lz1, id) {
        for (let lx = lx0; lx <= lx1; lx++) for (let lz = lz0; lz <= lz1; lz++) for (let y = y0; y <= y1; y++) L.put(lx, y, lz, id);
      },
      shell(lx0, lz0, lx1, lz1, y0, y1, id) {
        for (let lx = lx0; lx <= lx1; lx++) for (const lz of [lz0, lz1]) L.fill(lx, lx, y0, y1, lz, lz, id);
        for (let lz = lz0; lz <= lz1; lz++) for (const lx of [lx0, lx1]) L.fill(lx, lx, y0, y1, lz, lz, id);
      },
      turned: (id, f) => turned(id, face(f)),
      door(lx, lz) {
        L.put(lx, F, lz, doorBlock({ facing: face(2) }));
        L.put(lx, F + 1, lz, doorBlock({ facing: face(2), top: true }));
      },
      bed(lx, lz, f, y = F) {
        const [sx, sz] = FACING_STEP[f];
        L.put(lx, y, lz, BED + face(f));
        L.put(lx + sx, y, lz + sz, BED_HEAD + face(f));
      },
      // A window in a wall running across the plot (lz fixed) or along it (lx fixed).
      across: (lx, y, lz) => L.put(lx, y, lz, WINDOW),
      along: (lx, y, lz) => L.put(lx, y, lz, WINDOW + 1),
      /** The world rectangle under plot cells lx0..lx1, lz0..lz1, as [minX, minZ, maxX, maxZ]. */
      rect(lx0, lz0, lx1, lz1) {
        const [ax, az] = at(lx0, lz0), [bx, bz] = at(lx1, lz1);
        return [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)];
      },
    };
    return L;
  };

  /** White walls on a footprint up to `top`, pillars at its corners, gold bands at `trims`. */
  const walls = (L, lx0, lz0, lx1, lz1, top, trims) => {
    L.shell(lx0, lz0, lx1, lz1, F, top, SKY_MARBLE);
    for (const y of trims) L.shell(lx0, lz0, lx1, lz1, y, y, GOLD_TRIM);
    for (const [lx, lz] of [[lx0, lz0], [lx1, lz0], [lx0, lz1], [lx1, lz1]]) L.fill(lx, lx, F, top, lz, lz, MARBLE_PILLAR);
  };
  /** Calçada from the front of the plot up to a door at lx. */
  const forecourt = (L, lx, lz1) => L.fill(lx - 1, lx + 1, F - 1, F - 1, 0, lz1, CALCADA);

  // ---- the districts' buildings ---------------------------------------------------------------

  /** A one-room cottage under a slate gable: a bed, a table and chair, a rug, a painting. */
  const cottage = (L) => {
    const a = 3, b = 4, c = 9, d = 9;
    L.fill(a, c, F - 1, F - 1, b, d, SKY_MARBLE);
    walls(L, a, b, c, d, F + 3, [F + 3]);
    L.door(6, b); forecourt(L, 6, b - 1);
    L.across(4, F + 1, b); L.across(8, F + 1, b); L.across(5, F + 1, d); L.across(7, F + 1, d);
    L.along(a, F + 1, 6); L.along(c, F + 1, 7);
    L.bed(4, 7, 2);
    L.put(8, F, 7, MARBLE_TABLE); L.put(8, F + 1, 7, LANTERN); L.put(7, F, 7, L.turned(OAK_CHAIR, 1));
    L.fill(6, 6, F, F, 6, 7, BLUE_RUG);
    L.put(8, F, 5, VASE);
    L.put(6, F + 2, d - 1, L.turned(PAINTING, 2));
    slateRoof(...L.rect(a, b, c, d), F + 4, SKY_MARBLE);
  };

  /** A townhouse, two storeys: a room below, a stair up the side, beds above, a gold roof. */
  const townhouse = (L) => {
    const a = 2, b = 3, c = 10, d = 9;
    L.fill(a, c, F - 1, F - 1, b, d, SKY_MARBLE);
    walls(L, a, b, c, d, F + 6, [F + 3, F + 6]);
    L.door(5, b); forecourt(L, 5, b - 1);
    for (const lx of [3, 7, 9]) { L.across(lx, F + 1, b); L.across(lx, F + 4, b); }
    for (const lx of [4, 6, 8]) { L.across(lx, F + 1, d); L.across(lx, F + 4, d); }
    for (const lz of [5, 7]) { L.along(a, F + 1, lz); L.along(a, F + 4, lz); L.along(c, F + 4, lz); }
    // The upper floor, open over the stair that climbs the right-hand wall.
    for (let lx = a + 1; lx < c; lx++) for (let lz = b + 1; lz < d; lz++) if (!(lx === c - 1 && lz <= b + 3)) L.put(lx, F + 3, lz, PLANKS);
    for (let k = 0; k < 3; k++) L.put(c - 1, F + k, b + 1 + k, L.turned(STONE_STAIRS, 2));
    L.put(4, F, 6, OAK_TABLE); L.put(5, F, 6, OAK_TABLE); L.put(4, F, 5, L.turned(OAK_CHAIR, 2)); L.put(5, F, 7, L.turned(OAK_CHAIR, 0));
    L.put(4, F + 1, 6, LANTERN);
    L.fill(6, 7, F, F, 6, 7, RED_RUG);
    L.bed(3, 7, 2, F + 4); L.bed(5, 7, 2, F + 4);
    L.put(3, F + 4, 5, VASE);
    goldRoof(...L.rect(a, b, c, d), F + 7);
  };

  /** A villa: a portico of pillars in front, a long hall behind, a gold roof over both. */
  const villa = (L) => {
    const a = 1, b = 4, c = 11, d = 11;
    L.fill(a, c, F - 1, F - 1, 2, d, SKY_MARBLE);
    walls(L, a, b, c, d, F + 4, [F + 4]);
    for (const lx of [a, 4, 8, c]) L.fill(lx, lx, F, F + 4, 2, 2, MARBLE_PILLAR);
    L.fill(a, c, F + 4, F + 4, 2, 3, GOLD_TRIM);
    L.door(6, b); forecourt(L, 6, 1);
    for (const lx of [3, 9]) { L.across(lx, F + 1, b); L.across(lx, F + 2, b); }
    for (const lx of [3, 6, 9]) { L.across(lx, F + 1, d); L.across(lx, F + 2, d); }
    for (const lz of [6, 9]) { L.along(a, F + 1, lz); L.along(c, F + 1, lz); }
    L.fill(5, 7, F, F, 5, 10, BLUE_RUG);
    L.put(6, F, 8, MARBLE_TABLE); L.put(6, F + 1, 8, FIREFLY);
    L.put(5, F, 8, L.turned(OAK_CHAIR, 1)); L.put(7, F, 8, L.turned(OAK_CHAIR, 3));
    L.bed(2, 9, 2); L.bed(10, 9, 2);
    L.put(2, F, 5, URN); L.put(10, F, 5, URN); L.put(4, F, 10, VASE); L.put(8, F, 10, VASE);
    L.put(6, F + 3, d - 1, CHANDELIER);
    goldRoof(...L.rect(a, 2, c, d), F + 5);
  };

  /** A garden: a fountain, white trees, a cross of paths with benches. */
  const garden = (L) => {
    L.fill(5, 7, F - 1, F - 1, 0, PLOT - 1, CALCADA); L.fill(0, PLOT - 1, F - 1, F - 1, 5, 7, CALCADA);
    fountain(...L.at(6, 6));
    for (const [lx, lz] of [[2, 2], [10, 2], [2, 10], [10, 10]]) tree(...L.at(lx, lz));
    L.put(6, F, 3, L.turned(STONE_STAIRS, 0)); L.put(6, F, 9, L.turned(STONE_STAIRS, 2));
  };

  /** A square: patterned calçada, a fountain, lamps on its corners, banners. */
  const square = (L) => {
    L.fill(0, PLOT - 1, F - 1, F - 1, 0, PLOT - 1, CALCADA_WAVE);
    fountain(...L.at(6, 6));
    for (const [lx, lz] of [[1, 1], [11, 1], [1, 11], [11, 11]]) lamp(...L.at(lx, lz));
    L.put(4, F, 1, L.turned(WHITE_BANNER, 0)); L.put(8, F, 1, L.turned(WHITE_BANNER, 0));
  };

  // ---- the military quarter's ----------------------------------------------------------------

  /** A barracks: six bunks, racks of arms, a mess table; banners at its door; a slate roof. */
  const barracks = (L) => {
    const a = 0, b = 3, c = 12, d = 11;
    L.fill(a, c, F - 1, F - 1, b, d, PLANKS);
    L.fill(0, PLOT - 1, F - 1, F - 1, 0, b - 1, GRAVEL);
    walls(L, a, b, c, d, F + 4, [F + 4]);
    L.shell(a, b, c, d, F, F, MARBLE);
    L.door(6, b);
    for (const lx of [2, 10]) L.across(lx, F + 2, b);
    for (const lx of [2, 6, 10]) L.across(lx, F + 2, d);
    for (const lz of [6, 8]) { L.along(a, F + 2, lz); L.along(c, F + 2, lz); }
    for (const lx of [1, 3, 5, 7, 9, 11]) L.bed(lx, d - 2, 2);
    for (const lz of [5, 6]) { L.put(1, F, lz, turned(WEAPON_RACK, 1)); L.put(c - 1, F, lz, turned(WEAPON_RACK, 3)); }
    for (const lx of [4, 5, 7, 8]) { L.put(lx, F, 7, OAK_TABLE); L.put(lx, F, 6, L.turned(OAK_CHAIR, 2)); }
    L.put(6, F + 3, 7, CHANDELIER);
    L.put(1, F, 4, LANTERN); L.put(c - 1, F, 4, LANTERN);
    L.put(4, F, 2, L.turned(WHITE_BANNER, 0)); L.put(8, F, 2, L.turned(WHITE_BANNER, 0));
    slateRoof(...L.rect(a, b, c, d), F + 5, SKY_MARBLE);
  };

  /** An armoury: stone below, racks of arms round its walls, a gold roof. */
  const armoury = (L) => {
    const a = 2, b = 3, c = 10, d = 10;
    L.fill(a, c, F - 1, F - 1, b, d, COBBLE);
    walls(L, a, b, c, d, F + 4, [F + 4]);
    L.shell(a, b, c, d, F, F + 1, COBBLE);
    for (const [lx, lz] of [[a, b], [c, b], [a, d], [c, d]]) L.fill(lx, lx, F, F + 4, lz, lz, MARBLE_PILLAR);
    L.door(6, b); forecourt(L, 6, b - 1);
    L.across(4, F + 3, b); L.across(8, F + 3, b);
    for (const lz of [5, 6, 7, 8]) { L.put(a + 1, F, lz, turned(WEAPON_RACK, 1)); L.put(c - 1, F, lz, turned(WEAPON_RACK, 3)); }
    for (const lx of [4, 5, 7, 8]) L.put(lx, F, d - 1, L.turned(WEAPON_RACK, 0));
    L.put(6, F, d - 1, URN); L.put(4, F, 4, URN);
    L.put(6, F + 3, 6, CHANDELIER);
    L.put(4, F, 2, L.turned(WHITE_BANNER, 0)); L.put(8, F, 2, L.turned(WHITE_BANNER, 0));
    goldRoof(...L.rect(a, b, c, d), F + 5);
  };

  /** A training yard: gravel inside a fence, dummies, targets at the back, racks of arms. */
  const yard = (L) => {
    L.fill(0, PLOT - 1, F - 1, F - 1, 0, PLOT - 1, GRAVEL);
    L.shell(0, 0, PLOT - 1, PLOT - 1, F, F, FENCE);
    L.put(6, F, 0, GATE);
    L.put(5, F + 1, 0, LANTERN); L.put(7, F + 1, 0, LANTERN);
    for (const lx of [3, 6, 9]) L.put(lx, F, 4, L.turned(TRAINING_DUMMY, 0));
    for (const lx of [3, 6, 9]) L.put(lx, F, PLOT - 2, L.turned(ARCHERY_TARGET, 0));
    L.put(1, F, 7, turned(WEAPON_RACK, 1)); L.put(PLOT - 2, F, 7, turned(WEAPON_RACK, 3));
    L.put(4, F, 1, L.turned(WHITE_BANNER, 0)); L.put(8, F, 1, L.turned(WHITE_BANNER, 0));
  };

  // ---- waterfalls: a basin by the rim and its water pouring off ---------------------------
  for (let k = 0; k < 3; k++) {
    const theta = Math.PI / 4 + k * (Math.PI * 2 / 3) + (h(k, 40) - 0.5) * 0.3;
    const r = rimAt(seed, theta);
    const bx = cx + Math.round(Math.cos(theta) * (r - 3)), bz = cz + Math.round(Math.sin(theta) * (r - 3));
    fill(bx - 1, bx + 1, F - 1, F - 1, bz - 1, bz + 1, WATER);
    const ox = cx + Math.round(Math.cos(theta) * (r + 1)), oz = cz + Math.round(Math.sin(theta) * (r + 1));
    for (let y = F - 1; y > F - 30; y--) put(ox, y, oz, WATER);
  }

  // ---- the citadel: its courtyard, its wall and gates, towers at its corners ---------------
  fill(cx - CITADEL + 2, cx + CITADEL - 2, F - 1, F - 1, cz - CITADEL + 2, cz + CITADEL - 2, SKY_MARBLE);
  for (let i = -CITADEL; i <= CITADEL; i++) {
    for (const e of [-CITADEL, -CITADEL + 1, CITADEL - 1, CITADEL]) {
      for (const [x, z] of [[cx + i, cz + e], [cx + e, cz + i]]) {
        const gate = Math.abs(i) <= AVENUE;
        fill(x, x, gate ? F + 5 : F, F + 8, z, z, SKY_MARBLE);
        put(x, F + 7, z, GOLD_TRIM);
        if (gate) put(x, F + 5, z, GOLD_TRIM);
        if (Math.abs(e) === CITADEL && i % 2 === 0) put(x, F + 9, z, SKY_MARBLE);   // merlons
      }
    }
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tx = cx + sx * CITADEL, tz = cz + sz * CITADEL;
    shell(tx - 3, tz - 3, tx + 3, tz + 3, F, F + 12, SKY_MARBLE);
    shell(tx - 3, tz - 3, tx + 3, tz + 3, F + 10, F + 10, GOLD_TRIM);
    fill(tx - 3, tx + 3, F + 12, F + 12, tz - 3, tz + 3, SKY_MARBLE);
    for (let i = -3; i <= 3; i += 2) for (const e of [-3, 3]) { put(tx + i, F + 13, tz + e, SKY_MARBLE); put(tx + e, F + 13, tz + i, SKY_MARBLE); }
    put(tx, F + 13, tz, FIREFLY);
    for (const e of [-3, 3]) { fill(tx + e, tx + e, F + 5, F + 6, tz, tz, WINDOW + 1); fill(tx, tx, F + 5, F + 6, tz + e, tz + e, WINDOW); }
  }
  // A white tree in a bed of grass in each corner of the courtyard, and two fountains before the palace.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + sx * 20, z = cz + sz * 20;
    fill(x - 2, x + 2, F - 1, F - 1, z - 2, z + 2, GRASS);
    tree(x, z);
  }
  fountain(cx - 9, cz - 20); fountain(cx + 9, cz - 20);

  // ---- the palace ----------------------------------------------------------------------------
  // A gold-edged terrace, the hall on it with pillars along its walls and
  // two rows of windows, a portico before its door, the stepped gold roof
  // and a spire.
  for (let i = -PW - 2; i <= PW + 2; i++) { put(cx + i, F - 1, cz - PD - 3, GOLD_TRIM); put(cx + i, F - 1, cz + PD + 2, GOLD_TRIM); }
  for (let i = -PD - 3; i <= PD + 2; i++) { put(cx - PW - 2, F - 1, cz + i, GOLD_TRIM); put(cx + PW + 2, F - 1, cz + i, GOLD_TRIM); }
  shell(cx - PW, cz - PD, cx + PW, cz + PD, F, F + TALL - 1, SKY_MARBLE);
  shell(cx - PW, cz - PD, cx + PW, cz + PD, F + 4, F + 4, GOLD_TRIM);
  shell(cx - PW, cz - PD, cx + PW, cz + PD, F + TALL - 2, F + TALL - 2, GOLD_TRIM);
  for (const x of [-PW, -9, -5, 5, 9, PW]) for (const z of [-PD, PD]) fill(cx + x, cx + x, F, F + TALL - 1, cz + z, cz + z, MARBLE_PILLAR);
  for (const z of [-5, 0, 5]) for (const x of [-PW, PW]) fill(cx + x, cx + x, F, F + TALL - 1, cz + z, cz + z, MARBLE_PILLAR);
  for (let x = -PW + 2; x <= PW - 2; x += 2) {
    if (Math.abs(x) <= 2 || Math.abs(x) === 9 || Math.abs(x) === 5) continue;
    for (const y of [F + 2, F + 6]) for (const z of [-PD, PD]) fill(cx + x, cx + x, y, y + 1, cz + z, cz + z, WINDOW);
  }
  for (let z = -PD + 2; z <= PD - 2; z += 2) {
    if (Math.abs(z) === 5) continue;
    for (const y of [F + 2, F + 6]) for (const x of [-PW, PW]) fill(cx + x, cx + x, y, y + 1, cz + z, cz + z, WINDOW + 1);
  }
  fill(cx - 1, cx + 1, F, F + 3, cz - PD, cz - PD, AIR);                          // the great door
  fill(cx - 1, cx + 1, F + 4, F + 4, cz - PD, cz - PD, GOLD);
  for (const x of [-7, -3, 3, 7]) fill(cx + x, cx + x, F, F + 6, cz - PD - 2, cz - PD - 2, MARBLE_PILLAR);
  fill(cx - 8, cx + 8, F + 7, F + 7, cz - PD - 2, cz - PD - 1, GOLD_TRIM);
  put(cx - 5, F, cz - PD - 1, turned(WHITE_BANNER, 0)); put(cx + 5, F, cz - PD - 1, turned(WHITE_BANNER, 0));
  goldRoof(cx - PW - 1, cz - PD - 1, cx + PW + 1, cz + PD + 1, F + TALL);
  const spire = F + TALL + Math.min(PW, PD) + 2;
  fill(cx, cx, spire, Math.min(198, spire + 3), cz, cz, GOLD);
  put(cx, Math.min(199, spire + 4), cz, FIREFLY);
  // The throne room: a blue aisle to the dais, pillars down both sides,
  // firefly lamps along the walls, chandeliers, banners, the gold throne.
  fill(cx - 1, cx + 1, F, F, cz - PD + 1, cz + PD - 6, BLUE_RUG);
  for (const z of [-7, -3, 1, 5]) {
    for (const x of [-7, 7]) fill(cx + x, cx + x, F, F + TALL - 1, cz + z, cz + z, MARBLE_PILLAR);
    for (const x of [-PW + 1, PW - 1]) put(cx + x, F, cz + z, FIREFLY);
  }
  for (const z of [-5, -1, 3]) for (const x of [-4, 4]) put(cx + x, F + TALL - 3, cz + z, CHANDELIER);
  fill(cx - 4, cx + 4, F, F, cz + PD - 4, cz + PD - 1, GOLD_TRIM);                // the dais
  for (let x = -4; x <= 4; x++) put(cx + x, F, cz + PD - 5, turned(STONE_STAIRS, 2));
  put(cx, F + 1, cz + PD - 1, GOLD); put(cx, F + 2, cz + PD - 1, GOLD);           // the throne
  put(cx - 1, F + 1, cz + PD - 1, GOLD_TRIM); put(cx + 1, F + 1, cz + PD - 1, GOLD_TRIM);
  for (const x of [-3, 3]) put(cx + x, F + 1, cz + PD - 1, turned(WHITE_BANNER, 2));
  for (const x of [-4, 4]) put(cx + x, F + 1, cz + PD - 2, URN);

  // ---- the city wall, its towers and gatehouses ---------------------------------------------
  const R = ISLAND_R + 2;
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const rho = Math.hypot(dx, dz), w = wallAt(dx, dz);
      if (rho < w || rho >= w + 2) continue;
      const x = cx + dx, z = cz + dz;
      const gate = Math.abs(dx) <= AVENUE || Math.abs(dz) <= AVENUE;
      fill(x, x, gate ? F + 5 : F, F + 7, z, z, SKY_MARBLE);
      put(x, F + 6, z, GOLD_TRIM);
      if (gate) put(x, F + 5, z, GOLD_TRIM);
      // Merlons on its outer half, every other block along it.
      if (rho >= w + 1 && Math.abs(Math.floor(Math.atan2(dz, dx) * w)) % 2 === 0) put(x, F + 8, z, SKY_MARBLE);
    }
  }
  /** A square tower at (x, z): a white shell, a gold band, battlements, a lamp on top. */
  const wallTower = (x, z, half, top) => {
    shell(x - half, z - half, x + half, z + half, F, top, SKY_MARBLE);
    shell(x - half, z - half, x + half, z + half, top - 2, top - 2, GOLD_TRIM);
    fill(x - half, x + half, top, top, z - half, z + half, SKY_MARBLE);
    for (let i = -half; i <= half; i += 2) for (const e of [-half, half]) { put(x + i, top + 1, z + e, SKY_MARBLE); put(x + e, top + 1, z + i, SKY_MARBLE); }
    put(x, top + 1, z, FIREFLY);
  };
  for (let k = 0; k < 12; k++) {
    if (k % 3 === 0) continue; // the avenues' gatehouses stand there
    const theta = k * Math.PI / 6;
    const r = rimAt(seed, theta) - WALL_IN + 1;
    wallTower(cx + Math.round(Math.cos(theta) * r), cz + Math.round(Math.sin(theta) * r), 3, F + 11);
  }

  // ---- the avenues, their gatehouses, and the landings outside them ----------------------------
  const landings = [];
  for (const [ux, uz] of AXES) {
    const theta = Math.atan2(uz, ux);
    const r = rimAt(seed, theta), wall = r - WALL_IN;
    const along = (s, w) => [cx + ux * s - uz * w, cz + uz * s + ux * w];
    for (let s = PW + 1; s < r - 3; s++) {
      for (let w = -AVENUE; w <= AVENUE; w++) { const [x, z] = along(s, w); put(x, F - 1, z, Math.abs(w) === AVENUE ? DARK_CALCADA : CALCADA); }
      if (s > CITADEL + 3 && s < wall - 2 && s % 8 === 0) for (const w of [-4, 4]) lamp(...along(s, w));
    }
    const g = Math.round(wall) + 1;
    for (const w of [-5, 5]) wallTower(...along(g, w), 2, F + 12);
    for (const w of [-3, 3]) { const [x, z] = along(g - 2, w); put(x, F, z, WHITE_BANNER); }
    // The landing: a lift back down, outside the gate, at the end of the avenue.
    const lr = Math.floor(r) - 5;
    const [lx, lz] = along(lr, 0);
    fill(lx - 1, lx + 1, F - 1, F - 1, lz - 1, lz + 1, SKY_MARBLE);
    put(lx, F, lz, SKY_LIFT);
    const [ax, az] = along(lr - 3, 0);
    landings.push({ x: lx, y: F, z: lz, theta, ux, uz, wall, arrive: { x: ax + 0.5, y: F, z: az + 0.5 } });
  }

  // ---- the districts: three quarters of houses, one the military's -----------------------------
  const plots = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const military = sx === 1 && sz === 1;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const px = FIRST + i * (PLOT + LANE), pz = FIRST + j * (PLOT + LANE);
        if (px < CITADEL + 4 && pz < CITADEL + 4) continue;                      // the citadel's
        const x0 = sx > 0 ? cx + px : cx - px - PLOT + 1, z0 = sz > 0 ? cz + pz : cz - pz - PLOT + 1;
        const corners = [[x0, z0], [x0 + PLOT - 1, z0], [x0, z0 + PLOT - 1], [x0 + PLOT - 1, z0 + PLOT - 1]];
        if (corners.some(([x, z]) => Math.hypot(x - cx, z - cz) > wallAt(x - cx, z - cz) - 3)) continue;
        if (h(px, pz, sx * 3 + sz + 50) < 0.08) continue;                        // the odd one left as grass
        const L = lot(x0, z0, sz < 0);
        let kind;
        if (military) kind = ['barracks', 'yard', 'armoury', 'barracks', 'yard'][(i + j * 2) % 5];
        else {
          const r = h(px, pz, sx * 5 + sz + 60);
          kind = r < 0.42 ? 'cottage' : r < 0.7 ? 'townhouse' : r < 0.84 ? 'villa' : r < 0.93 ? 'garden' : 'square';
        }
        ({ cottage, townhouse, villa, garden, square, barracks, armoury, yard })[kind](L);
        const [mx, mz] = L.at(6, 8);
        plots.push({ kind, x0, z0, inside: { x: mx, z: mz } });
      }
    }
  }
  // The lanes between the plots, paved.
  const lane = (a) => a > AVENUE + 2 && (a < FIRST || (a - FIRST) % (PLOT + LANE) >= PLOT);
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const ax = Math.abs(dx), az = Math.abs(dz);
      if (ax <= CITADEL + 3 && az <= CITADEL + 3) continue;
      if (!(lane(ax) || lane(az)) || ax <= AVENUE || az <= AVENUE) continue;
      if (Math.hypot(dx, dz) > wallAt(dx, dz) - 1) continue;
      if (get(cx + dx, F - 1, cz + dz) == null && get(cx + dx, F, cz + dz) == null) put(cx + dx, F - 1, cz + dz, CALCADA);
    }
  }

  // ---- white trees, where there's nothing else --------------------------------------------------
  for (let dx = -ISLAND_R; dx <= ISLAND_R; dx += 7) {
    for (let dz = -ISLAND_R; dz <= ISLAND_R; dz += 7) {
      const x = cx + dx + Math.round((h(dx, dz, 21) - 0.5) * 4), z = cz + dz + Math.round((h(dz, dx, 22) - 0.5) * 4);
      const ex = x - cx, ez = z - cz, rho = Math.hypot(ex, ez);
      if (rho > rim(ex, ez) - 4 || Math.abs(ex) <= AVENUE + 4 || Math.abs(ez) <= AVENUE + 4) continue;
      const w = wallAt(ex, ez);
      if (rho > w - 3 && rho < w + 5) continue;                                  // not up against the wall
      if (h(dx, dz, 23) > (rho > w ? 0.55 : 0.4)) continue;
      let clear = true;
      for (let i = -2; i <= 2 && clear; i++) for (let j = -2; j <= 2 && clear; j++) {
        for (let y = F - 1; y <= F + 1; y++) if (get(x + i, y, z + j) != null) clear = false;
      }
      if (clear) tree(x, z);
    }
  }

  // ---- the anchor towers, and their chains ------------------------------------------------------
  const towers = [];
  for (const l of landings) {
    const { ux, uz } = l;
    const tx = cx + ux * TOWER_OUT, tz = cz + uz * TOWER_OUT;
    const gy = Math.max(gen.heightAt(tx, tz), gen.waterLevelAt?.(tx, tz) ?? 0);
    const top = Math.min(F - 24, gy + 26);
    // Footings down into the ground, a shaft of sky marble with gold at the
    // corners, hollow, a stair winding up inside to a platform.
    for (let x = tx - 3; x <= tx + 3; x++) for (let z = tz - 3; z <= tz + 3; z++) for (let y = gy - 4; y < gy; y++) put(x, y, z, COBBLE);
    for (let x = tx - 2; x <= tx + 2; x++) {
      for (let z = tz - 2; z <= tz + 2; z++) {
        const edge = x === tx - 2 || x === tx + 2 || z === tz - 2 || z === tz + 2;
        for (let y = gy; y < top; y++) put(x, y, z, edge ? ((Math.abs(x - tx) === 2 && Math.abs(z - tz) === 2) ? GOLD_TRIM : SKY_MARBLE) : AIR);
      }
    }
    // The door, on the side away from the island: three high, so you can
    // step straight up onto the first stair from it.
    fill(tx + ux * 2, tx + ux * 2, gy, gy + 2, tz + uz * 2, tz + uz * 2, AIR);
    // The stair, round a pillar: up a step a cell, the eight cells round the
    // middle, starting from the one just inside the door.
    const RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
    const first = RING.findIndex(([i, j]) => i === ux && j === uz);
    const ring = (k) => RING[(first + k) % 8];
    fill(tx, tx, gy, top - 1, tz, tz, MARBLE_PILLAR);
    // The platform on top, and the way down through it (reported: "there's
    // a block blocking the path in the first patch of stairs"): the last step
    // sits in the platform, level with it, and the platform is open over the
    // three below that, so there's headroom onto the stair and down it.
    // A gold rail, lamps on the corners, and the lift off to the side —
    // clear of the chain, which leaves the middle for the island — with
    // where it sets you down two along from it, so nothing hangs between
    // you and it.
    fill(tx - 3, tx + 3, top, top, tz - 3, tz + 3, SKY_MARBLE);
    const steps = top - gy + 1;
    for (let k = steps - 4; k < steps - 1; k++) { const [i, j] = ring(k); put(tx + i, top, tz + j, AIR); }
    for (let k = 0; k < steps; k++) {
      const prev = ring(k + 7), at = ring(k);
      const facing = at[0] > prev[0] ? 1 : at[0] < prev[0] ? 3 : at[1] > prev[1] ? 2 : 0;
      put(tx + at[0], gy + k, tz + at[1], turned(STONE_STAIRS, facing));
    }
    for (let i = -3; i <= 3; i += 2) for (const e of [-3, 3]) { put(tx + i, top + 1, tz + e, GOLD_TRIM); put(tx + e, top + 1, tz + i, GOLD_TRIM); }
    for (const [i, j] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) put(tx + i, top + 2, tz + j, FIREFLY);
    const lift = { x: tx - uz * 2, y: top + 1, z: tz + ux * 2 };
    put(lift.x, lift.y, lift.z, SKY_LIFT);
    const arrive = { x: lift.x + ux * 2 + 0.5, y: top + 1, z: lift.z + uz * 2 + 0.5 };
    // The chain: from the platform up to the underside of the rim, a link a cell.
    const from = { x: tx, y: top + 2, z: tz };
    const to = { x: l.x, y: F - 6, z: l.z };
    const n = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z));
    for (let s = 0; s <= n; s++) {
      const x = Math.round(from.x + (to.x - from.x) * s / n), y = Math.round(from.y + (to.y - from.y) * s / n), z = Math.round(from.z + (to.z - from.z) * s / n);
      if (get(x, y, z) == null || get(x, y, z) === AIR) put(x, y, z, CHAIN);
    }
    towers.push({ x: tx, y: top + 1, z: tz, ground: gy, lift, landing: l, arrive });
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

  // Who stands where: two at every gate, the city's and the citadel's;
  // patrols down the avenues; two at the palace door; one in every
  // training yard.
  const posts = [{ x: cx - 2, z: cz - PD - 1 }, { x: cx + 2, z: cz - PD - 1 }];
  for (const l of landings) {
    const along = (s, w) => ({ x: cx + l.ux * s - l.uz * w, z: cz + l.uz * s + l.ux * w });
    for (const w of [-3, 3]) { posts.push(along(Math.round(l.wall) - 3, w)); posts.push(along(CITADEL + 3, w)); }
    for (const s of [52, 76]) if (s < l.wall - 6) posts.push(along(s, s === 52 ? 3 : -3));
  }
  for (const p of plots) if (p.kind === 'yard') posts.push(p.inside);

  return {
    kind: 'sky', x: cx, z: cz, y: F, half: SKY_REACH,
    // Its people are about from further off than a camp's: it's a city.
    visit: 180, leave: 230,
    byChunk, count: cells.size, plots,
    // On the dais, a step up, before his throne; his royal guard either
    // side of him, and the door a fallen one's replacement comes in by.
    king: { x: cx + 0.5, z: cz + PD - 2.5, dy: 1, facing: Math.PI },
    royal: [{ x: cx - 2 + 0.5, z: cz + PD - 3 + 0.5, dy: 1 }, { x: cx + 2 + 0.5, z: cz + PD - 3 + 0.5, dy: 1 }],
    palaceDoor: { x: cx + 0.5, z: cz - PD + 1.5 },
    posts: posts.map((p) => ({ x: p.x + 0.5, z: p.z + 0.5 })),
    towers, landings,
    palace: { minX: cx - PW, maxX: cx + PW, minZ: cz - PD, maxZ: cz + PD },
  };
}

/**
 * Lays the island's share of this chunk — only while the generator has it
 * (the dark path): its rock and grass column by column, then what's built.
 */
export function stampSky(gen, chunk, size) {
  if (!gen.sky) return;
  // Nowhere near: don't even plan it.
  const at = skyAt(gen), half = size / 2;
  if (Math.abs(chunk.cx * size + half - at.x) > SKY_REACH + size || Math.abs(chunk.cz * size + half - at.z) > SKY_REACH + size) return;
  const seed = gen.seed ?? 0, ox = chunk.cx * size, oz = chunk.cz * size;
  for (let lx = 0; lx < size; lx++) {
    for (let lz = 0; lz < size; lz++) {
      const x = ox + lx, z = oz + lz;
      const col = skyColumn(seed, at.x, at.z, x, z);
      if (!col) continue;
      for (let y = Math.max(0, col.bottom); y < FLOOR - 3; y++) chunk.set(lx, y, lz, hash01(x * 7 + y, z, seed ^ 0x5c15) < 0.07 ? MOSS : STONE);
      chunk.set(lx, FLOOR - 3, lz, DIRT); chunk.set(lx, FLOOR - 2, lz, DIRT);
      chunk.set(lx, FLOOR - 1, lz, col.top);
    }
  }
  const list = skyFor(gen)?.byChunk.get(`${chunk.cx},${chunk.cz}`);
  if (!list) return;
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
