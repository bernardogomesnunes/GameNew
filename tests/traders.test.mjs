import { readFileSync } from 'node:fs';
import { TRADERS, tradersFor, GOBLIN_SKIN } from '../src/config/traders.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { OUTFITS } from '../src/config/outfits.js';
import { Inventory } from '../src/items/Inventory.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

/**
 * The batch: "Markets should have a new level of importance ... The trader,
 * and this guy which is a goblin looking creature, sells all the blocks. But
 * here's the thing, each trader only sell a selective set of blocks. Like
 * rocks, wood and food, or weapons armour and ores. And to start the market
 * only has one trader, but evolving it will lead to have more."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

ok('every good is a real item, for a real price', TRADERS.every((t) => t.goods.every(([id, n, p]) => ITEMS_BY_ID.has(id) && n > 0 && p > 0)));
const all = TRADERS.flatMap((t) => t.goods.map(([id]) => id));
ok('each sells their own set — nobody sells what another does', new Set(all).size === all.length);
ok('rocks, wood and food; weapons, armour and ores', /rocks/i.test(TRADERS[0].trade) && /weapons/i.test(TRADERS[1].trade));
ok('a new market has one trader, and each level brings another', tradersFor(0).length === 1 && tradersFor(1).length === 2 && tradersFor(3).length === TRADERS.length && tradersFor(9).length === TRADERS.length);

// Buying.
const buyer = { inventory: new Inventory({ slots: 40 }), sandbox: false, bus: null, tally: { hunt: 0, trade: 0, evolve: 0 }, tradedWith: new Set() };
const buy = (i, t = 'stonemonger') => DuiltGame.prototype.buyFrom.call(buyer, t, i);
const [id, n, price] = TRADERS[0].goods[0];
let r = buy(0);
ok('no coins, no sale — and it says how many more', !r.ok && new RegExp(`${price} more coin`).test(r.reason) && buyer.inventory.countOf(id) === 0);
buyer.inventory.add('coin', price + 1);
r = buy(0);
ok('coins in, goods out', r.ok && buyer.inventory.countOf(id) === n && buyer.inventory.countOf('coin') === 1);

// Where they stand: on the floor, inside, apart.
const floorY = 5;
const world = { getBlock: (x, y) => (y < floorY ? 7 : 0) };
const market = { id: 'm1', type: 'market', region: { minX: 0, maxX: 10, minY: floorY, maxY: floorY + 4, minZ: 0, maxZ: 10 } };
const placed = DuiltGame.prototype.placeTraders.call({ world }, market, tradersFor(3));
ok('each one has somewhere to stand, inside the market', placed.length === 4 && placed.every((p) => p.y === floorY && p.x > 0 && p.x < 11 && p.z > 0 && p.z < 11));
ok('not on top of each other', placed.every((p, i) => placed.every((q, j) => i === j || Math.hypot(p.x - q.x, p.z - q.z) >= 2.5)));
ok('goblins: green, with a trader\'s cap, ears and a nose', placed.every((p) => p.kind === 'trader' && p.skin === GOBLIN_SKIN) && OUTFITS.trader.ears && OUTFITS.trader.nose);

const view = readFileSync(new URL('../src/render/SettlerView.js', import.meta.url), 'utf8');
ok('drawn in their own skin, ears out', /this\._colour\.setHex\(p\.skin \?\? SKINS\[who % SKINS\.length\]\)/.test(view) && /if \(o\.ears\) \{/.test(view));
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('they are drawn with everyone else', /\.\.\.this\.tradersFacingYou\(\),/.test(game));
ok('a tap on one opens their stall', /this\.traderTarget\(aimed\)/.test(game) && /if \(trader\) \{\s*this\.ui\.openTrader\(trader\);/.test(game));
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
ok('the stall: goods as tiles, with a price and Buy', /showTrader\(person\) \{/.test(ui) && /data-buy="\$\{i\}"/.test(ui) && /d\.buyFrom\(t\.id, Number\(b\.dataset\.buy\)\)/.test(ui));

process.exit(f ? 1 : 0);
