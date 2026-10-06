import { STRUCTURES_BY_ID, holdsAt, isStore, hasLevels, producesAt, intervalAt, scaleProduce, yieldAt } from '../config/structures.js';
import { Inventory } from '../items/Inventory.js';
import { cropOf } from '../config/crops.js';

/** Planting, growing or picking a crop: a crop or nothing, before and after. */
const isCropChange = (c) => (c.prev === 0 || !!cropOf(c.prev)) && (c.next === 0 || !!cropOf(c.next)) && c.prev !== c.next;
import { tierStatus, validateStructure } from './validate.js';

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
/** And never more than this many of the buildings' own days, however short a day is. */
const MAX_OFFLINE_DAYS = 2;
/** A real day: what `everySeconds` in config/structures.js is written against. */
const REAL_DAY_SECONDS = 86400;

export class StructureRegistry {
  /**
   * `dayLengthSeconds`: how many real seconds one of the buildings' days
   * lasts. Every rate in config/structures.js is written as so much a day —
   * `everySeconds` out of 86,400 — and by default a day is a real one. Duilt
   * passes the game's own day (render/DayCycle.js, fifteen minutes), because
   * played on: "the forest is not giving me the wood daily. After 3 days zero
   * wood" — three game days was 45 minutes, and the forest paid every six
   * real hours.
   */
  constructor({ world, bus, inventory, dayLengthSeconds = REAL_DAY_SECONDS }) {
    this.world = world;
    this.bus = bus;
    this.inventory = inventory;
    this.dayScale = dayLengthSeconds / REAL_DAY_SECONDS;
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
    const spec = STRUCTURES_BY_ID.get(structure?.type);
    if (!isStore(spec)) return null;
    if (!structure.store) {
      structure.tier = structure.tier ?? 0;
      structure.store = new Inventory({ slots: holdsAt(spec, structure.tier), bus: this.bus });
    }
    return structure.store;
  }

  /**
   * Re-reads what a leveled building has been built into — resizing a
   * storehouse's shelves, or just noting a quarry's rock for `collect` to
   * read next cycle.
   *
   * `initial` is only true from claim(), for a building claimed already
   * built up past the first rung — a warehouse claimed as a finished
   * warehouse starts as one, which is reading the floor with nothing yet to
   * respect (see tierStatus's own doc comment). Every other call is a
   * recheck after an edit might have moved the blocks, and only ever
   * lowers the tier: reaching a rung the blocks now support again is
   * `evolve`'s job, not something a broken wall's repair hands back for
   * free. Reported directly: leveling used to happen the instant the last
   * block went down, with no button and no say in when — this is the half
   * of that which still has to be automatic, because losing a rung you no
   * longer have the blocks for isn't a choice either.
   */
  retier(structure, { initial = false } = {}) {
    const spec = STRUCTURES_BY_ID.get(structure?.type);
    if (!hasLevels(spec)) return null;
    const status = tierStatus(this.world, structure.region, structure.type, initial ? null : (structure.tier ?? 0), { credit: structure.credit });
    const was = structure.tier ?? 0;
    structure.tier = status.tier;
    if (isStore(spec)) this.storeFor(structure).resize(status.slots);
    if (!initial && status.tier < was) {
      this.bus?.emit('structure:downgraded', { structure, name: status.name, blurb: status.blurb });
    }
    return status;
  }

