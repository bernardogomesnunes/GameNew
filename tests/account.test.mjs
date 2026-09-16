import { SyncState } from '../src/storage/WorldSync.js';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Worlds live on the account, and nowhere else.
 *
 * They used to be kept in whichever browser made them, with the account as a
 * second place they were also sometimes kept — and something had to decide
 * which of the two copies was the real one. There is no good answer to that:
 * one of them is always wrong and the game has to guess. The guessing is what
 * showed one account two different settlements on a phone and a desktop, and
 * no amount of reconciling fixed it, because the problem was that there were
 * two of them at all.
 *
 * So: an account to play, one copy, on the account. These check that the local
 * half is actually gone rather than merely unused, and that the parts of
 * cloud-only that can bite — a failed save, a closed tab, a second device —
 * are handled rather than assumed away.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/ui/HomeScreen.js', import.meta.url), 'utf8');

// --- the local library is gone, not merely unused ----------------------------

ok('there is no local world store any more',
  !existsSync(new URL('../src/storage/SaveManager.js', import.meta.url)));
ok('and nothing reaches for one', !/saveManager/.test(game) && !/saveManager/.test(ui));
ok('no local index of worlds is written', !/voxelgame:worlds'/.test(game));
ok('and the worlds screen reads the account, not a device',
  /this\.cloudWorlds \?\? \[\]/.test(home) && !/listWorlds/.test(home));

// --- you need an account ------------------------------------------------------

ok('the worlds screen is a door when you are signed out', /renderSignedOut\(\)/.test(home));
ok('and says why an account is the price of admission',
  /Sign in to play/.test(home) && /every\s*\n?\s*device you sign in on/.test(home));
ok('with both ways in from there', /data-signin/.test(home) && /data-signup/.test(home));
ok('and they open the panel on the right side of itself',
  /onAccount\?\.\('signin'\)/.test(home) && /onAccount\?\.\('create'\)/.test(home)
  && /setAccountMode\(mode\)/.test(ui));
ok('the gate is what render decides first', /if \(this\.cb\.needsAccount\?\.\(\)\) return this\.renderSignedOut\(\);/.test(home));
ok('and needing one means having no user', /needsAccount: \(\) => !this\.cb\.getCloudUser\?\.\(\)/.test(ui));

// --- a world only becomes real on the account ---------------------------------

ok('opening a world fetches it from the account', /await this\.restoreFromCloud\(id\)/.test(game));
ok('and an imported file becomes a world on the account too',
  /this\.loadFromData\(\{ \.\.\.data, worldId: newWorldId\(\) \}\);\n\s*this\.saveNow\(\);/.test(game));
ok('what you were in goes up before you leave it', /openWorld\(id\)[\s\S]{0,300}await this\.flush\(\)/.test(game));
ok('deleting takes the account copy', /this\.cloud\?\.delete\(id\)/.test(game));
ok('and says so when it cannot', /Could not delete that world/.test(game));

// The world behind the worlds screen is scenery, not a save.
ok('the world drawn behind the front door is never saved',
  /scenery = false/.test(game) && /this\.discarded = !!scenery;/.test(game));
ok('and the front door makes one so the canvas is not blank',
  /newWorld\(\{ silent: true, scenery: true \}\)/.test(game));

// --- a save that does not land ------------------------------------------------

// Cloud-only is the right shape and losing an afternoon to a dropped
// connection is not a design decision anybody made on purpose.
ok('saving queues rather than blocking the build', /this\.pendingSave = true;/.test(game));
ok('one upload at a time, so revisions keep meaning something',
  /if \(this\.saving\) return this\.saving;/.test(game));
ok('a failure stays pending rather than being swallowed',
  /this\.saveError = err\?\.message/.test(game) && /Not saved to your account yet/.test(game));
ok('and the world is held somewhere it survives a closed tab',
  /keepSafe\(\)/.test(game) && /UNSENT_KEY/.test(game));
ok('which is one slot, not a library', /const UNSENT_KEY = 'voxelgame:unsent';/.test(game));
ok('thrown away the moment the upload lands', /this\.dropSafeCopy\(\);/.test(game));
ok('and sent on the next sign-in or startup', /sendUnsent\(\)/.test(game));

// --- two devices with the same world open -------------------------------------

// There is one copy, so this is no longer a fork to reconcile — but writing
// over somebody else's save without a word is the one thing it must not do.
ok('a world saved elsewhere while you had it open is noticed',
  /mine\.revision > agreed\.revision/.test(game));
ok('and said out loud', /This world was open somewhere else/.test(game));
ok('while your changes are still the ones kept',
  /Your changes are the ones kept/.test(game));

// --- the list must not lie ----------------------------------------------------

// With no local list to fall back on, an empty screen and no explanation is
// the worst thing this could do: "I have no worlds" and "I could not ask" are
// very different sentences.
ok('a list that fails says so', /this\.cloudError = err\?\.message/.test(home));
ok('with a way to try again', /data-retry/.test(home));
ok('and it is not mistaken for having no worlds',
  /failed \? '' : `<p class="home-note">No worlds yet/.test(home));

// --- the session is known before the screen draws -----------------------------

ok('the session is picked up at startup', /this\.resumeSession\(\);/.test(game));
ok('and the door is drawn either way, signed in or not',
  /resumeSession\(\) \{[\s\S]{0,600}home\?\.render\?\.\(\)/.test(game));
ok('being offline at startup is not an error',
  /resumeSession\(\)[\s\S]{0,800}\.catch\(\(\) => \{ this\.ui\?\.home\?\.render\?\.\(\); \}\)/.test(game));

// --- what a device remembers ---------------------------------------------------

{
  const store = new Map();
  const fake = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const s = new SyncState(fake);
  ok('a world nobody has synced has no agreement', s.agreedFor('a') === null);
  s.agree('a', 7, 1234);
  ok('agreeing records the revision and when', s.agreedFor('a').revision === 7 && s.agreedFor('a').at === 1234);
  ok('and it survives a reload', new SyncState(fake).agreedFor('a').revision === 7);
  s.forget('a');
  ok('forgetting clears it', new SyncState(fake).agreedFor('a') === null);

  const deaf = { getItem: () => { throw new Error('nope'); }, setItem: () => { throw new Error('nope'); } };
  const d = new SyncState(deaf);
  d.agree('a', 1);
  ok('a browser that refuses storage still runs', d.agreedFor('a').revision === 1);
}

process.exit(f ? 1 : 0);
