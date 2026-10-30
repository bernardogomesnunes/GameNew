/**
 * What the game sounds like around you: a plain description of where you
 * are and when, for soundscape.js to turn into ambience and music.
 *
 * Kept out of Game.js so the game only has to call `hear(game, dt)` each
 * frame. Looking around costs a few hundred block reads, so it's done twice
 * a second, not every frame: a place doesn't change faster than that, and
 * the beds take a second and a half to fade anyway.
 */

import { BIOMES } from '../config/biomes.js';
import { BLOCKS_BY_ID, isLava, isLavaFlow } from '../config/blocks.js';
import { daylightAt } from '../render/DayCycle.js';
import { landmarksFor } from '../world/landmarks.js';
import { skyAt, FLOOR as SKY_FLOOR, ISLAND_R } from '../world/skyKingdom.js';

/** Seconds between looks around. */
export const LOOK_EVERY = 0.5;
/** How far round you to listen for water and lava (blocks), and how finely. */
const NEAR = 12, STRIDE = 3;
/** Water cells in earshot for a stream to be at full strength. */
const FULL_WATER = 14, FULL_LAVA = 4;
/** Blocks under the ground's surface before it sounds like a cave, and fully so. */
const CAVE_FROM = 5, CAVE_FULL = 14;
/** Archers further off than this aren't heard loosing. */
const BOW_RANGE = 32;

/**
 * Where you are, in numbers: { day, biome, water, lava, island, kingdom,
 * underground, darkPath, paused }. Safe on a world with no generator (the
 * old fixed-size worlds) — it just knows less.
 */
export function placeFor(game, { paused = false } = {}) {
  const world = game.world, p = game.player?.position;
  if (!world || !p) return null;
  const x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z);
  const loaded = (bx, bz) => !world.endless || world.hasChunk?.(bx >> 4, bz >> 4);

  let water = 0, lava = 0;
  for (let dx = -NEAR; dx <= NEAR; dx += STRIDE) {
    for (let dz = -NEAR; dz <= NEAR; dz += STRIDE) {
      if (!loaded(x + dx, z + dz)) continue;
      for (let dy = -6; dy <= 3; dy += 3) {
        const id = world.getBlock(x + dx, y + dy, z + dz);
        if (!id) continue;
        if (isLava(id) || isLavaFlow(id)) lava++;
        else if (BLOCKS_BY_ID.get(id)?.glyph === 'water') water++;
      }
    }
  }

  const gen = world.gen;
  let island = false, kingdom = 0;
  if (gen) {
    const sky = game.skyOpen?.() ? skyAt(gen) : null;
    island = !!sky && y >= SKY_FLOOR - 4 && Math.hypot(p.x - sky.x, p.z - sky.z) < ISLAND_R + 8;
    const stone = landmarksFor(gen).find((l) => l.kind === 'kingdom');
    if (stone) {
      const d = Math.max(Math.abs(p.x - stone.x), Math.abs(p.z - stone.z));
      kingdom = Math.max(0, Math.min(1, (stone.half + 16 - d) / 32));
    }
  }

  const ground = loaded(x, z) ? world.surfaceHeight(x, z) : y;
  const underground = island ? 0 : Math.max(0, Math.min(1, (ground - y - CAVE_FROM) / (CAVE_FULL - CAVE_FROM)));
  const d = game.duilt;
  return {
    day: daylightAt(game.dayCycle?.time ?? 0.3).day,
    biome: loaded(x, z) ? BIOMES[world.biomeIndex(x, z)]?.id ?? 'plains' : 'plains',
    water: Math.min(1, water / FULL_WATER),
    lava: Math.min(1, lava / FULL_LAVA),
    island,
    kingdom,
    underground,
    // The dark path: the Black Ring taken.
    darkPath: !!(d && !d.sandbox && d.ring === 'black'),
    paused,
  };
}

/**
 * Each frame: tells Sound where you are and what's around, and hears any
 * archer near you loose an arrow.
 */
export function hear(game, dt, playing) {
  const sound = game.sound, p = game.player;
  if (!sound?.ready || !p) return;
  sound.listen(p.position.x, p.position.z, p.yaw);
  game.hearingClock = (game.hearingClock ?? LOOK_EVERY) + dt;
  if (game.hearingClock >= LOOK_EVERY) {
    game.hearingClock = 0;
    game.heardPlace = placeFor(game, { paused: !playing });
  }
  if (game.heardPlace) game.heardPlace.paused = !playing;
  sound.tick(dt, game.heardPlace);

  // Arrows just loosed — anyone's, ours or theirs.
  const seen = (game.heardArrows ??= new WeakSet());
  for (const list of [game.wanderers?.arrows, game.duilt?.defenders?.arrows]) {
    for (const a of list ?? []) {
      if (seen.has(a)) continue;
      seen.add(a);
      if (Math.hypot(a.x - p.position.x, a.z - p.position.z) < BOW_RANGE) sound.bow({ x: a.x, z: a.z });
    }
  }
}
