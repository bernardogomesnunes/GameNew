// WORK-1 and WORK-3: a building makes goods only while a villager works there;
// old worlds get a 3-day grace; a new villager takes a building in their trade.
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { Settlers } from '../src/duilt/Settlers.js';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame, WORK_GRACE_DAYS } from '../src/duilt/DuiltGame.js';
import { TRADES, tradeFor, TRADE_IDS } from '../src/config/settlers.js';
import { STRUCTURES_BY_ID, makesGoods } from '../src/config/structures.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const HOUR = 3600_000;

// --- registry: an unworked building's clock stands still ---------------------
{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const reg = new StructureRegistry({ world, bus: null, inventory: new Inventory() });
  reg.structures.push({ id: 1, type: 'quarry', region: { minX: 0, maxX: 5, minY: 40, maxY: 42, minZ: 0, maxZ: 5 }, valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, brokenReason: null, excludes: [], tier: 0 });
  reg.nextId = 2;
  const s = reg.list()[0];
  const none = new Set(), me = new Set([1]);
  reg.collect({ now: 1000, worked: none });
  const a = reg.collect({ now: 1000 + 100 * HOUR, worked: none });
  ok('no worker: nothing made in 100 hours', Object.keys(a).length === 0);
  ok('no worker: nothing owed once somebody arrives', Object.keys(reg.collect({ now: 1001 + 100 * HOUR, worked: me })).length === 0);
  ok('no worker: the clock did not run', (1001 + 100 * HOUR) - s.lastPaidAt < 8 * HOUR);
  const t = s.lastPaidAt;
  const b = reg.collect({ now: t + 30 * HOUR, worked: me });
  ok('with a worker it makes goods', Object.keys(b).length > 0);
  s.lastPaidAt = 0; reg.lastCollectAt = 0;
  ok('worked = null runs every building (sandbox, grace)', Object.keys(reg.collect({ now: 30 * HOUR, worked: null })).length > 0);
}

// --- game: grace, notice, save/load ---------------------------------------------
const scene = new THREE.Scene();
const { world } = generateDuiltWorld({ sizeX: 96, sizeZ: 96, height: 64, seed: 4 });
for (let x = 0; x <= 5; x++) for (let z = 0; z <= 5; z++) {
  world.setBlock(x, 40, z, 3);
  world.setBlock(x, 41, z, x === 0 || x === 5 || z === 0 || z === 5 ? 3 : 0);
  for (let y = 42; y < 64; y++) world.setBlock(x, y, z, 0);
}
const quarryGame = (bus = null) => {
  const g = new DuiltGame({ world, scene, bus });
  const t = Date.now();
  g.structures.structures.push({ id: g.structures.nextId++, type: 'quarry', region: { minX: 0, maxX: 5, minY: 40, maxY: 42, minZ: 0, maxZ: 5 }, valid: true, locked: true, claimedAt: t, lastPaidAt: t, brokenReason: null, excludes: [], tier: 0 });
  return g;
};
{
  const g = quarryGame();
  const q = g.structures.list()[0];
  ok('new world: no grace', g.workGraceUntil === null && !g.workGrace);
  q.lastPaidAt -= 400 * HOUR;
  const gained = g.structures.collect({ now: Date.now(), worked: g.workedIds() });
  ok('new world: unstaffed quarry makes nothing', Object.keys(gained).length === 0);
  g.settlers.people.push({ id: 1, name: 'Ana', homeId: 99, workId: q.id, hungry: false, band: 'content', mood: 80 });
  ok('workedIds holds the staffed quarry', g.workedIds().has(q.id));
  q.lastPaidAt -= 400 * HOUR;
  ok('staffed quarry makes goods', Object.keys(g.structures.collect({ now: Date.now(), worked: g.workedIds() })).length > 0);
  g.settlers.people[0].hungry = true;
  ok('a hungry worker does not count', !g.workedIds().has(q.id));
  g.settlers.people[0].hungry = false; g.settlers.people[0].band = 'angry';
  ok('an angry worker does not count', !g.workedIds().has(q.id));
  const saved = g.toJSON();
  ok('save is marked as made with the rule', saved.staffedWork === true && saved.workGraceUntil === null);
  const back = new DuiltGame({ world, scene, bus: null });
  back.loadJSON(JSON.parse(JSON.stringify(saved)));
  ok('a new save loads with no grace', back.workGraceUntil === null);
}
{
  const g = quarryGame();
  g.days = 10;
  const old = JSON.parse(JSON.stringify(g.toJSON()));
  delete old.staffedWork; delete old.workGraceUntil; delete old.workGraceTold;
  const events = [];
  const bus = { emit: (n, e) => events.push([n, e]), on() {} };
  const back = new DuiltGame({ world, scene, bus });
  back.loadJSON(old);
  ok(`old save: grace runs ${WORK_GRACE_DAYS} days from the load`, back.workGraceUntil === back.days + WORK_GRACE_DAYS && back.workGrace);
  back.structures.list()[0].lastPaidAt -= 400 * HOUR;
  ok('old save: an unstaffed quarry still makes goods in the grace', Object.keys(back.structures.collect({ now: Date.now(), worked: back.workedIds() })).length > 0);
  back.tick(0.1); back.tick(0.1);
  const told = events.filter(([n, e]) => n === 'toast' && /need workers/.test(e.title));
  ok('old save: one notice that buildings will need workers', told.length === 1 && /villager works there/.test(told[0][1].body));
  const mid = JSON.parse(JSON.stringify(back.toJSON()));
  ok('the grace is recorded in the save', mid.staffedWork === true && mid.workGraceUntil === back.workGraceUntil && mid.workGraceTold === true);
  const again = new DuiltGame({ world, scene, bus });
  again.loadJSON(mid);
  ok('reloading keeps the same end day, not a fresh 3 days', again.workGraceUntil === back.workGraceUntil);
  events.length = 0;
  again.tick(0.1);
  ok('and does not repeat the notice', events.filter(([n]) => n === 'toast').length === 0);
  again.days += WORK_GRACE_DAYS - 0.5;
  ok('2.5 days on: still graced', again.workGrace);
  again.days += 1;
  again.tick(0.1);
  ok('after 3 days: grace over, noted once', !again.workGrace && again.workGraceUntil === null && events.filter(([n, e]) => n === 'toast' && /need workers now/.test(e.title)).length === 1);
  again.structures.list()[0].lastPaidAt -= 400 * HOUR;
  ok('after the grace an unstaffed quarry makes nothing', Object.keys(again.structures.collect({ now: Date.now(), worked: again.workedIds() })).length === 0);
}
{
  const g = new DuiltGame({ world, scene, bus: null, sandbox: true });
  ok('a sandbox always runs', g.workedIds() === null);
}

