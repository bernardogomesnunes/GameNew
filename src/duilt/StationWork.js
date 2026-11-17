import { RECIPES, RECIPES_BY_ID } from '../config/recipes.js';
import { ITEMS_BY_ID } from '../config/items.js';

/**
 * IMP-15: transformations as a place-it-in, watch-it-change process.
 *
 * Owner, 31 October: "for the melting building, I would like a more dynamic
 * way of putting the items like a spot that I could place them and they would
 * move in the new form to the other. The rule must be if it's a
 * transformation of n item into another it should be with this form." And
 * for the forge: everything it makes, in its own pop-up. Decided: an input
 * spot and an output spot in the station's pop-up, one item at a time, 15
 * seconds to 2 minutes each, and the work goes on while you walk away (not
 * while the game is closed: production waits then, as everywhere).
 *
 * A spot belongs to one placed station block ("x,y,z") or one building
 * ("s:<id>"). It holds the recipe chosen there, what was put in for it, and
 * what has come out. Putting in moves whole batches' worth from the bag;
 * taking out moves the output back. Nothing here reads the world: Game says
 * which spots still stand (prune).
 */

/** Stations whose single-input recipes go through the spots; the forge's do whatever their inputs. */
const SPOT_STATIONS = new Set(['forge', 'bleach_bucket', 'stone_mill', 'wood_mill', 'planing_bench', 'joinery_bench', 'masons_bench']);
/** Most a spot holds of what is put in, in batches. */
export const MAX_BATCHES = 64;

/** Whether `recipe` is made through a station's spots (IMP-15's rule). */
export function usesSpots(recipe) {
  if (!recipe || !SPOT_STATIONS.has(recipe.station)) return false;
  return recipe.station === 'forge' || Object.keys(recipe.inputs).length === 1;
}

/**
 * Seconds one batch takes: 15 to 120 (owner: "min 15 sec max 2 min", "pretty
 * quick for most things"). Plain cutting and washing are quick; firing and
 * smelting longer; a forged sword longest.
 */
export function batchSeconds(recipe) {
  if (recipe.seconds) return Math.min(120, Math.max(15, recipe.seconds));
  if (/^sword_/.test(recipe.output.id)) return 90;
  if (recipe.station === 'foundry') return /^smelt_/.test(recipe.id) ? 45 : 25;
  if (recipe.station === 'forge') return 30;
  return 15;
}

/**
 * Recipes removed in CRAFT-9, each mapped to the recipe with the same input
 * and output item that replaced it: plank recipes at the wood mill (part 1,
 * now at the planing bench) and door and trapdoor recipes at the wood mill
 * (part 2, now at the joinery bench). loadJSON rewrites a saved spot on one
 * to the new recipe and its station. A saved spot stands at a wood mill or
 * a stone mill, so the next prune (DuiltGame.spotStands) finds no matching
 * bench there and hands its inputs and finished items back to the bag:
 * nothing is lost. Without the map the spot would be dropped unpaid.
 * Part 5: the plain stone brick recipe (4 stone for 4) is gone; a saved spot
 * on it becomes the mill's `stone_mill_stone_brick` (4 stone for 6), same
 * station, so it keeps working and the saved batches stay.
 * Orange stone moved from the stone mill to the Wash Tub under the same id
 * `stone_orange`. It has two inputs, so it never used a spot: nothing saved
 * names it and it needs no entry.
 * Part 4 moves stone shaping from the stone mill to the Mason's Bench: the
 * 21 single-input stone_mill_* shaping recipes map to mason_*, and marble
 * keeps its id with its station moved (a saved marble spot stands at a stone
 * mill, so the prune refunds it the same way). stone_mill_calcada_wave is not
 * listed: it takes two inputs, so it was never made through a spot.
 * The workbench fence and gate recipes (part 2) and the 24 workbench stone
 * copies (part 4) are not listed: the workbench is not a spot station, so no
 * saved spot can name them.
 */
