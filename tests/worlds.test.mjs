import { whereToLive } from '../src/ui/HomeScreen.js';
import { readFileSync } from 'node:fs';

/**
 * Starting a world, and where it goes.
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

// --- where a new world lives -------------------------------------------------

ok('signed out, a world can only live on this device', whereToLive(null, false) === 'local');
ok('and asking for the cloud anyway does not make it so', whereToLive('cloud', false) === 'local');
ok('signed in, the cloud leads — it is why you signed in', whereToLive(null, true) === 'cloud');
ok('but choosing this device sticks', whereToLive('local', true) === 'local');
ok('and so does choosing the cloud', whereToLive('cloud', true) === 'cloud');

// --- the choice is on the naming step, not buried in a panel -----------------

ok('the naming step asks where it lives', /Where does it live/i.test(home));
ok('it offers this device', /On this device/.test(home));
ok('and the cloud', /In the cloud/.test(home));
ok('the cloud option is off when signed out', /data-where="cloud"[\s\S]{0,120}disabled/.test(home));
ok('and says how to turn it on', /Sign in to keep worlds on your account/.test(home));
ok('with a way in from right there', /data-signin/.test(home));
ok('the choice reaches the world that gets made', /cloud: where === 'cloud'/.test(home));
ok('and the cards are styled', css.includes('.where-card') && css.includes('.where-card.chosen'));
ok('stacking on a narrow screen', /max-width: 520px[\s\S]{0,80}where-list/.test(css));

// --- signing in goes somewhere -----------------------------------------------

ok('signing in closes the account panel', /closePanel\('panel-account'\)/.test(ui));
ok('and opens the worlds list', /closePanel\('panel-account'\);\s*\n\s*this\.openHome\(\)/.test(ui));
ok('and does not leave your password sitting in the box',
  /#cloud-password'\)\.value = ''/.test(ui));

// --- a cloud failure never costs you the world -------------------------------

ok('the upload is fired after the world exists', /onNewWorld\(mode, name\);[\s\S]{0,400}if \(cloud\)/.test(ui));
ok('and a failure is caught', /onCloudSave\(name\)[\s\S]{0,300}\.catch\(/.test(ui));
ok('and says the world is safe where it is',
  /the world is safe on this device/.test(ui));

// --- what the player is told when the token call fails -----------------------

// The SDK's own message is "HTTP 404 Not Found", which names nothing and reads
// like the game is broken rather than the sync being off.
ok('a token failure is translated', /readableTokenError/.test(auth));
ok('404 is explained rather than printed', /did not recognise the token request/.test(auth));
ok('the host is named, since that is what a screenshot needs to show',
  /authHost\(\)/.test(auth) && /deriveUrls\(\)\.auth/.test(auth));
ok('and every branch says the worlds are safe',
  (auth.match(/safe on this device/g) ?? []).length >= 3);
ok('an expired session still reads as one', /session expired/.test(auth));

process.exit(f ? 1 : 0);
