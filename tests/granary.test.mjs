/**
 * The granary as the food store (asked for directly: "Granary should not
 * produce vegetables it should store them efficiently and free the storage
 * rooms. This means a slot per item, that grows. It should be the place that
 * villagers go for food, too before they should go to the storehouse", then
 * "Granary all the items produced in a farm, and I can take them and add more
 * if needed. It should not have a hard limit as these produce a lot").
 */
import { Inventory } from '../src/items/Inventory.js';
import { Granary } from '../src/items/Granary.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { STRUCTURES_BY_ID, isStore } from '../src/config/structures.js';
import { stackLimit } from '../src/config/items.js';
import { CROPS, FARM_ITEMS } from '../src/config/crops.js';
import { Settlers } from '../src/duilt/Settlers.js';
import { World } from '../src/world/World.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const SPEC = STRUCTURES_BY_ID.get('granary');

// --- the building ----------------------------------------------------------------
ok('the granary produces nothing now: it keeps', !Object.keys(SPEC.produces ?? {}).length && !SPEC.everySeconds);
ok('it is a store', isStore(SPEC));
ok('it keeps every crop and its seeds', CROPS.every((c) => FARM_ITEMS.has(c.produce) && FARM_ITEMS.has(`seeds_${c.kind}`)));

// --- its store: a slot a kind, no limit --------------------------------------------
{
  const g = new Granary({ accepts: (id) => FARM_ITEMS.has(id) });
  const lots = stackLimit('vegetables') * 20;
  ok(`far past a stack's limit, in one slot (${lots} vegetables)`, g.add('vegetables', lots) === 0 && g.slots.length === 1 && g.countOf('vegetables') === lots);
  g.add('seeds_potato', 30);
  g.add('vegetables', 5);
  ok('a new kind gets a new slot; more of a kind joins its slot', g.slots.length === 2 && g.countOf('vegetables') === lots + 5);
  ok('what farms don\'t grow is handed back, untouched', g.add('stone', 9) === 9 && g.countOf('stone') === 0 && g.roomFor('stone', 9) === 0);
  ok('and it always has room for what they do', g.roomFor('potato', 1e6) === 1e6);
  g.remove('seeds_potato', 30);
  ok('the last of a kind gone, its slot goes too', g.slots.length === 1 && g.slots.every(Boolean));

  // Taking out into the bag: as much as fits, the rest stays.
  const bag = new Inventory({ slots: 3 });
  const moved = g.moveTo(bag, 0);
  ok(`taking out fills the bag and leaves the rest (${moved} taken)`, moved === 3 * stackLimit('vegetables') && g.countOf('vegetables') === lots + 5 - moved);
  // And putting back.
  const back = bag.moveTo(g, 0);
  ok('putting some back in joins the same slot', back > 0 && g.slots.length === 1 && g.countOf('vegetables') === lots + 5 - moved + back);
  ok('no halving a stack into a second slot', g.split(0) === false && g.slots.length === 1);

  // Saved and loaded.
  const again = new Granary({ accepts: (id) => FARM_ITEMS.has(id) });
  again.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('saved and loaded, all of it comes back', again.countOf('vegetables') === g.countOf('vegetables') && again.slots.length === 1);
}

