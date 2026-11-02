// CRAFT3D-3, Task 2: the Crucible block, and the foundry's recipes move to it.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CRUCIBLE, BLOCKS_BY_ID, stationOf } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES, RECIPES_BY_ID } from '../src/config/recipes.js';

const MOVED = ['smelt_iron', 'smelt_copper', 'smelt_gold', 'charcoal', 'strike_coins', 'strike_copper_coins', 'strike_ruby_coins'];
assert.equal(CRUCIBLE, 531);
assert.equal(stationOf(531), 'crucible');
assert.equal(BLOCKS_BY_ID.get(531).name, 'Crucible');
assert.equal(ITEMS_BY_ID.get('crucible').block, 531);
const r = RECIPES_BY_ID.get('crucible');
assert.equal(r.station, 'workbench'); assert.equal(r.age, 5); assert.deepEqual(r.inputs, { stone: 8, clay: 2 });
console.log('PASS the Crucible: block 531, made at the Workbench in Age 5 from 8 stone and 2 clay');

for (const id of MOVED) assert.equal(RECIPES_BY_ID.get(id)?.station, 'crucible', id);
assert.equal(RECIPES.filter((x) => x.station === 'foundry').length, 0);
console.log('PASS the foundry\'s 7 recipes are made in the crucible now');

// old foundry spots give their items back
const { DuiltGame } = await import('../src/duilt/DuiltGame.js');
const { World } = await import('../src/world/World.js');
const g = new DuiltGame({ world: new World({ sizeX: 32, sizeZ: 32, height: 24 }), scene: new THREE.Scene(), bus: null });
const data = g.toJSON();
data.stationWork = [{ key: 's:4', station: 'foundry', recipeId: 'smelt_iron', batches: 2, progress: 0.5, out: 1 }];
g.loadJSON(data);
assert.equal(g.inventory.countOf('iron_ore'), 4);
assert.equal(g.inventory.countOf('iron_ingot'), 1);
assert.equal(g.stationWork.spot('s:4'), null);
console.log('PASS old foundry spots give their items back');