  /**
   * The other half of leveling — the button in the building panel. Only
   * moves one rung at a time, even if the blocks already qualify for
   * several: reaching level 4 unlocks level 5's requirements, not levels 4
   * through 7 all at once because the whole ladder happened to already be
   * standing.
   */
  evolve(id) {
    const s = this.structures.find((x) => x.id === id);
    if (!s) return { ok: false, reason: 'That building no longer exists.' };
    const spec = STRUCTURES_BY_ID.get(s.type);
    if (!hasLevels(spec)) return { ok: false, reason: 'Nothing here has a level to reach.' };
    const status = tierStatus(this.world, s.region, s.type, s.tier ?? 0, { credit: s.credit });
    // Said in full: the button is always there now, so pressing it early has
    // to say what's still missing rather than just "not yet".
    if (!status.canEvolve) {
      const missing = status.next?.missing ?? [];
      return { ok: false, reason: missing.length ? `Still needs ${missing.join(', ')}.` : 'It\'s at its top level.' };
    }
    const tierDef = spec.tiers[status.tier + 1];
    // Some rungs are paid for as well as built — a temple's, in devotion.
    // Once: a level lost to a broken wall and built back isn't paid twice.
    if (tierDef.cost && (s.paidTo ?? 0) < status.tier + 1) {
      const short = this.inventory?.missing(tierDef.cost) ?? {};
      if (Object.keys(short).length) {
        return { ok: false, reason: `Needs ${Object.entries(short).map(([id, n]) => `${n} more ${id.replace(/_/g, ' ')}`).join(' and ')} in your bag.` };
      }
      this.inventory.spend(tierDef.cost);
    }
    s.tier = status.tier + 1;
    s.paidTo = Math.max(s.paidTo ?? 0, s.tier);
    const slots = isStore(spec) ? this.storeFor(s).resize(tierDef.slots) : null;
    this.bus?.emit('structure:upgraded', { structure: s, name: tierDef.name, slots, blurb: tierDef.blurb });
    return { ok: true, name: tierDef.name, slots, blurb: tierDef.blurb };
  }

  /**
   * Levels a building up as far as what's built in it now reaches — the
   * first of the two ways to evolve (asked for directly: "if I edit the
   * building and increase the blocks needed it should evolve"). Called
   * after edits to a building open for changes. A level with a bill is paid
   * from the bag the same as pressing Evolve; one you can't pay yet waits
   * for the button. Returns how many levels it went up.
   */
  climb(id) {
    const s = this.structures.find((x) => x.id === id);
    if (!s?.valid || !hasLevels(STRUCTURES_BY_ID.get(s.type))) return 0;
    let n = 0;
    while (tierStatus(this.world, s.region, s.type, s.tier ?? 0, { credit: s.credit })?.canEvolve) {
      if (!this.evolve(id).ok) break;
      n++;
    }
    return n;
  }

  /** What Evolve took from the bag in place of building it in — see structures.js's work. */
  addCredit(id, credit) {
    const s = this.structures.find((x) => x.id === id);
    if (!s) return;
    s.credit ??= {};
    for (const [k, n] of Object.entries(credit ?? {})) s.credit[k] = (s.credit[k] ?? 0) + n;
  }

  /** Every standing storehouse, with what it is holding. */
  stores() {
    return this.structures
      .filter((s) => s.valid && isStore(STRUCTURES_BY_ID.get(s.type)))
      .map((s) => ({ structure: s, store: this.storeFor(s) }));
  }

