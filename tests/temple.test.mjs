import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { generateEndlessWorld } from '../src/world/StarterWorld.js';
import { landmarksFor } from '../src/world/landmarks.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { lootFor, LOOT } from '../src/duilt/Loot.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { validateStructure, tierStatus } from '../src/structures/validate.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { SUNSTONE_ORE, NIGHTSTONE_ORE, CHEST, isChest, lightOf, BLOCKS_BY_ID } from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { boxesFor } from '../src/world/propShapes.js';

/**
 * Phase 7c — the Temple and the choice (docs/plan-phase7-lore.md), with the
 * rings' own ores decided with the user: "we should have dedicated ores for
 * it. That can be found in chests or deep in the caves as a very rare
 * material."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- the ring ores --------------------------------------------------------------------

ok('Sunstone and Nightstone are blocks of rock with glowing crystals',
  [SUNSTONE_ORE, NIGHTSTONE_ORE].every((id) => !BLOCKS_BY_ID.get(id).shape && boxesFor(BLOCKS_BY_ID.get(id).overlay).filter((b) => b.glow).length >= 12 && lightOf(id)));
ok('Sunstone glows gold, Nightstone violet', (lightOf(SUNSTONE_ORE).color >> 16) > (lightOf(SUNSTONE_ORE).color & 0xff)
  && (lightOf(NIGHTSTONE_ORE).color & 0xff) > ((lightOf(NIGHTSTONE_ORE).color >> 8) & 0xff));
ok('mined, they give the ore', ITEM_FOR_BLOCK.get(SUNSTONE_ORE) === 'sunstone' && ITEM_FOR_BLOCK.get(NIGHTSTONE_ORE) === 'nightstone');

{
  const { world } = generateEndlessWorld({ seed: 42 });
  let ores = 0, chests = 0, deepEnough = true, onCaveWall = true, chestsDeep = true;
  const N = 8;
  for (let cx = -N / 2; cx < N / 2; cx++) {
    for (let cz = -N / 2; cz < N / 2; cz++) {
      const c = world.getChunk(cx, cz);
      for (let i = 0; i < c.data.length; i++) {
        const id = c.data[i];
        if (id !== SUNSTONE_ORE && id !== NIGHTSTONE_ORE && !isChest(id)) continue;
        // Chunk layout: x fastest, then z, then y — see World's Chunk.
        const lx = i % 16, lz = Math.floor(i / 16) % 16, y = Math.floor(i / 256);
        const x = cx * 16 + lx, z = cz * 16 + lz;
        if (isChest(id)) {
          chests++;
          if (y >= 60) chestsDeep = false;
          continue;
        }
        ores++;
        if (y >= 30) deepEnough = false;
        const air = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, d]) => world.getBlock(x + a, y + b, z + d) === 0);
        if (!air) onCaveWall = false;
      }
    }
  }
  ok(`very rare — ${ores} in ${N * N} chunks`, ores >= 3 && ores / (N * N) < 0.6);
  ok('only near the bottom of the world', deepEnough);
  ok('and only on a cave wall, where the glow can be seen', onCaveWall);
  ok(`chests, now and then, on deep cave floors (${chests})`, chests >= 1 && chests / (N * N) < 0.2 && chestsDeep);
}

// --- chests to find ---------------------------------------------------------------------

{
  const { world } = generateEndlessWorld({ seed: 42 });
  const lms = landmarksFor(world.gen);
  ok('the hermit keeps a chest, and every camp has its takings',
    lms.every((l) => l.blocks.some(([, , , id]) => isChest(id))));

  const a = lootFor('cave', 10, 20, 30, 42), b = lootFor('cave', 10, 20, 30, 42);
  ok('what a chest holds is decided by where it is — the same every time', JSON.stringify(a) === JSON.stringify(b));
  let ring = 0, any = 0;
  for (let i = 0; i < 400; i++) {
    const l = lootFor('cave', i * 7, 20, i * 13, 42);
    if (Object.keys(l).length) any++;
    if (l.sunstone || l.nightstone) ring++;
  }
  ok(`a cave chest is rarely empty (${any}/400)`, any > 360);
  ok(`and now and then holds a ring ore (${ring}/400)`, ring > 60 && ring < 200);
  ok('camps and the hermit hold less of it than the deep caves', LOOT.camp.ring < LOOT.cave.ring && LOOT.hermit.ring < LOOT.cave.ring);

  const g = new DuiltGame({ world: new World({ sizeX: 32, sizeZ: 32, height: 32 }), scene: new THREE.Scene(), bus: null });
  const loot = g.unpackFound(4, 5, 6, 'camp', 42);
  const chest = g.chestAt(4, 5, 6, { create: false });
  ok('opened, a found chest has its loot in it', !!loot && Object.entries(loot).every(([id, n]) => chest.inventory.countOf(id) === n) && chest.found === 'camp');
  ok('once — a second opening rolls nothing new', g.unpackFound(4, 5, 6, 'camp', 42) === null);
  g.chestAt(9, 9, 9);
  ok('and a chest you made is never "found"', g.unpackFound(9, 9, 9, 'cave', 42) === null);
  ok('it\'s titled for where it was found', g.storeSummary({ chest: { x: 4, y: 5, z: 6 } }).found === LOOT.camp.name);
  ok('in the game, opening or breaking one unpacks it first', /openChest\(hit\)[\s\S]{0,200}this\.unpackFound\(hit\.x, hit\.y, hit\.z\)/.test(game)
    && /if \(isChest\(c\.prev\) && !isChest\(c\.next\)\) this\.unpackFound/.test(game));
}

// --- the Temple ---------------------------------------------------------------------------

const TEMPLE = STRUCTURES_BY_ID.get('temple');
ok('a temple, from Age 3, that is a station to stand at', TEMPLE?.age === 3 && TEMPLE.station === 'temple');
ok('five levels: Shrine, Chapel, Temple, Great Temple, High Temple',
  TEMPLE.tiers.map((t) => t.id).join() === 'shrine,chapel,temple,great,high');
ok('each after the first paid for in devotion, more each time',
  TEMPLE.tiers.slice(1).every((t, i, a) => t.cost?.devotion > (a[i - 1]?.cost?.devotion ?? 0)));
ok('it makes devotion, and more as it grows',
  TEMPLE.produces.devotion > 0 && TEMPLE.tiers.at(-1).produces.devotion > TEMPLE.produces.devotion);

/** The starter shrine, stamped into a flat world. */
function shrine() {
  const world = new World({ sizeX: 48, sizeZ: 48, height: 48 });
  for (let x = 0; x < 48; x++) for (let z = 0; z < 48; z++) world.setBlock(x, 0, z, 3);
  const d = DESIGN_FOR_STRUCTURE.get('temple');
  const at = { x: 10, y: 1, z: 10 };
  for (const b of d.blocks) world.setBlock(at.x + b.dx, at.y + b.dy, at.z + b.dz, b.type);
  const region = { minX: at.x, minY: at.y, minZ: at.z, maxX: at.x + d.extent.x, maxY: at.y + d.extent.y, maxZ: at.z + d.extent.z };
  return { world, region, at };
}

