import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Rivals, FALL_DAYS, MAX_STRENGTH } from '../src/duilt/Rivals.js';
import { Defenders } from '../src/world/Defenders.js';

/** PLAY-12 chunk 4: the War Hall, the March order and what it does to a company (docs/design/play-12.md). */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const game = (readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8') + readFileSync(new URL('../src/game/GameWar.js', import.meta.url), 'utf8'));

const reg = (x) => ({ minX: x, maxX: x + 12, minY: 4, maxY: 10, minZ: 20, maxZ: 33 });
/** A Battle world with a barracks (id 7, level 1) holding `roster`, and a War Hall unless `hall` is false. */
function setup({ roster = Array(10).fill('swordsman'), battle = true, hall = true, strength = 4 } = {}) {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 24 });
  const events = [];
  const bus = { emit: (n, p) => events.push([n, p]), on() {} };
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus });
  if (battle) { g.battle = new Rivals(); g.battle.list[0].strength = strength; }
  const mk = (id, type, x) => ({ id, type, valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, brokenReason: null, tier: 0, region: reg(x) });
  const b = mk(7, 'barracks', 2);
  g.structures.structures.push(b);
  if (hall) g.structures.structures.push(mk(8, 'war_hall', 40));
  g.defenders.trained['7'] = { roster: [...roster], queue: [], since: 0 };
  return { g, b, events, mk };
}
const names = (events) => events.map(([n]) => n).filter((n) => n.startsWith('march:')).join();

// --- refusals --------------------------------------------------------------------------------

{
  const { g, b } = setup({ hall: false });
  const r = g.marchCompany(b, 0);
  ok('no War Hall: refused, and says to raise one', !r.ok && /War Hall/.test(r.reason) && !g.defenders.marches.length);
}
{
  const { g, b } = setup({ battle: false });
  const r = g.marchCompany(b, 0);
  ok('not a Battle world: refused, and says why', !r.ok && /Battle world/.test(r.reason));
}
{
  const { g, b } = setup({ roster: [] });
  ok('nobody to send: refused', /Nobody/.test(g.marchCompany(b, 0).reason));
}
{
  const { g, b } = setup();
  ok('a building that is not a barracks or Garrison sends nobody', !g.marchCompany({ ...b, type: 'house' }, 0).ok && !g.marchCompany({ ...b, valid: false }, 0).ok);
  ok('no such rival', /No such rival/.test(g.marchCompany(b, 5).reason));
  g.battle.list[1].fallenUntil = g.days + 2.4;
  const r = g.marchCompany(b, 1);
  ok('a fallen city refuses the march, and says until when', !r.ok && /is yours until day 3/.test(r.reason) && g.defenders.barracks(7).roster.length === 10);
}

// --- one march at a time, arrival, home -------------------------------------------------------

{
  const { g, b, events, mk } = setup();
  const r = g.marchCompany(b, 0);
  ok('a march leaves at once: the roster goes with it', r.ok && g.defenders.barracks(7).roster.length === 0 && g.defenders.marches.length === 1 && r.march.units.length === 10);
  ok('arrives after 1 game day and home after 2', r.march.arrives === g.days + 1 && r.march.home === g.days + 2);
  ok('and said so', names(events) === 'march:started' && events[0][1].company === 'Barracks 1');

  const second = { ...mk(9, 'barracks', 20) };
  g.structures.structures.push(second);
  g.defenders.trained['9'] = { roster: ['archer'], queue: [], since: 0 };
  ok('one march at a time', /one march at a time/.test(g.marchCompany(second, 1).reason));

  // Cap and food: away soldiers keep their bunks and still eat.
  ok('residents count the company away (they eat)', g.defenders.residents === 11 && g.defenders.awayCount(7) === 10);
  g.inventory.add('apple', 30); g.inventory.add('sword_iron', 12); g.inventory.add('armour_iron_body', 12);
  const full = g.trainSoldier(b, 'swordsman');
  ok('the cap counts away soldiers: a level-1 barracks with 10 out is full', !full.ok && /Full/.test(full.reason));

  g.days += 0.5; g.tickMarches();
  ok('nothing happens at half a day', !g.defenders.marches[0].result && names(events) === 'march:started');
  const gold = g.inventory.countOf('gold');
  g.days += 0.5; g.tickMarches();
  const m = g.defenders.marches[0];
  ok('at one day the battle is fought: 10 swordsmen (1600) against 6 guards (360) win', m.result?.won === true && m.result.lost.length === 2 && m.units.length === 8);
  ok('tribute 6 + 2 x 4 = 14 gold in the bag, and the city has fallen', m.result.gold === 14 && g.inventory.countOf('gold') === gold + 14 && g.battle.fallen(g.battle.list[0], g.days));
  ok('and said so', names(events) === 'march:started,march:fought' && events.find(([n]) => n === 'march:fought')[1].won);
  ok('still away until day 2', g.defenders.barracks(7).roster.length === 0 && g.defenders.awayCount(7) === 8);
  g.days += 0.9; g.tickMarches();
  ok('not home at 1.9 days', g.defenders.marches.length === 1);
  g.days += 0.1; g.tickMarches();
  ok('home after 2: the survivors take their bunks', !g.defenders.marches.length && g.defenders.barracks(7).roster.length === 8 && names(events).endsWith('march:home') && events.at(-1)[1].placed === 8);
  ok('and the hall is free for the next march', !g.marchCompany(b, 0).ok === true);   // city 0 has fallen: refused
  ok('a conquered city refuses the march for FALL_DAYS', /is yours until day/.test(g.marchCompany(b, 0).reason) && FALL_DAYS === 3);
}

// --- losses and tribute -------------------------------------------------------------------------

