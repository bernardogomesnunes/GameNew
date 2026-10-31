// Owner, 29 October: "dark logs item should always be called dark logs, same
// for every item, one name per each."
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITEMS } from '../src/config/items.js';
import { BLOCKS_BY_ID } from '../src/config/blocks.js';

// A block that is the item itself carries the item's name. Seeds and the plant
// they grow into, and an ore and the gem it gives, are different things.
const DIFFERENT_THINGS = /^seeds_|^(sunstone|nightstone)$/;
const clash = ITEMS.filter((i) => i.block != null && !DIFFERENT_THINGS.test(i.id))
  .filter((i) => BLOCKS_BY_ID.get(i.block) && BLOCKS_BY_ID.get(i.block).name !== i.name)
  .map((i) => `${i.id}: "${i.name}" / block "${BLOCKS_BY_ID.get(i.block).name}"`);
assert.deepEqual(clash, [], 'an item and its block share one name');
console.log('PASS every item and its block share one name');

const names = new Map();
for (const i of ITEMS) names.set(i.name, [...(names.get(i.name) ?? []), i.id]);
const shared = [...names].filter(([, ids]) => ids.length > 1);
assert.deepEqual(shared, [], 'no two items share a name');
console.log('PASS no two items share a name');

assert.equal(ITEMS.find((i) => i.id === 'dark_wood').name, 'Dark Log');
assert.equal(BLOCKS_BY_ID.get(43).name, 'Dark Log');
console.log('PASS the dark log is the Dark Log, item and block');

const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
assert.ok(/<strong class="recipe-name">\$\{escapeHtml\(name\)\}<\/strong>/.test(ui), 'a workbench tile is titled by what it makes');
console.log('PASS a workbench tile carries the name of the item it makes');
