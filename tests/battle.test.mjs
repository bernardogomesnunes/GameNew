import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { ChunkGen, WORLD_HEIGHT } from '../src/world/ChunkGen.js';
import { World } from '../src/world/World.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { RIVALS, RIVAL_AWAY, rivalSites, standardAt } from '../src/world/rivals.js';
import { Rivals, START_STRENGTH, FIRST_DAYS, ATTACK_GAP, FALL_DAYS, MAX_STRENGTH } from '../src/duilt/Rivals.js';
import { WAR_STANDARD, BLOCKS_BY_ID } from '../src/config/blocks.js';
import { WANDERERS } from '../src/config/wanderers.js';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

/**
 * Battle, part one: a world with computer rivals (backlog batch 4, E).
 * Asked for directly: "Ok next battle mode" — three rivals; "It's not a win
 * situation, you can conquer cities and weak them"; they come for you once
 * you've a barracks.
 */

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const game = ['WarRuntime', 'SkyRuntime'].map(name => src(`runtime/${name}.js`)).join('\n') + src('Game.js');

// --- where they are ----------------------------------------------------------------------------------------

const gen = new ChunkGen({ seed: 41, height: WORLD_HEIGHT });
const sites = rivalSites(gen);
ok(`three rival cities (${sites.map((s) => s.name).join(', ')})`, sites.length === RIVALS && RIVALS === 3 && new Set(sites.map((s) => s.name)).size >= 2);
ok('  each about 5,000 blocks out', sites.every((s) => Math.abs(Math.hypot(s.x, s.z) - RIVAL_AWAY) < 500));
const angles = sites.map((s) => Math.atan2(s.z, s.x)).sort((a, b) => a - b);
ok('  spread round the compass, not bunched', angles.every((a, i) => i === 0 || a - angles[i - 1] > 1.5));
ok('  on dry ground', sites.every((s) => !gen.waterLevelAt(s.x, s.z)));
ok('  and somewhere else in another world', rivalSites(new ChunkGen({ seed: 77, height: WORLD_HEIGHT }))[0].x !== sites[0].x);
ok('  the same places every time for the same world', rivalSites(new ChunkGen({ seed: 41, height: WORLD_HEIGHT }))[1].z === sites[1].z);

{
  const s = sites[0], at = standardAt(s);
  const plain = new World({ gen: new ChunkGen({ seed: 41, height: WORLD_HEIGHT }), height: WORLD_HEIGHT });
  ok('in any other world, nothing is there', plain.getBlock(at.x, at.y, at.z) !== WAR_STANDARD);
  const bgen = new ChunkGen({ seed: 41, height: WORLD_HEIGHT });
  bgen.battle = true;
  const world = new World({ gen: bgen, height: WORLD_HEIGHT });
  ok('in a Battle world, a walled city with its standard in the plaza', world.getBlock(at.x, at.y, at.z) === WAR_STANDARD
    && world.getBlock(at.x, at.y - 1, at.z) !== 0 && world.getBlock(s.x + 24, s.y + 2, s.z + 10) !== 0);
  let canopy = 0;
  for (let x = s.x - s.half; x <= s.x + s.half; x += 2) for (let z = s.z - s.half; z <= s.z + s.half; z += 2) {
    for (let y = s.y + 9; y < s.y + 30; y++) { const id = world.getBlock(x, y, z); if (id === 4 || id === 5 || id === 43 || id === 44 || id === 41 || id === 42) canopy++; }
  }
  ok(`  no tree grows over it (${canopy} leaves or logs above its roofs)`, canopy === 0 && bgen.treeAt(s.x + s.half + 2, s.z) == null);
  ok('  the standard: nothing breaks it, and it shines', BLOCKS_BY_ID.get(WAR_STANDARD).system && BLOCKS_BY_ID.get(WAR_STANDARD).glows);
  const guards = s.people.filter((p) => p.kind === 'rival_guard').length;
  ok(`  a garrison to hold it (${guards} posts), and no market — they don't trade with you`, guards >= 8 && !s.people.some((p) => p.kind === 'merchant'));

  // Its people, as Wanderers puts them there.
  world.getBlock(s.x, s.y, s.z);
  const w = new Wanderers({ world, rand: () => 0.5 });
  let state = { garrison: 5, fallen: false, colour: 0xb8322c };
  w.rivalState = () => state;
  const lm = { kind: 'rival', rival: 0, x: s.x, z: s.z, y: s.y, half: s.half, people: s.people };
  w.landmarks = [lm];
  w.populate(lm);
  const g = w.list.filter((p) => p.kind === 'rival_guard');
  ok(`  as many on guard as they're strong (${g.length})`, g.length === 5 && g.every((p) => p.colour === 0xb8322c));
  ok('  and they fight you on sight', g.every((p) => w.hostileOf(p)) && WANDERERS.rival_guard.garrison);
  state = { ...state, fallen: true };
  ok('  but not once the city is yours', g.every((p) => !w.hostileOf(p)));
  w.list = []; w.populate(lm);
  ok('  and while it is, nobody guards it', !w.list.some((p) => p.kind === 'rival_guard') && w.list.some((p) => p.kind === 'citizen'));
}

// --- how they play -----------------------------------------------------------------------------------------

