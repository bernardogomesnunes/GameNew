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
  /saveNow\(\{ sync = true \} = \{\}\) \{[\s\S]{0,800}if \(sync\) this\.syncSoon\(\);/.test(game));
ok('and a push that fails never breaks the save that worked',
  /this\.syncNow\(\)\s*\n\s*\.catch\(/.test(game));
ok('it is retried rather than lost, because a failed push agrees to nothing',
  /agree\(this\.worldId, result\.revision\)/.test(game));

// --- the game knows you are signed in before you ask it ----------------------

/**
 * The session was picked up the first time somebody opened the in-game menu,
 * and nowhere else. So on the worlds screen — the screen whose whole job is
 * listing your worlds — the game did not yet know it was signed in: it never
 * asked the account what it held, every world was labelled "this device only",
 * and nothing synced. On both devices at once, each convinced it was alone.
 */
ok('the session is picked up at startup', /this\.resumeSession\(\);/.test(game));
ok('and not only when a panel is opened', !/cloudRestoreStarted/.test(ui));
ok('finding one refreshes the worlds screen',
  /resumeSession\(\) \{[\s\S]{0,700}home\?\.refreshCloudWorlds\?\.\(\)/.test(game));
ok('and syncs whatever world is already open',
  /resumeSession\(\) \{[\s\S]{0,800}this\.syncSoon\(\);/.test(game));
ok('being offline at startup is not an error',
  /resumeSession\(\)[\s\S]{0,900}catch\(\(\) => \{ \/\* offline/.test(game));

// --- opening the newer copy --------------------------------------------------

// The sync worked out that the account was ahead and then did nothing with
// that answer, so the device that was behind opened its own stale copy for
// ever. Opening asks the account first now.
ok('opening a world asks which copy is the real one', /const \{ action \} = await this\.decideFor\(id\);/.test(game));
ok('and fetches the account\'s when it is ahead',
  /action === PULL \|\| action === CLOUD_ONLY[\s\S]{0,160}restoreFromCloud\(id/.test(game));
ok('Continue goes the same way rather than straight to the local copy',
  /onLoadAutosave: \(\) => this\.openWorld\(this\.saveManager\.lastOpened\(\)/.test(game));
ok('offline or signed out, what is here opens', /return \{ action: null \};/.test(game));
ok('and it does not wait for ever to find out', /timeoutMs = 4000/.test(game));
ok('the answer is cached, so opening does not repeat the worlds screen\'s round trip',
  /async cloudList\(\{ maxAgeMs = 15_000 \}/.test(game));
ok('and anything that changes what is up there drops the cache',
  (game.match(/forgetCloudList\(\)/g) ?? []).length >= 3);

// Played, as opposed to written. This is what stopped every difference from
// reading as "we both played", which is a conflict nothing resolves on its own.
ok('the one place blocks change is the one place that counts as playing',
  /this\.editedAt = Date\.now\(\);[\s\S]{0,40}return true;\n  \}/.test(game));
ok('it is saved with the world', /editedAt: this\.editedAt \?\? 0,/.test(game));
ok('and carried back when it loads, not reset to now',
  /this\.editedAt = data\.editedAt \?\? 0;/.test(game));
ok('a brand new world counts as played, so it goes up', /this\.editedAt = Date\.now\(\);[\s\S]{0,200}disposeDuilt/.test(game));
ok('the decision asks for it rather than for the write time',
  /this\.saveManager\.editedAt\(id\)/.test(game) && /editedAt\(worldId\) \{/.test(saves));
ok('and a record from before the distinction is read as played, which asks rather than assumes',
  /row\.editedAt \?\? row\.at \?\? 0/.test(saves));

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

// --- which worlds are on the account ----------------------------------------

// This was left out once on the grounds that a badge for a broken feature
// would never appear. That was the wrong call: the list is where you go to
// find a world, and "is this one safe if I lose this phone" is the question it
// exists to answer.
// One record per world, kept under the id the account knows it by — there is
// no name-keyed store and no second copy of anything to tell apart.
ok('a world is stored under its own id', /const worldKey = \(id\) => WORLD_PREFIX \+ id;/.test(saves));
ok('and there is no way to save a copy', !/\bsave\(name/.test(saves) && !/listSaves/.test(saves));
ok('worlds from the old name-keyed store are brought across',
  /migrateOldSaves\(\)/.test(saves) && /OLD_AUTOSAVE_NAME/.test(saves));
ok('and two names for one world collapse into one record',
  /if \(existing && \(existing\.at \?\? 0\) >= at\) continue;/.test(saves));
// Signing in is those worlds finding their home, not a fresh start.
ok('signing in takes this device\'s worlds up to the account',
  /adoptLocalWorlds\(\)/.test(game));
ok('each one keeps the id it already had, so it is the same world',
  /await this\.cloud\.save\(row\.id,/.test(game));
ok('and a world already on the account is left alone', /if \(up\.has\(row\.id\)\) continue;/.test(game));
ok('a failure there never breaks the sign-in', /catch \{ \/\* offline: nothing moves, nothing is lost \*\/ \}/.test(game));
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
