// IMP-15: put items in a station's spot, they come out in their new form, one
// at a time, 15 s to 2 min each, while you are elsewhere.
import assert from 'node:assert/strict';
import { StationWork, usesSpots, batchSeconds, MAX_BATCHES } from '../src/duilt/StationWork.js';
import { RECIPES, RECIPES_BY_ID } from '../src/config/recipes.js';
import { Inventory } from '../src/items/Inventory.js';

const r = (id) => RECIPES_BY_ID.get(id);
assert.ok(usesSpots(r('smelt_iron')) && usesSpots(r('wood_dark')) && usesSpots(r('stone_white')) && usesSpots(r('cobblestone')));
assert.ok(usesSpots(r('sword_iron')), 'everything the forge makes');
assert.ok(!usesSpots(r('stone_orange')), 'two kinds of input at a mill is not a transformation');
assert.ok(!usesSpots(r('planks')), 'by hand stays by hand');
for (const x of RECIPES.filter(usesSpots)) {
  const t = batchSeconds(x);
  assert.ok(t >= 15 && t <= 120, `${x.id}: ${t} s`);
}
console.log('PASS the rule: one item into another at a station, and all of the forge; 15 to 120 s each');

const bag = new Inventory();
bag.add('iron_ore', 6);
const w = new StationWork({ inventory: bag });
const key = 's:7';
assert.equal(w.put(key, 'smelt_iron', 5).batches, 3, 'as many batches as the bag pays for');
assert.equal(bag.countOf('iron_ore'), 0, 'the ore left the bag');
const t = batchSeconds(r('smelt_iron'));
w.tick(t - 1);
assert.equal(w.spot(key).out, 0, 'not before its time');
assert.ok(w.secondsLeft(key) <= 1);
w.tick(1.01);
assert.equal(w.spot(key).out, 1, 'one at a time');
assert.equal(w.spot(key).batches, 2);
w.tick(t * 2 + 1);
assert.equal(w.spot(key).out, 3);
assert.equal(w.take(key), 3);
assert.equal(bag.countOf('iron_ingot'), 3);
assert.equal(w.spot(key), null, 'an empty spot is forgotten');
console.log('PASS ore goes in, ingots come out one at a time, and are taken');

bag.add('wood', 10);
assert.equal(w.put('1,2,3', 'wood_dark', 2).ok, true);
assert.equal(w.put('1,2,3', 'stone_grey', 1).ok, false, 'one recipe at a time');
assert.equal(w.takeBack('1,2,3'), 2);
assert.equal(bag.countOf('wood'), 10, 'what was waiting comes back whole');
console.log('PASS a spot works one recipe at a time, and gives back what is waiting');

bag.add('wood', 2); bag.add('iron_ingot', 3);
assert.equal(w.put('4,4,4', 'sword_iron', 1).ok, false, 'the mold must be in the bag');
bag.add('weapon_mold', 1);
assert.equal(w.put('4,4,4', 'sword_iron', 1).ok, true);
const saved = w.toJSON();
const w2 = new StationWork({ inventory: bag });
w2.loadJSON(saved);
assert.equal(w2.spot('4,4,4').recipeId, 'sword_iron');
w2.prune((k) => k !== '4,4,4');
assert.equal(w2.spot('4,4,4'), null, 'a broken station');
assert.equal(bag.countOf('iron_ingot'), 6, 'gives back what was in it (3 smelted earlier, 3 from the sword)');
assert.ok(MAX_BATCHES >= 16);
console.log('PASS spots are saved, and a broken station gives its items back');
