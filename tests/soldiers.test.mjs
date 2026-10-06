import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Defenders, TRAIN_DAYS } from '../src/world/Defenders.js';
import { UNITS, UNITS_BY_ID, unitCost, foodIn } from '../src/config/soldiers.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { OUTFITS } from '../src/config/outfits.js';

/**
 * Backlog batch 3, #29: "Barracks train soldiers. Archers, warriors,
 * swordsmen, and a catapult crew who set one up and fire it in a war. Each
 * costs food and gear."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

// --- who there is ----------------------------------------------------------------------------

ok('warriors, swordsmen, archers and a catapult crew', UNITS.map((u) => u.name).join() === 'Warrior,Swordsman,Archer,Catapult crew');
ok('each costs food and gear — real things you can hold', UNITS.every((u) => u.food > 0 && Object.keys(u.gear).length && Object.keys(u.gear).every((id) => ITEMS_BY_ID.has(id))));
ok('archers take a bow and arrows; a crew, a catapult and stones to throw',
  UNITS_BY_ID.get('archer').gear.bow && UNITS_BY_ID.get('archer').gear.arrow && UNITS_BY_ID.get('crew').gear.catapult && UNITS_BY_ID.get('crew').gear.stone);
ok('a swordsman is worth more than a warrior: tougher, harder-hitting, dearer',
  UNITS_BY_ID.get('swordsman').hp > UNITS_BY_ID.get('warrior').hp && UNITS_BY_ID.get('swordsman').melee.hits > UNITS_BY_ID.get('warrior').melee.hits
  && UNITS_BY_ID.get('swordsman').food > UNITS_BY_ID.get('warrior').food);
ok('each drawn as itself — and none as the Stone Kingdom\'s own warriors', UNITS.every((u) => OUTFITS[u.kind] && u.kind !== 'warrior'));

// --- training them at a barracks -------------------------------------------------------------

function setup() {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 24 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) world.setBlock(x, 3, z, 3);
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  const b = { id: 7, type: 'barracks', valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, brokenReason: null,
    region: { minX: 20, maxX: 32, minY: 4, maxY: 10, minZ: 20, maxZ: 33 } };
  g.structures.structures.push(b);
  return { world, g, b };
}

{
  const { g, b } = setup();
  const nope = g.trainSoldier(b, 'warrior', 6);
  ok(`nothing in the bag, nobody trained — and it says what's short ("${nope.reason}")`, !nope.ok && /3 food/.test(nope.reason) && /stone sword/.test(nope.reason));
  g.inventory.add('vegetables', 2); g.inventory.add('fruit', 5); g.inventory.add('sword_stone', 1);
  const food = foodIn(g.inventory);
  const r = g.trainSoldier(b, 'warrior', 6);
  ok('with them, a warrior is put in training', r.ok && g.defenders.barracks(7).queue.join() === 'warrior');
  ok('paid for out of the bag: three food, the plainest first, and the sword',
    foodIn(g.inventory) === food - 3 && g.inventory.countOf('sword_stone') === 0 && g.inventory.countOf('fruit') === 2 && g.inventory.countOf('vegetables') === 2);

  // Bunks.
  g.inventory.add('fruit', 50);
  for (let i = 0; i < 5; i++) { g.inventory.add('bow', 1); g.inventory.add('arrow', 20); g.trainSoldier(b, 'archer', 6); }
  const full = g.trainSoldier(b, 'archer', 6);
  ok('a soldier a bunk: with every bunk spoken for, it says so', !full.ok && /bunk/.test(full.reason) && g.defenders.barracks(7).queue.length === 6);
  ok('and fewer bunks, fewer soldiers', !g.trainSoldier({ ...b, id: 8 }, 'archer', 0).ok);
  ok('only a standing barracks trains', !g.trainSoldier({ ...b, valid: false }, 'archer', 6).ok && !g.trainSoldier({ ...b, type: 'house' }, 'archer', 6).ok);

  // They join one at a time.
  const d = g.defenders, post = [{ id: 7, type: 'barracks', region: b.region, valid: true, beds: 6 }];
  d.sync(post, g.days + TRAIN_DAYS * 0.5);
  ok('nobody before their time', d.soldiers.length === 0);
  const out = d.sync(post, g.days + TRAIN_DAYS * 1.01);
  ok('and says who came out, and how many are still in line', out.length === 1 && out[0].unit === 'warrior' && out[0].left === 5);
  ok(`the first after ${TRAIN_DAYS} of a day — the warrior, first in line`, d.soldiers.length === 1 && d.soldiers[0].unit === 'warrior' && d.soldiers[0].kind === 'footman');
  d.sync(post, g.days + TRAIN_DAYS * 6.01);
  ok('then the rest, one after another', d.soldiers.length === 6 && d.soldiers.filter((s) => s.unit === 'archer').length === 5);
  ok('each named for what they are', d.soldiers.some((s) => s.name === 'Your archer') && d.soldiers.some((s) => s.name === 'Your warrior'));

  // Saved and loaded.
  const back = new Defenders({ world: g.world });
  back.loadJSON(JSON.parse(JSON.stringify(d.toJSON())));
  back.sync(post, g.days + TRAIN_DAYS * 6.01);
  ok('saved: the same soldiers, the same kinds', back.soldiers.map((s) => s.unit).sort().join() === d.soldiers.map((s) => s.unit).sort().join());
}

{
  // A save from before you chose who to train: its soldiers come back as swordsmen.
  const d = new Defenders({ world: new World({ sizeX: 16, sizeZ: 16, height: 8 }) });
  d.loadJSON({ trained: { 3: { count: 4, since: 2 } } });
  ok('an older save\'s soldiers come back, as swordsmen', d.barracks(3).roster.join() === 'swordsman,swordsman,swordsman,swordsman' && d.barracks(3).queue.length === 0);
}

{
  // Creative: free.
  const world = new World({ sizeX: 32, sizeZ: 32, height: 16 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: true });
  g.grantCreativeKit();
  ok('in Creative, they cost nothing', unitCost(UNITS_BY_ID.get('crew'), g.inventory).ok);
}

// --- in a fight ------------------------------------------------------------------------------

/** A barracks with one of `unit` standing in front of it, ready. */
function oneOf(unit) {
  const { world, b } = setup();
  const d = new Defenders({ world, rand: () => 0.5 });
  const post = [{ id: 7, type: 'barracks', region: b.region, valid: true, beds: 6 }];
  d.sync(post, 0);
  d.order(7, unit, 0);
  d.sync(post, 1);
  return { d, s: d.soldiers[0], b };
}

