import * as THREE from 'three';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Inventory } from '../src/items/Inventory.js';
import { PURSE, sellPrice } from '../src/config/traders.js';
import { stackLimit } from '../src/config/items.js';
import { World } from '../src/world/World.js';

/** PLAY-22 chunk B: selling by hand (docs/design/play-22-23.md). */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

/** A real game on a tiny world, with a bag of `slots` and a bus that records what it is told. */
function make({ slots = 40, sandbox = false, endless = false } = {}) {
  const events = [];
  const bus = { emit: (name, e) => events.push({ name, e }), on() {}, off() {} };
  const d = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus, sandbox });
  d.inventory = new Inventory({ slots, endless, bus });
  d.structures.inventory = d.inventory;
  d.days = 0.5;
  const shed = () => {
    const s = { id: d.structures.nextId++, type: 'storehouse', region: { minX: 0, maxX: 2, minY: 0, maxY: 2, minZ: 0, maxZ: 2 }, valid: true, locked: true, claimedAt: 0, lastPaidAt: Date.now(), brokenReason: null };
    d.structures.structures.push(s);
    d.structures.storeFor(s);
    return s;
  };
  return { d, events, shed };
}
/** Fills every free slot of an inventory with one axe each (tools never stack). */
const fillWithAxes = (inv) => { while (inv.firstEmpty() !== -1) inv.add('axe', 1); };

const STONE = sellPrice('stone'); // 32 for 3

