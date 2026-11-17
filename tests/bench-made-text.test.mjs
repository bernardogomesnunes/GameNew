import assert from 'node:assert/strict';
import { test } from 'node:test';
import { madeText } from '../src/render/BenchMachine.js';

test('bench message pluralises a batch of more than one', () => {
  assert.equal(madeText({ id: 'wall_cobble', count: 6 }), 'Made 6 cobblestone walls.');
  assert.equal(madeText({ id: 'planks', count: 6 }), 'Made 6 oak planks.');
  assert.match(madeText({ id: 'wall_cobble', count: 1 }), /^Made 1 cobblestone wall\.$/);
});
