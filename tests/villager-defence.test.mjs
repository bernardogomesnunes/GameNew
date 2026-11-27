// VIL-6: when raiders come, villagers fight. Armed villagers strike with the
// weapon you gave them, scaled by strength; unarmed ones punch what is in
// reach or run home. Soldiers are not touched by any of it.
import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { Settlers } from '../src/duilt/Settlers.js';
import { VillagerJobs } from '../src/duilt/VillagerJobs.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { DEFENCE } from '../src/config/levels.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { attackOf, punchDamage, maxHp, weaponId } from '../src/duilt/Levels.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// --- the numbers ------------------------------------------------------------
ok('strength 10 punches for 1, strength 100 for 5.5', near(punchDamage(10), 1) && near(punchDamage(100), 5.5));
ok('health: 10 at strength 10, 32 at 40, 78 at 100', maxHp(10) === 10 && maxHp(40) === 33 && maxHp(100) === 78);
ok('a wooden sword at strength 10 hits for its own 4', near(attackOf('sword_wood', 10).damage, 4));
ok('an iron sword hits for 9 at strength 10, 15.75 at 40, 29.25 at 100', near(attackOf('sword_iron', 10).damage, 9) && near(attackOf('sword_iron', 40).damage, 15.75) && near(attackOf('sword_iron', 100).damage, 29.25));
ok('a bow shoots from 14 blocks for 4 at strength 10', attackOf('bow', 10).ranged && attackOf('bow', 10).range === 14 && near(attackOf('bow', 10).damage, 4));
ok('a sword closes to melee reach', !attackOf('sword_stone', 10).ranged && attackOf('sword_stone', 10).reach === 1.8);
ok('no weapon, or a non-weapon, is a punch', attackOf(null, 10).weapon === null && attackOf('apple', 10).weapon === null && weaponId('apple') === null && weaponId('sword_wood') === 'sword_wood');
ok('weapons by damage: wood < stone < iron', attackOf('sword_wood', 10).damage < attackOf('sword_stone', 10).damage && attackOf('sword_stone', 10).damage < attackOf('sword_iron', 10).damage);

// --- a village ----------------------------------------------------------------
function setup(seed = 3) {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) { world.setBlock(x, 10, z, 1); world.surfaceHeightMap[x * 64 + z] = 11; }
  const inventory = new Inventory({ slots: 60 });
  const structures = new StructureRegistry({ world, bus: null, inventory });
  let id = 1;
  const add = (type, region, extra = {}) => structures.structures.push({ id: id++, type, region, valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, brokenReason: null, ...extra });
  for (let i = 0; i < 2; i++) add('house', { minX: 4 + i * 10, maxX: 8 + i * 10, minY: 11, maxY: 14, minZ: 4, maxZ: 8 });
  let r = seed;
  const rand = () => { r = (r * 1103515245 + 2000) % 2147483648; return r / 2147483648; };
  const events = [];
  const bus = { emit: (n, e) => events.push([n, e]) };
  const settlers = new Settlers({ world, structures, inventory, skills: { settlerAllowance: () => 0 }, bus, rand });
  settlers.arrive();
  const p = settlers.people[0];
  p.x = 30.5; p.z = 30.5; p.y = 11; p.wait = 100; p.target = null;
  const blows = [];
  settlers.strike = (foe, damage, by) => { blows.push({ foe, damage, by }); foe.hp -= damage; if (foe.hp <= 0) foe.dead = true; };
  return { settlers, structures, inventory, events, p, add, world, blows, rand };
}
const raider = (x, z, hp = 22) => ({ x, y: 11, z, hp });
const run = (settlers, seconds) => { for (let t = 0; t < seconds; t += 0.1) settlers.tick(0.1); };

// Nothing to fight: nothing changes.
{
  const { settlers, p, blows } = setup();
  p.weapon = 'sword_iron';
  run(settlers, 5);
  ok('no raiders: not fighting, no blows', !p.fighting && blows.length === 0);
}

