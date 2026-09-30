import { Inventory } from '../src/items/Inventory.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { World } from '../src/world/World.js';
import { ITEMS } from '../src/config/items.js';

/**
 * Reported directly: "in creative mode I can delete items, and food if eaten
 * disappears. That's not suppose to happen in creative mode. All items
 * should be one, not able to delete, just move."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
const scene = { add() {}, remove() {} };

{
  const d = new DuiltGame({ world, scene, sandbox: true });
  d.grantCreativeKit();
  const inv = d.inventory;
  const all = () => ITEMS.every((i) => inv.countOf(i.id) === 1);
  ok('a creative bag holds exactly one of everything', all());

  const fruitAt = inv.slots.findIndex((s) => s?.id === 'fruit');
  ok('the bin does nothing', inv.discard(fruitAt) === null && inv.countOf('fruit') === 1);
  d.hunger.value = 10;
  d.eat('fruit');
  ok('eating doesn\'t use the food up', inv.countOf('fruit') === 1);
  ok('nor does spending on anything', inv.spend({ planks: 3, stone: 1 }) && inv.countOf('planks') === 1);
  for (let i = 0; i < 500; i++) inv.useTool('axe');
  ok('a tool never wears out', inv.countOf('axe') === 1 && inv.findTool('axe').slot.wear === 0);
  inv.add('stone', 20);
  ok('nothing piles up a second copy', inv.countOf('stone') === 1);
  ok('a stack can\'t be split into two', !inv.split(fruitAt));
  inv.grow(inv.size + 2);
  const to = inv.slots.findIndex((s) => !s);
  inv.move(fruitAt, to);
  ok('but things still move round the bag', inv.slots[to]?.id === 'fruit' && inv.countOf('fruit') === 1);
  const store = new Inventory({ slots: 4 });
  inv.moveTo(store, to);
  ok('handing something to a storehouse gives it a copy and keeps yours', store.countOf('fruit') === 1 && inv.countOf('fruit') === 1);
  ok('still one of everything after all that', all());
}

{
  // A creative world saved before this: things lost and doubled up.
  const d = new DuiltGame({ world, scene, sandbox: true });
  d.inventory.grow(ITEMS.length);
  d.inventory.slots[0] = { id: 'stone', count: 7, wear: 0 };
  d.inventory.slots[1] = { id: 'stone', count: 3, wear: 0 };
  d.inventory.slots[2] = { id: 'axe', count: 1, wear: 40 };
  d.grantCreativeKit();
  ok('an old creative save comes back as one of everything, nothing worn',
    ITEMS.every((i) => d.inventory.countOf(i.id) === 1) && d.inventory.findTool('axe').slot.wear === 0);
}

{
  const d = new DuiltGame({ world, scene, sandbox: false });
  d.grantStartingKit();
  const inv = d.inventory;
  const before = inv.countOf('fruit');
  inv.remove('fruit', 1);
  ok('a Duilt bag still spends normally', inv.countOf('fruit') === before - 1);
}

process.exit(f ? 1 : 0);
