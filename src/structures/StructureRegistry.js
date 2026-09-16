import { STRUCTURES_BY_ID } from '../config/structures.js';
import { Inventory } from '../items/Inventory.js';
import { validateStructure } from './validate.js';

/**
 * Every building the player has claimed, and the clock that pays them out.
 *
 * Production runs on wall-clock time rather than frames, which means it also
 * runs while the tab is closed. Coming back to a full granary is most of the
 * reason to come back at all, and a game that only advances while you watch it
 * is a game you have to babysit.
 *
 * Structures are re-checked as the world changes: dig the dirt out from under
 * your own farm and it stops producing — with a warning, never silently.
 */

const MAX_OFFLINE_HOURS = 8; // beyond this, idle income stops being a reward

export class StructureRegistry {
  constructor({ world, bus, inventory }) {
    this.world = world;
    this.bus = bus;
    this.inventory = inventory;
    this.structures = [];
    this.nextId = 1;
  }

  list() {
    return this.structures;
  }

  countOf(typeId) {
    return this.structures.filter((s) => s.type === typeId && s.valid).length;
  }

  // ---- storehouses ----

  /**
   * The container a building keeps, made the first time it is asked for.
   *
   * A storehouse is a place in the world, not a bigger bag. That distinction is
   * the whole point of it: the bag is what you are carrying and it goes where
   * you go, while this stays in the building and anyone can see where it is.
   * So it gets its own Inventory rather than growing the player's.
   */
  storeFor(structure) {
    const holds = STRUCTURES_BY_ID.get(structure?.type)?.holds;
    if (!holds) return null;
    if (!structure.store) structure.store = new Inventory({ slots: holds, bus: this.bus });
    return structure.store;
  }

  /** Every standing storehouse, with what it is holding. */
  stores() {
    return this.structures
      .filter((s) => s.valid && STRUCTURES_BY_ID.get(s.type)?.holds)
      .map((s) => ({ structure: s, store: this.storeFor(s) }));
  }

  /**
   * How many things are sitting in storehouses.
   *
   * Counts broken ones too, unlike `stores()`. Knocking a wall out of a shed
   * stops it taking deliveries; it does not make what is already inside it
   * disappear, and a total that said otherwise would be lying about goods the
   * player can still walk over and collect.
   */
  storedCount() {
    return this.structures.reduce((n, s) =>
      n + (s.store?.slots.reduce((m, q) => m + (q?.count ?? 0), 0) ?? 0), 0);
  }

  /**
   * Puts a building's output somewhere: the bag first, then the storehouses.
   *
   * All of it or none of it. Partly delivering means the rest is destroyed,
   * and destroyed is precisely what a storehouse exists to prevent — so if any
   * of it has nowhere to go, everything already placed comes back out and the
   * caller leaves the time owed. Empty a storehouse an hour later and the
   * payout arrives then instead of having quietly evaporated.
   */
  deliver(payload) {
    const placed = [];
    const into = () => [this.inventory, ...this.stores().map((s) => s.store)];
    for (const [id, amount] of Object.entries(payload)) {
      let left = amount;
      for (const where of into()) {
        if (left <= 0) break;
        const before = left;
        left = where.add(id, left);
        if (before > left) placed.push({ where, id, amount: before - left });
      }
      if (left > 0) {
        for (const p of placed) p.where.remove(p.id, p.amount);
        return false;
      }
    }
    return true;
  }

  /** Households your standing houses have room for — one roof, one family. */
  capacity() {
    return this.structures.reduce((n, s) => {
      if (!s.valid) return n;
      return n + (STRUCTURES_BY_ID.get(s.type)?.grantsCapacity ?? 0);
    }, 0);
  }

  /**
   * The building a block belongs to, if any.
   *
   * Claimed buildings are locked: with break-and-hold it is far too easy to
   * take a wall out of your own house while clearing the ground beside it, and
   * the first you would know is the structure reporting itself broken. Locking
   * makes a building a thing you decide to change rather than something you
   * lose by sweeping past it.
   */
  at(x, y, z) {
    return this.structures.find((s) => {
      const r = s.region;
      return x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY && z >= r.minZ && z <= r.maxZ;
    }) ?? null;
  }

  /** The building standing in the way of an edit, or null if nothing is. */
  blocking(changes) {
    for (const c of changes) {
      const s = this.at(c.x, c.y, c.z);
      if (s && s.locked !== false) return s;
    }
    return null;
  }

