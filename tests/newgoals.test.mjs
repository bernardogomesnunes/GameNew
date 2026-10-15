import { EventBus } from '../src/core/EventBus.js';
import { GamificationEngine } from '../src/gamification/GamificationEngine.js';
import { ACHIEVEMENTS_BY_ID } from '../src/config/achievements.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { Inventory } from '../src/items/Inventory.js';

/**
 * Goals for the batch's new systems — building levels, coins, the market's
 * traders — as the ages' own goals now (config/ages.js): evolving a building
 * in Age 6, Renowned in Age 10, diamond armour and half the book in Age 11.
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

ok('each one exists, in the age it belongs to', ['req_6_evolve', 'req_10_renowned', 'req_11_gem_armour', 'req_11_book_half'].every((id) => ACHIEVEMENTS_BY_ID.has(id)));

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

// Age 11 (Conquest) — reworked: armour from the diamonds, and the book.
{
  const bus = new EventBus();
  const g = new GamificationEngine(bus);
  const d = duilt(11);
  d.collection = { progress: () => 0.2 };
  g.setDuilt(d);
  d.worn.body = { id: 'armour_iron_body' };
  bus.emit('duilt:bought', { trader: 'stonemonger', itemId: 'stone', count: 16, price: 2 });
  ok('iron armour isn\'t gem armour', !has(g, 'req_11_gem_armour'));
  d.worn.body = { id: 'armour_diamond_body' };
  bus.emit('duilt:bought', { trader: 'stonemonger', itemId: 'stone', count: 16, price: 2 });
  ok('diamond is', has(g, 'req_11_gem_armour'));
  ok('a fifth of the book is not half', !has(g, 'req_11_book_half'));
  d.collection.progress = () => 0.5;
  bus.emit('duilt:bought', { trader: 'stonemonger', itemId: 'stone', count: 16, price: 2 });
  ok('half is', has(g, 'req_11_book_half'));
}

process.exit(f ? 1 : 0);
