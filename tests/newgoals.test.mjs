import { EventBus } from '../src/core/EventBus.js';
import { GamificationEngine } from '../src/gamification/GamificationEngine.js';
import { ACHIEVEMENTS_BY_ID } from '../src/config/achievements.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { Inventory } from '../src/items/Inventory.js';

/**
 * Goals for the batch's new systems — building levels, coins, the market's
 * traders — as the ages' own goals now (config/ages.js): evolving a building
 * in Age 6, Renowned in Age 10, a market town and a hundred coins in Age 12.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const renowned = STRUCTURES_BY_ID.get('forest').tiers.findIndex((t) => t.id === 'renowned');
const inventory = new Inventory({ slots: 40 });
const built = [];
let traders = 1;
const duilt = (age) => ({
  sandbox: false, age, inventory, marketTraders: () => new Array(traders).fill({}),
  structures: { list: () => built, countOf: (t) => built.filter((s) => s.type === t).length },
  territory: { size: 32 }, settlers: { people: [] }, worn: {},
});
const has = (g, id) => g.state.achievementsUnlocked.has(id);

ok('each one exists, in the age it belongs to', ['req_6_evolve', 'req_10_renowned', 'req_12_market_town', 'req_12_coins'].every((id) => ACHIEVEMENTS_BY_ID.has(id)));

{
  const bus = new EventBus();
  const g = new GamificationEngine(bus);
  g.setDuilt(duilt(6));
  built.push({ type: 'forest', tier: 1, valid: true });
  bus.emit('structure:upgraded', { structure: built[0] });
  ok('evolving a building ticks "Evolve a building a level" in Age 6', has(g, 'req_6_evolve'));
  built[0].tier = renowned;
  bus.emit('structure:upgraded', { structure: built[0] });
  ok('but not Age 10\'s Renowned while it\'s still Age 6', !has(g, 'req_10_renowned'));
}

{
  const bus = new EventBus();
  const g = new GamificationEngine(bus);
  g.setDuilt(duilt(10));
  ok('in Age 10, a Renowned building ticks it', has(g, 'req_10_renowned'));
}

{
  const bus = new EventBus();
  const g = new GamificationEngine(bus);
  g.setDuilt(duilt(12));
  inventory.add('coin', 20);
  bus.emit('duilt:bought', { trader: 'stonemonger', itemId: 'stone', count: 16, price: 2 });
  ok('twenty coins is not a hundred', !has(g, 'req_12_coins'));
  inventory.add('coin', 80);
  bus.emit('duilt:bought', { trader: 'stonemonger', itemId: 'stone', count: 16, price: 2 });
  ok('a hundred is', has(g, 'req_12_coins'));
  ok('one trader is not a market town', !has(g, 'req_12_market_town'));
  traders = 4;
  bus.emit('structure:upgraded', { structure: { type: 'market', tier: 3 } });
  ok('four of them is', has(g, 'req_12_market_town'));
}

process.exit(f ? 1 : 0);