// 1. One lot.
{
  const { d } = make();
  d.inventory.add('stone', STONE.lot * 2);
  const r = d.sellTo('stonemonger', 'stone', 1);
  ok(`1 lot of stone sold: ${STONE.lot} left, ${STONE.coins} coins in, purse ${PURSE - STONE.coins}`,
    r.ok && d.inventory.countOf('stone') === STONE.lot && d.inventory.countOf('coin') === STONE.coins && d.purseLeft('stonemonger') === PURSE - STONE.coins && r.coins === STONE.coins && r.n === STONE.lot);
}
// 2. Too few.
{
  const { d } = make();
  d.inventory.add('stone', STONE.lot - 7);
  const r = d.sellTo('stonemonger', 'stone', 1);
  ok('too few: "Needs 7 more stone for a lot.", nothing changes', !r.ok && r.reason === 'Needs 7 more stone for a lot.' && d.inventory.countOf('stone') === STONE.lot - 7 && d.inventory.countOf('coin') === 0 && d.purseLeft('stonemonger') === PURSE);
}
// 3. Not bought.
{
  const { d } = make();
  d.inventory.add('iron_ore', 8);
  const r = d.sellTo('stonemonger', 'iron_ore', 1);
  ok('an item the trader does not buy is refused', !r.ok && d.inventory.countOf('iron_ore') === 8 && d.inventory.countOf('coin') === 0);
  d.inventory.add('coin', 5);
  ok('coins are never bought', !d.sellTo('stonemonger', 'coin', 1).ok && d.inventory.countOf('coin') === 5);
}
// 4. Purse, and the next day.
{
  const { d } = make();
  d.inventory.add('stone', STONE.lot * 40);
  d.purses.spent.stonemonger = PURSE;
  const r = d.sellTo('stonemonger', 'stone', 1);
  ok('purse at 0: refused, "Back tomorrow."', !r.ok && /Back tomorrow/.test(r.reason) && d.inventory.countOf('coin') === 0);
  d.days = 1.0;
  ok('the next whole game day refills it to 20', d.purseLeft('stonemonger') === PURSE && d.sellTo('stonemonger', 'stone', 1).ok);
  ok('another trader keeps their own purse', d.purseLeft('smith') === PURSE);
}
// 5. Asking for more than the purse.
{
  const { d } = make({ slots: 80 });
  const lots = 30, per = STONE.coins;
  d.inventory.add('stone', STONE.lot * lots);
  const r = d.sellTo('stonemonger', 'stone', lots);
  const fits = Math.floor(PURSE / per);
  ok(`30 lots asked, purse 20, ${per} a lot: ${fits} lots sold and it says the purse ran out`, r.ok && r.lots === fits && r.coins === fits * per && /ran out/.test(r.reason) && d.purseLeft('stonemonger') === PURSE - fits * per);
  const { d: e } = make({ slots: 80 });
  e.inventory.add('brick', 16 * 30);
  const b = e.sellTo('glazier', 'brick', 30);
  ok('at 1 coin a lot, 20 of 30 lots go and the purse is empty', b.ok && b.lots === 20 && e.purseLeft('glazier') === 0 && /ran out/.test(b.reason));
}
// 6. Sandbox and endless bags.
{
  const { d } = make({ sandbox: true, endless: true });
  d.inventory.add('stone', 64);
  const r = d.sellTo('stonemonger', 'stone', 1);
  ok('sandbox, endless bag: refused, no coins', !r.ok && d.inventory.countOf('coin') === 0 && d.purseLeft('stonemonger') === PURSE);
  const { d: e } = make({ endless: true });
  e.inventory.add('stone', 64);
  ok('an endless bag alone cannot sell either', !e.sellTo('stonemonger', 'stone', 1).ok && e.inventory.countOf('coin') === 0);
}
// 7. Wear.
{
  const { d } = make();
  d.inventory.add('armour_iron_body', 1, { wear: 100 }); // of 200
  const r = d.sellTo('smith', 'armour_iron_body', 1);
  ok('an Iron Cuirass at half wear pays 3', r.ok && r.coins === 3 && d.inventory.countOf('armour_iron_body') === 0 && d.inventory.countOf('coin') === 3);
  const { d: e } = make();
  e.inventory.add('armour_iron_body', 1, { wear: 180 });
  const w = e.sellTo('smith', 'armour_iron_body', 1);
  ok('at 90% wear it pays 0 and is not sold', !w.ok && e.inventory.countOf('armour_iron_body') === 1 && e.inventory.countOf('coin') === 0);
  const { d: g } = make();
  g.inventory.add('sword_iron', 1, { wear: 150 }); g.inventory.add('sword_iron', 1, { wear: 0 });
  const s = g.sellTo('smith', 'sword_iron', 1);
  ok('two swords: the least worn goes first, for the full 4', s.ok && s.coins === 4 && g.inventory.slots.find((x) => x?.id === 'sword_iron').wear === 150);
}
// 8. Where the coins go.
{
  // A full bag: the sold goods free the slot the coins use.
  const { d } = make({ slots: 3 });
  d.inventory.add('stone', 32); d.inventory.add('axe', 1); d.inventory.add('pickaxe', 1);
  const r = d.sellTo('stonemonger', 'stone', 1);
  ok('a full bag: the sold goods free the slot the coins use', r.ok && d.inventory.countOf('coin') === STONE.coins);

  // The lot is part bag, part storehouse.
  const { d: e, shed } = make({ slots: 6 });
  const s = shed();
  e.inventory.add('stone', 16);
  s.store.add('stone', 16);
  const q = e.sellTo('stonemonger', 'stone', 1);
  ok('a lot drawn from the bag and the storehouse together', q.ok && e.inventory.countOf('stone') === 0 && s.store.countOf('stone') === 0 && e.inventory.countOf('coin') === STONE.coins);

  // Bag full of tools, goods in a shed: the coins go to the shed.
  const { d: h, shed: shed2 } = make({ slots: 4 });
  const t = shed2();
  t.store.add('stone', 32);
  fillWithAxes(h.inventory);
  const z = h.sellTo('stonemonger', 'stone', 1);
  ok('bag full of tools, goods in a shed: coins go to a storehouse', z.ok && h.inventory.countOf('coin') === 0 && t.store.countOf('coin') === STONE.coins);

}
{
  // Nowhere: the bag's only slot keeps 8 stone after the sale, so the coins fit nowhere and the stone comes back.
  const { d } = make({ slots: 1 });
  d.inventory.add('stone', 40);
  const r = d.sellTo('stonemonger', 'stone', 1);
  ok('no room for the coins anywhere: refused, the stone is back, the purse untouched',
    !r.ok && r.short === 'room' && d.inventory.countOf('stone') === 40 && d.inventory.countOf('coin') === 0 && d.purseLeft('stonemonger') === PURSE && d.tally.trade === 0);
}
// 9. The event.
{
  const { d, events } = make();
  d.inventory.add('stone', 32);
  d.sellTo('stonemonger', 'stone', 1);
  const e = events.find((x) => x.name === 'duilt:sold')?.e;
  ok('duilt:sold carries { trader, itemId, count, coins }', e && e.trader === 'stonemonger' && e.itemId === 'stone' && e.count === STONE.lot && e.coins === STONE.coins);
  ok('and the trade tally and tradedWith move', d.tally.trade === 1 && d.tradedWith.has('stonemonger'));
}
// 10. Save and load.
{
  const { d } = make();
  d.inventory.add('stone', 32);
  d.sellTo('stonemonger', 'stone', 1);
  ok('toJSON writes the purses', /purses:/.test(DuiltGame.prototype.toJSON.toString()));
  const saved = JSON.parse(JSON.stringify({ purses: d.purses }));
  const { d: e } = make();
  e.loadJSON({ purses: saved.purses, days: 0.7 });
  ok('loadJSON keeps what was spent today', e.purseLeft('stonemonger') === PURSE - STONE.coins);
  const { d: g } = make();
  g.loadJSON({ days: 3.2 });
  ok('a save without purses has them full', g.purseLeft('stonemonger') === PURSE && g.purseLeft('smith') === PURSE);
  const { d: h } = make();
  h.loadJSON({ purses: saved.purses, days: 2.1 });
  ok('purses from an earlier day are full again', h.purseLeft('stonemonger') === PURSE);
}
// 11. Hand sales reach the storehouses.
{
  const { d, shed } = make();
  const s = shed();
  s.store.add('stone', 64);
  const r = d.sellTo('stonemonger', 'stone', 2);
  ok('stone only in a storehouse sells, 2 lots', r.ok && r.lots === 2 && s.store.countOf('stone') === 0 && d.inventory.countOf('coin') === 2 * STONE.coins);
  s.store.add('stone', 40);
  const q = d.sellTo('stonemonger', 'stone', 5);
  ok('short stock sells what is there: 40 stone is 1 whole lot', q.ok && q.lots === 1 && s.store.countOf('stone') === 8);
}

process.exit(f ? 1 : 0);
