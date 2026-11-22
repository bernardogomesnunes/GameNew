// PLAY-1 (owner, 22 November): saving stopped and, after signing in again,
// the worlds list was empty while all 46 worlds sat in the account. A lost
// or unanswered session check read as "signed out" and said nothing.
import assert from 'node:assert/strict';
import { test } from 'node:test';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { Game, keepFailure, sendKeptFailures } = await import('../src/Game.js');
const { CloudAuth } = await import('../src/net/CloudAuth.js');
const { rememberWorlds, lostSignIn } = Game.prototype;
const as = (auth) => ({ cloudAuth: auth, rememberWorlds, lostSignIn });

test('a remembered account with no session says the sign-in was lost', () => {
  store.clear();
  as({ user: { id: 'a' } }).rememberWorlds([{ id: 'w1' }, { id: 'w2' }]);
  const err = as({ user: null, ready: true }).lostSignIn();
  assert.match(err.message, /signed out.*2 worlds.*Nothing is lost/);
  assert.equal(err.signIn, true);
});

test('signed out on purpose (list forgotten) is no error', () => {
  store.clear();
  assert.equal(as({ user: null, ready: true }).lostSignIn(), null);
});

test('a check that could not answer says so, with the detail', () => {
  store.clear();
  const err = as({ user: null, checkError: { detail: 'TypeError /auth/get-session — no reply' } }).lostSignIn();
  assert.match(err.message, /Could not check your sign-in/);
  assert.match(err.detail, /get-session/);
});

const authWith = (answer) => {
  const auth = new CloudAuth(null);
  Object.defineProperty(auth, 'configured', { value: true });
  auth.load = async () => ({});
  auth.checkSession = answer;
  return auth;
};

test('restore: a 401 is signed out, no error', async () => {
  const auth = authWith(async () => ({ data: null, error: { status: 401 } }));
  assert.equal(await auth.restore(), null);
  assert.equal(auth.checkError, null);
});

test('restore: a network failure keeps the error, and recheck asks again', async () => {
  let calls = 0;
  const auth = authWith(async () => { calls++; if (calls === 1) throw new TypeError('Load failed'); return { data: { user: { id: 'a' } } }; });
  assert.equal(await auth.restore(), null);
  assert.ok(auth.checkError, 'kept as an error');
  assert.match(auth.checkError.detail, /get-session/);
  assert.equal((await auth.recheck())?.id, 'a');
  assert.equal(auth.checkError, null);
});

test('restore: a 500 returned in the payload is an error', async () => {
  const auth = authWith(async () => ({ data: null, error: { status: 500, message: 'down' } }));
  await auth.restore();
  assert.ok(auth.checkError);
});

test('failed saves are kept on the device, last 20, and sent later', async () => {
  store.clear();
  for (let i = 0; i < 25; i++) keepFailure('w', { status: 401, message: `m${i}` });
  const sent = [];
  const n = await sendKeptFailures({ reportFailure: async (id, e) => sent.push(e.message) });
  assert.equal(n, 20);
  assert.match(sent[0], /^\[kept .*\] m5$/);
  assert.equal(await sendKeptFailures({ reportFailure: async () => {} }), 0, 'forgotten once sent');
});
