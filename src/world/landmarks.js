import { hash01 } from './ChunkGen.js';
import { BIOMES } from '../config/biomes.js';
import { kingdomFor } from './kingdom.js';

/**
 * Places in the world that somebody else built: the hermit's hut, and the
 * bandits' camps.
 *
 * Nothing here is saved. Where they stand is decided from the seed alone —
 * a direction and a distance from the middle of the world, then the nearest
 * dry, level ground to that — and ChunkGen stamps their blocks as each chunk
 * that overlaps one is made, the same way a tree's canopy is written by
 * every chunk it reaches into. Ask for them twice and you get the same
 * places; a world made before they existed gets them too, out where nobody
 * has been yet.
 *
 * The people who live in them come from world/Wanderers.js.
 */

const DARK_WOOD = 43, PLANKS = 7, COBBLE = 8, LANTERN = 26, SLAB_PLANK = 28, RED_RUG = 35,
      FENCE = 47, DIRT = 2, FARMLAND = 21, CHEST = 148,
      STONE = 3, WOOD = 4, LEAVES = 5, MARBLE = 17, GOLD = 13, MOSS = 22, GRAVEL = 23, STONE_SLAB = 27,
      IRON_ORE = 38, COPPER_ORE = 39, GOLD_ORE = 40, DARK_MOSS = 46,
      DARK_STONE = 156, DARK_BRICK = 157, SKY_MARBLE = 158, GOLD_TRIM = 159,
      COBBLE_WALL = 161, STONE_PILLAR = 165, MARBLE_PILLAR = 166, DARK_PILLAR = 167;

/** How far out each kind stands, from the middle of the world. */
const HERMIT_AT = [320, 420];
const CAMPS = 3;
const CAMP_AT = [480, 720];

/** How much a site's ground may vary under its footprint... */
const LEVEL = 2;
/** ...and how much in the ring just round it, so it isn't sunk in a pocket of hills. */
const SURROUNDS = 5;
/** Country nobody pitches a camp or builds a hut in. */
const UNSETTLED = new Set(['mountains1', 'mountains2', 'ocean']);
/** How far above the floor a site clears the air (trees, overhangs). */
export const CLEAR = 7;

/**
 * Every landmark in this world, worked out once per generator and kept.
 * Each is { kind, x, z, y, half, blocks } — `x, z` its middle, `y` the
 * height its floor stands at, `half` how far its footprint reaches from the
 * middle, and `blocks` the [dx, dy, dz, id] it's made of.
 */
export function landmarksFor(gen) {
  if (gen.landmarkCache) return gen.landmarkCache;
  const seed = gen.seed;
  const out = [];
  // The Stone Kingdom first (Phase 7e, see kingdom.js): everything else
  // keeps clear of it. Its blocks are its own to lay — stampKingdom.
  const kingdom = kingdomFor(gen);
  if (kingdom) out.push(kingdom);

  const hermitAngle = hash01(seed, 11, 7001) * Math.PI * 2;
  const hermitR = HERMIT_AT[0] + hash01(seed, 12, 7002) * (HERMIT_AT[1] - HERMIT_AT[0]);
  const hut = siteNear(gen, Math.cos(hermitAngle) * hermitR, Math.sin(hermitAngle) * hermitR, HUT.half, out);
  if (hut) out.push({ kind: 'hermit', ...hut, half: HUT.half, blocks: HUT.blocks });

  for (let i = 0; i < CAMPS; i++) {
    // Spread round the compass, starting well away from the hermit.
    const a = hermitAngle + Math.PI * 0.5 + (i * Math.PI * 2) / CAMPS + (hash01(seed, 20 + i, 7003) - 0.5) * 0.8;
    const r = CAMP_AT[0] + hash01(seed, 30 + i, 7004) * (CAMP_AT[1] - CAMP_AT[0]);
    const camp = siteNear(gen, Math.cos(a) * r, Math.sin(a) * r, CAMP.half, out);
    if (camp) out.push({ kind: 'camp', ...camp, half: CAMP.half, blocks: CAMP.blocks });
  }

  // Places to find (playtest, P4): ruins, forgotten temples, abandoned
  // mines and monuments, each with a chest worth the walk — see
  // duilt/Loot.js for what's in them.
  PLACES.forEach((place, k) => {
    for (let i = 0; i < place.count; i++) {
      const a = hash01(seed, 100 + k * 10 + i, 7101) * Math.PI * 2;
      const r = place.at[0] + hash01(seed, 200 + k * 10 + i, 7102) * (place.at[1] - place.at[0]);
      const site = siteNear(gen, Math.cos(a) * r, Math.sin(a) * r, place.half, out);
      if (site) out.push({ kind: place.kind, ...site, half: place.half, blocks: place.build(hash01(seed, 300 + k * 10 + i, 7103)) });
    }
  });

  gen.landmarkCache = out;
  return out;
}

