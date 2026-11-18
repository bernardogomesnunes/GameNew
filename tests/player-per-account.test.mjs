// Owner, 18 November: a second account on the same phone could not get its
// player row (device_key is unique, and the first account held it), so its
// worlds screen failed with "That world changed elsewhere".
import assert from 'node:assert/strict';
import { test } from 'node:test';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { NeonTransport } = await import('../src/net/NeonTransport.js');

test('each account on one device gets its own player row, with its own device key', async () => {
  let me = { id: 'a', email: 'a@x' };
  const rows = []; // what the database holds, as RLS would show it to `me`
  const t = new NeonTransport({ summary: () => me }, { baseUrl: 'https://data.test' });
  t.request = async (path, opts) => {
    if (!opts) return rows.filter((r) => r.auth_user_id === me.id).map(({ id }) => ({ id }));
    const [body] = opts.body;
    if (rows.some((r) => r.device_key === body.device_key)) throw Object.assign(new Error('duplicate'), { status: 409 });
    const row = { id: `p-${body.auth_user_id}`, ...body };
    rows.push(row);
    return [row];
  };
  assert.equal(await t.ensurePlayer(), 'p-a');
  me = { id: 'b', email: 'b@x' };
  assert.equal(await t.ensurePlayer(), 'p-b', 'the second account gets its own row, not the first one\'s id');
  assert.notEqual(rows[0].device_key, rows[1].device_key);
  me = { id: 'a', email: 'a@x' };
  assert.equal(await t.ensurePlayer(), 'p-a', 'back to the first account: its row again');
});
