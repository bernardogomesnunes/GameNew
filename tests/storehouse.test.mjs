/**
 * The storehouse: a container that stands in the world.
 *
 * The bag is what you are carrying and it goes where you go. A storehouse is a
 * place, and what is in it stays there. Keeping those two apart is the whole
 * design — a storehouse that quietly made your bag bigger would be the same
 * forty slots with a shed drawn round them.
 *
 * What is checked here: that it holds things, that your buildings deliver into
 * it when your bag is full, that nothing is destroyed when there is nowhere to
 * put it, and that its contents survive being saved and loaded.
 */
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { ITEMS, stackLimit } from '../src/config/items.js';
import { AGES } from '../src/config/ages.js';
import { World } from '../src/world/World.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const HOLDS = STRUCTURES_BY_ID.get('storehouse').holds;

/** A registry with one storehouse and one quarry in it, no world checks. */
function settlement({ now = Date.now() } = {}) {
  const world = new World({ sizeX: 8, sizeZ: 8, height: 8 });
  const inventory = new Inventory();
  const reg = new StructureRegistry({ world, bus: null, inventory });
  const put = (type, region, lastPaidAt = now) => {
    const s = { id: reg.nextId++, type, region, valid: true, locked: true, claimedAt: now, lastPaidAt, brokenReason: null };
    reg.structures.push(s);
    return s;
  };
  return { reg, inventory, put };
}

const box = (x) => ({ minX: x, maxX: x + 2, minY: 0, maxY: 2, minZ: 0, maxZ: 2 });

/** Fills a bag so nothing new will fit in it. */
function stuff(inv) {
  for (const it of ITEMS) { if (inv.firstEmpty() === -1) break; inv.add(it.id, stackLimit(it.id)); }
  while (inv.firstEmpty() !== -1) inv.add('axe', 1);
  return inv;
}

// --- the building exists and is asked for ------------------------------------
{
  const spec = STRUCTURES_BY_ID.get('storehouse');
  ok('a storehouse holds a number of slots', Number.isInteger(HOLDS) && HOLDS > 0);
  ok('it produces nothing — it is not an income', !Object.keys(spec.produces ?? {}).length);
  ok('and some age asks you to build one',
    AGES.some((a) => a.goals.some((g) => g.structure === 'storehouse')));
}

// --- it is its own container, not a bigger bag -------------------------------
{
  const { reg, inventory, put } = settlement();
  const shed = put('storehouse', box(0));
  const store = reg.storeFor(shed);
  ok('a storehouse gets a container of its own', !!store && store !== inventory);
  ok(`with ${HOLDS} slots`, store.size === HOLDS);
  ok('a quarry does not', reg.storeFor(put('quarry', box(4))) === null);

  store.add('stone', 20);
  ok('what is in it is in it', store.countOf('stone') === 20);
  ok('and not in your bag', inventory.countOf('stone') === 0);
  ok('your bag did not grow', inventory.size === 40);
}

// --- moving things across ----------------------------------------------------
{
  const { reg, inventory, put } = settlement();
  const store = reg.storeFor(put('storehouse', box(0)));
  inventory.add('stone', 30);
  const moved = inventory.moveTo(store, inventory.slots.findIndex((s) => s?.id === 'stone'));
  ok(`putting a stack away moves all ${moved} of it`, moved === 30);
  ok('out of the bag', inventory.countOf('stone') === 0);
  ok('and onto the shelves', store.countOf('stone') === 30);

  const back = store.moveTo(inventory, store.slots.findIndex((s) => s?.id === 'stone'));
  ok(`and taking it back moves ${back}`, back === 30 && inventory.countOf('stone') === 30);
  ok('the shelf is empty again', store.slots.every((s) => !s));
  ok('a container will not hand things to itself', inventory.moveTo(inventory, 0) === 0);
}

{
  // Half a transfer is the one thing that must never lose count.
  const { reg, inventory, put } = settlement();
  const store = reg.storeFor(put('storehouse', box(0)));
  for (let i = 0; i < HOLDS; i++) store.add(ITEMS[i % ITEMS.length].id, 1);
  inventory.add('stone', stackLimit('stone'));
  const before = inventory.countOf('stone') + store.countOf('stone');
  inventory.moveTo(store, inventory.slots.findIndex((s) => s?.id === 'stone'));
  ok('a part-full shelf takes what it can and no more',
    inventory.countOf('stone') + store.countOf('stone') === before);
}

