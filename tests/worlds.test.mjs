import { whereToLive } from '../src/ui/HomeScreen.js';
import { readFileSync } from 'node:fs';

/**
 * Signing in, and what it says when it cannot.
 *
 * Signing up used to leave you exactly where you started: a panel still titled
 * "Create an account", now holding three unlabelled buttons and two lines
 * reading "HTTP 404". Nothing told you what had happened or what to do next,
 * and there was nowhere in the game to say "put this world on my account" —
 * that decision only existed as a button in the panel you had just escaped.
 *
 * So: signing in lands you on the worlds list, and a new world is told where
 * it lives at the moment you name it.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const home = readFileSync(new URL('../src/ui/HomeScreen.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../src/net/CloudAuth.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

// --- signing in goes somewhere -----------------------------------------------

ok('signing in closes the account panel', /closePanel\('panel-account'\)/.test(ui));
ok('and opens the worlds list', /closePanel\('panel-account'\);[\s\S]{0,200}this\.openHome\(\)/.test(ui));
ok('and does not leave your password sitting in the box',
  /#cloud-password'\)\.value = ''/.test(ui));

// --- what the player is told when the token call fails -----------------------

// The SDK's own message is "HTTP 404 Not Found", which names nothing and reads
// like the game is broken rather than the sync being off.
ok('a token failure is translated', /readableTokenError/.test(auth));

// It is also asked more than once before it gives up. A Neon compute suspends
// after a few idle minutes and takes up to a second and a half to wake; asking
// once meant a sleeping database and a broken account looked the same.
// Retried, and — the part that matters far more — called as a method rather
// than bound off the proxy. See tests/accesstoken.test.mjs for what `.bind`
// does to a Better Auth client and what it cost.
ok('the token call retries while the database wakes',
  /keepTrying\(\(\) => auth\.getJWTToken\(\)\)/.test(auth));
// Comments stripped first — this file explains the bind trap at length, and
// the explanation must not read as the mistake.
ok('and is never detached from the client it belongs to',
  !/getJWTToken\.bind|getToken\.bind/.test(
    auth.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')));
ok('and so does a Data API call', /keepTrying\(\(\) => this\.send/.test(
  readFileSync(new URL('../src/net/NeonTransport.js', import.meta.url), 'utf8')));

// What it says is checked where the strings are — tests/token.test.mjs.

// --- and what it offers you while it cannot reach the account ----------------
//
// Nothing that would be thrown away. Worlds are kept on the account and
// nowhere else, so "New world" while the account is unreachable is an offer to
// spend an evening on something that has nowhere to be saved.
ok('no New world card while the account cannot be reached',
  /\$\{failed \? '' : `\s*<button class="world-card world-card-new"/.test(home));
ok('but the retry is still there', /data-retry="1"/.test(home));

// Signing out is the other place a stale promise was dangerous.
ok('signing out no longer promises a copy stays on the device',
  !/Signing out leaves every world on this device/.test(ui));
ok('and says you will need to sign back in',
  /sign back in/i.test(ui));

process.exit(f ? 1 : 0);
