import { Magic } from '../src/duilt/Magic.js';
import { LEVEL_POINTS, POINTS, WAND_BASE_DAMAGE, MAX_MAGIC_LEVEL } from '../src/config/magic.js';
import { Inventory } from '../src/items/Inventory.js';

/** WIZ-4: magic points and level. */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const m = new Magic();
ok('before the wizard: level 0, no points gained', m.level === 0 && m.add(5).gained === 0 && m.points === 0);
ok('arrive starts magic at level 1', m.arrive({ x: 1, y: 2, z: 3 }) && m.level === 1 && m.points === 0);
ok('arrive twice does nothing', !m.arrive({ x: 9, y: 9, z: 9 }) && m.home.x === 1);
ok('a cast gives its points', m.cast().gained === POINTS.cast && m.points === POINTS.cast);
ok('a target hit gives its points', m.hitTarget().gained === POINTS.target);
const r = m.add(LEVEL_POINTS[1]);
ok('crossing a threshold reports the new level', r.leveled === 2 && m.level === 2);
ok('toNext counts to level 3', m.toNext() === LEVEL_POINTS[2] - m.points);
m.add(5000);
ok('level caps at ' + MAX_MAGIC_LEVEL, m.level === MAX_MAGIC_LEVEL && m.toNext() === 0);
ok('wand damage grows with level', new Magic().wandDamage() === WAND_BASE_DAMAGE && m.wandDamage() > WAND_BASE_DAMAGE + 5 && m.wandDamage(2) === m.wandDamage() + 2);
ok('potions last longer at higher level', m.potionSeconds(180) > 180);

// Save and load.
m.visits = 3; m.chain = { step: 2, count: { cast: 4 } }; m.given = ['wand']; m.taught = ['speed'];
const back = new Magic(); back.loadJSON(JSON.parse(JSON.stringify(m.toJSON())));
ok('save and load keep points, home, chain, gifts', back.points === m.points && back.home.z === 3 && back.chain.step === 2 && back.chain.count.cast === 4 && back.given[0] === 'wand' && back.taught[0] === 'speed' && back.visits === 3);
ok('an old save (null) loads with magic off', (() => { const o = new Magic(); o.loadJSON(null); return !o.active && o.level === 0 && o.toJSON() === null; })());
ok('garbage loads safely', (() => { const o = new Magic(); o.loadJSON({ points: 'x', home: 5, chain: 7, given: 'no', taught: [1, 'a'] }); return o.active && o.points === 0 && o.home === null && o.chain.step === 0 && o.taught.length === 1; })());

// Shop: only items that exist; coins paid.
const inv = new Inventory({ slots: 8 });
const shop = new Magic();
ok('shop closed before arrival', !shop.buy('seeds_apple', inv).ok);
shop.arrive(null);
ok('shop offers only existing items', shop.offers().every((o) => o.item && o.price > 0));
ok('the shop sells all four fruit seeds', ['seeds_apple', 'seeds_grape', 'seeds_raspberry', 'seeds_passion'].every((id) => shop.offers().some((o) => o.item === id)));
const offer = shop.offers()[0];
ok('buying without coins fails', !shop.buy(offer.item, inv).ok);
inv.add('coin', offer.price + 1);
ok('buying takes coins and gives the seed', shop.buy(offer.item, inv).ok && inv.countOf('coin') === 1 && inv.countOf(offer.item) === 1);
process.exit(f ? 1 : 0);
