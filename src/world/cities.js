import { hash01 } from './ChunkGen.js';
import { CHEST, roofPart } from '../config/blocks.js';
import { room, SLATE, TILE } from '../config/starterDesigns.js';

/**
 * Cities (backlog batch 2, "More places in the wild": "abandoned cities, and
 * cities with people living in them").
 *
 * One plan, two fates. A walled square with a gate north and south, a cross
 * of calçada streets, a plaza in the middle with a statue and market stalls,
 * and a dozen houses in the four quarters — built with the same `room` the
 * starter designs use, so a city's houses are the houses you could build.
 *
 * A living city has its people: guards at the gates, citizens in the
 * streets, merchants at the stalls (config/traders.js CITY_TRADERS), and a
 * light in every window. They're neutral; strike one, or take from their
 * chests, and the guards come for you (world/Wanderers.js).
 *
 * An abandoned city is the same plan gone to ruin: walls fallen to stumps,
 * roofs caved in, moss and gravel through the streets, nobody home — and
 * more chests, with better in them, for whoever walks in first.
 *
 * Coordinates are from the middle, y up from the ground (0 is where you
 * stand on the street; the street itself is at -1).
 */

const AIR = 0, LEAVES = 5, PLANKS = 7, COBBLE = 8, BRICK = 9, STONE = 3, MARBLE = 17, MOSS = 22, GRAVEL = 23,
      LANTERN = 26, PLANK_SLAB = 28, OAK_TABLE = 31, OAK_CHAIR = 33, RED_RUG = 35, BLUE_RUG = 36,
      FENCE = 47, GOLD_TRIM = 159, STONE_PILLAR = 165, WHITE_BANNER = 182,
      CALCADA = 209, CALCADA_DARK = 210, CALCADA_WAVE = 211, STONE_BRICK = 329, STONE_BRICK_WALL = 332;

/** How far the city reaches from its middle: the wall stands at WALL. */
export const CITY_HALF = 26;
const WALL = 24;

/** House plots in one quarter (the +x, +z one), as the corner of a 7 × 7 house. */
const PLOTS = [[3, 12], [12, 3], [12, 12]];

/**
 * A city, as blocks and the people who live in it.
 *
 *   roll     0..1 from the seed — no two quite alike
 *   ruined   an abandoned city rather than a living one
 *
 * Returns { half, clear, blocks: [dx, dy, dz, id][], people: [{ kind, dx, dy, dz, trader? }] }.
 */