{
  const b = new Rivals();
  b.grow(0);
  ok('they start small', b.list.every((r) => r.strength === START_STRENGTH));
  ok('  and leave you be before your barracks', [0, 1, 2, 5].every((d) => b.tick(d) == null));
  b.grow(5);
  ok('  growing all the while', b.list.every((r) => r.strength > START_STRENGTH && r.strength <= MAX_STRENGTH));
  ok('a barracks: from then on they come', b.arm(5) && !b.arm(5));
  ok('  not at once', b.tick(5) == null);
  const warn = b.tick(5 + FIRST_DAYS);
  ok('  first a warning', warn?.what === 'warn' && warn.rival.id === 0);
  const start = b.tick(5 + FIRST_DAYS + 0.1);
  ok('  then the army', start?.what === 'start' && b.fighting() === warn.rival);
  ok('  one city at a time', b.tick(5 + FIRST_DAYS + 5) == null);
  const r = warn.rival, s0 = r.strength;
  const who = Object.fromEntries(b.company(r));
  ok(`  soldiers and archers, by their strength (${JSON.stringify(who)})`, who.rival_soldier >= 2 && who.archer >= 1);
  ok('  rams and catapults once they\'re strong', !!Object.fromEntries(b.company({ strength: 9 })).ram && !!Object.fromEntries(b.company({ strength: 9 })).siege_catapult);
  b.resolve(r, true, 6);
  ok('beat their army: they\'re weaker, and come again later', r.strength === s0 - 1 && r.stage === 'waiting' && r.due === 6 + ATTACK_GAP);
  const s1 = r.strength;
  const gold = b.conquer(r, 6);
  ok(`take their standard: tribute (${gold} gold), half their strength`, gold > 6 && Math.abs(r.strength - Math.max(1, s1 / 2)) < 1e-9 && r.falls === 1);
  ok(`  and the city is yours for ${FALL_DAYS} days — no armies from them meanwhile`, b.fallen(r, 6 + FALL_DAYS - 0.1) && !b.fallen(r, 6 + FALL_DAYS) && r.due >= 6 + FALL_DAYS);
  ok('  nobody wins for good: they grow back', (() => { const s = r.strength; b.grow(20); return r.strength > s; })());
  ok('  and come again', (() => { for (let d = 20; d < 40; d += 0.02) { const t = b.tick(d); if (t?.rival === r && t.what === 'start') return true; if (t?.what === 'start') b.resolve(t.rival, true, d); } return false; })());
  const back = Rivals.fromJSON(JSON.parse(JSON.stringify(b.toJSON())));
  ok('all of it saved', back.armed && back.list[0].falls === 1 && Math.abs(back.list[1].strength - b.list[1].strength) < 1e-9 && back.list.every((x) => x.stage === 'waiting'));
}
{
  const { world } = generateDuiltWorld({ sizeX: 64, sizeZ: 64, seed: 6 });
  const d = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
  ok('an ordinary world has no rivals, and saves none', d.battle == null && !('battle' in d.toJSON()));
  d.battle = new Rivals();
  d.battle.arm(1);
  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
  back.loadJSON(JSON.parse(JSON.stringify(d.toJSON())));
  ok('a Battle world keeps its rivals', back.battle instanceof Rivals && back.battle.armed);
}

// --- in the game ---------------------------------------------------------------------------------------------

ok('a third kind of world on the home screen', /id: 'battle',\s*name: 'Battle',/.test(src('ui/HomeScreen.js')) && /save\.battle \? 'Battle'/.test(src('ui/HomeScreen.js')));
ok('  Duilt\'s rules, with the rivals in it', /if \(battle\) mode = DUILT;/.test(game) && /if \(battle\) \{ this\.duilt\.battle = new Rivals\(\);[\s\S]{0,90}this\.world\.gen\.battle = true; \}/.test(game));
ok('  and not the Duilt story\'s opening — straight to who your rivals are', /if \(mode === DUILT && !battle\) this\.ui\.story\.play\(INTRO/.test(game) && /if \(battle\) return this\.battleWelcome\(\);/.test(game));
ok('no wall holds you in — you can march on them from the start — but the border still marks where you build', /const walled = this\.duilt && !this\.duilt\.sandbox && !this\.duilt\.battle && !t\.open;/.test(game) && /this\.player\.setBounds\(walled \? t\.bounds\(\) : null\);/.test(game));
ok('your first barracks starts them coming', /!b\.armed && d\.structures\.countOf\('barracks'\) > 0 && b\.arm\(d\.days\)/.test(game));
ok('their army comes the way the Stone Kingdom\'s does, from their side, in their colours', /this\.wanderers\.sendWarband\(home, site, this\.duilt\.territory\.size \/ 2, this\.duilt\.battle\.company\(r\), 0\)/.test(game)
  && /q\.colour = rivalColour\(r\.id\)/.test(game));
ok('  beaten or not, it\'s settled — and dying loses it', /b\.resolve\(r, won, d\.days\);/.test(game) && /for \(const party of \[this\.wanderers\?\.warParty, this\.wanderers\?\.rivalParty\]\)/.test(game));
ok('Place on a standard (a tap too): taken once the garrison\'s down', /if \(aimed && aimed\.block === WAR_STANDARD\) return void this\.takeStandard\(aimed\);/.test(game)
  && /aimed\.block === WAR_STANDARD \|\| isCatapult/.test(game) && /The garrison holds the standard/.test(game) && /b\.conquer\(r, d\.days\)/.test(game));
ok('their cities on your map from the start, in their colours', /if \(d\.battle\) for \(const r of gameFeature\('war'\)\.rivalSites\(gen\)\) out\.push\(\{ kind: 'rival'/.test(game)
  && /s\.colour \?\? SITE_COLOURS/.test(src('render/WorldMap.js')));

process.exit(f ? 1 : 0);
