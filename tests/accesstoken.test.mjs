/**
 * The token call, driven exactly as the game drives it — against a stand-in
 * server that only answers the routes that are real.
 *
 * This file has been wrong three times now, and the fixes are worth keeping
 * straight because each one hid the next:
 *
 * 1. Called `.bind()` on the auth client. `auth` is a Proxy that turns *any*
 *    property access into an HTTP call, `.bind` included, so this fired its
 *    own request and returned a Promise — and calling that Promise crashed
 *    with a TypeError that carried no HTTP status, which the code then read
 *    as "the network is down." It was never down.
 * 2. Called it by an invented name, `getJWTToken`, that appears nowhere in
 *    Neon's SDK, source, or docs. It still "worked" locally, because the
 *    proxy manufactures a callable for *any* name and every test here
 *    stubbed the network to answer whatever route the SDK happened to ask
 *    for — which cannot tell "reaches the real route" apart from "reaches a
 *    route this test invented and is now testing against itself." The real,
 *    deployed server 404s that route, which is what finally showed up on a
 *    real device.
 * 3. Switched to the real, documented method, `auth.token()` — and *that*
 *    also silently fails to produce a token, for a reason no route-name
 *    check could ever catch: called after `getSession()` has already run
 *    once, which it always has by the time this matters (`restore()` runs it
 *    at boot), this SDK version's own client-side session cache intercepts
 *    `auth.token()` before it reaches the network and hands back the cached
 *    *session* response instead — no error, no request, and no `.token`
 *    field where a JWT would be. Confirmed directly against the installed
 *    SDK: `getSession()` then `token()`, nothing else running, and the
 *    second call never touches the network.
 *
 * So the JWT is not fetched by calling a dedicated method at all. It is read
 * off the `set-auth-jwt` header Managed Better Auth attaches to a real
 * session check — the alternative the SDK's own docs describe for exactly
 * this situation — and cached here for its known lifetime.
 *
 * Two related scenarios live in their own files rather than here:
 * accesstoken-sessionfail.test.mjs and accesstoken-noheader.test.mjs. The
 * reason is the same session cache described above: it is a single global
 * inside the SDK, not keyed by host or client instance, and it survives for
 * the whole Node process rather than per `createClient()` call. Once one
 * scenario in a file gets a real, successful, header-bearing session
 * response, every `getSession()` call after it — on any client, any host,
 * for the rest of that process — is answered from that cached response
 * instead of reaching the network, regardless of what a later block's own
 * mock says. Each scenario that needs a *different* shape of session
 * response gets its own file so it gets its own fresh process and an empty
 * cache; `tests/run.mjs` already spawns one process per file.
 */
import { CloudAuth } from '../src/net/CloudAuth.js';
import { isOurBug, worthRetrying } from '../src/net/retry.js';
import { createClient } from '@neondatabase/neon-js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const BASE = 'https://ep-test-abc.c-2.us-east-2.aws.neon.tech/neondb';

/**
 * A CloudAuth wired to a real SDK client and a fake network shaped like the
 * real service: `/get-session` answers 200 with a `set-auth-jwt` header,
 * exactly as Managed Better Auth's docs say it does on every session check.
 * `/token` is deliberately never stubbed to answer correctly, standing in
 * for the cache-serving behaviour this file exists to route around — a
 * regression back to calling it fails here with a real, informative error
 * rather than a route name quietly matching.
 *
 * This is the only successful session response created in this file, and
 * every block below shares this one `auth` instance rather than making a
 * fresh `createClient()` call — see the file header for why a second one
 * would not be testing anything real.
 */
function signedIn(jwt = 'header.payload.sig') {
  const auth = new CloudAuth(null);
  auth.client = createClient(BASE);
  auth.user = { id: 'u1', email: 'someone@example.com', name: 'Someone' };
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const path = req.url.split('/auth')[1] ?? req.url;
    calls.push(path);
    if (path.startsWith('/get-session')) {
      return new Response(JSON.stringify({ user: auth.user, session: { id: 's1', token: 'opaque-session-id' } }),
        { status: 200, headers: { 'content-type': 'application/json', 'set-auth-jwt': jwt } });
    }
    return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  };
  return { auth, calls, restore: () => { globalThis.fetch = real; } };
}

const { auth, calls, restore } = signedIn();

