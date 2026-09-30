import { penProduce, herdToJSON } from './Ranch.js';
import { Inventory } from '../items/Inventory.js';
import { Territory } from '../world/Territory.js';
import { StructureRegistry } from '../structures/StructureRegistry.js';
import { tierStatus, validateStructure } from '../structures/validate.js';
import { Hunger } from '../survival/Hunger.js';
import { Skills } from '../progression/Skills.js';
import { Crafting } from './Crafting.js';
import { Settlers } from './Settlers.js';
import { DESIGN_FOR_STRUCTURE } from '../config/starterDesigns.js';
import { ITEM_FOR_BLOCK, ITEMS_BY_ID, ITEMS, itemName } from '../config/items.js';
import { STRUCTURES, STRUCTURES_BY_ID, structuresForAge, hasLevels, producesAt, intervalAt } from '../config/structures.js';
import { AIR } from '../config/blocks.js';
import { ageOf, FINAL_AGE } from '../config/ages.js';

/**
 * Everything that makes Duilt different from the sandbox, in one object.
 *
 * Game.js owns the world, the camera and the input; this owns the rules. Mining
 * fills a bag instead of a wallet, placing spends from it, the border says no,
 * buildings get claimed and pay out, and hunger keeps the whole chain urgent.
 *
 * `sandbox` is what Creative actually is now: the same engine, the same bag,
 * the same buildings and settlers — reported directly as wanting "basically
 * all items available… only need one of each… add it to the equipable panel
 * and use it," and structures that "just work" rather than needing claimed
 * and paid for — with the parts that make it Duilt rather than a sandbox
 * turned off one at a time: no cost to place or claim, no hunger, no border,
 * no age to advance through, no achievement/level gate on any block. Every
 * place that behaviour lives stays the single source of truth for it; this
 * only ever adds `if (this.sandbox)` at the front of it, never a second copy.
 */

const STARTING_KIT = { axe: 1, bucket: 1, fruit: 4, seeds: 6 };

export class DuiltGame {
  constructor({ world, scene, bus, age = 1, sandbox = false }) {
    this.world = world;
    this.bus = bus;
    this.sandbox = sandbox;
    // Animals kept in pens — see duilt/Ranch.js. Wild ones aren't here.
    this.herd = [];
    this.dayTime = null; // see toJSON
    this.inventory = new Inventory({ bus, endless: sandbox });
    this.territory = new Territory({ world, scene, bus, age, sandbox });
    this.structures = new StructureRegistry({ world, bus, inventory: this.inventory });
    this.hunger = new Hunger(bus);
    this.skills = new Skills(bus);
    this.crafting = new Crafting({ inventory: this.inventory, world, skills: this.skills });
    this.settlers = new Settlers({
      world, structures: this.structures, inventory: this.inventory, skills: this.skills, bus,
    });
    this.lastCollect = Date.now();
  }

  /** A first axe, a bucket, enough fruit to not starve while you learn. */
  grantStartingKit() {
    for (const [id, n] of Object.entries(STARTING_KIT)) this.inventory.add(id, n);
  }

  /**
   * One of everything — every block and every tool the game has, so there is
   * nothing left to craft or unlock. Placing never spends it (see
   * payForPlacement) and breaking never adds more (see onBlocksBroken), so a
   * single copy is genuinely all a slot ever needs to hold.
   */
  grantCreativeKit() {
    const inv = this.inventory;
    inv.grow(ITEMS.length);
    // A creative bag saved before it was endless may have lost things (eaten,
    // thrown away, worn out) or doubled some up: back to exactly one of each.
    const seen = new Set();
    inv.slots = inv.slots.map((s) => {
      if (!s || seen.has(s.id)) return null;
      seen.add(s.id);
      return { id: s.id, count: 1, wear: 0 };
    });
    for (const item of ITEMS) inv.add(item.id, 1);
    inv.changed();
  }

  get age() {
    return this.territory.age;
  }

  // ---- the border ----

  /** Whether an edit is allowed here, with something to say when it isn't. */
  canEditAt(x, z) {
    if (this.territory.contains(x, z)) return { ok: true };
    return {
      ok: false,
      reason: `That's outside your land — claim the next ring first`,
    };
  }

  // ---- mining and placing ----

  /**
   * What breaking a block gives you: exactly one, always.
   *
   * Deliberately not multiplied by Foraging. A bonus here would mean placing a
   * block for one dirt and breaking it for two — an infinite item press. The
   * skill pays out through claimed buildings instead, which is the behaviour
   * the game actually wants to encourage: claim a forest rather than strip the
   * trees by hand.
   */
  yieldFor(blockId) {
    const itemId = ITEM_FOR_BLOCK.get(blockId);
    if (!itemId) return null;
    return { itemId, amount: 1 };
  }