{
  const { d, s } = oneOf('archer');
  const enemy = { x: s.x, y: s.y, z: s.z - 15, hp: 999 };
  const shots = [];
  for (let i = 0; i < 200; i++) d.tick(0.05, [enemy], { shot: (e, n, by) => shots.push({ n, by }) });
  ok(`an archer shoots from where it stands (${shots.length} arrows home in 10 s)`, shots.length >= 3 && shots.every((x) => x.by === s && x.n === UNITS_BY_ID.get('archer').ranged.damage));
  ok(`  without walking up to it (${Math.hypot(enemy.x - s.x, enemy.z - s.z).toFixed(1)} blocks off)`, Math.hypot(enemy.x - s.x, enemy.z - s.z) > 5);
}

{
  const { d, s } = oneOf('warrior');
  const enemy = { x: s.x, y: s.y, z: s.z - 12, hp: 999 };
  const blows = [];
  for (let i = 0; i < 200; i++) d.tick(0.05, [enemy], { strike: (e, n, by) => blows.push(n) });
  ok(`a warrior goes for it and strikes for ${UNITS_BY_ID.get('warrior').melee.hits}`, blows.length >= 4 && blows.every((n) => n === UNITS_BY_ID.get('warrior').melee.hits));
}

{
  const { d, s } = oneOf('crew');
  const g = UNITS_BY_ID.get('crew').siege;
  const far = { x: s.x, y: s.y, z: s.z - 30, hp: 999 };
  const lobs = [];
  const on = { lob: (engine, target, crew) => lobs.push({ engine, target, crew }) };
  for (let t = 0; t < g.setup - 0.5; t += 0.05) d.tick(0.05, [far], on);
  ok('a crew sees the enemy coming and starts setting up — not ready at once', d.engines.length === 0 && !lobs.length);
  for (let t = 0; t < 1; t += 0.05) d.tick(0.05, [far], on);
  ok('set up: there is a catapult in front of them', d.engines.length === 1 && Math.hypot(d.engines[0].x - s.x, d.engines[0].z - s.z) > 1);
  for (let t = 0; t < g.every * 3; t += 0.05) d.tick(0.05, [far], on);
  ok(`and it lobs a stone at the enemy every ${g.every} s (${lobs.length} in ${g.every * 3} s)`, lobs.length >= 2 && lobs.every((l) => l.target === far && l.crew === s));
  ok('the crew stays by the barracks rather than marching off', Math.hypot(s.x - s.post.x, s.z - s.post.z) < 0.5);
  ok('out of throw, it isn\'t aimed at', (() => { const n = lobs.length; const away = { x: s.x, y: s.y, z: s.z - 80, hp: 999 }; for (let t = 0; t < g.every * 2; t += 0.05) d.tick(0.05, [away], on); return lobs.length === n; })());
  for (let t = 0; t < g.packAfter + 1; t += 0.05) d.tick(0.05, [], on);
  ok(`nobody left to throw at for ${g.packAfter} s, they pack it away`, d.engines.length === 0);
}

