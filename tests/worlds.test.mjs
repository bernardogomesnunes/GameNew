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
const saves = readFileSync(new URL('../src/storage/SaveManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

// --- where a new world lives -------------------------------------------------

ok('signed out, a world can only live on this device', whereToLive(null, false) === 'local');
ok('and asking for the cloud anyway does not make it so', whereToLive('cloud', false) === 'local');
ok('signed in, it lives on the account', whereToLive(null, true) === 'cloud');
// It used to be a choice, and a signed-in player answering "on this device"
// once, on their phone, got an account holding two unrelated piles of worlds.
ok('and there is no way to ask for this device instead', whereToLive('local', true) === 'cloud');

// --- and it is said rather than asked ----------------------------------------

ok('there is no question about it any more', !/Where does it live/i.test(home));
ok('signed in, it says the world is on the account',
  /Kept on your account, so it is here on every device/.test(home));
ok('signed out, it says it is only this browser', /Kept in this browser/.test(home));
ok('with a way to change that from right there', /data-signin/.test(home));
ok('the choice reaches the world that gets made', /cloud: where === 'cloud'/.test(home));
ok('and the cards it used to need are gone from the styling', !css.includes('.where-card'));

// --- signing in goes somewhere -----------------------------------------------

ok('signing in closes the account panel', /closePanel\('panel-account'\)/.test(ui));
ok('and opens the worlds list', /closePanel\('panel-account'\);[\s\S]{0,200}this\.openHome\(\)/.test(ui));
ok('and does not leave your password sitting in the box',
  /#cloud-password'\)\.value = ''/.test(ui));

// --- a cloud failure never costs you the world -------------------------------

// Making a world writes it locally and that write is what sends it up, so
// there is no separate upload to fail on its own any more. Creating one used
// to push it a second time, a moment after the autosave already had.
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('making a world no longer pushes it twice', !/if \(cloud\) \{[\s\S]{0,200}onCloudSave/.test(ui));
ok('the local write is what sends it',
  /autosaveNow\(\{ sync = true \} = \{\}\) \{[\s\S]{0,800}if \(sync\) this\.syncSoon\(\);/.test(game));
ok('and a push that fails never breaks the save that worked',
  /this\.syncNow\(\)\s*\n\s*\.catch\(/.test(game));
ok('it is retried rather than lost, because a failed push agrees to nothing',
  /agree\(this\.worldId, result\.revision\)/.test(game));

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

// --- which worlds are on the account ----------------------------------------

// This was left out once on the grounds that a badge for a broken feature
// would never appear. That was the wrong call: the list is where you go to
// find a world, and "is this one safe if I lose this phone" is the question it
// exists to answer.
ok('the local list carries the id the cloud knows a world by',
  /worldId: data\.worldId \?\? null/.test(saves));
ok('worlds on the account say so', /world-tag">On your account/.test(home));
ok('and ones only in this browser say that instead', /world-tag">This device only/.test(home));
ok('and ones not yet downloaded say that', /world-tag">Not on this device/.test(home));
ok('and the mark rides in the description, not beside the name',
  /\$\{describe\(\{ mode: r\.mode[\s\S]{0,60}\}\)\}\$\{tag\(r\)\}/.test(home));

// One list, not two. A world you have on this device *and* on your account is
// one world; drawn as a local save plus a separate "On your account" row it
// looked like two, which is the shape of the bug this fixes.
ok('the list is merged rather than stacked', /mergeWorldList\(\{/.test(home));
ok('so there is no second account-only group', !/On your account<\/div>/.test(home));
ok('and a world played in two places is flagged rather than picked',
  /world-tag warn">Two copies/.test(home));
ok('with a way to fetch one', /data-cloud=/.test(home) && /onOpenCloud/.test(home));
ok('fetching one is wired to the restore path', /onCloudRestore\(id\)/.test(ui));

// The list must never wait on the network, and must survive it failing.
ok('the cloud is asked only after the list is drawn',
  /this\.refreshCloudWorlds\(\);\s*\n\s*\}/.test(home));
ok('and not at all when signed out', /if \(this\.cloudPending \|\| !this\.cb\.getCloudUser\?\.\(\)\) return;/.test(home));
ok('a failure leaves the local list alone', /catch \{[\s\S]{0,120}Nothing to say/.test(home));
ok('and two asks do not overlap', /this\.cloudPending = true/.test(home));
ok('signing in forgets what the last account was holding',
  /this\.home\.cloudWorlds = null/.test(ui));

process.exit(f ? 1 : 0);