  /** Unlocked, a building can be edited like any other blocks — and may break. */
  setLocked(id, locked) {
    const s = this.structures.find((x) => x.id === id);
    if (!s) return false;
    s.locked = locked;
    this.bus?.emit('structure:locked', { structure: s, locked });
    return true;
  }

  /** True when a new region would overlap something already claimed. */
  overlaps(region, ignoreId = null) {
    return this.overlapping(region, ignoreId).length > 0;
  }

  /** Every claim whose box meets this region. */
  overlapping(region, ignoreId = null) {
    return this.structures.filter((s) => {
      if (s.id === ignoreId) return false;
      const r = s.region;
      return !(region.maxX < r.minX || region.minX > r.maxX
        || region.maxZ < r.minZ || region.minZ > r.maxZ
        || region.maxY < r.minY || region.minY > r.maxY);
    });
  }

  /**
   * Claims a region as a building. Returns { ok, reason, structure }.
   * Charges the type's cost from the bag, all or nothing.
   */
  claim(region, typeId, { now = Date.now(), discount = 0 } = {}) {
    const spec = STRUCTURES_BY_ID.get(typeId);
    if (!spec) return { ok: false, reason: 'Unknown building type.' };

    // A claim you can no longer stand in front of must not hold the ground for
    // ever. A building whose blocks are gone is a dead claim: it is invalid, it
    // produces nothing, and there is nothing left to point at to release it —
    // so "I destroyed my farm and cannot build a farm there again" had no way
    // out at all. Claiming over one clears it. A *standing* building still
    // refuses, because that is somebody's house.
    const inTheWay = this.overlapping(region);
    const standing = inTheWay.filter((s) => s.valid);
    if (standing.length) {
      return { ok: false, reason: 'That overlaps a building you already have.' };
    }
    const replaced = inTheWay.length;

    const check = validateStructure(this.world, region, typeId);
    if (!check.ok) return { ok: false, reason: check.reason };

    // The Building skill makes raising things cheaper. Safe here because a
    // claim cannot be reversed for a refund.
    const cost = {};
    for (const [id, n] of Object.entries(spec.cost ?? {})) {
      const reduced = Math.max(1, Math.ceil(n * (1 - discount)));
      cost[id] = reduced;
    }
    if (Object.keys(cost).length && !this.inventory.hasAll(cost)) {
      const missing = this.inventory.missing(cost);
      const parts = Object.entries(missing).map(([id, n]) => `${n} ${id}`);
      return { ok: false, reason: `Needs ${parts.join(' and ')} in your bag` };
    }
    this.inventory.spend(cost);

    const structure = {
      id: this.nextId++,
      type: typeId,
      region: { ...region },
      valid: true,
      locked: true,
      claimedAt: now,
      lastPaidAt: now,
      brokenReason: null,
    };
    if (replaced) {
      const dead = new Set(inTheWay);
      this.structures = this.structures.filter((s) => !dead.has(s));
      for (const s of dead) this.bus?.emit('structure:removed', { structure: s });
    }
    this.structures.push(structure);
    this.bus?.emit('structure:claimed', { structure, spec });
    return { ok: true, reason: check.reason, structure, replaced };
  }

  remove(id) {
    const i = this.structures.findIndex((s) => s.id === id);
    if (i === -1) return false;
    const [gone] = this.structures.splice(i, 1);
    this.bus?.emit('structure:removed', { structure: gone });
    return true;
  }

  /**
   * Re-checks any structure whose region contains a changed block. Called after
   * an edit, not every frame — validation walks a volume and there's no reason
   * to pay for it while nothing has moved.
   */
  revalidateAround(changes) {
    if (!changes?.length) return;
    const touched = new Set();
    for (const s of this.structures) {
      for (const c of changes) {
        const r = s.region;
        if (c.x >= r.minX && c.x <= r.maxX && c.y >= r.minY && c.y <= r.maxY && c.z >= r.minZ && c.z <= r.maxZ) {
          touched.add(s);
          break;
        }
      }
    }
    for (const s of touched) this.recheck(s);
  }

