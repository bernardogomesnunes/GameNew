import { hash01 } from './ChunkGen.js';
import { BIOMES } from '../config/biomes.js';

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
      FENCE = 47, DIRT = 2, FARMLAND = 21, CHEST = 148;

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

  const hermitAngle = hash01(seed, 11, 7001) * Math.PI * 2;
  const hermitR = HERMIT_AT[0] + hash01(seed, 12, 7002) * (HERMIT_AT[1] - HERMIT_AT[0]);
  const hut = siteNear(gen, Math.cos(hermitAngle) * hermitR, Math.sin(hermitAngle) * hermitR, HUT.half);
  if (hut) out.push({ kind: 'hermit', ...hut, half: HUT.half, blocks: HUT.blocks });

  for (let i = 0; i < CAMPS; i++) {
    // Spread round the compass, starting well away from the hermit.
    const a = hermitAngle + Math.PI * 0.5 + (i * Math.PI * 2) / CAMPS + (hash01(seed, 20 + i, 7003) - 0.5) * 0.8;
    const r = CAMP_AT[0] + hash01(seed, 30 + i, 7004) * (CAMP_AT[1] - CAMP_AT[0]);
    const camp = siteNear(gen, Math.cos(a) * r, Math.sin(a) * r, CAMP.half);
    if (camp) out.push({ kind: 'camp', ...camp, half: CAMP.half, blocks: CAMP.blocks });
  }

  gen.landmarkCache = out;
  return out;
}

/**
 * The nearest dry, level spot to (x, z), searched outwards in rings: its
 * middle and the height its floor sits at, or null if there's nowhere
 * within reach (all sea, say).
 */
function siteNear(gen, x, z, half) {
  const cx = Math.round(x), cz = Math.round(z);
  for (let r = 0; r <= 160; r += 8) {
    const steps = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 8);
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const sx = Math.round(cx + Math.cos(a) * r), sz = Math.round(cz + Math.sin(a) * r);
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
