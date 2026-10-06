import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { Settlers } from '../src/duilt/Settlers.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { SETTLERS } from '../src/config/settlers.js';
import { GAME_DAY_SECONDS } from '../src/render/DayCycle.js';

/**
 * Backlog batch 3, #10: "Villagers eat. Settlers take a little food from
 * your storehouses each day. Fed: they work better. Hungry: a gentle
 * warning, nothing harsh."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

/** Three houses (two households), a quarry to work, a storehouse's shelves, and a bag. */
function setup() {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) {
    world.setBlock(x, 10, z, 1);
    world.surfaceHeightMap[x * 64 + z] = 11;
  }
  const inventory = new Inventory();
  const shelves = new Inventory({ slots: 40 });
  const structures = new StructureRegistry({ world, bus: null, inventory });
  let id = 1;
  const add = (type, region) => {
    const s = { id: id++, type, region, valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, brokenReason: null };
    structures.structures.push(s);
    return s;
  };
  for (let i = 0; i < 3; i++) add('house', { minX: 10 + i * 8, maxX: 14 + i * 8, minY: 11, maxY: 14, minZ: 10, maxZ: 14 });
  const quarry = add('quarry', { minX: 20, maxX: 25, minY: 11, maxY: 13, minZ: 20, maxZ: 25 });
  let r = 0;
  const rand = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
  const settlers = new Settlers({ world, structures, inventory, skills: { settlerAllowance: () => 0 }, bus: null, rand, stores: () => [shelves] });
  for (let i = 0; i < 4; i++) settlers.tick(SETTLERS.arriveEverySeconds + 1);
  return { settlers, inventory, shelves, quarry };
}
const meal = (settlers) => { settlers.sinceMeal = 0; settlers.tick(SETTLERS.eatEverySeconds + 1); };

ok(`they eat once a game day (${SETTLERS.eatEverySeconds} s)`, SETTLERS.eatEverySeconds === GAME_DAY_SECONDS);

{
  const { settlers, inventory, shelves } = setup();
  shelves.add('vegetables', 10);
  inventory.add('vegetables', 10);
  meal(settlers);
  ok(`from the storehouse, a little each (${10 - shelves.countOf('vegetables')} for ${settlers.population})`,
    shelves.countOf('vegetables') === 10 - settlers.population && settlers.hungry === 0);
  ok('and the bag is left alone', inventory.countOf('vegetables') === 10);
}

{
  const { settlers, inventory, shelves } = setup();
  shelves.add('fruit', 1);
  inventory.add('vegetables', 5);
  meal(settlers);
  ok('when the storehouse runs out, the bag makes up the rest', shelves.countOf('fruit') === 0 && inventory.countOf('vegetables') === 4 && settlers.hungry === 0);
}

{
  const { settlers, shelves, quarry } = setup();
  shelves.add('vegetables', 10);
  meal(settlers);
  ok('fed, they work better', settlers.bonusFor(quarry.id) > 1);
  shelves.remove('vegetables', shelves.countOf('vegetables'));
  meal(settlers);
  ok('hungry, they don\'t — but nobody leaves', settlers.bonusFor(quarry.id) === 1 && settlers.population === 2 && settlers.hungry === 2);
  // Food put away is eaten within the minute, not at tomorrow's meal.
  shelves.add('fruit', 5);
  settlers.tick(SETTLERS.retryHungrySeconds + 1);
  ok(`food put away is eaten within ${SETTLERS.retryHungrySeconds} s`, settlers.hungry === 0 && shelves.countOf('fruit') === 3 && settlers.bonusFor(quarry.id) > 1);
  settlers.tick(SETTLERS.retryHungrySeconds + 1);
  ok('and nobody already fed eats twice', shelves.countOf('fruit') === 3);
}

ok('the warning is gentle: what to do, not doom', /are hungry/.test(ui) && /Put some food in a storehouse — fed, they work better/.test(ui) && !/stop working until/.test(ui));

{
  // In the game itself, the settlers are given the storehouses to eat from.
  const world = new World({ sizeX: 32, sizeZ: 32, height: 16 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  ok('the settlement eats from its storehouses', typeof g.settlers.stores === 'function' && Array.isArray(g.settlers.stores()));
}

process.exit(f ? 1 : 0);
