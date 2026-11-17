// CRAFT3D-1, Task 1: a piece's parts come from its own shape's boxes.
import assert from 'node:assert/strict';
import { FURNITURE, partsFor, isPatterned } from '../src/config/furnitureParts.js';

// CRAFT-9: matching parts are one; the 4 legs fit with one tap, lowest first.
assert.deepEqual(partsFor('table_oak').map((p) => [p.name, p.count]), [['leg', 4], ['top', 1]]);
console.log('PASS a table is its 4 legs (one part) and a top');

assert.equal(FURNITURE.length, 25);
for (const id of FURNITURE) {
  const parts = partsFor(id);
  assert.ok(parts.length >= 1 && parts.length <= 4, `${id}: ${parts.length} parts`);
  for (const { box } of parts) {
    assert.ok(box.minX >= 0 && box.maxX <= 1, `${id} x`);
    assert.ok(box.minY >= 0 && box.maxY <= 2, `${id} y`);
    assert.ok(box.minZ >= 0 && box.maxZ <= (id === 'bed' ? 2 : 1), `${id} z`);
    assert.ok(box.maxX > box.minX && box.maxY > box.minY && box.maxZ > box.minZ, `${id} has size`);
  }
}
console.log('PASS every piece has 1 to 4 parts, inside its cells');

assert.equal(isPatterned('panel_pattern_dark'), true);
assert.equal(isPatterned('table_oak'), false);
console.log('PASS patterned panels are carved');
