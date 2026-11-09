// IMP-23. Owner, 5 November: "I think we need to add a slot for left hand and
// add a shield to the game too." 9 November: "Let's go for left hand items and
// shield. Shield should be 3d beautiful like other items."
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { SHIELDS, WEAR_SLOTS, SLOT_NAMES } from '../src/config/armour.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { ITEM_MODELS } from '../src/config/itemModels.js';
import { GLYPHS } from '../src/config/glyphs.js';

assert.ok(WEAR_SLOTS.includes('offhand') && SLOT_NAMES.offhand === 'Left hand');
assert.deepEqual(SHIELDS.map((s) => s.id), ['shield_wood', 'shield_iron', 'shield_diamond']);
for (const s of SHIELDS) {
  const item = ITEMS_BY_ID.get(s.id);
  assert.equal(item.wears, 'offhand', `${s.id} goes in the left hand`);
  assert.ok(item.armour > 0 && item.block > 0 && item.block < 0.5 && item.durability > 0);
  const r = RECIPES.find((x) => x.id === s.id);
  assert.ok(r && r.age === s.age, `${s.id} can be made from Age ${s.age} (${r?.station})`);
  assert.ok(ITEM_MODELS[s.id].length >= 15, `${s.id} has a detailed 3D model (${ITEM_MODELS[s.id].length} boxes)`);
}
assert.ok(GLYPHS.shield);
assert.equal(RECIPES.find((r) => r.id === 'shield_wood').inputs.planks, 6);
console.log('PASS three shields, wood, iron and diamond, each with a recipe, worn in a new left-hand slot, each a 3D model');

const world = new World({ sizeX: 32, sizeZ: 32, height: 16 });
const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
g.inventory.add('shield_iron', 1);
const at = g.inventory.slots.findIndex((x) => x?.id === 'shield_iron');
const r = g.wear(at);
assert.equal(r.ok, true); assert.equal(r.slot, 'offhand');
assert.equal(g.worn.offhand.id, 'shield_iron');
assert.equal(g.armour(), 2, 'it counts as armour');
console.log('PASS it goes on in the left hand and adds its armour');

// Blocking: the share of blows turned aside whole, the rest through armour.
let rolls = [0.1, 0.9];
g.rand = () => rolls.shift() ?? 0.9;
const hp = g.health.hp ?? g.health.current;
assert.equal(g.absorb(10), 0, 'a blow under the block chance is turned aside');
assert.ok(g.absorb(10) > 0, 'one over it gets through, smaller for the armour');
assert.equal(g.worn.offhand.wear, 2, 'both wore it a little');
console.log('PASS it turns a blow aside 25% of the time, and wears with every blow');

const save = JSON.parse(JSON.stringify(g.toJSON()));
const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
back.loadJSON(save);
assert.equal(back.worn.offhand?.id, 'shield_iron', 'it is saved on your arm');
assert.equal(back.takeOff('offhand').ok, true);
assert.ok(back.inventory.countOf('shield_iron') === 1);
console.log('PASS it is saved, and comes off back into the bag');
