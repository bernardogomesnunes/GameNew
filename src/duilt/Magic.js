import { LEVEL_POINTS, MAX_MAGIC_LEVEL, POINTS, WAND_BASE_DAMAGE, WAND_DAMAGE_PER_LEVEL, POTION_TIME_PER_LEVEL, SHOP, COIN } from '../config/magic.js';
import { ITEMS_BY_ID } from '../config/items.js';

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
    /** Where his hut stands: { x, y, z } at the door, or null. */
    this.home = null;
    /** Visits to his panel, for his talk lines. */
    this.visits = 0;
    /** Quest chain state: index of the open quest, and progress counters. */
    this.chain = { step: 0, count: {} };
    /** What he has given ('wand', 'cauldron', 'hat') and the potion recipes taught. */
    this.given = [];
    this.taught = [];
  }

  arrive(home) {
    if (this.active) return false;
    this.active = true;
    this.home = home ? { x: home.x, y: home.y, z: home.z } : null;
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

  toJSON() {
    return this.active ? { points: this.points, home: this.home, visits: this.visits, chain: this.chain, given: this.given, taught: this.taught } : null;
  }

  loadJSON(d) {
    this.reset();
    if (!d || typeof d !== 'object') return;
    this.active = true;
    this.points = Number.isFinite(d.points) && d.points > 0 ? Math.floor(d.points) : 0;
    const h = d.home;
    this.home = h && [h.x, h.y, h.z].every(Number.isFinite) ? { x: h.x, y: h.y, z: h.z } : null;
    this.visits = Number.isFinite(d.visits) && d.visits > 0 ? Math.floor(d.visits) : 0;
    const c = d.chain;
    this.chain = { step: Number.isInteger(c?.step) && c.step >= 0 ? c.step : 0, count: {} };
    for (const [k, v] of Object.entries(c?.count ?? {})) if (Number.isFinite(v) && v >= 0) this.chain.count[k] = v;
    const strs = (a) => (Array.isArray(a) ? [...new Set(a.filter((s) => typeof s === 'string'))] : []);
    this.given = strs(d.given);
    this.taught = strs(d.taught);
  }
}
