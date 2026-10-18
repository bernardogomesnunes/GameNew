import { readFileSync } from 'node:fs';
import { STRUCTURES_BY_ID, producesAt } from '../src/config/structures.js';
import { FARM_SEED_SLOTS, farmSeedSlots } from '../src/duilt/Crops.js';
import { penProduce } from '../src/duilt/Ranch.js';
import { Inventory } from '../src/items/Inventory.js';
import { Granary } from '../src/items/Granary.js';
import { stackLimit, ITEMS_BY_ID } from '../src/config/items.js';

/**
 * Asked for directly: "Sun stone should be last level of mining, farm should
 * allow extra slots with level up, pen should give meat too (stored in a
 * store house) items in store house need a sorting button to place all the
 * items in the first rows".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the mine ----------------------------------------------------------------------
const mine = STRUCTURES_BY_ID.get('mine');
ok('the mine\'s last level brings up sunstone', producesAt(mine, 4).sunstone > 0);
ok('  and no level before it', [0, 1, 2, 3].every((t) => !producesAt(mine, t).sunstone));

// --- farms -------------------------------------------------------------------------
const farm = STRUCTURES_BY_ID.get('farm');
ok(`a Humble Farm grows ${FARM_SEED_SLOTS} crops`, farmSeedSlots({ tier: 0 }) === FARM_SEED_SLOTS && farmSeedSlots({}) === FARM_SEED_SLOTS);
ok(`each level one more: ${farm.tiers.map((t, i) => `${t.name} ${farmSeedSlots({ tier: i })}`).join(', ')}`, farm.tiers.every((t, i) => farmSeedSlots({ tier: i }) === FARM_SEED_SLOTS + i));
const game = readFileSync(new URL('../src/duilt/DuiltGame.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
ok('sowing allows as many as its level does', /const room = farmSeedSlots\(s\);\s*if \(seeds\.length >= room\)/.test(game));
ok('and its pop-up shows that many slots', /const room = farmSeedSlots\(structure\);/.test(ui) && /Crops · \$\{sown\.length\} of \$\{room\}/.test(ui));

// --- pens --------------------------------------------------------------------------
const pen = { id: 1, region: { minX: 0, maxX: 9, minY: 0, maxY: 3, minZ: 0, maxZ: 9 } };
const animal = (type, i) => ({ type, penId: 1, x: 1 + i, y: 1, z: 1 });
const herd = (kinds) => kinds.flatMap(([type, n]) => Array.from({ length: n }, (_, i) => animal(type, i)));
ok('chickens give eggs, and meat', JSON.stringify(penProduce(pen, herd([['chicken', 2]]))) === JSON.stringify({ egg: 2, raw_meat: 1 }));
ok('sheep wool, and meat; cows milk, and meat', penProduce(pen, herd([['sheep', 1]])).raw_meat === 1 && penProduce(pen, herd([['cow', 3]])).raw_meat === 1 && penProduce(pen, herd([['cow', 3]])).milk === 2);
ok('pigs as before', penProduce(pen, herd([['pig', 3]])).raw_meat === 2);
ok('never more than two meat a cycle, however full the pen', penProduce(pen, herd([['pig', 3], ['cow', 2], ['sheep', 2], ['chicken', 2]])).raw_meat === 2);

// --- sorting a store ---------------------------------------------------------------
{
  const shed = new Inventory({ slots: 12 });
  shed.slots[3] = { id: 'stone', count: 10, wear: 0 };
  shed.slots[7] = { id: 'wood', count: 5, wear: 0 };
  shed.slots[9] = { id: 'stone', count: 20, wear: 0 };
  shed.slots[11] = { id: 'axe', count: 1, wear: 7 };
  const total = (inv) => inv.slots.reduce((n, s) => n + (s?.count ?? 0), 0);
  const before = total(shed);
  ok('sorting moves things', shed.sortSlots() === true);
  const filled = shed.slots.map((s) => !!s);
  ok('everything packed into the first slots', filled.indexOf(false) === filled.filter(Boolean).length && !filled.slice(filled.indexOf(false)).some(Boolean));
  ok('stacks of the same thing joined', shed.slots.filter((s) => s?.id === 'stone').length === 1 && shed.countOf('stone') === 30);
  const names = shed.slots.filter(Boolean).map((s) => ITEMS_BY_ID.get(s.id).name);
  ok(`in order of name (${names.join(', ')})`, names.every((n, i) => i === 0 || names[i - 1].localeCompare(n) <= 0));
  ok('nothing gained or lost, and a tool keeps its wear', total(shed) === before && shed.slots.find((s) => s?.id === 'axe')?.wear === 7);
  ok('sorted already, it says so', shed.sortSlots() === false);
  const big = new Inventory({ slots: 6 });
  big.slots[2] = { id: 'stone', count: stackLimit('stone'), wear: 0 };
  big.slots[5] = { id: 'stone', count: stackLimit('stone'), wear: 0 };
  big.sortSlots();
  ok('full stacks stay full stacks', big.slots[0]?.count === stackLimit('stone') && big.slots[1]?.count === stackLimit('stone'));
  const g = new Granary();
  g.add('vegetables', 50); g.add('cabbage', 5);
  g.sortSlots();
  ok('a granary sorts by name too', g.slots.map((s) => s.id).join() === 'cabbage,vegetables' && g.countOf('vegetables') === 50);
}
ok('the store pop-up has a Sort button', /id="btn-store-sort">Sort<\/button>/.test(ui) && /this\.q\('#btn-store-sort'\)\.addEventListener\('click', \(\) => this\.sortStore\(\)\)/.test(ui));

process.exit(f ? 1 : 0);