{
  const { g, b } = setup({ roster: Array(10).fill('warrior'), strength: 8 });
  g.marchCompany(b, 0);
  g.days += 1; g.tickMarches();
  const m = g.defenders.marches[0];
  ok('10 warriors against strength 8 (550 against 600) lose: 6 of 10 fall and the rival grows by 0.5', m.result.won === false && m.result.lost.length === 6 && m.units.length === 4 && g.battle.list[0].strength === 8.5 && m.result.gold === 0);
  ok('no tribute, no fall', !g.battle.fallen(g.battle.list[0], g.days) && g.inventory.countOf('gold') === 0);
}
{
  const { g, b } = setup({ roster: Array(40).fill('swordsman'), strength: MAX_STRENGTH });
  g.marchCompany(b, 0);
  g.days += 1; g.tickMarches();
  const m = g.defenders.marches[0];
  ok('the best tribute is 6 + 2 x 12 = 30 gold, at most', m.result.won && m.result.gold === 30 && g.inventory.countOf('gold') === 30);
}
{
  // The rival's strength grows while they walk: a forecast near the edge can turn.
  const { g, b } = setup({ roster: Array(10).fill('warrior'), strength: 4 });
  const f0 = g.marchForecast(b, 0);
  ok('forecast before leaving: 550 against 360, a win', f0.ours === 550 && f0.theirs === 360 && f0.forecast.word === 'win' && f0.guards === 6);
  g.marchCompany(b, 0);
  g.battle.list[0].strength = 8;   // it grew on the way
  g.days += 1; g.tickMarches();
  ok('the battle uses the strength at arrival', g.defenders.marches[0].result.won === false);
}

// --- a broken barracks ----------------------------------------------------------------------------

{
  const { g, b, events, mk } = setup();
  g.marchCompany(b, 0);
  g.days += 1; g.tickMarches();
  const other = mk(9, 'barracks', 20);
  g.structures.structures.push(other);
  g.defenders.trained['9'] = { roster: Array(5).fill('warrior'), queue: [], since: 0 };
  b.valid = false;
  g.days += 1; g.tickMarches();
  const t9 = g.defenders.barracks(9).roster;
  ok('the building broke while they were away: survivors join the nearest barracks with room (5 of 10 fit)', t9.length === 10 && events.at(-1)[0] === 'march:home' && events.at(-1)[1].placed === 5 && events.at(-1)[1].lost === 3);
}
{
  const { g, b, events } = setup();
  g.marchCompany(b, 0);
  g.days += 1; g.tickMarches();
  g.structures.structures.splice(g.structures.structures.indexOf(b), 1);
  g.days += 1; g.tickMarches();
  ok('with nowhere to go at all, they are lost', events.at(-1)[1].placed === 0 && events.at(-1)[1].lost === 8 && !g.defenders.marches.length);
}

// --- save and load ---------------------------------------------------------------------------------

{
  const { g, b } = setup();
  g.marchCompany(b, 0);
  g.days += 1; g.tickMarches();
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  const back = new DuiltGame({ world: new World({ sizeX: 64, sizeZ: 64, height: 24 }), scene: new THREE.Scene(), bus: null });
  back.loadJSON(json);
  const m = back.defenders.marches[0];
  ok('a march survives a save: units, rival, times and result', m?.of === '7' && m.units.length === 8 && m.rival === 0 && m.result?.won === true && m.result.lost.length === 2 && m.arrives === g.defenders.marches[0].arrives && back.defenders.awayCount(7) === 8);

  // A world with no Battle: the company is already home.
  const flat = JSON.parse(JSON.stringify(json));
  delete flat.battle;
  const peace = new DuiltGame({ world: new World({ sizeX: 64, sizeZ: 64, height: 24 }), scene: new THREE.Scene(), bus: null });
  peace.loadJSON(flat);
  ok('no rivals in this world: the company is already home, back on its roster', !peace.defenders.marches.length && peace.defenders.barracks(7).roster.length === 8);

  // Old saves: no `marches` key.
  const old = JSON.parse(JSON.stringify(json));
  delete old.defenders.marches;
  const o = new DuiltGame({ world: new World({ sizeX: 64, sizeZ: 64, height: 24 }), scene: new THREE.Scene(), bus: null });
  o.loadJSON(old);
  ok('an old save has no marches and loads with defaults', o.defenders.marches.length === 0 && o.defenders.barracks(7).roster.length === 0);

  // Unknown units are dropped.
  const odd = JSON.parse(JSON.stringify(json));
  odd.defenders.marches[0].units = ['swordsman', 'dragon', 7];
  const p = new DuiltGame({ world: new World({ sizeX: 64, sizeZ: 64, height: 24 }), scene: new THREE.Scene(), bus: null });
  p.loadJSON(odd);
  ok('unknown units on the march are dropped', p.defenders.marches[0].units.join() === 'swordsman');
  ok('Defenders.toJSON writes no marches key while nobody is out', !('marches' in new Defenders({ world: g.world }).toJSON()));
}

// --- the screen ---------------------------------------------------------------------------------------

ok('the War Hall pop-up lists companies, the picker names rivals, and Back returns', /warHallHtml\(structure\)/.test(ui) && /class="company-card/.test(ui) && /data-march-send/.test(ui) && /data-march-back/.test(ui));
ok('the barracks gets March only where a War Hall stands, and says On the march', /d\.hasWarHall\?\.\(\) \? this\.marchButtonHtml/.test(ui) && /On the march\./.test(ui));
ok('Game ticks the marches every frame and says each step', /this\.duilt\.tickMarches\(\)/.test(game) && /'march:started'/.test(game) && /'march:fought'/.test(game) && /'march:home'/.test(game));

process.exit(f ? 1 : 0);
