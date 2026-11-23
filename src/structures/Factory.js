import { RECIPES, RECIPES_BY_ID } from '../config/recipes.js';
import { STANDARD_LEVELS, FACTORY_STATIONS } from '../config/structures.js';

/**
 * PLAY-11: the Factory's lines (docs/design/play-11.md).
 *
 * A line is one machine kind standing inside a Factory, running one recipe
 * the player picks. Each run takes the recipe's inputs from the storehouses,
 * all or none, and delivers its output to the storehouses, then the bag.
 * A line makes at most LINE_CAP of its output a building day (the house rule
 * in config/structures.js), times its level's `mult`.
 *
 * Nothing here reads the world or the bag: `runLines` gets callbacks.
 */

/** Most a line makes of its output in one building day, at the first level. */
export const LINE_CAP = 12;
/** Lines that may run at the first level; one more per level. */
export const BASE_LINES = 6;
/** A real day: what a building day is written against (StructureRegistry). */
const DAY_MS = 86400 * 1000;

/** The machines' names for the panel. */
export const MACHINE_NAMES = {
  workbench: 'Workbench', planing_bench: 'Planing Bench', wood_mill: 'Wood Mill', joinery_bench: 'Joinery Bench',
  stone_mill: 'Stone Mill', masons_bench: "Mason's Bench", bleach_bucket: 'Wash Tub', forge: 'Forge',
  spinning_wheel: 'Spinning Wheel', tanning_vat: 'Tanning Vat', kiln_oven: 'Kiln Oven', crucible: 'Crucible', compost: 'Compost Bin',
};

/**
 * Whether a recipe is Factory work at all: it makes an item, needs no water,
 * no temple, no ring choice, no study, and makes no coins (coins would beat
 * the cap in one run; open question 4, left out).
 */
function factoryWork(r) {
  return !!r.output?.id && r.output.id !== 'coin' && !r.study && !r.ring && !r.needs && r.needsTemple == null
    && r.tier == null && r.station !== 'temple';
}

const BY_STATION = new Map(FACTORY_STATIONS.map((st) => [st, RECIPES.filter((r) => factoryWork(r)
  && (st === 'workbench' ? r.station === 'hand' || r.station === 'workbench' : r.station === st))]));

/** The recipes a line on this machine kind can run. */
export function factoryRecipes(station) {
  return BY_STATION.get(station) ?? [];
}

/** Whether `recipeId` is one a `station` line can run. */
export function isLineRecipe(station, recipeId) {
  return factoryRecipes(station).some((r) => r.id === recipeId);
}

/** A level's line cap: 12, 18, 30, 42 a building day. */
export function lineCap(tier = 0) {
  const l = STANDARD_LEVELS[Math.max(0, Math.min(tier, STANDARD_LEVELS.length - 1))];
  return Math.round(LINE_CAP * l.mult);
}

/** How many lines may run at a level: 6, 7, 8, 9. */
export function maxLines(tier = 0) {
  return BASE_LINES + Math.max(0, Math.min(tier, STANDARD_LEVELS.length - 1));
}

/** Runs a building day for a recipe: as many as fit under the cap, at least one. */
export function lineRuns(recipe, tier = 0) {
  return Math.max(1, Math.floor(lineCap(tier) / (recipe?.output?.count || 1)));
}

/** What a line makes a building day. */
export function lineDaily(recipe, tier = 0) {
  return lineRuns(recipe, tier) * (recipe?.output?.count || 1);
}

/**
 * Puts a structure's saved lines in order after a load: unknown machines
 * dropped, a recipe that is no longer Factory work loads as off, a bad
 * clock reads as now.
 */
export function cleanLines(lines, now = Date.now()) {
  if (!Array.isArray(lines)) return [];
  const seen = new Set();
  const out = [];
  for (const l of lines) {
    if (!l || !FACTORY_STATIONS.includes(l.station) || seen.has(l.station)) continue;
    seen.add(l.station);
    const recipe = typeof l.recipe === 'string' && isLineRecipe(l.station, l.recipe) ? l.recipe : null;
    out.push({ station: l.station, recipe, at: Number.isFinite(l.at) ? Math.min(l.at, now) : now });
  }
  return out;
}

/**
 * Runs every line that is due, once a run each. Per run:
 *   take(inputs)    takes every input out of the storehouses (all or none);
 *                   returns an undo function, or null when short
 *   deliver(output) true if the output went into the storehouses or the bag
 * Short of inputs: the run is skipped and the clock moves on (no backlog).
 * Nowhere for the output: the inputs go back and the run stays owed.
 * `present`: the machine kinds standing now; a line without one does not run.
 * Returns { made: { itemId: n }, stalled: [station] }.
 */
export function runLines(structure, { now = Date.now(), dayScale = 1, capMs = Infinity, present = null, take, deliver } = {}) {
  const made = {}, stalled = [];
  const tier = structure.tier ?? 0;
  for (const line of structure.lines ?? []) {
    const recipe = line.recipe ? RECIPES_BY_ID.get(line.recipe) : null;
    if (!recipe || (present && !present.includes(line.station))) { line.at = now; line.waiting = null; continue; }
    const period = DAY_MS * dayScale / lineRuns(recipe, tier);
    if (!(period > 0)) continue;
    if (now - line.at > capMs) line.at = now - capMs;
    while (now - line.at >= period) {
      const undo = take(recipe.inputs);
      if (!undo) {
        line.waiting = { ...recipe.inputs };
        line.at += period;
        continue;
      }
      const out = { [recipe.output.id]: recipe.output.count };
      if (!deliver(out)) {
        if (typeof undo === 'function') undo();
        stalled.push(line.station);
        line.waiting = null;
        line.stalled = true;
        break;
      }
      line.waiting = null;
      line.stalled = false;
      line.at += period;
      made[recipe.output.id] = (made[recipe.output.id] ?? 0) + recipe.output.count;
    }
  }
  return { made, stalled };
}
