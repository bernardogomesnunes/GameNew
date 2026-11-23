// PLAY-13 chunk 2: settlers use the mood rules.
import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { Settlers } from '../src/duilt/Settlers.js';
import { VillagerJobs } from '../src/duilt/VillagerJobs.js';
import { SETTLERS } from '../src/config/settlers.js';
import { MOOD_DAY } from '../src/config/mood.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const DAY = MOOD_DAY;

function setup({ houses = 7, food = 1000, hall = true, rand: seed = 1 } = {}) {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) {
    world.setBlock(x, 10, z, 1);
    world.surfaceHeightMap[x * 64 + z] = 11;
  }
  const inventory = new Inventory({ slots: 60 });
  const structures = new StructureRegistry({ world, bus: null, inventory });
  let nextId = 1;
  const add = (type, region) => {
    const s = { id: nextId++, type, region, valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, brokenReason: null };
    structures.structures.push(s);
    return s;
  };
  const houseList = [];
  for (let i = 0; i < houses; i++) houseList.push(add('house', { minX: 4 + (i % 7) * 8, maxX: 8 + (i % 7) * 8, minY: 11, maxY: 14, minZ: 4, maxZ: 8 }));
  const hallStructure = hall ? add('work_hall', { minX: 50, maxX: 54, minY: 11, maxY: 14, minZ: 50, maxZ: 54 }) : null;
  if (food) inventory.add('vegetables', food);
  let r = seed;
  const rand = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
  const events = [];
  const bus = { emit: (n, e) => events.push([n, e]) };
  const settlers = new Settlers({ world, structures, inventory, skills: { settlerAllowance: () => 0 }, bus, rand });
  const jobs = new VillagerJobs({ world, settlers, structures, inventory, bus });
  const fill = () => { while (settlers.hasRoom) settlers.arrive(); };
  const employ = () => { for (const p of settlers.people) if (!jobs.controls(p) && hallStructure) jobs.assign(p.id, 'hauler', hallStructure.id); };
  return { world, inventory, structures, settlers, jobs, add, houseList, hallStructure, events, bus, fill, employ };
}
const run = (settlers, seconds, dt = 3, each = null) => { for (let t = 0; t < seconds; t += dt) { settlers.tick(dt); each?.(t + dt); } };

// A well-run town of 6 reaches 100 by day 3 and stays there for 30 days.
{
  const { settlers, fill, employ } = setup();
  fill(); employ();
  ok('six arrive at 70', settlers.population === 6 && settlers.people.every((p) => p.mood === 70));
  let min = 100, minAfter3 = 100, left = 0;
  settlers.bus = { emit: (n) => { if (n === 'settler:left') left++; } };
  run(settlers, 30 * DAY, 3, (t) => {
    for (const p of settlers.people) { min = Math.min(min, p.mood); if (t >= 3 * DAY + 3) minAfter3 = Math.min(minAfter3, p.mood); }
  });
  ok('all at 100 from day 3 over 30 game days', minAfter3 > 99.99 && settlers.people.every((p) => p.mood === 100));
  ok('nobody leaves a well-run town', settlers.population === 6 && left === 0);
  ok('and nobody is below Content', settlers.people.every((p) => p.band === 'content' && p.said === null));
}

// Missing every third meal by a full day never goes below 75.
{
  const { settlers, inventory, fill, employ } = setup({ food: 0 });
  fill(); employ();
  let min = 100, left = 0;
  settlers.bus = { emit: (n) => { if (n === 'settler:left') left++; } };
  let day = -1;
  run(settlers, 30 * DAY, 3, (t) => {
    const d = Math.floor(t / DAY);
    if (d !== day) {
      day = d;
      const have = inventory.countOf('vegetables');
      if (d % 3 === 0 && have) inventory.remove('vegetables', have);
      else if (d % 3 !== 0 && !have) inventory.add('vegetables', 1000);
    }
    if (t >= 3 * DAY) for (const p of settlers.people) min = Math.min(min, p.mood);
  });
  ok(`missing every third meal stays at 75 or more (min ${min.toFixed(1)})`, min >= 75);
  ok('and nobody leaves', settlers.population === 6 && left === 0);
}

