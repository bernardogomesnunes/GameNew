// Owner, 27 November: the workbench faces whoever puts it down, any of 4 ways.
import assert from 'node:assert/strict';
import { WORKBENCH, WORKBENCH_TURNS, BLOCKS_BY_ID, PLACEABLE_BLOCKS, turned, turns, facingOf, stationOf } from '../src/config/blocks.js';
import { PROP_SHAPES, turn } from '../src/world/propShapes.js';

assert.ok(turns(WORKBENCH), 'the workbench turns');
assert.ok(BLOCKS_BY_ID.get(WORKBENCH).facesYou, 'it faces the one placing it');
assert.deepEqual([0, 1, 2, 3].map((f) => turned(WORKBENCH, f)), WORKBENCH_TURNS);
assert.deepEqual(WORKBENCH_TURNS.map(facingOf), [0, 1, 2, 3]);
for (const id of WORKBENCH_TURNS) {
  assert.equal(stationOf(id), 'workbench', `${id} is still a workbench station`);
  assert.equal(BLOCKS_BY_ID.get(id).shape, 'workbench');
  assert.equal(turned(id, 0), WORKBENCH);
}
assert.equal(PLACEABLE_BLOCKS.filter((b) => WORKBENCH_TURNS.includes(b.id)).map((b) => b.id).join(), String(WORKBENCH), 'only the base is in the build list');
// The drawers sit on the -z side at facing 0, so facing 2 puts them on +z.
const front = (boxes) => boxes.filter((b) => b.tone === 1.08);
assert.ok(front(PROP_SHAPES.workbench).every((b) => b.maxZ <= 0.11));
assert.ok(front(turn(PROP_SHAPES.workbench, 2)).every((b) => b.minZ >= 0.89));
console.log('PASS the workbench turns four ways and its drawers face the player');
