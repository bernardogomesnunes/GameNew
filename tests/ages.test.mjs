import * as THREE from 'three';
import { AGES, RINGS, FINAL_AGE, ageOf } from '../src/config/ages.js';
import { STRUCTURES, STRUCTURES_BY_ID, structuresForAge } from '../src/config/structures.js';
import { RECIPES, recipesFor } from '../src/config/recipes.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

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

ok(`there are ${AGES.length} ages`, AGES.length === 6);
ok('they are numbered 1..n with no gaps', AGES.every((a, i) => a.age === i + 1));
ok('every age has a name, an intro and goals',
  AGES.every((a) => a.name && a.intro && a.goals?.length));
ok('only the last age is final',
  AGES.filter((a) => a.final).length === 1 && AGES[AGES.length - 1].final === true);
ok(`FINAL_AGE is the last one (${FINAL_AGE})`, FINAL_AGE === AGES[AGES.length - 1].age);

// The map being the reward only works if it keeps growing.
ok('the land grows every age', AGES.every((a, i) => i === 0 || a.size > AGES[i - 1].size));

// The rings used to reach 512 and 1024 in a world generated at 256, so from
// Age 5 the border stood outside the terrain it was meant to enclose.
const WORLD = 256;
ok(`no ring is wider than the world (${WORLD})`, AGES.every((a) => a.size <= WORLD));
ok('the last ring is the whole world', AGES[AGES.length - 1].size === WORLD);
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
for (const spec of STRUCTURES) {
  const wanted = AGES.some((a) => a.goals.some((g) => g.structure === spec.id));
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
  ok(`recipe ${r.id} outputs a real item`, ITEMS_BY_ID.has(r.output.id));
  for (const id of Object.keys(r.inputs)) ok(`  and takes ${id}, which is real`, ITEMS_BY_ID.has(id));
}

// A workshop recipe with no workshop in the game is a recipe nobody can reach.
const stations = new Set(STRUCTURES.map((s) => s.station).filter(Boolean));
for (const r of RECIPES) {
  if (r.station === 'hand') continue;
  ok(`recipe ${r.id} needs a "${r.station}", which some building provides`, stations.has(r.station));
}

// You cannot be sent to make something before the building exists.
for (const r of RECIPES.filter((x) => x.station !== 'hand')) {
  const provider = STRUCTURES.find((s) => s.station === r.station);
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
    const need = new Map();
    for (const goal of age.goals) need.set(goal.structure, goal.count ?? 1);
    for (const [type, n] of need) {
      const have = g.structures.countOf(type);
      if (have < n) give(type, n - have);
    }
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
  g.structures.structures.push({
    id: 1, type: 'monument', valid: true, locked: true,
    region: { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 },
    claimedAt: 0, lastPaidAt: 0, brokenReason: null,
  });
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

process.exit(f ? 1 : 0);