  /**
   * Turns one item on or off for a storehouse's automatic deliveries.
   *
   * Off by default for everything: a shed accepts whatever a building hands
   * it until the player says otherwise. Excluding an item here only steers
   * `deliver()` — the player can still carry the thing in by hand, the same
   * way `putInStore` always could, because that is a choice they made on
   * purpose rather than a building doing it to them.
   */
  toggleExclude(id, itemId) {
    const s = this.structures.find((x) => x.id === id);
    if (!s) return false;
    s.excludes = s.excludes ?? [];
    const i = s.excludes.indexOf(itemId);
    if (i === -1) s.excludes.push(itemId); else s.excludes.splice(i, 1);
    this.bus?.emit('structure:excludes', { structure: s });
    return true;
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
    const storeList = this.stores();
    for (const [id, amount] of Object.entries(payload)) {
      let left = amount;
      // A shed that has excluded this item is skipped for it and only it —
      // everything else it still takes normally.
      const into = [this.inventory, ...storeList
        .filter((s) => !s.structure.excludes?.includes(id))
        .map((s) => s.store)];
      for (const where of into) {
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
      // A quarry is a hole you keep digging: locking it protects nothing.
      // A farm is soil you plant in and pick from (batch 3, #13: "You can
      // plant in the farm's tilled soil by hand") — only its crops, though.
      const spec = s && STRUCTURES_BY_ID.get(s.type);
      if (spec?.fromCrops && isCropChange(c)) continue;
      if (s && s.locked !== false && !spec?.growsWhenDug) return s;
    }
    return null;
  }

  /**
   * Digging in or against a quarry takes in the rock it opens onto: below
   * a dug floor, beyond a dug wall. Returns the quarries the digging
   * touched, grown or not, so they can level up (see climb).
   */
  growDug(changes, { inside = () => true } = {}) {
    const touched = [];
    for (const s of this.structures) {
      if (!STRUCTURES_BY_ID.get(s.type)?.growsWhenDug) continue;
      const cells = [];
      for (const c of changes) {
        if (c.next !== 0) continue;
        const r = s.region;
        const near = c.x >= r.minX - 1 && c.x <= r.maxX + 1 && c.y >= r.minY - 1 && c.y <= r.maxY + 1
          && c.z >= r.minZ - 1 && c.z <= r.maxZ + 1;
        if (!near) continue;
        cells.push(c);
        if (c.y <= r.minY) cells.push({ x: c.x, y: c.y - 1, z: c.z });
        if (c.x <= r.minX) cells.push({ x: c.x - 1, y: c.y, z: c.z });
        if (c.x >= r.maxX) cells.push({ x: c.x + 1, y: c.y, z: c.z });
        if (c.z <= r.minZ) cells.push({ x: c.x, y: c.y, z: c.z - 1 });
        if (c.z >= r.maxZ) cells.push({ x: c.x, y: c.y, z: c.z + 1 });
      }
      if (!cells.length) continue;
      this.grow(s.id, cells, { inside });
      touched.push(s);
    }
    return touched;
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
   * Charges the type's cost from the bag, all or nothing — unless `free`,
   * which a sandbox world passes so a house works the moment you build it,
   * with nothing to pay and nothing to be short of.
   */
  claim(region, typeId, { now = Date.now(), discount = 0, free = false } = {}) {
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
    if (!free) {
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
    }

    const structure = {
      id: this.nextId++,
      type: typeId,
      region: { ...region },
      valid: true,
      locked: true,
      claimedAt: now,
      lastPaidAt: now,
      brokenReason: null,
      excludes: [],
    };
    if (replaced) {
      const dead = new Set(inTheWay);
      this.structures = this.structures.filter((s) => !dead.has(s));
      for (const s of dead) this.bus?.emit('structure:removed', { structure: s });
    }
    this.structures.push(structure);
    // A storehouse claimed as a finished warehouse starts as one, rather than
    // needing an Evolve press for a rung it was already built to.
    this.retier(structure, { initial: true });
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

  /**
   * While a building is open for changes, what you place or dig right
   * against it becomes part of it (reported directly: "if I add more and
   * lock, these new added blocks do not make part of the building which is
   * weird"). The box a building was claimed with used to be fixed for good,
   * so a wall added on the outside, or a quarry dug one layer deeper, never
   * counted for anything.
   *
   * A change counts if it touches the box (one block out, on any side,
   * including above and below). The box stops growing at the building's
   * largest size, at the edge of your land (`inside`), and where it would
   * run into another building. Returns whether the box changed.
   */
  grow(id, changes, { inside = () => true } = {}) {
    const s = this.structures.find((x) => x.id === id);
    const spec = STRUCTURES_BY_ID.get(s?.type);
    if (!s || !spec || !changes?.length) return false;
    let grew = false;
    for (const c of changes) {
      const r = s.region;
      const near = c.x >= r.minX - 1 && c.x <= r.maxX + 1 && c.y >= r.minY - 1 && c.y <= r.maxY + 1
        && c.z >= r.minZ - 1 && c.z <= r.maxZ + 1;
      const within = c.x >= r.minX && c.x <= r.maxX && c.y >= r.minY && c.y <= r.maxY && c.z >= r.minZ && c.z <= r.maxZ;
      if (!near || within || !inside(c.x, c.z)) continue;
      const next = {
        minX: Math.min(r.minX, c.x), maxX: Math.max(r.maxX, c.x),
        minY: Math.min(r.minY, c.y), maxY: Math.max(r.maxY, c.y),
        minZ: Math.min(r.minZ, c.z), maxZ: Math.max(r.maxZ, c.z),
      };
      if (next.maxX - next.minX + 1 > spec.maxSize || next.maxZ - next.minZ + 1 > spec.maxSize) continue;
      if (this.overlaps(next, s.id)) continue;
      s.region = next;
      grew = true;
    }
    if (grew) this.recheck(s);
    return grew;
  }

  recheck(structure) {
    const check = validateStructure(this.world, structure.region, structure.type);
    const wasValid = structure.valid;
    structure.valid = check.ok;
    structure.brokenReason = check.ok ? null : check.reason;
    // Whatever else changed, the shelves are re-measured: this is the only
    // place a storehouse finds out it has grown or been cut back.
    this.retier(structure);

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
   *
   * `taxRate` is the share the Sky Kingdom takes (the dark path, after a
   * lost attack — see duilt/SkyWar.js): taken off each building's payout,
   * the fractions carried over so a building making one at a time still
   * pays its share. What was taken is in `this.lastTaxed`.
   */
  collect({ now = Date.now(), yieldMultiplier = 1, bonusFor = null, producesFor = null, taxRate = 0 } = {}) {
    const gained = {};
    const taxed = {};
    const stalled = [];
    const capMs = Math.min(MAX_OFFLINE_HOURS * 3600_000, MAX_OFFLINE_DAYS * REAL_DAY_SECONDS * this.dayScale * 1000);

    for (const s of this.structures) {
      if (!s.valid) continue;
      const spec = STRUCTURES_BY_ID.get(s.type);
      // A leveled building reads its current tier's own rate and cadence —
      // producesAt/intervalAt fall back to the plain spec fields for
      // everything that has no tiers at all, so this covers both.
      const tier = s.tier ?? 0;
      const everySeconds = intervalAt(spec, tier);
      // A pen's output is whatever lives in it (see duilt/Ranch.js), asked
      // for here rather than read off the spec.
      // A farm's, whatever grows in it.
      const produces = spec.fromAnimals || spec.fromCrops ? scaleProduce(producesFor?.(s) ?? {}, yieldAt(spec, tier)) : producesAt(spec, tier);
      if (!everySeconds) continue;

      const periodMs = everySeconds * 1000 * this.dayScale;
      const elapsed = Math.min(now - s.lastPaidAt, capMs);
      const cycles = Math.floor(elapsed / periodMs);
      if (cycles <= 0) continue;
      // An empty pen still lets the clock run: animals led in tomorrow are
      // owed from tomorrow, not from the day the fence went up.
      if (!Object.keys(produces).length) {
        s.lastPaidAt = now - ((now - s.lastPaidAt) % periodMs);
        continue;
      }

      // Somebody working a building is the only thing that changes what one
      // building gives against another of the same kind.
      const staffing = bonusFor ? bonusFor(s.id) : 1;
      const payload = {};
      // The Sky Kingdom's share, settled only once the rest is delivered.
      const carry = { ...(s.taxCarry ?? {}) }, took = {};
      for (const [item, per] of Object.entries(produces)) {
        // Foraging pays out here rather than at the pickaxe — see DuiltGame.yieldFor.
        let amount = Math.round(per * cycles * yieldMultiplier * staffing);
        if (amount > 0 && taxRate > 0) {
          const due = amount * taxRate + (carry[item] ?? 0);
          const take = Math.min(amount, Math.floor(due));
          carry[item] = due - take;
          if (take > 0) { took[item] = take; amount -= take; }
        }
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
      if (taxRate > 0) {
        s.taxCarry = carry;
        for (const [item, n] of Object.entries(took)) taxed[item] = (taxed[item] ?? 0) + n;
      }
      s.lastPaidAt += cycles * periodMs;
    }

    this.lastTaxed = taxed;
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
      const everySeconds = intervalAt(spec, s.tier ?? 0);
      if (!everySeconds) continue;
      const due = s.lastPaidAt + everySeconds * 1000 * this.dayScale;
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
        tier: s.tier ?? 0,
        excludes: s.excludes ?? [],
        // A farm's crops: one seed each, put in by hand (duilt/Crops.js).
        ...(s.seeds?.length ? { seeds: s.seeds } : {}),
        // A town hall's controller, not yet handed over for want of room.
        ...(s.owed ? { owed: s.owed } : {}),
        // What Evolve took from the bag instead of it being built in, and
        // the highest level paid for — see climb and evolve.
        ...(s.credit ? { credit: s.credit } : {}),
        ...(s.paidTo ? { paidTo: s.paidTo } : {}),
      })),
    };
  }

  loadJSON(data) {
    if (!data?.structures) return;
    this.structures = data.structures
      .filter((s) => STRUCTURES_BY_ID.has(s.type))
      // Saves from before buildings could be locked have no flag; locked is the
      // safe reading of a building someone claimed on purpose. Saves from
      // before routing existed have no excludes; nothing excluded is the same
      // shed they built, taking everything the way it always did.
      .map((s) => {
        const structure = { locked: true, excludes: [], ...s, store: null, brokenReason: null };
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
