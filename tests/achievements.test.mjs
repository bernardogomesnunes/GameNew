import { GamificationEngine } from '../src/gamification/GamificationEngine.js';
import { EventBus } from '../src/core/EventBus.js';
import { ACHIEVEMENTS } from '../src/config/achievements.js';
import { AGES } from '../src/config/ages.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { Inventory } from '../src/items/Inventory.js';
import { World } from '../src/world/World.js';

/**
 * Reported as: "achievements is broken. I already did a lot of the stuff
 * that is there and it didn't trigger." The claimed-kind achievements
 * (three different buildings, one of everything) read state.claimed, a Set
 * built entirely from the 'structure:claimed' bus event — but
 * StructureRegistry emits `{ structure, spec }`, not `{ type }`, so the old
 * handler's `{ type }` destructure pulled undefined every time and the Set
 * never gained a member no matter how many kinds of building were claimed.
 * claimedCount (count-only goals) happened to still work, which is why the
 * bug read as "some achievements" rather than "all of them".
 *
 * Also removed here: one achievement per age just for reaching it ("Age 2",
 * "Age 3"...). The border growing is something you watch happen; a card
 * congratulating you for the thing you just watched happen isn't a goal.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the real bug: the event payload shape ----------------------------------

{
  const bus = new EventBus();
  const gam = new GamificationEngine(bus);

  bus.emit('structure:claimed', { structure: { type: 'quarry' }, spec: {} });
  bus.emit('structure:claimed', { structure: { type: 'farm' }, spec: {} });
  bus.emit('structure:claimed', { structure: { type: 'sawmill' }, spec: {} });

  ok('claiming three different kinds tracks all three kinds', gam.state.claimed.size === 3);
  ok('and the count-based side kept working too', gam.state.claimedCount === 3);
  ok('so "three different buildings" actually unlocks',
    gam.state.achievementsUnlocked.has('three_kinds'));
}

{
  // The same kind claimed six times over is six buildings, not six kinds.
  const bus = new EventBus();
  const gam = new GamificationEngine(bus);
  for (let i = 0; i < 6; i++) bus.emit('structure:claimed', { structure: { type: 'farm' }, spec: {} });

  ok('claiming the same kind repeatedly is one kind', gam.state.claimed.size === 1);
  ok('but still six buildings for the count-only goal', gam.state.achievementsUnlocked.has('a_street'));
  ok('and "one of everything" is correctly still out of reach',
    !gam.state.achievementsUnlocked.has('many_kinds'));
}

// --- age achievements are gone, not just hidden -----------------------------

ok('no achievement just restates reaching the next age',
  !ACHIEVEMENTS.some((a) => a.border || /^age_/.test(a.id)));
ok('but the real goals that shared those age bands are still there',
  ACHIEVEMENTS.some((a) => a.id === 'three_kinds') && ACHIEVEMENTS.some((a) => a.id === 'a_town'));

/**
 * Requested directly, on top of the fix above: "achievements should be
 * age 1 - setting foundations, achievement 1 - build a forest, 2 farm,
 * 3 house, and on and on." Age N's own goals — the ones that actually move
 * the border — are generated from ages.js rather than written out a second
 * time here, and sit first in their band, numbered, ahead of the teaching
 * goals that were already there. See requiredGoals() in
 * config/achievements.js and GamificationEngine.ctx/setDuilt for how a goal
 * gets at the live settlement to ask.
 */

// --- every age's own goals show up here, required, in order -----------------

{
  const totalAgeGoals = AGES.reduce((n, a) => n + a.goals.length, 0);
  const required = ACHIEVEMENTS.filter((a) => a.required);
  ok(`one required achievement per age goal: ${required.length} of ${totalAgeGoals}`,
    required.length === totalAgeGoals);
  ok('every one of them names the age goal it stands for',
    AGES.every((age) => age.goals.every((g) =>
      required.some((r) => r.age === age.age && r.name === g.label))));
  ok('ids are unique even when the same building is asked for at two ages',
    new Set(ACHIEVEMENTS.map((a) => a.id)).size === ACHIEVEMENTS.length);
}

{
  // Age 1's own band: required goals first, numbered, teaching goals after —
  // not required goals and teaching goals interleaved or sorted apart.
  const age1 = ACHIEVEMENTS.filter((a) => a.age === 1);
  const firstOptional = age1.findIndex((a) => !a.required);
  ok('age 1 has more than one required goal', age1.filter((a) => a.required).length > 1);
  ok('and every required one comes before the first teaching goal',
    firstOptional === -1 || age1.slice(0, firstOptional).every((a) => a.required));
}

// --- a required goal without a settlement to ask is simply not done ---------

{
  const bus = new EventBus();
  const gam = new GamificationEngine(bus);
  const forest = ACHIEVEMENTS.find((a) => a.required && a.age === 1 && /forest/i.test(a.name));
  ok('there is a required forest goal in age 1 to test against', !!forest);
  ok('with no settlement set, it does not throw and reads as not done',
    forest.check(gam.ctx()) === false);
}

// --- and with one, it reads the live settlement, not a snapshot -------------

{
  const bus = new EventBus();
  const gam = new GamificationEngine(bus);
  const world = new World({ sizeX: 8, sizeZ: 8, height: 8 });
  const inventory = new Inventory();
  const structures = new StructureRegistry({ world, bus: null, inventory });
  gam.setDuilt({ structures });

  const houseGoal = ACHIEVEMENTS.find((a) => a.id === 'req_1_house');
  ok('the age-1 house goal exists', !!houseGoal);
  ok('not yet built, it is not done', houseGoal.check(gam.ctx()) === false);

  const push = (type) => structures.structures.push({
    id: structures.nextId++, type, region: { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 },
    valid: true, locked: true, claimedAt: Date.now(), lastPaidAt: Date.now(), brokenReason: null,
  });
  push('house');
  ok('built, it is done — read live off the settlement, not a stale copy',
    houseGoal.check(gam.ctx()) === true);
}

// --- claiming for real, through the bus, unlocks the required goals in turn -

{
  const bus = new EventBus();
  const gam = new GamificationEngine(bus);
  const world = new World({ sizeX: 8, sizeZ: 8, height: 8 });
  const structures = new StructureRegistry({ world, bus, inventory: new Inventory() });
  gam.setDuilt({ structures });

  const region = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
  const claim = (type) => {
    const s = {
      id: structures.nextId++, type, region, valid: true, locked: true,
      claimedAt: Date.now(), lastPaidAt: Date.now(), brokenReason: null,
    };
    structures.structures.push(s);
    bus.emit('structure:claimed', { structure: s, spec: {} });
  };

  ok('nothing required is unlocked before anything is built',
    !ACHIEVEMENTS.some((a) => a.required && gam.state.achievementsUnlocked.has(a.id)));
  claim('forest'); claim('farm'); claim('house');
  ok('all three of age 1\'s required goals unlock as their buildings go up',
    ['req_1_forest', 'req_1_farm', 'req_1_house'].every((id) => gam.state.achievementsUnlocked.has(id)));
  ok('and they paid real XP, not zero', gam.state.xp > 0);
}

process.exit(f ? 1 : 0);
