import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Defenders, TOWER_ARCHER, blowOf, HUNGRY_STRENGTH } from '../src/world/Defenders.js';
import { UNITS_BY_ID, unitStats, unitCost, payForUnit, unitPower, towerArcherStats } from '../src/config/soldiers.js';
import { ITEMS_BY_ID } from '../src/config/items.js';

/** PLAY-12 chunk 3: what research does to a soldier (docs/design/play-12.md). */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const U = (id) => UNITS_BY_ID.get(id);
const R = (...ids) => Object.fromEntries(ids.map((i) => [i, true]));

// Each effect row.
ok('no research: the very same unit back, nothing mutated', unitStats(U('warrior'), {}) === U('warrior') && unitStats(U('warrior'), null) === U('warrior') && U('warrior').melee.hits === 3);
ok('Iron Arms: warrior blow 3 to 5, iron sword', unitStats(U('warrior'), R('arms_iron')).melee.hits === 5 && unitStats(U('warrior'), R('arms_iron')).gear.sword_iron === 1 && !unitStats(U('warrior'), R('arms_iron')).gear.sword_stone);
ok('Iron Arms leaves the others alone', unitStats(U('archer'), R('arms_iron')) === U('archer') && unitStats(U('swordsman'), R('arms_iron')) === U('swordsman'));
ok('Fletching: archer damage 3 to 4, range 20 to 24', unitStats(U('archer'), R('fletching')).ranged.damage === 4 && unitStats(U('archer'), R('fletching')).ranged.range === 24 && unitStats(U('archer'), R('fletching')).ranged.every === 2);
ok('Fletching: tower archers too', towerArcherStats(TOWER_ARCHER, R('fletching')).damage === TOWER_ARCHER.damage + 1 && towerArcherStats(TOWER_ARCHER, R('fletching')).range === TOWER_ARCHER.range + 4 && towerArcherStats(TOWER_ARCHER, {}) === TOWER_ARCHER);
ok('Shield Drill: swordsman hp 32 to 40, spear guard 30 to 38', unitStats(U('swordsman'), R('shield_drill')).hp === 40 && unitStats(U('shield_guard'), R('shield_drill')).hp === 38);
ok('Siege Works: stone every 4.5 s, setup 2.5 s', unitStats(U('crew'), R('siege_works')).siege.every === 4.5 && unitStats(U('crew'), R('siege_works')).siege.setup === 2.5 && unitStats(U('crew'), R('siege_works')).siege.range === 38);
ok('Sky Arms: swordsman blow 6, sky sword and iron cuirass', unitStats(U('swordsman'), R('arms_sky')).melee.hits === 6 && Object.keys(unitStats(U('swordsman'), R('arms_sky')).gear).sort().join() === 'armour_iron_body,sword_sky');
ok('Dark Arms: swordsman blow 7, dark sword', unitStats(U('swordsman'), R('arms_dark')).melee.hits === 7 && unitStats(U('swordsman'), R('arms_dark')).gear.sword_dark === 1);
ok('every gear id is a real item', ['sword_iron', 'sword_sky', 'sword_dark'].every((id) => ITEMS_BY_ID.has(id)));

// Power, from the design's table.
const P = (unit, ...ids) => Math.round(unitPower(unitStats(U(unit), R(...ids))));
ok('power today: warrior 55, swordsman 160, spear guard 96, archer 42, crew 60', [P('warrior'), P('swordsman'), P('shield_guard'), P('archer'), P('crew')].join() === '55,160,96,42,60');
ok('power with research: 91, 200, 122, 56, 80', [P('warrior', 'arms_iron'), P('swordsman', 'shield_drill'), P('shield_guard', 'shield_drill'), P('archer', 'fletching'), P('crew', 'siege_works')].join() === '91,200,122,56,80');
ok('Sky and Dark with Shield Drill: 240, 280', P('swordsman', 'shield_drill', 'arms_sky') === 240 && P('swordsman', 'shield_drill', 'arms_dark') === 280);

