import { hash01 } from './ChunkGen.js';
import { BIOMES } from '../config/biomes.js';
import { kingdomFor } from './kingdom.js';
import { turned } from '../config/blocks.js';
import { cityDesign, CITY_HALF, outpostDesign } from './cities.js';
import { cityName } from './Passengers.js';

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
      STONE = 3, WOOD = 4, LEAVES = 5, SAND = 6, MARBLE = 17, GOLD = 13, MOSS = 22, GRAVEL = 23, STONE_SLAB = 27,
      IRON_ORE = 38, COPPER_ORE = 39, GOLD_ORE = 40, DARK_MOSS = 46,
      DARK_STONE = 156, DARK_BRICK = 157, SKY_MARBLE = 158, GOLD_TRIM = 159,
      COBBLE_WALL = 161, STONE_PILLAR = 165, MARBLE_PILLAR = 166, DARK_PILLAR = 167,
      PLANK_STAIRS = 30, GREEN_RUG = 37, DARK_LEAVES = 44, FIREFLY_LANTERN = 190;

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

  // The tree tribes (backlog batch 2, "More places in the wild"): up in the
  // tallest trees — a Giant Grove if there's one near, a forest if not.
  for (let i = 0; i < TRIBES; i++) {
    const a = hash01(seed, 400 + i, 7501) * Math.PI * 2;
    const r = TRIBE_AT[0] + hash01(seed, 410 + i, 7502) * (TRIBE_AT[1] - TRIBE_AT[0]);
    const site = groveNear(gen, Math.cos(a) * r, Math.sin(a) * r, TRIBE.half, out);
    if (site) out.push({ kind: 'tribe', ...site, half: TRIBE.half, clear: TRIBE.clear, blocks: TRIBE.blocks, perches: TRIBE.perches });
  }

  // Cities (world/cities.js): two with people living in them, two long
  // abandoned — further out still, for after the war.
  CITIES.forEach((ruined, i) => {
    const a = hash01(seed, 500 + i, 7701) * Math.PI * 2;
    const r = CITY_AT[0] + hash01(seed, 510 + i, 7702) * (CITY_AT[1] - CITY_AT[0]);
    const site = siteNear(gen, Math.cos(a) * r, Math.sin(a) * r, CITY_HALF, out);
    if (!site) return;
    const d = cityDesign(hash01(seed, 520 + i, 7703), ruined);
    out.push({ kind: ruined ? 'ruined_city' : 'city', ...site, half: d.half, clear: d.clear, blocks: d.blocks, people: d.people, name: cityName(site.x, site.z) });
  });

  // Stone Kingdom outposts (backlog batch 2): rare, far out, with the
  // Kingdom's guards and an armoury worth the fight.
  for (let i = 0; i < OUTPOSTS; i++) {
    const a = hash01(seed, 600 + i, 7801) * Math.PI * 2;
    const r = OUTPOST_AT[0] + hash01(seed, 610 + i, 7802) * (OUTPOST_AT[1] - OUTPOST_AT[0]);
    const d = outpostDesign(hash01(seed, 620 + i, 7803));
    const site = siteNear(gen, Math.cos(a) * r, Math.sin(a) * r, d.half, out);
    if (site) out.push({ kind: 'outpost', ...site, half: d.half, clear: d.clear, blocks: d.blocks, people: d.people });
  }

  // Two new peoples live beyond the old frontier. Their camps are seeded
  // like the existing places, so they arrive as the player explores farther
  // out and remain stable across chunks and saves.
  for (const [i, people] of RAID_PEOPLES.entries()) {
    for (let n = 0; n < 2; n++) {
      const salt = 8200 + i * 100 + n * 10;
      const a = hash01(seed, salt, 8101) * Math.PI * 2;
      const r = 1100 + hash01(seed, salt + 1, 8102) * 800;
      const d = people.design(hash01(seed, salt + 2, 8103));
      const site = siteNear(gen, Math.cos(a) * r, Math.sin(a) * r, d.half, out, 240);
      if (site) out.push({ kind: people.kind, ...site, half: d.half, clear: d.clear, blocks: d.blocks, people: d.people });
    }
  }

  gen.landmarkCache = out;
  return out;
}

/** How many Stone Kingdom outposts, and how far out. */
const OUTPOSTS = 2;
const OUTPOST_AT = [600, 1150];

/** Which cities a world has: false lives, true lies in ruins. */
const CITIES = [false, false, true, true];
const CITY_AT = [480, 1050];

