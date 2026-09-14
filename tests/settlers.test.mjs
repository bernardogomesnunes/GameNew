import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { Settlers } from '../src/duilt/Settlers.js';
import { SETTLERS, settlerName, settlerColour } from '../src/config/settlers.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';

/**
 * The people who move in.
 *
 * Houses granted capacity from Age 1 and nothing ever read it; the Politics
 * skill promised "room to govern N more settlers" and `settlerAllowance` had
 * zero callers. These check that the promise now has a body: that arrivals are
 * gated by beds and food rather than a timer alone, that somebody working a
 * building actually changes what it produces, and that taking a house down
 * does not leave a person standing in the air where it used to be.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const FARMLAND = 21, WATER = 11;

/** A world with a farm's worth of tilled ground beside water. */
function setup({ beds = 0, food = 0 } = {}) {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) {
    world.setBlock(x, 10, z, 1);
    world.surfaceHeightMap[x * 64 + z] = 11;
  }
  const inventory = new Inventory();
  const structures = new StructureRegistry({ world, bus: null, inventory });
  const skills = { settlerAllowance: () => 0 };
  let nextId = 1;

  // Stand in for claimed buildings: the model only asks the registry what is
  // standing, not how it got there.
  const add = (type, region) => {
    const s = {
      id: nextId++, type, region, valid: true, locked: true,
      claimedAt: 0, lastPaidAt: 0, brokenReason: null,
    };
    structures.structures.push(s);
    return s;
  };
  for (let i = 0; i < beds / 4; i++) {
    add('house', { minX: 10 + i * 8, maxX: 14 + i * 8, minY: 11, maxY: 14, minZ: 10, maxZ: 14 });
  }
  if (food) inventory.add('vegetables', food);

  let r = 0;
  const rand = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
  const settlers = new Settlers({ world, structures, inventory, skills, bus: null, rand });
  return { world, inventory, structures, settlers, add, skills };
}

// --- the config holds together ----------------------------------------------

ok('names are distinct', new Set([...Array(30)].map((_, i) => settlerName(i))).size === 30);
ok('and keep going past the list', settlerName(0) !== settlerName(30) && !!settlerName(77));
ok('everyone gets a colour', [...Array(20)].every((_, i) => Number.isInteger(settlerColour(i))));
ok('a settler is person-sized', SETTLERS.build.height > 1 && SETTLERS.build.height < 2.5);
ok('working a building is worth something', SETTLERS.workBonus > 0);
ok('and they walk slower than the player', SETTLERS.walkSpeed < 5);

// --- nobody moves in without a bed ------------------------------------------

{
  const { settlers } = setup({ beds: 0, food: 100 });
  ok('no houses means no room', settlers.capacity === 0 && !settlers.hasRoom);
  ok('and it says so', /build a house/i.test(settlers.blockedReason() ?? ''));
  settlers.tick(SETTLERS.arriveEverySeconds + 1);
  ok('so nobody arrives', settlers.population === 0);
}

// --- or without food ---------------------------------------------------------

{
  const { settlers } = setup({ beds: 4, food: 0 });
  ok('a house makes room', settlers.capacity === 4 && settlers.hasRoom);
  ok('but an empty larder stops it', !settlers.canFeed);
  ok('and it says so', /food/i.test(settlers.blockedReason() ?? ''));
  settlers.tick(SETTLERS.arriveEverySeconds + 1);
  ok('so still nobody arrives', settlers.population === 0);
}

// --- with both, they come ----------------------------------------------------

{
  const { settlers } = setup({ beds: 4, food: 100 });
  ok('with a bed and food, nothing is blocking', settlers.blockedReason() === null);
  settlers.tick(SETTLERS.arriveEverySeconds + 1);
  ok('somebody arrives', settlers.population === 1);
  ok('they have a name', !!settlers.people[0].name);
  ok('and a house to sleep in', settlers.people[0].homeId != null);

  // They keep coming until the beds run out, and then stop.
  for (let i = 0; i < 10; i++) settlers.tick(SETTLERS.arriveEverySeconds + 1);
  ok(`the house fills up and stops at its four beds (${settlers.population})`, settlers.population === 4);
  ok('and it says why nobody else is coming', /bed/i.test(settlers.blockedReason() ?? ''));

  // Politics is the skill that was promising this and doing nothing.
  settlers.skills = { settlerAllowance: () => 2 };
  ok('the Politics skill raises the ceiling', settlers.capacity === 6);
  settlers.tick(SETTLERS.arriveEverySeconds + 1);
  ok('and somebody takes the new room', settlers.population === 5);
}

// --- a settler works the nearest building in reach ---------------------------

{
  const { settlers, add } = setup({ beds: 4, food: 100 });
  const near = add('quarry', { minX: 20, maxX: 25, minY: 11, maxY: 13, minZ: 10, maxZ: 15 });
  const far = add('quarry', {
    minX: 10 + SETTLERS.workRange + 20, maxX: 15 + SETTLERS.workRange + 20,
    minY: 11, maxY: 13, minZ: 10, maxZ: 15,
  });

  settlers.tick(SETTLERS.arriveEverySeconds + 1);
  const first = settlers.people[0];
  ok('they find work', first.workId === near.id);
  ok('and it is the near one, not the far one', first.workId !== far.id);
  ok('a staffed building produces more', settlers.bonusFor(near.id) === 1 + SETTLERS.workBonus);
  ok('and an empty one does not', settlers.bonusFor(far.id) === 1);

  // One worker each: two people in one quarry should not double it.
  settlers.tick(SETTLERS.arriveEverySeconds + 1);
  const second = settlers.people[1];
  ok('the next person does not pile into the same building', second.workId !== near.id);
  ok('and takes nothing out of reach either', second.workId === null);
  ok('the staffed building is still only counted once',
    settlers.bonusFor(near.id) === 1 + SETTLERS.workBonus);
}

