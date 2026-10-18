import { BLOCKS } from '../src/config/blocks.js';
import { ITEM_FOR_BLOCK } from '../src/config/items.js';
import * as THREE from 'three';
import { AGES, RINGS, FINAL_AGE, WAR_AGE, ageOf } from '../src/config/ages.js';
import { ACHIEVEMENTS } from '../src/config/achievements.js';
import { STRUCTURES, STRUCTURES_BY_ID, structuresForAge } from '../src/config/structures.js';
import { RECIPES, recipesFor } from '../src/config/recipes.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { BOOK } from '../src/duilt/Collection.js';

/**
 * The arc, end to end.
 *
 * The game used to stop dead after Age 1: `ageGoals` returned an empty list
 * for every other age and `ageComplete` required a non-empty one, so finishing
 * Age 1 moved you into an age that could never be finished. Five of the six
 * rings were unreachable and there was no ending at all. These check that the
 * whole thing is connected — every goal names a building that exists, every
 * building can be reached, the land only grows, and the last age ends.
 */

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the arc holds together --------------------------------------------------

ok(`there are ${AGES.length} ages (asked for directly: "age 12")`, AGES.length === 12);
// "3 goals per age until age 5 and then we can go with 4".
ok('three goals an age up to Age 5, four after', AGES.every((a) => a.goals.length === (a.age <= 5 ? 3 : 4)));
ok('they are numbered 1..n with no gaps', AGES.every((a, i) => a.age === i + 1));
ok('every age has a name, an intro and goals',
  AGES.every((a) => a.name && a.intro && a.goals?.length));
ok('only the last age is final',
  AGES.filter((a) => a.final).length === 1 && AGES[AGES.length - 1].final === true);
ok(`FINAL_AGE is the last one (${FINAL_AGE})`, FINAL_AGE === AGES[AGES.length - 1].age);

// The map being the reward only works if it keeps growing.
ok('the land grows every age', AGES.every((a, i) => i === 0 || a.size > AGES[i - 1].size));

// The land is a wall until the last age (asked for directly: "keep blocking
// leaving the area until age 6, and increase just a little the range,
// starting on 32 but going higher than 256"). Worlds are endless now, so
// the old cap at the width of a 256 world is gone.
// And more of it: "increase the terrain available for building".
ok('it starts at 32 and ends at 512', AGES[0].size === 32 && AGES[AGES.length - 1].size === 512);
ok(`the wall stays up until the war's age (${WAR_AGE}), and down from then on`,
  AGES.every((a) => !!a.open === a.age >= WAR_AGE) && WAR_AGE < FINAL_AGE);
ok('Territory reads the same list', RINGS.length === AGES.length
  && RINGS.every((r, i) => r.size === AGES[i].size && r.name === AGES[i].name));

// --- every goal is reachable -------------------------------------------------

for (const age of AGES) {
  for (const g of age.goals) {
    if (!g.structure) continue;
    const spec = STRUCTURES_BY_ID.get(g.structure);
    ok(`age ${age.age}: "${g.label}" names a real building`, !!spec);
    // A goal asking for a building unlocked later than the age that wants it
    // is a goal you can never complete.
    ok(`  and a ${g.structure} is available by then (unlocks at age ${spec?.age})`,
      !!spec && spec.age <= age.age);
  }
}

// Every building belongs to some age's goals, or it is content nobody is sent to.
// An optional one (the pen) is sent to by a teaching goal naming it instead.
for (const spec of STRUCTURES) {
  const wanted = AGES.some((a) => a.goals.some((g) => g.structure === spec.id))
    || (spec.id.startsWith('sanctuary_') && AGES.some((a) => a.goals.some((g) => g.id === 'sanctuary')));
  ok(`the ${spec.id} is something some age asks for`, wanted);
}

// --- the things buildings give and cost actually exist -----------------------

