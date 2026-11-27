// VIL-4 and VIL-5: villagers gain experience by working; levels raise their
// stats; University and military buildings add to them; saves keep it all.
import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { Settlers } from '../src/duilt/Settlers.js';
import { VillagerJobs } from '../src/duilt/VillagerJobs.js';
import { LEVELS, BUILDING_BONUS } from '../src/config/levels.js';
import { levelOf, progress, gain, statsFor, buildingBonuses, loadXp, xpFor } from '../src/duilt/Levels.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- thresholds -------------------------------------------------------------
ok('10 levels, thresholds rise from 0', LEVELS.max === 10 && LEVELS.thresholds.length === 10 && LEVELS.thresholds[0] === 0
  && LEVELS.thresholds.every((t, i, a) => i === 0 || t > a[i - 1]));
ok('0 xp is level 1', levelOf(0) === 1 && levelOf(undefined) === 1 && levelOf(NaN) === 1 && levelOf(-5) === 1);
ok('99 xp is level 1, 100 is level 2', levelOf(99) === 1 && levelOf(100) === 2);
ok('every threshold starts its level', LEVELS.thresholds.every((t, i) => levelOf(t) === i + 1 && (i === 0 || levelOf(t - 1) === i)));
ok('level stops at 10', levelOf(4500) === 10 && levelOf(1e9) === 10);
ok('progress: halfway to level 2', Math.abs(progress(50).share - 0.5) < 1e-9 && progress(50).need === 100);
ok('progress at the top', progress(9999).share === 1 && progress(9999).need === 0);
ok('xpFor', xpFor(1) === 0 && xpFor(2) === 100 && xpFor(10) === 4500);

// --- xp gain ----------------------------------------------------------------
{
  const p = { xp: 0 };
  gain(p, 'work', 100);
  ok('100 s on the job is 10 xp', Math.abs(p.xp - 10) < 1e-9);
  gain(p, 'item', 4);
  ok('4 items made is 4 xp', Math.abs(p.xp - 14) < 1e-9);
  gain(p, 'block', 10);
  ok('10 blocks built is 5 xp', Math.abs(p.xp - 19) < 1e-9);
  ok('a level reached is returned', gain({ xp: 99 }, 'item', 1) === 2 && gain({ xp: 0 }, 'item', 1) === 0);
  ok('bad amounts and kinds give nothing', gain(p, 'work', -3) === 0 && gain(p, 'work', NaN) === 0 && gain(p, 'sleep', 5) === 0 && Math.abs(p.xp - 19) < 1e-9);
  const top = { xp: 4499 };
  gain(top, 'item', 1000);
  ok('xp stops at the top level', top.xp === 4500 && levelOf(top.xp) === 10);
  const bare = {};
  gain(bare, 'item', 2);
  ok('a person with no xp field starts at 0', bare.xp === 2);
}

// --- stats from levels ------------------------------------------------------
{
  const s1 = statsFor(0), s5 = statsFor(1000), s10 = statsFor(4500);
  ok('level 1: strength 10, intelligence 10, speeds 1, health 10', s1.strength === 10 && s1.intelligence === 10 && s1.workSpeed === 1 && s1.buildSpeed === 1 && s1.maxHp === 10);
  ok('level 5: +8 strength, +8 intelligence', s5.level === 5 && s5.strength === 18 && s5.intelligence === 18);
  ok('level 10: strength 28, intelligence 28', s10.strength === 28 && s10.intelligence === 28);
  ok('each level raises work speed, build speed, strength, intelligence',
    [1, 2, 3, 4, 5, 6, 7, 8, 9].every((l) => { const a = statsFor(xpFor(l)), b = statsFor(xpFor(l + 1)); return b.workSpeed > a.workSpeed && b.buildSpeed > a.buildSpeed && b.strength > a.strength && b.intelligence > a.intelligence; }));
  ok('level 10 works 1.36 times as fast and builds 1.54 times', Math.abs(s10.workSpeed - 1.36) < 1e-9 && Math.abs(s10.buildSpeed - 1.54) < 1e-9);
}