/** How many tree tribes, and how far out — past the old border, for after the war. */
const TRIBES = 3;
const TRIBE_AT = [380, 950];
/** The country a tribe would choose, best first. */
const GROVES = ['giantGrove', 'forestOak', 'forestDark', 'forestBirch'];

/**
 * A level spot for a tribe near (x, z), in the best woods within reach: a
 * Giant Grove's tallest trees if there's one, then the forests, then
 * anywhere settled at all.
 */
function groveNear(gen, x, z, half, taken) {
  for (const want of GROVES) {
    for (let r = 0; r <= 240; r += 24) {
      const steps = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 24);
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const sx = Math.round(x + Math.cos(a) * r), sz = Math.round(z + Math.sin(a) * r);
        if (BIOMES[gen.biomeIndexAt(sx, sz)]?.id !== want) continue;
        if (taken.some((t) => Math.max(Math.abs(t.x - sx), Math.abs(t.z - sz)) < t.half + half + 6)) continue;
        const y = levelAt(gen, sx, sz, half);
        if (y != null) return { x: sx, z: sz, y };
      }
    }
  }
  return siteNear(gen, x, z, half, taken);
}

/** What each kind of place is called, found. */
export const PLACE_NAMES = {
  kingdom: 'The Stone Kingdom', hermit: 'The hermit\'s hut', camp: 'A bandit camp',
  ruin: 'An old ruin', ruined_temple: 'A forgotten temple', mine: 'An abandoned mine', monument: 'A monument',
  tribe: 'A tree tribe', city: 'A city', ruined_city: 'An abandoned city', outpost: 'A Stone Kingdom outpost',
  caravan: 'A dune caravan', mossfolk: 'A mossfolk village',
};

/**
 * The nearest dry, level spot to (x, z), searched outwards in rings: its
 * middle and the height its floor sits at, or null if there's nowhere
 * within reach (all sea, say).
 */
