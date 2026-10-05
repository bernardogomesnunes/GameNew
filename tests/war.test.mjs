import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { War } from '../src/duilt/War.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { Fireflies } from '../src/world/Fireflies.js';
import { WANDERERS } from '../src/config/wanderers.js';
import { ROUNDS, LAST_ROUND, FIRST_ROUND_DAYS, ROUND_GAP_DAYS, WARN_DAYS, RETRY_DAYS, companyWords } from '../src/config/war.js';
import { AGES, FINAL_AGE } from '../src/config/ages.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { HIT_CAUSES } from '../src/config/armour.js';
import { itemIcon } from '../src/config/cubes.js';

/**
 * The war (the White path's Ten Rounds), as it was settled in the playtest:
 * "let's keep blocking leaving the area until age 6, and increase just a
 * little bit the range, starting on 32 but going higher than 256, and when
 * we hit it we get attacked, even if we didn't craft the ring — that's the
 * good part for gameplay, it will be harder to beat because you need to
 * craft it while you are being attacked."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- the land: locked until the last age, then open -------------------------------------------

ok(`the border grows ${AGES.map((a) => a.size).join(' → ')}`, AGES[0].size === 32 && AGES[AGES.length - 1].size > 256);
ok('until the last age it\'s a wall; from it, you walk where you like', AGES.every((a) => !!a.open === (a.age === FINAL_AGE)));
ok('  and Game takes the wall down when it opens', /!t\.open \? t\.bounds\(\) : null/.test(game));
ok('  but building still stops at your border', /const outside = changes\.find\(\(c\) => !this\.duilt\.territory\.contains\(c\.x, c\.z\)\)/.test(game));

// --- the rounds -------------------------------------------------------------------------------

ok('ten rounds', ROUNDS.length === 10 && LAST_ROUND === 10);
const kinds = (n) => ROUNDS[n - 1].who.map(([k]) => k);
ok('1–3: bandits on foot', [1, 2, 3].every((n) => kinds(n).every((k) => k === 'bandit')));
ok('4–6: archers, and a battering ram', [4, 5, 6].every((n) => kinds(n).includes('archer') && kinds(n).includes('ram')));
ok('7–9: Stone soldiers in armour, and catapults', [7, 8, 9].every((n) => kinds(n).includes('soldier') && kinds(n).includes('siege_catapult')));
ok('10: the Warlord on a black beast', kinds(10).includes('warlord') && kinds(10).includes('warbeast'));
const size = (n) => ROUNDS[n - 1].who.reduce((t, [, c]) => t + c, 0);
ok(`each bigger than the last, or as big (${ROUNDS.map((_, i) => size(i + 1)).join(', ')})`, ROUNDS.every((_, i) => i === 0 || size(i + 1) >= size(i)));
ok('everyone in them is someone who can be fought', ROUNDS.every((r) => r.who.every(([k]) => WANDERERS[k]?.hp > 0)));
ok('and told in words', companyWords(4, WANDERERS) === '3 bandits, 2 archers and a battering ram'
  && companyWords(10, WANDERERS).startsWith('the Warlord on his black beast'));
ok('hurt by the army is its own cause, and armour takes it', HIT_CAUSES.has('army') && /army: 'The Stone Kingdom\\'s army beat you'/.test(game));

// --- War: the bookkeeping -------------------------------------------------------------------------

{
  const w = new War();
  ok('peace to begin with', w.stage === 'peace' && !w.atWar);
  ok('declared', w.declare(10) && w.stage === 'waiting' && w.due === 10 + FIRST_ROUND_DAYS);
  ok('once', !w.declare(11));
  ok('nothing yet', w.tick(10.1) === null);
  ok('a minute off, you hear it', w.tick(10 + FIRST_ROUND_DAYS - WARN_DAYS / 2) === 'warn' && w.stage === 'warned');
  ok('then it sets out', w.tick(10 + FIRST_ROUND_DAYS + WARN_DAYS) === 'start' && w.stage === 'fighting');
  ok('won: on to round 2, a day and a half off', w.resolve(true, 11) === 'won' && w.round === 2 && w.due === 11 + ROUND_GAP_DAYS);
  ok('the horn calls it now', w.horn(11) && w.due === 11 + WARN_DAYS && w.stage === 'waiting');
  ok('but not twice', !w.horn(11));
  w.tick(11); w.tick(11 + WARN_DAYS);
  ok('lost: the same round again, a day off', w.resolve(false, 12) === 'lost' && w.round === 2 && w.lost === 1 && w.due === 12 + RETRY_DAYS);
  // A round that came due while you were away still gives you a minute.
  ok('overdue, there\'s still warning', w.tick(50) === 'warn' && w.due === 50 + WARN_DAYS && w.tick(50) === null);
  w.tick(51);
  for (let n = 2; n < LAST_ROUND; n++) { w.resolve(true, 60); w.tick(100); w.tick(101); }
  ok('the tenth', w.round === 10 && w.stage === 'fighting');
  ok('won: victory, and it\'s over for good', w.resolve(true, 102) === 'victory' && w.stage === 'won' && !w.atWar && !w.horn(102));

  const s = new War();
  s.declare(0); s.tick(1); s.tick(1);
  const back = new War();
  back.loadJSON(JSON.parse(JSON.stringify(s.toJSON())));
  ok('saved mid-round, it comes again on loading', back.stage === 'waiting' && back.round === 1);
  const t = new War();
  t.declare(0);
  ok('the Black Ring: the King calls them home', t.truce() && t.stage === 'truce' && !t.atWar && !t.horn(1));
  const pre = new War();
  ok('and with it already on your hand, there\'s no war at all', !pre.declare(0, { ring: 'black' }) && pre.stage === 'truce');
}

// --- in DuiltGame -------------------------------------------------------------------------------

{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const events = [];
  const bus = { emit: (e, d) => events.push([e, d]), on() {} };
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus });
  ok('no war before the last age', !g.declareWar() && g.war.stage === 'peace');
  g.territory.setAge(FINAL_AGE - 1);
  g.ageComplete = () => true;
  g.checkAgeAdvance();
  ok('reaching it: the border opens, and war is declared — no ring needed',
    g.age === FINAL_AGE && g.territory.open && g.war.atWar && events.some(([e]) => e === 'war:declared'));
  ok('the game can\'t finish while the war is on', g.checkAgeAdvance() === null && !g.finished);

  const saved = new DuiltGame({ world, scene: new THREE.Scene(), bus });
  saved.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('the war is saved with the world', saved.war.atWar && saved.war.round === 1);
  const old = new DuiltGame({ world, scene: new THREE.Scene(), bus });
  const before = g.toJSON(); delete before.war;
  old.loadJSON(JSON.parse(JSON.stringify(before)));
  ok('a world already at the last age from before: war on loading', old.war.atWar);

  // Forge the Black Ring mid-war.
  events.length = 0;
  g.crafting.onMade?.({ ring: 'black' });
  ok('forge the Black Ring mid-war, and it\'s called off', g.war.stage === 'truce' && events.some(([e]) => e === 'war:truce'));
  g.checkAgeAdvance();
  ok('but on the dark path the end is the Sky Kingdom\'s fall, not the truce', !g.finished);
  g.bringDownSky();
  ok('then the game can end', g.finished && g.skyFallen);

  const sand = new DuiltGame({ world, scene: new THREE.Scene(), bus, sandbox: true });
  sand.territory.setAge(FINAL_AGE);
  ok('never in Creative', !sand.declareWar());
}

// --- the army, out in the world ---------------------------------------------------------------------

const flat = () => {
  const world = new World({ sizeX: 256, sizeZ: 256, height: 40 });
  for (let x = 0; x < 256; x++) for (let z = 0; z < 256; z++) world.setBlock(x, 0, z, 3);
  return world;
};
const home = { x: 128, z: 128 };
const north = { x: 128, z: -1000 };

{
  const world = flat();
  const hits = [];
  const w = new Wanderers({ world, rand: rng(5), onAttack: (p, n) => hits.push({ p, n }) });
  w.untilMessenger = w.untilExplorer = 1e9;
  const band = w.sendWarband(home, north, 40, ROUNDS[3].who, 4);
  ok(`round 4 turns up: ${band.length} of them`, band.length === size(4) && band.every((p) => p.war && p.round === 4));
  ok('from the Stone Kingdom\'s side, past your border', band.every((p) => p.z < home.z - 40 && Math.abs(p.x - home.x) < 12));
  ok('the bandits and archers come to rob; the ram comes for your walls', band.filter((p) => p.raider).length === 5 && !band.find((p) => p.kind === 'ram').raider);
  ok('archers and soldiers wear a helm or a hood', band.filter((p) => p.kind === 'archer').every((p) => p.helm === WANDERERS.archer.helm));

  // You walk off: they don't vanish.
  for (let i = 0; i < 20; i++) w.tick(0.05, { x: 128, y: 1, z: 250 });
  ok('they don\'t melt away because you walked off', band.every((p) => w.list.includes(p)));

  // An archer, near you: it keeps back and shoots.
  const archer = band.find((p) => p.kind === 'archer');
  const you = { x: archer.x, y: 1, z: archer.z + 11 };
  for (const p of band) if (p !== archer) p.done = true;
  w.tick(0.05, you);
  let flew = 0;
  for (let i = 0; i < 200; i++) { w.tick(0.05, you); flew = Math.max(flew, w.arrows.length); }
  const d = Math.hypot(archer.x - you.x, archer.z - you.z);
  ok(`an archer keeps its distance (${d.toFixed(1)} blocks)`, d > 5 && d < 13);
  ok(`and its arrows find you (${hits.length} in 10 s)`, flew > 0 && hits.length >= 2 && hits.every((h) => h.p === archer && h.n === WANDERERS.archer.hits));
}

{
  // A ram at your wall.
  const world = flat();
  for (let x = 120; x <= 136; x++) for (let y = 1; y <= 3; y++) world.setBlock(x, y, 110, 3);
  const battered = [];
  const w = new Wanderers({
    world, rand: rng(2),
    buildings: () => [{ region: { minX: 124, maxX: 132, minY: 1, maxY: 4, minZ: 124, maxZ: 132 } }],
    inLand: (x, z) => Math.abs(x - 128) <= 40 && Math.abs(z - 128) <= 40,
    onBatter: (p, cells) => { battered.push(...cells); for (const c of cells) world.setBlock(c.x, c.y, c.z, 0); },
  });
  w.untilMessenger = w.untilExplorer = 1e9;
  const [ram] = w.sendWarband(home, north, 40, [['ram', 1]], 4);
  for (let i = 0; i < 1200; i++) w.tick(0.05, { x: 200, y: 1, z: 200 });
  ok(`a ram breaks through a wall in its way (${battered.length} blocks)`, battered.some((c) => c.z === 110) && battered.every((c) => c.y >= 1));
  ok(`and rolls on for your building (now ${Math.round(Math.hypot(ram.x - 128, ram.z - 124))} off it)`, ram.z > 112);
  // Outside your land it goes round, not through.
  const world2 = flat();
  for (let x = 100; x <= 156; x++) for (let y = 1; y <= 3; y++) world2.setBlock(x, y, 70, 3);
  const w2 = new Wanderers({ world: world2, rand: rng(2), inLand: () => false, onBatter: () => battered.push('outside') });
  w2.sendWarband(home, north, 40, [['ram', 1]], 4);
  for (let i = 0; i < 200; i++) w2.tick(0.05, { x: 200, y: 1, z: 200 });
  ok('outside your land it doesn\'t batter anything', !battered.includes('outside'));
}

{
  // A siege catapult: up to throwing range, then stones.
  const world = flat();
  const thrown = [];
  const w = new Wanderers({
    world, rand: rng(3),
    buildings: () => [{ region: { minX: 124, maxX: 132, minY: 1, maxY: 4, minZ: 124, maxZ: 132 } }],
    onThrow: (p, at) => thrown.push({ p, at, d: Math.hypot(at.x - p.x, at.z - p.z) }),
  });
  w.untilMessenger = w.untilExplorer = 1e9;
  w.sendWarband(home, north, 40, [['siege_catapult', 1]], 7);
  for (let i = 0; i < 1600; i++) w.tick(0.05, { x: 200, y: 1, z: 200 });
  ok(`a siege catapult stops in range and throws (${thrown.length} stones)`, thrown.length >= 3 && thrown.every((t) => t.d <= WANDERERS.siege_catapult.range + 0.5));
  ok('  at your building', thrown.every((t) => t.at.x >= 124 && t.at.x <= 133 && t.at.z >= 124 && t.at.z <= 133));
}

{
  // The Warlord on his beast.
  const world = flat();
  const hits = [];
  const w = new Wanderers({ world, rand: rng(4), onAttack: (p, n) => hits.push(p) });
  w.untilMessenger = w.untilExplorer = 1e9;
  const band = w.sendWarband(home, north, 40, [['warlord', 1], ['warbeast', 1]], 10);
  const lord = band.find((p) => p.kind === 'warlord'), beast = band.find((p) => p.kind === 'warbeast');
  ok('the Warlord rides his beast', lord.mount === beast && lord.name === 'Vorhak');
  const you = { x: 128, y: 1, z: 128 };
  for (let i = 0; i < 1200; i++) w.tick(0.05, you);
  ok(`it hunts you down, and he's on its back the whole way (${Math.hypot(beast.x - you.x, beast.z - you.z).toFixed(1)} off)`,
    Math.hypot(beast.x - you.x, beast.z - you.z) < 3 && lord.x === beast.x && lord.z === beast.z && lord.y > beast.y);
  ok('both of them strike', hits.includes(lord) && hits.includes(beast));
  w.hit(beast, 999, you.x, you.z);
  w.tick(0.05, you);
  for (let i = 0; i < 40; i++) w.tick(0.05, you);
  ok('the beast down, he fights on foot', !lord.mount && Math.abs(lord.y - 1) < 0.01);
}

{
  // A raider gets away with your things: escaped, and the round is lost.
  const world = flat();
  const region = { minX: 126, maxX: 130, minY: 1, maxY: 4, minZ: 126, maxZ: 130 };
  const w = new Wanderers({
    world, rand: rng(6),
    stores: () => [{ structure: { id: 's' }, region }],
    onSteal: () => ({ planks: 5 }),
  });
  w.untilMessenger = w.untilExplorer = 1e9;
  const [b] = w.sendWarband(home, north, 40, [['bandit', 1]], 1);
  for (let i = 0; i < 3000 && !b.done; i++) w.tick(0.05, { x: 250, y: 1, z: 250 });
  ok('a raider who gets home with your things has escaped', b.done && b.escaped && b.loot.planks === 5);
  ok('and the army doesn\'t wait for dark, or go home at dawn', !w.night());

  const [c] = w.sendWarband(home, north, 40, [['soldier', 1]], 7);
  c.retreat = true;
  for (let i = 0; i < 600 && !c.done; i++) w.tick(0.05, { x: 250, y: 1, z: 250 });
  ok('called off, they go home', c.done && !c.escaped);
}

// --- the war horn, and the light after -------------------------------------------------------------------

{
  const horn = ITEMS_BY_ID.get('war_horn');
  ok('a war horn, made at the bench in the last age', !!horn && RECIPES.some((r) => r.output.id === 'war_horn' && r.station === 'hand' && r.age === FINAL_AGE));
  ok('  drawn as a horn', (itemIcon(horn) ?? '').includes('<svg'));
  ok('  Break with it calls the next round', /war_horn: 'blowHorn'/.test(game) && /war\.horn\(d\.days\)/.test(game));
}
{
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) for (const y of [0, 1]) world.setBlock(x, y, z, 3); // bare stone, no grass
  const plain = new Fireflies({ world, rand: rng(1) });
  const blessed = new Fireflies({ world, rand: rng(1) });
  for (let i = 0; i < 400; i++) {
    plain.tick(0.05, { x: 32, y: 2, z: 32 }, 1);
    blessed.tick(0.05, { x: 32, y: 2, z: 32 }, 1, { blessed: true });
  }
  ok(`won: fireflies over your settlement at night, over any ground (${blessed.swarms.length} swarms; ${plain.swarms.length} without)`,
    blessed.swarms.length > 7 && plain.swarms.length === 0);
  ok('  in Game, once the war is won and you\'re home', /blessed: !!\(this\.duilt\?\.war\.stage === 'won'/.test(game));
}

// --- in the game ----------------------------------------------------------------------------------

ok('the war runs every frame', /this\.wanderers\.tick\(dt, this\.player\.position\);\s*this\.tickWar\(\);/.test(game));
ok('only while you\'re near home', /> WAR_HOME_RANGE\) return;/.test(game));
ok('a round is announced, then sent from the Stone Kingdom\'s side', /War horns to the/.test(game) && /sendWarband\(home, towards, this\.duilt\.territory\.size \/ 2/.test(game));
ok('won when they\'re all down, lost if you fell or any got away', /const won = !party\.died && !party\.band\.some\(\(p\) => p\.escaped\)/.test(game));
ok('falling in a round sends them home', /party\.died = true;\s*for \(const q of party\.band\) q\.retreat = true;/.test(game));
ok('rams and siege stones break your buildings', /onBatter: \(p, cells\) => this\.siegeBreak\(/.test(game) && /if \(stone\.enemy\) \{\s*this\.siegeBreak\(craterCells/.test(game));
ok('  and a building they break stops working until you mend it', /siegeBreak[\s\S]{0,1300}this\.duilt\.structures\.revalidateAround\(changes\)/.test(game));
ok('the siege engines and the beast are drawn', /this\.armyView\.update\(strangers, \[\.\.\.\(this\.wanderers\?\.arrows/.test(game));
ok('your guardian fights them too', /p\.raider \|\| p\.war\)/.test(game));
ok('victory finishes the game, once the last age is done too', /res === 'victory'[\s\S]{0,500}d\.checkAgeAdvance\(\)/.test(game));

process.exit(f ? 1 : 0);
