import * as THREE from 'three';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Inventory } from '../src/items/Inventory.js';
import { PURSE, sellPrice } from '../src/config/traders.js';
import { stackLimit } from '../src/config/items.js';
import { World } from '../src/world/World.js';

/** PLAY-23 chunk C: standing sell orders (docs/design/play-22-23.md). */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

/** A real game with a market (tier 0 unless told) and a storehouse, on a tiny world. */
function make({ tier = 0, sandbox = false, endless = false, bagSlots = 40 } = {}) {
  const events = [];
  const bus = { emit: (name, e) => events.push({ name, e }), on() {}, off() {} };
  const d = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus, sandbox });
  d.inventory = new Inventory({ slots: bagSlots, endless, bus });
  d.structures.inventory = d.inventory;
  d.days = 0.2;
  d.marketDay = 0;
  const put = (type, x, extra = {}) => {
    const s = { id: d.structures.nextId++, type, region: { minX: x, maxX: x + 2, minY: 0, maxY: 2, minZ: 0, maxZ: 2 }, valid: true, locked: true, claimedAt: 0, lastPaidAt: Date.now(), brokenReason: null, tier: 0, ...extra };
    d.structures.structures.push(s);
    d.structures.storeFor(s);
    return s;
  };
  const market = put('market', 0, { tier });
  const shed = put('storehouse', 4);
  /** Moves the clock to a whole game day and runs the day turn. */
  const toDay = (day) => { d.days = day + 0.1; return d.checkMarketDay(); };
  return { d, events, market, shed, toDay };
}
const STONE = sellPrice('stone'); // 32 for 3