{
  // A fallen soldier is gone, and isn't replaced for nothing.
  const { d, s, b } = oneOf('swordsman');
  d.hurt(s, 999);
  d.tick(0.05, [], {});
  d.sync([{ id: 7, type: 'barracks', region: b.region, valid: true, beds: 6 }], 5);
  ok('fallen, a soldier is off the roster, and nobody comes free in their place', d.soldiers.length === 0 && d.barracks(7).roster.length === 0);
}

// --- in the game -----------------------------------------------------------------------------

ok('the barracks pop-up trains them: what each costs, what\'s short, who\'s training', /barracksHtml\(structure\)/.test(ui) && /data-train="\$\{u\.id\}"/.test(ui) && /Needs \$\{escapeHtml\(cost\.short/.test(ui) && /Training · \$\{t\.queue\.length\}/.test(ui));
// Asked for directly: "show in the pop up when I add one warrior or other to
// create, and show the progress".
ok('the pop-up lists who is in training, in order, the first with a filling bar and its time left',
  /class="train-queue"/.test(ui) && /data-train-bar style="width:\$\{Math\.round\(now\.ratio \* 100\)\}%"/.test(ui) && /data-train-left/.test(ui) && /'Next' : 'Waiting'/.test(ui));
ok('  read off the clock: done / TRAIN_DAYS, and the time that leaves',
  /\(d\.days - t\.since\) \/ TRAIN_DAYS/.test(ui) && /min left/.test(ui) && /Done — out when you close this/.test(ui));
ok('and each one out of training says so, with how many are still in line',
  /for \(const j of d\.defenders\.sync\(posts, d\.days\)\)/.test(game) && /is ready`/.test(game) && /more training at the barracks/.test(game));
ok('  and kept moving while it is open, redrawn when one comes out', /setInterval\(\(\) => this\.tickBarracks\(\), 500\)/.test(ui)
  && /if \(shape !== this\.barracksShape\) return void this\.showBuilding/.test(ui) && /clearInterval\(this\.barracksTimer\)/.test(ui));
ok('the game pays and puts them in line, counting the bunks', /onTrain: \(unit\) => this\.trainSoldier\(structure, unit\)/.test(game) && /this\.duilt\.trainSoldier\(structure, unit, this\.bedsIn\(structure\.region\)\)/.test(game));
ok('a crew\'s stone lands on the enemy, and only hurts them', /lob: \(engine, target, crew\) => this\.crewThrows\(engine, target, crew\)/.test(game) && /if \(stone\.crew\) \{/.test(game));
ok('and its catapult is drawn', /this\.engineView\.update\(ours\?\.engines \?\? \[\]\)/.test(game));

process.exit(f ? 1 : 0);
