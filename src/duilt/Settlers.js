import { drift } from '../world/bodies.js';
import { SETTLERS, settlerName, settlerColour, TRADE_IDS, tradeFor } from '../config/settlers.js';
import { JOB_FOR_BUILDING } from '../config/outfits.js';
import { STRUCTURES_BY_ID, makesGoods } from '../config/structures.js';
import { ITEMS, foodOrder } from '../config/items.js';
import {settlerFloor,settlerRoute,doorWise} from './settlerNavigation.js';
import {doorPart} from '../config/blocks.js';
import {isLoaded} from '../world/Mobs.js';
import { MOOD, MOOD_DAY } from '../config/mood.js'; // PLAY-13
import { isBedtime, bedsIn, bedPlace, bedKey, campfireNear, LIE_SECONDS } from './sleepSpots.js'; // VIL-1
import { newAsks, loadAsks, step as askStep, receive as askReceive } from './Asks.js'; // VIL-2
import { ITEMS_BY_ID } from '../config/items.js';
import { newMood, loadMood, step as moodStep, shouldLeave, bandRank } from './Mood.js'; // PLAY-13
import { newXp, loadXp, gain as xpGain, statsFor, buildingBonuses, attackOf, weaponId } from './Levels.js'; // VIL-4, VIL-5, VIL-6
import { DEFENCE } from '../config/levels.js';

/** Everything edible, least nourishing first — what settlers work down through. */
const FOODS = ITEMS.filter((i) => i.kind === 'food').sort(foodOrder);

/**
 * The population: who has moved in, where they sleep, and what they work on.
 *
 * One roof, one household. The first house you build is your own, so nobody
 * comes for it; every house after that brings a person, and the roster repairs
 * itself — lose somebody and the next one turns up to take the empty house.
 *
 * It used to be a bed count with a food gate and a timer, which meant the
 * answer to "why is nobody living in my four houses" was three different
 * things depending on the minute. This is a rule you can hold in your head:
 * count the houses, take one off, that is how many people there are.
 *
 * Each settler walks between their house and a building in reach, and a
 * building with somebody working it produces more. That is what finally makes
 * *where* you put a quarry matter: one on the far side of your land is one
 * nobody staffs.
 */

const centreOf = (r) => ({
  x: (r.minX + r.maxX + 1) / 2,
  z: (r.minZ + r.maxZ + 1) / 2,
});

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/**
 * A villager's health. Owner, 8 November: a round's attackers reach the
 * village "and start killing everyone"; villagers can die. Out of a fight
 * they heal back to full.
 */
export const VILLAGER_HP = 10;

/**
 * Recover the floor at spawn/load or after construction. This is not a
 * walking allowance: traversal probes from the previous feet, one step up.
 */
const FLOOR_SCAN = 4;
/** Seconds a door a villager opened stays open after they have gone through. */
const DOOR_HOLD = 1.5;

export class Settlers {
  /**
   * @param stores () => the storehouses' shelves (Inventories), which
   *               settlers eat from before they touch your bag.
   * @param garrison () => how many soldiers your barracks have trained.
   *               They live in the town too (asked for directly: "The
   *               militia created in barracks should be considered resident
   *               of the town too"): counted with everyone, and fed with
   *               everyone. They sleep in their barracks's bunks, so they
   *               take no house from a settler.
   */
  constructor({ world, structures, inventory, skills, bus, rand = Math.random, stores = null, garrison = null }) {
    this.world = world;
    this.structures = structures;
    this.inventory = inventory;
    this.stores = stores;
    this.garrison = garrison;
    this.soldiersHungry = 0;
    this.sinceRetry = 0;
    this.skills = skills;
    this.bus = bus;
    this.rand = rand;
    this.people = [];
    this.nextId = 0;
    this.sinceArrival = 0;
    this.sinceMeal = 0;
    this.emptyHouses = new Map(); // PLAY-13: houseId -> seconds left empty after somebody left angry
    this.arrivalsStopped = false; // PLAY-13: word has got round
    this.night = null; // VIL-1: () => whether it is bedtime; DuiltGame sets it
    this.dark = false; // VIL-1: the answer at the last tick
    this.threats = []; // VIL-6: raiders in the land; the game fills it each frame
    this.strike = null; // VIL-6: (foe, damage, villager) => a villager's blow, set by the game
    this.statClock = 0; // VIL-5: seconds since the buildings' bonus was last worked out
    this.bonus = null;
  }

  // ---- VIL-4, VIL-5: levels and stats ----------------------------------------

  /** { strength, intelligence } the standing buildings add, re-read about once a second. */
  buildingBonus() {
    if (!this.bonus) this.bonus = buildingBonuses(this.structures.list());
    return this.bonus;
  }

  /** A villager's level, strength, intelligence, work speed, build speed and health. */
  statsOf(p) {
    return statsFor(p?.xp, this.buildingBonus());
  }

  /** Health at most: scales with strength (VIL-6). */
  maxHp(p) {
    return this.statsOf(p).maxHp;
  }

  /** Adds experience; says so when a level is reached. */
  addXp(p, kind, n = 1) {
    const level = xpGain(p, kind, n);
    if (level) this.bus?.emit('settler:level', { settler: p, level, name: p.name });
    return level;
  }

  /** Whether `p` is at their job now: a staffed building, awake, fed and willing. */
  working(p) {
    return p.workId != null && this.jobsOpen && !this.dark && !p.hungry && !p.sleep && !p.fighting
      && !this.jobs?.controls(p) && MOOD.workBonusScale[p.band ?? 'content'] > 0;
  }

  /** The people at work get experience for the time (VIL-4). */
  workTick(dt) {
    const d = Math.min(dt, 1);
    for (const p of this.people) if (this.working(p)) this.addXp(p, 'work', d);
  }

  /** Experience for what buildings made, { structureId: items } (StructureRegistry.lastMade). */
  creditMade(made) {
    for (const [id, n] of Object.entries(made ?? {})) {
      const p = this.people.find((q) => String(q.workId) === id && !q.hungry && !this.jobs?.controls(q));
      if (p) this.addXp(p, 'item', n);
    }
  }

  get population() {
    return this.people.length;
  }

  /** Soldiers living in the town, in their barracks. */
  get soldiers() {
    return Math.max(0, this.garrison?.() ?? 0);
  }

  /** Everyone who lives here: the settlers in the houses and the soldiers in the barracks. */
  get residents() {
    return this.population + this.soldiers;
  }

  /** Roofs standing: one household each. */
  get houses() {
    return this.structures.capacity();
  }

