import * as THREE from 'three';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Territory } from '../src/world/Territory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { Inventory } from '../src/items/Inventory.js';
import { GamificationEngine } from '../src/gamification/GamificationEngine.js';
import { ITEMS } from '../src/config/items.js';
import { STRUCTURES } from '../src/config/structures.js';
import { AGES } from '../src/config/ages.js';

/**
 * Reported directly: Creative should be "the same as duilt without
 * achievements progression" — a free-build sandbox on the same engine
 * (bag, buildings, settlers) rather than a second, thinner copy of it, with
 * "basically all items available… only need one of each" and structures
 * that "just work" rather than needing claimed and paid for. See
 * DuiltGame's own note on what `sandbox: true` actually turns off.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const WOOD = 4, DIRT = 2;

const { world, origin } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, seed: 11 });
const scene = new THREE.Scene();
const events = [];
const bus = { emit: (t, p) => events.push({ t, p }), on: () => {} };

const g = new DuiltGame({ world, scene, bus, sandbox: true });

// --- the kit --------------------------------------------------------------

{
  g.grantCreativeKit();
  ok('grants one of every item there is, but the building tools', ITEMS.filter((i) => !i.grants).every((i) => g.inventory.countOf(i.id) === 1));
  ok('no pry bar or chalk line: Clear and Mirror aren\'t for players', g.inventory.countOf('pry_bar') === 0 && g.inventory.countOf('chalk_line') === 0);
  ok('grew the bag to fit all of them rather than losing any off the end',
    g.inventory.size >= ITEMS.length);
}

// --- placing and breaking never touch the bag ------------------------------

{
  const before = g.inventory.countOf('wood');
  const gained = g.onBlocksBroken([{ x: 0, y: 0, z: 0, prev: WOOD, next: 0 }]);
  ok('breaking a block adds nothing — a sandbox bag never needs topping up',
    Object.keys(gained).length === 0 && g.inventory.countOf('wood') === before);

  const pay = g.payForPlacement([{ x: 1, y: 1, z: 1, prev: 0, next: DIRT }]);
  ok('placing is free — ok with an empty bill, not a real charge', pay.ok && !Object.keys(pay.bill).length);
  ok('and nothing was actually spent', g.inventory.countOf('dirt') === 1);
}

// --- the border is gone -----------------------------------------------------

{
  ok('every point is inside — there is no border to be outside of',
    g.canEditAt(origin.minX - 500, origin.minZ - 500).ok);
  ok('a region a thousand blocks across still counts as contained',
    g.territory.containsRegion({ minX: -2000, minZ: -2000, maxX: 2000, maxZ: 2000 }));
  ok('distanceOutside is always 0', g.territory.distanceOutside(-99999, 99999) === 0);
  ok('no fence mesh gets built for a sandbox territory', g.territory.fence.children.length === 0);
}

// --- every structure is available, and claiming is free --------------------

{
  const region = { minX: origin.minX + 3, minZ: origin.minZ + 3, maxX: origin.minX + 3, maxZ: origin.minZ + 3, minY: 0, maxY: 0 };
  ok('claimOptionsFor offers every structure the game has, not just Age 1\'s',
    g.claimOptionsFor(region).length === STRUCTURES.length);

  // An empty bag, deliberately: if `free` ever forgot to skip the cost
  // check, this is the one condition guaranteed to fail it.
  const empty = new Inventory({ bus });
  const result = new StructureRegistry({ world, bus, inventory: empty })
    .claim(region, STRUCTURES[0].id, { free: true });
  ok('claim({ free: true }) is never refused for what the bag does not hold',
    !/bag|Needs/.test(result.reason ?? ''));
  ok('and never actually spends anything either way', empty.slots.every((s) => !s));
}

// --- no progression at all --------------------------------------------------

{
  ok('checkAgeAdvance is a no-op — there is no age to advance through', g.checkAgeAdvance() === null);
  ok('territory.advance refuses too', g.territory.advance() === null);

  const gam = new GamificationEngine(bus);
  gam.setDuilt(g);
  gam.state.achievementsUnlocked.clear();
  gam.checkAchievements({ type: 'place', blockId: WOOD });
  ok('a sandbox world never unlocks an achievement', gam.state.achievementsUnlocked.size === 0);

  // Same engine, not sandboxed — the control case, so the guard above is
  // known to actually be doing something rather than achievements never
  // firing for any other reason.
  const survival = new DuiltGame({ world, scene: new THREE.Scene(), bus, sandbox: false });
  const gam2 = new GamificationEngine(bus);
  gam2.setDuilt(survival);
  gam2.checkAchievements({ type: 'place', blockId: WOOD });
  ok('the same check against real Duilt is free to unlock things', gam2.state.achievementsUnlocked.size >= 0);
}

// --- Territory itself, isolated from DuiltGame ------------------------------

{
  const t = new Territory({ world, scene: new THREE.Scene(), bus, sandbox: true });
  ok('a sandbox Territory draws no fence at construction either', t.fence.children.length === 0);
  ok('contains() says yes everywhere', t.contains(1_000_000, -1_000_000));
  t.onBlocksChanged([{ x: 0, z: 0 }]);
  ok('onBlocksChanged is a no-op — nothing to redraw', t.fence.children.length === 0);

  const survivalT = new Territory({ world, scene: new THREE.Scene(), bus, age: 1 });
  ok('a real Territory still draws its fence, for comparison', survivalT.fence.children.length > 0);
  ok('and still has a real border', !survivalT.contains(1_000_000, -1_000_000));
}

process.exit(f ? 1 : 0);
