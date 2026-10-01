import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Guardian, GUARDIANS, MODES, DOWNED_SECONDS } from '../src/world/Guardian.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { WANDERERS } from '../src/config/wanderers.js';
import { validateStructure } from '../src/structures/validate.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';

/**
 * Phase 7d — the Sanctuary and the guardian (docs/plan-phase7-lore.md):
 * "Only your god's Sanctuary can be built: the White Sanctuary (open marble
 * and light) or the Black Sanctuary (obsidian and a pit). Building it
 * summons the guardian, tamed to whoever called it: a great winged stag of
 * light (fast, heals) or a shadow beast (enemies near it lose their nerve).
 * It follows you, holds position or attacks; it can be downed, and comes
 * back to its Sanctuary after a day."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

const flat = () => {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) world.setBlock(x, 0, z, 3);
  return world;
};

/** A starter design, stamped at (10, 1, 10), and the region it covers. */
function stamp(world, id) {
  const d = DESIGN_FOR_STRUCTURE.get(id);
  const at = { x: 10, y: 1, z: 10 };
  for (const b of d.blocks) world.setBlock(at.x + b.dx, at.y + b.dy, at.z + b.dz, b.type);
  return { minX: at.x, minY: at.y, minZ: at.z, maxX: at.x + d.extent.x, maxY: at.y + d.extent.y + 2, maxZ: at.z + d.extent.z };
}

// --- the two Sanctuaries ---------------------------------------------------------------

for (const [id, ring] of [['sanctuary_white', 'white'], ['sanctuary_black', 'black']]) {
  const spec = STRUCTURES_BY_ID.get(id);
  ok(`the ${spec.name} belongs to the ${ring} ring`, spec?.ring === ring);
  const world = flat();
  const region = stamp(world, id);
  const v = validateStructure(world, region, id);
  ok(`  its starter design stands (${v.reason ?? 'ok'})`, v.ok);
}

{
  const world = flat();
  const region = stamp(world, 'sanctuary_white');
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: false });
  g.territory.setAge(3);
  g.inventory.add('devotion', 20);
  const none = g.claimOptionsFor(region).find((o) => o.id === 'sanctuary_white');
  ok(`without a ring, no Sanctuary (${none.reason})`, !none.ok && /White Ring/.test(none.reason));
  g.ring = 'black';
  const wrong = g.claim(region, 'sanctuary_white');
  ok(`and the other god's is not for you (${wrong.reason})`, !wrong.ok && /Black Ring/.test(wrong.reason) && !g.guardian);
}

// --- raising it summons the guardian --------------------------------------------------

{
  const world = flat();
  const region = stamp(world, 'sanctuary_white');
  const events = [];
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit: (e, d) => events.push([e, d]), on() {} }, sandbox: true });
  g.ring = 'white';
  const r = g.claim(region, 'sanctuary_white');
  ok('the bearer of the White Ring raises the White Sanctuary', r.ok);
  ok('and Aurelion, the white stag, comes to them', g.guardian?.ring === 'white' && g.guardian.name === 'Aurelion'
    && events.some(([e]) => e === 'guardian:summoned'));
  ok('standing in the middle of its Sanctuary', Math.abs(g.guardian.x - (region.minX + region.maxX + 1) / 2) < 0.01);

  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  g.guardian.mode = 'stay';
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('the guardian is saved with the world, orders and all', back.guardian?.ring === 'white' && back.guardian.mode === 'stay');
}

// --- how it behaves ------------------------------------------------------------------------