// An unfed newcomer with a job leaves at about day 3.5.
{
  const { settlers, inventory, fill, employ, events } = setup({ houses: 2, food: 0 });
  fill(); employ();
  const p = settlers.people[0];
  p.hungry = true; p.wasHungry = true;
  let at = null;
  settlers.bus = { emit: (n, e) => { events.push([n, e]); if (n === 'settler:left' && at == null) at = settlers._t / DAY; } };
  settlers._t = 0;
  for (let t = 0; t < 8 * DAY && settlers.population; t += 3) { settlers._t = t + 3; settlers.tick(3); }
  ok(`unfed newcomer leaves at day 3.5 (day ${at?.toFixed(2)})`, at != null && Math.abs(at - 3.55) < 0.15);
  const left = events.find(([n]) => n === 'settler:left')?.[1];
  ok('the event says why', left?.reason === 'angry' && left.cause === 'food' && left.name === 'Ana');
  void inventory;
}

// Through the real meal path: no food from the start leaves at day 5.
{
  const { settlers, fill, employ } = setup({ houses: 2, food: 0 });
  fill(); employ();
  let at = null;
  settlers.bus = { emit: (n) => { if (n === 'settler:left' && at == null) at = settlers._t / DAY; } };
  for (let t = 0; t < 8 * DAY && settlers.population; t += 3) { settlers._t = t + 3; settlers.tick(3); }
  ok(`first meal missed at day 1: leaves at day 5 (day ${at?.toFixed(2)})`, at != null && Math.abs(at - 5.05) < 0.2);
}

// The house stays empty for 2 days; nobody replaces the leaver sooner.
{
  const { settlers, fill, employ, houseList } = setup({ houses: 2, food: 0 });
  fill(); employ();
  const p = settlers.people[0];
  settlers.leave(p, 'angry');
  ok('house is marked empty', settlers.emptyHouses.has(houseList[1].id) || settlers.emptyHouses.has(p.homeId));
  ok('no room while it stands empty', settlers.hasRoom === false);
  run(settlers, 1.9 * DAY, 3);
  ok('nobody arrives in the first 1.9 days', settlers.population === 0);
  run(settlers, 0.2 * DAY, 3);
  ok('after 2 days somebody moves in, at 70', settlers.population === 1 && settlers.people[0].mood >= 70 && settlers.people[0].mood <= 71);
}

// No arrivals while the average is under 40, until 45.
{
  const { settlers, fill, employ } = setup({ houses: 6 });
  fill(); employ();
  for (const p of settlers.people.slice(0, 3)) { p.mood = 30; p.band = 'angry'; }
  settlers.people[0].mood = 30;
  const first = settlers.population;
  // make room: 2 houses more
  settlers.people.pop(); settlers.people.pop();
  run(settlers, 20, 2);
  ok('average under 40: nobody arrives', settlers.arrivalsStopped && settlers.population === first - 2);
  ok('and it says why', /word has got round/i.test(settlers.blockedReason() ?? ''));
  for (const p of settlers.people) { p.mood = 42; p.band = 'grumbling'; }
  run(settlers, 20, 2);
  ok('at 42 still nobody (resume at 45)', settlers.arrivalsStopped && settlers.population === first - 2);
  for (const p of settlers.people) { p.mood = 50; p.band = 'grumbling'; }
  run(settlers, 20, 2);
  ok('at 50 arrivals resume', !settlers.arrivalsStopped && settlers.population > first - 2);
}

// Saves: new fields round-trip; an old save loads at 80 with idleFor 0.
{
  const { settlers, fill, employ } = setup({ houses: 4 });
  fill(); employ();
  run(settlers, DAY / 3, 3);
  settlers.people[0].said = 'angry';
  settlers.emptyHouses.set(99, 1234);
  const json = JSON.parse(JSON.stringify(settlers.toJSON()));
  ok('toJSON carries mood, idleFor, furiousFor, said', json.people.every((p) => typeof p.mood === 'number' && 'idleFor' in p && 'furiousFor' in p && 'said' in p));
  ok('and emptyHouses', json.emptyHouses.length === 1 && json.emptyHouses[0][1] === 1234);
  const copy = setup({ houses: 4 });
  copy.settlers.loadJSON(json);
  ok('mood round-trips', copy.settlers.people.every((p, i) => Math.abs(p.mood - json.people[i].mood) < 0.01) && copy.settlers.people[0].said === 'angry');
  ok('empty houses that are gone are dropped', !copy.settlers.emptyHouses.has(99));

  const old = JSON.parse(JSON.stringify(settlers.toJSON()));
  for (const p of old.people) { delete p.mood; delete p.idleFor; delete p.furiousFor; delete p.said; }
  delete old.emptyHouses;
  const loaded = setup({ houses: 4 });
  loaded.settlers.loadJSON(old);
  ok('an old save loads at mood 80, idleFor 0, said null', loaded.settlers.people.length === 3
    && loaded.settlers.people.every((p) => p.mood === 80 && p.idleFor === 0 && p.said === null && p.band === 'content'));
  loaded.settlers.tick(5);
  ok('and nobody is below Content after loading', loaded.settlers.people.every((p) => p.band === 'content'));
}

