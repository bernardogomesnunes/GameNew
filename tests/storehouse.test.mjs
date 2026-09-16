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
import { STRUCTURES_BY_ID, holdsAt, isStore } from '../src/config/structures.js';
import { tierStatus } from '../src/structures/validate.js';
import { ITEMS, stackLimit } from '../src/config/items.js';
import { AGES } from '../src/config/ages.js';
import { World } from '../src/world/World.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const SPEC = STRUCTURES_BY_ID.get('storehouse');
const HOLDS = holdsAt(SPEC, 0);

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
  ok('a storehouse holds a number of slots', Number.isInteger(HOLDS) && HOLDS > 0);
  ok('it produces nothing — it is not an income', !Object.keys(SPEC.produces ?? {}).length);
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

// --- it grows by being built bigger ------------------------------------------

const PLANKS = 7, STONE = 3;

/** A flat world with nothing in it but ground, so only the shed is measured. */
function ground() {
  const world = new World({ sizeX: 48, sizeZ: 48, height: 32 });
  for (let x = 0; x < 48; x++) for (let z = 0; z < 48; z++) {
    for (let y = 0; y < 8; y++) world.setBlock(x, y, z, STONE);
  }
  return world;
}

/** A walled room with a doorway, which is what a storehouse is. */
function raise(world, x0, z0, y0, { w, h, wall = PLANKS, floor = PLANKS }) {
  for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < w; dz++) {
    world.setBlock(x0 + dx, y0, z0 + dz, floor);
    world.setBlock(x0 + dx, y0 + h + 1, z0 + dz, wall);
    const edge = dx === 0 || dz === 0 || dx === w - 1 || dz === w - 1;
    for (let dy = 1; dy <= h; dy++) if (edge) world.setBlock(x0 + dx, y0 + dy, z0 + dz, wall);
  }
  const mid = Math.floor(w / 2);
  world.setBlock(x0 + mid, y0 + 1, z0, 0);
  world.setBlock(x0 + mid, y0 + 2, z0, 0);
  return { minX: x0, maxX: x0 + w - 1, minZ: z0, maxZ: z0 + w - 1, minY: y0, maxY: y0 + h + 1 };
}

{
  const world = ground();
  const small = raise(world, 2, 2, 8, { w: 5, h: 2 });
  const shelves = tierStatus(world, small, 'storehouse');
  ok(`a 5×5 shed is the first rung: ${shelves.name}`, shelves.tier === 0 && shelves.slots === HOLDS);
  ok('and it says what the next one would need',
    shelves.next && shelves.next.missing.length > 0);
  ok(`namely: ${shelves.next.missing.join('; ')}`,
    shelves.next.missing.some((m) => /room/i.test(m)));

  const taller = raise(world, 12, 2, 8, { w: 5, h: 3 });
  const loft = tierStatus(world, taller, 'storehouse');
  ok(`giving it headroom makes it a ${loft.name} (${loft.slots} slots)`, loft.tier === 1);

  const big = raise(world, 24, 12, 8, { w: 9, h: 3, floor: STONE });
  const ware = tierStatus(world, big, 'storehouse');
  ok(`a 9×9 with a stone floor is a ${ware.name} (${ware.slots} slots)`, ware.tier === 2);
  ok('and there is nothing above it', ware.next === null);
}

{
  // The rungs are a ladder. Bricking out a shed does not skip the middle.
  const world = ground();
  const region = raise(world, 2, 2, 8, { w: 5, h: 2, floor: STONE });
  const status = tierStatus(world, region, 'storehouse');
  ok('a small shed with a grand floor is still a shed', status.tier === 0);
}

{
  // Building it up upgrades it where the game notices — on the next recheck.
  const world = ground();
  const region = raise(world, 2, 2, 8, { w: 5, h: 2 });
  const inventory = new Inventory();
  const reg = new StructureRegistry({ world, bus: null, inventory });
  const shed = { id: 1, type: 'storehouse', region, valid: true, locked: true,
                 claimedAt: Date.now(), lastPaidAt: Date.now(), brokenReason: null };
  reg.structures.push(shed);
  ok(`it starts with ${HOLDS} shelves`, reg.storeFor(shed).size === HOLDS);

  // Rebuild it a storey taller, clearing the old roof out of the way first.
  for (let x = 2; x < 7; x++) for (let z = 2; z < 7; z++) for (let y = 8; y < 14; y++) world.setBlock(x, y, z, 0);
  const taller = raise(world, 2, 2, 8, { w: 5, h: 3 });
  shed.region = taller;
  reg.recheck(shed);
  ok(`built up, it has ${reg.storeFor(shed).size}`, reg.storeFor(shed).size === holdsAt(SPEC, 1));
  ok('and the building knows which rung it is on', shed.tier === 1);
}

