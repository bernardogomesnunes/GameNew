import assert from 'node:assert/strict';
import { Crafting } from '../src/duilt/Crafting.js';
import { Inventory } from '../src/items/Inventory.js';
import { RECIPES_BY_ID } from '../src/config/recipes.js';
import { STRUCTURES, producesAt } from '../src/config/structures.js';
import { BLOCKS_BY_ID, stationOf } from '../src/config/blocks.js';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { FURNITURE_ITEM } from '../src/config/items.js';
const inv = new Inventory();
const craft = new Crafting({ inventory: inv, world: { getBlock: () => 0 } });
const quarry = STRUCTURES.find(s => s.id === 'quarry');
for (let t = 0; t < quarry.tiers.length; t++) assert.deepEqual(Object.keys(producesAt(quarry,t)), ['stone']);
console.log('PASS all quarry tiers only produce stone');
for (const id of ['marble','cobblestone','stone_grey','stone_orange','stone_white','dark_stone']) assert.ok(RECIPES_BY_ID.has(id));
assert.equal(RECIPES_BY_ID.get('dark_stone').station, 'forge');
assert.equal(RECIPES_BY_ID.get('stone_white').station, 'bleach_bucket');
assert.equal(stationOf(RECIPES_BY_ID.get('bleach_bucket').output.id === 'bleach_bucket' ? 524 : 0), 'bleach_bucket');
assert.ok(BLOCKS_BY_ID.get(525)?.station === 'forge');
console.log('PASS rock processing has forge and placed bleach bucket');
const furniture = RECIPES_BY_ID.get('table_oak');
for (const [id,n] of Object.entries(furniture.inputs)) inv.add(id,n*2);
const opts = { atStations: ['wood_mill','workshop'] };
assert.equal(craft.craft(furniture.id, 1, opts).ok, false);
for (const tool of furniture.tools) inv.add(tool,1);
assert.equal(craft.craft(furniture.id, 1, opts).ok, true);
for (const tool of furniture.tools) assert.equal(inv.countOf(tool),1);
console.log('PASS furniture needs reusable carpentry tools even at a mill');
for (const id of ['table_oak','bed','painting']) assert.deepEqual(RECIPES_BY_ID.get(id).tools, ['carpentry_saw'], `${id} needs one tool`);
assert.equal(RECIPES_BY_ID.get('wood_white').station, 'bleach_bucket');
assert.equal(RECIPES_BY_ID.get('wood_dark').station, 'forge');
assert.equal(RECIPES_BY_ID.get('wood_white').output.id, 'white_wood');
assert.equal(RECIPES_BY_ID.get('wood_dark').output.id, 'dark_wood');
console.log('PASS furniture needs one tool; wood can be bleached and charred like rock');
const sword = RECIPES_BY_ID.get('sword_iron');
for (const [id,n] of Object.entries(sword.inputs)) inv.add(id,n);
assert.equal(craft.craft(sword.id,1,{atStations:['forge']}).ok,false);
inv.add('weapon_mold',1);
assert.equal(craft.craft(sword.id,1,{atStations:['forge']}).ok,true);
assert.equal(inv.countOf('weapon_mold'),1);
console.log('PASS forged weapons require a reusable mold');
assert.equal(craft.craft('planks',NaN).ok,false);
assert.equal(craft.craft('planks',0.5).ok,false);
console.log('PASS invalid batch counts are rejected');

