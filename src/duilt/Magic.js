import { LEVEL_POINTS, MAX_MAGIC_LEVEL, POINTS, WAND_BASE_DAMAGE, WAND_DAMAGE_PER_LEVEL, POTION_TIME_PER_LEVEL, SHOP, COIN } from '../config/magic.js';
import { ITEMS_BY_ID } from '../config/items.js';
import { WIZARD_QUESTS } from '../config/wizardQuests.js';

/**
 * WIZ-4: the player's Magic points and level, and the wizard's state.
 * Magic starts when the wizard arrives (`arrive`). Points come from quests,
 * training targets and each cast. Saved with the world; a world without the
 * key loads with magic off.
 */
export class Magic {
  constructor() { this.reset(); }

  reset() {
    /** Whether the wizard has arrived: magic exists from then on. */
    this.active = false;
    this.points = 0;
    /** Where his hut stands: { x, y, z, inside: { x, y, z } } with the door spot first, or null. */
    this.home = null;
    /** Visits to his panel, for his talk lines. */
    this.visits = 0;
    /** Quest chain state: index of the open quest, and progress counters. */
    this.chain = { step: 0, count: {} };
    /** What he has given ('wand', 'cauldron', 'hat') and the potion recipes taught. */
    this.given = [];
    this.taught = [];
    /** WAND-2: where the training targets stand, [{ x, y, z }]. */
    this.targets = [];
  }

  arrive(home) {
    if (this.active) return false;
    this.active = true;
    this.home = pointOf(home);
    return true;
  }

  /** 0 before the wizard comes, else 1 to MAX_MAGIC_LEVEL. */
  get level() {
    if (!this.active) return 0;
    let l = 1;
    for (let i = 1; i < LEVEL_POINTS.length; i++) if (this.points >= LEVEL_POINTS[i]) l = i + 1;
    return l;
  }

  /** Adds points. Returns { gained, leveled } where leveled is the new level or 0. */
  add(n) {
    if (!this.active || !(n > 0)) return { gained: 0, leveled: 0 };
    const before = this.level;
    this.points += Math.floor(n);
    const after = this.level;
    return { gained: Math.floor(n), leveled: after > before ? after : 0 };
  }

  cast() { return this.add(POINTS.cast); }
  hitTarget() { return this.add(POINTS.target); }

  /** Points still needed for the next level, 0 at the top or before arrival. */
  toNext() {
    const l = this.level;
    return l >= MAX_MAGIC_LEVEL || l === 0 ? 0 : LEVEL_POINTS[l] - this.points;
  }

  /** A wand bolt's damage at this level; `bonus` is the Wizard Hat's. */
  wandDamage(bonus = 0) {
    return WAND_BASE_DAMAGE + WAND_DAMAGE_PER_LEVEL * Math.max(0, this.level - 1) + bonus;
  }

  /** Seconds a potion lasts: its base, lengthened by Magic level. */
  potionSeconds(base) {
    return Math.round(base * (1 + POTION_TIME_PER_LEVEL * Math.max(0, this.level - 1)));
  }

  /** The shop's lines whose item exists in the game. */
  offers() {
    return SHOP.filter((o) => ITEMS_BY_ID.has(o.item));
  }

  /** Buys one item for coins from `inventory`. */
  buy(itemId, inventory) {
    if (!this.active) return { ok: false, reason: 'The wizard has not come yet.' };
    const o = this.offers().find((x) => x.item === itemId);
    if (!o) return { ok: false, reason: 'He does not sell that.' };
    if (!inventory.has(COIN, o.price)) return { ok: false, reason: `That costs ${o.price} coins.` };
    if (inventory.roomFor(itemId, 1) < 1) return { ok: false, reason: 'Your bag is full.' };
    inventory.remove(COIN, o.price);
    inventory.add(itemId, 1);
    return { ok: true, price: o.price };
  }

  // ---- the quest chain (WIZ-5) ---------------------------------------------

  /** The open quest, or null when the chain is finished (or magic is off). */
  current() {
    return this.active ? WIZARD_QUESTS[this.chain.step] ?? null : null;
  }

