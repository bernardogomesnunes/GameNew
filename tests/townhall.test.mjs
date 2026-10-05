import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { STRUCTURES_BY_ID, CONTROLLER_PARTS } from '../src/config/structures.js';
import { RECIPES_BY_ID } from '../src/config/recipes.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { BLOCKS_BY_ID, STORAGE_CONTROLLER } from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK, itemName } from '../src/config/items.js';
import { PANELS } from '../src/config/panels.js';
import { swingLabel } from '../src/Game.js';

/**
 * The town hall and its storage controller. Asked for directly: "a block
 * that can control all storages ... which will list all the Items available
 * and allow search. It can be added to a town hall when you build it it
 * comes out of the box. Just by requiring the blocks that are needed to
 * craft it not the actual item as requirement." And then: "We need a town
 * hall building that should come with the village too."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the block, the item, the recipe ------------------------------------------

ok('the storage controller is a block', BLOCKS_BY_ID.get(STORAGE_CONTROLLER)?.name === 'Storage Controller');
ok('and an item that places it', ITEMS_BY_ID.get('storage_controller')?.block === STORAGE_CONTROLLER
  && ITEM_FOR_BLOCK.get(STORAGE_CONTROLLER) === 'storage_controller');
const recipe = RECIPES_BY_ID.get('storage_controller');
ok('made at the bench from its parts', recipe?.station === 'hand' && recipe.inputs === CONTROLLER_PARTS);
ok('Place on it says Open', swingLabel(STORAGE_CONTROLLER) === 'Open');
ok('it has a panel of its own', PANELS.some((p) => p.id === 'panel-stores'));

// --- the town hall --------------------------------------------------------------

const hall = STRUCTURES_BY_ID.get('townhall');
ok('there is a town hall', !!hall && hall.name === 'Town Hall');
ok('it costs the controller\'s parts, not the controller', hall.cost === CONTROLLER_PARTS && !hall.cost.storage_controller);
ok('and comes with one', hall.gives?.storage_controller === 1);
ok('the village comes with one too', STRUCTURES_BY_ID.get('village').gives?.storage_controller === 1);
ok('both open every store from their panel', hall.stores && STRUCTURES_BY_ID.get('village').stores);
const design = DESIGN_FOR_STRUCTURE.get('townhall');
ok('the hall\'s design never asks for a controller', !design.cost.storage_controller);
ok('and it has a tower: taller than its walls', design.extent.y >= 10);

// --- claiming one hands the controller over -----------------------------------

const { world, origin } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, seed: 7 });
const events = [];
const bus = { emit: (t, p) => events.push({ t, p }) };
const g = new DuiltGame({ world, scene: new THREE.Scene(), bus });

const ox = origin.minX + 4, oz = origin.minZ + 4;
const gy = 40;
for (let x = ox - 4; x < ox + 16; x++) for (let z = oz - 4; z < oz + 16; z++) {
  for (let y = gy - 1; y < gy + 20; y++) world.setBlock(x, y, z, y === gy - 1 ? 2 : 0);
}
for (const b of design.blocks) world.setBlock(ox + b.dx, gy + b.dy, oz + b.dz, b.type);
for (let y = gy; y < gy + 3; y++) world.setBlock(ox - 2, y, oz - 2, 7);   // a neighbour
const region = { minX: ox, maxX: ox + design.extent.x, minY: gy, maxY: gy + design.extent.y, minZ: oz, maxZ: oz + design.extent.z };
for (const [id, n] of Object.entries(CONTROLLER_PARTS)) g.inventory.add(id, n);
const res = g.claim(region, 'townhall');
ok('a stamped town hall claims', res.ok);
ok('its parts were paid', Object.keys(CONTROLLER_PARTS).every((id) => g.inventory.countOf(id) === 0));
ok('and the controller is in your bag', g.inventory.countOf('storage_controller') === 1);
ok('with a word about it', events.some((e) => e.t === 'structure:gift'));
ok('nothing is left owed', !res.structure.owed);

// --- a full bag: it waits, it's saved, it arrives -----------------------------

const g2 = new DuiltGame({ world, scene: new THREE.Scene(), bus });
const s = { id: 99, type: 'townhall', region, valid: true, owed: { storage_controller: 1 } };
g2.structures.structures.push(s);
for (let i = 0; i < g2.inventory.slots.length; i++) g2.inventory.slots[i] = { id: 'stone', count: 999, wear: 0 };
g2.payGifts();
ok('with no room anywhere it waits', !!s.owed && g2.inventory.countOf('storage_controller') === 0);
ok('and is saved while it waits', g2.structures.toJSON().structures.find((x) => x.id === 99)?.owed?.storage_controller === 1);
g2.inventory.slots[3] = null;
g2.payGifts();
ok('then arrives once there is room', !s.owed && g2.inventory.countOf('storage_controller') === 1);

// --- the controller: every storehouse as one list -----------------------------

const g3 = new DuiltGame({ world, scene: new THREE.Scene(), bus });
const shed = (id) => {
  const st = { id, type: 'storehouse', region, valid: true, tier: 0 };
  g3.structures.structures.push(st);
  return g3.structures.storeFor(st);
};
const a = shed(1), b = shed(2);
a.add('planks', 50); a.add('fruit', 3);
b.add('planks', 30); b.add('axe', 1, { wear: 7 });
const totals = g3.storeTotals();
const planks = totals.find((r) => r.id === 'planks');
ok('planks are counted across both sheds', planks?.count === 80 && planks.stores === 2);
ok('fruit is in one', totals.find((r) => r.id === 'fruit')?.stores === 1);
const names = totals.map((r) => itemName(r.id));
ok('the list is sorted by name', names.join() === names.slice().sort((x, y) => x.localeCompare(y)).join());

const before = g3.inventory.countOf('planks');
const took = g3.takeFromStores('planks');
ok('Take moves a stack into the bag', took === 80 && g3.inventory.countOf('planks') === before + 80);
ok('from wherever it was kept', a.countOf('planks') === 0 && b.countOf('planks') === 0);
ok('a tool comes out whole, wear and all', g3.takeFromStores('axe') === 1
  && g3.inventory.slots.some((x) => x?.id === 'axe' && x.wear === 7));
ok('nothing left is nothing taken', g3.takeFromStores('planks') === 0);

g3.inventory.add('cobblestone', 20);
const away = g3.storeAllAway();
ok('Put it all away fills the shelves', away.moved >= 20 && g3.inventory.countOf('cobblestone') === 0);
ok('but leaves your tools with you', g3.inventory.countOf('axe') === 1);

// --- wiring ---------------------------------------------------------------------

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('Place on a controller opens every store', /aimed\.block === STORAGE_CONTROLLER\) return void this\.ui\.openStores\(\)/.test(game));
ok('the building panel can too', /onOpenStores: \(\) => this\.ui\.openStores\(\)/.test(game));
ok('a gift is said out loud', /bus\.on\('structure:gift'/.test(game));

console.log(f ? `\n${f} failed` : '\nall passed');
process.exit(f ? 1 : 0);