  recheck(structure) {
    const check = validateStructure(this.world, structure.region, structure.type);
    const wasValid = structure.valid;
    structure.valid = check.ok;
    structure.brokenReason = check.ok ? null : check.reason;

    if (wasValid && !check.ok) {
      this.bus?.emit('structure:broken', { structure, reason: check.reason });
    } else if (!wasValid && check.ok) {
      structure.lastPaidAt = Date.now(); // don't pay for the time it spent broken
      this.bus?.emit('structure:repaired', { structure });
    }
    return check.ok;
  }

  /**
   * Pays out everything owed since each building was last paid. Returns a
   * { itemId: amount } summary so the UI can say what arrived.
   */
  collect({ now = Date.now(), yieldMultiplier = 1, bonusFor = null } = {}) {
    const gained = {};
    const stalled = [];
    const capMs = MAX_OFFLINE_HOURS * 3600_000;

    for (const s of this.structures) {
      if (!s.valid) continue;
      const spec = STRUCTURES_BY_ID.get(s.type);
      if (!spec?.everySeconds || !spec.produces) continue;

      const periodMs = spec.everySeconds * 1000;
      const elapsed = Math.min(now - s.lastPaidAt, capMs);
      const cycles = Math.floor(elapsed / periodMs);
      if (cycles <= 0) continue;

      // Somebody working a building is the only thing that changes what one
      // building gives against another of the same kind.
      const staffing = bonusFor ? bonusFor(s.id) : 1;
      const payload = {};
      for (const [item, per] of Object.entries(spec.produces)) {
        // Foraging pays out here rather than at the pickaxe — see DuiltGame.yieldFor.
        const amount = Math.round(per * cycles * yieldMultiplier * staffing);
        if (amount > 0) payload[item] = amount;
      }

      // Nowhere to put it is not the same as made-and-thrown-away, which is
      // what this used to do: it credited whatever fit, dropped the rest on
      // the floor and moved the clock on anyway, so a full bag ate a night's
      // production without a word. Now the payout stays owed until there is
      // room for it, in the bag or in a storehouse.
      if (Object.keys(payload).length && !this.deliver(payload)) {
        stalled.push(s);
        continue;
      }
      for (const [item, amount] of Object.entries(payload)) {
        gained[item] = (gained[item] ?? 0) + amount;
      }
      s.lastPaidAt += cycles * periodMs;
    }

    if (Object.keys(gained).length) this.bus?.emit('structure:produced', { gained });
    if (stalled.length) this.bus?.emit('structure:stalled', { structures: stalled });
    return gained;
  }

  /** Seconds until the next payout from any building, or null if none produce. */
  nextPayoutIn({ now = Date.now() } = {}) {
    let soonest = Infinity;
    for (const s of this.structures) {
      if (!s.valid) continue;
      const spec = STRUCTURES_BY_ID.get(s.type);
      if (!spec?.everySeconds) continue;
      const due = s.lastPaidAt + spec.everySeconds * 1000;
      soonest = Math.min(soonest, Math.max(0, due - now));
    }
    return soonest === Infinity ? null : Math.round(soonest / 1000);
  }

  toJSON() {
    return {
      nextId: this.nextId,
      structures: this.structures.map((s) => ({
        id: s.id, type: s.type, region: s.region, valid: s.valid,
        locked: s.locked !== false,
        claimedAt: s.claimedAt, lastPaidAt: s.lastPaidAt,
        // Only storehouses have one, and an empty one is worth writing: it is
        // the difference between "nothing in it" and "never had one".
        store: s.store ? s.store.toJSON() : null,
      })),
    };
  }

  loadJSON(data) {
    if (!data?.structures) return;
    this.structures = data.structures
      .filter((s) => STRUCTURES_BY_ID.has(s.type))
      // Saves from before buildings could be locked have no flag; locked is the
      // safe reading of a building someone claimed on purpose.
      .map((s) => {
        const structure = { locked: true, ...s, store: null, brokenReason: null };
        // Built here rather than in a second pass over `data.structures`: a
        // filtered-out type shifts every index after it, and a storehouse
        // would come back holding the building next door's goods.
        if (s.store) this.storeFor(structure)?.loadJSON(s.store);
        return structure;
      });
    this.nextId = data.nextId ?? (this.structures.reduce((m, s) => Math.max(m, s.id), 0) + 1);
    // The world may have changed while we were away — trust the blocks, not the save.
    for (const s of this.structures) this.recheck(s);
  }
}