// An armed villager goes for a raider and kills it with the weapon's damage.
{
  const { settlers, p, blows } = setup();
  p.weapon = 'sword_iron';
  const foe = raider(40.5, 30.5);
  settlers.threats = [foe];
  let closest = Infinity;
  for (let t = 0; t < 30; t += 0.1) { settlers.tick(0.1); closest = Math.min(closest, Math.hypot(p.x - foe.x, p.z - foe.z)); }
  ok('armed: fought', blows.length > 0);
  ok('armed: every blow is the iron sword at strength 10 (9)', blows.every((b) => near(b.damage, 9)));
  ok('armed: 22 hp takes 3 blows', blows.length === 3 && foe.dead === true);
  ok('armed: they walked up to it', closest < 2);
  ok('the blow is credited to the villager', blows.every((b) => b.by === p));
  settlers.threats = [];
  run(settlers, 1);
  ok('raider gone: back to normal', !p.fighting);
}

// Strength makes the same sword hit harder; buildings count too.
{
  const a = setup(), b = setup(4);
  a.p.weapon = b.p.weapon = 'sword_iron';
  b.p.xp = 4500;
  b.add('barracks', { minX: 50, maxX: 56, minY: 11, maxY: 13, minZ: 50, maxZ: 56 }, { tier: 2 });
  b.add('war_hall', { minX: 50, maxX: 56, minY: 11, maxY: 13, minZ: 40, maxZ: 46 });
  b.settlers.bonus = null;
  for (const s of [a, b]) { s.settlers.threats = [raider(s.p.x + 1.5, s.p.z, 1000)]; run(s.settlers, 3); }
  ok('level 10 with a Fortress Barracks and a War Hall: strength 58', b.settlers.statsOf(b.p).strength === 58);
  ok('the stronger villager hits harder with the same sword', b.blows[0].damage > a.blows[0].damage * 2);
  ok('level 10 plus both buildings: 9 x (0.75 + 58/40) = 19.8', near(b.blows[0].damage, 9 * (0.75 + 58 * 0.025)));
}

// A bow shoots from range and does not close in.
{
  const { settlers, p, blows } = setup();
  p.weapon = 'bow';
  const foe = raider(40.5, 30.5, 1000);
  settlers.threats = [foe];
  run(settlers, 10);
  ok('bow: shoots from where they stand, 10 blocks off', blows.length >= 4 && Math.hypot(p.x - foe.x, p.z - foe.z) > 5);
  ok('bow: 4 damage a shot', blows.every((b) => near(b.damage, 4)));
}

// Without a weapon: run home, punch only what is already in reach.
{
  const { settlers, p, blows } = setup();
  const home = settlers.outdoorSpot(p.homeId) ?? settlers.placeOf(p.homeId);
  const foe = raider(38.5, 30.5, 1000);
  settlers.threats = [foe];
  const d0 = Math.hypot(p.x - home.x, p.z - home.z);
  run(settlers, 4);
  const d1 = Math.hypot(p.x - home.x, p.z - home.z);
  ok('unarmed: runs towards home', d1 < d0 - 3);
  ok('unarmed: no blows from a distance', blows.length === 0);
  // Cornered
  const c = setup(5);
  c.settlers.threats = [raider(c.p.x + 1, c.p.z, 1000)];
  run(c.settlers, 4);
  ok('unarmed and cornered: punches for 1, about every 1.2 s', c.blows.length >= 3 && c.blows.every((b) => near(b.damage, 1)));
}

// Unarmed is weaker than armed, and punch damage grows with strength.
{
  const weak = setup(), strong = setup(6);
  strong.p.xp = 4500;
  strong.add('war_hall', { minX: 50, maxX: 56, minY: 11, maxY: 13, minZ: 40, maxZ: 46 });
  strong.settlers.bonus = null;
  for (const s of [weak, strong]) { s.settlers.threats = [raider(s.p.x + 1, s.p.z, 1000)]; run(s.settlers, 2); }
  ok('a strong unarmed villager punches harder', strong.blows[0].damage > weak.blows[0].damage * 2);
}