// A building with nothing to produce is not a job.
{
  const { settlers, add } = setup({ beds: 4, food: 100 });
  add('workshop', { minX: 20, maxX: 25, minY: 11, maxY: 14, minZ: 10, maxZ: 15 });
  ok('the workshop produces nothing',
    !Object.keys(STRUCTURES_BY_ID.get('workshop').produces ?? {}).length);
  settlers.tick(SETTLERS.arriveEverySeconds + 1);
  ok('so nobody is put to work in it', settlers.people[0].workId === null);
}

// --- they walk ---------------------------------------------------------------

{
  const { settlers, add } = setup({ beds: 4, food: 100 });
  add('farm', { minX: 30, maxX: 34, minY: 11, maxY: 12, minZ: 30, maxZ: 34 });
  settlers.tick(SETTLERS.arriveEverySeconds + 1);
  const p = settlers.people[0];
  const start = { x: p.x, z: p.z };

  let moved = 0;
  for (let i = 0; i < 600; i++) {
    const was = { x: p.x, z: p.z };
    settlers.tick(0.1);
    moved += Math.hypot(p.x - was.x, p.z - was.z);
  }
  ok(`they get about (${moved.toFixed(1)} blocks walked in a minute)`, moved > 10);
  ok('and end up somewhere other than where they started',
    Math.hypot(p.x - start.x, p.z - start.z) > 1);
  ok('always standing on the ground, never in it',
    p.y === settlers.groundAt(p.x, p.z));
  ok('and never outside the world', p.x >= 0 && p.x < 64 && p.z >= 0 && p.z < 64);
}

// --- eating ------------------------------------------------------------------

{
  const { settlers, inventory } = setup({ beds: 4, food: 100 });
  for (let i = 0; i < 4; i++) settlers.tick(SETTLERS.arriveEverySeconds + 1);
  const before = inventory.countOf('vegetables');
  settlers.sinceMeal = 0;
  settlers.tick(SETTLERS.eatEverySeconds + 1);
  const after = inventory.countOf('vegetables');
  ok(`a settlement of ${settlers.population} eats (${before} -> ${after})`, after < before);
  ok('one meal each, not a feast', before - after === settlers.population);
}

// --- taking the house down ---------------------------------------------------

{
  const { settlers, structures } = setup({ beds: 4, food: 100 });
  const job = { minX: 20, maxX: 25, minY: 11, maxY: 13, minZ: 10, maxZ: 15 };
  const quarry = structures.structures[structures.structures.length - 1]
    ?? null;
  settlers.tick(SETTLERS.arriveEverySeconds + 1);
  settlers.tick(SETTLERS.arriveEverySeconds + 1);
  ok('two have moved in', settlers.population === 2);

  const house = structures.list().find((s) => STRUCTURES_BY_ID.get(s.type)?.grantsCapacity);
  structures.remove(house.id);
  settlers.revalidate();
  ok('pulling the house down leaves nobody living in mid-air', settlers.population === 0);
}

{
  // Losing your workplace is not losing your home.
  const { settlers, structures, add } = setup({ beds: 4, food: 100 });
  const quarry = add('quarry', { minX: 20, maxX: 25, minY: 11, maxY: 13, minZ: 10, maxZ: 15 });
  settlers.tick(SETTLERS.arriveEverySeconds + 1);
  ok('they have a job', settlers.people[0].workId === quarry.id);
  structures.remove(quarry.id);
  settlers.revalidate();
  ok('the quarry going leaves them housed', settlers.population === 1);
  ok('but out of work', settlers.people[0].workId === null);
  ok('and the bonus goes with it', settlers.bonusFor(quarry.id) === 1);
}

// --- a settlement survives a save --------------------------------------------

{
  const { settlers, structures, inventory, world } = setup({ beds: 4, food: 100 });
  const add2 = (type, region) => {
    const s = { id: 99, type, region, valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, brokenReason: null };
    structures.structures.push(s);
    return s;
  };
  add2('quarry', { minX: 20, maxX: 25, minY: 11, maxY: 13, minZ: 10, maxZ: 15 });
  for (let i = 0; i < 3; i++) settlers.tick(SETTLERS.arriveEverySeconds + 1);
  const saved = JSON.parse(JSON.stringify(settlers.toJSON()));

  const back = new Settlers({ world, structures, inventory, skills: { settlerAllowance: () => 0 }, bus: null });
  back.loadJSON(saved);
  ok(`everyone comes back (${back.population})`, back.population === settlers.population);
  ok('with their names', back.people[0].name === settlers.people[0].name);
  ok('their homes', back.people.every((p) => p.homeId != null));
  ok('and their jobs', back.people.some((p) => p.workId === 99));
  ok('the next arrival does not reuse a name',
    back.nextId === settlers.nextId);

  // A save whose houses have since gone should not restore ghosts.
  const orphaned = new Settlers({
    world,
    structures: new StructureRegistry({ world, bus: null, inventory }),
    inventory, skills: { settlerAllowance: () => 0 }, bus: null,
  });
  orphaned.loadJSON(saved);
  ok('but people whose houses are gone do not come back', orphaned.population === 0);
}

ok('loading nothing is safe', (() => {
  const { settlers } = setup();
  settlers.loadJSON(undefined);
  settlers.loadJSON({});
  return settlers.population === 0;
})());

process.exit(f ? 1 : 0);
