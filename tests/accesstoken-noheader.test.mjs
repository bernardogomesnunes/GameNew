/**
 * A session check that succeeds but carries no `set-auth-jwt` header.
 *
 * The one legitimate way this happens is being signed out server-side while
 * the browser still holds a session cookie Better Auth is willing to answer
 * 200 to. Whatever the cause, silently returning `null` here would read
 * identically to "the account is fine, there is just nothing to sync" — the
 * exact ambiguity this whole investigation started from. It has to be an
 * error, not a quiet nothing.
 *
 * In its own file and process for the same reason as
 * accesstoken-sessionfail.test.mjs: a 200 response is exactly the shape
 * Better Auth's session cache keeps, so this is also the only `getSession()`
 * call this process makes.
 */
import { CloudAuth } from '../src/net/CloudAuth.js';
import { createClient } from '@neondatabase/neon-js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const auth = new CloudAuth(null);
auth.client = createClient('https://ep-test-noheader.c-2.us-east-2.aws.neon.tech/neondb');
auth.user = { id: 'u1', email: 'someone@example.com', name: 'Someone' };

globalThis.fetch = async () => new Response(
  JSON.stringify({ user: auth.user, session: { id: 's1', token: 'opaque-session-id' } }),
  { status: 200, headers: { 'content-type': 'application/json' } }, // no set-auth-jwt
);

const err = await auth.accessToken().then(() => null, (e) => e);

ok(`a session with no token attached is reported, not returned as null silently: ${err?.message}`,
  /sign in again/i.test(err?.message ?? ''));
ok('and jwt stays unset rather than caching an absence', auth.jwt === null);

process.exit(f ? 1 : 0);