// --- VIL-5: stat bonus from buildings ----------------------------------------
{
  const b = (type, tier = 0, valid = true) => ({ type, tier, valid });
  ok('no buildings, no bonus', buildingBonuses([]).strength === 0 && buildingBonuses([]).intelligence === 0);
  ok('University: +10 intelligence, no strength', buildingBonuses([b('university')]).intelligence === 10 && buildingBonuses([b('university')]).strength === 0);
  ok('Barracks tiers: 6, 10, 14', [0, 1, 2].map((t) => buildingBonuses([b('barracks', t)]).strength).join() === '6,10,14');
  ok('Garrison tiers: 6, 10, 14', [0, 1, 2].map((t) => buildingBonuses([b('military', t)]).strength).join() === '6,10,14');
  ok('a tier past the list holds the last value', buildingBonuses([b('barracks', 9)]).strength === 14);
  ok('Armoury +10, War Hall +16', buildingBonuses([b('armoury')]).strength === 10 && buildingBonuses([b('war_hall')]).strength === 16);
  ok('a second barracks adds nothing, a better one wins', buildingBonuses([b('barracks', 0), b('barracks', 0)]).strength === 6 && buildingBonuses([b('barracks', 0), b('barracks', 2)]).strength === 14);
  ok('a broken building adds nothing', buildingBonuses([b('barracks', 2, false), b('university', 0, false)]).strength === 0);
  ok('farms and houses add nothing', buildingBonuses([b('farm'), b('house'), b('watchtower'), b('wall')]).strength === 0);
  const early = buildingBonuses([b('military'), b('barracks'), b('armoury')]).strength;
  const late = buildingBonuses([b('military', 2), b('barracks', 2), b('armoury'), b('war_hall')]).strength;
  ok('first military buildings: +22 strength; everything upgraded: +54', early === 22 && late === 54);
  ok('every building named in the bonus table exists', Object.values(BUILDING_BONUS).flatMap((t) => Object.keys(t)).every((id) => STRUCTURES_BY_ID.has(id)));
  ok('tiers listed match the building\'s own tiers', Object.values(BUILDING_BONUS).flatMap((t) => Object.entries(t)).every(([id, list]) => list.length <= Math.max(1, STRUCTURES_BY_ID.get(id).tiers?.length ?? 1)));
  // Strength does not follow the Age: the same level-1 villager is the same with no military building, whatever else stands.
  ok('no military building: strength stays at level plus 10 at any Age', statsFor(0, buildingBonuses([b('university'), b('townhall'), b('temple'), b('monument')])).strength === 10);
  const beast = statsFor(4500, buildingBonuses([b('military', 2), b('barracks', 2), b('armoury'), b('war_hall')]));
  ok('level 10 with everything: strength 82, health 64', beast.strength === 82 && beast.maxHp === 64);
  const clever = statsFor(0, buildingBonuses([b('university')]));
  ok('a University makes everyone 20 percent faster at work, 30 at building', Math.abs(clever.workSpeed - 1.2) < 1e-9 && Math.abs(clever.buildSpeed - 1.3) < 1e-9);
}

// --- in a village -----------------------------------------------------------
function setup(seed = 3) {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) { world.setBlock(x, 10, z, 1); world.surfaceHeightMap[x * 64 + z] = 11; }
  const inventory = new Inventory({ slots: 60 });
  const structures = new StructureRegistry({ world, bus: null, inventory });
  let id = 1;
  const add = (type, region, extra = {}) => structures.structures.push({ id: id++, type, region, valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, brokenReason: null, ...extra });
  for (let i = 0; i < 2; i++) add('house', { minX: 4 + i * 10, maxX: 8 + i * 10, minY: 11, maxY: 14, minZ: 4, maxZ: 8 });
  add('quarry', { minX: 20, maxX: 25, minY: 11, maxY: 13, minZ: 20, maxZ: 25 }, { tier: 0 });
  let r = seed;
  const rand = () => { r = (r * 1103515245 + 2000) % 2147483648; return r / 2147483648; };
  const events = [];
  const bus = { emit: (n, e) => events.push([n, e]) };
  const settlers = new Settlers({ world, structures, inventory, skills: { settlerAllowance: () => 0 }, bus, rand });
  settlers.arrive();
  return { settlers, structures, inventory, events, p: settlers.people[0], add, world };
}
{
  const { settlers, p, structures, events } = setup();
  ok('an arrival starts at level 1 with 0 xp and no weapon', p.xp === 0 && settlers.statsOf(p).level === 1 && p.weapon === null);
  const quarry = structures.list().find((s) => s.type === 'quarry');
  p.workId = quarry.id; p.hungry = false; p.sleep = null; settlers.dark = false;
  settlers.jobsOpen; // a getter; no Work Hall here
  settlers.workTick(10);
  ok('no Work Hall: nobody is at a job, so no experience', p.xp === 0);
  Object.defineProperty(settlers, 'jobsOpen', { get: () => true });
  for (let i = 0; i < 10; i++) settlers.workTick(1);
  ok('10 s at a job is 1 xp', Math.abs(p.xp - 1) < 1e-9);
  settlers.dark = true; settlers.workTick(1);
  ok('no experience at night', Math.abs(p.xp - 1) < 1e-9);
  settlers.dark = false; p.hungry = true; settlers.workTick(1);
  ok('no experience while hungry', Math.abs(p.xp - 1) < 1e-9);
  p.hungry = false; p.band = 'angry'; settlers.workTick(1);
  ok('no experience while refusing to work', Math.abs(p.xp - 1) < 1e-9);
  p.band = 'content';
  settlers.workTick(100);
  ok('long frames count at most 1 s', Math.abs(p.xp - 1.1) < 1e-9);
  settlers.creditMade({ [quarry.id]: 7 });
  ok('7 items made at their building is 7 xp', Math.abs(p.xp - 8.1) < 1e-9);
  settlers.creditMade({ 999: 5 });
  ok('items made at a building with no worker go to nobody', Math.abs(p.xp - 8.1) < 1e-9);
  p.xp = 99.5; settlers.creditMade({ [quarry.id]: 1 });
  ok('reaching level 2 says so', p.xp >= 100 && events.some(([n, e]) => n === 'settler:level' && e.level === 2));
  ok('level 2 has strength 12 and work speed 1.04', settlers.statsOf(p).strength === 12 && Math.abs(settlers.statsOf(p).workSpeed - 1.04) < 1e-9);
}

