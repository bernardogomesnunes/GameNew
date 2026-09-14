import { SETTLERS, settlerName, settlerColour } from '../config/settlers.js';
import { STRUCTURES_BY_ID } from '../config/structures.js';

/**
 * The population: who has moved in, where they sleep, and what they work on.
 *
 * Arrivals are gated by two things the player controls. Housing says how many
 * beds there are, and food in the bag says whether the place can feed another
 * mouth — so a town grows when you build and when you farm, and stops on its
 * own when you do neither. Nothing here needs managing.
 *
 * Each settler walks between their house and a building in reach, and a
 * building with somebody working it produces more. That is the whole loop, and
 * it is what finally makes *where* you put a quarry matter: one on the far side
 * of your land is one nobody staffs.
 */

const centreOf = (r) => ({
  x: (r.minX + r.maxX + 1) / 2,
  z: (r.minZ + r.maxZ + 1) / 2,
});

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Settlers {
  constructor({ world, structures, inventory, skills, bus, rand = Math.random }) {
    this.world = world;
    this.structures = structures;
    this.inventory = inventory;
    this.skills = skills;
    this.bus = bus;
    this.rand = rand;
    this.people = [];
    this.nextId = 0;
    this.sinceArrival = 0;
    this.sinceMeal = 0;
  }

  get population() {
    return this.people.length;
  }

  /** Beds available: what the houses grant, plus what Politics allows. */
  get capacity() {
    return this.structures.capacity() + (this.skills?.settlerAllowance?.() ?? 0);
  }

  get hasRoom() {
    return this.population < this.capacity;
  }

  /** Food enough to take another mouth on. */
  get canFeed() {
    return this.foodOnHand() >= (this.population + 1) * SETTLERS.foodPerSettler;
  }

  foodOnHand() {
    return this.inventory.countOf('vegetables') + this.inventory.countOf('fruit');
  }

  /** Why nobody new is coming, in one line, or null when somebody is. */
  blockedReason() {
    if (!this.hasRoom) {
      return this.capacity === 0
        ? 'Nowhere to sleep — build a house'
        : 'Every bed is taken — build another house';
    }
    if (!this.canFeed) return 'Not enough food put by to feed anyone else';
    return null;
  }

  // ---- arrivals ------------------------------------------------------------

  tick(dtSeconds) {
    this.sinceArrival += dtSeconds;
    if (this.sinceArrival >= SETTLERS.arriveEverySeconds) {
      this.sinceArrival = 0;
      if (this.hasRoom && this.canFeed) this.arrive();
    }

    this.sinceMeal += dtSeconds;
    if (this.sinceMeal >= SETTLERS.eatEverySeconds) {
      this.sinceMeal = 0;
      this.eat();
    }

    for (const p of this.people) this.walk(p, dtSeconds);
  }

  /** Somebody moves in, takes the emptiest house, and looks for work. */
  arrive() {
    const home = this.pickHome();
    if (!home) return null;
    const n = this.nextId++;
    const at = centreOf(home.region);
    const person = {
      id: n,
      name: settlerName(n),
      colour: settlerColour(n),
      homeId: home.id,
      workId: null,
      x: at.x, z: at.z,
      y: this.groundAt(at.x, at.z),
      target: null,
      wait: 2 + this.rand() * 4,
      atWork: false,
    };
    this.people.push(person);
    this.assignWork(person);
    this.bus?.emit('settler:arrived', { settler: person, population: this.population });
    return person;
  }

  /** A settlement eats. Running out does not kill anyone, it stops growth. */
  eat() {
    if (!this.people.length) return 0;
    let want = this.people.length;
    for (const id of ['vegetables', 'fruit']) {
      if (want <= 0) break;
      const have = this.inventory.countOf(id);
      const take = Math.min(have, want);
      if (take > 0) { this.inventory.remove(id, take); want -= take; }
    }
    return this.people.length - want;
  }

  /**
   * The house with the most beds still free, or failing that the emptiest one.
   *
   * The fallback is what the Politics skill buys. It promises "room to govern
   * N more settlers", and if a free bed were the only way in it would promise
   * nothing — those people live in the houses that are already there, which is
   * what a skill about governing rather than building should mean.
   */
  pickHome() {
    const taken = new Map();
    for (const p of this.people) taken.set(p.homeId, (taken.get(p.homeId) ?? 0) + 1);
    let best = null, bestFree = 0;
    let fallback = null, fewest = Infinity;

    for (const s of this.structures.list()) {
      if (!s.valid) continue;
      const beds = STRUCTURES_BY_ID.get(s.type)?.grantsCapacity ?? 0;
      if (!beds) continue;
      const living = taken.get(s.id) ?? 0;
      const free = beds - living;
      if (free > bestFree) { bestFree = free; best = s; }
      if (living < fewest) { fewest = living; fallback = s; }
    }
    return best ?? fallback;
  }

  /**
   * The nearest producing building in reach that nobody already works.
   *
   * One worker per building: two people standing in the same quarry should not
   * double it, and spreading out is what makes a second quarry worth building.
   */
  assignWork(person) {
    const home = this.structures.list().find((s) => s.id === person.homeId);
    if (!home) { person.workId = null; return null; }
    const from = centreOf(home.region);
    const staffed = new Set(this.people.map((p) => p.workId).filter((v) => v != null));

    let best = null, bestD = Infinity;
    for (const s of this.structures.list()) {
      if (!s.valid || s.id === person.homeId || staffed.has(s.id)) continue;
      const spec = STRUCTURES_BY_ID.get(s.type);
      if (!spec?.everySeconds || !spec.produces || !Object.keys(spec.produces).length) continue;
      const d = dist(from, centreOf(s.region));
      if (d <= SETTLERS.workRange && d < bestD) { bestD = d; best = s; }
    }
    person.workId = best?.id ?? null;
    return best;
  }

  /** Building ids with somebody working them. */
  staffedIds() {
    return new Set(this.people.filter((p) => p.workId != null).map((p) => p.workId));
  }

  /** What a building's output is multiplied by, given who works it. */
  bonusFor(structureId) {
    return this.staffedIds().has(structureId) ? 1 + SETTLERS.workBonus : 1;
  }

  // ---- getting about -------------------------------------------------------

  groundAt(x, z) {
    return this.world.surfaceHeight(Math.floor(x), Math.floor(z));
  }

  placeOf(id) {
    const s = this.structures.list().find((v) => v.id === id);
    return s ? centreOf(s.region) : null;
  }

  /**
   * One step of a settler's day: stand a while, then walk to the other end.
   *
   * No pathfinding. They are crossing their own settlement, which is land the
   * player has been levelling and building on, and a walker that gets stuck on
   * a boulder looks far worse than one that steps over it — so they follow the
   * ground height rather than colliding with it.
   */
  walk(p, dt) {
    if (p.wait > 0) {
      p.wait -= dt;
      if (p.wait > 0) return;
      const home = this.placeOf(p.homeId);
      if (p.workId == null) this.assignWork(p);
      const work = this.placeOf(p.workId);
      // Nowhere to go: wander a few blocks from home rather than stand still.
      p.atWork = !p.atWork && !!work;
      p.target = p.atWork ? work : (home ?? { x: p.x, z: p.z });
      if (!p.target) p.target = { x: p.x, z: p.z };
      if (!work && home) {
        p.target = { x: home.x + (this.rand() - 0.5) * 6, z: home.z + (this.rand() - 0.5) * 6 };
      }
      return;
    }
    if (!p.target) { p.wait = 1; return; }

    const dx = p.target.x - p.x, dz = p.target.z - p.z;
    const d = Math.hypot(dx, dz);
    const step = SETTLERS.walkSpeed * dt;
    if (d <= step) {
      p.x = p.target.x; p.z = p.target.z;
      const [lo, hi] = SETTLERS.restSeconds;
      p.wait = lo + this.rand() * (hi - lo);
      p.target = null;
    } else {
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
    }
    p.y = this.groundAt(p.x, p.z);
  }

  /** Drops anyone whose house is gone, and re-employs anyone whose work went. */
  revalidate() {
    const alive = new Set(this.structures.list().filter((s) => s.valid).map((s) => s.id));
    const homeless = this.people.filter((p) => !alive.has(p.homeId));
    if (homeless.length) {
      this.people = this.people.filter((p) => alive.has(p.homeId));
      this.bus?.emit('settler:left', { count: homeless.length, population: this.population });
    }
    for (const p of this.people) {
      if (p.workId != null && !alive.has(p.workId)) { p.workId = null; p.target = null; p.wait = 1; }
    }
  }

  // ---- persistence ---------------------------------------------------------

  toJSON() {
    return {
      nextId: this.nextId,
      people: this.people.map((p) => ({
        id: p.id, name: p.name, colour: p.colour,
        homeId: p.homeId, workId: p.workId,
        x: p.x, y: p.y, z: p.z,
      })),
    };
  }

  loadJSON(data) {
    if (!data?.people) return;
    this.people = data.people.map((p) => ({
      ...p, target: null, wait: 1 + this.rand() * 3, atWork: false,
    }));
    this.nextId = data.nextId ?? this.people.length;
    // Houses and workplaces may have been taken down while we were away.
    this.revalidate();
  }
}