// --- in a settlement -----------------------------------------------------------------
const box = (x) => ({ minX: x, maxX: x + 2, minY: 0, maxY: 2, minZ: 0, maxZ: 2 });
function settlement() {
  const world = new World({ sizeX: 16, sizeZ: 8, height: 8 });
  const inventory = new Inventory();
  const reg = new StructureRegistry({ world, bus: null, inventory });
  const put = (type, region) => {
    const s = { id: reg.nextId++, type, region, valid: true, locked: true, claimedAt: Date.now(), lastPaidAt: Date.now(), brokenReason: null };
    reg.structures.push(s);
    return s;
  };
  return { reg, inventory, put };
}
{
  const { reg, inventory, put } = settlement();
  const shed = put('storehouse', box(0));
  reg.storeFor(shed).add('potato', 40);
  reg.storeFor(shed).add('stone', 40);
  const granary = put('granary', box(4));
  ok('the granary is the first store asked', reg.stores()[0].structure === granary);
  const moved = reg.gatherIntoGranaries();
  ok(`what farms grew moves out of the storehouse into it (${moved})`, reg.storeFor(granary).countOf('potato') === 40 && reg.storeFor(shed).countOf('potato') === 0);
  ok('the rest stays on the storehouse\'s shelves', reg.storeFor(shed).countOf('stone') === 40);

  ok('a delivery: the farm\'s produce to the granary, the rest to the storehouse',
    reg.deliver({ vegetables: 500, seeds_carrot: 3, wood: 6 })
    && reg.storeFor(granary).countOf('vegetables') === 500 && reg.storeFor(granary).countOf('seeds_carrot') === 3
    && reg.storeFor(shed).countOf('wood') === 6 && reg.storeFor(shed).countOf('vegetables') === 0 && inventory.countOf('vegetables') === 0);

  // Villagers eat from the granary first.
  const settlers = new Settlers({ world: reg.world, structures: reg, inventory, stores: () => reg.stores().map((x) => x.store) });
  reg.storeFor(shed).add('fruit', 5);
  const meal = settlers.nextMeal();
  ok('a villager\'s meal comes from the granary before the storehouse', meal?.from === reg.storeFor(granary));

  // Saved and loaded with the rest.
  const saved = JSON.parse(JSON.stringify(reg.toJSON()));
  const back = new StructureRegistry({ world: new World({ sizeX: 16, sizeZ: 8, height: 8 }), bus: null, inventory: new Inventory() });
  back.loadJSON(saved);
  const g2 = back.list().find((s) => s.type === 'granary');
  ok('a saved granary comes back with everything in it', back.storeFor(g2) instanceof Granary && back.storeFor(g2).countOf('vegetables') === 500 && back.storeFor(g2).countOf('potato') === 40);
}

// --- a hungry villager: named, with a button to feed them -----------------------------
{
  const { hungryTitle } = await import('../src/ui/DuiltUI.js');
  ok('one: "Ana is hungry"', hungryTitle(['Ana']) === 'Ana is hungry');
  ok('two: "Ana and Bo are hungry"', hungryTitle(['Ana', 'Bo']) === 'Ana and Bo are hungry');
  ok('more: "Ana, Bo and 2 others are hungry"', hungryTitle(['Ana', 'Bo', 'Cy', 'Di']) === 'Ana, Bo and 2 others are hungry');
  ok('soldiers too, unnamed: "Ana and 1 other are hungry"', hungryTitle(['Ana'], 2) === 'Ana and 1 other are hungry');

  const { reg, inventory, put } = settlement();
  const granary = put('granary', box(4));
  const heard = [];
  const bus = { emit: (e, p) => heard.push([e, p]), on() {} };
  const settlers = new Settlers({ world: reg.world, structures: reg, inventory, bus, stores: () => reg.stores().map((x) => x.store) });
  settlers.people.push({ id: 1, name: 'Test villager 1', hungry: false, x: 0, z: 0, y: 0 }, { id: 2, name: 'Test villager 2', hungry: false, x: 0, z: 0, y: 0 });
  settlers.eat();
  const hungry = heard.find(([e]) => e === 'settler:hungry')?.[1];
  ok('nothing to eat: the notice names who', hungry?.count === 2 && hungry.names.join() === 'Test villager 1,Test villager 2');
  reg.storeFor(granary).add('vegetables', 1);
  inventory.add('vegetables', 1);
  ok('Give food feeds them from the granary, then your bag', settlers.feedHungry() === 0 && reg.storeFor(granary).countOf('vegetables') === 0 && inventory.countOf('vegetables') === 0);
  ok('and says they\'re fed', heard.some(([e]) => e === 'settler:fed'));
  settlers.eat();
  ok('with nothing anywhere, it says how many are still hungry', settlers.feedHungry() === 2);
}

process.exit(f ? 1 : 0);
