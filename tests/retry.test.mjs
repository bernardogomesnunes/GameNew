/**
 * Asking again while the database wakes up.
 *
 * Reported as a screenshot: "Could not reach your account", on the worlds
 * screen, signed in. Neon's own operation log for that project shows the
 * compute suspending and starting six times that day, and a start_compute at
 * 18:33:21Z taking 1540ms — the same minute as the clock in the screenshot.
 * The account was fine. The database was asleep, and the game asked once.
 */
import { keepTrying, worthRetrying, BACKOFF } from '../src/net/retry.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

/** A sleep that records how long it was asked for and returns at once. */
function fakeSleep() {
  const waits = [];
  return { waits, sleep: (ms) => { waits.push(ms); return Promise.resolve(); } };
}

const withStatus = (status) => Object.assign(new Error(`HTTP ${status}`), { status });

// --- which failures are worth asking about again ------------------------------
{
  ok('a thrown fetch — no reply at all — is worth retrying', worthRetrying(new Error('Failed to fetch')));
  ok('so is 503, which is what a waking service says', worthRetrying(withStatus(503)));
  ok('and 502, and 500', worthRetrying(withStatus(502)) && worthRetrying(withStatus(500)));
  ok('and a timeout', worthRetrying(withStatus(408)));
  ok('and being told to slow down', worthRetrying(withStatus(429)));
  ok('a wrong password is not', !worthRetrying(withStatus(401)));
  ok('nor a forbidden row', !worthRetrying(withStatus(403)));
  ok('nor a route that does not exist', !worthRetrying(withStatus(404)));
  ok('the status is read from a nested body too', !worthRetrying({ body: { status: 401 } }));
}

// --- what it actually does ----------------------------------------------------
{
  const { waits, sleep } = fakeSleep();
  let tries = 0;
  const value = await keepTrying(() => { tries++; return 'ok'; }, { sleep });
  ok('something that works is called once', tries === 1 && value === 'ok');
  ok('and nothing waits', waits.length === 0);
}

{
  // The real case: cold on the first ask, awake on the second.
  const { waits, sleep } = fakeSleep();
  let tries = 0;
  const value = await keepTrying(() => {
    tries++;
    if (tries === 1) throw new Error('Failed to fetch');
    return 'the worlds';
  }, { sleep });
  ok('a cold database answers on the second ask', tries === 2 && value === 'the worlds');
  ok(`after waiting ${waits[0]}ms`, waits.length === 1 && waits[0] === BACKOFF[0]);
}

{
  const { waits, sleep } = fakeSleep();
  let tries = 0;
  let thrown = null;
  try {
    await keepTrying(() => { tries++; throw withStatus(503); }, { sleep });
  } catch (err) { thrown = err; }
  ok(`something genuinely down is asked ${tries} times and then gives up`, tries === BACKOFF.length + 1);
  ok('over the backoff, longest last', JSON.stringify(waits) === JSON.stringify(BACKOFF));
  ok('and the real error comes back, not a made-up one', thrown?.status === 503);
}

{
  // A wrong password must not take four seconds to say so.
  const { waits, sleep } = fakeSleep();
  let tries = 0;
  let thrown = null;
  try {
    await keepTrying(() => { tries++; throw withStatus(401); }, { sleep });
  } catch (err) { thrown = err; }
  ok('a refusal is asked exactly once', tries === 1);
  ok('with no waiting at all', waits.length === 0);
  ok('and is passed straight back', thrown?.status === 401);
}

{
  // The whole point: it has to finish inside the time a compute takes to wake.
  const total = BACKOFF.reduce((a, b) => a + b, 0);
  ok(`the tries are spread over ${total}ms, which covers a 1540ms cold start`,
    total >= 1540 && total <= 8000);
}

// --- the messages no longer claim a local copy --------------------------------
{
  // Worlds live on the account and nowhere else. Anything that still tells a
  // player their work is on this device is pointing them at an empty drawer,
  // so these read the real strings rather than trusting the last edit.
  const { readableTokenError } = await import('../src/net/CloudAuth.js');
  const lines = [undefined, 401, 403, 404, 500, 503].map((s) => readableTokenError({ status: s }));
  ok('no failure claims the worlds are on this device',
    lines.every((l) => !/on this device/i.test(l)));
  ok('none of them shows an internal hostname',
    lines.every((l) => !/neon\.tech|neonauth|\bep-/i.test(l)));
  ok('the one the player saw says where their worlds actually are',
    /on the account/i.test(readableTokenError({})));
  ok('an expired session still says to sign in again',
    /sign in again/i.test(readableTokenError({ status: 401 })));
  // Where there is nothing the player can do, say the thing they are afraid
  // of. Where there is (an expired session), say that instead of reassuring
  // them about a problem they can just fix.
  ok('every failure they cannot act on says nothing is lost',
    [undefined, 404, 500, 503].every((s) => /is lost|nothing is/i.test(readableTokenError({ status: s }))));
}

process.exit(f ? 1 : 0);