/** What each kind of place is called, found. */
export const PLACE_NAMES = {
  kingdom: 'The Stone Kingdom', hermit: 'The hermit\'s hut', camp: 'A bandit camp',
  ruin: 'An old ruin', ruined_temple: 'A forgotten temple', mine: 'An abandoned mine', monument: 'A monument',
};

/**
 * The nearest dry, level spot to (x, z), searched outwards in rings: its
 * middle and the height its floor sits at, or null if there's nowhere
 * within reach (all sea, say).
 */
function siteNear(gen, x, z, half, taken = []) {
  const cx = Math.round(x), cz = Math.round(z);
  for (let r = 0; r <= 160; r += 8) {
    const steps = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 8);
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const sx = Math.round(cx + Math.cos(a) * r), sz = Math.round(cz + Math.sin(a) * r);
      // Never on top of another place.
      if (taken.some((t) => Math.max(Math.abs(t.x - sx), Math.abs(t.z - sz)) < t.half + half + 6)) continue;
      const y = levelAt(gen, sx, sz, half);
      if (y != null) return { x: sx, z: sz, y };
    }
  }
  return null;
}

/**
 * The floor height for a footprint centred at (x, z), or null if it's wet,
 * rough, in the mountains, or sunk in a hollow with hills close round it.
 */
function levelAt(gen, x, z, half) {
  if (UNSETTLED.has(BIOMES[gen.biomeIndexAt(x, z)]?.id)) return null;
  let lo = Infinity, hi = -Infinity;
  for (let dx = -half; dx <= half; dx += half) {
    for (let dz = -half; dz <= half; dz += half) {
      if (gen.waterLevelAt(x + dx, z + dz)) return null;
      const h = gen.heightAt(x + dx, z + dz);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
  }
  if (hi - lo > LEVEL) return null;
  const y = gen.heightAt(x, z);
  const ring = half + 8;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const h = gen.heightAt(Math.round(x + Math.cos(a) * ring), Math.round(z + Math.sin(a) * ring));
    if (Math.abs(h - y) > SURROUNDS) return null;
  }
  return y;
}

/**
 * Writes whatever part of any landmark falls inside a chunk: levels the
 * ground under its footprint, clears the air above it, then puts down its
 * blocks. Called from ChunkGen.fill after the trees, so a hut clears any
 * tree that happened to grow where it stands.
 */
export function stampLandmarks(gen, chunk, chunkSize) {
  const ox = chunk.cx * chunkSize, oz = chunk.cz * chunkSize;
  for (const lm of landmarksFor(gen)) {
    if (lm.kind === 'kingdom') continue;
    if (lm.x + lm.half < ox || lm.x - lm.half >= ox + chunkSize) continue;
    if (lm.z + lm.half < oz || lm.z - lm.half >= oz + chunkSize) continue;
    const put = (x, y, z, id) => {
      const lx = x - ox, lz = z - oz;
      if (lx < 0 || lz < 0 || lx >= chunkSize || lz >= chunkSize || y < 0 || y >= chunk.height) return;
      chunk.set(lx, y, lz, id);
    };
    for (let x = lm.x - lm.half; x <= lm.x + lm.half; x++) {
      for (let z = lm.z - lm.half; z <= lm.z + lm.half; z++) {
        const lx = x - ox, lz = z - oz;
        if (lx < 0 || lz < 0 || lx >= chunkSize || lz >= chunkSize) continue;
        const ground = gen.heightAt(x, z);
        for (let y = ground; y < lm.y; y++) put(x, y, z, DIRT);
        for (let y = lm.y; y < lm.y + CLEAR; y++) put(x, y, z, 0);
        chunk.surface[lz * chunkSize + lx] = lm.y;
      }
    }
    for (const [dx, dy, dz, id] of lm.blocks) put(lm.x + dx, lm.y + dy, lm.z + dz, id);
  }
}