const RENAMED_RECIPES = new Map([
  ['mill_planks', 'bench_planks'],
  ['mill_planks_white', 'bench_planks_white'],
  ['mill_planks_dark', 'bench_planks_dark'],
  ['mill_door', 'joinery_door'],
  ['mill_door_white', 'joinery_door_white'],
  ['mill_door_dark', 'joinery_door_dark'],
  ['mill_trapdoor', 'joinery_trapdoor'],
  ['mill_trapdoor_white', 'joinery_trapdoor_white'],
  ['mill_trapdoor_dark', 'joinery_trapdoor_dark'],
  ['stone_brick', 'stone_mill_stone_brick'],
  ['stone_mill_stairs_stone', 'mason_stairs_stone'],
  ['stone_mill_roof_stone', 'mason_roof_stone'],
  ['stone_mill_roof_brick', 'mason_roof_brick'],
  ['stone_mill_wall_stone', 'mason_wall_stone'],
  ['stone_mill_wall_cobble', 'mason_wall_cobble'],
  ['stone_mill_wall_brick', 'mason_wall_brick'],
  ['stone_mill_wall_dark', 'mason_wall_dark'],
  ['stone_mill_wall_stone_brick', 'mason_wall_stone_brick'],
  ['stone_mill_wall_sandstone', 'mason_wall_sandstone'],
  ['stone_mill_wall_dark_brick', 'mason_wall_dark_brick'],
  ['stone_mill_wall_marble', 'mason_wall_marble'],
  ['stone_mill_wall_sky_marble', 'mason_wall_sky_marble'],
  ['stone_mill_wall_white_stone', 'mason_wall_white_stone'],
  ['stone_mill_wall_grey_stone', 'mason_wall_grey_stone'],
  ['stone_mill_wall_turquoise', 'mason_wall_turquoise'],
  ['stone_mill_wall_orange', 'mason_wall_orange'],
  ['stone_mill_chimney_stone_brick', 'mason_chimney_stone_brick'],
  ['stone_mill_chimney_brick', 'mason_chimney_brick'],
  ['stone_mill_pillar_stone', 'mason_pillar_stone'],
  ['stone_mill_pillar_marble', 'mason_pillar_marble'],
  ['stone_mill_pillar_dark', 'mason_pillar_dark'],
  ['marble', 'marble'],
]);

export class StationWork {
  /** `bag` () => the bag to pay from and give to, read each time (it can be swapped). */
  constructor({ inventory = null, bag = null }) {
    this.bag = bag ?? (() => inventory);
    /** key → { station, recipeId, batches (waiting), progress (0..1 of the batch in work), out: count } */
    this.spots = new Map();
  }

  /** The recipes made through spots at `station`, in recipe order. */
  static recipesAt(station) {
    return RECIPES.filter((r) => r.station === station && usesSpots(r));
  }

  spot(key) {
    return this.spots.get(key) ?? null;
  }

  /**
   * Puts `batches` of `recipeId` in at `key`: its inputs leave the bag now.
   * A spot works one recipe at a time: a different one only once it is empty.
   */
  put(key, recipeId, batches = 1) {
    const recipe = RECIPES_BY_ID.get(recipeId);
    if (!usesSpots(recipe)) return { ok: false, reason: 'That is not made here.' };
    if (!Number.isSafeInteger(batches) || batches < 1) return { ok: false, reason: 'Put in at least one.' };
    const tools = (recipe.tools ?? []).filter((id) => this.bag().countOf(id) < 1);
    if (tools.length) return { ok: false, reason: `Keep ${tools.map((id) => (ITEMS_BY_ID.get(id)?.name ?? id.replace(/_/g, ' ')).toLowerCase()).join(', ')} in your bag.` };
    const s = this.spots.get(key);
    if (s && s.recipeId !== recipeId && (s.batches > 0 || s.out > 0)) return { ok: false, reason: 'Take out what is here first.' };
    const room = MAX_BATCHES - (s?.recipeId === recipeId ? s.batches : 0);
    let n = Math.min(batches, room);
    while (n > 0 && !this.bag().hasAll(bill(recipe, n))) n--;
    if (n <= 0) return { ok: false, reason: room <= 0 ? 'It is full.' : 'Not enough in your bag.' };
    if (!this.bag().spend(bill(recipe, n))) return { ok: false, reason: 'Your bag changed. Try again.' };
    const was = s?.recipeId === recipeId ? s : null;
    this.spots.set(key, { station: recipe.station, recipeId, batches: (was?.batches ?? 0) + n, progress: was?.progress ?? 0, out: was?.out ?? 0 });
    return { ok: true, batches: n };
  }

