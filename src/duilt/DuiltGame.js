import { Inventory } from '../items/Inventory.js';
import { Territory } from '../world/Territory.js';
import { StructureRegistry } from '../structures/StructureRegistry.js';
import { validateStructure } from '../structures/validate.js';
import { Hunger } from '../survival/Hunger.js';
import { Skills } from '../progression/Skills.js';
import { ITEM_FOR_BLOCK, ITEMS_BY_ID, itemName } from '../config/items.js';
import { STRUCTURES_BY_ID, structuresForAge } from '../config/structures.js';
import { AIR } from '../config/blocks.js';

/**
 * Everything that makes Duilt different from the sandbox, in one object.
 *
 * Game.js owns the world, the camera and the input; this owns the rules. Mining
 * fills a bag instead of a wallet, placing spends from it, the border says no,
 * buildings get claimed and pay out, and hunger keeps the whole chain urgent.
 *
 * Kept separate so the original sandbox keeps working untouched — old worlds
 * predate all of this and shouldn't be dragged into it.
 */

const STARTING_KIT = { axe: 1, bucket: 1, fruit: 4, seeds: 6 };

export class DuiltGame {
  constructor({ world, scene, bus, age = 1 }) {
    this.world = world;
    this.bus = bus;
    this.inventory = new Inventory({ bus });
    this.territory = new Territory({ world, scene, bus, age });
    this.structures = new StructureRegistry({ world, bus, inventory: this.inventory });
    this.hunger = new Hunger(bus);
    this.skills = new Skills(bus);
    this.lastCollect = Date.now();
  }

  /** A first axe, a bucket, enough fruit to not starve while you learn. */
  grantStartingKit() {
    for (const [id, n] of Object.entries(STARTING_KIT)) this.inventory.add(id, n);
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

  /** Charges for a placement, all or nothing. */
  payForPlacement(changes) {
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

  /** Every structure the current age offers, each with whether this region qualifies. */
  claimOptionsFor(region) {
    return structuresForAge(this.age).map((spec) => {
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
    const result = this.structures.claim(region, typeId, { discount: this.skills.claimDiscount() });
    if (result.ok) {
      const spec = STRUCTURES_BY_ID.get(typeId);
      if (spec?.skill) this.skills.record(spec.skill, 5);
      this.checkAgeAdvance();
    }
    return result;
  }

  // ---- the age gate ----

  /** What Age 1 asks for before the border moves. */
  ageGoals() {
    if (this.age !== 1) return [];
    return [
      { id: 'forest', label: 'Plant and claim a forest', done: this.structures.countOf('forest') >= 1 },
      { id: 'farm', label: 'Break ground on a farm', done: this.structures.countOf('farm') >= 1 },
      { id: 'house', label: 'Build yourself a house', done: this.structures.countOf('house') >= 1 },
    ];
  }

  ageComplete() {
    const goals = this.ageGoals();
    return goals.length > 0 && goals.every((g) => g.done);
  }

  checkAgeAdvance() {
    if (!this.ageComplete()) return null;
    const next = this.territory.advance();
    if (next) this.bus?.emit('duilt:age', { age: next.age, name: next.name, size: next.size });
    return next;
  }

  // ---- the clock ----

  tick(dtSeconds) {
    this.hunger.tick(dtSeconds * this.skills.hungerRelief());
    this.hunger.exertion = Math.max(0, this.hunger.exertion - dtSeconds); // decays back to resting

    // Production is checked on a slow cadence; it's wall-clock based, so the
    // interval only decides how promptly you're told, not how much you get.
    const now = Date.now();
    if (now - this.lastCollect > 5000) {
      this.lastCollect = now;
      this.structures.collect({ now, yieldMultiplier: this.skills.gatherYield() });
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
    // Pay out everything earned while the tab was shut.
    this.lastCollect = Date.now();
    return this.structures.collect({ now: Date.now(), yieldMultiplier: this.skills.gatherYield() });
  }
}

export { ITEMS_BY_ID };
