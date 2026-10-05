import { EventBus } from '../src/core/EventBus.js';
import { GamificationEngine } from '../src/gamification/GamificationEngine.js';
import { ACHIEVEMENTS_BY_ID } from '../src/config/achievements.js';
import { Inventory } from '../src/items/Inventory.js';

/** Goals for the batch's new systems: building levels, coins, the market's traders. */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const bus = new EventBus();
const g = new GamificationEngine(bus);
const inventory = new Inventory({ slots: 40 });
let traders = 1;
g.setDuilt({ sandbox: false, inventory, marketTraders: () => new Array(traders).fill({}), structures: { list: () => [], countOf: () => 0 }, age: 1, territory: { size: 32 }, settlers: { people: [] } });
const has = (id) => g.state.achievementsUnlocked.has(id);

ok('each one exists, in the age it belongs to', ['first_evolve', 'coin_purse', 'first_trade', 'market_town', 'renowned'].every((id) => ACHIEVEMENTS_BY_ID.has(id)));
bus.emit('structure:upgraded', { structure: { type: 'forest', tier: 1 } });
ok('evolving a building ticks "Look after it"', has('first_evolve') && !has('renowned'));
bus.emit('structure:upgraded', { structure: { type: 'forest', tier: 3 } });
ok('and Renowned, at the top of the ladder', has('renowned'));
inventory.add('coin', 20);
bus.emit('duilt:bought', { trader: 'stonemonger', itemId: 'stone', count: 16, price: 2 });
ok('a purchase ticks "Strike a bargain"', has('first_trade'));
ok('twenty coins in the bag is a full purse', has('coin_purse'));
ok('one trader is not a market town', !has('market_town'));
traders = 4;
bus.emit('structure:upgraded', { structure: { type: 'market', tier: 3 } });
ok('four of them is', has('market_town'));

process.exit(f ? 1 : 0);
