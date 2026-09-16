/**
 * The token call, driven exactly as the game drives it.
 *
 * This is the test that was missing, and its absence is the whole story. There
 * *was* a test for the token — tests/token.test.mjs — and it passed the entire
 * time the feature was broken, because it called `client.auth.getJWTToken()`
 * directly. The game did not. The game did this:
 *
 *     const get = auth.getJWTToken.bind(auth);
 *     await get();
 *
 * and Better Auth's client is a Proxy that turns every property access into a
 * route. `.bind` is not Function.prototype.bind there: it asks the server for
 * /auth/get-jwt-token/bind, fires that request, and returns a Promise. Calling
 * a Promise throws "e is not a function" — a TypeError, with no HTTP status,
 * which this code then read as a network failure and told the player their
 * account could not be reached. It was reached fine.
 *
 * Nothing about it looks wrong: `typeof` answers "function" before the bind
 * and after it. Only calling the real method catches it, so that is what this
 * does — CloudAuth.accessToken itself, against a stubbed network.
 */
import { CloudAuth } from '../src/net/CloudAuth.js';
import { isOurBug, worthRetrying } from '../src/net/retry.js';
import { createClient } from '@neondatabase/neon-js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const BASE = 'https://ep-test-abc.c-2.us-east-2.aws.neon.tech/neondb';

/**
 * A CloudAuth wired to a real SDK client and a fake network, so the proxy is
 * the genuine article and only the wire is pretend.
 */
function signedIn(respond) {
  const auth = new CloudAuth(null);
  auth.client = createClient(BASE);
  auth.user = { id: 'u1', email: 'someone@example.com', name: 'Someone' };
  auth.ready = true;
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    calls.push(req.url.split('/auth')[1] ?? req.url);
    return respond(req);
  };
  return { auth, calls, restore: () => { globalThis.fetch = real; } };
}

const json = (status, body) => () =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// --- the thing that was broken ------------------------------------------------
{
  const { auth, calls, restore } = signedIn(json(200, { token: 'a.real.token' }));
  let token = null, threw = null;
  try { token = await auth.accessToken(); } catch (err) { threw = err; }
  restore();

  ok(`asking for a token returns one: ${token}`, token === 'a.real.token');
  ok('and it did not throw', threw === null);
  ok(`it asked for ${calls[0]}`, calls[0] === '/get-jwt-token');
  ok('and did not invent a route out of a method name',
    !calls.some((c) => /\/bind|to-upper-case|fetch-options/.test(c)));
}

// --- the exact failure, so it cannot come back -------------------------------
{
  // What the old code did, reproduced here rather than described: if `.bind`
  // ever silently becomes a route again, this is what it looks like.
  const real = globalThis.fetch;
  globalThis.fetch = json(200, { token: 'x' });
  const client = createClient(BASE);
  const bound = client.auth.getJWTToken.bind(client.auth);
  globalThis.fetch = real;

  ok('binding a method off the SDK proxy does not give you a function',
    typeof bound !== 'function');
  ok('it gives you a Promise', bound instanceof Promise);
  let caught = null;
  try { await bound(); } catch (err) { caught = err; }
  ok(`and calling it throws: ${caught?.message}`, caught instanceof TypeError);
  ok('which is the error the player was shown', /is not a function/.test(caught?.message ?? ''));
}

// --- and such an error is now called what it is ------------------------------
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

// --- a missing route still falls back, a broken one does not -----------------
{
  let seen = [];
  const { auth, calls, restore } = signedIn((req) => {
    seen.push(req.url);
    return req.url.includes('get-jwt-token')
      ? json(404, { message: 'Not Found' })()
      : json(200, { token: 'older.name.token' })();
  });
  const token = await auth.accessToken().catch(() => null);
  restore();
  ok('a 404 on the new name tries the older one', token === 'older.name.token');
  ok('in that order', calls[0] === '/get-jwt-token' && calls.some((c) => c === '/get-token'));
}

{
  const { auth, calls, restore } = signedIn(json(401, { message: 'Unauthorized' }));
  const err = await auth.accessToken().then(() => null, (e) => e);
  restore();
  ok('a 401 does not go looking for another route', calls.length === 1);
  ok(`it says the session expired: ${err?.message}`, /sign in again/i.test(err?.message ?? ''));
}

// --- signed out asks nothing -------------------------------------------------
{
  const auth = new CloudAuth(null);
  ok('no client means no token and no request', (await auth.accessToken()) === null);
}

process.exit(f ? 1 : 0);
