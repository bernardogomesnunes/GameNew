// PLAY-1: iPhone browsers drop a sign-in cookie set by Neon's domain, a third
// party to the game. On a deployed page sign-in goes through /neonauth on the
// game's own address; if that cookie is not kept, the game goes back to Neon.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { authUrl, AUTH_PATH, AUTH_DIRECT_KEY, deriveUrls } = await import('../src/net/cloudConfig.js');
const { CloudAuth } = await import('../src/net/CloudAuth.js');
const NEON = 'https://ep-quiet-firefly-ae3s1zgl.c-2.us-east-2.aws.neon.tech/neondb';
const page = { protocol: 'https:', origin: 'https://duild-seven.vercel.app' };

test('a deployed page signs in through its own address', () => {
  store.clear();
  assert.equal(authUrl(page, NEON), 'https://duild-seven.vercel.app/neonauth');
});

test('no page (tests, Node) and a chosen direct route go straight to Neon', () => {
  store.clear();
  assert.equal(authUrl(undefined, NEON), deriveUrls(NEON).auth);
  store.set(AUTH_DIRECT_KEY, '1');
  assert.equal(authUrl(page, NEON), deriveUrls(NEON).auth);
});

test('vercel.json passes /neonauth on to the production auth service', () => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const rule = cfg.rewrites.find((r) => r.source.startsWith(AUTH_PATH));
  assert.equal(rule.destination, `${deriveUrls(NEON).auth}/:path*`);
});

test('a sign-in whose cookie is not kept switches to Neon directly and signs in again', async () => {
  store.clear();
  const auth = new CloudAuth(null);
  Object.defineProperty(auth, 'configured', { value: true });
  const tries = [];
  auth.load = async function () {
    if (this.client) return this.client;
    const direct = store.get(AUTH_DIRECT_KEY) === '1';
    this.viaSite = !direct;
    this.client = { auth: { signIn: { email: async () => { tries.push(direct ? 'direct' : 'site'); return { data: { user: { id: 'a', email: 'x@y' } } }; } } } };
    return this.client;
  };
  auth.sessionKept = async function () { return !this.viaSite; };
  const user = await auth.signIn('x@y', 'longenough1');
  assert.equal(user.id, 'a');
  assert.deepEqual(tries, ['site', 'direct']);
  assert.equal(store.get(AUTH_DIRECT_KEY), '1', 'remembered on this device');
});

test('a kept cookie stays on the page\'s own address', async () => {
  store.clear();
  const auth = new CloudAuth(null);
  Object.defineProperty(auth, 'configured', { value: true });
  auth.viaSite = true;
  auth.client = { auth: { signIn: { email: async () => ({ data: { user: { id: 'a' } } }) } } };
  auth.load = async function () { return this.client; };
  auth.sessionKept = async () => true;
  await auth.signIn('x@y', 'longenough1');
  assert.equal(store.get(AUTH_DIRECT_KEY), undefined);
});