// --- asking for a token reaches the session check, not a dedicated route ------
{
  let token = null, threw = null;
  try { token = await auth.accessToken(); } catch (err) { threw = err; }

  ok(`asking for a token returns the one from the header: ${token}`, token === 'header.payload.sig');
  ok('and it did not throw', threw === null);
  ok(`it asked for the session, not a dedicated token route: ${calls[0]}`, calls[0] === '/get-session');
  ok('never touching /token at all', !calls.some((c) => c.startsWith('/token')));
}

// --- a second ask within the token's lifetime costs nothing -------------------
{
  const before = calls.length;
  const second = await auth.accessToken();
  ok('the second ask returns the same token', second === 'header.payload.sig');
  ok('without asking the network again', calls.length === before);
}

// --- and .token() is never called on the way there, on purpose ----------------
{
  const src = await (await import('node:fs/promises')).readFile(
    new URL('../src/net/CloudAuth.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok('accessToken never calls auth.token()', !/auth\.token\(\)/.test(code));
  ok('the JWT is read off the set-auth-jwt header instead', /set-auth-jwt/.test(code));
}

// --- signing out never lets a stale token answer for the next account ---------
{
  ok('the token is cached going in', auth.jwt === 'header.payload.sig');
  await auth.signOut().catch(() => {});
  ok('signing out clears it', auth.jwt === null);
}

restore();

// --- both retired method names still exist as a documented hazard, not as
//     something this file relies on --------------------------------------------
{
  const real = globalThis.fetch;
  let hit = null;
  globalThis.fetch = async (input) => {
    hit = (input instanceof Request ? input.url : String(input)).split('/auth')[1];
    return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  };
  // A host of its own even for this: these calls never touch getSession, but
  // there is no reason to risk it either.
  const client = createClient('https://ep-test-retired.c-2.us-east-2.aws.neon.tech/neondb');
  for (const name of ['getJWTToken', 'getToken']) {
    let threw = null;
    try { await client.auth[name](); } catch (err) { threw = err; }
    ok(`${name}() reaches ${hit} and 404s, same as the real service`,
      threw?.status === 404 || threw?.name === 'AuthApiError');
  }
  globalThis.fetch = real;
}

// --- the .bind trap, kept as a live regression test ----------------------------
//
// `auth` is a Proxy, and `.bind` on it is not Function.prototype.bind — it is
// not specially handled at all, it is just another property read, answered
// the same way any unknown name is: with another callable Proxy standing in
// for a route that does not exist (`/auth/token/bind`). Calling *that* is
// what returns a pending Promise rather than running `Function.prototype.bind`
// the way the syntax `X.bind(Y)` looks like it should.
//
// Proved against a small stand-in rather than the real SDK client: doing this
// to the genuine, live client leaves its shared, process-lifetime request
// bookkeeping holding an operation that was never meant to work, which goes
// on to fire an extra, malformed request of its own at an unpredictable later
// point. The stand-in below reproduces the exact three observable facts,
// measured once against the real client in isolation, with nothing to leak.
{
  const routeProxy = (path) => new Proxy(
    () => Promise.resolve({ data: { path }, error: null }),
    {
      get(target, prop) {
        if (typeof prop === 'symbol' || prop === 'name' || prop === 'length') return target[prop];
        return routeProxy(`${path}.${String(prop)}`);
      },
    },
  );
  const fakeAuth = routeProxy('auth');
  const bound = fakeAuth.token.bind(fakeAuth);

  ok('binding a method off a Better-Auth-shaped proxy does not give you a function',
    typeof bound !== 'function');
  ok('it gives you a Promise', bound instanceof Promise);
  let caught = null;
  try { await bound(); } catch (err) { caught = err; }
  ok(`and calling it throws: ${caught?.message}`, caught instanceof TypeError);
}

// --- such an error, if it ever recurs, is called what it is --------------------
{
  const ourBug = new TypeError('e is not a function. (In \'e()\', \'e\' is an instance of Promise)');
  ok('a TypeError from our own code is recognised as ours', isOurBug(ourBug));
  ok('and is not retried four times on the way to being wrong', !worthRetrying(ourBug));

  for (const m of ['Load failed', 'Failed to fetch', 'NetworkError when attempting to fetch resource']) {
    const network = new TypeError(m);
    ok(`"${m}" is still read as the network`, !isOurBug(network) && worthRetrying(network));
  }

  const server = Object.assign(new Error('Service Unavailable'), { status: 503 });
  ok('and a real 503 is still retried', !isOurBug(server) && worthRetrying(server));
}

// --- signed out asks nothing ----------------------------------------------------
{
  const fresh = new CloudAuth(null);
  ok('no client means no token and no request', (await fresh.accessToken()) === null);
}

process.exit(f ? 1 : 0);