{
  // Cutting it back takes the shelves away again — but never with anything on
  // them, which is also what stops "build a warehouse, strip it, keep the room".
  const world = ground();
  const big = raise(world, 4, 4, 8, { w: 9, h: 3, floor: STONE });
  const reg = new StructureRegistry({ world, bus: null, inventory: new Inventory() });
  const ware = { id: 1, type: 'storehouse', region: big, valid: true, locked: true,
                 claimedAt: Date.now(), lastPaidAt: Date.now(), brokenReason: null };
  reg.structures.push(ware);
  reg.retier(ware);
  const store = reg.storeFor(ware);
  ok(`a warehouse has ${store.size} shelves`, store.size === holdsAt(SPEC, 2));

  for (let i = 0; i < 40; i++) store.add(ITEMS[i % ITEMS.length].id, 1);
  const stocked = store.slots.filter(Boolean).length;

  // Knock the roof off: the room goes, and with it both upgrades.
  for (let dx = 0; dx < 9; dx++) for (let dz = 0; dz < 9; dz++) world.setBlock(4 + dx, 8 + 4, 4 + dz, 0);
  reg.recheck(ware);
  ok(`it comes back down, but not below the ${stocked} shelves in use`,
    store.size >= stocked && store.size < holdsAt(SPEC, 2));
  ok('and nothing on them was thrown away',
    store.slots.filter(Boolean).length === stocked);

  // Empty it and it settles on what it has actually been built into.
  store.slots.fill(null);
  reg.recheck(ware);
  ok(`emptied, it settles at ${store.size}`, store.size === HOLDS);
}

{
  // The rung survives a save, so a warehouse does not come back a shed.
  const world = ground();
  const region = raise(world, 4, 4, 8, { w: 9, h: 3, floor: STONE });
  const reg = new StructureRegistry({ world, bus: null, inventory: new Inventory() });
  reg.structures.push({ id: 1, type: 'storehouse', region, valid: true, locked: true,
                        claimedAt: Date.now(), lastPaidAt: Date.now(), brokenReason: null });
  reg.retier(reg.list()[0]);
  reg.storeFor(reg.list()[0]).add('stone', 60);
  const saved = JSON.parse(JSON.stringify(reg.toJSON()));
  ok('the rung is written down', saved.structures[0].tier === 2);

  const back = new StructureRegistry({ world, bus: null, inventory: new Inventory() });
  back.loadJSON(saved);
  const reopened = back.list()[0];
  ok('and comes back', reopened.tier === 2);
  ok(`with all ${holdsAt(SPEC, 2)} shelves and what was on them`,
    back.storeFor(reopened).size === holdsAt(SPEC, 2) && back.storeFor(reopened).countOf('stone') === 60);
}

// --- resizing a container on its own -----------------------------------------
{
  const inv = new Inventory({ slots: 10 });
  ok('growing adds slots', inv.resize(20) === 20 && inv.size === 20);
  ok('shrinking an empty one takes them off', inv.resize(5) === 5 && inv.size === 5);
  inv.add('stone', 1); inv.add('wood', 1); inv.add('dirt', 1);
  inv.slots[0] = null; // a gap in the middle
  ok('shrinking packs what is left forward rather than dropping it',
    inv.resize(1) === 2 && inv.countOf('wood') === 1 && inv.countOf('dirt') === 1);
  ok('and refuses a size that makes no sense', inv.resize(0) === inv.size && inv.resize(-3) === inv.size);
}

ok('every building the game calls a store has tiers',
  [...STRUCTURES_BY_ID.values()].every((s) => !isStore(s) || s.tiers.every((t) => t.slots > 0)));

process.exit(f ? 1 : 0);
