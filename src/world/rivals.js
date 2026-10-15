import { cityDesign, CITY_HALF } from './cities.js';
import { siteNear } from './landmarks.js';
import { cityName } from './Passengers.js';
import { WAR_STANDARD } from '../config/blocks.js';

/**
 * Battle (backlog batch 4, E: "some kind of age of empires ... You start
 * alone with rival players spread about 5,000 blocks apart"). Asked for
 * directly: "Ok next battle mode", three rivals, "It's not a win situation,
 * you can conquer cities and weak them".
 *
 * Where the rivals' cities stand, and what they look like. Three of them,
 * RIVAL_AWAY out from home, a third of the way round the compass from each
 * other — the angle turned by the seed, so no two worlds have them in the
 * same places. Each is a walled city like the living ones (world/cities.js),
 * with its standard on a plinth in the plaza where the statue would be: the
 * thing you take to conquer it.
 *
 * Laid only in a Battle world: ChunkGen asks stampRivals, and it does
 * nothing unless `gen.battle` is set (Game sets it, as it sets gen.sky).
 * Pure in the seed and home otherwise; nothing about the places is saved.
 */

export const RIVALS = 3;
export const RIVAL_AWAY = 5000;

/** Each rival's colour: their soldiers' coats, and their mark on the map. */
export const RIVAL_COLOURS = [0xb8322c, 0x2f5fb0, 0x3f8a3a];
export const RIVAL_HEX = ['#b8322c', '#2f5fb0', '#3f8a3a'];

/** A small hash for the seed's own turn of the compass. */
function turn(seed) {
  let h = Math.imul(seed | 0, 0x27d4eb2d) ^ 0x51ed;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/**
 * The rivals' cities: [{ id, name, x, z, y, half, clear, blocks, people }],
 * worked out once per generator.
 */
export function rivalSites(gen) {
  if (gen.rivalCache) return gen.rivalCache;
  const hx = gen.biomes?.centreX ?? 0, hz = gen.biomes?.centreZ ?? 0;
  const a0 = turn(gen.seed) * Math.PI * 2;
  const design = rivalCityDesign();
  const out = [];
  for (let i = 0; i < RIVALS; i++) {
    const a = a0 + (i * Math.PI * 2) / RIVALS;
    const tx = hx + Math.cos(a) * RIVAL_AWAY, tz = hz + Math.sin(a) * RIVAL_AWAY;
    // Dry, level ground near there — and if the land is all hills and
    // water, right there anyway, the ground made up under it.
    const site = siteNear(gen, tx, tz, CITY_HALF, out, 400)
      ?? { x: Math.round(tx), z: Math.round(tz), y: Math.max(gen.heightAt(Math.round(tx), Math.round(tz)), 100) };
    out.push({ id: i, name: cityName(site.x, site.z), ...site, ...design, colour: RIVAL_COLOURS[i] });
  }
  gen.rivalCache = out;
  return out;
}

/**
 * A rival's city: the living city's plan, its statue swapped for the
 * standard — a plinth of marble with the standard on it at arm's height —
 * and its gate guards a garrison that fights (config/wanderers.js
 * `rival_guard`). No market: they don't trade with the enemy.
 */
export function rivalCityDesign() {
  const d = cityDesign(0.37, false);
  const blocks = d.blocks.filter(([x, y, z]) => !(x === 0 && z === 0 && y >= 1));
  blocks.push([0, 1, 0, WAR_STANDARD]);
  const people = d.people
    // Nobody idling in the plaza to stand between you and the standard.
    .filter((p) => p.kind !== 'merchant' && !(p.kind === 'citizen' && Math.abs(p.dx) < 6 && Math.abs(p.dz) < 6))
    .map((p) => (p.kind === 'city_guard' ? { ...p, kind: 'rival_guard' } : p));
  // More of the garrison round the plaza, by the standard.
  for (const [dx, dz] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-3, -3], [3, 3]]) {
    people.push({ kind: 'rival_guard', dx: dx + 0.5, dy: 0, dz: dz + 0.5, plaza: true });
  }
  return { half: d.half, clear: d.clear, blocks, people };
}

/** Where a rival's standard stands, in the world. */
export function standardAt(site) {
  return { x: site.x, y: site.y + 1, z: site.z };
}

/**
 * Lays the rivals' cities into a chunk, in a Battle world. The same way a
 * landmark is laid (world/landmarks.js stampLandmarks): the ground made up
 * to the city's floor, the air cleared over it, then the city.
 */
export function stampRivals(gen, chunk, size) {
  if (!gen.battle) return;
  const ox = chunk.cx * size, oz = chunk.cz * size;
  for (const s of rivalSites(gen)) {
    if (s.x + s.half < ox || s.x - s.half >= ox + size) continue;
    if (s.z + s.half < oz || s.z - s.half >= oz + size) continue;
    const put = (x, y, z, id) => {
      const lx = x - ox, lz = z - oz;
      if (lx < 0 || lz < 0 || lx >= size || lz >= size || y < 0 || y >= chunk.height) return;
      chunk.set(lx, y, lz, id);
    };
    for (let x = s.x - s.half; x <= s.x + s.half; x++) {
      for (let z = s.z - s.half; z <= s.z + s.half; z++) {
        const lx = x - ox, lz = z - oz;
        if (lx < 0 || lz < 0 || lx >= size || lz >= size) continue;
        const ground = gen.heightAt(x, z);
        for (let y = ground; y < s.y; y++) put(x, y, z, 2);
        put(x, s.y - 1, z, 1);
        for (let y = s.y; y < s.y + s.clear; y++) put(x, y, z, 0);
        chunk.surface[lz * size + lx] = s.y;
      }
    }
    for (const [dx, dy, dz, id] of s.blocks) put(s.x + dx, s.y + dy, s.z + dz, id);
  }
}
