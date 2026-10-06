import assert from 'node:assert/strict';
import test from 'node:test';
import { NeonTransport } from '../src/net/NeonTransport.js';
import { worthRetrying } from '../src/net/retry.js';

const transportWith = (status, body) => {
  const t = new NeonTransport({ accessToken: async () => 'tok' }, { baseUrl: 'http://x/rest/v1' });
  globalThis.fetch = async () => ({ ok: false, status, text: async () => body });
  return t;
};

await test('world cap is a plain message and is not retried', async () => {
  const t = transportWith(400, '{"code":"23514","message":"World limit reached (30 per account)"}');
  let calls = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async (...a) => { calls++; return real(...a); };
  await assert.rejects(() => t.request('/worlds', { method: 'POST', body: [] }), /most worlds an account can keep/);
  assert.equal(calls, 1);
});

await test('a size limit is a plain message and is not retried', async () => {
  const t = transportWith(400, '{"code":"23514","message":"new row for relation \\"world_chunks\\" violates check constraint \\"world_chunks_rle_size\\""}');
  await assert.rejects(() => t.request('/world_chunks', { method: 'POST', body: [] }), /too large to sync/);
  assert.equal(worthRetrying({ status: 400 }), false);
});