for (const spec of STRUCTURES) {
  for (const id of Object.keys(spec.produces ?? {})) {
    ok(`${spec.id} produces ${id}, which is a real item`, ITEMS_BY_ID.has(id));
  }
  for (const id of Object.keys(spec.cost ?? {})) {
    ok(`${spec.id} costs ${id}, which is a real item`, ITEMS_BY_ID.has(id));
  }
}
for (const r of RECIPES) {
  // Studying (a university) makes no item — it raises a skill or teaches engineering.
  if (r.study) { ok(`study ${r.id} says what it gives instead`, r.output.id == null && !!r.result); continue; }
  ok(`recipe ${r.id} outputs a real item`, ITEMS_BY_ID.has(r.output.id));
  for (const id of Object.keys(r.inputs)) ok(`  and takes ${id}, which is real`, ITEMS_BY_ID.has(id));
}

// A workshop recipe with no workshop in the game is a recipe nobody can reach.
// A station is a building, or a block you put down (the wood mill).
const stations = new Set([...STRUCTURES.map((s) => s.station), ...BLOCKS.map((b) => b.station)].filter(Boolean));
for (const r of RECIPES) {
  if (r.station === 'hand') continue;
  ok(`recipe ${r.id} needs a "${r.station}", which some building or block provides`, stations.has(r.station));
}

// You cannot be sent to make something before the building exists.
// Nor at a block before the recipe that makes the block (the wood mill).
for (const r of RECIPES.filter((x) => x.station !== 'hand')) {
  const block = BLOCKS.find((b) => b.station === r.station && b.stateOf == null);
  const provider = STRUCTURES.find((s) => s.station === r.station)
    ?? (block && RECIPES.find((x) => x.output.id === ITEM_FOR_BLOCK.get(block.id)));
  ok(`${r.id} (age ${r.age}) comes no earlier than its ${provider.id} (age ${provider.age})`,
    r.age >= provider.age);
}

// --- the goals are actually computed now -------------------------------------

const scene = new THREE.Scene();
const { world } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed: 4 });

{
  const g = new DuiltGame({ world, scene, bus: null });
  for (const age of AGES) {
    g.territory.setAge(age.age);
    const goals = g.ageGoals();
    ok(`age ${age.age} has goals to show (${goals.length})`, goals.length === age.goals.length);
    ok(`  none of them start done`, goals.every((x) => !x.done));
    ok(`  and the age is not complete`, !g.ageComplete());
  }
}

// --- and completing them advances, right through to the end ------------------

/** Makes one goal true, whatever it asks — a building, or one of the tests in ages.js. */
function satisfy(g, goal, give) {
  // A building at a level (Age 6's mine down to iron).
  if (goal.structure === 'mine' && goal.test) {
    if (!g.structures.countOf('mine')) give('mine', 1);
    g.structures.structures.find((s) => s.type === 'mine').tier = 1;
    return;
  }
  if (goal.structure) {
    const have = g.structures.countOf(goal.structure);
    if (have < (goal.count ?? 1)) give(goal.structure, (goal.count ?? 1) - have);
    return;
  }
  const renowned = STRUCTURES_BY_ID.get('farm').tiers.findIndex((t) => t.id === 'renowned');
  const make = {
    wood: () => g.firsts.add('wood'),
    water: () => g.firsts.add('water'),
    pickaxe: () => g.firsts.add('pickaxe'),
    evolve: () => { give('farm', 1); g.structures.structures.at(-1).tier = 1; },
    mine_gold: () => { if (!g.structures.countOf('mine')) give('mine', 1); g.structures.structures.find((s) => s.type === 'mine').tier = 2; },
    ring: () => { g.ring = 'white'; },
    sanctuary: () => give('sanctuary_white', 1),
    fifteen: () => give('house', Math.max(0, 15 - g.structures.list().length)),
    twentyfive: () => give('house', Math.max(0, 25 - g.structures.list().length)),
    war: () => { g.war.stage = 'won'; },
    renowned: () => { give('farm', 1); g.structures.structures.at(-1).tier = renowned; },
    ruin: () => g.found.add('ruin@1,1'),
    ruined_temple: () => g.found.add('ruined_temple@2,2'),
    old_mine: () => g.found.add('mine@3,3'),
    old_monument: () => g.found.add('monument@4,4'),
    market_town: () => { g.marketTraders = () => [1, 2, 3, 4]; },
    coins: () => g.inventory.add('coin', 100),
    armoured: () => { for (const k of ['head', 'body', 'legs', 'feet']) g.worn[k] = { id: `armour_leather_${k}`, wear: 0 }; },
    // Ages 11 and 12 (Conquest, The God).
    city_treasure: () => g.raided.add('city@1,1'),
    second_people: () => g.raided.add('tribe@2,2'),
    gem_armour: () => { g.worn.body = { id: 'armour_diamond_body', wear: 0 }; },
    book_half: () => g.collection.note(BOOK.slice(0, Math.ceil(BOOK.length / 2)).map((i) => i.id)),
    cube_open: () => { g.cube.entered = true; },
    god_done: () => { g.cube.beaten = true; },
    past: () => { g.time.pastVisited = true; },
    hatch: () => { g.time.hatched = 1; },
  }[goal.id];
  ok(`  (the test knows how to meet "${goal.label}")`, !!make);
  make?.();
}

