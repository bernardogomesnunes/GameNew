// IMP-19: "workshop should have an item (new one) called workbench. That
// should allow to do all the crafting, on the bench that I have from the menu
// I should only be able to craft the more simple stuff." Decided: the menu
// keeps Ages 1 and 2; the Workbench is made by hand at Age 3 or at a workshop.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RECIPES, RECIPES_BY_ID, MENU_MAX_AGE } from '../src/config/recipes.js';
import { BLOCKS_BY_ID, stationOf, WORKBENCH } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { Crafting } from '../src/duilt/Crafting.js';
import { Inventory } from '../src/items/Inventory.js';

assert.equal(MENU_MAX_AGE, 2);
assert.equal(ITEMS_BY_ID.get('workbench').block, WORKBENCH);
assert.equal(stationOf(WORKBENCH), 'workbench');
assert.equal(BLOCKS_BY_ID.get(WORKBENCH).name, 'Workbench');
console.log('PASS the Workbench is a placeable station block');

const hand = RECIPES.filter((r) => r.station === 'hand');
assert.ok(hand.every((r) => r.age <= MENU_MAX_AGE || r.id === 'workbench'), 'the menu keeps Ages 1 and 2, and the Workbench itself');
assert.ok(RECIPES.some((r) => r.station === 'workbench' && r.age === 3), 'Age 3 things are made at the Workbench');
assert.ok(!RECIPES.some((r) => r.station === 'workbench' && r.age <= MENU_MAX_AGE), 'nothing from Ages 1 and 2 needs it');
assert.equal(RECIPES_BY_ID.get('workbench').station, 'hand');
assert.equal(RECIPES_BY_ID.get('workbench').age, 3, 'made by hand from Age 3, so Age 3 is never stuck');
assert.equal(RECIPES_BY_ID.get('workshop_workbench').station, 'workshop', 'and at a workshop');
console.log('PASS the menu bench keeps Ages 1 and 2; Age 3 on is made at a Workbench');

const bag = new Inventory();
bag.add('planks', 4); bag.add('glass', 1); bag.add('copper_ingot', 2);
const c = new Crafting({ inventory: bag, world: null });
assert.equal(c.craft('storage_remote', 1).ok, false, 'not from the menu');
assert.equal(c.craft('storage_remote', 1, { atStations: ['workbench'] }).ok, true, 'at a placed Workbench');
console.log('PASS an Age 3 thing is made only at a placed Workbench');

const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
assert.match(ui, /only === 'workbench' \? \(r\) => r\.station === 'hand' \|\| r\.station === 'workbench'/, 'the Workbench lists everything by hand too');
assert.match(ui, /: \(r\) => r\.station === 'hand';/, 'the menu lists only what is made by hand');
console.log('PASS the Workbench lists all the crafting; the menu only the simple things');
