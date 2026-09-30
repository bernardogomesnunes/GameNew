import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { Mobs } from '../src/world/Mobs.js';
import { MOBS_BY_ID } from '../src/config/mobs.js';
import { PlayerController } from '../src/player/PlayerController.js';
import { tameInto, penProduce, penAnimals, herdToJSON } from '../src/duilt/Ranch.js';
import { fenceBoxes } from '../src/world/propShapes.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';

/**
 * Phase 5b: ranching. Farm animals follow food in your hand, a fence holds
 * them, a gate lets you through but not them, and a claimed pen makes the
 * animals in it yours — saved with the world — and gives eggs, wool, milk
 * or meat for them.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };

const STONE = 3, FENCE = 47, GATE = 48;
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

function field() {
  const world = new World({ sizeX: 48, sizeZ: 48, height: 16 });
  for (let x = 0; x < 48; x++) for (let z = 0; z < 48; z++) world.setBlock(x, 0, z, STONE, { byHand: false });
  return world;
}

// --- a fence stops you; a gate doesn't ------------------------------------------

{
  const world = field();
  for (let x = 10; x < 30; x++) world.setBlock(x, 1, 20, FENCE);
  world.setBlock(20, 1, 20, GATE);
  const walk = (x) => {
    const p = new PlayerController(world, new THREE.Object3D(), { x, y: 1, z: 24.5 });
    p.update(1 / 60);
    p.keys.add('KeyW');
    for (let i = 0; i < 90; i++) { p.update(1 / 60); if (i % 20 === 0) p.requestJump(); }
    return p;
  };
  const atFence = walk(14.5);
  ok(`a fence stops you, even jumping at it (z ${atFence.position.z.toFixed(2)})`, atFence.position.z > 21);
  ok('and you never end up standing on top of it', atFence.position.y < 2);
  const atGate = walk(20.5);
  ok(`a gate lets you straight through (z ${atGate.position.z.toFixed(2)})`, atGate.position.z < 19);
}

// --- ...and holds an animal either way ---------------------------------------------

{
  const world = field();
  for (let x = 0; x < 48; x++) world.setBlock(x, 1, 20, x === 24 ? GATE : FENCE);
  const mobs = new Mobs({ world, rand: rng(1), cap: 0 });
  for (let i = 0; i < 8; i++) mobs.list.push(mobs.make(MOBS_BY_ID.get(i % 2 ? 'sheep' : 'cow'), 20 + i + 0.5, 1, 22.5));
  // Left to wander for a good while, with you stood on the far side.
  for (let i = 0; i < 4000; i++) mobs.tick(0.05, { x: 24.5, y: 1, z: 12.5 });
  ok('no animal wanders past a fence or a gate', mobs.list.every((m) => m.z > 21));
  // Now with food: the ones near enough follow you through the gate, and
  // only through the gate.
  for (let i = 0; i < 1200; i++) mobs.tick(0.05, { x: 24.5, y: 1, z: 16.5 }, { lure: true });
  const through = mobs.list.filter((m) => m.z < 20);
  ok(`led with food, an animal comes through the gate (${through.length} did)`, through.length >= 1);
  ok('and none came over the fence to do it', mobs.list.every((m) => m.z > 21 || m.z < 20));
}

// --- food leads them -----------------------------------------------------------------

{
  const world = field();
  const mobs = new Mobs({ world, rand: rng(2), cap: 0 });
  const sheep = mobs.make(MOBS_BY_ID.get('sheep'), 10.5, 1, 10.5);
  const deer = mobs.make(MOBS_BY_ID.get('deer'), 12.5, 1, 30.5);
  mobs.list.push(sheep, deer);
  deer.timer = 999;
  const player = { x: 18.5, y: 1, z: 10.5 };
  for (let i = 0; i < 200; i++) mobs.tick(0.05, player, { lure: true });
  ok(`a sheep follows food in your hand, and stops at your heel (${Math.hypot(sheep.x - player.x, sheep.z - player.z).toFixed(1)} blocks)`,
    Math.hypot(sheep.x - player.x, sheep.z - player.z) < 2.5);
  ok('a deer does not', Math.hypot(deer.x - 12.5, deer.z - 30.5) < 0.01);
  const before = { x: sheep.x, z: sheep.z };
  for (let i = 0; i < 100; i++) mobs.tick(0.05, { x: 40.5, y: 1, z: 40.5 }, { lure: false });
  ok('put the food away and it stops following', Math.hypot(sheep.x - 40.5, sheep.z - 40.5) > 20 && Math.hypot(sheep.x - before.x, sheep.z - before.z) < 8);
}

// --- a claimed pen makes them yours, and pays for them --------------------------------

{
  const pen = { id: 's1', type: 'pen', valid: true, region: { minX: 10, maxX: 15, minY: 1, maxY: 2, minZ: 10, maxZ: 15 } };
  const mk = (type, x, z, extra = {}) => ({ type, x, y: 1, z, dying: 0, dead: false, ...extra });
  const animals = [mk('chicken', 11.5, 11.5), mk('chicken', 12.5, 12.5), mk('chicken', 13.5, 13.5), mk('sheep', 12.5, 11.5), mk('deer', 12.5, 13.5), mk('cow', 30.5, 30.5)];
  const herd = [];
  const taken = tameInto([pen], animals, herd);
  ok(`farm animals inside the pen become yours (${taken.map((m) => m.type).join(', ')})`,
    taken.length === 4 && herd.length === 4 && taken.every((m) => m.penId === 's1'));
  ok('a deer in there stays wild, and a cow outside it too', !animals[4].penId && !animals[5].penId);
  ok('taking them in twice changes nothing', tameInto([pen], animals, herd).length === 0 && herd.length === 4);

  const out = penProduce(pen, herd);
  ok(`it gives a thing per animal, two of a kind at most (${JSON.stringify(out)})`, out.egg === 2 && out.wool === 1 && !out.milk);
  herd[3].x = 40;
  ok('one that got out stops counting', penAnimals(pen, herd).length === 3 && !penProduce(pen, herd).wool);

  const spec = STRUCTURES_BY_ID.get('pen');
  const dayOut = 2 * (86400 / spec.everySeconds);
  ok(`a pen stays under the building ceiling (${dayOut} of a kind a day)`, dayOut >= 10 && dayOut <= 15);

  const json = herdToJSON(herd);
  ok('the herd saves where each one is and whose it is', json.length === 4 && json.every((r) => r.penId === 's1' && typeof r.x === 'number' && r.type));
  // Back from a save: plain records, taken in by a fresh Mobs as the same objects.
  const world = field();
  const mobs = new Mobs({ world, rand: rng(3), cap: 0 });
  const loaded = json.map((r) => ({ ...r }));
  mobs.adopt(loaded);
  ok('a fresh world takes the saved herd back in, as the very same objects', mobs.list.length === 4 && loaded.every((r) => mobs.list.includes(r) && r.hp > 0 && r.id));
  mobs.adopt(loaded);
  ok('and only once', mobs.list.length === 4);
  for (let i = 0; i < 20; i++) mobs.tick(0.05, { x: 10000, y: 1, z: 10000 });
  ok('your own animals are never forgotten, however far you go', mobs.list.length === 4);
}

// --- the registry pays a pen from its animals, and an empty one lets the clock run -----

{
  const world = field();
  const reg = new StructureRegistry({ world, inventory: { add: () => 0 } });
  const s = { id: 'p1', type: 'pen', valid: true, region: { minX: 0, maxX: 5, minY: 1, maxY: 2, minZ: 0, maxZ: 5 }, lastPaidAt: 0 };
  reg.structures.push(s);
  reg.deliver = () => true;
  const period = STRUCTURES_BY_ID.get('pen').everySeconds * 1000;
  let got = reg.collect({ now: period * 3, producesFor: () => ({}) });
  ok('an empty pen gives nothing and its clock moves on', !Object.keys(got).length && s.lastPaidAt === period * 3);
  got = reg.collect({ now: period * 5, producesFor: () => ({ egg: 2 }) });
  ok(`with hens in it, it pays for the time since — not for when it stood empty (${got.egg} eggs)`, got.egg === 4);
}

// --- a line of fence joins up -----------------------------------------------------------

{
  const lone = fenceBoxes('fence', {});
  const run = fenceBoxes('fence', { px: 1, nx: 1 });
  ok('a fence on its own is a post', lone.length === 1);
  ok('between two others it runs rails both ways', run.length === 5 && run.filter((b) => b.maxX === 1).length === 2 && run.filter((b) => b.minX === 0).length === 2);
  const gateZ = fenceBoxes('gate', { pz: 1, nz: 1 });
  ok('a gate turns to run the way its fence does', gateZ.every((b) => b.minX >= 0.4));
}

process.exit(f ? 1 : 0);