  /**
   * Called after blocks are broken. Fills the bag and records foraging.
   * Returns { itemId: amount } actually collected.
   */
  onBlocksBroken(changes) {
    // A sandbox bag already holds one of everything and never runs out —
    // see grantCreativeKit — so there is nothing to collect and no Foraging
    // to record either.
    if (this.sandbox) return {};
    const gained = {};
    for (const c of changes) {
      if (c.prev === AIR) continue;
      const drop = this.yieldFor(c.prev);
      if (!drop) continue;
      const leftover = this.inventory.add(drop.itemId, drop.amount);
      const stored = drop.amount - leftover;
      if (stored > 0) gained[drop.itemId] = (gained[drop.itemId] ?? 0) + stored;
      if (leftover > 0) this.bus?.emit('duilt:bagfull', { itemId: drop.itemId, lost: leftover });
    }
    const picked = Object.values(gained).reduce((a, b) => a + b, 0);
    if (picked > 0) this.skills.record('foraging', picked);
    this.hunger.exertion = 1;
    return gained;
  }

  /** An animal of yours that's gone — hunted, most likely. */
  forgetAnimal(m) {
    this.herd = this.herd.filter((a) => a !== m);
  }

  /**
   * What a hunted animal left, into the bag. Same rules as a broken block:
   * nothing in a sandbox, and anything the bag can't hold is said, not
   * silently dropped. Returns { itemId: amount } actually collected.
   */
  collect(drops) {
    if (this.sandbox) return {};
    const gained = {};
    for (const [id, n] of Object.entries(drops)) {
      const leftover = this.inventory.add(id, n);
      if (n - leftover > 0) gained[id] = n - leftover;
      if (leftover > 0) this.bus?.emit('duilt:bagfull', { itemId: id, lost: leftover });
    }
    this.hunger.exertion = 1;
    return gained;
  }

  /**
   * What placing this batch would cost: one item per block, flat.
   *
   * No skill discount here either. Placing and breaking are exact inverses, so
   * any discount on one side is free items on the other. Building pays out on
   * claiming instead, which cannot be undone for a refund.
   */
  costOf(changes) {
    const bill = {};
    for (const c of changes) {
      if (c.next === AIR) continue;
      const itemId = ITEM_FOR_BLOCK.get(c.next);
      if (!itemId) continue;
      bill[itemId] = (bill[itemId] ?? 0) + 1;
    }
    return bill;
  }

  /** Charges for a placement, all or nothing — free, and always all, in a sandbox. */
  payForPlacement(changes) {
    if (this.sandbox) return { ok: true, bill: {} };
    const bill = this.costOf(changes);
    if (!Object.keys(bill).length) return { ok: true, bill };
    if (!this.inventory.hasAll(bill)) {
      const missing = this.inventory.missing(bill);
      const parts = Object.entries(missing).map(([id, n]) => `${n} ${itemName(id).toLowerCase()}`);
      return { ok: false, reason: `You need ${parts.join(' and ')}` };
    }
    this.inventory.spend(bill);
    const placed = Object.values(bill).reduce((a, b) => a + b, 0);
    if (placed > 0) this.skills.record('building', placed);
    this.hunger.exertion = 1;
    return { ok: true, bill };
  }

  /** Gives a placement's cost back — the undo half. */
  refundPlacement(bill) {
    this.inventory.refund(bill ?? {});
  }

  // ---- claiming ----

  /** Every structure the current age offers, each with whether this region qualifies — every structure there is, in a sandbox, which has no ages to gate them behind. */
  claimOptionsFor(region) {
    const offered = this.sandbox ? STRUCTURES : structuresForAge(this.age);
    return offered.map((spec) => {
      const check = validateStructure(this.world, region, spec.id);
      const overlapping = this.structures.overlaps(region);
      const inside = this.territory.containsRegion(region);
      let ok = check.ok && !overlapping && inside;
      let reason = check.reason;
      if (!inside) reason = 'That reaches outside your land';
      else if (overlapping) reason = 'That overlaps a building you already have';
      return { id: spec.id, name: spec.name, icon: spec.icon, blurb: spec.blurb, ok, reason };
    });
  }

