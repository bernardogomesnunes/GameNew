import { createClient } from '@neondatabase/neon-js';
import { readFileSync } from 'node:fs';

/**
 * The one method name that decided whether cloud sync worked at all.
 *
 * Better Auth builds its client by proxy: any method you name becomes a call
 * to the matching route. So `client.auth.getToken()` type-checks, runs, and
 * asks for `/auth/get-token` — which Neon's managed Better Auth does not
 * serve. Every request answered 404.
 *
 * The effect was invisible in the obvious place and total everywhere else:
 * signing in worked, the account showed the right email, and then every single
 * upload failed on the token. Cloud sync had never once worked for a
 * signed-in player, on any device, which is why one account showed different
 * worlds on a phone and a desktop.
 *
 * A name that is wrong but still callable cannot be caught by reading the
 * code, so this asks the SDK which URL each name actually reaches.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const BASE = 'https://ep-test-abc.c-2.us-east-2.aws.neon.tech/neondb';

/** Which URL a call on the auth client tries to reach, without letting it. */
async function urlFor(method) {
  const tried = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => { tried.push(String(u?.url ?? u)); throw new Error('blocked'); };
  try {
    const client = createClient(BASE);
    try { await client.auth[method](); } catch { /* the block, or the 404 it would be */ }
  } finally {
    globalThis.fetch = real;
  }
  return tried[0] ?? null;
}

const auth = readFileSync(new URL('../src/net/CloudAuth.js', import.meta.url), 'utf8');

// --- the route the game asks for ---------------------------------------------

ok('the game asks for the JWT by the name the SDK uses',
  /auth\.getJWTToken\b/.test(auth));
ok('and does not call the one that 404s as its first choice',
  !/this\.client\.auth\.getToken\(\)/.test(auth));

{
  const jwt = await urlFor('getJWTToken');
  const plain = await urlFor('getToken');
  ok(`getJWTToken reaches ${jwt?.split('/auth')[1]}`, /\/auth\/get-jwt-token$/.test(jwt ?? ''));
  ok(`getToken reaches ${plain?.split('/auth')[1]} — the route that is not there`,
    /\/auth\/get-token$/.test(plain ?? ''));
  ok('so they are genuinely different endpoints, not aliases', jwt !== plain);
}

// --- and the URLs the game derives are the ones the SDK derives ---------------

// Our cloudConfig works these out itself rather than importing the SDK, so the
// two derivations have to agree or every request goes somewhere real-looking
// and wrong.
{
  const { deriveUrls } = await import('../src/net/cloudConfig.js');
  const ours = deriveUrls(BASE);
  const theirs = await urlFor('getJWTToken');
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
