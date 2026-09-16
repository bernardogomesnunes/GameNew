/**
 * A full bag, and the recipe that pretended it wasn't.
 *
 * Reported as: "I had dirt in my bag. I clicked on the ENABLED button, I saw
 * the banner on the background, no turned soil on my inventory." Every word of
 * that is what the game did. With no free slot the bench still listed Turn
 * soil as makeable, because it only ever asked whether you could *pay* for it.
 * Pressing Make then paid, found nowhere to put the soil, handed the dirt back
 * and left a message — and the message rendered underneath the open panel, so
 * all you saw was a banner sliding about behind the thing you were reading.
 */
import { Inventory } from '../src/items/Inventory.js';
import { Crafting } from '../src/duilt/Crafting.js';
import { ITEMS, stackLimit } from '../src/config/items.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const fullBag = () => {
  const inv = new Inventory();
  const ids = ITEMS.map((i) => i.id).filter((id) => id !== 'farmland');
  inv.add('dirt', 30);
  for (let i = 0; i < ids.length && inv.firstEmpty() !== -1; i++) inv.add(ids[i], stackLimit(ids[i]));
  // Tools never merge, so one apiece fills whatever the item list left over.
  while (inv.firstEmpty() !== -1) inv.add('axe', 1);
  return inv;
};

// --- how much fits ------------------------------------------------------------
{
  const inv = new Inventory();
  ok('an empty bag has room', inv.roomFor('dirt', 10) === 10);
  inv.add('dirt', stackLimit('dirt') - 3);
  ok('a part-used stack counts its own headroom', inv.roomFor('dirt', 3) === 3);
  const full = fullBag();
  ok('a bag with no free slot has room for nothing new', full.roomFor('farmland', 1) === 0);
  ok('but still has room for more of what it already holds',
    full.roomFor('dirt', 1) === 1 || full.countOf('dirt') >= stackLimit('dirt'));
  ok('room is never claimed for an item that does not exist', full.roomFor('nonsense', 1) === 0);
}

// --- what the bench says ------------------------------------------------------
{
  const inv = fullBag();
  const crafting = new Crafting({ inventory: inv, world: null, skills: null });
  const row = crafting.available(2, { station: null, atStations: [] }).find((r) => r.id === 'farmland');
  ok('there is still dirt to make soil from', inv.countOf('dirt') > 0);
  ok('the bench does not offer a recipe whose result has nowhere to go', row && !row.ok);
  ok(`and says why: ${row?.reason}`, /bag is full/i.test(row?.reason ?? ''));
  ok('so it offers no batch either', row?.maxBatch === 0);
}

// --- what pressing Make does --------------------------------------------------
{
  const inv = fullBag();
  const crafting = new Crafting({ inventory: inv, world: null, skills: null });
  const dirtBefore = inv.countOf('dirt');
  const r = crafting.craft('farmland', 1);
  ok('pressing it anyway refuses', !r.ok && /bag is full/i.test(r.reason));
  ok('and the dirt is untouched, not spent and refunded', inv.countOf('dirt') === dirtBefore);
}

// --- a batch bigger than the room it has --------------------------------------
{
  const inv = new Inventory();
  const ids = ITEMS.map((i) => i.id).filter((id) => id !== 'farmland' && id !== 'dirt');
  inv.add('dirt', 30);
  for (let i = 0; i < ids.length && inv.slots.filter(Boolean).length < inv.size - 1; i++) {
    inv.add(ids[i], stackLimit(ids[i]));
  }
  // One slot left, and turned soil stacks, so a batch of four fits in it.
  const crafting = new Crafting({ inventory: inv, world: null, skills: null });
  const r = crafting.craft('farmland', 4);
  ok(`one free slot takes the whole batch of ${r.made}`, r.ok && r.made === 4);
  ok('and it is in the bag', inv.countOf('farmland') === 4);
}

// --- and none of this broke the ordinary case ---------------------------------
{
  const inv = new Inventory();
  inv.add('dirt', 10);
  const crafting = new Crafting({ inventory: inv, world: null, skills: null });
  const row = crafting.available(1, { station: null, atStations: [] }).find((r) => r.id === 'farmland');
  ok('a bag with space offers Turn soil', row?.ok && row.maxBatch === 4);
  const r = crafting.craft('farmland', 4);
  ok('and makes four', r.ok && r.made === 4 && inv.countOf('farmland') === 4);
  ok('paid for out of the dirt', inv.countOf('dirt') === 6);
}

process.exit(f ? 1 : 0);
