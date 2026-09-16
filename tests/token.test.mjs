import { createClient } from '@neondatabase/neon-js';
import { readFileSync } from 'node:fs';

/**
 * The name of the one call that decided whether cloud sync worked at all —
 * and, in the end, the discovery that no single method name was ever going
 * to be enough.
 *
 * Three things were tried here in turn. `getToken()` and `getJWTToken()` are
 * both invented names — neither appears in Neon's SDK, its route table, or
 * its docs — and both "worked" locally anyway, because Better Auth's client
 * is a Proxy that turns *any* property access into a call on the matching
 * route: `typeof` reports "function" for a name the server has never heard
 * of, and a test that stubs the network to answer whatever route the SDK
 * asks for cannot tell that apart from the real thing. `getToken()` reaches
 * `/auth/get-token`; `getJWTToken()` reaches `/auth/get-jwt-token`. Neither
 * exists on the real, deployed service.
 *
 * The real, documented method is `auth.token()` — confirmed against Neon's
 * docs (docs/auth/guides/plugins/jwt.md) and the SDK's own source
 * (`jwtClient()` is a real entry in the adapter's plugin list, wired to a
 * real route: `token: "/token"`). That part is true. It is also not safe to
 * call the way this app needs to: once `getSession()` has run even once,
 * which it always has by the time a token is needed, this SDK version's own
 * client-side session cache intercepts `auth.token()` before it reaches the
 * network and hands back the cached *session* response instead — no error,
 * no request, and no `.token` field where a JWT would be. See
 * tests/accesstoken.test.mjs for that confirmed directly against the
 * installed SDK, calling `getSession()` then `token()` with nothing else
 * running and the second call never touching the network.
 *
 * So the code calls none of these three. It reads the JWT off the
 * `set-auth-jwt` header Managed Better Auth attaches to a real session
 * check — checked here as what request is actually made, not the shape of
 * the source, which is the one kind of check every earlier name would have
 * failed.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const BASE = 'https://ep-test-abc.c-2.us-east-2.aws.neon.tech/neondb';

/** Which URL a call on the auth client tries to reach, without letting it out. */
async function urlFor(method) {
  const tried = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => { tried.push(String(u?.url ?? u)); throw new Error('blocked'); };
  try {
    const client = createClient(BASE);
    try { await client.auth[method](); } catch { /* the block, or whatever the route would answer */ }
  } finally {
    globalThis.fetch = real;
  }
  return tried[0] ?? null;
}

const auth = readFileSync(new URL('../src/net/CloudAuth.js', import.meta.url), 'utf8');
const code = auth.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// --- the source calls none of the three retired approaches --------------------

ok('the source never calls auth.token()', !/auth\.token\(\)/.test(code));
ok('nor either of the two invented names', !/auth\.getJWTToken\(\)|auth\.getToken\(\)/.test(code));
ok('the JWT is read off the session-check header instead', /set-auth-jwt/.test(code));
ok('via a real session check, not a fabricated route', /client\.auth\.getSession\(/.test(code));

// --- all three retired names are still callable — and still wrong -------------
//
// Kept as a live demonstration of the actual hazard: none of these three
// throws at the call site, or fails a type check, or looks different from a
// working call in any way code review could catch.

{
  const real = await urlFor('token');
  ok(`auth.token() reaches ${real?.split('/auth')[1]}`, /\/auth\/token$/.test(real ?? ''));

  const jwt = await urlFor('getJWTToken');
  const plain = await urlFor('getToken');
  ok(`getJWTToken reaches ${jwt?.split('/auth')[1]} — not the route this app relies on`, jwt !== real);
  ok(`getToken reaches ${plain?.split('/auth')[1]} — not it either`, plain !== real);
  ok('all three are genuinely different routes, not aliases',
    new Set([real, jwt, plain]).size === 3);
}

// --- and the URLs the game derives are the ones the SDK derives ---------------

// Our cloudConfig works these out itself rather than importing the SDK, so the
// two derivations have to agree or every request goes somewhere real-looking
// and wrong.
{
  const { deriveUrls } = await import('../src/net/cloudConfig.js');
  const ours = deriveUrls(BASE);
  const theirs = await urlFor('getSession');
  ok(`we derive the auth host as ${new URL(ours.auth).host}`,
    theirs.startsWith(ours.auth));
  ok('and the data API as the apirest subdomain',
    /\.apirest\./.test(ours.dataApi) && ours.dataApi.endsWith('/rest/v1'));
}

// --- what a signed-in player is told when it still fails ----------------------
//
// These used to assert that every line ended "your worlds are safe on this
// device" and that the internal hostname was printed. Both were right when the
// game kept a local copy; both became wrong the day worlds moved onto the
// account, and the suite went on enforcing them — which is how a promise that
// nothing had been lost locally survived the deletion of everything local.
// Read the real strings now rather than the shape of the source.
{
  const { readableTokenError } = await import('../src/net/CloudAuth.js');
  const lines = [undefined, 401, 403, 404, 500, 503].map((s) => readableTokenError({ status: s }));
  ok('nothing tells a player their worlds are on this device',
    lines.every((l) => !/on this device/i.test(l)));
  ok('no line shows them a machine name they cannot act on',
    lines.every((l) => !/neon\.tech|neonauth|\bep-/i.test(l)));
  ok('a 404 says the service does not recognise the app',
    /does not recognise/i.test(readableTokenError({ status: 404 })));
  ok('an expired session says to sign in again',
    /sign in again/i.test(readableTokenError({ status: 401 })));
  ok('and the unreachable case says where the worlds actually are',
    /on the account/i.test(readableTokenError({})));
}

process.exit(f ? 1 : 0);