// --- WORK-3: trades ------------------------------------------------------------
ok('three trades', TRADE_IDS.join() === 'farmer,woodworker,engineer');
ok('trade of buildings', tradeFor('farm') === 'farmer' && tradeFor('pen') === 'farmer' && tradeFor('forest') === 'woodworker' && tradeFor('quarry') === 'engineer' && tradeFor('mine') === 'engineer' && tradeFor('market') === null);
ok('every listed building makes goods', Object.values(TRADES).every((t) => t.buildings.every((b) => makesGoods(STRUCTURES_BY_ID.get(b)))));
ok('a pen counts as making goods', makesGoods(STRUCTURES_BY_ID.get('pen')) && !makesGoods(STRUCTURES_BY_ID.get('house')));

function town() {
  const w = new World({ sizeX: 96, sizeZ: 64, height: 32 });
  for (let x = 0; x < 96; x++) for (let z = 0; z < 64; z++) { w.setBlock(x, 10, z, 1); w.surfaceHeightMap[x * 64 + z] = 11; }
  const inventory = new Inventory({ slots: 60 });
  const structures = new StructureRegistry({ world: w, bus: null, inventory });
  let id = 1;
  const add = (type, x, z, size = 4) => structures.structures.push({ id: id++, type, region: { minX: x, maxX: x + size, minY: 11, maxY: 14, minZ: z, maxZ: z + size }, valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, brokenReason: null, excludes: [], tier: 0 });
  add('work_hall', 50, 40);
  for (let i = 0; i < 5; i++) add('house', 4 + i * 8, 4);
  add('quarry', 10, 20); add('forest', 20, 20, 6); add('farm', 30, 20);
  let r = 7;
  const rand = () => { r = (r * 1103515245 + 2000) % 2147483648; return r / 2147483648; };
  const settlers = new Settlers({ world: w, structures, inventory, skills: { settlerAllowance: () => 0 }, bus: { emit() {} }, rand });
  return { settlers, structures };
}
{
  const { settlers, structures } = town();
  const types = new Map(structures.list().map((s) => [s.id, s.type]));
  const people = [];
  for (let i = 0; i < 3; i++) people.push(settlers.arrive());
  ok('three arrivals have the three trades', new Set(people.map((p) => p.trade)).size === 3);
  ok('each is working a building in their own trade', people.every((p) => p.workId != null && tradeFor(types.get(p.workId)) === p.trade));
  ok('nobody shares a building', new Set(people.map((p) => p.workId)).size === 3);
  const save = JSON.parse(JSON.stringify(settlers.toJSON()));
  ok('trade is saved', save.people.every((p) => TRADE_IDS.includes(p.trade)));
  const old = JSON.parse(JSON.stringify(save));
  for (const p of old.people) delete p.trade;
  const back = town().settlers;
  back.loadJSON(old);
  ok('an old save gets trades, one each', new Set(back.people.map((p) => p.trade)).size === 3);
  const again = town().settlers;
  again.loadJSON(save);
  ok('a saved trade is kept', again.people.every((p, i) => p.trade === people[i].trade));
}
{
  // Only a quarry stands free: a farmer (no farm) takes it rather than idle.
  const { settlers, structures } = town();
  structures.structures = structures.structures.filter((s) => !['forest', 'farm'].includes(s.type));
  const p = settlers.arrive();
  ok('no building in their trade: they take any free one', p.trade === 'farmer' && structures.list().find((s) => s.id === p.workId)?.type === 'quarry');
  const q = settlers.arrive();
  ok('the second finds nothing free and has no job', q.workId == null);
}
console.log(f ? `${f} failed` : 'all passed');
process.exit(f ? 1 : 0);
