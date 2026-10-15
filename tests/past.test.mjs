import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { ChunkGen, WORLD_HEIGHT } from '../src/world/ChunkGen.js';
import { World } from '../src/world/World.js';
import { Mobs } from '../src/world/Mobs.js';
import { BIOMES } from '../src/config/biomes.js';
import { MOBS_BY_ID, mobsForBiome } from '../src/config/mobs.js';
import { PAST_AWAY, inPast, pastArrival } from '../src/world/past.js';
import { BLOCKS_BY_ID, TIME_MACHINE, EGG_TRIKE } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame, HATCH_DAYS } from '../src/duilt/DuiltGame.js';
import { ageOf } from '../src/config/ages.js';

/**
 * Time travel, part one: the Past (backlog batch 4, D3 — asked for directly:
 * "Next fix ... time travel"; "Past (the hardest): a separate world of
 * dinosaurs ... dinosaurs hit hard ... taming: feed a dinosaur to tame it,
 * then ride it ... eggs: take them home, hatch them").
 */

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- the land ------------------------------------------------------------------------------------------

{
  const gen = new ChunkGen({ seed: 41, height: WORLD_HEIGHT, homeX: 100, homeZ: -50 });
  const era = new Set(BIOMES.filter((b) => b.era === 'past').map((b) => b.id));
  ok(`the Past has biomes of its own (${[...era].join(', ')})`, era.size >= 2);
  const at = pastArrival(100, -50);
  ok('you arrive due east of home, a long way out', at.x === 100 + PAST_AWAY && at.z === -50 && inPast(at.x, 100) && !inPast(100 + 5000, 100));
  let past = 0, present = 0, inside = 0, outside = 0;
  for (let i = 0; i < 400; i++) {
    const x = at.x + (i % 20) * 37 - 300, z = at.z + Math.floor(i / 20) * 41 - 400;
    if (era.has(BIOMES[gen.biomeIndexAt(x, z)].id)) past++; else present++;
    const hx = 100 + (i % 20) * 53 - 500, hz = -50 + Math.floor(i / 20) * 47 - 450;
    if (era.has(BIOMES[gen.biomeIndexAt(hx, hz)].id)) inside++; else outside++;
  }
  ok(`out there, only the Past's own (${past} of ${past + present})`, present === 0);
  ok(`and none of it at home (${inside} of ${inside + outside})`, inside === 0);
  ok('every one of its biomes has dinosaurs in it', [...era].every((id) => mobsForBiome(id).some((m) => ['raptor', 'trike', 'longneck'].includes(m.id))));
  ok('and eggs lying about in it', BIOMES.filter((b) => b.era).every((b) => b.scatter.some((s) => [442, 443, 444].includes(s.block))));
}

// --- the machine --------------------------------------------------------------------------------------

ok('a time machine: a block, an item, made at an engineering centre after the war', BLOCKS_BY_ID.get(TIME_MACHINE)?.shape === 'time_machine'
  && ITEMS_BY_ID.get('time_machine')?.block === TIME_MACHINE && RECIPES.find((r) => r.output.id === 'time_machine')?.station === 'engineering'
  && RECIPES.find((r) => r.output.id === 'time_machine').age === 11);
ok('Place on it: the choice of when — or, in the Past, home', /if \(aimed && aimed\.block === TIME_MACHINE\) return void this\.useTimeMachine\(\);/.test(game)
  && /if \(inPast\(this\.player\.position\.x, gen\.biomes\.centreX\)\) return void this\.travelHome\(\);/.test(game));
ok('  a tap does it on a phone', /aimed\.block === WAY_OUT \|\| aimed\.block === TIME_MACHINE \|\| isCatapult\(aimed\.block\)[\s\S]{0,120}return places\(\);/.test(game));
ok('there, a clearing and a machine of its own for the way back', /w\.setBlock\(at\.x \+ 2, y, at\.z, TIME_MACHINE\);/.test(game) && /d\.time\.back = \{ x: p\.x, y: p\.y, z: p\.z \};/.test(game));

// --- the dinosaurs --------------------------------------------------------------------------------------

const raptor = MOBS_BY_ID.get('raptor'), trike = MOBS_BY_ID.get('trike'), longneck = MOBS_BY_ID.get('longneck');
ok('three of them: the raptor hunts, the triceratops charges if struck, the long-neck grazes', raptor?.hunts && trike?.charges && longneck && !longneck.hunts && !longneck.charges);
ok('  they hit hard, and take some killing', raptor.hunts.damage >= 3 && trike.charges.damage >= 4 && trike.hp >= 40 && longneck.hp >= 60);
ok('  each tamed by feeding it, and ridden', [raptor, trike, longneck].every((m) => m.tameWith?.length && m.rideable) && raptor.tameWith.includes('raw_meat'));
ok('  the long-neck carries its head up on a neck', longneck.neck?.up > 2);

