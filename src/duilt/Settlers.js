import { SETTLERS, settlerName, settlerColour } from '../config/settlers.js';
import { STRUCTURES_BY_ID } from '../config/structures.js';
import { ITEMS } from '../config/items.js';

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
 * How far a settler will step up onto something built on the ground.
 *
 * Four, because that is a generous floor or terrace and the shortest tree
 * trunk in the game — so the check above it lands inside the leaves and the
 * climb is refused.
 */
const STEP_UP = 4;

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
    return this.population < this.target;
  }

  /**
   * Everything edible in the bag, worst first.
   *
   * Settlers are not fussy but they are not given the good stuff either: they
   * work down from the least nourishing, so the fruit goes before the
   * vegetables you were keeping for yourself.
   */
  larder() {
    return ITEMS.filter((i) => i.kind === 'food' && this.inventory.countOf(i.id) > 0)
      .sort((a, b) => (a.feeds ?? 0) - (b.feeds ?? 0));
  }

  foodOnHand() {
    return this.larder().reduce((n, i) => n + this.inventory.countOf(i.id), 0);
  }

  /** People who went without at the last meal. */
  get hungry() {
    return this.people.filter((p) => p.hungry).length;
  }

  /** Why nobody new is coming, in one line, or null when somebody is on the way. */
  blockedReason() {
    if (this.hasRoom) return null;
    if (this.houses === 0) return 'Nowhere to live — build a house';
    if (this.houses === 1) return 'This one is yours — build another and somebody will move in';
    return 'Everyone has a roof — build another house for another household';
  }

  // ---- arrivals ------------------------------------------------------------

  tick(dtSeconds) {
    // One at a time rather than all at once, so raising three houses reads as
    // three people arriving rather than a crowd appearing in one frame.
    this.sinceArrival += dtSeconds;
    if (this.sinceArrival >= SETTLERS.arriveEverySeconds) {
      this.sinceArrival = 0;
      if (this.hasRoom) this.arrive();
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
      // Nobody arrives hungry; the first meal after they get here decides.
      hungry: false,
    };
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
   * Nobody starves and nobody leaves over it. Food not being a matter of life
   * and death is the point: it decides how well the place runs, and the houses
   * decide who lives in it.
   */
  eat() {
    if (!this.people.length) return 0;
    let fed = 0;
    for (const p of this.people) {
      const was = p.hungry;
      const food = this.larder()[0];
      if (food) {
        this.inventory.remove(food.id, SETTLERS.foodPerMeal);
        p.hungry = false;
        fed++;
      } else {
        p.hungry = true;
        // Back off work and head home — there is nothing to carry them
        // through the shift.
        if (!was) { p.target = null; p.wait = 0.5; p.atWork = true; }
      }
    }
    const short = this.people.length - fed;
    if (short > 0) this.bus?.emit('settler:hungry', { count: short, population: this.population });
    return fed;
  }

  /**
   * A house with nobody in it.
   *
   * One household per house, so the search is for an empty roof rather than a
   * spare bed. With the target one below the house count, exactly one house
   * always ends up without a settler in it — yours.
   */
  pickHome() {
    const taken = new Set(this.people.map((p) => p.homeId));
    const free = this.structures.list().filter((s) => s.valid
      && (STRUCTURES_BY_ID.get(s.type)?.grantsCapacity ?? 0) > 0
      && !taken.has(s.id));
    if (free.length) return free[0];

    // Politics buys people beyond the houses; they double up in the fullest
    // house rather than not existing.
    const houses = this.structures.list().filter((s) => s.valid
      && (STRUCTURES_BY_ID.get(s.type)?.grantsCapacity ?? 0) > 0);
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

  /**
   * Building ids with somebody actually working them.
   *
   * A hungry settler keeps their job — it is still theirs when the next
   * harvest comes in — but they are not at it today, so the building it is
   * does not get the bonus.
   */
  staffedIds() {
    return new Set(this.people.filter((p) => p.workId != null && !p.hungry).map((p) => p.workId));
  }

  /** What a building's output is multiplied by, given who works it. */
  bonusFor(structureId) {
    return this.staffedIds().has(structureId) ? 1 + SETTLERS.workBonus : 1;
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
      while (y < base + STEP_UP && y < w.height - 2 && w.isSolid(ix, y, iz)) y++;
      const roomToStand = !w.isSolid(ix, y, iz) && !w.isSolid(ix, y + 1, iz);
      return roomToStand ? y : base;
    }

    // Nothing on it, so fall to whatever is under it: the ground itself may
    // have been dug out from beneath them.
    let y = base;
    while (y > 0 && !w.isSolid(ix, y - 1, iz)) y--;
    return y;
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
    // Every tick, not only after a step. Somebody standing outside their house
    // while you lay a path under them should end up on the path, and somebody
    // whose ground you dig out should come down with it — waiting for their
    // next walk is up to a ten-second stretch of a person hanging in the air
    // or buried to the neck.
    p.y = this.groundAt(p.x, p.z);

    if (p.wait > 0) {
      p.wait -= dt;
      if (p.wait > 0) return;
      const home = this.placeOf(p.homeId);
      if (p.workId == null) this.assignWork(p);
      // Hungry means not at work: they mill about near home instead, which is
      // what an empty larder looks like from across the settlement.
      const work = p.hungry ? null : this.placeOf(p.workId);
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
    const before = this.population;
    this.people = this.people.filter((p) => alive.has(p.homeId));
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

  // ---- persistence ---------------------------------------------------------

  toJSON() {
    return {
      nextId: this.nextId,
      people: this.people.map((p) => ({
        id: p.id, name: p.name, colour: p.colour,
        homeId: p.homeId, workId: p.workId, hungry: !!p.hungry,
        x: p.x, y: p.y, z: p.z,
      })),
    };
  }

  loadJSON(data) {
    if (!data?.people) return;
    // The saved height is where the ground was when the tab shut; anything
    // built under them since would leave them standing in it until their next
    // step, which can be several seconds of looking like nobody is home.
    this.people = data.people.map((p) => ({
      ...p, y: this.groundAt(p.x, p.z), target: null, wait: 1 + this.rand() * 3, atWork: false,
    }));
    this.nextId = data.nextId ?? this.people.length;
    // Houses and workplaces may have been taken down while we were away.
    this.revalidate();
  }
}