export function siteNear(gen, x, z, half, taken = [], reach = 160) {
  const cx = Math.round(x), cz = Math.round(z);
  for (let r = 0; r <= reach; r += 8) {
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
        for (let y = lm.y; y < lm.y + (lm.clear ?? CLEAR); y++) put(x, y, z, 0);
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

// ---- the tree tribes --------------------------------------------------------------

/**
 * A tree tribe's village (backlog batch 2): "mystical tree houses full of
 * vibrant greens, with wooden bridges between trees; huts inside the leaves,
 * and watchtowers on top of the canopy with stairs around them."
 *
 * Five giant trees, grown with the village rather than found, so it's always
 * the same shape: a great tree in the middle, four round it. Twelve up, a
 * deck rings the great tree and railed bridges run out from it to a deck
 * round each of the others, where a hut of planks sits in under the leaves.
 * A stair winds round the great tree from the ground, past the deck, up
 * through its crown to a watchtower on top.
 *
 * `perches` are where the tribe stand — every one of them on a deck, the
 * tower or a bridge, never on the ground (they never come down).
 */
const TRIBE = (() => {
  const DECK = 12;                 // the decks' floor, above the ground
  const TOWER = 27;                // the watchtower's floor, on the great tree's top
  const cells = new Map();         // "x,y,z" -> block, the last word wins
  const key = (x, y, z) => `${x},${y},${z}`;
  const set = (x, y, z, id) => cells.set(key(x, y, z), id);
  const has = (x, y, z) => cells.has(key(x, y, z));
  const reserved = new Set();      // kept clear of leaves: stairs, headroom, decks
  const keep = (x, y, z) => reserved.add(key(x, y, z));

  const trees = [
    { x: 0, z: 0, tall: TOWER, crown: 6 },
    { x: -10, z: -8, tall: 21, crown: 5 },
    { x: 10, z: -7, tall: 22, crown: 5 },
    { x: -9, z: 10, tall: 20, crown: 5 },
    { x: 9, z: 9, tall: 21, crown: 5 },
  ];
  // Two-by-two trunks: (x..x+1, z..z+1).
  const trunk = (t, x, z) => x >= t.x && x <= t.x + 1 && z >= t.z && z <= t.z + 1;
  const ring = (t, d, x, z) => Math.max(Math.max(t.x - x, x - (t.x + 1)), Math.max(t.z - z, z - (t.z + 1))) === d;
  const within = (t, d, x, z) => Math.max(Math.max(t.x - x, x - (t.x + 1)), Math.max(t.z - z, z - (t.z + 1))) <= d;

  // --- the stair round the great tree, ground to crown ---
  const great = trees[0];
  const around = [[0, -1], [1, -1], [2, -1], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [-1, 2], [-1, 1], [-1, 0], [-1, -1]];
  const steps = [];
  for (let k = 0; k <= TOWER; k++) {
    const [x, z] = around[k % around.length];
    const [nx, nz] = around[(k + 1) % around.length];
    // Facing the way up: 0 north (-z), 1 east, 2 south, 3 west.
    const facing = nx > x ? 1 : nx < x ? 3 : nz > z ? 2 : 0;
    steps.push({ x, z, y: k, facing });
  }
  // The last step is in the tower's floor; the two below it come up
  // through a hole in it.
  const opening = new Set(steps.slice(TOWER - 2).map((st) => `${st.x},${st.z}`));
  for (const st of steps) {
    keep(st.x, st.y, st.z); keep(st.x, st.y + 1, st.z); keep(st.x, st.y + 2, st.z);
  }

  // --- decks ---
  const floor = new Set();         // "x,z" of deck and bridge floor at DECK
  const deck = (x, z) => floor.add(`${x},${z}`);
  // The great tree's: a ring two to four out, the stair's ring left open.
  for (let x = great.x - 4; x <= great.x + 5; x++) for (let z = great.z - 4; z <= great.z + 5; z++) {
    if (!within(great, 1, x, z)) deck(x, z);
  }
  // Each of the others: three out all round.
  for (const t of trees.slice(1)) {
    for (let x = t.x - 3; x <= t.x + 4; x++) for (let z = t.z - 3; z <= t.z + 4; z++) if (!trunk(t, x, z)) deck(x, z);
  }
  // Bridges from the great deck to each: two wide, stepping one way then the
  // other, so every plank meets the next along an edge.
  for (const t of trees.slice(1)) {
    let x = Math.sign(t.x) * 5 + (t.x > 0 ? 0 : 1), z = Math.sign(t.z) * 5 + (t.z > 0 ? 0 : 1);
    const tx = t.x + (t.x > 0 ? -3 : 4), tz = t.z + (t.z > 0 ? -3 : 4);
    let i = 0;
    while ((x !== tx || z !== tz) && i++ < 40) {
      deck(x, z); deck(x + 1, z); deck(x, z + 1);
      if (Math.abs(tx - x) >= Math.abs(tz - z)) x += Math.sign(tx - x); else z += Math.sign(tz - z);
    }
    deck(x, z);
  }
  for (const c of floor) {
    const [x, z] = c.split(',').map(Number);
    set(x, DECK, z, PLANKS);
    for (let y = DECK; y <= DECK + 3; y++) keep(x, y, z);
  }
  // A rail round every edge — where the floor stops, a fence — except over
  // the stair's own ring, which is the way up.
  for (const c of floor) {
    const [x, z] = c.split(',').map(Number);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ax = x + dx, az = z + dz;
      if (floor.has(`${ax},${az}`) || trees.some((t) => trunk(t, ax, az)) || within(great, 1, ax, az)) continue;
      set(ax, DECK + 1, az, FENCE);
      keep(ax, DECK + 1, az);
    }
  }

  // --- the huts, in under the leaves of the four ---
  const perches = [];
  trees.slice(1).forEach((t, i) => {
    // Walls two out from the trunk, three high, a door facing the great tree.
    const doorX = t.x > 0 ? t.x - 2 : t.x + 3, doorZ = t.z > 0 ? t.z - 2 : t.z + 3;
    for (let x = t.x - 2; x <= t.x + 3; x++) for (let z = t.z - 2; z <= t.z + 3; z++) {
      if (!ring(t, 2, x, z)) continue;
      const door = (x === doorX && z === (t.z > 0 ? t.z : t.z + 1)) || (z === doorZ && x === (t.x > 0 ? t.x : t.x + 1));
      for (let dy = 1; dy <= 3; dy++) if (!(door && dy <= 2)) set(x, DECK + dy, z, i % 2 ? DARK_WOOD : PLANKS);
    }
    // A roof of leaves, and the canopy above it.
    for (let x = t.x - 3; x <= t.x + 4; x++) for (let z = t.z - 3; z <= t.z + 4; z++) {
      if (!trunk(t, x, z)) set(x, DECK + 4, z, LEAVES);
    }
    // Inside: moss underfoot, a green rug, a firefly lantern, and on two of
    // the four the tribe's chest.
    for (let x = t.x - 1; x <= t.x + 2; x++) for (let z = t.z - 1; z <= t.z + 2; z++) {
      if (!trunk(t, x, z)) set(x, DECK, z, (x + z) & 1 ? MOSS : PLANKS);
    }
    set(t.x - 1, DECK + 1, t.z - 1, FIREFLY_LANTERN);
    set(t.x + 2, DECK + 1, t.z + 2, GREEN_RUG);
    if (i % 2 === 0) set(t.x + 2, DECK + 1, t.z - 1, CHEST + 2);
    // One of the tribe on the walk round each hut, outside its door.
    perches.push({ dx: (t.x > 0 ? t.x - 3 : t.x + 4) + 0.5, dy: DECK + 1, dz: (t.z > 0 ? t.z - 3 : t.z + 4) + 0.5 });
  });
  // Two on the great deck.
  perches.push({ dx: great.x - 3 + 0.5, dy: DECK + 1, dz: great.z + 4 + 0.5 });
  perches.push({ dx: great.x + 4 + 0.5, dy: DECK + 1, dz: great.z - 3 + 0.5 });
  // Firefly lanterns on the great deck's rail, midway along each side —
  // the corners are where the bridges go.
  for (const [x, z] of [[-5, 0], [6, 1], [1, -5], [0, 6]]) set(great.x + x, DECK + 2, great.z + z, FIREFLY_LANTERN);

  // --- the watchtower, on top of the great tree's crown ---
  for (let x = great.x - 2; x <= great.x + 3; x++) for (let z = great.z - 2; z <= great.z + 3; z++) {
    const hole = opening.has(`${x - great.x},${z - great.z}`);
    if (!hole) set(x, TOWER, z, PLANKS);
    for (let y = TOWER; y <= TOWER + 4; y++) keep(x, y, z);
    const edge = x === great.x - 2 || x === great.x + 3 || z === great.z - 2 || z === great.z + 3;
    if (edge && !hole && !within(great, 1, x, z)) set(x, TOWER + 1, z, FENCE);
  }
  for (const [x, z] of [[-2, -2], [3, -2], [-2, 3], [3, 3]]) {
    for (let y = TOWER + 1; y <= TOWER + 3; y++) set(great.x + x, y, great.z + z, WOOD);
  }
  for (let x = great.x - 2; x <= great.x + 3; x++) for (let z = great.z - 2; z <= great.z + 3; z++) set(x, TOWER + 4, z, SLAB_PLANK);
  set(great.x, TOWER + 3, great.z, FIREFLY_LANTERN);
  perches.push({ dx: great.x + 2 + 0.5, dy: TOWER + 1, dz: great.z + 2 + 0.5 });

  // --- the trees themselves ---
  for (const t of trees) {
    for (let y = 0; y < t.tall; y++) for (let x = t.x; x <= t.x + 1; x++) for (let z = t.z; z <= t.z + 1; z++) {
      set(x, y, z, WOOD);
    }
    // A crown of leaves, wide and a little flattened; dark leaves through it
    // and moss, for the greens.
    const cy = t.tall - 3;
    for (let x = t.x - t.crown; x <= t.x + 1 + t.crown; x++) {
      for (let z = t.z - t.crown; z <= t.z + 1 + t.crown; z++) {
        for (let y = cy - 4; y < t.tall; y++) {
          const fx = (x - (t.x + 0.5)) / (t.crown + 0.5), fz = (z - (t.z + 0.5)) / (t.crown + 0.5), fy = (y - cy) / 4.2;
          if (fx * fx + fy * fy + fz * fz > 1) continue;
          if (has(x, y, z) || reserved.has(key(x, y, z))) continue;
          if (y <= DECK + 4) continue;
          const roll = hash01(x * 31 + y, z * 17 - y, 7601);
          set(x, y, z, roll < 0.12 ? DARK_LEAVES : roll < 0.16 ? MOSS : LEAVES);
        }
      }
    }
  }
  // The stair, last, over anything — and the air over each step, all the
  // way up through the crown.
  for (const st of steps) {
    set(great.x + st.x, st.y, great.z + st.z, turned(PLANK_STAIRS, st.facing));
  }
  for (const st of steps) {
    for (const dy of [1, 2]) {
      const k2 = key(great.x + st.x, st.y + dy, great.z + st.z);
      if (!steps.some((o) => o.x === st.x && o.z === st.z && o.y === st.y + dy)) cells.delete(k2);
    }
  }

  const blocks = [];
  for (const [k, id] of cells) {
    const [x, y, z] = k.split(',').map(Number);
    blocks.push([x, y, z, id]);
  }
  return { half: 16, clear: TOWER + 8, blocks, perches };
})();

/** A far-travelling desert caravan: three canvas tents around a shared fire. */
function caravanDesign(roll) {
  const blocks = [];
  for (let dx = -8; dx <= 8; dx++) for (let dz = -4; dz <= 5; dz++) {
    blocks.push([dx, -1, dz, (dx + dz + Math.floor(roll * 7)) & 1 ? SAND : GRAVEL]);
  }
  blocks.push([0, 0, 0, LANTERN]);
  for (const [cx, cz, chest] of [[-5, -1, true], [5, -1, false], [0, 3, false]]) {
    const cloth = hash01(cx, cz, Math.floor(roll * 10000)) < 0.5 ? RED_RUG : GREEN_RUG;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -1; dz <= 1; dz++) {
      const edge = Math.abs(dx) === 2 || Math.abs(dz) === 1;
      if (edge) {
        blocks.push([cx + dx, 0, cz + dz, DARK_WOOD]);
        if (!(dz === 1 && dx === 0)) blocks.push([cx + dx, 1, cz + dz, DARK_WOOD]);
      } else blocks.push([cx + dx, 0, cz + dz, cloth]);
      blocks.push([cx + dx, 2, cz + dz, dx === 0 ? PLANKS : SLAB_PLANK]);
    }
    if (chest) blocks.push([cx, 0, cz - 1, CHEST + 2]);
  }
  return {
    half: 9, clear: 5, blocks,
    people: [
      { kind: 'caravan_guard', dx: -1.5, dy: 0, dz: 0.5 },
      { kind: 'caravan_guard', dx: 1.5, dy: 0, dz: 0.5 },
      { kind: 'caravaner', dx: 0.5, dy: 0, dz: 2.5 },
      { kind: 'caravaner', dx: -5.5, dy: 0, dz: 0.5 },
    ],
  };
}

