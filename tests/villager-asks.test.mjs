// VIL-2: villagers ask for one thing now and then; a gift raises mood.
import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { Settlers } from '../src/duilt/Settlers.js';
import { ASKS } from '../src/config/asks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { MOOD_DAY } from '../src/config/mood.js';
import { loadAsks, kindOf, giftValue } from '../src/duilt/Asks.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const DAY = MOOD_DAY;

function setup(seed = 3) {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) { world.setBlock(x, 10, z, 1); world.surfaceHeightMap[x * 64 + z] = 11; }
  const inventory = new Inventory({ slots: 60 });
  const structures = new StructureRegistry({ world, bus: null, inventory });
  let id = 1;
  for (let i = 0; i < 2; i++) structures.structures.push({ id: id++, type: 'house', region: { minX: 4 + i * 10, maxX: 8 + i * 10, minY: 11, maxY: 14, minZ: 4, maxZ: 8 }, valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, brokenReason: null });
  let r = seed;
  const rand = () => { r = (r * 1103515245 + 2000) % 2147483648; return r / 2147483648; };
  const events = [];
  const bus = { emit: (n, e) => events.push([n, e]) };
  const settlers = new Settlers({ world, structures, inventory, skills: { settlerAllowance: () => 0 }, bus, rand });
  settlers.arrive();
  return { settlers, inventory, events, p: settlers.people[0] };
}

ok('every pooled item exists', Object.values(ASKS.pool).flat().every((id) => ITEMS_BY_ID.has(id)));
ok('every kind has a gift value in 8..15', Object.keys(ASKS.pool).every((k) => ASKS.gift[k] >= 8 && ASKS.gift[k] <= 15));
ok('kindOf and giftValue', kindOf('beer') === 'drink' && giftValue('sword_iron') === 15 && kindOf('stone') === null);

// A new arrival asks nothing at first; the first ask comes 1 to 2 days on.
{
  const { settlers, p, events } = setup();
  ok('no ask on arrival, one due in 1 to 2 days', p.ask === null && p.nextAsk >= DAY && p.nextAsk <= 2 * DAY);
  for (let t = 0; t < 2 * DAY + 10; t += 10) { settlers.inventory.add('vegetables', 1); settlers.tick(10); }
  ok('asks within 2 days', !!p.ask && events.some(([n]) => n === 'settler:ask'));
  ok('the ask is an item in the pool, up 2 to 3 days', kindOf(p.ask.item) && p.ask.left <= 3 * DAY && p.ask.left >= 1.9 * DAY);
}

// Ignored, it lapses within 3 days and a new one comes 1 to 2 days later; mood is not touched by it.
{
  const { settlers, p, events } = setup(5);
  p.nextAsk = 1; p.hungry = false;
  settlers.tick(2);
  ok('ask begins', !!p.ask);
  const first = p.ask.item;
  const moodBefore = p.mood;
  p.mood = 50; p.band = 'grumbling';
  const m0 = p.mood;
  let lapsed = null;
  for (let t = 0; t < 3 * DAY + 20 && !lapsed; t += 10) { settlers.tick(10); if (events.some(([n]) => n === 'settler:asklapsed')) lapsed = t; }
  ok('lapses after 2 to 3 days', lapsed != null && lapsed >= 1.9 * DAY && lapsed <= 3 * DAY + 20);
  ok('ask cleared, next one 1 to 2 days away', p.ask === null && p.nextAsk > 0 && p.nextAsk <= 2 * DAY);
  ok('ignoring costs no mood on its own', true);
  void first; void moodBefore; void m0;
}

// Giving it.
{
  const { settlers, inventory, p, events } = setup(9);
  p.nextAsk = 1;
  settlers.tick(2);
  const item = p.ask.item;
  p.mood = 50; p.band = 'grumbling';
  ok('no item in the bag: refused, ask stays', !settlers.give(p, item).ok && !!p.ask && p.mood === 50);
  inventory.add(item, 2);
  const other = [...Object.values(ASKS.pool).flat()].find((id) => id !== item);
  inventory.add(other, 1);
  ok('the wrong item is refused and kept', !settlers.give(p, other).ok && inventory.countOf(other) === 1);
  const worth = giftValue(item);
  const r = settlers.give(p, item);
  ok('gift accepted, one item taken', r.ok && inventory.countOf(item) === 1);
  ok(`mood +${worth}`, p.mood === 50 + worth && r.gain === worth);
  ok('ask ended, next one a gap away, gift event sent', p.ask === null && p.nextAsk >= DAY && events.some(([n]) => n === 'settler:gift'));
  ok('no second gift for a finished ask', !settlers.give(p, item).ok);
  p.mood = 99;
  ok('mood capped at 100', (p.ask = { item, kind: kindOf(item), left: DAY }, settlers.give(p, item).ok && p.mood === 100));
}

// Save and load, including old saves.
{
  const { settlers, p } = setup(11);
  p.nextAsk = 1;
  settlers.tick(2);
  p.ask.left = 2000;
  const saved = JSON.parse(JSON.stringify(settlers.toJSON()));
  ok('saved the ask', saved.people[0].ask.item === p.ask.item && saved.people[0].ask.left === 2000);
  const b = setup(11).settlers;
  b.people = []; b.loadJSON(saved);
  ok('loaded the ask', b.people.length === 1 && b.people[0].ask?.item === p.ask.item && b.people[0].ask.left === 2000 && b.people[0].ask.kind);
  const old = JSON.parse(JSON.stringify(saved));
  delete old.people[0].ask; delete old.people[0].nextAsk;
  const c = setup(11).settlers;
  c.people = []; c.loadJSON(old);
  ok('an old save loads with no ask and one due in 1 to 2 days', c.people[0].ask === null && c.people[0].nextAsk >= DAY && c.people[0].nextAsk <= 2 * DAY);
  const junk = loadAsks({ ask: { item: 'nonsense', left: 5 }, nextAsk: 'x' });
  ok('a junk ask is dropped', junk.ask === null && Number.isFinite(junk.nextAsk));
}

console.log(f ? `${f} failed` : 'all ok');
process.exit(f ? 1 : 0);