// ---- what they're made of -----------------------------------------------------

/**
 * The hermit's hut: a cobble room five across with a plank roof, a doorway
 * on its south side, a lantern inside, and a scrap of tilled garden by the
 * door behind a bit of fence.
 */
const HUT = (() => {
  const blocks = [];
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
      if (edge) {
        for (let dy = 0; dy < 3; dy++) {
          const door = dz === 2 && dx === 0 && dy < 2;
          if (!door) blocks.push([dx, dy, dz, dy === 2 ? DARK_WOOD : COBBLE]);
        }
      }
      blocks.push([dx, 3, dz, PLANKS]);
    }
  }
  blocks.push([0, 0, -1, LANTERN]);
  // A chest by the back wall — what's in it is rolled when it's first
  // opened (see duilt/Loot.js). Facing the door.
  blocks.push([1, 0, -1, CHEST + 2]);
  // garden, south-east of the door
  for (const [dx, dz] of [[2, 4], [3, 4], [2, 5], [3, 5]]) blocks.push([dx, -1, dz, FARMLAND]);
  for (const [dx, dz] of [[4, 3], [4, 4], [4, 5], [4, 6], [3, 6], [2, 6], [1, 6]]) blocks.push([dx, 0, dz, FENCE]);
  return { half: 6, blocks };
})();

/**
 * A bandit camp: a fire in a ring of stones with a lantern for its glow,
 * two lean-to tents of dark timber with a slab roof and a rug inside, and a
 * short run of fence along one side.
 */
const CAMP = (() => {
  const blocks = [];
  // the fire
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    if (dx || dz) blocks.push([dx, 0, dz, COBBLE]);
  }
  blocks.push([0, 0, 0, LANTERN]);
  // two tents, opening towards the fire
  const tent = (cx, cz, open) => {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const front = open === 'n' ? dz === -1 : dz === 1;
        const wall = Math.abs(dx) === 1 || !front && Math.abs(dz) === 1;
        if (wall && !(front && dx === 0)) {
          blocks.push([cx + dx, 0, cz + dz, DARK_WOOD]);
          blocks.push([cx + dx, 1, cz + dz, DARK_WOOD]);
        }
        if (!wall) blocks.push([cx + dx, 0, cz + dz, RED_RUG]);
        blocks.push([cx + dx, 2, cz + dz, SLAB_PLANK]);
      }
    }
  };
  tent(-4, -4, 's');
  tent(4, 4, 'n');
  // The bandits' takings, in the first tent, over its rug (see duilt/Loot.js).
  blocks.push([-4, 0, -4, CHEST + 2]);
  for (let dx = -5; dx <= 1; dx++) blocks.push([dx, 0, 6, FENCE]);
  return { half: 7, blocks };
})();

// ---- places to find (playtest, P4) --------------------------------------------
// Asked for directly: "We need structures. Random temples and ruins.
// Abandoned mines. And monuments. And all with a chest with goodies."
// Each `build(roll)` takes a number in 0..1 from the seed, so no two of a
// kind are quite the same.

/**
 * A ruin: what's left of a stone house — walls standing to different
 * heights with gaps knocked in them, moss over the floor, a fallen pillar,
 * and a chest in the corner under the rubble.
 */
