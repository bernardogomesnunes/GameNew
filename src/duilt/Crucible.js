import { RECIPES_BY_ID } from '../config/recipes.js';

/**
 * CRAFT3D-3: the foundry's crucible. Load a recipe's batches; each melts on
 * its own (only while a foundry heats it), one at a time; then each molten
 * batch is poured into the ingot or coin mould by hand. Charcoal is burnt,
 * not poured. Keyed by the block's position ("x,y,z"), saved with the world.
 * Nothing here draws; render/CrucibleView.js turns a held Pour into a level.
 */
export const POUR_MIN = 0.90, POUR_MAX = 1.05, MAX_BATCHES = 16;

/** Seconds one batch takes to melt (or burn): ore 45, coins 25, charcoal 30. */
export function meltSeconds(recipe) {
  if (recipe.output.id === 'coal') return 30;
  if (recipe.output.id === 'coin') return 25;
  return 45;
}

/** Which mould a recipe pours into, or null when it is not poured. */
export function mouldFor(recipe) {
  if (recipe.output.id === 'coal') return null;
  return recipe.output.id === 'coin' ? 'coin' : 'ingot';
}

const bill = (recipe, n) => Object.fromEntries(Object.entries(recipe.inputs).map(([id, k]) => [id, k * n]));

export class Crucibles {
  /**
   * @param bag     () => the Inventory to pay from and give to
   * @param deliver (payload) => whether a storehouse took it
   * @param heated  (key) => whether a valid foundry stands round this crucible
   */
  constructor({ bag, deliver = () => false, heated = () => true }) {
    this.bag = bag;
    this.deliver = deliver;
    this.heated = heated;
    /** key → { recipeId, waiting, progress, molten, mould, out } */
    this.pots = new Map();
    /** key → { [itemId]: n }: what a broken crucible still owes, tried again at each prune. */
    this.owed = new Map();
  }

  state(key) {
    const p = this.pots.get(key);
    return p ? { ...p } : null;
  }

  /** Puts in as many batches of `recipeId` as the bag pays for, up to MAX_BATCHES in all. */
  load(key, recipeId, batches = 1) {
    const recipe = RECIPES_BY_ID.get(recipeId);
    if (!recipe || recipe.station !== 'crucible') return { ok: false, reason: 'That is not made in a crucible.' };
    const p = this.pots.get(key);
    if (p && p.recipeId !== recipeId) return { ok: false, reason: 'Finish what is in the pot first.' };
    const room = MAX_BATCHES - (p ? p.waiting + p.molten : 0);
    let n = Math.min(batches, room);
    const bag = this.bag();
    while (n > 0 && !bag.hasAll(bill(recipe, n))) n--;
    if (n <= 0) return { ok: false, reason: room <= 0 ? 'The pot is full.' : 'Not enough in your bag.' };
    if (!bag.spend(bill(recipe, n))) return { ok: false, reason: 'Your bag changed. Try again.' };
    if (p) p.waiting += n;
    else this.pots.set(key, { recipeId, waiting: n, progress: 0, molten: 0, mould: mouldFor(recipe) ?? 'ingot', out: 0 });
    return { ok: true, batches: n };
  }

  /** Melting goes on, one batch at a time in each heated pot. */
  tick(dt) {
    if (!(dt > 0)) return;
    for (const [key, p] of this.pots) {
      if (!p.waiting || !this.heated(key)) continue;
      const recipe = RECIPES_BY_ID.get(p.recipeId);
      p.progress += dt / meltSeconds(recipe);
      while (p.progress >= 1 && p.waiting > 0) {
        p.progress -= 1;
        p.waiting--;
        if (mouldFor(recipe)) p.molten++;
        else p.out += recipe.output.count;
      }
      if (!p.waiting) p.progress = 0;
    }
  }

  setMould(key, mould) {
    const p = this.pots.get(key);
    if (p && (mould === 'ingot' || mould === 'coin')) p.mould = mould;
  }

