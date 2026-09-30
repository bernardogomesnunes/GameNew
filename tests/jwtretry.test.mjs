import { readFileSync } from 'node:fs';

/**
 * Reported directly: a screenshot of the worlds screen wallpapered in
 * "Not saved to your account yet — Cloud request failed (400). {"message":
 * "JWT token has expired (exp=1790759639)" ..." toasts, one per autosave,
 * for as long as the tab stayed open.
 *
 * Two things were wrong, both upstream of the toast itself:
 *
 * 1. The Data API's own JWT plugin answers an expired token with a 400, not
 *    the 401/403 describeError already knew to translate — so the raw
 *    PostgREST JSON went straight on screen instead of a readable sentence.
 * 2. accessToken()'s own 13-minute refresh margin (see CloudAuth.js) assumes
 *    asking for the session again always reaches the network. It does not:
 *    the huge comment on checkSession already documents that a `getSession`
 *    call can resolve from the SDK's own local cache with no request and no
 *    fresh header, leaving `this.jwt` exactly as stale as it was. Once that
 *    happens the same dead token is handed back forever — every save fails
 *    the same way, every failure fires the toast again, and nothing short of
 *    reloading the tab ever recovers, which is exactly what the screenshot
 *    shows.
 *
 * The fix has three parts, tested here: `checkSession`'s deliberate refresh
 * now forces a real round trip (`disableCookieCache`, Better Auth's own
 * documented escape from that same cache — see accesstoken.test.mjs);
 * NeonTransport recognises the 400-shaped rejection and gets exactly one
 * retry with a token forced fresh past `invalidateToken()`, so a token that
 * looked fine by the client's own clock but wasn't gets one clean second
 * chance before the player ever sees anything; and if that retry also fails,
 * the message on screen reads like the 401 case always did, not raw JSON.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const { NeonTransport } = await import('../src/net/NeonTransport.js');

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const EXPIRED_BODY = { message: 'JWT token has expired (exp=1790759639)', code: null, detail: null, hint: null };

function expiredResponse() {
  return new Response(JSON.stringify(EXPIRED_BODY), { status: 400, headers: { 'content-type': 'application/json' } });
}
function okResponse(body) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

// --- a token the client's clock still trusted, but the server didn't, gets
//     exactly one clean retry with a freshly forced token ---------------------
{
  const seen = [];
  let invalidated = 0;
  const auth = {
    async accessToken() { return invalidated ? 'fresh-token' : 'stale-token'; },
    invalidateToken() { invalidated++; },
  };
  globalThis.fetch = async (input, init) => {
    const token = (init.headers.Authorization || '').replace('Bearer ', '');
    seen.push(token);
    if (token === 'stale-token') return expiredResponse();
    return okResponse([{ id: 'player-1' }]);
  };

  const transport = new NeonTransport(auth, { baseUrl: 'https://fake.local/rest/v1' });
  const rows = await transport.request('/players?select=id&limit=1');

  ok('the first attempt used the token the client still trusted', seen[0] === 'stale-token');
  ok('invalidateToken was called exactly once, not on every retry', invalidated === 1);
  ok('the retry used a genuinely different, forced-fresh token', seen[1] === 'fresh-token');
  ok('and it recovered without the caller ever seeing an error', rows?.[0]?.id === 'player-1');
}

// --- a real sign-out still ends the same way it always did — one retry, then
//     a readable error, never a loop -------------------------------------------
{
  let invalidated = 0;
  let calls = 0;
  const auth = {
    // A real sign-out: the session check itself keeps succeeding, so each
    // refresh hands back a genuinely different token — just one that is
    // equally doomed, the way a signed-out-server-side session would be.
    async accessToken() { return `always-stale-${invalidated}`; },
    invalidateToken() { invalidated++; },
  };
  globalThis.fetch = async () => { calls++; return expiredResponse(); };

  const transport = new NeonTransport(auth, { baseUrl: 'https://fake.local/rest/v1' });
  const err = await transport.request('/players?select=id&limit=1').then(() => null, (e) => e);

  ok('invalidateToken is only ever tried once, not looped', invalidated === 1);
  ok(`the retry itself is a single request, not keepTrying's four: ${calls}`, calls === 2);
  ok(`the player sees the readable sentence, not raw PostgREST JSON: ${err?.message}`,
    /sign in again/i.test(err?.message ?? '') && !/exp=/.test(err?.message ?? ''));
}

// --- an auth object with no invalidateToken (the shape every other test in
//     this suite already uses) degrades to exactly today's behaviour ----------
{
  const auth = { async accessToken() { return 'test-token'; } };
  globalThis.fetch = async () => expiredResponse();

  const transport = new NeonTransport(auth, { baseUrl: 'https://fake.local/rest/v1' });
  const err = await transport.request('/players?select=id&limit=1').then(() => null, (e) => e);

  ok('still resolves to the readable sentence even without a retry path',
    /sign in again/i.test(err?.message ?? ''));
}

// --- the 400 case is told apart from an ordinary bad request ------------------
{
  const auth = { async accessToken() { return 'test-token'; } };
  globalThis.fetch = async () => new Response(
    JSON.stringify({ code: '23502', message: 'null value in column "size_x" violates not-null constraint' }),
    { status: 400, headers: { 'content-type': 'application/json' } },
  );

  const transport = new NeonTransport(auth, { baseUrl: 'https://fake.local/rest/v1' });
  const err = await transport.request('/worlds', { method: 'POST', body: [{}] }).then(() => null, (e) => e);

  ok(`an unrelated 400 keeps its own message, not the sign-in-again one: ${err?.message}`,
    /size_x/.test(err?.message ?? '') && !/sign in again/i.test(err?.message ?? ''));
}

// --- the identical-toast pile-up the screenshot actually showed ---------------
{
  const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
  ok('a toast carries a key so a repeat of the same message can be found',
    /const key = `\$\{kind\}\|\$\{title\}\|\$\{body \?\? ''\}`;/.test(ui));
  ok('and an existing toast with that same key is dismissed rather than left to pile up alongside the new one',
    /const dupe = \[\.\.\.stack\.children\]\.find\(\(n\) => n\.dataset\.toastKey === key\);\s*\n\s*if \(dupe\) this\.dismissToast\(dupe\);/.test(ui));
}

process.exit(f ? 1 : 0);