function ruinBlocks(roll) {
  const blocks = [];
  const h = (a, b) => hash01(a * 7 + Math.floor(roll * 1000), b * 13, 7201);
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      const edge = Math.abs(dx) === 4 || Math.abs(dz) === 4;
      // The floor, half of it gone to moss and gravel.
      const f = h(dx, dz);
      blocks.push([dx, -1, dz, f < 0.35 ? MOSS : f < 0.5 ? GRAVEL : COBBLE]);
      if (!edge) continue;
      // Walls worn down to between nothing and three high.
      const tall = Math.floor(h(dx + 20, dz) * 4);
      for (let dy = 0; dy < tall; dy++) blocks.push([dx, dy, dz, h(dx, dy + 40) < 0.3 ? STONE : COBBLE]);
      if (tall && h(dx, dz + 60) < 0.25) blocks.push([dx, tall, dz, COBBLE_WALL]);
    }
  }
  // A pillar still standing at one corner, its fellow lying in the grass.
  for (let dy = 0; dy < 4; dy++) blocks.push([-3, dy, -3, STONE_PILLAR]);
  for (let dx = 1; dx <= 3; dx++) blocks.push([dx, 0, 2, STONE_PILLAR]);
  blocks.push([3, 0, -3, CHEST + 2]);
  blocks.push([2, 0, -3, COBBLE]);
  blocks.push([3, 1, -2, LEAVES]);
  return blocks;
}

/**
 * A forgotten temple: a raised floor of marble and dark stone, steps up to
 * it, a ring of pillars — some whole, some broken off — and an altar at the
 * far end with gold on it and a chest behind.
 */
function ruinedTempleBlocks(roll) {
  const blocks = [];
  const h = (a, b) => hash01(a * 11 + Math.floor(roll * 1000), b * 17, 7301);
  for (let dx = -5; dx <= 5; dx++) {
    for (let dz = -6; dz <= 6; dz++) {
      const ring = Math.max(Math.abs(dx), Math.abs(dz) - 1);
      blocks.push([dx, -1, dz, DARK_STONE]);
      if (ring <= 4) blocks.push([dx, 0, dz, (dx + dz) & 1 ? MARBLE : SKY_MARBLE]);
    }
  }
  // Steps up at the front.
  for (let dx = -1; dx <= 1; dx++) blocks.push([dx, 0, 6, STONE_SLAB]);
  // Pillars round the edge — whole, or broken at some height.
  for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 0], [4, 0], [-4, 4], [4, 4]]) {
    const tall = h(dx, dz) < 0.4 ? 5 : 1 + Math.floor(h(dz, dx) * 3);
    for (let dy = 1; dy <= tall; dy++) blocks.push([dx, dy, dz, MARBLE_PILLAR]);
    if (tall === 5) blocks.push([dx, 6, dz, DARK_BRICK]);
  }
  // A lintel that held, across the back pair.
  for (let dx = -4; dx <= 4; dx++) if (h(-4, -4) < 0.4 && h(4, -4) < 0.4) blocks.push([dx, 6, -4, DARK_BRICK]);
  // The altar.
  for (let dx = -1; dx <= 1; dx++) blocks.push([dx, 1, -3, DARK_BRICK]);
  blocks.push([0, 2, -3, GOLD_TRIM]);
  blocks.push([-1, 2, -3, LANTERN], [1, 2, -3, LANTERN]);
  blocks.push([0, 1, -4, CHEST + 2]);
  // A fallen pillar across the floor.
  for (let dz = 0; dz <= 2; dz++) blocks.push([2, 1, dz, DARK_PILLAR]);
  return blocks;
}

/**
 * An abandoned mine: a timber-framed mouth in the ground, and a tunnel
 * stepping down from it into the dark with props holding its roof every
 * few blocks, ore still in the walls, a lantern burning low, and the
 * miners' chest at the bottom.
 */
