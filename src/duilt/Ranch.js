import { MOBS_BY_ID } from '../config/mobs.js';

/**
 * Keeping animals: which ones are yours, and what a pen gives back for them.
 *
 * A farm animal becomes yours by being inside a claimed pen — led in with
 * food in your hand (see Mobs.think), or already standing there when you
 * claim it. From then on it's in DuiltGame.herd, saved with the world, and
 * never wanders off the map the way wild ones are forgotten.
 *
 * A pen's output is its animals, not its blocks: per cycle, each kind of
 * animal in it gives its own thing, one per animal up to PER_KIND — so a
 * pen tops out at a dozen of anything a day, the same ceiling every other
 * building keeps to (see structures.js), however many you cram in.
 */

/** What each kind of animal gives, kept in a pen. */
export const PEN_YIELD = { chicken: 'egg', sheep: 'wool', cow: 'milk', pig: 'raw_meat' };
const PER_KIND = 2;

/** Whether a point is inside a claimed region (block coordinates, inclusive). */
export function inside(region, x, y, z) {
  return x >= region.minX && x < region.maxX + 1
    && z >= region.minZ && z < region.maxZ + 1
    && y >= region.minY - 1 && y <= region.maxY + 1;
}

/** The herd animals belonging to a pen that are actually inside it right now. */
export function penAnimals(pen, herd) {
  return herd.filter((m) => m.penId === pen.id && !m.dying && !m.dead && inside(pen.region, m.x, m.y, m.z));
}

/** One cycle's output for a pen, from whatever is standing in it. */
export function penProduce(pen, herd) {
  const byKind = {};
  for (const m of penAnimals(pen, herd)) byKind[m.type] = (byKind[m.type] ?? 0) + 1;
  const out = {};
  for (const [kind, n] of Object.entries(byKind)) {
    const item = PEN_YIELD[kind];
    if (item) out[item] = (out[item] ?? 0) + Math.min(PER_KIND, n);
  }
  return out;
}

/**
 * Takes in any wild farm animal standing inside one of these pens. Returns
 * the ones that just became yours, so the caller can say so.
 */
export function tameInto(pens, animals, herd) {
  const taken = [];
  for (const m of animals) {
    if (m.penId || m.dying || m.dead || !MOBS_BY_ID.get(m.type)?.farm) continue;
    const pen = pens.find((p) => inside(p.region, m.x, m.y, m.z));
    if (!pen) continue;
    m.penId = pen.id;
    herd.push(m);
    taken.push(m);
  }
  return taken;
}

/** A herd as it's written into a save: where each one is, and whose it is. */
export function herdToJSON(herd) {
  return herd
    .filter((m) => !m.dying && !m.dead)
    .map((m) => ({ type: m.type, x: round(m.x), y: round(m.y), z: round(m.z), penId: m.penId, facing: round(m.facing ?? 0) }));
}

function round(v) {
  return Math.round(v * 100) / 100;
}
