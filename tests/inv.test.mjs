import { Inventory } from '../src/items/Inventory.js';
let f = 0;
const ok = (n, c) => { console.log((c?'PASS ':'FAIL ')+n); if(!c) f++; };

const inv = new Inventory();
ok('starts with 40 empty slots', inv.size === 40 && inv.firstEmpty() === 0);

// bulk stacks to 500, spills into a second slot
ok('leftover reported, not dropped', inv.add('dirt', 700) === 0);
ok('700 dirt held', inv.countOf('dirt') === 700);
ok('spilled into two slots', inv.slots[0].count === 500 && inv.slots[1].count === 200);

// food stacks shallower than bulk
inv.add('fruit', 60);
ok('fruit caps at 50 per slot', inv.slots[2].count === 50 && inv.slots[3].count === 10);

// tools never merge
inv.add('axe', 1); inv.add('axe', 1);
ok('two axes take two slots', inv.countOf('axe') === 2 && inv.slots[4].count === 1 && inv.slots[5].count === 1);

// all-or-nothing spending
ok('short bill is refused', inv.spend({ dirt: 10, stone: 5 }) === false);
ok('nothing was taken on refusal', inv.countOf('dirt') === 700);
ok('affordable bill is paid', inv.spend({ dirt: 10, fruit: 5 }) === true);
ok('both lines charged', inv.countOf('dirt') === 690 && inv.countOf('fruit') === 55);

// what's missing, for the error message
const miss = inv.missing({ dirt: 1000, seeds: 4 });
ok('missing reports shortfalls', miss.dirt === 310 && miss.seeds === 4);

// merging and swapping
const inv2 = new Inventory();
inv2.add('wood', 100); inv2.slots[5] = { id: 'wood', count: 30, wear: 0 };
inv2.move(5, 0);
ok('same items merge', inv2.slots[0].count === 130 && inv2.slots[5] === null);
inv2.add('stone', 7);
const stoneAt = inv2.slots.findIndex(s => s?.id === 'stone');
inv2.move(stoneAt, 0);
ok('different items swap', inv2.slots[0].id === 'stone' && inv2.slots[stoneAt].id === 'wood');

// splitting
const inv3 = new Inventory();
inv3.add('dirt', 41);
inv3.split(0);
ok('split halves a stack', inv3.slots[0].count === 21 && inv3.slots[1].count === 20);
inv3.add('axe', 1);
ok('tools cannot split', inv3.split(inv3.slots.findIndex(s=>s?.id==='axe')) === false);

// tool wear
const inv4 = new Inventory();
inv4.add('axe', 1);
for (let i = 0; i < 119; i++) inv4.useTool('axe');
ok('axe survives 119 uses', inv4.countOf('axe') === 1);
ok('120th use breaks it', inv4.useTool('axe') === 'worn' && inv4.countOf('axe') === 0);
ok('missing tool reported', inv4.useTool('axe') === 'missing');
const inv5 = new Inventory();
inv5.add('bucket', 1);
for (let i = 0; i < 500; i++) inv5.useTool('bucket');
ok('bucket never wears out', inv5.countOf('bucket') === 1);

// full bag refuses rather than eats items
const small = new Inventory({ slots: 2 });
small.add('dirt', 500); small.add('stone', 500);
ok('full bag returns the remainder', small.add('wood', 9) === 9);

// save and load
const saved = JSON.parse(JSON.stringify(inv3.toJSON()));
const restored = new Inventory();
restored.loadJSON(saved);
ok('round trips through save', restored.countOf('dirt') === 41 && restored.countOf('axe') === 1);
restored.loadJSON({ slots: [{ id: 'no_such_item', count: 5, wear: 0 }] });
ok('unknown items dropped on load', restored.countOf('no_such_item') === 0);

process.exit(f ? 1 : 0);
