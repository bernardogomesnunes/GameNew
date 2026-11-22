import assert from 'node:assert/strict';
import { STRUCTURES_BY_ID, producesAt, intervalAt } from '../src/config/structures.js';
import { STARTER_DESIGNS } from '../src/config/starterDesigns.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { World } from '../src/world/World.js';
import { validateStructure } from '../src/structures/validate.js';
import { BLOCKS_BY_ID, TOOL_RACK, MASONS_BENCH, STONE_MILL } from '../src/config/blocks.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';

// PLAY-7: the quarry gives more stone and every coloured stone, and looks man-made.
const quarry = STRUCTURES_BY_ID.get('quarry');
const perDay = (tier, id) => (producesAt(quarry, tier)[id] ?? 0) * 86400 / intervalAt(quarry, tier);

const l1 = perDay(0, 'stone');
assert.ok(l1 >= 10 && l1 <= 15, `level 1 stone ${l1}/day`);
assert.ok(l1 > 12, 'more than the old 12 a day');
for (let t = 0; t < quarry.tiers.length; t++) assert.ok(perDay(t, 'stone') <= 15, `level ${t + 1} within 15 a day`);

const colours = [...ITEMS_BY_ID.keys()].filter((id) => id.startsWith('stone_') && ITEMS_BY_ID.get(id).kind === 'raw');
assert.deepEqual(colours.sort(), ['stone_grey', 'stone_orange', 'stone_turquoise', 'stone_white']);
for (let t = 0; t < quarry.tiers.length; t++) {
  for (const c of colours) {
    const d = perDay(t, c);
    assert.ok(d > 0 && d <= 15, `${c} at level ${t + 1}: ${d}/day`);
  }
}
console.log('PASS stone', l1.toFixed(1), 'a day at level 1; white, grey, orange and turquoise at every level');

// Level 1 look: the starter design has a hut with a tool rack, a chest and a plank roof.
const design = STARTER_DESIGNS.find((d) => d.structure === 'quarry');
const types = design.blocks.map((b) => b.type);
assert.ok(types.includes(TOOL_RACK), 'tool rack in the hut');
assert.ok(types.filter((t) => t === 7).length >= 20, 'plank roof and wall');
assert.ok(types.filter((t) => t === 4).length >= 4, 'timber posts');
assert.ok(PROP_SHAPES[BLOCKS_BY_ID.get(TOOL_RACK).shape].length >= 8, 'tool rack has a pickaxe, shovel and hammer shape');
const world = new World({ sizeX: 48, sizeZ: 48, height: 32 });
for (const b of design.blocks) world.setBlock(10 + b.dx, 3 + b.dy, 10 + b.dz, b.type);
const ext = design.blocks.reduce((e, b) => ({ x: Math.max(e.x, b.dx), y: Math.max(e.y, b.dy), z: Math.max(e.z, b.dz) }), { x: 0, y: 0, z: 0 });
const result = validateStructure(world, { minX: 10, maxX: 10 + ext.x, minY: 3, maxY: 3 + ext.y, minZ: 10, maxZ: 10 + ext.z }, 'quarry');
assert.ok(result.ok, 'the hut design still passes quarry rules: ' + result.reason);
console.log('PASS level 1 hut with tool rack, chest, posts and plank roof; claim rules pass');

// Higher levels: stone machines are required, and Evolve can set them down.
const machineIds = (tier) => quarry.tiers[tier].needs.filter((n) => n.fit).flatMap((n) => n.fit);
assert.deepEqual(machineIds(0), []);
assert.ok(machineIds(2).includes('masons_bench'), 'level 3 wants a mason\'s bench');
assert.ok(machineIds(3).includes('stone_mill'), 'level 4 wants a stone mill');
assert.ok(machineIds(4).includes('stone_mill') && machineIds(4).includes('masons_bench'), 'level 5 wants both');
for (const id of ['masons_bench', 'stone_mill']) assert.ok(ITEMS_BY_ID.get(id).block, id + ' is a placeable block');
assert.equal(ITEMS_BY_ID.get('masons_bench').block, MASONS_BENCH);
assert.equal(ITEMS_BY_ID.get('stone_mill').block, STONE_MILL);
console.log('PASS levels 3 to 5 need a mason\'s bench and stone mills');
