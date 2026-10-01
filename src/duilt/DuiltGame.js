import { Crops, harvestOf, cropProduce } from './Crops.js';
import { Saplings } from './Saplings.js';
import { penProduce, herdToJSON } from './Ranch.js';
import { Inventory } from '../items/Inventory.js';
import { Territory } from '../world/Territory.js';
import { StructureRegistry } from '../structures/StructureRegistry.js';
import { tierStatus, validateStructure } from '../structures/validate.js';
import { Hunger } from '../survival/Hunger.js';
import { Health } from '../survival/Health.js';
import { Skills } from '../progression/Skills.js';
import { Crafting } from './Crafting.js';
import { Settlers } from './Settlers.js';
import { DESIGN_FOR_STRUCTURE } from '../config/starterDesigns.js';
import { ITEM_FOR_BLOCK, ITEMS_BY_ID, ITEMS, itemName, isTool } from '../config/items.js';
import { STRUCTURES, STRUCTURES_BY_ID, structuresForAge, hasLevels, producesAt, intervalAt } from '../config/structures.js';
import { AIR } from '../config/blocks.js';
import { WEAR_SLOTS, HIT_CAUSES, throughArmour } from '../config/armour.js';
import { lootFor, LOOT } from './Loot.js';
import { BOOSTS, BOOST_SECONDS } from '../config/drinks.js';
import { Guardian } from '../world/Guardian.js';
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

/** How many slots a chest you make has. A chest left where you fell holds whatever you had. */
export const CHEST_SLOTS = 27;
const chestKey = (x, y, z) => `${x},${y},${z}`;

/** The leaves of every kind of tree. */
const LEAF_BLOCKS = new Set([5, 42, 44]);
/** What a broken leaf might drop besides itself, and how often. */
export const LEAF_DROPS = [['sapling', 0.1], ['fruit', 0.06]];

const STARTING_KIT = { axe: 1, bucket: 1, fruit: 4, seeds: 6, seeds_carrot: 4, seeds_potato: 4 };

