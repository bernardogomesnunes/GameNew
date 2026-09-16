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
ok('404 is explained rather than printed', /does not know that token route/.test(auth));
ok('the host is named, since that is what a screenshot needs to show',
  /authHost\(\)/.test(auth) && /deriveUrls\(\)\.auth/.test(auth));
ok('and every branch says the worlds are safe',
  (auth.match(/safe on this device/g) ?? []).length >= 3);
ok('an expired session still reads as one', /session expired/.test(auth));

process.exit(f ? 1 : 0);
