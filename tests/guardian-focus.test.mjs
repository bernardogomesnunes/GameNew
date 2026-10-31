import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { Guardian } from '../src/world/Guardian.js';
import { Wanderers } from '../src/world/Wanderers.js';
globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');

function fixture(mode = 'follow') {
  const world = new World({ sizeX: 96, sizeZ: 64, height: 16 });
  for (let x = 0; x < 96; x++) for (let z = 0; z < 64; z++) world.setBlock(x, 0, z, 3);
  const home = { x: 20.5, y: 1, z: 20.5 };
  const guardian = new Guardian({ world, ring: 'white', home }); guardian.mode = mode;
  const wanderers = new Wanderers({ world, hostile: () => true, rand: () => 0.5 });
  const game = Object.assign(Object.create(Game.prototype), {
    world, wanderers, player: { position: { ...home } },
    duilt: { guardian, health: { heal() {} }, collect: () => ({}) },
    ui: { toast() {} }, lastStrikeAt: -Infinity,
    strikeCooldown: () => 0, blowDamage: () => 1, banditFell() {},
  });
  Object.defineProperty(game, 'selectedItemId', { value: null });
  const person = (kind, x = 34.5, hp = 30) => {
    const p = wanderers.person(kind, x, 1, 20.5); p.hp = hp;
    wanderers.list.push(p); return p;
  };
  const hit = p => { game.banditTarget = () => p; return game.hitBandit(null); };
  return { game, guardian, person, hit };
}
const tests = [];
const test = (name, run) => tests.push([name, run]);
for (const mode of ['follow', 'stay', 'attack']) test(`melee last-hit priority works in ${mode} mode`, () => {
  const { game, guardian, person, hit } = fixture(mode);
  const near = person('bandit', 22.5), struck = person('bandit', 38.5);
  hit(struck); game.tickGuardian(0.1);
  assert.equal(guardian.target, struck); assert.notEqual(guardian.target, near);
});
test('successful arrow hits replace the previous enemy focus', () => {
  const { game, guardian, person, hit } = fixture(); hit(person('bandit'));
  const other = person('soldier', 39.5); other.war = true;
  game.arrowHit({ damage: 1, x: 20, z: 20, vx: 1, vz: 0 }, { kind: 'bandit', person: other });
  game.tickGuardian(0.1);
  assert.equal(other.hp, 29); assert.equal(guardian.target, other);
});
test('killing the last enemy clears previous enemy focus for melee and arrows', () => {
  for (const ranged of [false, true]) {
    const { game, guardian, person, hit } = fixture(); hit(person('bandit'));
    const last = person('bandit', 35.5, 1);
    if (ranged) game.arrowHit({ damage: 1, x: 20, z: 20, vx: 1, vz: 0 }, { kind: 'bandit', person: last });
    else hit(last);
    assert.equal(last.dead, true); assert.equal(guardian.focused, null);
  }
});
test('peaceful travellers never become guardian targets even after being hit', () => {
  for (const kind of ['hermit', 'citizen', 'explorer']) {
    const { game, guardian, person, hit } = fixture(); const peaceful = person(kind, 22.5);
    hit(peaceful); game.tickGuardian(0.1);
    assert.equal(peaceful.angry, true);
    assert.equal(guardian.target, null, kind); assert.equal(guardian.focused, null, kind);
  }
});
test('hitting a farm animal leaves enemy priority unchanged', () => {
  const { game, guardian, person, hit } = fixture(); const target = person('bandit'); hit(target);
  const cow = { type: 'cow', hp: 10, x: 22, y: 1, z: 20 };
  game.mobs = { hit(m, damage) { m.hp -= damage; return { killed: false, drops: {} }; } };
  game.arrowHit({ damage: 1, x: 20, z: 20, vx: 1, vz: 0 }, { kind: 'mob', mob: cow });
  game.tickGuardian(0.1);
  assert.equal(cow.hp, 9); assert.equal(guardian.focused, target);
});
test('focus lasts until an enemy is finished rather than expiring after twelve seconds', () => {
  const { game, guardian, person, hit } = fixture(); const target = person('warlord', 40.5, 80);
  person('bandit', 22.5); hit(target);
  for (let i = 0; i < 200 && !target.dead; i++) game.tickGuardian(0.1);
  assert.equal(target.dead, true); assert.ok(guardian.hp > 0);
});
test('focus releases dead, despawned and out-of-leash targets', () => {
  for (const how of ['dead', 'despawned', 'leash']) {
    const { game, guardian, person, hit } = fixture(); const target = person('bandit'); hit(target);
    if (how === 'dead') target.dead = true;
    if (how === 'despawned') game.wanderers.list = [];
    if (how === 'leash') target.x = 90;
    game.tickGuardian(0.1); assert.equal(guardian.focused, null, how);
  }
});
test('guardian reload keeps orders but does not persist stale entity references', () => {
  const { game, guardian, person, hit } = fixture('stay'); hit(person('bandit'));
  const restored = new Guardian({ world: game.world, ring: 'white', home: guardian.home, state: guardian.toJSON() });
  assert.equal(restored.mode, 'stay'); assert.equal(restored.focused, null);
  restored.tick(0.1, game.player.position, []); assert.equal(restored.target, null);
});
let failures = 0;
for (const [name, run] of tests) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.log(`FAIL ${name}: ${error.message.slice(0, 160)}`); }
}
if (failures) process.exitCode = 1;
