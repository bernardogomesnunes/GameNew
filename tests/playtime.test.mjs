import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { farmProduce } from '../src/duilt/Crops.js';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

/**
 * Buildings work only while the game is open (asked for directly: "Let's put
 * progress items only in game time not all the time or it's gonna fill any
 * storage", then "game closed no production").
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const HOUR = 3600_000, FARMLAND = 21;

// --- the registry: time away skipped -------------------------------------------------
const farm = () => {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  for (let x = 4; x < 8; x++) for (let z = 4; z < 8; z++) world.setBlock(x, 10, z, FARMLAND);
  world.setBlock(10, 10, 6, 11); // water
  for (let x = 4; x < 8; x++) world.setBlock(x, 11, 4, 119);
  const reg = new StructureRegistry({ world, bus: null, inventory: new Inventory() });
  reg.claim({ minX: 4, maxX: 7, minY: 10, maxY: 11, minZ: 4, maxZ: 7 }, 'farm');
  reg.list()[0].seeds = ['carrot'];
  return reg;
};
{
  const reg = farm();
  const t0 = reg.list()[0].lastPaidAt;
  // Four hours played, then four hours away.
  const played = reg.collect({ now: t0 + 4 * HOUR, producesFor: farmProduce });
  reg.skipAway(4 * HOUR, { now: t0 + 8 * HOUR });
  const away = reg.collect({ now: t0 + 8 * HOUR, producesFor: farmProduce });
  ok(`four hours played pays (${played.vegetables} vegetables)`, played.vegetables > 0);
  ok('four hours away pays nothing', Object.keys(away).length === 0);
  // Half a cycle done before leaving is still half done after.
  const r2 = farm();
  const s = r2.list()[0], t1 = s.lastPaidAt;
  r2.skipAway(10 * HOUR, { now: t1 + 2 * HOUR + 10 * HOUR });
  ok('a cycle half done when you left is still half done', s.lastPaidAt === t1 + 10 * HOUR);
  r2.skipAway(-5);
  ok('nothing odd for no time at all', s.lastPaidAt === t1 + 10 * HOUR);
}

// --- a world opened: the time it was closed isn't paid ----------------------------
const scene = new THREE.Scene();
const { world } = generateDuiltWorld({ sizeX: 96, sizeZ: 96, height: 64, seed: 4 });
// A real quarry, open to the sky, so it still counts when the world is
// opened again: a floor of stone, a stone rim, dug out inside.
for (let x = 0; x <= 5; x++) for (let z = 0; z <= 5; z++) {
  world.setBlock(x, 40, z, 3);
  world.setBlock(x, 41, z, x === 0 || x === 5 || z === 0 || z === 5 ? 3 : 0);
  for (let y = 42; y < 64; y++) world.setBlock(x, y, z, 0);
}
{
  const g = new DuiltGame({ world, scene, bus: null });
  const t = Date.now();
  g.structures.structures.push({ id: g.structures.nextId++, type: 'quarry', region: { minX: 0, maxX: 5, minY: 40, maxY: 42, minZ: 0, maxZ: 5 }, valid: true, locked: true, claimedAt: t, lastPaidAt: t, brokenReason: null, excludes: [], tier: 0 });
  const saved = JSON.parse(JSON.stringify(g.toJSON()));
  // Closed for six hours: the clocks as they'd read, saved six hours ago.
  saved.savedAt -= 6 * HOUR;
  for (const s of saved.structures.structures ?? []) s.lastPaidAt -= 6 * HOUR;
  const back = new DuiltGame({ world, scene, bus: null });
  const gained = back.loadJSON(saved);
  ok(`opened after six hours closed: nothing was made meanwhile (${JSON.stringify(gained)})`, Object.keys(gained ?? {}).length === 0);
  // An old save without a time on it still pays as before.
  const old = JSON.parse(JSON.stringify(saved));
  delete old.savedAt;
  const before = new DuiltGame({ world, scene, bus: null });
  ok('a save with no time on it is paid as it always was', Object.keys(before.loadJSON(old) ?? {}).length > 0);

  // Put away (another app, the phone locked) and brought back.
  const s = back.structures.list()[0];
  const was = s.lastPaidAt;
  back.pauseClock(t);
  back.resumeClock(t + 2 * HOUR);
  ok('put away for two hours: its clock moves on two hours', s.lastPaidAt === Math.min(t + 2 * HOUR, was + 2 * HOUR));
  ok('and the clock runs again', back.awaySince == null);
  back.pauseClock(t);
  back.pauseClock(t + HOUR);
  ok('put away twice, it counts from the first', back.awaySince === t);
}

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('hidden, the clocks stop and it saves; shown, they run again',
  /if \(document\.visibilityState === 'hidden'\) \{ this\.duilt\?\.pauseClock\(\); save\(\); \}\s*else this\.duilt\?\.resumeClock\(\);/.test(game)
  && /window\.addEventListener\('pagehide', \(\) => \{ this\.duilt\?\.pauseClock\(\); save\(\); \}\);/.test(game));

process.exit(f ? 1 : 0);