{
  const { world, region, at } = shrine();
  const v = validateStructure(world, region, 'temple');
  ok(`the starter shrine stands as a temple (${v.reason ?? 'ok'})`, v.ok);
  ok('at its first level', tierStatus(world, region, 'temple', 0).tier === 0);

  // Build it up into a chapel: two windows in the walls, a second light.
  world.setBlock(at.x + 2, at.y + 2, at.z + 4, 176);
  world.setBlock(at.x + 6, at.y + 2, at.z + 4, 176);
  world.setBlock(at.x + 3, at.y + 1, at.z + 5, 26);
  const inventory = new Inventory();
  const reg = new StructureRegistry({ world, bus: null, inventory });
  const t = { id: 1, type: 'temple', region, valid: true, locked: true, claimedAt: Date.now(), lastPaidAt: Date.now(), brokenReason: null, tier: 0 };
  reg.structures.push(t);
  const status = tierStatus(world, region, 'temple', 0);
  ok('built up with windows and a second light, it is ready to be a chapel', status.canEvolve && status.next.cost?.devotion === 3);
  const refused = reg.evolve(1);
  ok(`but not without the devotion (${refused.reason})`, !refused.ok && /devotion/.test(refused.reason) && t.tier === 0);
  inventory.add('devotion', 5);
  const done = reg.evolve(1);
  ok('with it, it evolves, and the devotion is spent', done.ok && t.tier === 1 && inventory.countOf('devotion') === 2);
}

// --- devotion, holy water, rings -------------------------------------------------------------