// Too hurt: an armed villager runs.
{
  const { settlers, p, blows } = setup();
  p.weapon = 'sword_iron';
  p.hp = 2; p.calm = 100;
  settlers.threats = [raider(p.x + 8, p.z, 1000)];
  run(settlers, 3);
  ok('below a quarter health, no charge', blows.length === 0);
}

// Out of the alarm range: they carry on.
{
  const { settlers, p, blows } = setup();
  p.weapon = 'sword_iron';
  settlers.threats = [raider(p.x + DEFENCE.alarm + 5, p.z)];
  run(settlers, 3);
  ok('a raider 21 blocks off is not their fight', !p.fighting && blows.length === 0);
  settlers.threats = [{ x: p.x + 2, y: 40, z: p.z, hp: 10 }];
  run(settlers, 1);
  ok('nor one on another level', !p.fighting);
  settlers.threats = [{ x: p.x + 2, y: 11, z: p.z, hp: 0 }, { x: p.x + 2, y: 11, z: p.z, hp: 5, dead: true }];
  run(settlers, 1);
  ok('nor the dead', !p.fighting);
}

// Sleeping: an armed villager wakes and fights, an unarmed one stays in bed.
{
  const a = setup(), b = setup(8);
  for (const s of [a, b]) { s.p.sleep = { state: 'asleep', stand: { x: s.p.x, y: s.p.y, z: s.p.z }, lie: { x: s.p.x, y: s.p.y, z: s.p.z, dir: { x: 0, z: 1 } } }; s.settlers.dark = true; s.settlers.night = () => true; s.settlers.threats = [raider(s.p.x + 6, s.p.z)]; }
  a.p.weapon = 'sword_stone';
  run(a.settlers, 3); run(b.settlers, 3);
  ok('armed sleeper wakes and fights', a.p.sleep === null && a.p.fighting);
  ok('unarmed sleeper stays in bed', b.p.sleep !== null && !b.p.fighting && b.blows.length === 0);
}

// A builder at the Work Hall stops building to fight.
{
  const { settlers, p, structures, world, inventory, add } = setup();
  const jobs = new VillagerJobs({ world, settlers, structures, inventory });
  add('work_hall', { minX: 50, maxX: 54, minY: 11, maxY: 13, minZ: 50, maxZ: 54 });
  jobs.assign(p.id, 'hauler', structures.list().find((s) => s.type === 'work_hall').id);
  p.weapon = 'sword_wood';
  settlers.threats = [raider(p.x + 1, p.z)];
  settlers.tick(0.1); jobs.tick(0.1);
  ok('a job holder fights; the Work Hall says so', p.fighting && jobs.assignment(p.id).status === 'Defending the village');
}

// Weapons: giving, swapping, taking back.
{
  const { settlers, p, inventory, events } = setup();
  inventory.add('sword_wood', 1); inventory.add('sword_iron', 1); inventory.add('apple', 2);
  ok('a non-weapon is refused', !settlers.arm(p, 'apple').ok && inventory.countOf('apple') === 2);
  ok('a weapon you do not have is refused', !settlers.arm(p, 'bow').ok);
  const r = settlers.arm(p, 'sword_wood');
  ok('arming takes it from the bag', r.ok && p.weapon === 'sword_wood' && inventory.countOf('sword_wood') === 0 && events.some(([n]) => n === 'settler:armed'));
  ok('the same one twice is refused', !settlers.arm(p, 'sword_wood').ok);
  const s = settlers.arm(p, 'sword_iron');
  ok('a second weapon swaps, the first back in the bag', s.ok && p.weapon === 'sword_iron' && inventory.countOf('sword_wood') === 1 && inventory.countOf('sword_iron') === 0);
  const d = settlers.disarm(p);
  ok('taking it back', d.ok && p.weapon === null && inventory.countOf('sword_iron') === 1);
  ok('nothing to take back', !settlers.disarm(p).ok);
  // A swap uses the slot the new weapon leaves; taking one back needs a free slot.
  const full = new Inventory({ slots: 1 });
  full.add('sword_iron', 1);
  p.weapon = 'sword_wood';
  const t = settlers.arm(p, 'sword_iron', full);
  ok('a full bag still swaps: the slot the new one leaves takes the old', t.ok && p.weapon === 'sword_iron' && full.countOf('sword_wood') === 1);
  const jam = new Inventory({ slots: 1 });
  jam.add('apple', 5);
  const u = settlers.disarm(p, jam);
  ok('a full bag: take-back refused, weapon stays', !u.ok && p.weapon === 'sword_iron' && jam.countOf('sword_iron') === 0);
}