  /** What has come out at `key` goes to the bag, as much as fits. How many moved. */
  take(key) {
    const s = this.spots.get(key);
    if (!s?.out) return 0;
    const id = RECIPES_BY_ID.get(s.recipeId).output.id;
    const left = this.bag().add(id, s.out);
    const moved = s.out - left;
    s.out = left;
    this.forgetIfEmpty(key);
    return moved;
  }

  /** What is waiting at `key`, back to the bag (as much as fits). */
  takeBack(key) {
    const s = this.spots.get(key);
    if (!s?.batches) return 0;
    const recipe = RECIPES_BY_ID.get(s.recipeId);
    let back = 0;
    while (s.batches > 0) {
      const one = bill(recipe, 1);
      if (!Object.entries(one).every(([id, n]) => this.bag().roomFor(id, n) >= n)) break;
      for (const [id, n] of Object.entries(one)) this.bag().add(id, n);
      s.batches--; back++;
    }
    if (!s.batches) s.progress = 0;
    this.forgetIfEmpty(key);
    return back;
  }

  forgetIfEmpty(key) {
    const s = this.spots.get(key);
    if (s && !s.batches && !s.out) this.spots.delete(key);
  }

  /** Seconds left on the batch in work at `key`, or 0. */
  secondsLeft(key) {
    const s = this.spots.get(key);
    if (!s?.batches) return 0;
    return Math.ceil((1 - s.progress) * batchSeconds(RECIPES_BY_ID.get(s.recipeId)) - 1e-9);
  }

  /** The work goes on, one batch at a time at every spot, wherever you are. */
  tick(dt) {
    if (!(dt > 0)) return [];
    const done = [];
    for (const [key, s] of this.spots) {
      if (!s.batches) continue;
      const recipe = RECIPES_BY_ID.get(s.recipeId);
      if (!recipe) continue;
      // Output stacks to what a bag stack holds; past that it waits for you.
      if (s.out >= MAX_BATCHES * recipe.output.count) continue;
      s.progress += dt / batchSeconds(recipe);
      while (s.progress >= 1 && s.batches > 0) {
        s.progress -= 1;
        s.batches--;
        s.out += recipe.output.count;
        done.push({ key, recipe });
      }
      if (!s.batches) s.progress = 0;
    }
    return done;
  }

  /**
   * Spots whose station is gone (`stands(key, station)` false): what was in
   * them goes back to the bag, so nothing is lost with a broken block.
   */
  prune(stands) {
    for (const [key, s] of [...this.spots]) {
      if (stands(key, s.station)) continue;
      this.take(key);
      this.takeBack(key);
      this.spots.delete(key);
    }
  }

  toJSON() {
    return [...this.spots].map(([key, s]) => ({ key, ...s }));
  }

  loadJSON(list) {
    this.spots.clear();
    for (let s of Array.isArray(list) ? list : []) {
      // CRAFT3D-3: the foundry's work moved to its crucible; what a saved
      // foundry spot held comes back to the bag, once.
      if (s?.station === 'foundry' && RECIPES_BY_ID.get(s.recipeId)) {
        const r = RECIPES_BY_ID.get(s.recipeId), int = (n) => (Number.isSafeInteger(n) && n > 0 ? n : 0);
        for (const [id, n] of Object.entries(r.inputs)) if (int(s.batches)) this.bag().add(id, n * int(s.batches));
        if (int(s.out)) this.bag().add(r.output.id, int(s.out));
        continue;
      }
      const renamed = RENAMED_RECIPES.get(s?.recipeId);
      if (renamed) s = { ...s, recipeId: renamed, station: RECIPES_BY_ID.get(renamed).station };
      if (typeof s?.key !== 'string' || !usesSpots(RECIPES_BY_ID.get(s.recipeId))) continue;
      const int = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : 0);
      this.spots.set(s.key, { station: s.station, recipeId: s.recipeId, batches: Math.min(int(s.batches), MAX_BATCHES),
        progress: Number.isFinite(s.progress) ? Math.min(Math.max(s.progress, 0), 0.999) : 0, out: int(s.out) });
    }
  }
}

function bill(recipe, n) {
  return Object.fromEntries(Object.entries(recipe.inputs).map(([id, k]) => [id, k * n]));
}
