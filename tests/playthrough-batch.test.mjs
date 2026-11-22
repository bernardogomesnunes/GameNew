import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { DuiltGame, MAX_PINS } from '../src/duilt/DuiltGame.js';
import { World } from '../src/world/World.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { BLOCKS_BY_ID, TORCH, IRON_BLOCK } from '../src/config/blocks.js';
import { RECIPES } from '../src/config/recipes.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';

// Owner's batch of 15 November, after a big playthrough.
const recipe = (out) => RECIPES.filter((r) => r.output.id === out);

assert.equal(ITEMS_BY_ID.get('gold').name, 'Gold Ingot');
assert.equal(ITEMS_BY_ID.get('gold').block, undefined, 'an ingot is not placed as a block');
assert.equal(ITEM_FOR_BLOCK.get(13), 'gold_block');
assert.equal(ITEM_FOR_BLOCK.get(IRON_BLOCK), 'iron_block');
assert.deepEqual(recipe('gold_block')[0].inputs, { gold: 4 });
assert.deepEqual(recipe('iron_block')[0].inputs, { iron_ingot: 4 });
assert.ok(recipe('gold').some((r) => r.inputs.gold_block === 1 && r.output.count === 4), 'a gold block gives its four ingots back');
assert.ok(RECIPES.filter((r) => /^(axe|pickaxe|shovel|sword|armour)_gold(_(head|body|legs|feet))?$/.test(r.output.id)).every((r) => r.inputs.gold > 0), 'gold tools and armour are made from ingots');
console.log('PASS gold is an ingot; gold and iron blocks are four ingots each way');

assert.equal(ITEMS_BY_ID.get('wood').name, 'Oak Log');
assert.equal(ITEMS_BY_ID.get('planks').name, 'Oak Planks');
assert.equal(BLOCKS_BY_ID.get(4).name, 'Oak Log');
assert.equal(BLOCKS_BY_ID.get(7).name, 'Oak Planks');
assert.equal(ITEMS_BY_ID.get('carpentry_chisel').name, 'Chisel');
console.log('PASS oak logs, oak planks and the chisel are named so');

assert.ok(BLOCKS_BY_ID.get(TORCH).light && PROP_SHAPES.torch?.length, 'a torch is a shaped block that gives light');
assert.deepEqual(recipe('torch')[0].inputs, { planks: 1, coal: 1 });
console.log('PASS a torch is made from oak planks and coal, and lights');

{
  const g = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus: null });
  assert.equal(g.addPin(12.6, -40.2, '  The cave  ').pin.name, 'The cave');
  assert.equal(g.addPin(1, 2).pin.name, 'Point 2');
  const again = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus: null });
  again.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  assert.deepEqual(again.pins, [{ x: 13, z: -40, name: 'The cave' }, { x: 1, z: 2, name: 'Point 2' }]);
  assert.equal(again.removePin(0), true);
  assert.equal(again.pins.length, 1);
  for (let i = 0; i < MAX_PINS; i++) again.addPin(i, i);
  assert.equal(again.pins.length, MAX_PINS);
  assert.equal(again.addPin(0, 0).ok, false);
  console.log('PASS map points are named, saved with the world, removed, and capped');
}

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
assert.ok(/bedPart\(aimed\.block\)\) return void this\.sleep\(aimed\)/.test(game) && /this\.dayCycle\.time = s\.target/.test(game) && /target: MORNING/.test(game), 'Place on a bed sleeps to morning (PLAY-8: over ten seconds, see sleep-play8)');
assert.ok(/id="map-coords"/.test(ui) && /You are at \$\{Math\.floor\(at\.x\)\}/.test(ui), 'the map says where you stand');
console.log('PASS a bed sleeps the night through; the map shows your coordinates');

// IMP-7 (owner, 15 November): in the Past and the Future the map is the land there, read off its blocks.
{
  const { sampleWorldGrid } = await import('../src/render/mapDraw.js');
  const world = { hasChunk: (cx) => cx >= 0, surfaceHeight: () => 5, getBlock: (x, y) => (y === 5 ? 3 : 0) };
  const { cells } = sampleWorldGrid(world, (id) => (id === 3 ? '#stone' : null), 0, 0, { radius: 32, step: 16 });
  assert.ok(cells.includes('#stone') && cells.includes('#1d1a22'), 'loaded columns show their top block; the rest stays dark');
  console.log('PASS the map in the Past and the Future is read off the loaded blocks');
}
