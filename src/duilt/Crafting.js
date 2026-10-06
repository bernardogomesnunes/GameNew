import { RECIPES_BY_ID, recipesFor } from '../config/recipes.js';
import { itemName } from '../config/items.js';

/**
 * Making things from other things.
 *
 * Two rules carried over from the friction design: recipes that get used
 * constantly craft in batches — twenty nails, not one nail twenty times — and
 * every refusal says what is actually wrong, whether that's a missing
 * ingredient or standing in the wrong place.
 */

/** A station as it's written for people: wood_mill is "wood mill". */
export const stationName = (station) => String(station).replace(/_/g, ' ');

const WATER_BLOCK = 11;
const WATER_RANGE = 4;

export class Crafting {
  /**
   * @param locked  (recipe) => a reason it can't be made, or null — the
   *                rings: once one is forged the other is closed (Phase 7c).
   * @param onMade  (recipe) — after a recipe runs.
   */
  constructor({ inventory, world, skills = null, locked = null, onMade = null, hidden = null, onStudy = null }) {
    this.inventory = inventory;
    this.world = world;
    this.skills = skills;
    this.locked = locked;
    this.onMade = onMade;
    // A recipe not offered at all right now — a university's studies past
    // the next level (DuiltGame.studyHidden) — and what studying does.
    this.hidden = hidden;
    this.onStudy = onStudy;
  }

  /**
   * Whether you're at the station a recipe needs — and, for one that asks
   * a level of it (`tier`), a building that has reached it: `atStations`
   * carries 'temple@2' for a temple at level 2 or higher.
   */
  atStation(r, atStations) {
    if (r.station === 'hand') return true;
    if (!atStations.includes(r.station)) return false;
    return !r.tier || atStations.includes(`${r.station}@${r.tier}`);
  }

  /**
   * Recipes for this age, each with what it needs and whether you can make it
   * now.
   *
   * Pass `station: null` to get everything and let each recipe say where it
   * has to be made. That is what the bench does: a workshop recipe you cannot
   * see is a workshop you never learn you need, so they are listed from the
   * age they appear, greyed out until you are standing at one.
   */
  available(age, { station = 'hand', near = null, atStations = [] } = {}) {
    return recipesFor(age, station).filter((r) => !this.hidden?.(r)).map((r) => {
      const missing = this.inventory.missing(r.inputs);
      const placeOk = !r.needs || this.conditionMet(r.needs, near);
      const stationOk = this.atStation(r, atStations);
      const lock = this.locked?.(r) ?? null;
      const roomOk = r.study ? true : this.inventory.roomFor(r.output.id, r.output.count) >= r.output.count;
      const ok = Object.keys(missing).length === 0 && placeOk && stationOk && roomOk && !lock;
      let reason = null;
      // Generic rather than hardcoded to "workshop" now that a second
      // station (foundry) exists — the recipe already knows which one it
      // needs, so there is nothing left to remember here when a third one
      // shows up.
      if (lock) reason = lock;
      else if (!stationOk) reason = r.tier && atStations.includes(r.station)
        ? `Needs your ${stationName(r.station)} built up further — level ${r.tier + 1}`
        : `Stand at your ${stationName(r.station)} to make this`;
      else if (!placeOk) reason = r.needs === 'water' ? 'Stand closer to the river' : `Needs ${r.needs} nearby`;
      else if (Object.keys(missing).length) {
        reason = 'Needs ' + Object.entries(missing)
          .map(([id, n]) => `${n} more ${itemName(id).toLowerCase()}`).join(' and ');
      } else if (!roomOk) reason = 'Your bag is full — nowhere to put it';
      return {
        ...r,
        ok,
        reason,
        atStation: stationOk,
        // Capped by room as well as by materials, so "Make 4" never offers
        // four of something only two of which could go anywhere.
        maxBatch: this.batchThatFits(r, this.maxBatch(r)),
      };
    });
  }

