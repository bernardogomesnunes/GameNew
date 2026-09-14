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

const WATER_BLOCK = 11;
const WATER_RANGE = 4;

export class Crafting {
  constructor({ inventory, world, skills = null }) {
    this.inventory = inventory;
    this.world = world;
    this.skills = skills;
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
    return recipesFor(age, station).map((r) => {
      const missing = this.inventory.missing(r.inputs);
      const placeOk = !r.needs || this.conditionMet(r.needs, near);
      const stationOk = r.station === 'hand' || atStations.includes(r.station);
      const ok = Object.keys(missing).length === 0 && placeOk && stationOk;
      let reason = null;
      if (!stationOk) reason = 'Stand at your workshop to make this';
      else if (!placeOk) reason = r.needs === 'water' ? 'Stand closer to the river' : `Needs ${r.needs} nearby`;
      else if (!ok) {
        reason = 'Needs ' + Object.entries(missing)
          .map(([id, n]) => `${n} more ${itemName(id).toLowerCase()}`).join(' and ');
      }
      return {
        ...r,
        ok,
        reason,
        atStation: stationOk,
        maxBatch: this.maxBatch(r),
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
    if (recipe.station !== 'hand' && !atStations.includes(recipe.station)) {
      return { ok: false, reason: 'Stand at your workshop to make this.' };
    }

    if (recipe.needs && !this.conditionMet(recipe.needs, near)) {
      return { ok: false, reason: recipe.needs === 'water' ? 'Stand closer to the river.' : `Needs ${recipe.needs} nearby.` };
    }

    const runs = Math.min(times, this.maxBatch(recipe));
    if (runs <= 0) {
      const missing = this.inventory.missing(recipe.inputs);
      const parts = Object.entries(missing).map(([id, n]) => `${n} more ${itemName(id).toLowerCase()}`);
      return { ok: false, reason: parts.length ? `Needs ${parts.join(' and ')}.` : 'Not enough materials.' };
    }

    const bill = {};
    for (const [id, n] of Object.entries(recipe.inputs)) bill[id] = n * runs;
    if (!this.inventory.spend(bill)) return { ok: false, reason: 'Your materials changed — try again.' };

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
    return { ok: true, made, item: recipe.output.id, name: itemName(recipe.output.id) };
  }
}
