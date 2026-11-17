import assert from 'node:assert/strict';
import { test } from 'node:test';
import { columnTarget, hash } from '../src/ui/groundGrow.js';

test('the ground starts low and fills every column at 100 per cent', () => {
  for (const [cols, rows] of [[39, 78], [192, 108], [12, 20]]) {
    const at = (pct) => Array.from({ length: cols }, (_, x) => columnTarget(x, cols, rows, pct));
    assert.ok(Math.max(...at(0)) < rows / 2, `${cols}x${rows} starts below half`);
    assert.deepEqual(at(100), Array(cols).fill(rows), `${cols}x${rows} full at 100`);
    for (let x = 0; x < cols; x++) assert.ok(columnTarget(x, cols, rows, 60) >= columnTarget(x, cols, rows, 30));
  }
});

test('hash is repeatable and between 0 and 1', () => {
  assert.equal(hash(3, 4), hash(3, 4));
  for (let i = 0; i < 50; i++) { const h = hash(i, i * 7); assert.ok(h >= 0 && h < 1); }
});