// Grumbling halves the work bonus, Angry removes it.
{
  const { settlers, add, fill } = setup({ houses: 3 });
  const quarry = add('quarry', { minX: 20, maxX: 25, minY: 11, maxY: 13, minZ: 20, maxZ: 25 });
  fill();
  const w = settlers.people.find((p) => p.workId === quarry.id);
  ok('content worker: +50%', w && settlers.bonusFor(quarry.id) === 1 + SETTLERS.workBonus);
  w.band = 'grumbling';
  ok('grumbling: +25%', settlers.bonusFor(quarry.id) === 1.25);
  w.band = 'angry';
  ok('angry: no bonus', settlers.bonusFor(quarry.id) === 1 && !settlers.staffedIds().has(quarry.id));
  ok('but the job is still theirs', w.workId === quarry.id);
}

// Builders: Grumbling takes 1.5 times as long, Angry stops, owe skips Angry.
{
  const make = (band) => {
    const t = setup({ houses: 2, food: 0 });
    t.fill(); t.employ();
    const p = t.settlers.people[0];
    t.jobs.assign(p.id, 'builder', t.hallStructure.id);
    p.band = band; p.x = 20.5; p.z = 20.5; p.y = 11;
    t.inventory.add('planks', 20);
    const plan = { name: 'Wall', type: 'house', region: { minX: 22, maxX: 30, minY: 11, maxY: 11, minZ: 20, maxZ: 20 }, changes: [] };
    for (let x = 22; x <= 30; x++) plan.changes.push({ x, y: 11, z: 20, prev: 0, next: 7 });
    const r = t.jobs.enqueueBuild(plan);
    if (!r.ok) console.log('enqueue:', r.reason);
    return { ...t, p, job: r.job, ok: r.ok };
  };
  const placed = (t, secs) => { for (let i = 0; i < secs * 10; i++) t.jobs.tick(0.1); return t.job.cursor; };
  const a = make('content'), b = make('grumbling'), c = make('angry');
  const ca = placed(a, 12), cb = placed(b, 12), cc = placed(c, 12);
  ok('queued', a.ok && b.ok && c.ok);
  ok(`content builds (${ca}), grumbling is slower (${cb}), angry places nothing (${cc})`, ca > cb && cb > 0 && cc === 0);
  ok('grumbling rate near 1/1.5 of content', cb / ca > 0.5 && cb / ca < 0.85);
  ok('the angry builder says so', /refusing/i.test(c.jobs.assignment(c.p.id).status));
  c.jobs.owe(60000);
  const d = make('content');
  d.jobs.owe(60000);
  ok('owe skips an angry builder, counts a content one', !(c.jobs.owedSeconds > 0) && d.jobs.owedSeconds > 0);
}

// Leaving returns cargo to the hall and drops the assignment.
{
  const { settlers, fill, employ, jobs, hallStructure } = setup({ houses: 3 });
  fill(); employ();
  const p = settlers.people[0];
  jobs.assignment(p.id).carrying = { item: 'stone', count: 5 };
  settlers.leave(p, 'angry');
  ok('cargo is in the hall supplies', jobs.supplyForHall(hallStructure.id).countOf('stone') === 5);
  ok('the assignment is gone and so is the villager', !jobs.assignment(p.id) && !settlers.people.includes(p));
}

// Bus: one settler:mood per band on the way down, none while climbing back.
{
  const { settlers, fill, events } = setup({ houses: 2, food: 0 });
  fill();
  const p = settlers.people[0];
  p.hungry = true; p.wasHungry = true;
  for (let t = 0; t < 3.2 * DAY; t += 3) settlers.tick(3);
  const said = events.filter(([n]) => n === 'settler:mood').map(([, e]) => e.band);
  ok(`announces grumbling, angry, furious once each (${said.join(',')})`, said.join() === 'grumbling,angry,furious');
  ok('with the reason', events.filter(([n]) => n === 'settler:mood').every(([, e]) => e.reason === 'food'));
}

console.log(f ? `${f} FAILED` : 'ok');
process.exit(f ? 1 : 0);
