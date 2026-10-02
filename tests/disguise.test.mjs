import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { Suspicion, SUSPICION, REASONS, AMBUSH } from '../src/duilt/Suspicion.js';

/**
 * Going home in disguise (docs/plan-phase7-lore.md): in the Sky armour you
 * walk in as one of them; guards grow suspicious if you run, show dark
 * things, crowd them or linger — a suspicion meter, shown in the HUD and
 * never as a toast (asked for directly) — and if you're caught it's open
 * battle.
 */

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { PlayerController } = await import('../src/player/PlayerController.js');

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const run = (s, seconds, signs) => { for (let t = 0; t < seconds; t += 0.05) s.tick(0.05, signs); return s; };

// --- the meter ---------------------------------------------------------------------------------------

{
  const s = new Suspicion();
  run(s, 30, {});
  ok('walking calmly, nobody looks twice', s.level === 0 && !s.discovered && !s.rising);
  run(s, 2, { running: true });
  ok(`running: it climbs (${s.level.toFixed(0)} in 2 s), and says why`, s.level > 30 && s.rising && s.reason === REASONS.running);
  run(s, 3, {});
  ok('stop, and it eases off', s.level < 30 && !s.rising);
  const fast = new Suspicion(), slow = new Suspicion();
  run(fast, 1, { ring: true }); run(slow, 1, { nearGuards: 1 });
  ok('the Black Ring on show gives you away fastest; brushing past a guard, slowly', fast.level > slow.level * 4 && fast.reason === REASONS.ring && slow.reason === REASONS.nearGuard);
  const t = new Suspicion();
  run(t, SUSPICION.throneGrace - 1, { inThrone: true });
  ok('a few moments in the throne room are nothing', t.level === 0);
  run(t, 3, { inThrone: true });
  ok('lingering there is something', t.level > 0 && t.reason === REASONS.throne);
  const w = new Suspicion();
  run(w, 2, { warriors: SUSPICION.few });
  ok(`a few warriors (${SUSPICION.few}) can come in with you without remark`, w.level === 0);
  run(w, 2, { warriors: 10 });
  ok('a column of them can\'t', w.level > 0 && w.reason === REASONS.warriors);
  const caught = new Suspicion();
  run(caught, 10, { running: true, darkGear: true });
  ok('fill it, and you\'re discovered', caught.discovered && caught.level === SUSPICION.max);
  run(caught, 30, {});
  ok('and stay discovered, however you behave after', caught.discovered);
  caught.reset();
  ok('until you\'ve left the island', !caught.discovered && caught.level === 0);
  ok(`your first blow, unseen, lands ${AMBUSH} times as hard`, AMBUSH >= 2 && /const ambush = WANDERERS\[p\.kind\]\?\.sky && this\.unseen\(\);\s*const res = this\.wanderers\.hit\(p, this\.blowDamage\(tool\) \* \(ambush \? AMBUSH : 1\), x, z\);\s*if \(ambush\) this\.revealDisguise\(\);/.test(game));
}

// --- running, as the guards see it -------------------------------------------------------------------

{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 16 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 3);
  const p = new PlayerController(world, new THREE.PerspectiveCamera(), { x: 16.5, y: 1, z: 16.5 });
  for (let i = 0; i < 20; i++) p.update(1 / 60);
  p.externalMove.z = 1;
  p.update(1 / 60);
  const walking = p.running;
  p.stickSprint = true;
  p.update(1 / 60);
  ok('the game knows when you\'re running, not walking', walking === false && p.running === true);
}

// --- the guards: one of their own, until they know ------------------------------------------------------

{
  const world = new World({ sizeX: 96, sizeZ: 96, height: 32 });
  for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) for (let y = 0; y < 10; y++) world.setBlock(x, y, z, 3);
  const isle = { kind: 'sky', x: 48, z: 48, y: 10, king: { x: 48.5, z: 70.5, dy: 0 }, posts: [{ x: 40.5, z: 40.5 }] };
  let unseen = true;
  const blows = [];
  const w = new Wanderers({ world, rand: rng(3), sky: () => isle, skyHostile: () => !unseen, onAttack: () => blows.push(1) });
  w.untilMessenger = w.untilExplorer = 1e9;
  const you = { x: 41.5, y: 10, z: 40.5 };
  for (let i = 0; i < 200; i++) w.tick(0.05, you);
  ok('in disguise, right beside a guard: not a blow', blows.length === 0);
  unseen = false;
  for (let i = 0; i < 200; i++) w.tick(0.05, you);
  ok(`seen through: open battle (${blows.length} blows)`, blows.length > 0);
}

// --- in the game ----------------------------------------------------------------------------------------

ok('disguised: the full Sky armour, on the dark path, at the Sky Kingdom', /if \(!d \|\| d\.sandbox \|\| d\.ring !== 'black' \|\| d\.skyFallen \|\| !gen \|\| d\.disguisedAs\(\) !== 'sky'\) return false;/.test(game));
ok('while unseen, the island\'s people take you for one of their own', /!this\.duilt\.skyFallen && !this\.unseen\(\)\)/.test(game));
ok('what you do feeds the meter: running, the ring, Stone gear, crowding guards, the throne room, a column of warriors', /this\.suspicion\.tick\(dt, \{[\s\S]{0,900}ring: d\.ringWorn\(\) === 'black',[\s\S]{0,200}running: !!this\.player\.running,[\s\S]{0,300}darkGear:[\s\S]{0,400}nearGuards:[\s\S]{0,400}inThrone:[\s\S]{0,400}warriors:/.test(game));
ok('discovered: every guard near knows you, and comes', /revealDisguise\(\) \{[\s\S]{0,300}if \(WANDERERS\[q\.kind\]\?\.sky && Math\.hypot\(q\.x - p\.x, q\.z - p\.z\) < 30\) q\.angry = true;/.test(game));
ok('a ? over each guard looking you over; a ! over those who know', /mark: s\.discovered \? '!' : '\?'/.test(game) && /this\.markerView\.update\(/.test(game));
ok('leave the island, and it\'s forgotten', /if \(away \|\| d\?\.skyFallen\) this\.suspicion\.reset\(\);/.test(game));
const tick = game.slice(game.indexOf('  tickDisguise(dt) {'), game.indexOf('  revealDisguise() {'));
ok('the meter is never a toast', tick.length > 200 && !/toast\(/.test(tick));
ok('it\'s a meter in the HUD: an eye, a bar, what\'s giving you away', /id="vital-suspicion"/.test(ui) && /id="sus-fill"/.test(ui) && /id="sus-reason"/.test(ui) && /renderSuspicion\(s\) \{/.test(ui));
ok('white, amber, red; it pulses while it climbs; "Discovered" when it\'s full', /classList\.toggle\('wary'/.test(ui) && /classList\.toggle\('high'/.test(ui) && /classList\.toggle\('rising'/.test(ui) && /s\.discovered \? 'Discovered'/.test(ui));

process.exit(f ? 1 : 0);
