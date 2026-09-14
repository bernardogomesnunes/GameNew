import { Inventory } from '../items/Inventory.js';
import { Territory } from '../world/Territory.js';
import { StructureRegistry } from '../structures/StructureRegistry.js';
import { validateStructure } from '../structures/validate.js';
import { Hunger } from '../survival/Hunger.js';
import { Skills } from '../progression/Skills.js';
import { Crafting } from './Crafting.js';
import { DESIGN_FOR_STRUCTURE } from '../config/starterDesigns.js';
import { ITEM_FOR_BLOCK, ITEMS_BY_ID, itemName } from '../config/items.js';
import { STRUCTURES_BY_ID, structuresForAge } from '../config/structures.js';
import { AIR } from '../config/blocks.js';
import { ageOf, FINAL_AGE } from '../config/ages.js';

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
    this.crafting = new Crafting({ inventory: this.inventory, world, skills: this.skills });
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

  /**
   * The blocks a starter design would place at an anchor, plus its bill.
   * Returned rather than applied so the caller can run it through the same
   * charged, undoable path as any other placement.
   */
  starterPlacement(structureId, anchor) {
    const design = DESIGN_FOR_STRUCTURE.get(structureId);
    if (!design) return { ok: false, reason: 'No starter design for that.' };
    if (!this.inventory.hasAll(design.cost)) {
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

  ageComplete() {
    const goals = this.ageGoals();
    return goals.length > 0 && goals.every((g) => g.done);
  }

  /** True once the last age's goals are met — there is nothing after this. */
  get won() {
    return this.age >= FINAL_AGE && this.ageComplete();
  }

  checkAgeAdvance() {
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