export function cityDesign(roll, ruined = false) {
  const cells = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  const put = (x, y, z, id) => cells.set(key(x, y, z), id);
  const h = (a, b, c = 0) => hash01(a * 31 + Math.floor(roll * 9973), b * 17 + c * 7, 8101);
  const people = [];

  // --- the ground: streets, the plaza, and the rest left as it is ---
  for (let x = -WALL; x <= WALL; x++) {
    for (let z = -WALL; z <= WALL; z++) {
      const street = Math.abs(x) <= 1 || Math.abs(z) <= 1;
      const plaza = Math.abs(x) <= 5 && Math.abs(z) <= 5;
      const lane = Math.abs(x) >= WALL - 3 || Math.abs(z) >= WALL - 3; // the way round inside the wall
      if (!street && !plaza && !lane) continue;
      let id = plaza ? ((Math.abs(x) + Math.abs(z)) % 4 === 0 ? CALCADA_WAVE : CALCADA) : street ? CALCADA : COBBLE;
      if (plaza && Math.max(Math.abs(x), Math.abs(z)) === 5) id = CALCADA_DARK;
      if (ruined) {
        const r = h(x, z);
        id = r < 0.3 ? MOSS : r < 0.45 ? GRAVEL : r < 0.5 ? AIR : id;
      }
      if (id) put(x, -1, z, id);
    }
  }

  // --- the wall, its towers and its gates ---
  for (let x = -WALL; x <= WALL; x++) {
    for (let z = -WALL; z <= WALL; z++) {
      if (Math.max(Math.abs(x), Math.abs(z)) !== WALL) continue;
      const gate = Math.abs(x) <= 1 && Math.abs(z) === WALL;
      // A ruin's wall is stumps, some of it gone to the ground.
      const tall = ruined ? Math.floor(h(x + 50, z) * 5) - 1 : 5;
      for (let y = 0; y < tall; y++) {
        if (gate && y <= 2) continue;
        put(x, y, z, y === 0 ? COBBLE : STONE_BRICK);
      }
      // Merlons along the top, every other block.
      if (!ruined && (x + z) % 2 === 0) put(x, 5, z, STONE_BRICK_WALL);
    }
  }
  // Corner towers, three by three, with a lantern and a banner on top.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = sx * WALL, cz = sz * WALL;
    const tall = ruined ? 3 + Math.floor(h(sx + 9, sz) * 3) : 8;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (let y = 0; y < tall; y++) put(cx + dx, y, cz + dz, y === 0 ? COBBLE : STONE_BRICK);
      if (!ruined && (dx || dz) && (dx + dz) % 2 === 0) put(cx + dx, tall, cz + dz, STONE_BRICK_WALL);
    }
    if (!ruined) { put(cx, tall, cz, LANTERN); put(cx, tall + 1, cz, WHITE_BANNER); }
  }
  // An arch over each gate, and lanterns either side of it.
  for (const sz of [-1, 1]) {
    if (ruined) continue;
    for (let dx = -2; dx <= 2; dx++) put(dx, 3, sz * WALL, STONE_BRICK);
    put(-2, 2, sz * (WALL - 1), LANTERN);
    put(2, 2, sz * (WALL - 1), LANTERN);
    // Two guards at each gate, just inside.
    people.push({ kind: 'city_guard', dx: -2.5, dy: 0, dz: sz * (WALL - 2) + 0.5 });
    people.push({ kind: 'city_guard', dx: 3.5, dy: 0, dz: sz * (WALL - 2) + 0.5 });
  }

  // --- the plaza: a statue, and market stalls ---
  for (let y = 0; y < 4; y++) put(0, y, 0, y === 0 ? MARBLE : STONE_PILLAR);
  put(0, 4, 0, ruined ? AIR : GOLD_TRIM);
  for (const [x, z] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(x, 0, z, MARBLE);
  if (ruined) put(1, 0, 1, STONE_PILLAR), put(2, 0, 1, STONE_PILLAR); // the top half, fallen
  const stalls = [[-4, -4, 'merchant', RED_RUG], [4, 4, 'provisioner', BLUE_RUG]];
  for (const [sx, sz, trader, rug] of stalls) {
    // Four posts, a plank roof, a rug to stand on and a table for a counter.
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const posts = ruined && h(sx + px, sz + pz) < 0.5 ? 1 : 2;
      for (let y = 0; y < posts; y++) put(sx + px, y, sz + pz, FENCE);
    }
    if (!ruined) {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(sx + dx, 2, sz + dz, PLANK_SLAB);
      put(sx, 0, sz, rug);
      put(sx, 0, sz + Math.sign(-sz), OAK_TABLE);
      people.push({ kind: 'merchant', trader, dx: sx + 0.5, dy: 0, dz: sz + 0.5 });
    }
  }
  // Lanterns on posts round the plaza.
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
    if (ruined && h(x, z, 3) < 0.6) continue;
    put(x, 0, z, FENCE); put(x, 1, z, FENCE);
    if (!ruined) put(x, 2, z, LANTERN);
  }

  // --- the houses, three to a quarter ---
  let n = 0;
  const chestsAt = [];
  for (const [qx, qz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    for (const [px, pz] of PLOTS) {
      const i = n++;
      const r = h(i, 77);
      const wall = [PLANKS, BRICK, STONE, PLANKS][Math.floor(r * 4)];
      const house = room({
        w: 5, h: r < 0.5 ? 2 : 3, wall, floor: PLANKS, tiles: r < 0.6 ? TILE : SLATE,
        shape: h(i, 78) < 0.7 ? 'gable' : 'hip', chimney: h(i, 79) < 0.5 ? { h: 2 } : null, shutters: true, hood: true,
      });
      // Its corner: mirrored into each quarter, but never turned — every
      // door faces north (-z), onto a street or a lane.
      const x0 = qx > 0 ? px : -px - 6, z0 = qz > 0 ? pz : -pz - 6;
      const top = Math.max(...house.map((b) => b.dy));
      for (const b of house) {
        // A ruin: roofs caved in, walls broken down in places.
        if (ruined && (b.dy >= top - 1 || roofPart(b.type)) && h(i, b.dx * 7 + b.dy, b.dz) < 0.75) continue;
        if (ruined && b.dy >= 2 && h(i + 9, b.dx * 3 + b.dy, b.dz) < 0.3) continue;
        put(x0 + b.dx, b.dy, z0 + b.dz, b.type);
      }
      // Inside (walls at 1..5, so 2..4 within): a table and a chair, a light,
      // a chest in some, and in a ruin, leaves grown in through the roof.
      const ix = x0 + 2, iz = z0 + 2;
      if (!ruined) {
        put(ix + 2, 1, iz + 2, LANTERN);
        put(ix, 1, iz + 2, OAK_TABLE);
        put(ix + 1, 1, iz + 2, OAK_CHAIR);
      } else {
        put(ix + 1, 1, iz + 1, h(i, 80) < 0.5 ? LEAVES : MOSS);
      }
      if (ruined ? h(i, 81) < 0.6 : i % 3 === 0) {
        put(ix, 1, iz, CHEST);
        chestsAt.push([ix, 1, iz]);
      }
    }
  }

  // --- the people of a living city, in its streets ---
  if (!ruined) {
    for (const d of [-16, -9, 9, 16]) {
      people.push({ kind: 'citizen', dx: 0.5, dy: 0, dz: d + 0.5 });
      people.push({ kind: 'citizen', dx: d + 0.5, dy: 0, dz: 0.5 });
    }
    people.push({ kind: 'citizen', dx: -2.5, dy: 0, dz: 3.5 });
    people.push({ kind: 'citizen', dx: 3.5, dy: 0, dz: -2.5 });
  }

  const blocks = [];
  for (const [k, id] of cells) {
    const [x, y, z] = k.split(',').map(Number);
    blocks.push([x, y, z, id]);
  }
  return { half: CITY_HALF, clear: 14, blocks, people, chests: chestsAt.length };
}
