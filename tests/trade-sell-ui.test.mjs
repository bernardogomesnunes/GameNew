import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { DuiltUI } from '../src/ui/DuiltUI.js';
import { Inventory } from '../src/items/Inventory.js';
import { PURSE, sellPrice, orderSlots, TRADERS_BY_ID } from '../src/config/traders.js';
import { World } from '../src/world/World.js';

/** PLAY-22/23 chunk D: the trader panel's Sell tab and the standing orders list (docs/design/play-22-23.md). */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const src = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

function make({ sandbox = false } = {}) {
  const events = [];
  const bus = { emit: (name, e) => events.push({ name, e }), on() {}, off() {} };
  const d = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus, sandbox });
  d.inventory = new Inventory({ slots: 40, bus });
  d.structures.inventory = d.inventory;
  d.days = 0.2;
  const put = (type, x, extra = {}) => {
    const s = { id: d.structures.nextId++, type, region: { minX: x, maxX: x + 2, minY: 0, maxY: 2, minZ: 0, maxZ: 2 }, valid: true, locked: true, claimedAt: 0, lastPaidAt: Date.now(), brokenReason: null, tier: 0, ...extra };
    d.structures.structures.push(s);
    d.structures.storeFor(s);
    return s;
  };
  const market = put('market', 0), shed = put('storehouse', 4);
  // The panel without a page: every element is a stub that keeps its markup.
  const els = {};
  const el = (k) => (els[k] ??= { innerHTML: '', hidden: false, querySelector: () => null, querySelectorAll: () => [] });
  const ui = Object.create(DuiltUI.prototype);
  Object.assign(ui, { bus, game: { duilt: d }, q: (sel) => el(sel) });
  return { d, ui, market, shed, els, events };
}
const grub = { trader: 'stonemonger' };
const GRUB = TRADERS_BY_ID.get('stonemonger');

// Markup
ok('panel-trade has a Buy and a Sell button with aria-pressed', /data-trade-tab="buy" aria-pressed="true"/.test(src) && /data-trade-tab="sell" aria-pressed="false"/.test(src));
ok('showTrader splits into renderBuy and renderSell, the choice kept in tradeTab', /renderBuy\(person, t\)/.test(src) && /renderSell\(person, t\)/.test(src) && /this\.tradeTab/.test(src));
ok('the switch buttons are at least 44px tall', /\.trade-switch button \{[^}]*min-height: 44px/.test(css));

