/**
 * The error card mends itself, and is emphatically not a keep-alive.
 *
 * The ask was "something that keeps making requests so the database never
 * sleeps". On this project's plan that is the worst available trade: the free
 * allowance is 100 CU-hours per project per month, the compute floor is
 * 0.25 CU, so a database that never sleeps spends 0.25 × 24 × ~30 = ~182
 * CU-hours a month. It would run out around day seventeen and then suspend
 * itself until the next billing period — the game dead for a fortnight in
 * every month, to save a wait of about a second.
 *
 * So: no heartbeat. Instead, a screen that has already failed keeps asking a
 * few times on its own, further apart each time, and then stops. It costs
 * nothing when nothing is wrong, because it only runs when something is.
 */
import { readFileSync } from 'node:fs';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const home = readFileSync(new URL('../src/ui/HomeScreen.js', import.meta.url), 'utf8');

// --- the sums that rule a keep-alive out --------------------------------------
{
  const ALLOWANCE = 100;     // CU-hours per project per month, free plan
  const FLOOR = 0.25;        // the compute's minimum size
  const HOURS = 24 * 30.4;

  const neverSleeping = FLOOR * HOURS;
  ok(`a database kept awake would spend ${neverSleeping.toFixed(0)} CU-hours a month`,
    neverSleeping > ALLOWANCE);
  const daysUntilDead = (ALLOWANCE / FLOOR) / 24;
  ok(`which runs out on day ${daysUntilDead.toFixed(0)} of every month`, daysUntilDead < 20);

  // What it actually uses today, from the project's own reading.
  const activeSeconds = 19304;
  const used = FLOOR * (activeSeconds / 3600);
  ok(`against ${used.toFixed(1)} CU-hours actually used`, used < ALLOWANCE / 10);
}

// --- so what shipped is bounded ----------------------------------------------
{
  const gaps = JSON.parse((home.match(/const HEAL_GAPS = (\[[^\]]+\])/) ?? [])[1]
    ?.replace(/_/g, '') ?? '[]');
  ok(`there are ${gaps.length} goes and then it stops`, gaps.length >= 3 && gaps.length <= 6);
  ok('each wait is longer than the last',
    gaps.every((g, i) => i === 0 || g > gaps[i - 1]));
  const total = gaps.reduce((a, b) => a + b, 0);
  ok(`they cover ${Math.round(total / 1000)}s in total, then it leaves you the button`,
    total >= 30_000 && total <= 300_000);
}

// --- and it only runs when something is wrong --------------------------------
{
  // Read the catch block itself rather than guessing at a window size: the
  // retrying must hang off the failure and nothing else.
  const body = home.slice(home.indexOf('} catch (err) {'), home.indexOf('} finally {'));
  ok('it starts from the failure path', body.includes('this.startHealing()'));
  const success = home.slice(home.indexOf('this.cloudWorlds = (await'), home.indexOf('} catch (err) {'));
  ok('and never from the path where everything worked', !success.includes('startHealing'));
}
ok('and stops the moment the account answers',
  /this\.cloudError = null;\s*\n\s*this\.cloudDetail = null;\s*\n\s*this\.stopHealing\(\)/.test(home));
ok('a hidden tab is not somebody waiting',
  /visibilityState === 'hidden'/.test(home));
ok('it gives up rather than asking for ever',
  /healAttempt >= HEAL_GAPS\.length/.test(home));
ok('leaving the worlds screen ends it', /this\.step !== 'home'/.test(home));
ok('and tapping Try again starts the patience over', /stopHealing\(\);[\s\S]{0,200}data-retry|stopHealing\(\)/.test(home));

// --- nothing anywhere polls on a timer ---------------------------------------
{
  // The thing this must never quietly become.
  const src = ['../src/Game.js', '../src/net/CloudAuth.js', '../src/net/NeonTransport.js', '../src/net/CloudWorlds.js']
    .map((p) => readFileSync(new URL(p, import.meta.url), 'utf8')).join('\n');
  ok('no setInterval anywhere near the account code', !/setInterval/.test(src));
  ok('and the card says it is still trying, so nobody has to sit on the button',
    /Still trying on its own/.test(home));
}

process.exit(f ? 1 : 0);
