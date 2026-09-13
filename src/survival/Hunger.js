import { feedValue, isFood } from '../config/items.js';

/**
 * Hunger — the reason the forest-to-farm chain is urgent rather than merely
 * sensible.
 *
 * Tuned to nag, never to kill. Starving in a building game is rage-inducing;
 * being slowed down is motivating. So an empty stomach costs you speed and
 * stops you sprinting, and that's the whole punishment.
 *
 * Every number here is a first guess and will be wrong. They're in one place so
 * they're cheap to change once somebody has actually played it.
 */

export const MAX_HUNGER = 100;
const DRAIN_PER_MINUTE = 1.4;     // ~70 minutes from full to empty while idle
const EXERTION_MULTIPLIER = 2.2;  // moving and mining burn faster than standing
const HUNGRY_AT = 35;             // warn here
const STARVING_AT = 0;

export class Hunger {
  constructor(bus) {
    this.bus = bus;
    this.value = MAX_HUNGER;
    this.exertion = 0;   // 0..1, set by the game from what the player is doing
    this._warned = false;
  }

  get ratio() {
    return this.value / MAX_HUNGER;
  }

  get isHungry() {
    return this.value <= HUNGRY_AT;
  }

  get isStarving() {
    return this.value <= STARVING_AT;
  }

  /** Movement multiplier the player controller applies. Never below a crawl. */
  get speedFactor() {
    if (this.value > HUNGRY_AT) return 1;
    if (this.value <= STARVING_AT) return 0.55;
    // Fades in over the hungry band rather than snapping at the threshold.
    const t = this.value / HUNGRY_AT;
    return 0.55 + 0.45 * t;
  }

  get canSprint() {
    return this.value > HUNGRY_AT;
  }

  tick(dtSeconds) {
    const rate = (DRAIN_PER_MINUTE / 60) * (1 + this.exertion * (EXERTION_MULTIPLIER - 1));
    const before = this.value;
    this.value = Math.max(0, this.value - rate * dtSeconds);

    if (!this._warned && before > HUNGRY_AT && this.value <= HUNGRY_AT) {
      this._warned = true;
      this.bus?.emit('hunger:low', { value: this.value });
    }
    if (this.value > HUNGRY_AT) this._warned = false;
    if (before !== this.value) this.bus?.emit('hunger:change', { value: this.value, ratio: this.ratio });
  }

  /**
   * Eats one of an item from the bag. Refuses when it isn't food, when there
   * is none, or when eating would waste most of it on a full stomach.
   */
  eat(inventory, itemId) {
    if (!isFood(itemId)) return { ok: false, reason: `You can't eat ${itemId}.` };
    if (!inventory.has(itemId, 1)) return { ok: false, reason: 'You have none of that.' };
    const feeds = feedValue(itemId);
    if (this.value >= MAX_HUNGER - 1) return { ok: false, reason: 'You are not hungry.' };

    inventory.remove(itemId, 1);
    const before = this.value;
    this.value = Math.min(MAX_HUNGER, this.value + feeds);
    this.bus?.emit('hunger:change', { value: this.value, ratio: this.ratio });
    return { ok: true, restored: Math.round(this.value - before) };
  }

  /** Picks the food that wastes the least — what an "Eat" button should do. */
  bestFoodIn(inventory) {
    const room = MAX_HUNGER - this.value;
    let best = null;
    for (const id of inventory.heldIds()) {
      if (!isFood(id)) continue;
      const feeds = feedValue(id);
      const waste = Math.max(0, feeds - room);
      if (!best || waste < best.waste || (waste === best.waste && feeds > best.feeds)) {
        best = { id, feeds, waste };
      }
    }
    return best?.id ?? null;
  }

  toJSON() {
    return { value: this.value };
  }

  loadJSON(data) {
    if (typeof data?.value === 'number') this.value = Math.max(0, Math.min(MAX_HUNGER, data.value));
  }
}