// Sell tab at a market
{
  const { d, ui, market, shed, els } = make();
  shed.store.add('stone', 64);
  d.inventory.add('stone', 5);
  ui.renderSell({ ...grub, marketId: market.id }, GRUB);
  const html = els['#trade-list'].innerHTML;
  ok('Sell tab draws data-sell, data-sell-max and data-repeat at a market', /data-sell="stone"/.test(html) && /data-sell-max="stone"/.test(html) && /data-repeat="stone"/.test(html));
  ok('the tile says what you have, bag and storehouses', /You have 5 \+ 64 in storehouses \(2 lots\)/.test(html));
  ok('the coin line shows the purse, and no Take button without shelved coins', /has 20 of 20 left today/.test(els['#trade-coins'].innerHTML) && !/data-take-coins/.test(els['#trade-coins'].innerHTML));
  ok('a tile for an item not held is blocked, and its Sell button is not disabled', /recipe-tile sell-tile blocked"[^>]*data-sell-tile="cobblestone"/.test(html) && !/data-sell="cobblestone"[^>]*disabled/.test(html));
  ok('held tiles come first', html.indexOf('data-sell-tile="stone"') < html.indexOf('data-sell-tile="cobblestone"'));
  ok('Snikkit is announced as arriving at the next level', /Snikkit buys weapons, armour and ores and arrives at the market/.test(html));
  ok('the orders block shows (0 of 2)', /\(0 of 2\)/.test(els['#trade-orders'].innerHTML));
  shed.store.add('coin', 7);
  ui.renderSell({ ...grub, marketId: market.id }, GRUB);
  ok('coins on the shelves offer "Take 7 from storehouses"', /Take 7 from storehouses/.test(els['#trade-coins'].innerHTML));
}

// City trader: no Repeat, no orders block
{
  const { d, ui, els } = make();
  d.inventory.add('fruit', 12);
  ui.renderSell({ trader: 'provisioner' }, TRADERS_BY_ID.get('provisioner'));
  const html = els['#trade-list'].innerHTML;
  ok('a city trader has Sell but no Repeat and no orders', /data-sell="fruit"/.test(html) && !/data-repeat/.test(html) && els['#trade-orders'].innerHTML === '');
}

// Sandbox: no Sell tab
{
  const { d, ui, els } = make({ sandbox: true });
  d.sandbox = true;
  ui.tradeTab = 'sell';
  const calls = [];
  ui.renderBuy = () => calls.push('buy');
  ui.renderSell = () => calls.push('sell');
  ui.showTrader({ trader: 'stonemonger' });
  ok('Creative hides the switch and shows Buy even if Sell was chosen', els['#trade-switch'].hidden === true && calls.join() === 'buy');
}

// Orders: list and cancel
{
  const { d, ui, market } = make();
  d.addSellOrder(market.id, 'stonemonger', 'stone', 4, 1);
  d.addSellOrder(market.id, 'stonemonger', 'fruit', 2, 2);
  const html = ui.ordersHtml(market);
  ok('the orders block says (2 of 2) and has a Cancel per order', /\(2 of 2\)/.test(html) && (html.match(/data-order-cancel="/g) || []).length === 2);
  ok('a row says amount, item, every and trader', /128 stone every day to Grub/.test(html) && /24 fruit every 2 days to Grub/.test(html));
  ok('a row names the next run and the last result', /next in 1 day/.test(html) && /not run yet/.test(html));
  market.orders[0].last = { day: 1, lots: 2, coins: 6, short: 'stock' };
  ok('a short result says why', /short of stone: sold 2 of 4/.test(ui.ordersHtml(market)));
  let cancelled = null, rerendered = false;
  const real = d.cancelSellOrder.bind(d);
  d.cancelSellOrder = (m, o) => { cancelled = [m, o]; return real(m, o); };
  const firstId = market.orders[0].id;
  const button = { dataset: { orderCancel: String(firstId) }, addEventListener: (_, fn) => fn() };
  ui.wireOrderCancel({ querySelectorAll: () => [button] }, market.id, () => { rerendered = true; });
  ok('pressing Cancel calls cancelSellOrder and redraws', cancelled?.[0] === market.id && cancelled[1] === firstId && d.sellOrders(market.id).length === 1 && rerendered);
  ok('the building panel lists a market\'s orders, with "Talk to a trader"', /structure\.type === 'market'[^\n]*ordersHtml\(structure\)[^\n]*Talk to a trader to add one/.test(src) && /wireOrderCancel\(body, structure\.id/.test(src));
}

// Repeat form
{
  const { d } = make();
  const cap = Math.floor(PURSE / sellPrice('stone').coins);
  ok('the Repeat form caps lots at floor(PURSE / coins)', /const cap = Math\.max\(1, d\.maxOrderLots\(id\)\)/.test(src) && d.maxOrderLots('stone') === cap && orderSlots(0) === 2);
  ok('the form offers Day and 2 days', />Day<\/button>/.test(src) && />2 days<\/button>/.test(src));
  ok('the form saves through addSellOrder, and Enter submits (a form)', /d\.addSellOrder\(market\.id, t\.id, id, lots\(\), every\)/.test(src) && /document\.createElement\('form'\)/.test(src));
  ok('the form has - and + buttons of 44px', /\.order-lots button[^}]*width: 44px/.test(css));
}

process.exit(f ? 1 : 0);