  claim(region, typeId) {
    if (!this.territory.containsRegion(region)) {
      return { ok: false, reason: 'That reaches outside your land' };
    }
    const result = this.structures.claim(region, typeId, {
      discount: this.skills.claimDiscount(), free: this.sandbox,
    });
    if (result.ok && !this.sandbox) {
      const spec = STRUCTURES_BY_ID.get(typeId);
      if (spec?.skill) this.skills.record(spec.skill, 5);
      this.checkAgeAdvance();
    }
    return result;
  }

  /**
   * The blocks a starter design would place at an anchor, plus its bill.
   * Returned rather than applied so the caller can run it through the same
   * charged, undoable path as any other placement.
   */
  starterPlacement(structureId, anchor) {
    const design = DESIGN_FOR_STRUCTURE.get(structureId);
    if (!design) return { ok: false, reason: 'No starter design for that.' };
    if (!this.sandbox && !this.inventory.hasAll(design.cost)) {
      const parts = Object.entries(this.inventory.missing(design.cost))
        .map(([id, n]) => `${n} more ${itemName(id).toLowerCase()}`);
      return { ok: false, reason: `Needs ${parts.join(' and ')}` };
    }
    // Resolve the design to one block per cell before charging for it. A design
    // can write the same cell twice — a leaf covering the top of a trunk, a
    // trunk standing on the soil bed under it — and billing each entry charged
    // twice for a cell the world only keeps one block in. That made the grove
    // cost four dirt and four wood more than the panel said, so collecting
    // exactly what was asked for still got you refused at the last step.
    const byCell = new Map();
    for (const b of design.blocks) byCell.set(`${b.dx},${b.dy},${b.dz}`, b);

    const changes = [];
    for (const b of byCell.values()) {
      const x = anchor.x + b.dx, y = anchor.y + b.dy, z = anchor.z + b.dz;
      if (!this.world.inBounds(x, y, z)) continue;
      if (!this.territory.contains(x, z)) return { ok: false, reason: 'It would cross your border — aim further in' };
      const prev = this.world.getBlock(x, y, z);
      if (prev === b.type) continue;
      changes.push({ x, y, z, prev, next: b.type });
    }
    if (!changes.length) return { ok: false, reason: "It's already there." };
    return { ok: true, changes, design };
  }

  // ---- the age gate ----

  /** What Age 1 asks for before the border moves. */
  /**
   * What has to be true before the border moves out.
   *
   * Read off the age list rather than written here. This used to return an
   * empty array for every age but the first, and `ageComplete` required a
   * non-empty list — so finishing Age 1 advanced you to an age that could
   * never be finished, and five of the six rings were unreachable.
   */
  ageGoals() {
    const spec = ageOf(this.age);
    return (spec.goals ?? []).map((g) => {
      const have = g.structure ? this.structures.countOf(g.structure) : 0;
      const done = g.test ? g.test(this) : have >= (g.count ?? 1);
      return {
        id: g.structure ?? g.id,
        label: g.label,
        done,
        // "Have four houses standing" is only useful alongside how many you
        // have. A single-count goal says it in the label already.
        progress: g.structure && (g.count ?? 1) > 1 ? `${Math.min(have, g.count)}/${g.count}` : null,
      };
    });
  }

  /**
   * The stations you are close enough to use.
   *
   * A workshop is a place, not a permission: the recipes it unlocks are made
   * there, which is what makes where you put it a decision.
   */
  stationsNear(position, range = 7) {
    if (!position) return [];
    const found = new Set();
    for (const s of this.structures.list()) {
      const spec = STRUCTURES_BY_ID.get(s.type);
      if (!spec?.station || !s.valid) continue;
      const r = s.region;
      const dx = Math.max(r.minX - position.x, 0, position.x - (r.maxX + 1));
      const dy = Math.max(r.minY - position.y, 0, position.y - (r.maxY + 1));
      const dz = Math.max(r.minZ - position.z, 0, position.z - (r.maxZ + 1));
      if (Math.max(dx, dy, dz) <= range) found.add(spec.station);
    }
    return [...found];
  }

  /**
   * What a storehouse is holding, as a line you can read.
   *
   * Used by the panel and by anything that wants to say how full one is
   * without walking its slots itself.
   */
  storeSummary(structure) {
    const store = this.structures.storeFor(structure);
    if (!store) return null;
    const used = store.slots.filter(Boolean).length;
    const items = store.slots.reduce((n, s) => n + (s?.count ?? 0), 0);
    const tier = tierStatus(this.world, structure.region, structure.type, structure.tier ?? 0);
    return { structure, store, used, free: store.size - used, size: store.size, items, tier };
  }