// Prices.
const bag = () => {
  const g = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus: null });
  g.inventory.add('fruit', 20); g.inventory.add('sword_stone', 1);
  return g;
};
{
  const g = bag();
  ok('before Iron Arms a warrior costs a stone sword', unitCost(U('warrior'), g.inventory).ok && !unitCost(U('warrior'), g.inventory, R('arms_iron')).ok && /iron sword/.test(unitCost(U('warrior'), g.inventory, R('arms_iron')).short.join()));
  g.inventory.add('sword_iron', 1);
  payForUnit(U('warrior'), g.inventory, R('arms_iron'));
  ok('after it, paying takes the iron sword and leaves the stone one', g.inventory.countOf('sword_iron') === 0 && g.inventory.countOf('sword_stone') === 1);

  const b = { id: 7, type: 'barracks', valid: true, region: { minX: 20, maxX: 32, minY: 4, maxY: 10, minZ: 20, maxZ: 33 } };
  g.research.arms_iron = true;
  const no = g.trainSoldier(b, 'warrior');
  ok('trainSoldier asks for the iron sword once Iron Arms is learnt', !no.ok && /iron sword/.test(no.reason));
  g.inventory.add('sword_iron', 1);
  ok('and takes it', g.trainSoldier(b, 'warrior').ok && g.inventory.countOf('sword_iron') === 0);
}

// In the field: soldiers already trained change from the day it is learnt.
function field(unit) {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 24 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) world.setBlock(x, 3, z, 3);
  const d = new Defenders({ world, rand: () => 0.5 });
  const post = [{ id: 7, type: 'barracks', region: { minX: 20, maxX: 32, minY: 4, maxY: 10, minZ: 20, maxZ: 33 }, valid: true }];
  d.sync(post, 0);
  d.order(7, unit, 0);
  d.sync(post, 1, null, {});
  return { d, post, s: d.soldiers[0] };
}
{
  const { d, post, s } = field('swordsman');
  ok('a swordsman starts at 32 hp', s.hp === 32 && s.maxHp === 32);
  s.hp = 20;
  d.sync(post, 1.1, null, R('shield_drill'));
  ok('Shield Drill raises one already out: max 40, and the 8 more are theirs now (20 to 28)', s.maxHp === 40 && s.hp === 28);
  d.sync(post, 1.2, null, R('shield_drill'));
  ok('only once', s.hp === 28);
  s.hungry = false;
  for (let i = 0; i < 400; i++) { s.hp = Math.min(s.hp, 39); d.tick(0.1, []); }
  ok('and healing goes up to the new max, not the old', s.hp > 32 && s.hp <= 40);
}
{
  const { d, post, s } = field('warrior');
  d.sync(post, 1.1, null, R('arms_iron'));
  const enemy = { x: s.x, y: s.y, z: s.z - 1.5, hp: 999 };
  const hits = [];
  for (let i = 0; i < 40; i++) d.tick(0.1, [enemy], { strike: (e, n) => hits.push(n) });
  ok('a warrior trained before Iron Arms now strikes for 5', hits.length > 0 && hits.every((n) => n === 5));
}
{
  const { d, post, s } = field('archer');
  d.sync(post, 1.1, null, R('fletching'));
  const enemy = { x: s.x, y: s.y, z: s.z - 22, hp: 999 };
  const shots = [];
  for (let i = 0; i < 100; i++) d.tick(0.1, [enemy], { shot: (e, n) => shots.push(n) });
  ok('an archer now reaches 22 blocks, for 4', shots.length > 0 && shots.every((n) => n === 4));
}
{
  const { d, post, s } = field('crew');
  d.sync(post, 1.1, null, R('siege_works'));
  const enemy = { x: s.x, y: s.y, z: s.z - 20, hp: 999 };
  const lobs = [];
  for (let i = 0; i < 200; i++) d.tick(0.1, [enemy], { lob: () => lobs.push(i) });
  ok(`a crew sets up and throws faster (${lobs.length} stones in 20 s, 4.5 s apart)`, lobs.length >= 3 && lobs[1] - lobs[0] <= 45);
}

// Hungry soldiers still hit at 0.6.
ok('hungry: a researched blow is still 0.6 of itself', HUNGRY_STRENGTH === 0.6 && blowOf({ hungry: true }, 5) === 3 && blowOf({ hungry: true }, 7) === 4 && blowOf({ hungry: false }, 5) === 5);

process.exit(f ? 1 : 0);
