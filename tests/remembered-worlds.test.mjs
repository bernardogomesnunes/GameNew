// Owner, 18 November: a new account's worlds screen listed the previous
// account's worlds. The remembered list is kept with its account, and shown
// to nobody else once the session check has answered.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { Game } = await import('../src/Game.js');
const { rememberWorlds, rememberedWorlds, rememberedFor } = Game.prototype;
const as = (user, ready = true) => ({ cloudAuth: { ready, user: user ? { id: user } : null }, rememberedFor, rememberedWorlds, rememberWorlds });

test('the remembered list shows only for the account it came from', () => {
  as('a').rememberWorlds([{ id: 'w1', name: 'Castle' }]);
  assert.deepEqual(as('a').rememberedWorlds().map((r) => r.id), ['w1']);
  assert.deepEqual(as('b').rememberedWorlds(), [], 'another account sees none');
  assert.deepEqual(as(null).rememberedWorlds(), [], 'signed out sees none');
  assert.deepEqual(as(null, false).rememberedWorlds().map((r) => r.id), ['w1'], 'before the check answers: the last account on this device');
});

test('a list saved before it carried its account shows only before the check answers', () => {
  store.set([...store.keys()][0], JSON.stringify([{ id: 'old' }]));
  assert.deepEqual(as('a').rememberedWorlds(), []);
  assert.deepEqual(as(null, false).rememberedWorlds().map((r) => r.id), ['old']);
});