  /**
   * How a leveled building's ladder reads — a storehouse's shelves growing
   * or a quarry's face deepening are the same question here, with what each
   * level actually produces folded in for the ones that make something.
   * Null for a building with no `tiers` at all.
   */
  levelSummary(structure) {
    const spec = STRUCTURES_BY_ID.get(structure?.type);
    if (!hasLevels(spec)) return null;
    const status = tierStatus(this.world, structure.region, structure.type, structure.tier ?? 0);
    const rateOf = (tier) => {
      const produces = producesAt(spec, tier);
      return Object.keys(produces).length ? { produces, everySeconds: intervalAt(spec, tier) } : null;
    };
    return {
      ...status,
      rate: rateOf(status.tier),
      next: status.next && { ...status.next, rate: rateOf(status.tier + 1) },
    };
  }

  ageComplete() {
    const goals = this.ageGoals();
    return goals.length > 0 && goals.every((g) => g.done);
  }

  /** True once the last age's goals are met — there is nothing after this. */
  get won() {
    return this.age >= FINAL_AGE && this.ageComplete();
  }

  checkAgeAdvance() {
    // No ages to advance through in a sandbox — everything is already
    // available (see claimOptionsFor/blockAvailability), so there is nothing
    // for a goal list to be gating.
    if (this.sandbox) return null;
    if (!this.ageComplete()) return null;

    // The last age has no next ring. Finishing it finishes the game, which is
    // the one thing the border cannot express.
    if (this.age >= FINAL_AGE) {
      if (!this.finished) {
        this.finished = true;
        this.bus?.emit('duilt:won', { age: this.age, structures: this.structures.list().length });
      }
      return null;
    }

    const next = this.territory.advance();
    if (next) {
      this.bus?.emit('duilt:age', {
        age: next.age, name: next.name, size: next.size, intro: ageOf(next.age).intro,
      });
    }
    return next;
  }

  // ---- the clock ----

  tick(dtSeconds) {
    // A sandbox never gets hungry — hunger simply never ticks down from its
    // starting full value, which is also what keeps the HUD bar honest
    // without needing its own sandbox check: full is full.
    if (!this.sandbox) {
      this.hunger.tick(dtSeconds * this.skills.hungerRelief());
      this.hunger.exertion = Math.max(0, this.hunger.exertion - dtSeconds); // decays back to resting
    }

    // Production is checked on a slow cadence; it's wall-clock based, so the
    // interval only decides how promptly you're told, not how much you get.
    this.settlers.tick(dtSeconds);

    const now = Date.now();
    if (now - this.lastCollect > 5000) {
      this.lastCollect = now;
      this.structures.collect({
        now,
        yieldMultiplier: this.skills.gatherYield(),
        bonusFor: (id) => this.settlers.bonusFor(id),
        producesFor: (s) => penProduce(s, this.herd),
      });
    }
  }

  eat(itemId = null) {
    const id = itemId ?? this.hunger.bestFoodIn(this.inventory);
    if (!id) return { ok: false, reason: 'You have nothing to eat.' };
    return this.hunger.eat(this.inventory, id);
  }

  // ---- persistence ----

  toJSON() {
    return {
      inventory: this.inventory.toJSON(),
      territory: this.territory.toJSON(),
      structures: this.structures.toJSON(),
      hunger: this.hunger.toJSON(),
      skills: this.skills.toJSON(),
      settlers: this.settlers.toJSON(),
      herd: herdToJSON(this.herd),
      // The time of day, 0..1 — see render/DayCycle.js. Kept with the world
      // so night is still night when you come back to it.
      dayTime: this.dayTime,
      savedAt: Date.now(),
    };
  }

  loadJSON(data) {
    if (!data) return;
    this.inventory.loadJSON(data.inventory);
    this.territory.setAge(data.territory?.age ?? 1);
    this.structures.loadJSON(data.structures);
    this.hunger.loadJSON(data.hunger);
    this.skills.loadJSON(data.skills);
    this.settlers.loadJSON(data.settlers);
    // Plain records until Game's Mobs takes them in (Mobs.adopt) and gives
    // them legs again. A save from before ranching simply has none.
    this.herd = (data.herd ?? []).map((r) => ({ ...r }));
    this.dayTime = typeof data.dayTime === 'number' ? data.dayTime : null;
    // Pay out everything earned while the tab was shut.
    this.lastCollect = Date.now();
    return this.structures.collect({
      now: Date.now(),
      yieldMultiplier: this.skills.gatherYield(),
      producesFor: (s) => penProduce(s, this.herd),
    });
  }
}

export { ITEMS_BY_ID };
