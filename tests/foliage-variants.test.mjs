import assert from 'node:assert/strict';
import { BLOCKS } from '../src/config/blocks.js';
import { ITEM_FOR_BLOCK } from '../src/config/items.js';
import { LEAVES, leafHeld } from '../src/world/leafDecay.js';
import { tileFor } from '../src/render/BlockTextures.js';

const white = BLOCKS.find(b => b.name === 'White Leaves');
const pink = BLOCKS.find(b => b.name === 'Pink Leaves');
assert.ok(pink, 'pink foliage has its own block');
assert.equal(white.id, 42, 'existing white block keeps its saved ID');
const channels = c => [16, 8, 0].map(s => (c >> s) & 255);
assert.ok(Math.max(...channels(white.color)) - Math.min(...channels(white.color)) < 20, 'white foliage is neutral');
assert.ok(channels(pink.color)[0] - channels(pink.color)[1] > 30, 'pink is visibly pink');
assert.equal(ITEM_FOR_BLOCK.get(pink.id), 'pink_leaves');
for (const b of [white, pink]) {
  assert.ok(LEAVES.has(b.id));
  const tile = tileFor(b.id);
  assert.ok(tile.some((v,i) => i % 4 === 3 && v === 0), 'foliage has transparent holes');
}
const cells = new Map([['0,0,0', pink.id], ['1,0,0', white.id], ['2,0,0', 41]]);
assert.ok(leafHeld({getBlock: (x,y,z) => cells.get(`${x},${y},${z}`) ?? 0}, 0,0,0));
cells.delete('2,0,0');
assert.ok(!leafHeld({getBlock: (x,y,z) => cells.get(`${x},${y},${z}`) ?? 0}, 0,0,0));
console.log('PASS white and pink foliage remain distinct, gatherable and connected to trunks');