// A weapon they asked for is theirs to fight with (VIL-2 gift).
{
  const { settlers, p, inventory } = setup();
  inventory.add('sword_iron', 1);
  p.ask = { item: 'sword_iron', kind: 'weapon', left: 1000 };
  const mood = p.mood = 50;
  const r = settlers.give(p, 'sword_iron');
  ok('asked-for sword: mood up and in their hand', r.ok && p.mood > mood && p.weapon === 'sword_iron' && inventory.countOf('sword_iron') === 0);
  inventory.add('sword_wood', 1);
  p.ask = { item: 'sword_wood', kind: 'weapon', left: 1000 };
  settlers.give(p, 'sword_wood');
  ok('a worse asked-for sword does not replace the better', p.weapon === 'sword_iron');
  inventory.add('bow', 1);
  inventory.add('apple', 1);
  p.ask = { item: 'apple', kind: 'food', left: 1000 };
  settlers.give(p, 'apple');
  ok('food does not touch the weapon', p.weapon === 'sword_iron');
}

// Hurt and health: a strong villager survives blows a weak one does not.
{
  const weak = setup(), strong = setup(6);
  strong.p.xp = 4500;
  strong.add('war_hall', { minX: 50, maxX: 56, minY: 11, maxY: 13, minZ: 40, maxZ: 46 });
  strong.settlers.bonus = null;
  ok('a weak villager dies to three 4-hit blows', (weak.settlers.hurt(weak.p, 4), weak.settlers.hurt(weak.p, 4), weak.settlers.hurt(weak.p, 4)) === true);
  strong.p.hp = strong.settlers.maxHp(strong.p);
  const hp = strong.p.hp;
  ok('a strong one with the same blows lives (health ' + hp + ')', hp >= 30 && strong.settlers.hurt(strong.p, 4) === false && strong.settlers.hurt(strong.p, 4) === false && strong.settlers.hurt(strong.p, 4) === false && strong.p.hp === hp - 12);
}

// Raiders: a bandit raid goes for a villager who fights, but ignores one who does not.
{
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) { world.setBlock(x, 10, z, 1); world.surfaceHeightMap[x * 64 + z] = 11; }
  const villager = { x: 32.5, y: 11, z: 30.5, hp: 10, name: 'Ada', fighting: false };
  const hits = [];
  const w = new Wanderers({
    world, rand: () => 0.5, hostile: () => true, night: () => true,
    villagers: () => [villager], onFoe: (p, foe, hits_) => hits.push([foe, hits_]),
  });
  const bandit = w.person('bandit', 30.5, 11, 30.5, { raider: true, stage: 'coming', settlement: { x: 30, z: 30 }, home: { x: 30, z: 30 } });
  bandit.cooldown = 0;
  w.list.push(bandit);
  for (let i = 0; i < 40; i++) w.tick(0.1, { x: 5, y: 11, z: 5 });
  const idle = hits.length;
  villager.fighting = true;
  for (let i = 0; i < 60; i++) w.tick(0.1, { x: 5, y: 11, z: 5 });
  ok('a raiding bandit leaves a non-fighting villager alone', idle === 0);
  ok('a raiding bandit hits back at a villager who is fighting it', hits.length > 0 && hits.every(([foe]) => foe === villager));
}

ok('weapons in the game are all known to the rules', [...ITEMS_BY_ID.values()].filter((i) => i.weapon).every((i) => weaponId(i.id) === i.id && attackOf(i.id, 10).damage > 0));

process.exit(f ? 1 : 0);