for (const id of ['marble','cobblestone','stone_brick','stone_white','stone_grey','stone_orange','dark_stone','dark_brick','wood_white','wood_dark']) {
  const r = RECIPES_BY_ID.get(id);
  const bag = new Inventory();
  const bench = new Crafting({ inventory: bag, world: { getBlock: () => 0 } });
  for (const [part,n] of Object.entries(r.inputs)) bag.add(part,n);
  const before = JSON.stringify(bag.toJSON());
  assert.equal(bench.craft(id,1).ok,false);
  assert.equal(JSON.stringify(bag.toJSON()),before);
  assert.equal(bench.craft(id,1,{atStations:[r.station]}).ok,true);
  assert.equal(bag.countOf(r.output.id),r.output.count);
}
console.log('PASS every rock-processing chain pays and produces only at its station');
assert.equal(RECIPES_BY_ID.get('stone_mill').inputs.cobblestone, undefined);
console.log('PASS first stone mill can be made before processed cobble exists');
for (const r of RECIPES_BY_ID.values()) {
  if (r.name.startsWith('Upgrade:') && r.output.id.startsWith('sword_')) assert.equal(r.station,'temple');
}
console.log('PASS temple enchantments still use temple recipes');
const smelt = new Inventory();
const forge = new Crafting({ inventory: smelt, world: { getBlock: () => 0 } });
for (const [part,n] of Object.entries(RECIPES_BY_ID.get('sword_iron').inputs)) smelt.add(part,n);
smelt.add('weapon_mold',1);
assert.equal(forge.craft('sword_iron',1,{atStations:['foundry']}).ok,true);
console.log('PASS existing foundries can also forge weapons');
const available = craft.available(12,{station:null,atStations:['forge','workshop','wood_mill']}).find(r=>r.id==='table_oak');
assert.equal(available.ok,true);
inv.remove('carpentry_saw',1);
assert.equal(craft.available(12,{station:null,atStations:['workshop']}).find(r=>r.id==='table_oak').ok,false);
assert.match(craft.craft('table_oak',1,{atStations:['workshop']}).reason,/Saw/);
console.log('PASS removing a reusable tool after opening the panel blocks the craft');

const alternate = RECIPES_BY_ID.get('stone_mill_stone_brick');
assert.ok(alternate.steps?.length > 1, 'The cheaper mill route must also use work steps');
assert.ok(RECIPES_BY_ID.get('sky_marble').steps?.length > 1, 'Polishing marble is processing too');
console.log('PASS alternative stone processing routes also have work steps');

const context = { atStations: ['stone_mill'] };
assert.deepEqual(craft.availableRecipe(alternate.id, 12, context),
  craft.available(12, { station: null, ...context }).find(r => r.id === alternate.id));
assert.equal(craft.availableRecipe(alternate.id, 1, context), null);
assert.equal(craft.availableRecipe('not-a-recipe', 12, context), null);
const hidden = new Crafting({ inventory: inv, world: {}, hidden: r => r.id === alternate.id });
assert.equal(hidden.availableRecipe(alternate.id, 12, context), null);
console.log('PASS checking one active recipe preserves age and visibility rules');

for (const edge of [15, -1]) {
  let generated = 0;
  const world = new World({ height: 32, gen: { biomes: { centreX: 0, centreZ: 0 }, fill() { generated++; } } });
  world.setBlock(edge, 16, edge, 524);
  world.setBlock(edge - 1, 16, edge, 11);
  const before = generated;
  const near = { x: edge, y: 16, z: edge };
  const stations = DuiltGame.prototype.stationsNear.call({ world, structures: { list: () => [] } }, near);
  assert.ok(stations.includes('bleach_bucket'));
  assert.ok(new Crafting({ inventory: inv, world }).conditionMet('water', near));
  assert.equal(generated, before, 'Crafting scans must not generate unloaded terrain at chunk edges');
}
console.log('PASS nearby crafting checks read existing chunks without generating terrain');

const panel = RECIPES_BY_ID.get('panel_twotone');
const panelBag = new Inventory();
const panelCraft = new Crafting({ inventory: panelBag, world: {} });
for (const [id,n] of Object.entries(panel.inputs)) panelBag.add(id,n);
assert.equal(panelCraft.craft(panel.id,1,{atStations:['wood_mill']}).ok,false,
  'Two-tone wall panels need the same saw as other wooden panels');
for (const tool of furniture.tools) panelBag.add(tool,1);
assert.equal(panelCraft.craft(panel.id,1,{atStations:['wood_mill']}).ok,true);
assert.ok(panel.steps?.length > 1);
console.log('PASS two-tone wooden panels need the saw and work steps');

for (const id of [...FURNITURE_ITEM.values(), 'bed', 'painting', 'chair_red', 'panel_twotone']) {
  for (const r of RECIPES_BY_ID.values()) {
    if (r.output.id !== id) continue;
    assert.deepEqual(r.tools, furniture.tools, `${r.id} uses the one-saw rule`);
    assert.ok(r.steps?.length > 1, `${r.id} has work steps`);
  }
}
console.log('PASS all wooden furniture colours and recipe variants share the one-tool rule and steps');
