// ACCT-12: the Neon Auth webhook receiver verifies signatures and logs user.created.
import crypto from 'node:crypto';
import { handle, verifyWebhook, logLine, resetKeyCache } from '../api/_neon-webhook.js';
import { POST, GET, authUrlFromEnv, readDotEnv } from '../api/auth-webhook.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
const AUTH = 'https://auth.example.test/neondb/auth';
let jwksCalls = 0;
const fetchImpl = async (url) => {
  jwksCalls++;
  if (url !== AUTH + '/.well-known/jwks.json') return { ok: false, status: 404 };
  return { ok: true, status: 200, json: async () => ({ keys: [jwk] }) };
};

function sign(body, ts, key = privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWS', kid: 'k1' })).toString('base64url');
  const p = Buffer.from(`${ts}.${Buffer.from(body).toString('base64url')}`).toString('base64url');
  const sig = crypto.sign(null, Buffer.from(`${header}.${p}`), key).toString('base64url');
  return `${header}..${sig}`;
}
const NOW = 1_800_000_000_000;
const event = { event_id: 'e1', event_type: 'user.created', timestamp: '2026-11-24T00:00:00Z',
  user: { id: 'u1', email: 'Kid@Example.com', email_verified: false }, event_data: { auth_provider: 'credential', ip_address: '1.2.3.4' } };
function req(body, over = {}, method = 'POST') {
  const ts = over.ts ?? String(NOW);
  const headers = { 'x-neon-signature': over.sig ?? sign(body, ts), 'x-neon-signature-kid': 'k1', 'x-neon-timestamp': ts, 'x-neon-event-id': 'e1', ...over.headers };
  return new Request('https://x.test/api/auth-webhook', { method, headers, body: method === 'POST' ? body : undefined });
}
const lines = [];
const opts = { authUrl: AUTH, fetchImpl, now: NOW, log: (l) => lines.push(l) };
const body = JSON.stringify(event);

resetKeyCache();
let r = await handle(req(body), opts);
ok('valid signature gives 200', r.status === 200);
ok('one structured line logged', lines.length === 1 && JSON.parse(lines[0]).tag === 'neon-auth-webhook');
const L = JSON.parse(lines[0]);
ok('line has user id, provider, event id', L.user_id === 'u1' && L.provider === 'credential' && L.event_id === 'e1');
ok('line keeps the email domain only', L.email_domain === 'example.com' && !lines[0].includes('Kid@') && !lines[0].includes('1.2.3.4'));

lines.length = 0;
r = await handle(req(body, { sig: sign(body + ' ', String(NOW)) }), opts);
ok('signature of a different body gives 401', r.status === 401 && !lines.some((l) => l.includes('user_id')));
r = await handle(req(body, { sig: sign(body, String(NOW), crypto.generateKeyPairSync('ed25519').privateKey) }), opts);
ok('signature from another key gives 401', r.status === 401);
r = await handle(req(body, { ts: String(NOW - 6 * 60 * 1000) }), opts);
ok('timestamp older than 5 minutes gives 401', r.status === 401);
r = await handle(req(body, { headers: { 'x-neon-signature': '' } }), opts);
ok('missing signature gives 401', r.status === 401);
r = await handle(req(body, { headers: { 'x-neon-signature-kid': 'zzz' } }), opts);
ok('unknown key id gives 401', r.status === 401);
r = await handle(req(body), { ...opts, authUrl: '' });
ok('missing NEON_AUTH_URL gives 500 (retried, noticed)', r.status === 500);

resetKeyCache(); jwksCalls = 0;
await handle(req(body), opts); await handle(req(body), opts);
ok('key set is cached across calls', jwksCalls === 1);

lines.length = 0;
const other = JSON.stringify({ ...event, event_type: 'send.otp' });
r = await handle(req(other), opts);
ok('other events are acknowledged without a user line', r.status === 200 && !lines.some((l) => l.includes('user_id')));
r = await handle(req('', {}, 'GET'), opts);
ok('GET gives 405', r.status === 405);
r = await handle(new Request('https://x.test/', { method: 'POST', body: 'x'.repeat(70000) }), opts);
ok('oversized body gives 413', r.status === 413);
ok('route exports POST and GET', typeof POST === 'function' && (await GET()).status === 405);
ok('logLine tolerates an empty event', JSON.parse(logLine({})).tag === 'neon-auth-webhook');
let threw = false; try { await verifyWebhook(body, {}, { authUrl: AUTH, fetchImpl, now: NOW }); } catch { threw = true; }
ok('verifyWebhook throws without headers', threw);
ok('auth url prefers NEON_AUTH_URL', authUrlFromEnv({ NEON_AUTH_URL: 'https://a.test/x/auth', VITE_NEON_URL: 'https://ep-a.c-2.aws.neon.tech/neondb' }) === 'https://a.test/x/auth');
ok('auth url derives from VITE_NEON_URL', authUrlFromEnv({ VITE_NEON_URL: 'https://ep-a.c-2.aws.neon.tech/neondb/' }) === 'https://ep-a.neonauth.c-2.aws.neon.tech/neondb/auth');
ok('auth url empty when nothing is set', authUrlFromEnv({}) === '');
ok('auth url falls back to the committed .env', authUrlFromEnv({}, readDotEnv()) === 'https://ep-quiet-firefly-ae3s1zgl.neonauth.c-2.us-east-2.aws.neon.tech/neondb/auth');
ok('readDotEnv of a missing file is empty', Object.keys(readDotEnv(new URL('file:///nonexistent/.env'))).length === 0);
process.exit(f ? 1 : 0);