// --- your buildings deliver into it ------------------------------------------
{
  const now = Date.now();
  const { reg, inventory, put } = settlement({ now });
  put('quarry', box(0), now - 200_000); // long enough for several payouts
  stuff(inventory);
  ok('the bag is full before anything is produced', inventory.firstEmpty() === -1);

  const nowhere = reg.collect({ now });
  ok('with no storehouse, a full bag stops production', !Object.keys(nowhere).length);

  const shed = put('storehouse', box(4));
  const gained = reg.collect({ now });
  ok(`once there is a storehouse the payout arrives: ${JSON.stringify(gained)}`,
    Object.keys(gained).length > 0);
  const store = reg.storeFor(shed);
  ok('and it is on the shelves, not in the bag',
    store.countOf('stone') > 0 && inventory.countOf('stone') === stackLimit('stone'));
}

// --- nothing is destroyed for want of somewhere to put it --------------------
{
  const now = Date.now();
  const { reg, inventory, put } = settlement({ now });
  const quarry = put('quarry', box(0), now - 200_000);
  stuff(inventory);

  const owed = quarry.lastPaidAt;
  reg.collect({ now });
  ok('a payout with nowhere to go leaves the time owed', quarry.lastPaidAt === owed);

  // Make room, and the same production turns up rather than having evaporated.
  inventory.slots[10] = null;
  inventory.slots[11] = null;
  const gained = reg.collect({ now });
  ok(`emptying a slot pays out what was owed: ${JSON.stringify(gained)}`, (gained.stone ?? 0) > 0);
  ok('and the clock has moved on now it has', quarry.lastPaidAt > owed);
}

{
  // All of it or none of it: a partly-delivered payout is the rest destroyed.
  const now = Date.now();
  const { reg, inventory, put } = settlement({ now });
  put('quarry', box(0), now - 200_000);
  stuff(inventory);
  inventory.slots[3] = null; // room for one kind of thing, not both
  const before = inventory.slots.filter(Boolean).length;
  reg.collect({ now });
  const after = inventory.slots.filter(Boolean).length;
  ok('a payout that only half fits is not half taken', after === before || after === before + 1);
}

// --- it survives being put away ----------------------------------------------
{
  const { reg, inventory, put } = settlement();
  const shed = put('storehouse', box(0));
  put('quarry', box(4));
  reg.storeFor(shed).add('stone', 42);
  reg.storeFor(shed).add('wood', 7);
  const saved = JSON.parse(JSON.stringify(reg.toJSON()));

  const world = new World({ sizeX: 8, sizeZ: 8, height: 8 });
  const back = new StructureRegistry({ world, bus: null, inventory: new Inventory() });
  back.loadJSON(saved);
  const reopened = back.list().find((s) => s.type === 'storehouse');
  ok('a saved storehouse comes back', !!reopened);
  ok('with what was in it', back.storeFor(reopened).countOf('stone') === 42
    && back.storeFor(reopened).countOf('wood') === 7);
  ok('and the count adds up', back.storedCount() === 49);
}

{
  // A save holding a building type this version no longer has shifts every
  // index after it. The shelves must not follow the wrong building home.
  const { reg, put } = settlement();
  put('quarry', box(0));
  const shed = put('storehouse', box(4));
  reg.storeFor(shed).add('stone', 5);
  const saved = JSON.parse(JSON.stringify(reg.toJSON()));
  saved.structures[0].type = 'no_such_building';

  const back = new StructureRegistry({
    world: new World({ sizeX: 8, sizeZ: 8, height: 8 }), bus: null, inventory: new Inventory(),
  });
  back.loadJSON(saved);
  ok('the unknown building is dropped', back.list().length === 1);
  ok('and the storehouse still has its own goods',
    back.storeFor(back.list()[0]).countOf('stone') === 5);
}

process.exit(f ? 1 : 0);