function mineBlocks(roll) {
  const blocks = [];
  const ores = [IRON_ORE, COPPER_ORE, IRON_ORE, GOLD_ORE];
  // The frame over the way in, at the surface.
  for (const dz of [-2, 2]) for (let dy = 0; dy < 3; dy++) blocks.push([-6, dy, dz, WOOD]);
  for (let dz = -2; dz <= 2; dz++) blocks.push([-6, 3, dz, PLANKS]);
  blocks.push([-6, 2, -2, LANTERN]);
  // Spoil heaped by the entrance.
  for (const [dx, dz] of [[-7, 3], [-8, 3], [-7, 4], [-8, -4]]) blocks.push([dx, 0, dz, GRAVEL]);
  // The tunnel: three wide, three high, a step down for each step east —
  // an open cut at first, then under the ground (y -1 and below).
  for (let i = 0; i <= 12; i++) {
    const dx = -6 + i, floor = -i;
    const prop = i % 3 === 1 && floor + 3 <= -1;
    for (let dz = -1; dz <= 1; dz++) {
      blocks.push([dx, floor - 1, dz, prop ? PLANKS : STONE]);
      for (let dy = 0; dy < 3; dy++) blocks.push([dx, floor + dy, dz, 0]);
      if (floor + 3 <= -1) blocks.push([dx, floor + 3, dz, prop ? PLANKS : STONE]);
    }
    // Walls of rock, with ore left in them — or a prop's posts.
    for (const dz of [-2, 2]) {
      for (let dy = 0; dy < 3; dy++) {
        if (floor + dy > -1) continue;
        const r = hash01(dx * 5 + dy, dz * 3 + Math.floor(roll * 999), 7401);
        blocks.push([dx, floor + dy, dz, prop ? WOOD : r < 0.18 ? ores[Math.floor(r * 22) % ores.length] : STONE]);
      }
    }
  }
  // The bottom: a little chamber, a lantern and the chest.
  const bx = 7, by = -12;
  for (let dx = bx - 1; dx <= bx + 1; dx++) for (let dz = -2; dz <= 2; dz++) {
    blocks.push([dx, by - 1, dz, STONE]);
    for (let dy = 0; dy < 3; dy++) blocks.push([dx, by + dy, dz, 0]);
    blocks.push([dx, by + 3, dz, STONE]);
  }
  blocks.push([bx + 1, by, -2, LANTERN]);
  blocks.push([bx + 1, by, 2, CHEST + 3]);
  return blocks;
}

/**
 * A monument: a stepped plinth with an obelisk of dark stone rising from
 * it, banded in gold and capped in gold, lanterns at its foot — and a chest
 * in a niche on its south face.
 */
function monumentBlocks(roll) {
  const blocks = [];
  const tall = 9 + Math.floor(roll * 5);
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    blocks.push([dx, -1, dz, STONE]);
    blocks.push([dx, 0, dz, Math.max(Math.abs(dx), Math.abs(dz)) === 3 ? STONE_SLAB : MARBLE]);
  }
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) blocks.push([dx, 1, dz, MARBLE]);
  for (let dy = 2; dy < 2 + tall; dy++) {
    const band = dy % 4 === 1;
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      if (dy <= 3 && dz === 1 && dx === 0) continue; // the niche
      blocks.push([dx, dy, dz, band ? GOLD_TRIM : DARK_STONE]);
    }
  }
  blocks.push([0, 2 + tall, 0, GOLD], [1, 2 + tall, 0, GOLD], [0, 2 + tall, 1, GOLD], [1, 2 + tall, 1, GOLD]);
  blocks.push([0, 3 + tall, 0, GOLD_TRIM]);
  blocks.push([0, 2, 1, CHEST + 2]);
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) blocks.push([dx, 2, dz, LANTERN]);
  // Wild growth creeping over one side of the plinth.
  for (const [dx, dz] of [[-3, 2], [-3, 3], [-2, 3]]) blocks.push([dx, 1, dz, DARK_MOSS]);
  return blocks;
}

const PLACES = [
  { kind: 'ruin', count: 4, at: [300, 700], half: 6, build: ruinBlocks },
  { kind: 'ruined_temple', count: 2, at: [450, 950], half: 8, build: ruinedTempleBlocks },
  { kind: 'mine', count: 2, at: [300, 850], half: 9, build: mineBlocks },
  { kind: 'monument', count: 2, at: [380, 900], half: 5, build: monumentBlocks },
];