{
  const offerings = RECIPES.filter((r) => r.station === 'temple' && r.output.id === 'devotion');
  ok(`offerings at the temple turn food, gold and candles into devotion (${offerings.length})`,
    offerings.length >= 4 && ['fruit', 'gold', 'lantern'].every((id) => offerings.some((r) => r.inputs[id])));
  const hw = RECIPES.find((r) => r.id === 'holy_water');
  ok('a chapel blesses water', hw.station === 'temple' && hw.tier === 1 && hw.inputs.devotion);
  const white = RECIPES.find((r) => r.id === 'ring_white'), black = RECIPES.find((r) => r.id === 'ring_black');
  ok('the High Temple forges the rings', white.tier === 4 && black.tier === 4);
  ok('the White Ring from Sunstone and gold, the Black from Nightstone and obsidian, both with devotion',
    white.inputs.sunstone && white.inputs.gold && white.inputs.devotion && black.inputs.nightstone && black.inputs.obsidian && black.inputs.devotion);
  ok('and they are worn in the ring slot', ['ring_white', 'ring_black'].every((id) => ITEMS_BY_ID.get(id).wears === 'ring'));
}

{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  g.inventory.add('fruit', 12);
  g.inventory.add('glass', 2);
  g.inventory.add('sunstone', 3); g.inventory.add('gold', 4);
  g.inventory.add('nightstone', 3); g.inventory.add('obsidian', 4);
  g.inventory.add('devotion', 30);

  const atShrine = ['temple', 'temple@0'];
  const atHigh = ['temple', 'temple@0', 'temple@1', 'temple@2', 'temple@3', 'temple@4'];
  ok('offerings are made at the temple', g.crafting.craft('offer_fruit', 2, { atStations: atShrine }).ok && g.inventory.countOf('devotion') === 32);
  ok('not anywhere else', !g.crafting.craft('offer_fruit', 1, { atStations: [] }).ok);
  const early = g.crafting.craft('holy_water', 1, { atStations: atShrine });
  ok(`holy water needs a chapel, not a shrine (${early.reason})`, !early.ok);
  ok('at a chapel it\'s blessed', g.crafting.craft('holy_water', 1, { atStations: ['temple', 'temple@0', 'temple@1'] }).ok && g.inventory.countOf('holy_water') === 2);
  const tooSoon = g.crafting.available(3, { station: null, atStations: atShrine }).find((r) => r.id === 'ring_white');
  ok(`a ring can't be forged below the High Temple (${tooSoon.reason})`, !tooSoon.ok && /level 5/.test(tooSoon.reason));

  const forged = g.crafting.craft('ring_white', 1, { atStations: atHigh });
  ok('at the High Temple, the White Ring is forged', forged.ok && g.inventory.countOf('ring_white') === 1 && g.ring === 'white');
  const other = g.crafting.craft('ring_black', 1, { atStations: atHigh });
  ok(`and the Black Ring is closed for good (${other.reason})`, !other.ok && g.inventory.countOf('ring_black') === 0);
  const avail = g.crafting.available(3, { station: null, atStations: atHigh }).find((r) => r.id === 'ring_black');
  ok('the bench says so too', !avail.ok && /White Ring/.test(avail.reason));

  // Wear it.
  g.wear(g.inventory.slots.findIndex((s) => s?.id === 'ring_white'));
  ok('worn, the ring is on', g.ringWorn() === 'white');
  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('the choice is saved with the world', back.ring === 'white' && back.ringWorn() === 'white');

  // Drink.
  g.health.value = 10;
  const d = g.drink('holy_water');
  ok('holy water heals four hearts', d.ok && g.health.value === 18);
  g.health.value = 20;
  ok('but not when you aren\'t hurt', !g.drink('holy_water').ok);
}

// --- in the game ---------------------------------------------------------------------------

ok('the White Ring makes you faster and jump higher', /white \? WHITE_RING_SPEED : 1/.test(game) && /this\.player\.jumpScale = white \? WHITE_RING_JUMP : 1/.test(game));
ok('the Black Ring sparks back at a bandit that hits you', /ringWorn\(\) === 'black'[\s\S]{0,120}this\.wanderers\.hit\(p, BLACK_RING_SPARK/.test(game));
ok('forging one is announced', /this\.bus\.on\('ring:forged'/.test(game));
ok('holy water is drunk with Break', /holy_water: 'drinkSelected'/.test(game));

process.exit(f ? 1 : 0);