{
  const world = flat();
  const home = { x: 20.5, y: 1, z: 20.5 };
  const stag = new Guardian({ world, ring: 'white', home });
  ok('three orders, in turn: follow, stay, hunt', MODES.join() === 'follow,stay,attack'
    && stag.command() === 'stay' && stag.command() === 'attack' && stag.command() === 'follow');

  // Follow.
  const player = { x: 34.5, y: 1, z: 20.5 };
  for (let i = 0; i < 300; i++) stag.tick(1 / 30, player, []);
  const d = Math.hypot(stag.x - player.x, stag.z - player.z);
  ok(`following, it keeps close behind you (${d.toFixed(1)} blocks)`, d < 4.5 && d > 1);
  // Stay.
  stag.command();
  const was = { x: stag.x, z: stag.z };
  for (let i = 0; i < 120; i++) stag.tick(1 / 30, { x: 5.5, y: 1, z: 5.5 }, []);
  ok('told to stay, it holds where it is', Math.hypot(stag.x - was.x, stag.z - was.z) < 0.01);
  stag.command(); stag.command(); // back to follow

  // Heal.
  let healed = 0;
  const near = { x: stag.x + 2, y: 1, z: stag.z };
  for (let i = 0; i < 300; i++) stag.tick(1 / 30, near, [], { heal: () => healed++ });
  ok(`the stag heals you while you're near it (${healed} in ten seconds)`, healed >= 3 && healed <= 4);
  ok('it is faster than the beast', GUARDIANS.white.speed > GUARDIANS.black.speed);

  // Fight.
  const bandit = { x: stag.x + 3, y: 1, z: stag.z, kind: 'bandit', name: 'Rook' };
  const blows = [];
  for (let i = 0; i < 120; i++) stag.tick(1 / 30, { x: stag.x, y: 1, z: stag.z }, [bandit], { strike: (e, n) => blows.push([e, n]) });
  ok(`a bandit near you, it goes for it (${blows.length} blows in four seconds)`, blows.length >= 3 && blows.every(([e, n]) => e === bandit && n === GUARDIANS.white.hits));
  ok('and takes some back', stag.hp < GUARDIANS.white.hp);

  // Downed and back.
  let downed = 0, backAgain = 0;
  stag.hp = 1;
  stag.cooldown = 0;
  stag.tick(1 / 30, { x: stag.x, y: 1, z: stag.z }, [{ ...bandit, x: stag.x + 1, z: stag.z }], { strike() {}, downed: () => downed++ });
  ok('beaten down, it is gone to its Sanctuary', downed === 1 && stag.downed === DOWNED_SECONDS);
  ok('and cannot be pointed at meanwhile', stag.pick({ x: stag.x, y: 2, z: stag.z - 3 }, { x: 0, y: 0, z: 1 }) === null);
  for (let t = 0; t < DOWNED_SECONDS - 1; t += 1) stag.tick(1, player, [], { back: () => backAgain++ });
  ok('not back before a day is out', stag.downed > 0 && backAgain === 0);
  stag.tick(2, player, [], { back: () => backAgain++ });
  ok('after a day, back at its Sanctuary and whole again', backAgain === 1 && stag.hp === GUARDIANS.white.hp && stag.x === home.x && stag.z === home.z);
}

{
  // The beast frightens bandits — and a frightened bandit runs.
  const world = flat();
  const beast = new Guardian({ world, ring: 'black', home: { x: 20.5, y: 1, z: 20.5 } });
  const scared = [];
  const bandit = { x: 24.5, y: 1, z: 20.5 };
  beast.command(); // stay, so it doesn't close in
  beast.tick(1 / 30, { x: 20.5, y: 1, z: 20.5 }, [bandit], { scare: (e, s) => scared.push([e, s]) });
  ok('Umbra, the shadow beast, makes bandits near it lose their nerve', beast.name === 'Umbra' && scared.length === 1 && scared[0][1] > 0);

  const w = new Wanderers({ world, hostile: () => true });
  const p = w.person('bandit', 30.5, 1, 30.5, { home: { x: 30.5, z: 30.5 }, raider: true, stage: 'coming' });
  w.list.push(p);
  w.scare(p, 6);
  const player = { x: 31.5, y: 1, z: 30.5 };
  for (let i = 0; i < 30; i++) w.tick(1 / 30, player);
  ok('and a frightened bandit breaks and runs, at full health', p.hp === WANDERERS.bandit.hp && Math.hypot(p.x - player.x, p.z - player.z) > 2);
}

// --- in the game ---------------------------------------------------------------------------

ok('it fights, heals and frightens through the world', /tickGuardian\(dt\)/.test(game) && /this\.wanderers\.hit\(e, damage, g\.x, g\.z\)/.test(game)
  && /heal: \(\) => this\.duilt\.health\.heal\(1\)/.test(game) && /this\.wanderers\.scare\(e, seconds\)/.test(game));
ok('Place on it gives it its next order', /if \(this\.guardianTarget\(aimed\)\) return void this\.commandGuardian\(\)/.test(game));
ok('pointed at, it says what it is doing', /MODE_WORDS\[guardian\.mode\]/.test(game));
ok('its coming is announced', /this\.bus\.on\('guardian:summoned'/.test(game));

process.exit(f ? 1 : 0);