  /**
   * How many people this settlement should have.
   *
   * The first house is yours, which is the whole of the minus one. Politics
   * adds on top — its promise is room to govern *more* than the houses hold.
   */
  get target() {
    return Math.max(0, this.houses - 1) + (this.skills?.settlerAllowance?.() ?? 0);
  }

  get hasRoom() {
    return this.population < this.target - this.emptyCount; // PLAY-13: houses left empty don't count
  }

  /**
   * Everything edible in the bag, worst first.
   *
   * Settlers are not fussy but they are not given the good stuff either: they
   * work down from the least nourishing, so the fruit goes before the
   * vegetables you were keeping for yourself.
   */
  larder(from = this.inventory) {
    return FOODS.filter((i) => from.countOf(i.id) > 0);
  }

  /**
   * Where a meal comes from: the storehouses first — that's what they're
   * for (backlog batch 3, #10: "Settlers take a little food from your
   * storehouses each day") — and only then your bag. Returns { from, food }
   * for the cheapest food in the first place that has any, or null.
   */
  nextMeal() {
    const places = [...(this.stores?.() ?? []), this.inventory];
    // A last-resort food (the acorn) only when no place has anything else.
    for (const lastResort of [false, true]) {
      for (const from of places) {
        const food = from && this.larder(from).find((i) => !!i.lastResort === lastResort);
        if (food) return { from, food };
      }
    }
    return null;
  }

  foodOnHand() {
    let n = 0;
    for (const from of [...(this.stores?.() ?? []), this.inventory]) {
      for (const i of this.larder(from)) n += from.countOf(i.id);
    }
    return n;
  }

  /** People who went without at the last meal. */
  get hungry() {
    return this.people.filter((p) => p.hungry).length + Math.min(this.soldiersHungry, this.soldiers);
  }

  /** Why nobody new is coming, in one line, or null when somebody is on the way. */
  blockedReason() {
    if (this.hasRoom) return this.arrivalsStopped ? 'Word has got round: nobody new comes while your people are unhappy' : null; // PLAY-13
    if (this.houses === 0) return 'Nowhere to live — build a house';
    if (this.houses === 1) return 'This one is yours — build another and somebody will move in';
    return 'Everyone has a roof — build another house for another household';
  }

  // ---- PLAY-13: mood ---------------------------------------------------------

  /** Houses standing empty after somebody left angry. */
  get emptyCount() {
    return this.emptyHouses.size;
  }

  /** Whether a villager has a job: a staffed building, or a Work Hall role. */
  hasJob(p) {
    if (!this.jobsOpen) return false;
    const a = this.jobs?.assignment?.(p.id);
    if (a && a.role !== 'automatic' && (this.jobs.hall?.(a.hallId) ?? true)) return true;
    return p.workId != null;
  }

  /** The main reason a villager is unhappy: 'food', 'work' or null. */
  moodReason(p) {
    if (p.hungry) return 'food';
    return this.hasJob(p) ? null : 'work';
  }

  /** Average mood, the worst band present, and who is closest to leaving. */
  moodSummary() {
    const people = this.people;
    const average = people.length ? people.reduce((n, p) => n + p.mood, 0) / people.length : null;
    let worst = null, worstPerson = null;
    for (const p of people) {
      const b = p.band ?? 'content';
      if (b === 'content') continue;
      if (!worstPerson || bandRank(b) > bandRank(worst) || (b === worst && p.mood < worstPerson.mood)) { worst = b; worstPerson = p; }
    }
    return {
      average,
      worst,
      worstPerson,
      angry: people.filter((p) => bandRank(p.band ?? 'content') >= bandRank('angry')).length,
      leaving: people.filter((p) => p.band === 'furious').length,
    };
  }

  /** Mood for everyone: rates, band changes, leaving, the arrivals pause. */
  moodTick(dt) {
    for (const [id, left] of this.emptyHouses) {
      if (left - dt <= 0) this.emptyHouses.delete(id); else this.emptyHouses.set(id, left - dt);
    }
    for (const p of [...this.people]) {
      if (!Number.isFinite(p.mood)) Object.assign(p, newMood(MOOD.legacyMood));
      const { band, from } = moodStep(p, dt, { hungry: !!p.hungry, hasJob: this.hasJob(p) });
      if (band !== from) this.bus?.emit('settler:band', { settler: p, band, from }); // PLAY-13
      if (band === 'content') p.said = null;
      else if (bandRank(band) > bandRank(from) && bandRank(band) > bandRank(p.said ?? 'content')) {
        p.said = band;
        this.bus?.emit('settler:mood', { settler: p, band, from, reason: this.moodReason(p), name: p.name });
      }
      if (shouldLeave(p)) this.leave(p, 'angry');
    }
    // Word gets round: no arrivals while the town is sour, until it mends.
    const avg = this.moodSummary().average;
    if (avg != null) {
      if (avg < MOOD.arrivals.stop) this.arrivalsStopped = true;
      else if (avg >= MOOD.arrivals.resume) this.arrivalsStopped = false;
    } else this.arrivalsStopped = false;
  }

  /** Somebody moves out. Their cargo goes back to the Work Hall; their house stands empty a while. */
  leave(p, reason = 'angry') {
    if (!this.people.includes(p)) return false;
    const cause = this.moodReason(p) ?? 'work';
    this.jobs?.dismiss?.(p.id);
    this.people = this.people.filter((q) => q !== p);
    if (reason === 'angry' && p.homeId != null) this.emptyHouses.set(p.homeId, MOOD.emptyHouseDays * MOOD_DAY);
    this.bus?.emit('settler:left', { count: 1, population: this.population, reason, cause, name: p.name, days: MOOD.emptyHouseDays });
    return true;
  }


  // ---- VIL-1: sleep ----------------------------------------------------------

  /** The centre of the town: the mean of the houses, or null. */
  townCentre() {
    const homes = this.structures.list().filter((s) => s.valid && (STRUCTURES_BY_ID.get(s.type)?.grantsCapacity ?? 0) > 0);
    if (!homes.length) return null;
    const cs = homes.map((s) => centreOf(s.region));
    return { x: cs.reduce((n, c) => n + c.x, 0) / cs.length, z: cs.reduce((n, c) => n + c.z, 0) / cs.length };
  }