{
  const world = new World({ sizeX: 64, sizeZ: 64, height: 40 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) world.setBlock(x, 0, z, 3);
  const bites = [];
  const mobs = new Mobs({ world, rand: () => 0.5, cap: 0, onBite: (m, d) => bites.push([m.type, d]) });
  const r = mobs.make(raptor, 20.5, 1, 20.5);
  const t = mobs.make(trike, 40.5, 1, 40.5);
  mobs.list.push(r, t);
  const you = { x: 28.5, y: 1, z: 20.5 };
  for (let i = 0; i < 80; i++) mobs.tick(0.05, you);
  ok(`a raptor comes for you and bites (${bites.filter(([k]) => k === 'raptor').length} bites)`, bites.some(([k, d]) => k === 'raptor' && d === raptor.hunts.damage));
  const tx = t.x;
  const near = { x: 43, y: 1, z: 40.5 };
  bites.length = 0;
  for (let i = 0; i < 40; i++) mobs.tick(0.05, { ...near });
  ok('a triceratops leaves you be until you strike it', !bites.some(([k]) => k === 'trike'));
  mobs.hit(t, 2, near.x, near.z);
  for (let i = 0; i < 60; i++) mobs.tick(0.05, { ...near });
  ok(`  then it charges (${bites.filter(([k]) => k === 'trike').length} blows)`, bites.some(([k]) => k === 'trike'));
  ok('  rather than running off', Math.abs(t.x - tx) < 8 && t.angryFor > 0);
  r.owned = true; bites.length = 0;
  for (let i = 0; i < 60; i++) mobs.tick(0.05, { x: r.x + 1, y: 1, z: r.z });
  ok('a tamed one never bites', !bites.some(([k]) => k === 'raptor'));
}
{
  // A wall in the way: it goes round, it doesn't stand against it.
  const world = new World({ sizeX: 64, sizeZ: 64, height: 40 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) world.setBlock(x, 0, z, 3);
  for (let z = 17; z <= 23; z++) for (let y = 1; y <= 3; y++) world.setBlock(24, y, z, 4);
  let n = 0;
  let k = 0;
  const mobs = new Mobs({ world, rand: () => ((k = (k * 1103515245 + 12345) >>> 0) / 4294967296), cap: 0, onBite: () => n++ });
  mobs.list.push(mobs.make(raptor, 20.5, 1, 20.5));
  for (let i = 0; i < 200; i++) mobs.tick(0.05, { x: 28.5, y: 1, z: 20.5 });
  ok(`a raptor finds its way round a wall to you (${n} bites)`, n > 0);
}
ok('on a phone, a tap on your own tames or rides — on a wild one, with what it eats in hand, tames it (it used to strike it)',
  /const mount = this\.horseTarget\(aimed\);\s*if \(mount && \(mount\.owned \|\| MOBS_BY_ID\.get\(mount\.type\)\?\.tameWith\?\.includes\(this\.selectedItemId\)\)\) return places\(\);/.test(game));
ok('a bite hurts through your armour, as a blow does', /const taken = this\.duilt\.hurt\(damage, 'dinosaur'\);/.test(game)
  && /HIT_CAUSES = new Set\(\[[^\]]*'dinosaur'/.test(readFileSync(new URL('../src/config/armour.js', import.meta.url), 'utf8')));

// --- eggs --------------------------------------------------------------------------------------------------

{
  const { world } = generateDuiltWorld({ sizeX: 64, sizeZ: 64, seed: 6 });
  const d = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
  d.days = 10;
  d.layEgg(5, 30, 5, 'trike');
  ok('an egg set down waits', d.hatchDue().length === 0);
  d.days = 10 + HATCH_DAYS;
  const due = d.hatchDue();
  ok(`${HATCH_DAYS} days on, it's due — and only once`, due.length === 1 && due[0].type === 'trike' && d.hatchDue().length === 0);
  d.layEgg(6, 30, 6, 'raptor');
  d.time.pastVisited = true; d.time.hatched = 2; d.time.back = { x: 1, y: 2, z: 3 };
  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
  back.loadJSON(JSON.parse(JSON.stringify(d.toJSON())));
  ok('eggs, and where you\'ve been, are saved', back.eggs.length === 1 && back.eggs[0].type === 'raptor' && back.time.pastVisited && back.time.hatched === 2 && back.time.back.z === 3);
  ok('the eggs are found in the Past, and set down like any block', ['egg_raptor', 'egg_trike', 'egg_longneck'].every((id) => ITEMS_BY_ID.get(id)?.block) && BLOCKS_BY_ID.get(EGG_TRIKE)?.shape === 'egg');
}
ok('the Past is nobody\'s land: you can take its eggs, dig and build there', /!this\.duilt\.territory\.contains\(c\.x, c\.z\) && !inPast\(c\.x, centreX\)/.test(game));
ok('set down, an egg is counted', /if \(!EGG_TYPE\[c\.next\] \|\| !this\.duilt\) continue;\s*this\.duilt\.layEgg\(c\.x, c\.y, c\.z, EGG_TYPE\[c\.next\]\);/.test(game));
ok('hatched: the egg\'s gone and a tame dinosaur stands there, yours', /this\.world\.setBlock\(e\.x, e\.y, e\.z, 0\);[\s\S]{0,200}m\.owned = true;\s*this\.mobs\.list\.push\(m\);\s*this\.duilt\.mounts\.push\(m\);/.test(game));
ok('  an egg picked up again hatches nothing', /if \(EGG_TYPE\[this\.world\.getBlock\(e\.x, e\.y, e\.z\)\] !== e\.type\) continue;/.test(game));

// --- the goals ------------------------------------------------------------------------------------------------

ok('Age 12 asks for the Past and a hatched dinosaur, as the draft did', ageOf(12).goals.some((g) => g.id === 'past') && ageOf(12).goals.some((g) => g.id === 'hatch'));

process.exit(f ? 1 : 0);