  /**
   * Pours one molten batch, the mould filled to `level` (1 is full): in the
   * window it is made; short, it runs back; over, it spills and is lost.
   */
  pour(key, level) {
    const p = this.pots.get(key);
    if (!p?.molten) return { result: 'none' };
    const recipe = RECIPES_BY_ID.get(p.recipeId);
    if (mouldFor(recipe) !== p.mould) return { result: 'none' };
    if (level < POUR_MIN) return { result: 'short' };
    p.molten--;
    if (level > POUR_MAX) { this.forgetIfEmpty(key); return { result: 'spilt' }; }
    const made = { id: recipe.output.id, count: recipe.output.count };
    p.out += made.count;
    this.take(key);
    return { result: 'made', made };
  }

  /** What waits in the mould goes to the bag, else a storehouse. How many moved. */
  take(key) {
    const p = this.pots.get(key);
    if (!p?.out) return 0;
    const id = RECIPES_BY_ID.get(p.recipeId).output.id, bag = this.bag();
    let moved = Math.min(p.out, bag.endless ? p.out : bag.roomFor(id, p.out));
    if (moved > 0) bag.add(id, moved);
    if (p.out - moved > 0 && this.deliver({ [id]: p.out - moved })) moved = p.out;
    p.out -= moved;
    this.forgetIfEmpty(key);
    return moved;
  }

  forgetIfEmpty(key) {
    const p = this.pots.get(key);
    if (p && !p.waiting && !p.molten && !p.out) this.pots.delete(key);
  }

  /** Gives `items` to the bag, else a storehouse; what neither takes is returned. */
  giveBack(items) {
    const bag = this.bag(), rest = {};
    for (const [id, n] of Object.entries(items)) {
      const fits = bag.endless ? n : Math.min(n, bag.roomFor(id, n));
      if (fits > 0) bag.add(id, fits);
      if (n - fits > 0) rest[id] = n - fits;
    }
    return Object.keys(rest).length && !this.deliver(rest) ? rest : null;
  }

  /** Broken crucibles give back their unmelted inputs and waiting outputs; the molten is lost. */
  prune(stands) {
    for (const [key, p] of [...this.pots]) {
      if (stands(key)) continue;
      const recipe = RECIPES_BY_ID.get(p.recipeId), items = {};
      for (const [id, n] of Object.entries(bill(recipe, p.waiting))) if (n > 0) items[id] = n;
      if (p.out) items[recipe.output.id] = (items[recipe.output.id] ?? 0) + p.out;
      this.pots.delete(key);
      const rest = this.giveBack(items);
      if (rest) this.owed.set(key, rest);
    }
    for (const [key, items] of [...this.owed]) {
      const rest = this.giveBack(items);
      if (rest) this.owed.set(key, rest); else this.owed.delete(key);
    }
  }

  toJSON() {
    return [...this.pots].map(([key, p]) => ({ key, ...p })).concat([...this.owed].map(([key, owed]) => ({ key, owed })));
  }

  loadJSON(list) {
    this.pots.clear(); this.owed.clear();
    const int = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : 0);
    for (const p of Array.isArray(list) ? list : []) {
      if (typeof p?.key !== 'string') continue;
      if (p.owed && typeof p.owed === 'object') { this.owed.set(p.key, Object.fromEntries(Object.entries(p.owed).filter(([, n]) => int(n) > 0))); continue; }
      if (RECIPES_BY_ID.get(p.recipeId)?.station !== 'crucible') continue;
      this.pots.set(p.key, { recipeId: p.recipeId, waiting: Math.min(int(p.waiting), MAX_BATCHES), molten: Math.min(int(p.molten), MAX_BATCHES),
        progress: Number.isFinite(p.progress) ? Math.min(Math.max(p.progress, 0), 0.999) : 0, mould: p.mould === 'coin' ? 'coin' : 'ingot', out: int(p.out) });
    }
  }
}