  /**
   * Where `p` sleeps tonight: a free bed in their own house, then a bed in a
   * house nobody lives in, then by a campfire near the town centre, then on
   * the ground there. { kind, bedKey?, stand, lie: { x, y, z, dir } }.
   */
  sleepPlace(p) {
    const taken = new Set(this.people.filter((q) => q !== p && q.sleep?.bedKey).map((q) => q.sleep.bedKey));
    const lived = new Set(this.people.map((q) => q.homeId));
    const homes = this.structures.list().filter((s) => s.valid && (STRUCTURES_BY_ID.get(s.type)?.grantsCapacity ?? 0) > 0);
    const order = [...homes.filter((s) => s.id === p.homeId), ...homes.filter((s) => s.id !== p.homeId && !lived.has(s.id))];
    for (const h of order) {
      for (const bed of bedsIn(this.world, h.region)) {
        if (taken.has(bedKey(bed))) continue;
        const place = bedPlace(bed);
        const stand = place.stands.map((s) => ({ ...s, y: settlerFloor(this.paths, s.x, s.z, bed.y) })).find((s) => s.y != null && Math.abs(s.y - bed.y) <= 1);
        if (!stand) continue;
        return { kind: 'bed', bedKey: bedKey(bed), stand, lie: { ...place.feet, dir: place.dir } };
      }
    }
    const c = this.townCentre() ?? { x: p.x, z: p.z };
    const fire = campfireNear(this.world, c.x, p.y, c.z, 20);
    const ring = (about, from, to) => {
      for (let tries = 0; tries < 16; tries++) {
        const a = (p.id ?? 0) * 2.4 + tries * 0.9, r = from + (tries % 5) * (to - from) / 4;
        const x = about.x + Math.cos(a) * r, z = about.z + Math.sin(a) * r;
        if (this.standable(x, z)) return { x, z, a };
      }
      return null;
    };
    if (fire) {
      const at = ring({ x: fire.x + 0.5, z: fire.z + 0.5 }, 1.8, 3.2);
      if (at) return this.groundPlace('fire', at, { x: fire.x + 0.5, z: fire.z + 0.5 });
    }
    const at = ring(c, 2, 8);
    return this.groundPlace('ground', at ?? { x: p.x, z: p.z }, null);
  }

  /** Lying on the floor at `at`, feet away from `toward` (a fire) so the head is nearer it. */
  groundPlace(kind, at, toward) {
    let dx = toward ? toward.x - at.x : 0, dz = toward ? toward.z - at.z : 1;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    const y = this.groundAt(at.x, at.z);
    return { kind, stand: { x: at.x, y, z: at.z }, lie: { x: at.x - dx * 0.9, y, z: at.z - dz * 0.9, dir: { x: dx, z: dz } } };
  }