export class DuiltGame {
  constructor({ world, scene, bus, age = 1, sandbox = false }) {
    this.world = world;
    this.bus = bus;
    this.sandbox = sandbox;
    // Animals kept in pens — see duilt/Ranch.js. Wild ones aren't here.
    this.herd = [];
    this.dayTime = null; // see toJSON
    // Designs you placed that didn't count yet — see waitFor.
    this.waiting = [];
    // What's planted where, and when — see duilt/Crops.js.
    this.crops = new Crops();
    // Saplings, and the world's own count of days for them to grow by: it
    // only runs while you play (Game adds each day as the clock turns).
    this.saplings = new Saplings();
    this.days = 0;
    // What a broken leaf drops besides itself: Math.random, unless a test
    // wants it to be sure.
    this.rand = Math.random;
    this.inventory = new Inventory({ bus, endless: sandbox });
    this.territory = new Territory({ world, scene, bus, age, sandbox });
    this.structures = new StructureRegistry({ world, bus, inventory: this.inventory });
    this.hunger = new Hunger(bus);
    // Ten hearts — see survival/Health.js. A sandbox never takes damage.
    this.health = new Health(bus);
    // What's in each chest in the world, by where it stands — see chestAt.
    this.chests = new Map(); // "x,y,z" -> { inventory, grave }
    // What you're wearing — see wear(). Each slot { id, wear } or null.
    this.worn = Object.fromEntries(WEAR_SLOTS.map((k) => [k, null]));
    this.skills = new Skills(bus);
    // Which ring you forged, if any: 'white' or 'black' — for good (Phase 7c).
    this.ring = null;
    // What your Sanctuary called to you, once it's raised (Phase 7d).
    this.guardian = null;
    // The painting you wake by after a fall, if you chose one (playtest, P1).
    this.spawn = null;
    // Drinks going (playtest, P5): { haste | strength | speed: seconds left }.
    this.boosts = {};
    this.crafting = new Crafting({
      inventory: this.inventory, world, skills: this.skills,
      locked: (r) => (r.ring && this.ring && this.ring !== r.ring ? `You forged the ${this.ring === 'white' ? 'White' : 'Black'} Ring — the other is closed to you` : null),
      onMade: (r) => {
        if (r.ring && !this.ring) {
          this.ring = r.ring;
          this.bus?.emit('ring:forged', { ring: r.ring });
        }
      },
    });
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
      // A crop gives its harvest, not just itself back.
      const harvest = harvestOf(c.prev);
      if (harvest) {
        for (const [id, n] of Object.entries(harvest)) {
          const left = this.inventory.add(id, n);
          if (n - left > 0) gained[id] = (gained[id] ?? 0) + n - left;
          if (left > 0) this.bus?.emit('duilt:bagfull', { itemId: id, lost: left });
        }
        continue;
      }
      // Leaves, now and then, drop a sapling or a fruit as well as
      // themselves — the only way to new saplings out in the wild, now none
      // grow there by themselves (playtest, P8).
      if (LEAF_BLOCKS.has(c.prev)) {
        for (const [id, chance] of LEAF_DROPS) {
          if (this.rand() >= chance) continue;
          if (this.inventory.add(id, 1) === 0) gained[id] = (gained[id] ?? 0) + 1;
        }
      }
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
      const wrongGod = this.ringRefuses(spec);
      let ok = check.ok && !overlapping && inside && !wrongGod;
      let reason = check.reason;
      if (wrongGod) reason = wrongGod;
      else if (!inside) reason = 'That reaches outside your land';
      else if (overlapping) reason = 'That overlaps a building you already have';
      return { id: spec.id, name: spec.name, icon: spec.icon, blurb: spec.blurb, ok, reason };
    });
  }

  /** The guardian of `ring`, standing in the middle of its Sanctuary. */
  summonGuardian(ring, region) {
    const home = {
      x: (region.minX + region.maxX + 1) / 2, y: region.minY + 1, z: (region.minZ + region.maxZ + 1) / 2,
    };
    this.guardian = new Guardian({ world: this.world, ring, home });
    this.bus?.emit('guardian:summoned', { guardian: this.guardian });
    return this.guardian;
  }

  /**
   * Why a building can't be yours because of the ring you forged — a
   * Sanctuary only rises for its own god's bearer (Phase 7d) — or null.
   */
  ringRefuses(spec) {
    if (!spec?.ring || this.sandbox) return null;
    const god = spec.ring === 'white' ? 'White' : 'Black';
    if (!this.ring) return `Only the bearer of the ${god} Ring can raise this — forge one at the High Temple`;
    if (this.ring !== spec.ring) return `You bear the ${this.ring === 'white' ? 'White' : 'Black'} Ring — the ${god} Sanctuary is not for you`;
    return null;
  }

  claim(region, typeId) {
    const wrongGod = this.ringRefuses(STRUCTURES_BY_ID.get(typeId));
    if (wrongGod) return { ok: false, reason: wrongGod };
    if (!this.territory.containsRegion(region)) {
      return { ok: false, reason: 'That reaches outside your land' };
    }
    const result = this.structures.claim(region, typeId, {
      discount: this.skills.claimDiscount(), free: this.sandbox,
    });
    // Raising your god's Sanctuary calls its guardian to you (Phase 7d).
    const raised = STRUCTURES_BY_ID.get(typeId);
    if (result.ok && raised?.ring && !this.guardian) this.summonGuardian(raised.ring, region);
    if (result.ok && !this.sandbox) {
      const spec = STRUCTURES_BY_ID.get(typeId);
      if (spec?.skill) this.skills.record(spec.skill, 5);
      this.checkAgeAdvance();
    }
    return result;
  }

  // ---- designs waiting to count ----

  /**
   * A design you put down that wasn't a building yet — a granary with no
   * fields near it, a market out on its own. Reported directly: some
   * buildings "do not have a tap to see the pop up". They'd been refused
   * with one toast, lost among the achievements, and were loose blocks from
   * then on with nothing to say why. Now the game remembers what each one is
   * meant to be, says what it's waiting for when you look at it, and claims
   * it by itself the moment it qualifies (see retryWaiting).
   */
  waitFor(region, type, reason) {
    this.waiting = this.waiting.filter((w) => !overlaps(w.region, region));
    this.waiting.push({ region: { ...region }, type, reason });
  }

  /** The waiting design at a block, or null. */
  waitingAt(x, y, z) {
    return this.waiting.find((w) => inRegion(w.region, x, y, z)) ?? null;
  }

  /**
   * Tries again every waiting design an edit came near — the fields dug next
   * to a granary, the house put up beside a market. Returns the ones that
   * count now.
   */
  retryWaiting(changes = null) {
    const claimed = [];
    for (const w of [...this.waiting]) {
      const near = !changes || changes.some((c) => inRegion(grow(w.region, 18), c.x, c.y, c.z));
      if (!near) continue;
      // Claimed some other way in the meantime — by hand, say.
      if (this.structures.list().some((s) => overlaps(s.region, w.region))) {
        this.waiting = this.waiting.filter((x) => x !== w);
        continue;
      }
      const r = this.claim(w.region, w.type);
      if (r.ok) {
        this.waiting = this.waiting.filter((x) => x !== w);
        claimed.push({ ...w, reason: r.reason });
      } else {
        w.reason = r.reason;
      }
    }
    return claimed;
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
      if (Math.max(dx, dy, dz) <= range) {
        found.add(spec.station);
        // And how far it's built up, for recipes that ask a level of it.
        for (let t = 0; t <= (s.tier ?? 0); t++) found.add(`${spec.station}@${t}`);
      }
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
    if (structure?.chest) {
      const { x, y, z } = structure.chest;
      const chest = this.chestAt(x, y, z);
      const store = chest.inventory;
      const used = store.slots.filter(Boolean).length;
      const items = store.slots.reduce((n, s) => n + (s?.count ?? 0), 0);
      return {
        structure: null, chest: true, grave: chest.grave, found: chest.found ? LOOT[chest.found]?.name : null, store, used, free: store.size - used, size: store.size, items,
        tier: { name: chest.grave ? 'In the chest' : 'Chest' },
      };
    }
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

  tick(dtSeconds, { resting = false } = {}) {
    // A sandbox never gets hungry — hunger simply never ticks down from its
    // starting full value, which is also what keeps the HUD bar honest
    // without needing its own sandbox check: full is full.
    if (!this.sandbox) {
      this.hunger.tick(dtSeconds * this.skills.hungerRelief());
      this.hunger.exertion = Math.max(0, this.hunger.exertion - dtSeconds); // decays back to resting
      // Heals while you're fed, faster resting in a house.
      this.health.tick(dtSeconds, { hungerRatio: this.hunger.ratio, resting });
    }

    // Drinks wear off.
    for (const name of Object.keys(this.boosts)) {
      this.boosts[name] -= dtSeconds;
      if (this.boosts[name] <= 0) {
        delete this.boosts[name];
        this.bus?.emit('duilt:boostEnded', { boost: name });
      }
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
        producesFor: (s) => this.producesFor(s),
      });
    }
  }

  /** What a building makes that depends on what's in it: a pen's animals, a farm's crops. */
  producesFor(s) {
    const spec = STRUCTURES_BY_ID.get(s.type);
    if (spec?.fromCrops) return cropProduce(s, this.world);
    return penProduce(s, this.herd);
  }

  // ---- health ----

  /**
   * Hurts you, unless this is a sandbox — nothing hurts in Creative. Returns
   * what was taken, in half-hearts.
   */
  hurt(amount, cause, opts) {
    if (this.sandbox) return 0;
    if (HIT_CAUSES.has(cause)) amount = this.absorb(amount);
    return this.health.hurt(amount, cause, opts);
  }

  // ---- armour (Phase 7b) ----

  /** How many points of armour you have on. */
  armour() {
    let n = 0;
    for (const k of WEAR_SLOTS) n += ITEMS_BY_ID.get(this.worn[k]?.id)?.armour ?? 0;
    return n;
  }

  /**
   * A blow, through what you're wearing: smaller by your armour, and every
   * piece that took it a little more worn. A piece worn through falls apart.
   */
  absorb(amount) {
    const points = this.armour();
    if (!points) return amount;
    for (const k of WEAR_SLOTS) {
      const piece = this.worn[k];
      const spec = ITEMS_BY_ID.get(piece?.id);
      if (!spec?.armour) continue;
      piece.wear += 1;
      if (piece.wear >= spec.durability) {
        this.worn[k] = null;
        this.bus?.emit('toast', { kind: 'xp', title: `${spec.name} fell apart`, body: 'Worn through — make another' });
      }
    }
    this.inventory.changed();
    return throughArmour(amount, points);
  }

  /**
   * Puts on what's in bag slot `index`, if it's something you wear. What was
   * already in that place comes off into the same slot, so it's a swap.
   */
  wear(index) {
    const inv = this.inventory;
    const s = inv.slots[index];
    const spec = ITEMS_BY_ID.get(s?.id);
    if (!spec?.wears) return { ok: false, reason: s ? `You can't wear ${spec?.name?.toLowerCase() ?? 'that'}.` : 'Nothing there.' };
    const was = this.worn[spec.wears];
    this.worn[spec.wears] = { id: s.id, wear: s.wear ?? 0 };
    inv.slots[index] = was ? { id: was.id, count: 1, wear: was.wear } : null;
    inv.changed();
    return { ok: true, slot: spec.wears, swapped: was?.id ?? null };
  }

  /** Takes off what's worn in `slot`, into the bag — if there's room for it. */
  takeOff(slot) {
    const piece = this.worn[slot];
    if (!piece) return { ok: false, reason: 'Nothing on there.' };
    if (this.inventory.add(piece.id, 1, { wear: piece.wear }) > 0) return { ok: false, reason: 'No room in your bag.' };
    this.worn[slot] = null;
    this.inventory.changed();
    return { ok: true, id: piece.id };
  }

  /**
   * Who you'd pass for: a full set of one realm's armour (head, body and
   * legs) lets you walk among its people — see config/armour.js.
   */
  disguisedAs() {
    const realms = ['head', 'body', 'legs'].map((k) => ITEMS_BY_ID.get(this.worn[k]?.id)?.disguise ?? null);
    return realms[0] && realms.every((r) => r === realms[0]) ? realms[0] : null;
  }

  // ---- chests ----

  /**
   * A chest you found — one the world put there, never opened, with no
   * record of its own yet — filled with what it holds (see Loot.js). Does
   * nothing for a chest already opened or one you made. Returns what was in
   * it, or null.
   */
  unpackFound(x, y, z, kind, seed) {
    if (this.chests.has(chestKey(x, y, z))) return null;
    const chest = this.chestAt(x, y, z);
    const loot = lootFor(kind, x, y, z, seed);
    for (const [id, n] of Object.entries(loot)) chest.inventory.add(id, n);
    chest.found = LOOT[kind] ? kind : 'cave';
    return loot;
  }

  /**
   * The chest standing at (x, y, z) — its slots and whether it's the one
   * left where you fell — or null. A chest block with nothing recorded (put
   * down before chests had slots, or brought in some other way) gets its
   * slots on first asking, so every chest in the world opens.
   */
  chestAt(x, y, z, { create = true } = {}) {
    const key = chestKey(x, y, z);
    let chest = this.chests.get(key);
    if (!chest && create) {
      chest = { inventory: new Inventory({ slots: CHEST_SLOTS, bus: this.bus }), grave: false };
      this.chests.set(key, chest);
    }
    return chest ?? null;
  }

  /** Whether the chest at (x, y, z) has nothing in it — the rule for breaking one. */
  chestEmpty(x, y, z) {
    const chest = this.chests.get(chestKey(x, y, z));
    return !chest || chest.inventory.slots.every((s) => !s);
  }

  /** Forgets a chest that's been taken away. */
  removeChest(x, y, z) {
    this.chests.delete(chestKey(x, y, z));
  }

  /**
   * Death: everything you carry goes into a new chest at (x, y, z) —
   * requested directly, "when we die the chest appears in place with my
   * items" — except your tools, which stay with you so you can walk back
   * and dig for it. Returns how many things went in, or 0 when there was
   * nothing to leave (and no chest is made).
   */
  leaveGrave(x, y, z) {
    const bag = this.inventory.slots;
    const kept = [];
    for (let i = 0; i < bag.length; i++) if (bag[i] && !isTool(bag[i].id)) kept.push(i);
    if (!kept.length || this.inventory.endless) return 0;
    const grave = new Inventory({ slots: Math.max(CHEST_SLOTS, kept.length), bus: this.bus });
    let n = 0;
    kept.forEach((i, j) => {
      grave.slots[j] = { ...bag[i] };
      n += bag[i].count;
      bag[i] = null;
    });
    this.chests.set(chestKey(x, y, z), { inventory: grave, grave: true });
    this.inventory.changed();
    grave.changed();
    return n;
  }

  /**
   * The slots behind whatever the store screen has open: a storehouse's
   * shelves, or a chest (`{ chest: { x, y, z } }`).
   */
  containerFor(target) {
    if (target?.chest) {
      const { x, y, z } = target.chest;
      return this.chestAt(x, y, z)?.inventory ?? null;
    }
    return this.structures.storeFor(target);
  }

  /**
   * Drinks holy water (anything that `heals`: hearts back, now), or a beer,
   * a kombucha or a coffee (anything with a `boost`: better at something
   * for a few minutes — drinking another tops its time up, not doubles it).
   */
  drink(itemId) {
    const spec = ITEMS_BY_ID.get(itemId);
    if (!spec?.heals && !spec?.boost) return { ok: false, reason: `You can't drink ${spec?.name?.toLowerCase() ?? 'that'}.` };
    if (!this.inventory.has(itemId, 1)) return { ok: false, reason: 'You have none of that.' };
    if (spec.boost) {
      this.inventory.remove(itemId, 1);
      this.boosts[spec.boost] = BOOST_SECONDS;
      return { ok: true, boost: spec.boost, seconds: BOOST_SECONDS };
    }
    if (this.health.value >= 20) return { ok: false, reason: 'You are not hurt.' };
    this.inventory.remove(itemId, 1);
    return { ok: true, healed: this.health.heal(spec.heals) };
  }

  /** Whether a drink's boost is going: 'haste', 'strength' or 'speed'. */
  boosted(name) {
    return (this.boosts[name] ?? 0) > 0;
  }

  /** The ring you're wearing, if any: 'white' or 'black' — its effects only count while it's on. */
  ringWorn() {
    return ITEMS_BY_ID.get(this.worn.ring?.id)?.ring ?? null;
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
      health: this.health.toJSON(),
      worn: this.worn,
      ring: this.ring,
      guardian: this.guardian?.toJSON() ?? null,
      spawn: this.spawn,
      boosts: { ...this.boosts },
      chests: [...this.chests].map(([key, c]) => ({ key, grave: c.grave || undefined, found: c.found, ...c.inventory.toJSON() })),
      skills: this.skills.toJSON(),
      settlers: this.settlers.toJSON(),
      herd: herdToJSON(this.herd),
      // The time of day, 0..1 — see render/DayCycle.js. Kept with the world
      // so night is still night when you come back to it.
      dayTime: this.dayTime,
      waiting: this.waiting,
      crops: this.crops.toJSON(),
      saplings: this.saplings.toJSON(),
      days: this.days,
      savedAt: Date.now(),
    };
  }

  loadJSON(data) {
    if (!data) return;
    this.inventory.loadJSON(data.inventory);
    this.territory.setAge(data.territory?.age ?? 1);
    this.structures.loadJSON(data.structures);
    this.hunger.loadJSON(data.hunger);
    this.health.loadJSON(data.health);
    this.ring = data.ring === 'white' || data.ring === 'black' ? data.ring : null;
    const sp = data.spawn;
    this.spawn = sp && [sp.x, sp.y, sp.z].every(Number.isFinite) ? { x: sp.x, y: sp.y, z: sp.z } : null;
    this.boosts = {};
    for (const [name, left] of Object.entries(data.boosts ?? {})) if (BOOSTS[name] && Number.isFinite(left) && left > 0) this.boosts[name] = left;
    const gd = data.guardian;
    this.guardian = gd && (gd.ring === 'white' || gd.ring === 'black') && gd.home
      ? new Guardian({ world: this.world, ring: gd.ring, home: gd.home, state: gd })
      : null;
    for (const k of WEAR_SLOTS) {
      const w = data.worn?.[k];
      this.worn[k] = w && ITEMS_BY_ID.get(w.id)?.wears === k ? { id: w.id, wear: Number(w.wear) || 0 } : null;
    }
    this.chests.clear();
    for (const c of Array.isArray(data.chests) ? data.chests : []) {
      if (typeof c?.key !== 'string') continue;
      const inventory = new Inventory({ slots: Math.max(CHEST_SLOTS, c.slots?.length ?? 0), bus: this.bus });
      inventory.loadJSON(c);
      this.chests.set(c.key, { inventory, grave: !!c.grave, ...(c.found ? { found: c.found } : {}) });
    }
    this.skills.loadJSON(data.skills);
    this.settlers.loadJSON(data.settlers);
    // Plain records until Game's Mobs takes them in (Mobs.adopt) and gives
    // them legs again. A save from before ranching simply has none.
    this.herd = (data.herd ?? []).map((r) => ({ ...r }));
    this.dayTime = typeof data.dayTime === 'number' ? data.dayTime : null;
    this.waiting = Array.isArray(data.waiting) ? data.waiting.filter((w) => w?.region && w.type) : [];
    this.crops.loadJSON(data.crops);
    this.saplings.loadJSON(data.saplings);
    this.days = Number.isFinite(data.days) ? data.days : 0;
    // Pay out everything earned while the tab was shut.
    this.lastCollect = Date.now();
    return this.structures.collect({
      now: Date.now(),
      yieldMultiplier: this.skills.gatherYield(),
      producesFor: (s) => this.producesFor(s),
    });
  }
}

export { ITEMS_BY_ID };

function inRegion(r, x, y, z) {
  return x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY && z >= r.minZ && z <= r.maxZ;
}

function overlaps(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

function grow(r, by) {
  return { minX: r.minX - by, maxX: r.maxX + by, minY: r.minY - by, maxY: r.maxY + by, minZ: r.minZ - by, maxZ: r.maxZ + by };
}
