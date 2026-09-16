/**
 * A genuinely failed session check — expired or signed-out.
 *
 * In its own file and process, and the only `getSession()` call this process
 * ever makes: Better Auth's session cache is a single global inside the SDK,
 * not keyed by host, and it survives for the whole process once anything
 * populates it with a valid response. A real success living anywhere else in
 * this process would answer this file's own mocked 401 from that stale cache
 * instead. See accesstoken.test.mjs's file header for the full story.
 */
import { CloudAuth } from '../src/net/CloudAuth.js';
import { createClient } from '@neondatabase/neon-js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const auth = new CloudAuth(null);
auth.client = createClient('https://ep-test-fail.c-2.us-east-2.aws.neon.tech/neondb');
auth.user = { id: 'u1', email: 'someone@example.com', name: 'Someone' };

const calls = [];
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  calls.push(req.url.split('/auth')[1] ?? req.url);
  return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
};

const err = await auth.accessToken().then(() => null, (e) => e);

ok('is not retried into something slower', calls.length === 1);
ok(`it says the session expired: ${err?.message}`, /sign in again/i.test(err?.message ?? ''));
ok(`and the detail names the real call: ${err?.detail}`, /\/auth\/get-session/.test(err?.detail ?? ''));

process.exit(f ? 1 : 0);