// 1. Adding.
{
  const { d, market } = make();
  const a = d.addSellOrder(market.id, 'stonemonger', 'stone', 4, 1);
  ok('Grub, stone, 4 lots, every day: accepted', a.ok && a.order.lots === 4 && a.order.every === 1 && a.order.next === 1 && d.sellOrders(market.id).length === 1);
  ok('Snikkit does not live at a tier 0 market', !d.addSellOrder(market.id, 'smith', 'iron_ore', 1, 1).ok);
  ok('an item Grub does not buy is refused', !d.addSellOrder(market.id, 'stonemonger', 'iron_ore', 1, 1).ok);
  ok('every: 3 is refused', !d.addSellOrder(market.id, 'stonemonger', 'stone', 1, 3).ok);
  const cap = Math.floor(PURSE / STONE.coins);
  ok(`more lots than a full purse (${cap + 1}) is refused, ${cap} is not`, !d.addSellOrder(market.id, 'stonemonger', 'stone', cap + 1, 1).ok && d.addSellOrder(market.id, 'stonemonger', 'stone', cap, 1).ok);
  const third = d.addSellOrder(market.id, 'stonemonger', 'wood', 1, 1);
  ok('a third order at tier 0 is refused, naming the slots', !third.ok && /2 order slots/.test(third.reason));
  ok('tools are never in orders', !make().d.addSellOrder(make().market.id, 'smith', 'sword_iron', 1, 1).ok);
  ok('order ids count up per market', d.sellOrders(market.id).map((o) => o.id).join() === '1,2');
  ok('a tier 3 market has 8 slots', (() => { const t = make({ tier: 3 }); let n = 0; for (const tr of ['stonemonger', 'smith', 'glazier', 'seedwife']) for (const it of ['stone', 'iron_ore', 'glass', 'egg']) { if (n < 9 && t.d.addSellOrder(t.market.id, tr, tr === 'stonemonger' ? 'stone' : tr === 'smith' ? 'iron_ore' : tr === 'glazier' ? 'glass' : 'egg', 1, 1).ok) n++; } return n === 8; })());
}
// 2. A day turn.
{
  const { d, market, shed, toDay } = make();
  shed.store.add('stone', 100);
  d.inventory.add('stone', 5);
  d.addSellOrder(market.id, 'stonemonger', 'stone', 2, 1);
  const r = toDay(1);
  ok(`day 1: 2 lots (${2 * STONE.lot} stone) leave the storehouse, ${2 * STONE.coins} coins arrive, the bag's stone is untouched`,
    r.sold.length === 1 && r.sold[0].n === 2 * STONE.lot && shed.store.countOf('stone') === 100 - 2 * STONE.lot && d.inventory.countOf('coin') === 2 * STONE.coins && d.inventory.countOf('stone') === 5);
  const o = d.sellOrders(market.id)[0];
  ok('next is day + 1 and last records the sale', o.next === 2 && o.last.day === 1 && o.last.lots === 2 && o.last.coins === 2 * STONE.coins && o.last.short === null);
  ok('checking again the same day runs nothing', toDay(1) === null);
}
// 2b. The coins go to the bag first, then a storehouse.
{
  const { d, market, shed, toDay } = make({ bagSlots: 2 });
  shed.store.add('stone', 64);
  d.inventory.add('axe', 1); d.inventory.add('pickaxe', 1);
  d.addSellOrder(market.id, 'stonemonger', 'stone', 1, 1);
  toDay(1);
  ok('bag full: the coins land in the storehouse', d.inventory.countOf('coin') === 0 && shed.store.countOf('coin') === STONE.coins);
  const t = make();
  t.shed.store.add('stone', 64);
  t.d.addSellOrder(t.market.id, 'stonemonger', 'stone', 1, 1);
  t.toDay(1);
  ok('room in the bag: the coins land in the bag', t.d.inventory.countOf('coin') === STONE.coins && t.shed.store.countOf('coin') === 0);
}
// 3. Every other day.
{
  const { d, market, shed, toDay } = make();
  shed.store.add('stone', 500);
  d.addSellOrder(market.id, 'stonemonger', 'stone', 1, 2);
  const ran = [];
  for (let day = 1; day <= 6; day++) if (toDay(day).sold.length) ran.push(day);
  ok('every 2 days from day 0: runs on 2, 4, 6, not 1, 3 or 5', ran.join() === '2,4,6');
}
// 4. Short stock.
{
  const { d, market, shed, toDay } = make();
  shed.store.add('stone', 2 * STONE.lot + 9);
  d.addSellOrder(market.id, 'stonemonger', 'stone', 4, 1);
  const r = toDay(1);
  ok('4 lots asked, 2 in stock: 2 sold, short is stock', r.sold[0].n === 2 * STONE.lot && r.sold[0].short === 'stock' && d.sellOrders(market.id)[0].last.short === 'stock' && shed.store.countOf('stone') === 9);
  const r2 = toDay(2);
  ok('9 stone, under a lot: nothing taken', r2.sold[0].n === 0 && r2.sold[0].short === 'stock' && shed.store.countOf('stone') === 9);
  ok('still due the next day', d.sellOrders(market.id)[0].next === 3);
}
// 5. The purse, shared by orders and hand sales.
{
  const { d, market, shed, toDay } = make();
  shed.store.add('stone', 1000);
  d.addSellOrder(market.id, 'stonemonger', 'stone', 6, 1);   // 6 lots x 3 = 18 coins
  d.addSellOrder(market.id, 'stonemonger', 'stone', 6, 1);   // 2 coins left: no lot fits
  const r = toDay(1);
  ok('the first order takes 18 coins of the 20', r.sold[0].coins === 18);
  ok('the second sells what is left (none fits), short is purse', r.sold[1].n === 0 && r.sold[1].short === 'purse');
  d.inventory.add('stone', 64);
  const h = d.sellTo('stonemonger', 'stone', 1);
  ok('a hand sale after both is refused', !h.ok && d.purseLeft('stonemonger') === PURSE - 18);
  // A second order for a 1-coin item uses the leftover.
  const t = make();
  t.shed.store.add('stone', 1000);
  t.shed.store.add('brick', 160);
  t.d.addSellOrder(t.market.id, 'stonemonger', 'stone', 6, 1);
  ok('Grub does not buy brick, so the leftover stays', !t.d.addSellOrder(t.market.id, 'stonemonger', 'brick', 1, 1).ok);
}
// 5b. The purse is one per trader across markets.
{
  const { d, market, shed, toDay } = make();
  const second = { id: d.structures.nextId++, type: 'market', region: { minX: 8, maxX: 10, minY: 0, maxY: 2, minZ: 0, maxZ: 2 }, valid: true, locked: true, claimedAt: 0, lastPaidAt: Date.now(), brokenReason: null, tier: 0 };
  d.structures.structures.push(second);
  shed.store.add('stone', 1000);
  d.addSellOrder(market.id, 'stonemonger', 'stone', 6, 1);
  d.addSellOrder(second.id, 'stonemonger', 'stone', 6, 1);
  const r = toDay(1);
  ok('two markets share Grub\'s purse: 18 coins, then none fit', r.sold[0].coins === 18 && r.sold[1].coins === 0 && r.sold[1].short === 'purse');
}
// 6. A broken market.
{
  const { d, market, shed, toDay } = make();
  shed.store.add('stone', 200);
  d.addSellOrder(market.id, 'stonemonger', 'stone', 1, 1);
  market.valid = false;
  const r = toDay(1);
  ok('broken: nothing sold, stock untouched, order kept with short broken', r.sold[0].short === 'broken' && shed.store.countOf('stone') === 200 && d.sellOrders(market.id).length === 1 && d.sellOrders(market.id)[0].last.short === 'broken');
  market.valid = true;
  const r2 = toDay(2);
  ok('whole again: it runs the next day', r2.sold[0].n === STONE.lot && r2.sold[0].short === null);
}
// 7. A market taken away.
{
  const { d, market, shed, toDay, events } = make();
  shed.store.add('stone', 200);
  d.addSellOrder(market.id, 'stonemonger', 'stone', 1, 1);
  d.addSellOrder(market.id, 'stonemonger', 'wood', 1, 1);
  d.structures.remove(market.id);
  ok('removed: sellOrders is empty, nothing runs', d.sellOrders(market.id).length === 0 && toDay(1).sold.length === 0 && shed.store.countOf('stone') === 200);
  ok('and one toast says how many orders went', events.some((e) => e.name === 'toast' && /2 standing orders were cancelled/.test(e.e.body)));
}
// 8. A jump of days.
{
  const { d, market, shed, toDay } = make();
  shed.store.add('stone', 1000);
  d.days = 3.1; d.marketDay = 3;
  d.addSellOrder(market.id, 'stonemonger', 'stone', 1, 1);
  d.addSellOrder(market.id, 'stonemonger', 'wood', 1, 2);
  shed.store.add('wood', 1000);
  const r = toDay(9);
  ok('days 3 to 9: each order runs once, never in arrears', r.sold.length === 2 && shed.store.countOf('stone') === 1000 - STONE.lot && shed.store.countOf('wood') === 1000 - 32);
  ok('next is 10 or 11', d.sellOrders(market.id).map((o) => o.next).join() === '10,11');
}
// 9. Save and load.
{
  const { d, market, shed } = make();
  d.addSellOrder(market.id, 'stonemonger', 'stone', 4, 1);
  d.addSellOrder(market.id, 'stonemonger', 'wood', 2, 2);
  const saved = JSON.parse(JSON.stringify({ structures: d.structures.toJSON(), purses: d.purses, marketDay: d.marketDay, days: d.days }));
  ok('the market writes its orders and the next id', saved.structures.structures.find((s) => s.type === 'market').orders.length === 2 && saved.structures.structures.find((s) => s.type === 'market').nextOrder === 3);
  ok('a storehouse writes none', saved.structures.structures.find((s) => s.type === 'storehouse').orders === undefined);
  const { d: e, market: m2 } = make();
  e.structures.structures.length = 0;
  e.loadJSON({ ...saved });
  const loaded = e.structures.structures.find((s) => s.type === 'market');
  ok('orders round-trip', e.sellOrders(loaded.id).length === 2 && e.sellOrders(loaded.id)[0].item === 'stone' && e.sellOrders(loaded.id)[1].every === 2);
  // Bad ones.
  const bad = JSON.parse(JSON.stringify(saved));
  const mk = bad.structures.structures.find((s) => s.type === 'market');
  mk.orders = [
    { id: 1, trader: 'stonemonger', item: 'gold_ore', lots: 1, every: 1, next: 1 },
    { id: 2, trader: 'stonemonger', item: 'stone', lots: 1, every: 5, next: 0 },
    { id: 3, trader: 'nobody', item: 'stone', lots: 1, every: 1, next: 1 },
    { id: 4, trader: 'stonemonger', item: 'wood', lots: 99, every: 1, next: 1 },
  ];
  const { d: g } = make();
  g.structures.structures.length = 0;
  g.loadJSON(bad);
  const gm = g.structures.structures.find((s) => s.type === 'market');
  const ords = g.sellOrders(gm.id);
  ok('an order for an item the trader does not buy is dropped, and so is an unknown trader', ords.length === 2 && ords.every((o) => o.item === 'stone' || o.item === 'wood'));
  ok('every: 5 loads as 2', ords.find((o) => o.id === 2).every === 2);
  ok('lots clamp to a full purse', ords.find((o) => o.id === 4).lots === Math.floor(PURSE / sellPrice('wood').coins));
  ok('next is at least today', ords.every((o) => o.next >= Math.floor(g.days)));
  // A save from before orders, and one with no marketDay.
  const old = JSON.parse(JSON.stringify(saved));
  delete old.marketDay; delete old.purses;
  old.days = 7.4;
  const { d: h } = make();
  h.structures.structures.length = 0;
  h.loadJSON(old);
  const hm = h.structures.structures.find((s) => s.type === 'market');
  h.structures.structures.find((s) => s.type === 'storehouse').store?.add('stone', 500);
  ok('a save without marketDay: loading runs nothing', h.checkMarketDay() === null && h.marketDay === 7);
  const none = JSON.parse(JSON.stringify(saved));
  for (const s of none.structures.structures) { delete s.orders; delete s.nextOrder; }
  const { d: k } = make();
  k.structures.structures.length = 0;
  k.loadJSON(none);
  ok('old saves load with no orders', k.structures.structures.every((s) => !s.orders) && k.sellOrders(k.structures.structures.find((s) => s.type === 'market').id).length === 0);
  ok('and the tick runs the day turn', /this\.checkMarketDay\(\)/.test(DuiltGame.prototype.tick.toString()));
  ok('toJSON writes marketDay', /marketDay:/.test(DuiltGame.prototype.toJSON.toString()) && hm);
}
// 10. Sandbox.
{
  const { d, market, shed, toDay } = make({ sandbox: true });
  shed.store.add('stone', 200);
  const a = d.addSellOrder(market.id, 'stonemonger', 'stone', 1, 1);
  ok('sandbox: no orders can be set', !a.ok);
  market.orders = [{ id: 1, trader: 'stonemonger', item: 'stone', lots: 1, every: 1, next: 1, last: null }];
  const r = toDay(1);
  ok('sandbox: runSellOrders sells nothing', r.sold.length === 0 && shed.store.countOf('stone') === 200 && d.inventory.countOf('coin') === 0);
  const e = make({ endless: true });
  e.shed.store.add('stone', 200);
  e.market.orders = [{ id: 1, trader: 'stonemonger', item: 'stone', lots: 1, every: 1, next: 1, last: null }];
  ok('an endless bag alone sells nothing either', e.toDay(1).sold.length === 0 && e.shed.store.countOf('stone') === 200);
}
// 11. Coins with nowhere to go.
{
  const { d, market, shed, toDay } = make({ bagSlots: 1 });
  // The bag's one slot keeps 4 coins' worth of a full stack; the shed's only slots are packed with tools; stone sits in a partly emptied slot.
  d.inventory.add('coin', stackLimit('coin'));
  for (let i = 0; i < shed.store.slots.length; i++) shed.store.slots[i] = { id: 'axe', count: 1, wear: 0 };
  shed.store.slots[0] = { id: 'stone', count: 40, wear: 0 };
  d.addSellOrder(market.id, 'stonemonger', 'stone', 1, 1);
  const r = toDay(1);
  ok('coins have nowhere to go: short is room, stock untouched', r.sold[0].short === 'room' && r.sold[0].n === 0 && shed.store.countOf('stone') === 40 && d.purseLeft('stonemonger') === PURSE);
}
// 12. Toast and event.
{
  const { d, market, shed, toDay, events } = make();
  shed.store.add('stone', 2 * STONE.lot + 1);
  d.addSellOrder(market.id, 'stonemonger', 'stone', 3, 1);
  toDay(1);
  const t = events.find((e) => e.name === 'toast' && e.e.title === 'Market');
  ok('one toast sums up the day', t && /Sold 64 stone for 6 coins\. Stone order short\./.test(t.e.body));
  const m = events.find((e) => e.name === 'market:sold')?.e;
  ok('market:sold carries { day, sold: [...] }', m && m.day === 1 && m.sold[0].marketId === market.id && m.sold[0].item === 'stone' && m.sold[0].n === 64 && m.sold[0].coins === 6 && m.sold[0].short === 'stock');
}
// 13. A trader that has left.
{
  const { d, market, shed, toDay } = make({ tier: 1 });
  shed.store.add('iron_ore', 40);
  d.addSellOrder(market.id, 'smith', 'iron_ore', 1, 1);
  market.tier = 0;
  const r = toDay(1);
  ok('a trader no longer at the market: nothing sold, order kept, short is gone', r.sold[0].short === 'gone' && shed.store.countOf('iron_ore') === 40 && d.sellOrders(market.id).length === 1);
}
// 14. City stalls: hand sales only.
{
  const { d } = make();
  d.inventory.add('gold', 2);
  const r = d.sellTo('merchant', 'gold', 2);
  ok('a city trader buys by hand, from its own purse', r.ok && d.purseLeft('merchant') < PURSE && d.purseLeft('stonemonger') === PURSE);
  ok('and there is no market to order at', !d.addSellOrder(999, 'merchant', 'gold', 1, 1).ok);
}

process.exit(f ? 1 : 0);
