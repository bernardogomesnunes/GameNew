import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { TRADERS, CITY_TRADERS, goodsFor, restockIn, RARE_EVERY, RARE_SHOWN, TRADERS_BY_ID } from '../src/config/traders.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

/**
 * Backlog batch 4, D2 (asked for directly: "Next fix ... markets"): "Traders
 * stock the hard-to-get items at a price, and their stock rotates."
 */

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

ok('every market trader has a rare shelf, of real items', TRADERS.every((t) => t.rare?.length >= RARE_SHOWN && t.rare.every(([id, n, price, age]) => ITEMS_BY_ID.has(id) && n > 0 && price > 0 && age >= 1)));
const made = new Set(RECIPES.map((r) => r.output.id));
ok('  each with things nobody can make, beside the slow and dear to make', TRADERS.every((t) => t.rare.some(([id]) => !made.has(id))));
const story = /^(armour|sword)_(sky|stone|dark)|sunstone|nightstone|god_wand|collector_crown/;
ok('  and nothing that decides the story: no Sky or Dark gear, no ring ore, no wand', TRADERS.every((t) => !t.rare.some(([id]) => story.test(id))));
ok('city merchants keep to their own goods', CITY_TRADERS.every((t) => goodsFor(t, { day: 3 }).length === t.goods.length));

const smith = TRADERS_BY_ID.get('smith');
const rareOn = (day, age = 12) => goodsFor(smith, { day, age }).filter((g) => g[3]).map((g) => g[0]).join();
ok(`a trader puts out ${RARE_SHOWN} rare goods after their own`, goodsFor(smith, { day: 0, age: 12 }).filter((g) => g[3]).length === RARE_SHOWN
  && goodsFor(smith, { day: 0, age: 12 }).slice(0, smith.goods.length).every((g) => !g[3]));
ok('the same all through a window', rareOn(0) === rareOn(RARE_EVERY - 1));
const windows = new Set(Array.from({ length: 12 }, (_, w) => rareOn(w * RARE_EVERY)));
ok(`and it turns over (${windows.size} different picks in 12 windows)`, windows.size >= 3);
ok('nothing from beyond your age: no diamond pickaxe at a young market', Array.from({ length: 20 }, (_, w) => goodsFor(smith, { day: w * RARE_EVERY, age: 5 })).flat().every((g) => !g[3] || smith.rare.find((r) => r[0] === g[0])[3] <= 5));
ok('restockIn counts down to the next window', restockIn(0) === RARE_EVERY && restockIn(RARE_EVERY - 1) === 1 && restockIn(RARE_EVERY) === RARE_EVERY);

// Buying off the rare shelf.
const { world } = generateDuiltWorld({ sizeX: 64, sizeZ: 64, seed: 2 });
const d = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
d.territory.setAge(10);
d.days = 4;
const stall = goodsFor(smith, { day: d.days, age: d.age });
const i = stall.findIndex((g) => g[3]);
const [id, n, price] = stall[i];
d.inventory.add('coin', price);
const res = d.buyFrom('smith', i);
ok(`buying from the rare shelf takes today's price and gives today's item (${n} ${id} for ${price})`, res.ok && d.inventory.countOf(id) >= n && d.inventory.countOf('coin') === 0);

const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
ok('the stall draws the same list the purchase reads', /const goods = goodsFor\(t, \{ day: d\.days, age: d\.sandbox \? Infinity : d\.age \}\);/.test(ui));
ok('  with a heading saying when it changes', /Rare goods — new ones in \$\{days\} day/.test(ui));

process.exit(f ? 1 : 0);