// A worker's level and a University raise what their building makes.
{
  const { settlers, p, structures, add } = setup();
  const quarry = structures.list().find((s) => s.type === 'quarry');
  p.workId = quarry.id; p.hungry = false;
  const base = settlers.bonusFor(quarry.id);
  ok('level 1 worker: bonus is the plain 1.5', Math.abs(base - 1.5) < 1e-9);
  p.xp = 4500;
  ok('level 10 worker: 1.5 x 1.36', Math.abs(settlers.bonusFor(quarry.id) - 1.5 * 1.36) < 1e-9);
  p.xp = 0;
  add('university', { minX: 40, maxX: 45, minY: 11, maxY: 13, minZ: 40, maxZ: 45 });
  settlers.bonus = null;
  ok('University: 1.5 x 1.2', Math.abs(settlers.bonusFor(quarry.id) - 1.8) < 1e-9);
  ok('no worker: 1', settlers.bonusFor(9999) === 1);
}

// Health grows with strength; a new villager heals to their own maximum.
{
  const { settlers, p, add } = setup();
  ok('level 1 health is 10', settlers.maxHp(p) === 10);
  add('barracks', { minX: 30, maxX: 36, minY: 11, maxY: 13, minZ: 30, maxZ: 36 }, { tier: 2 });
  settlers.bonus = null;
  ok('a Fortress Barracks: strength 24, health 21', settlers.statsOf(p).strength === 24 && settlers.maxHp(p) === 21);
  p.hp = 10;
  for (let i = 0; i < 400; i++) settlers.tick(0.1);
  ok('heals to the new maximum', p.hp === 21);
}

// Builders: experience per block and a quicker swing.
{
  const { settlers, p, structures, world, inventory, add } = setup();
  const jobs = new VillagerJobs({ world, settlers, structures, inventory });
  add('work_hall', { minX: 50, maxX: 54, minY: 11, maxY: 13, minZ: 50, maxZ: 54 });
  const hall = structures.list().find((s) => s.type === 'work_hall');
  jobs.assign(p.id, 'builder', hall.id);
  ok('level 1 builds at speed 1', jobs.buildSpeed(p) === 1);
  p.xp = 4500;
  ok('level 10 builds at 1.54', Math.abs(jobs.buildSpeed(p) - 1.54) < 1e-9);
  p.xp = 0;
  const level = settlers.addXp(p, 'block');
  ok('a block built is half an xp', level === 0 && p.xp === 0.5);
  ok('a person with no settlers object builds at speed 1', new VillagerJobs({ world, settlers: null, structures, inventory }).buildSpeed(p) === 1);
  ok('a waiting builder is not busy, a building one is', !jobs.busy({ status: 'Waiting for a building order' }) && jobs.busy({ status: 'Building House (3/40)' }) && jobs.busy({ status: 'Carrying 4 Stone' }) && !jobs.busy({ status: 'Carrying goods — waiting for store space' }));
}

// --- save and load -----------------------------------------------------------
{
  const { settlers, p } = setup();
  p.xp = 1234.56; p.weapon = 'sword_iron';
  const data = JSON.parse(JSON.stringify(settlers.toJSON()));
  ok('saved: xp to a tenth, weapon', data.people[0].xp === 1234.6 && data.people[0].weapon === 'sword_iron');
  const again = setup(9);
  again.settlers.people.length = 0;
  again.settlers.loadJSON(data);
  const q = again.settlers.people[0];
  ok('loaded: same xp, same level, same weapon', q.xp === 1234.6 && again.settlers.statsOf(q).level === 5 && q.weapon === 'sword_iron');
  // An old save has neither field: level 1, no weapon.
  const old = JSON.parse(JSON.stringify(data));
  delete old.people[0].xp; delete old.people[0].weapon;
  const third = setup(11);
  third.settlers.people.length = 0;
  third.settlers.loadJSON(old);
  const o = third.settlers.people[0];
  ok('old save: level 1, 0 xp, no weapon', o.xp === 0 && third.settlers.statsOf(o).level === 1 && o.weapon === null);
  // Bad values are ignored.
  const bad = JSON.parse(JSON.stringify(data));
  bad.people[0].xp = 'lots'; bad.people[0].weapon = 'apple';
  const fourth = setup(12);
  fourth.settlers.people.length = 0;
  fourth.settlers.loadJSON(bad);
  ok('bad xp and a non-weapon are dropped', fourth.settlers.people[0].xp === 0 && fourth.settlers.people[0].weapon === null);
  ok('loadXp clamps, ignores negatives and NaN', loadXp({ xp: 1e9 }).xp === 4500 && loadXp({ xp: -4 }).xp === 0 && loadXp({ xp: NaN }).xp === 0 && loadXp(null).xp === 0);
  // The save carries no level of its own to go stale.
  ok('the level is worked out, not stored', !('level' in data.people[0]));
}

process.exit(f ? 1 : 0);