{
  const g = new DuiltGame({ world, scene, bus: null });
  // Stand in for the buildings: the goals only ask how many are standing.
  const give = (type, n) => {
    for (let i = 0; i < n; i++) {
      g.structures.structures.push({
        id: g.structures.nextId++, type, valid: true, locked: true,
        region: { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 },
        claimedAt: 0, lastPaidAt: 0, brokenReason: null,
      });
    }
  };

  let reached = 1;
  for (const age of AGES) {
    ok(`walked into age ${age.age}`, g.age === age.age);
    for (const goal of age.goals) satisfy(g, goal, give);
    ok(`  its goals now read as done`, g.ageGoals().every((x) => x.done));
    g.checkAgeAdvance();
    if (age.age < FINAL_AGE) {
      ok(`  and the border moved out to ${ageOf(age.age + 1).size}`,
        g.age === age.age + 1 && g.territory.size === ageOf(age.age + 1).size);
      reached = g.age;
    }
  }
  ok(`the last age does not advance past itself`, g.age === FINAL_AGE);
  ok('the game reports itself won', g.won === true);
}

// Winning fires once, not on every check.
{
  const events = [];
  const bus = { emit: (name, data) => events.push(name), on() {} };
  const g = new DuiltGame({ world, scene, bus });
  g.territory.setAge(FINAL_AGE);
  const give = (type, n = 1) => {
    for (let i = 0; i < n; i++) {
      g.structures.structures.push({
        id: g.structures.nextId++, type, valid: true, locked: true,
        region: { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 },
        claimedAt: 0, lastPaidAt: 0, brokenReason: null,
      });
    }
  };
  for (const goal of ageOf(FINAL_AGE).goals) satisfy(g, goal, give);
  g.checkAgeAdvance();
  g.checkAgeAdvance();
  g.checkAgeAdvance();
  ok('winning is announced exactly once', events.filter((e) => e === 'duilt:won').length === 1);
}

// --- buildings and recipes arrive as the ages do -----------------------------

for (const age of AGES) {
  const available = structuresForAge(age.age);
  ok(`age ${age.age} can build ${available.length} kinds of thing`, available.length > 0);
  ok(`  and nothing from a later age leaks in`, available.every((s) => s.age <= age.age));
}
ok('age 1 has no workshop recipes to be confused by',
  recipesFor(1).every((r) => r.station === 'hand'));
ok('the later ages do', recipesFor(FINAL_AGE).some((r) => r.station === 'workshop'));

// Over 64 KB of output: exiting straight away, into a pipe that's slow to be
// read (the whole suite at once), dropped the end of it — the runner then
// counted a few hundred of these instead of all of them. Out once it's written.
process.stdout.write('', () => process.exit(f ? 1 : 0));