/** A village grown into the forest: four leaf-roofed huts around a lantern tree. */
function mossfolkDesign() {
  const blocks = [];
  for (const [cx, cz] of [[-5, -4], [5, -4], [-5, 5], [5, 5]]) {
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      blocks.push([cx + dx, -1, cz + dz, (dx + dz) & 1 ? MOSS : PLANKS]);
      if (Math.abs(dx) === 2 || Math.abs(dz) === 2) {
        blocks.push([cx + dx, 1, cz + dz, dx & 1 ? DARK_WOOD : PLANKS]);
        blocks.push([cx + dx, 2, cz + dz, dx & 1 ? DARK_WOOD : PLANKS]);
      }
      blocks.push([cx + dx, 3, cz + dz, LEAVES]);
    }
    blocks.push([cx, 0, cz, GREEN_RUG], [cx + 1, 0, cz + 1, FIREFLY_LANTERN]);
  }
  blocks.push([0, -1, 0, MOSS], [0, 0, 0, WOOD], [0, 1, 0, WOOD], [0, 2, 0, LEAVES], [0, 3, 0, FIREFLY_LANTERN]);
  blocks.push([-5, 0, -4, CHEST + 2]);
  return {
    half: 9, clear: 6, blocks,
    people: [
      { kind: 'moss_guard', dx: -1.5, dy: 0, dz: -0.5 },
      { kind: 'moss_guard', dx: 1.5, dy: 0, dz: 0.5 },
      { kind: 'mossfolk', dx: -4.5, dy: 0, dz: 0.5 },
      { kind: 'mossfolk', dx: 4.5, dy: 0, dz: 0.5 },
    ],
  };
}

const RAID_PEOPLES = [
  { kind: 'caravan', design: caravanDesign },
  { kind: 'mossfolk', design: mossfolkDesign },
];

const PLACES = [
  { kind: 'ruin', count: 4, at: [300, 700], half: 6, build: ruinBlocks },
  { kind: 'ruined_temple', count: 2, at: [450, 950], half: 8, build: ruinedTempleBlocks },
  { kind: 'mine', count: 2, at: [300, 850], half: 9, build: mineBlocks },
  { kind: 'monument', count: 2, at: [380, 900], half: 5, build: monumentBlocks },
];

/**
 * One of every kind of place, as it would be built here — for the showcase
 * (world/showcase.js), which stands them in a row beside the buildings you
 * can put up yourself. The places' roll is fixed, so it's the same one of
 * each every time.
 */
export function landmarkDesigns() {
  return [
    { kind: 'hermit', half: HUT.half, blocks: HUT.blocks },
    { kind: 'camp', half: CAMP.half, blocks: CAMP.blocks },
    ...PLACES.map((p) => ({ kind: p.kind, half: p.half, blocks: p.build(0.5) })),
    { kind: 'tribe', half: TRIBE.half, blocks: TRIBE.blocks },
  ];
}