  /** Adds `n` to the open quest's counter if it counts `kind` and the level it asks is reached. */
  note(kind, n = 1) {
    const q = this.current();
    if (!q || q.kind !== kind || (q.level && this.level < q.level)) return false;
    this.chain.count[kind] = (this.chain.count[kind] ?? 0) + n;
    return true;
  }

  /** How far the open quest is: { quest, have, need, ready, levelOk, items }. `inventory` is read for `bring`. */
  progress(inventory = null) {
    const q = this.current();
    if (!q) return null;
    const levelOk = !q.level || this.level >= q.level;
    if (q.kind === 'bring') {
      const items = Object.entries(q.items).map(([id, need]) => ({ id, need, have: Math.min(need, inventory?.countOf(id) ?? 0) }));
      return { quest: q, levelOk, items, have: items.reduce((a, i) => a + i.have, 0), need: items.reduce((a, i) => a + i.need, 0), ready: levelOk && items.every((i) => i.have >= i.need) };
    }
    const have = Math.min(q.n, this.chain.count[q.kind] ?? 0);
    return { quest: q, levelOk, items: [], have, need: q.n, ready: levelOk && have >= q.n };
  }

  /** Hands the open quest in: takes the items, gives points and the reward, opens the next. */
  complete(inventory) {
    const q = this.current();
    if (!q) return { ok: false, reason: 'He has nothing more to ask.' };
    const pr = this.progress(inventory);
    if (!pr.levelOk) return { ok: false, reason: `You need Magic level ${q.level} first.` };
    if (!pr.ready) return { ok: false, reason: q.kind === 'bring' ? 'You do not have all of it yet.' : 'Not done yet.' };
    const item = q.reward?.item;
    if (item && !ITEMS_BY_ID.has(item)) return { ok: false, reason: 'That reward is not made yet.' };
    if (item && inventory.roomFor(item, 1) < 1) return { ok: false, reason: 'Your bag is full.' };
    if (q.kind === 'bring') for (const [id, n] of Object.entries(q.items)) inventory.remove(id, n);
    if (item) { inventory.add(item, 1); if (!this.given.includes(item)) this.given.push(item); }
    if (q.reward?.recipe && !this.taught.includes(q.reward.recipe)) this.taught.push(q.reward.recipe);
    const pts = this.add(q.points);
    this.chain = { step: this.chain.step + 1, count: {} };
    return { ok: true, quest: q, reward: q.reward ?? null, ...pts };
  }

  /** Whether he has taught `recipeId` (a potion). */
  knows(recipeId) {
    return this.taught.includes(recipeId);
  }

  toJSON() {
    return this.active ? { points: this.points, home: this.home, visits: this.visits, chain: this.chain, given: this.given, taught: this.taught, targets: this.targets } : null;
  }

  loadJSON(d) {
    this.reset();
    if (!d || typeof d !== 'object') return;
    this.active = true;
    this.points = Number.isFinite(d.points) && d.points > 0 ? Math.floor(d.points) : 0;
    this.home = pointOf(d.home);
    this.visits = Number.isFinite(d.visits) && d.visits > 0 ? Math.floor(d.visits) : 0;
    const c = d.chain;
    this.chain = { step: Number.isInteger(c?.step) && c.step >= 0 ? c.step : 0, count: {} };
    for (const [k, v] of Object.entries(c?.count ?? {})) if (Number.isFinite(v) && v >= 0) this.chain.count[k] = v;
    const strs = (a) => (Array.isArray(a) ? [...new Set(a.filter((s) => typeof s === 'string'))] : []);
    this.given = strs(d.given);
    this.taught = strs(d.taught);
    this.targets = (Array.isArray(d.targets) ? d.targets : []).filter((t) => t && [t.x, t.y, t.z].every(Number.isInteger)).slice(0, 6).map((t) => ({ x: t.x, y: t.y, z: t.z }));
  }
}

/** A point { x, y, z } with its inside point if it has one; null if it is not a point. */
function pointOf(h) {
  const p = (q) => (q && [q.x, q.y, q.z].every(Number.isFinite) ? { x: q.x, y: q.y, z: q.z } : null);
  const door = p(h);
  if (!door) return null;
  const inside = p(h.inside);
  return inside ? { ...door, inside } : door;
}