  /** Walks `p` to `to`; 'arrived', 'moving' or 'stuck'. */
  travel(p, to, dt) {
    if (p._routeFor !== to) { p._route = null; p._routeFor = to; }
    p.target = to;
    let remaining = SETTLERS.walkSpeed * Math.min(Math.max(0, dt), 0.5), planned = false;
    while (remaining > 1e-6) {
      const aim = p._route?.[0] ?? to;
      const dx = aim.x - p.x, dz = aim.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.03) {
        if (p._route?.length) { p._route.shift(); continue; }
        p.target = null; p._route = null;
        return 'arrived';
      }
      const step = Math.min(0.2, remaining, d), nx = p.x + dx / d * step, nz = p.z + dz / d * step;
      const ny = settlerFloor(this.paths, nx, nz, p.y);
      if (ny == null) {
        if (planned) return 'stuck';
        p._route = settlerRoute(this.paths, p, to); planned = true;
        if (!p._route?.length) return 'stuck';
        continue;
      }
      p.x = nx; p.z = nz; p.y = ny; remaining -= step;
      this.passDoors(p);
    }
    return 'moving';
  }

  /**
   * One step of bedtime for `p`. True while they are walking to bed or in it
   * (nothing else moves them), false in the day or when a blow has woken them.
   */
  sleepStep(p, dt, night) {
    if (!night) p.roused = false;
    if (!night || p.roused) {
      if (p.sleep) this.wake(p);
      return false;
    }
    if (!p.sleep) { p.sleep = { ...this.sleepPlace(p), state: 'walking', stuck: 0 }; p.atWork = false; }
    const s = p.sleep;
    if (s.state === 'walking') {
      if (p.kx || p.kz) drift(this.world, p, dt);
      const r = this.travel(p, s.stand, dt);
      if (r === 'stuck') s.stuck += dt; else s.stuck = 0;
      // Cannot get there: lie down where they stand.
      if (r === 'stuck' && s.stuck > 5) Object.assign(s, this.groundPlace('ground', { x: p.x, z: p.z }, null), { state: 'asleep' }), s.stand = { x: p.x, y: p.y, z: p.z };
      else if (r === 'arrived') s.state = 'asleep';
      if (s.state === 'asleep') { p.target = null; p._route = null; p.x = s.lie.x; p.y = s.lie.y; p.z = s.lie.z; p.lieDir = s.lie.dir; p.lie = 0; }
      return true;
    }
    p.lie = Math.min(1, (p.lie ?? 0) + dt / LIE_SECONDS);
    return true;
  }

  /** Up out of bed, onto their feet beside it. */
  wake(p) {
    const s = p.sleep;
    p.sleep = null; p.lie = 0; p.lieDir = null;
    if (s?.state === 'asleep' && s.stand) { p.x = s.stand.x; p.z = s.stand.z; p.y = s.stand.y; }
    p.target = null; p._route = null; p.atWork = false; p.wait = 0.5 + this.rand() * 2;
  }


  // ---- VIL-2: asks -----------------------------------------------------------

  /** Asks begin and lapse (duilt/Asks.js); the UI hears about each. */
  asksTick(dt) {
    for (const p of this.people) {
      const was = p.ask?.item;
      const event = askStep(p, dt, this.rand);
      if (event === 'asked') this.bus?.emit('settler:ask', { settler: p, item: p.ask.item, name: p.name });
      else if (event === 'lapsed') this.bus?.emit('settler:asklapsed', { settler: p, item: was, name: p.name });
    }
  }

  /**
   * Gives `p` what they asked for, from `from` (your bag). Returns
   * { ok, gain, reason }. The item is taken only when it is what they want.
   */
  give(p, itemId, from = this.inventory) {
    if (!this.people.includes(p)) return { ok: false, reason: 'That villager no longer lives here.' };
    if (!p.ask) return { ok: false, reason: `${p.name} is not asking for anything.` };
    if (p.ask.item !== itemId) return { ok: false, reason: `${p.name} wants ${ITEMS_BY_ID.get(p.ask.item)?.name ?? 'something else'}.` };
    if (!(from?.countOf(itemId) > 0)) return { ok: false, reason: `You have no ${ITEMS_BY_ID.get(itemId)?.name ?? 'such thing'}.` };
    from.remove(itemId, 1);
    const gain = askReceive(p, itemId, this.rand);
    this.keepWeapon(p, itemId, from); // VIL-6: a weapon they asked for is theirs to fight with
    if (p.band === 'content') p.said = null;
    this.bus?.emit('settler:gift', { settler: p, item: itemId, gain, name: p.name });
    return { ok: true, gain };
  }

  // ---- VIL-6: weapons and defence --------------------------------------------

  /**
   * `p` takes `itemId` as their weapon when they have none, or when it hits
   * harder and the one they had fits back in `to`. True when they did.
   */
  keepWeapon(p, itemId, to = this.inventory) {
    if (!weaponId(itemId)) return false;
    if (p.weapon) {
      const hit = (id) => attackOf(id, 10).damage;
      if (hit(itemId) <= hit(p.weapon) || !(to?.roomFor(p.weapon, 1) > 0)) return false;
      to.add(p.weapon, 1);
    }
    p.weapon = itemId;
    return true;
  }

  /**
   * Gives `p` a weapon from `from` (your bag) to fight with. One at a time:
   * a second one swaps with the first, which goes back to the bag.
   * Returns { ok, reason }.
   */
  arm(p, itemId, from = this.inventory) {
    if (!this.people.includes(p)) return { ok: false, reason: 'That villager no longer lives here.' };
    if (!weaponId(itemId)) return { ok: false, reason: `${ITEMS_BY_ID.get(itemId)?.name ?? 'That'} is not a weapon.` };
    if (!(from?.countOf(itemId) > 0)) return { ok: false, reason: `You have no ${ITEMS_BY_ID.get(itemId)?.name ?? 'such thing'}.` };
    if (p.weapon === itemId) return { ok: false, reason: `${p.name} already holds one.` };
    const old = p.weapon;
    from.remove(itemId, 1);
    if (old && from.add(old, 1)) { from.add(itemId, 1); return { ok: false, reason: 'Make room in your bag first.' }; }
    p.weapon = itemId;
    this.bus?.emit('settler:armed', { settler: p, item: itemId, name: p.name });
    return { ok: true, old };
  }

  /** Takes `p`'s weapon back into the bag. Returns { ok, reason }. */
  disarm(p, to = this.inventory) {
    if (!p?.weapon) return { ok: false, reason: `${p?.name ?? 'They'} hold nothing.` };
    if (!(to.roomFor(p.weapon, 1) > 0)) return { ok: false, reason: 'Make room in your bag first.' };
    to.add(p.weapon, 1);
    const item = p.weapon;
    p.weapon = null;
    this.bus?.emit('settler:armed', { settler: p, item: null, name: p.name });
    return { ok: true, item };
  }

  /** Whoever has no use in the fight: the one nearest `p` among `this.threats`, with its distance. */
  nearestThreat(p) {
    let foe = null, fd = Infinity;
    for (const e of this.threats ?? []) {
      if (!(e.hp > 0) || e.dead || e.done) continue;
      const d = dist(p, e);
      if (d < fd && Math.abs((e.y ?? p.y) - p.y) < 4) { fd = d; foe = e; }
    }
    return { foe, d: fd };
  }

  /**
   * VIL-6: one step of a villager's part in a raid. True while they are
   * fighting or running home (nothing else moves them).
   *
   *   armed      wakes, goes for the nearest raider within DEFENCE.alarm and
   *              strikes it with the weapon's damage scaled by strength; a
   *              bow shoots from range. Below DEFENCE.fleeBelow health they
   *              run home.
   *   unarmed    runs home, and punches only a raider already in reach.
   *   asleep     stays in bed unless armed.
   *
   * Soldiers are not villagers and keep their own rules (world/Defenders.js).
   */
  defendStep(p, dt) {
    const quiet = () => {
      if (p.fighting) { p.fighting = false; p.target = null; p._route = null; p._chase = null; p.wait = 0.5; }
      return false;
    };
    if (!this.threats?.length) return quiet();
    const { foe, d } = this.nearestThreat(p);
    if (!foe || d > DEFENCE.alarm) return quiet();
    const stats = this.statsOf(p);
    const armed = !!weaponId(p.weapon) && (p.hp ?? stats.maxHp) > stats.maxHp * DEFENCE.fleeBelow;
    if (p.sleep && !armed) return false; // in bed: a blow wakes them (hurt)
    if (p.sleep) { p.roused = true; this.wake(p); }
    p.fighting = true; p.atWork = false;
    p.cool = Math.max(0, (p.cool ?? 0) - dt);
    const hit = attackOf(armed ? p.weapon : null, stats.strength);
    const run = dt * DEFENCE.runFactor;
    const face = () => { p.facing = Math.atan2(foe.x - p.x, foe.z - p.z); };
    const blow = () => {
      p.cool = hit.every * (0.9 + this.rand() * 0.2);
      p.strike = 0.3;
      face();
      this.strike?.(foe, hit.damage, p);
    };
    if (!armed) {
      // Cornered: punch what is already in reach. Otherwise home.
      if (d <= hit.reach) { p.target = null; if (p.cool <= 0) blow(); return true; }
      p._chase ??= this.outdoorSpot(p.homeId) ?? this.placeOf(p.homeId);
      if (p._chase && dist(p, p._chase) > 1) this.travel(p, p._chase, run); else p.target = null;
      return true;
    }
    if (hit.ranged) {
      if (d <= hit.range) { p.target = null; if (p.cool <= 0) blow(); else face(); return true; }
    } else if (d <= hit.reach) { p.target = null; if (p.cool <= 0) blow(); else face(); return true; }
    const stand = hit.ranged ? hit.range * 0.8 : hit.reach * 0.7;
    const to = { x: foe.x - (foe.x - p.x) / (d || 1) * stand, z: foe.z - (foe.z - p.z) / (d || 1) * stand };
    // The same spot until the raider has moved on, so the route is not re-planned every frame.
    if (!p._chase || dist(p._chase, to) > 1.5) p._chase = to;
    this.travel(p, p._chase, run);
    return true;
  }

  // ---- arrivals ------------------------------------------------------------

  tick(dtSeconds) {
    // One at a time rather than all at once, so raising three houses reads as
    // three people arriving rather than a crowd appearing in one frame.
    this.sinceArrival += dtSeconds;
    if (this.sinceArrival >= SETTLERS.arriveEverySeconds) {
      this.sinceArrival = 0;
      if (this.hasRoom && !this.arrivalsStopped) this.arrive(); // PLAY-13
    }

    this.sinceMeal += dtSeconds;
    this.sinceRetry += dtSeconds;
    if (this.sinceMeal >= SETTLERS.eatEverySeconds) {
      this.sinceMeal = 0;
      this.sinceRetry = 0;
      this.eat();
    } else if (this.hungry && this.sinceRetry >= SETTLERS.retryHungrySeconds) {
      // Whoever went without has another go, so food put away is eaten
      // within the minute rather than at tomorrow's meal.
      this.sinceRetry = 0;
      this.eat({ onlyHungry: true });
    }

    // No Work Hall (any more): nobody works. With one, everyone's job is
    // written on them for the people view to dress them (p.job).
    const open = this.jobsOpen;
    const types = new Map(this.structures.list().map((s) => [s.id, s.type]));
    for (const p of this.people) {
      if (!open && p.workId != null) { p.workId = null; p.atWork = false; }
      const role = this.jobs?.assignment?.(p.id)?.role;
      p.job = open ? (role === 'builder' || role === 'hauler' ? role : JOB_FOR_BUILDING[types.get(p.workId)] ?? null) : null;
    }
    this.moodTick(dtSeconds); // PLAY-13
    this.asksTick(dtSeconds); // VIL-2
    for (const p of this.people) {
      const max = this.maxHp(p);
      if (!(p.hp > 0)) p.hp = max;
      else if (p.hpMax > 0 && p.hpMax !== max) p.hp *= max / p.hpMax; // VIL-5: a stronger village does not leave them looking wounded
      p.hpMax = max;
      if (p.hurt > 0) p.hurt = Math.max(0, p.hurt - dtSeconds);
      if (p.calm > 0) p.calm -= dtSeconds;
      else if (p.hp < max) p.hp = Math.min(max, p.hp + max * DEFENCE.healShare * dtSeconds);
    }
    this.statClock += dtSeconds;
    if (this.statClock >= 1) { this.statClock = 0; this.bonus = null; } // VIL-5
    this.workTick(dtSeconds); // VIL-4
    // VIL-1: at night everybody goes to bed; live work and walking stop.
    this.dark = !!this.night?.();
    for (const p of this.people) {
      if (p.strike > 0) p.strike = Math.max(0, p.strike - dtSeconds);
      if (this.defendStep(p, dtSeconds)) continue; // VIL-6
      if (!this.sleepStep(p, dtSeconds, this.dark)) this.walk(p, dtSeconds);
    }
    this.closeDoors(dtSeconds);
  }

  /** Somebody moves in, takes the emptiest house, and looks for work. */
  arrive() {
    const home = this.pickHome();
    if (!home) return null;
    const n = this.nextId++;
    // On the doorstep rather than in the middle of the house: somebody
    // arriving is worth seeing, and the middle of a claimed house is indoors.
    const at = this.outdoorSpot(home.id) ?? centreOf(home.region);
    const person = {
      id: n,
      name: settlerName(n),
      colour: settlerColour(n),
      homeId: home.id,
      workId: null,
      trade: this.nextTrade(), // WORK-3
      x: at.x, z: at.z,
      y: this.groundAt(at.x, at.z),
      target: null,
      wait: 2 + this.rand() * 4,
      atWork: false,
      // Nobody arrives hungry; the first meal after they get here decides.
      hungry: false,
      hp: VILLAGER_HP,
      hpMax: VILLAGER_HP,
      ...newXp(), // VIL-4
      weapon: null, // VIL-6
      ...newMood(), // PLAY-13
      ...newAsks(this.rand), // VIL-2
    };
    person.hp = person.hpMax = this.maxHp(person);
    this.people.push(person);
    this.assignWork(person);
    this.bus?.emit('settler:arrived', { settler: person, population: this.population });
    return person;
  }

  /**
   * A settlement eats what the farms grew.
   *
   * One food each, cheapest first. Whoever the bag runs out on goes hungry,
   * and a hungry settler spends the day looking for something to eat instead
   * of going to work — so an empty larder shows up as buildings producing what
   * they would produce with nobody in them.
   *
   * Nobody starves over it. Hunger sours mood (PLAY-13) and a villager who
   * stays Furious for a day moves out, so the houses and the larder together
   * decide who lives here.
   */
  eat({ onlyHungry = false } = {}) {
    if (!this.people.length && !this.soldiers) return 0;
    const wasHungry = this.hungry;
    let fed = 0;
    for (const p of this.people) {
      const was = p.hungry;
      if (onlyHungry && !was) { fed++; continue; }
      const meal = this.nextMeal();
      if (meal) {
        meal.from.remove(meal.food.id, SETTLERS.foodPerMeal);
        p.hungry = false;
        fed++;
      } else {
        p.hungry = true;
        // Back off work and head home — there is nothing to carry them
        // through the shift.
        if (!was) { p.target = null; p.wait = 0.5; p.atWork = true; }
      }
    }
    // The soldiers eat the same, one each, after the settlers.
    const soldiers = this.soldiers;
    const mouths = onlyHungry ? Math.min(this.soldiersHungry, soldiers) : soldiers;
    let unfed = 0;
    for (let i = 0; i < mouths; i++) {
      const meal = this.nextMeal();
      if (meal) { meal.from.remove(meal.food.id, SETTLERS.foodPerMeal); fed++; } else unfed++;
    }
    this.soldiersHungry = unfed;
    if (onlyHungry) fed += soldiers - mouths;
    const short = this.people.length + soldiers - fed;
    // Who, by name (asked for directly: "a way to alert the user a villager
    // is hungry which and a button in the notification to give it food").
    if (short > 0) this.bus?.emit('settler:hungry', { count: short, population: this.residents, names: this.people.filter((p) => p.hungry).map((p) => p.name) });
    else if (wasHungry) this.bus?.emit('settler:fed', {});
    return fed;
  }

  /**
   * The notice's Give food: whoever's hungry eats now, from the granary,
   * the storehouses or your bag, in that order (nextMeal). Returns how many
   * are still hungry after.
   */
  feedHungry() {
    if (this.hungry) this.eat({ onlyHungry: true });
    return this.hungry;
  }

  /**
   * A house with nobody in it.
   *
   * One household per house, so the search is for an empty roof rather than a
   * spare bed. With the target one below the house count, exactly one house
   * always ends up without a settler in it — yours.
   */
  pickHome() {
    const taken = new Set([...this.people.map((p) => p.homeId), ...this.emptyHouses.keys()]); // PLAY-13
    const free = this.structures.list().filter((s) => s.valid
      && (STRUCTURES_BY_ID.get(s.type)?.grantsCapacity ?? 0) > 0
      && !taken.has(s.id));
    if (free.length) return free[0];

    // Politics buys people beyond the houses; they double up in the fullest
    // house rather than not existing.
    const houses = this.structures.list().filter((s) => s.valid
      && (STRUCTURES_BY_ID.get(s.type)?.grantsCapacity ?? 0) > 0
      && !this.emptyHouses.has(s.id)); // PLAY-13
    if (!houses.length) return null;
    const count = new Map();
    for (const p of this.people) count.set(p.homeId, (count.get(p.homeId) ?? 0) + 1);
    return houses.reduce((a, b) => ((count.get(a.id) ?? 0) <= (count.get(b.id) ?? 0) ? a : b));
  }

  /**
   * The nearest producing building in reach that nobody already works.
   *
   * One worker per building: two people standing in the same quarry should not
   * double it, and spreading out is what makes a second quarry worth building.
   */
  /**
   * Whether jobs are given at all: only once a working Work Hall stands
   * (owner, 31 October: villagers get a job "only ... when the work
   * building is placed"). Before it, villagers live and walk but work nowhere.
   */
  get jobsOpen() {
    return this.structures.list().some((s) => s.type === 'work_hall' && s.valid);
  }

  /** WORK-3: the trade with the fewest people so far; ties go to the first listed. */
  nextTrade() {
    const n = (t) => this.people.filter((p) => p.trade === t).length;
    return TRADE_IDS.reduce((a, b) => (n(b) < n(a) ? b : a));
  }

  assignWork(person) {
    if (this.jobs?.controls(person)) { person.workId = null; return null; }
    if (!this.jobsOpen) { person.workId = null; return null; }
    const home = this.structures.list().find((s) => s.id === person.homeId);
    if (!home) { person.workId = null; return null; }
    const from = centreOf(home.region);
    const staffed = new Set(this.people.map((p) => p.workId).filter((v) => v != null));

    // WORK-3: a building without a worker, in their own trade first (or any
    // trade's, for a market or temple); only with none of those, any free one.
    let best = null, bestD = Infinity, bestFit = false;
    for (const s of this.structures.list()) {
      if (!s.valid || s.id === person.homeId || staffed.has(s.id)) continue;
      const spec = STRUCTURES_BY_ID.get(s.type);
      if (!makesGoods(spec)) continue;
      const d = dist(from, centreOf(s.region));
      if (d > SETTLERS.workRange) continue;
      const trade = tradeFor(s.type), fit = !trade || trade === person.trade;
      if ((fit && !bestFit) || (fit === bestFit && d < bestD)) { bestD = d; best = s; bestFit = fit; }
    }
    person.workId = best?.id ?? null;
    return best;
  }

  /**
   * Building ids with somebody actually working them.
   *
   * A hungry settler keeps their job — it is still theirs when the next
   * harvest comes in — but they are not at it today, so the building it is
   * does not get the bonus.
   */
  staffedIds() {
    // PLAY-13: an Angry or Furious worker refuses the job, so it is not staffed.
    return new Set(this.people.filter((p) => p.workId != null && !p.hungry && !this.jobs?.controls(p) && MOOD.workBonusScale[p.band ?? 'content'] > 0).map((p) => p.workId));
  }

  /** What a building's output is multiplied by, given who works it. */
  bonusFor(structureId) {
    // PLAY-13: a Grumbling worker gives half the bonus (+25% for +50%).
    const w = this.people.find((p) => p.workId === structureId && !p.hungry && !this.jobs?.controls(p));
    // VIL-4, VIL-5: a worker with more intelligence makes more in the same time.
    return w ? (1 + SETTLERS.workBonus * (MOOD.workBonusScale[w.band ?? 'content'] ?? 1)) * this.statsOf(w).workSpeed : 1;
  }

  // ---- getting about -------------------------------------------------------

  /**
   * The floor under a settler — what is there now, not what the land was.
   *
   * `surfaceHeight` is the terrain as generated and nothing updates it when
   * you build, because the rest of the game wants the original ground: it is
   * how "underground" is worked out, where trees go, and how a flat site is
   * found. Settlers want the opposite. Level a hillside, lay a floor, raise a
   * terrace — anything at all on top of the land — and standing people at the
   * recorded height puts them *inside* it, which is the whole of "I built a
   * settlement and there is nobody in it". They were there. They were under
   * the floor.
   *
   * Two rules keep the step honest, because a tree is also something standing
   * on the recorded ground and nobody wants settlers in the branches: it has
   * to be low enough to be a step up, and there has to be room to stand on
   * top. A trunk is four or five blocks with leaves right above it, so it
   * fails both, and they walk past its foot the way they always have.
   */
  groundAt(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const w = this.world;
    const base = w.surfaceHeight(ix, iz);

    if (w.isSolid(ix, base, iz)) {
      let y = base;
      while (y < base + FLOOR_SCAN && y < w.height - 2 && w.isSolid(ix, y, iz)) y++;
      const roomToStand = !w.isSolid(ix, y, iz) && !w.isSolid(ix, y + 1, iz);
      return roomToStand ? y : base;
    }

    // Nothing on it, so fall to whatever is under it: the ground itself may
    // have been dug out from beneath them.
    let y = base;
    while (y > 0 && !w.isSolid(ix, y - 1, iz)) y--;
    return y;
  }

  /** The nearest cell within 3 blocks where they fit at about their own height, or null. */
  floorBeside(p) {
    const bx=Math.floor(p.x),bz=Math.floor(p.z);
    for(let r=1;r<=3;r++) for(let dx=-r;dx<=r;dx++) for(let dz=-r;dz<=r;dz++) {
      if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
      const x=bx+dx+.5,z=bz+dz+.5,y=settlerFloor(this.paths,x,z,p.y);
      if(y!=null&&Math.abs(y-p.y)<=1)return {x,y,z};
    }
    return null;
  }

  /** Where someone saved at (x, y, z) stands now: their own floor if it is still there. */
  loadedFloor(p) {
    if (Number.isFinite(p.y) && p.y > 0) {
      // Not loaded yet (no chunk): keep the saved height; walk() settles them.
      if (!isLoaded(this.world, p.x, p.z)) return p.y;
      const floor = settlerFloor(this.paths, p.x, p.z, p.y);
      if (floor != null) return floor;
    }
    return this.groundAt(p.x, p.z);
  }

  placeOf(id) {
    const s = this.structures.list().find((v) => v.id === id);
    return s ? centreOf(s.region) : null;
  }

  regionOf(id) {
    return this.structures.list().find((v) => v.id === id)?.region ?? null;
  }

  /**
   * Somewhere to stand about that is not indoors.
   *
   * A settler with no work wandered to a point within three blocks of the
   * centre of their house — which, for a house five across, is the inside of
   * it. So somebody moved in and from the outside nothing had happened: they
   * spent three quarters of their day behind their own walls, under their own
   * roof, and the player standing in the street saw an empty village.
   *
   * They go out the front now. A ring starting clear of the building, and a
   * spot in it with ground underfoot, room to stand, and nothing overhead —
   * that last test being the whole point, because it is what tells a doorstep
   * from a back room.
   */
  outdoorSpot(structureId) {
    const region = this.regionOf(structureId);
    if (!region) return null;
    const c = centreOf(region);
    const clear = Math.max(region.maxX - region.minX, region.maxZ - region.minZ) / 2 + 1.5;
    for (let tries = 0; tries < 12; tries++) {
      const angle = this.rand() * Math.PI * 2;
      const away = clear + this.rand() * 5;
      const x = c.x + Math.cos(angle) * away;
      const z = c.z + Math.sin(angle) * away;
      if (this.standable(x, z)) return { x, z };
    }
    return null;
  }

  /** Ground underfoot and room for a person: not inside a wall or a trunk. */
  roomToStand(x, z) {
    const w = this.world;
    const ix = Math.floor(x), iz = Math.floor(z);
    if (!w.inBounds(ix, 0, iz)) return false;
    const y = this.groundAt(x, z);
    return !w.isSolid(ix, y, iz) && !w.isSolid(ix, y + 1, iz);
  }

  /** Room to stand, and open sky over it — somewhere you can be seen standing. */
  standable(x, z) {
    if (!this.roomToStand(x, z)) return false;
    const w = this.world;
    const ix = Math.floor(x), iz = Math.floor(z);
    const y = this.groundAt(x, z);
    // Anything solid overhead means this is a room, a porch or a tunnel.
    for (let above = y + 2; above < Math.min(w.height, y + 10); above++) {
      if (w.isSolid(ix, above, iz)) return false;
    }
    return true;
  }

  /**
   * Where a settler stands while working a building.
   *
   * Not its centre. The centre of a claimed forest is under the canopy and
   * quite often inside a trunk, so walking to work meant walking out of sight
   * — she would cross the field, reach the trees, and vanish. Same shape of
   * mistake as sending her to the middle of her house.
   *
   * A clearing is looked for first, and any spot with room for a person will
   * do if the wood is thick enough that there is no clearing. Failing both,
   * the edge of the claim, which is at least somewhere you can watch her from.
   */
  workSpot(structureId) {
    const region = this.regionOf(structureId);
    if (!region) return null;
    const pick = () => ({
      x: region.minX + this.rand() * (region.maxX - region.minX + 1),
      z: region.minZ + this.rand() * (region.maxZ - region.minZ + 1),
    });
    let sheltered = null;
    for (let tries = 0; tries < 16; tries++) {
      const at = pick();
      if (this.standable(at.x, at.z)) return at;
      if (!sheltered && this.roomToStand(at.x, at.z)) sheltered = at;
    }
    return sheltered ?? this.outdoorSpot(structureId) ?? centreOf(region);
  }

  /**
   * One step of a settler's day: stand a while, then walk to the other end.
   *
   * Probe from the previous foot height, taking one-block steps and routing
   * around buildings when the direct line is blocked.
   */
  walk(p, dt) {
    // Struck by a raider (Game.soldierHit): carried back a step, whatever they were at.
    if (p.kx || p.kz) drift(this.world, p, dt);
    if (this.jobs?.controls(p)) return;
    // Every tick, not only after a step. Somebody standing outside their house
    // while you lay a path under them should end up on the path, and somebody
    // whose ground you dig out should come down with it — waiting for their
    // next walk is up to a ten-second stretch of a person hanging in the air
    // or buried to the neck.
    if(!Number.isFinite(p.y)||p.y<=0)p.y=this.groundAt(p.x,p.z);
    const floor=settlerFloor(this.world,p.x,p.z,p.y);
    if(floor!=null)p.y=floor;
    else {
      const below=this.groundAt(p.x,p.z);
      let supported=false;
      for(let y=Math.floor(p.y)-1;y>=0;y--) {
        if(this.world.isSolid(Math.floor(p.x),y,Math.floor(p.z))){supported=true;break;}
      }
      // Construction may bury somebody who was resting. Recover them onto
      // that new floor, while never using this scan to climb during travel.
      const buried=p.wait>0 && this.world.isSolid(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z));
      // Buried by a wall going up round them: out to the nearest floor beside
      // it at their own height, not up onto whatever is on top (a roof).
      const beside=buried?this.floorBeside(p):null;
      if(beside){p.x=beside.x;p.z=beside.z;p.y=beside.y;}
      else if(below<p.y || !supported || buried)p.y=below;
    }

    if (p.wait > 0) {
      p.wait -= dt;
      if (p.wait > 0) return;
      if (p.workId == null) this.assignWork(p);
      // Both ends of the day are a place a person can be seen standing, not the
      // middle of a claim: the middle of a house is indoors and the middle of a
      // forest is under the canopy, so a settler walking between the two spent
      // the whole day out of sight at one end or the other.
      //
      // Hungry means not at work: they stay around home instead, which is what
      // an empty larder looks like from across the settlement.
      const work = p.hungry || this.dark || p.workId == null ? null : this.workSpot(p.workId);
      p.atWork = !p.atWork && !!work;
      p.target = p.atWork
        ? work
        : (this.outdoorSpot(p.homeId) ?? this.placeOf(p.homeId) ?? { x: p.x, z: p.z });
      return;
    }
    if (!p.target) { p.wait = 1; return; }

    if(p._routeFor!==p.target){p._route=null;p._routeFor=p.target;}
    let remaining=SETTLERS.walkSpeed*Math.min(Math.max(0,dt),.5),planned=false;
    while(remaining>1e-6) {
      const aim=p._route?.[0]??p.target;
      const dx=aim.x-p.x,dz=aim.z-p.z,d=Math.hypot(dx,dz);
      if(d<.03) {
        if(p._route?.length){p._route.shift();continue;}
        const [lo,hi]=SETTLERS.restSeconds;
        p.wait=lo+this.rand()*(hi-lo);p.target=null;p._route=null;break;
      }
      const step=Math.min(.2,remaining,d),nx=p.x+dx/d*step,nz=p.z+dz/d*step;
      const ny=settlerFloor(this.paths,nx,nz,p.y);
      if(ny==null) {
        if(planned){p.target=null;p._route=null;p.wait=2;p.atWork=false;break;}
        p._route=settlerRoute(this.paths,p,p.target);planned=true;
        if(!p._route?.length){p.target=null;p.wait=2;p.atWork=false;break;}
        continue;
      }
      p.x=nx;p.z=nz;p.y=ny;remaining-=step;
      this.passDoors(p);
    }
  }

  /** The world with shut doors as ways through: villagers open them (doorWise). */
  get paths() {
    return doorWise(this.world);
  }

  /**
   * A villager stepping into a shut door's cell opens it (`doors.open`, set
   * by Game), and it is shut again once nobody has been in it for a moment
   * (closeDoors). Without `doors` (the tests, a world with no Game) they
   * walk through as if it had opened.
   */
  passDoors(p) {
    const x=Math.floor(p.x),z=Math.floor(p.z);
    for(const y of [Math.floor(p.y),Math.floor(p.y)+1]) {
      const part=doorPart(this.world.getBlock(x,y,z));
      if(!part)continue;
      const key=`${x},${y-(part.top?1:0)},${z}`;
      this.openedDoors??=new Map();
      const held=this.openedDoors.get(key);
      if(held){held.left=DOOR_HOLD;return;}
      if(part.open)return;   // opened by somebody else: theirs to shut
      if(this.doors?.open(x,y,z)===false)return;
      this.openedDoors.set(key,{x,y,z,left:DOOR_HOLD});
      return;
    }
  }

  /** Shuts the doors villagers opened, once nobody has stood in them for DOOR_HOLD seconds. */
  closeDoors(dt) {
    if(!this.openedDoors?.size)return;
    for(const [key,d] of this.openedDoors) {
      const inside=this.people.some(p=>Math.floor(p.x)===d.x&&Math.floor(p.z)===d.z&&Math.abs(Math.floor(p.y)-d.y)<=1);
      if(inside){d.left=DOOR_HOLD;continue;}
      d.left-=dt;
      if(d.left>0)continue;
      // Someone (you) standing in it: it stays open for now.
      if(this.doors?.close(d.x,d.y,d.z)===false){d.left=DOOR_HOLD;continue;}
      this.openedDoors.delete(key);
    }
  }

  /** Drops anyone whose house is gone, and re-employs anyone whose work went. */
  revalidate() {
    const alive = new Set(this.structures.list().filter((s) => s.valid).map((s) => s.id));
    const before = this.population;
    this.people = this.people.filter((p) => alive.has(p.homeId));
    for (const id of [...this.emptyHouses.keys()]) if (!alive.has(id)) this.emptyHouses.delete(id); // PLAY-13
    // Pulling houses down can also put the settlement over its own rule — two
    // people and one house left means somebody is sleeping in your kitchen.
    // The most recent arrivals move on, newest first.
    while (this.population > this.target) this.people.pop();
    if (this.population < before) {
      // Somebody else will be along if there is room again: the next tick
      // refills towards the target. Losing a person is a gap, not a cap.
      this.sinceArrival = SETTLERS.arriveEverySeconds;
      this.bus?.emit('settler:left', { count: before - this.population, population: this.population });
    }
    for (const p of this.people) {
      if (p.workId != null && !alive.has(p.workId)) { p.workId = null; p.target = null; p.wait = 1; }
    }
  }

  /**
   * A blow on a villager (a round's attacker). True when it killed them:
   * they are gone, and their bed is free for whoever comes next.
   */
  hurt(person, hits) {
    if (!this.people.includes(person)) return false;
    person.hp = (person.hp > 0 ? person.hp : this.maxHp(person)) - hits;
    person.hurt = 0.4;
    person.calm = 8; // no healing until 8 s after the last blow
    person.roused = true; // VIL-1: a blow wakes them for the rest of the night
    if (person.sleep) this.wake(person);
    if (person.hp > 0) return false;
    this.people = this.people.filter((p) => p !== person);
    return true;
  }

  // ---- persistence ---------------------------------------------------------

  toJSON() {
    return {
      nextId: this.nextId,
      people: this.people.map((p) => ({
        id: p.id, name: p.name, colour: p.colour,
        homeId: p.homeId, workId: p.workId, trade: p.trade, hungry: !!p.hungry,
        xp: Math.round((p.xp ?? 0) * 10) / 10, weapon: p.weapon ?? null, // VIL-4, VIL-6
        x: p.sleep?.stand?.x ?? p.x, y: p.sleep?.stand?.y ?? p.y, z: p.sleep?.stand?.z ?? p.z, // VIL-1: saved on their feet, not in the bed
        mood: Math.round(p.mood * 10) / 10, idleFor: Math.round(p.idleFor ?? 0), // PLAY-13
        furiousFor: Math.round(p.furiousFor ?? 0), said: p.said ?? null, // PLAY-13
        ask: p.ask ? { item: p.ask.item, left: Math.round(p.ask.left) } : null, nextAsk: Math.round(p.nextAsk ?? 0), // VIL-2
      })),
      emptyHouses: [...this.emptyHouses].map(([id, left]) => [id, Math.round(left)]), // PLAY-13
    };
  }

  loadJSON(data) {
    if (!data?.people) return;
    // The saved height is where the ground was when the tab shut; anything
    // built under them since would leave them standing in it until their next
    // step, which can be several seconds of looking like nobody is home.
    // IMP-16, roofs: groundAt reads the column's top, which under eaves or
    // indoors is the roof. The saved floor is kept when it still holds them
    // (settlerFloor, from the saved height); only otherwise the column's top.
    this.people = data.people.map((p) => ({
      ...p, trade: TRADE_IDS.includes(p.trade) ? p.trade : null, ...loadXp(p), weapon: weaponId(p.weapon), fighting: false, ...loadMood(p), ...loadAsks(p, this.rand), y: this.loadedFloor(p), target: null, wait: 1 + this.rand() * 3, atWork: false, // PLAY-13
    }));
    // WORK-3: a save from before trades hands them out now, evenly.
    for (const p of this.people) if (!p.trade) p.trade = this.nextTrade();
    this.emptyHouses = new Map((data.emptyHouses ?? []).filter((e) => Array.isArray(e) && Number.isFinite(e[1]) && e[1] > 0)); // PLAY-13
    this.nextId = data.nextId ?? this.people.length;
    // Houses and workplaces may have been taken down while we were away.
    this.revalidate();
  }
}
