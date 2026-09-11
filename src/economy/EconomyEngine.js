import { RESOURCES, RESOURCES_BY_ID, STARTING_STOCK, STARTING_TIER } from '../config/resources.js';
import { BLOCKS_BY_ID } from '../config/blocks.js';

/**
 * Holds resource balances and answers whether a batch of block changes can be
 * paid for. Pure logic — no rendering, no world access. Production rates and
 * idle accrual arrive in a later phase; this is the wallet.
 */
export class EconomyEngine {
  constructor(bus) {
    this.bus = bus;
    this.balances = new Map();
    this.unlockedTier = STARTING_TIER;
    for (const r of RESOURCES) this.balances.set(r.id, 0);
    for (const [id, amount] of Object.entries(STARTING_STOCK)) this.balances.set(id, amount);
  }

  balanceOf(id) {
    return this.balances.get(id) ?? 0;
  }

  capOf(id) {
    return RESOURCES_BY_ID.get(id)?.baseCap ?? Infinity;
  }

  isResourceUnlocked(id) {
    const r = RESOURCES_BY_ID.get(id);
    return !!r && r.tier <= this.unlockedTier;
  }

  unlockedResources() {
    return RESOURCES.filter((r) => this.isResourceUnlocked(r.id));
  }

  unlockTier(tier) {
    if (tier <= this.unlockedTier) return;
    this.unlockedTier = tier;
    this.bus.emit('economy:tier', { tier });
    this.bus.emit('economy:change', {});
  }

  /**
   * Net resource movement for a batch of { prev, next } block changes:
   * what's removed is refunded, what's placed is paid for. Returns
   * { resourceId: delta } where negative means spend.
   */
  deltaForChanges(changes) {
    const delta = {};
    const add = (cost, sign) => {
      if (!cost) return;
      for (const [id, amount] of Object.entries(cost)) {
        delta[id] = (delta[id] ?? 0) + amount * sign;
      }
    };
    for (const c of changes) {
      add(BLOCKS_BY_ID.get(c.prev)?.cost, 1);
      add(BLOCKS_BY_ID.get(c.next)?.cost, -1);
    }
    return delta;
  }

  /** True when every resource in the delta stays at or above zero. */
  canApply(delta) {
    for (const [id, amount] of Object.entries(delta)) {
      if (amount < 0 && this.balanceOf(id) + amount < 0) return false;
    }
    return true;
  }

  /** The first resource in the delta the player can't cover, for messaging. */
  shortfall(delta) {
    for (const [id, amount] of Object.entries(delta)) {
      if (amount < 0 && this.balanceOf(id) + amount < 0) {
        return { resource: id, needed: -amount, have: this.balanceOf(id) };
      }
    }
    return null;
  }

  apply(delta) {
    let changed = false;
    for (const [id, amount] of Object.entries(delta)) {
      if (!amount) continue;
      const next = Math.max(0, Math.min(this.capOf(id), this.balanceOf(id) + amount));
      if (next !== this.balanceOf(id)) changed = true;
      this.balances.set(id, next);
    }
    if (changed) this.bus.emit('economy:change', {});
  }

  grant(id, amount) {
    this.apply({ [id]: amount });
  }

  toJSON() {
    return {
      balances: Object.fromEntries(this.balances),
      unlockedTier: this.unlockedTier,
    };
  }

  loadJSON(json) {
    if (!json) return;
    for (const r of RESOURCES) this.balances.set(r.id, json.balances?.[r.id] ?? 0);
    this.unlockedTier = json.unlockedTier ?? STARTING_TIER;
    this.bus.emit('economy:change', {});
  }
}
