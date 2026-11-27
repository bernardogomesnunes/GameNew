import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { harvestOf } from '../src/duilt/Crops.js';
import { cropBlock, RIPE } from '../src/config/crops.js';
import { ITEMS_BY_ID, FRUITS, feedValue } from '../src/config/items.js';
import { itemIcon } from '../src/config/cubes.js';
import { WANDERERS } from '../src/config/wanderers.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { lootFor } from '../src/duilt/Loot.js';
import { readFileSync, readdirSync } from 'node:fs';
import { Settlers } from '../src/duilt/Settlers.js';
import { Inventory } from '../src/items/Inventory.js';
import { FOODS, foodIn } from '../src/config/soldiers.js';

/** FRUIT-1, FRUIT-2, FRUIT-5: four fruits, acorns, roots, and old saves. */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const flat = () => {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 48 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 1);
  return world;
};
const mk = () => new DuiltGame({ world: flat(), scene: new THREE.Scene(), bus: null, sandbox: false });
const cube = (id) => /<svg class="cube"/.test(itemIcon(ITEMS_BY_ID.get(id)) ?? '');

ok('four fruits, all food worth 8', FRUITS.length === 4 && FRUITS.every((id) => ITEMS_BY_ID.get(id)?.kind === 'food' && feedValue(id) === 8));
ok('each has a 3D icon', FRUITS.every(cube));
ok('the generic fruit item is gone', !ITEMS_BY_ID.has('fruit'));
ok('acorn feeds 1 and has an icon', feedValue('acorn') === 1 && cube('acorn'));

// Starting kit and old saves.
{
  const g = mk();
  g.grantStartingKit();
  ok('starts with 4 apples', g.inventory.countOf('apple') === 4);
  const save = JSON.parse(JSON.stringify(g.toJSON()));
  save.inventory.slots[0] = { id: 'fruit', count: 7 };
  save.chests = [{ key: '1,1,1', slots: [{ id: 'fruit', count: 3, wear: 0 }, null] }];
  save.extraStore = { stock: { fruit: 5 } };
  const h = mk();
  h.loadJSON(save);
  ok('a bag holding fruit loads it as apples', h.inventory.countOf('apple') >= 7 && h.inventory.countOf('fruit') === 0);
  ok('a chest too', h.chests.size === 1 && [...h.chests.values()][0].inventory.countOf('apple') === 3);
  ok('and a store keyed by fruit', save.extraStore.stock.apple === 5 && !('fruit' in save.extraStore.stock));
}

// Leaves.
{
  const g = mk();
  g.rand = () => 0;
  g.onBlocksBroken([{ x: 1, y: 5, z: 1, prev: 5, next: 0 }]);
  ok('oak leaves drop an acorn', g.inventory.countOf('acorn') === 1);
  const h = mk();
  h.rand = () => 0;
  h.onBlocksBroken([{ x: 1, y: 5, z: 1, prev: 44, next: 0 }]);
  ok('dark leaves do not', h.inventory.countOf('acorn') === 0);
}

// Wanderers and loot drop one of the four.
{
  const w = Object.create(Wanderers.prototype);
  let n = 0;
  w.rand = () => (n++ % 8) / 8 + 0.01;
  const seen = new Set();
  for (let i = 0; i < 24; i++) for (const id of Object.keys(w.rollDrops({ any_fruit: [1, 1] }))) seen.add(id);
  ok('a wanderer fruit drop is one of the 4', seen.size >= 3 && [...seen].every((id) => FRUITS.includes(id)));
  const all = Object.values(WANDERERS).flatMap((s) => Object.keys(s.drops ?? {}));
  ok('no wanderer drops the old fruit id', !all.includes('fruit'));
  const kinds = new Set();
  for (let i = 0; i < 400; i++) for (const k of ['ruin', 'hermit', 'cave', 'camp', 'tower']) for (const id of Object.keys(lootFor(k, i, 5, i * 3, i))) kinds.add(id);
  ok('loot never holds the old id or the marker', !kinds.has('fruit') && !kinds.has('any_fruit'));
}

// Roots.
ok('carrot, lettuce and broccoli give a root when ripe',
  harvestOf(cropBlock('carrot', RIPE)).carrot_root === 1 && harvestOf(cropBlock('lettuce', RIPE)).lettuce_root === 1 && harvestOf(cropBlock('broccoli', RIPE)).broccoli_root === 1);
ok('potato does not', Object.keys(harvestOf(cropBlock('potato', RIPE))).every((k) => !k.endsWith('_root')));
ok('a green crop gives no root', Object.keys(harvestOf(cropBlock('carrot', 1))).join() === 'seeds_carrot');
ok('root items exist with icons', ['broccoli_root', 'carrot_root', 'lettuce_root'].every(cube));

// Acorns are eaten last (villagers and soldiers).
{
  const meal = (bag, store) => {
    const st = Object.create(Settlers.prototype);
    st.inventory = new Inventory(); st.inventory.add(...bag);
    const shed = new Inventory(); if (store) shed.add(...store);
    st.stores = () => (store ? [shed] : []);
    return st.nextMeal();
  };
  ok('villagers eat an apple before an acorn in the same bag', meal(['apple', 1]) && (() => { const st = Object.create(Settlers.prototype); st.inventory = new Inventory(); st.inventory.add('acorn', 5); st.inventory.add('apple', 1); st.stores = () => []; return st.nextMeal().food.id === 'apple'; })());
  ok('with only acorns left they eat acorns', (() => { const st = Object.create(Settlers.prototype); st.inventory = new Inventory(); st.inventory.add('acorn', 2); st.stores = () => []; return st.nextMeal().food.id === 'acorn'; })());
  ok('an acorn in a storehouse waits while the bag holds an apple', meal(['apple', 1], ['acorn', 9]).food.id === 'apple');
  ok('soldiers list the acorn last', FOODS.at(-1).id === 'acorn' && FOODS[0].id !== 'acorn');
  const inv = new Inventory(); inv.add('acorn', 3); inv.add('apple', 2);
  ok('and both count as keep', foodIn(inv) === 5);
}

// No source file still names the old item.
{
  const hits = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.js')) {
        const src = readFileSync(p, 'utf8').replace(/glyph: 'fruit'/g, '').replace(/^\s*fruit: 'M[^\n]*$/gm, '');
        if (!p.endsWith('config/items.js') && /'fruit'|\bfruit: /.test(src)) hits.push(p);
      }
    }
  };
  walk(new URL('../src', import.meta.url).pathname);
  ok(`no source names the old 'fruit' item (${hits.join(', ')})`, hits.length === 0);
}
process.exit(f ? 1 : 0);