  conditionMet(need, near) {
    if (need !== 'water' || !near) return false;
    const { x, y, z } = near;
    for (let dx = -WATER_RANGE; dx <= WATER_RANGE; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dz = -WATER_RANGE; dz <= WATER_RANGE; dz++) {
          if (this.world.getBlock(Math.floor(x) + dx, Math.floor(y) + dy, Math.floor(z) + dz) === WATER_BLOCK) return true;
        }
      }
    }
    return false;
  }

  /** How many times this recipe could run right now, capped by its batch size. */
  maxBatch(recipe) {
    const cap = recipe.batch ?? 1;
    let runs = cap;
    for (const [id, n] of Object.entries(recipe.inputs)) {
      runs = Math.min(runs, Math.floor(this.inventory.countOf(id) / n));
    }
    return Math.max(0, runs);
  }

  /** How many of `runs` would have somewhere to go in the bag. */
  batchThatFits(recipe, runs) {
    if (runs <= 0) return 0;
    // Studying makes no item, and is one level at a time.
    if (recipe.study) return Math.min(runs, 1);
    const fits = this.inventory.roomFor(recipe.output.id, recipe.output.count * runs);
    return Math.min(runs, Math.floor(fits / recipe.output.count));
  }

  /**
   * Runs a recipe `times` over. All or nothing: a half-paid craft that produced
   * nothing would be the worst possible outcome.
   */
  craft(recipeId, times = 1, { near = null, atStations = [] } = {}) {
    const recipe = RECIPES_BY_ID.get(recipeId);
    if (!recipe) return { ok: false, reason: 'No such recipe.' };

    // Checked here as well as in `available`, because the button is not the
    // only way in — a stale panel left open while you walked away would
    // otherwise still craft.
    const lock = this.locked?.(recipe);
    if (lock) return { ok: false, reason: `${lock}.` };
    if (!this.atStation(recipe, atStations)) {
      return { ok: false, reason: `Stand at your ${recipe.station}${recipe.tier ? ', built up to level ' + (recipe.tier + 1) : ''}, to make this.` };
    }

    if (recipe.needs && !this.conditionMet(recipe.needs, near)) {
      return { ok: false, reason: recipe.needs === 'water' ? 'Stand closer to the river.' : `Needs ${recipe.needs} nearby.` };
    }

    const wanted = Math.min(times, this.maxBatch(recipe));
    if (wanted <= 0) {
      const missing = this.inventory.missing(recipe.inputs);
      const parts = Object.entries(missing).map(([id, n]) => `${n} more ${itemName(id).toLowerCase()}`);
      return { ok: false, reason: parts.length ? `Needs ${parts.join(' and ')}.` : 'Not enough materials.' };
    }

    // Room is checked before the bill is paid, not after. Paying and refunding
    // works, but it turns "your bag is full" into a thing you only find out by
    // pressing a button that looked perfectly happy.
    const runs = this.batchThatFits(recipe, wanted);
    if (runs <= 0) return { ok: false, reason: 'Your bag is full — empty a slot first.' };

    const bill = {};
    for (const [id, n] of Object.entries(recipe.inputs)) bill[id] = n * runs;
    if (!this.inventory.spend(bill)) return { ok: false, reason: 'Your materials changed — try again.' };

    // Studying (a university): no item — the skill or the research is what you get.
    // Studying makes no item and takes time (DuiltGame.startStudy): this
    // starts it; the skill or the research comes when its days are up.
    if (recipe.study) {
      this.onStudy?.(recipe);
      this.onMade?.(recipe);
      return { ok: true, made: 1, item: null, name: recipe.result, studied: recipe.study, started: true };
    }

    const made = recipe.output.count * runs;
    const leftover = this.inventory.add(recipe.output.id, made);
    if (leftover > 0) {
      // Put the ingredients back rather than swallow them for goods that
      // wouldn't fit anywhere.
      this.inventory.remove(recipe.output.id, made - leftover);
      this.inventory.refund(bill);
      return { ok: false, reason: 'Your bag is full.' };
    }

    this.skills?.record('building', runs);
    this.onMade?.(recipe);
    return { ok: true, made, item: recipe.output.id, name: itemName(recipe.output.id) };
  }
}
