import { SyncState } from '../src/storage/WorldSync.js';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Signing in is an upgrade, not the price of admission.
 *
 * Worlds used to live only on the account — SaveManager was deleted outright,
 * because reconciling a browser's copy of a world with an account's copy of
 * the *same* world has no good answer, and the guessing that answer forced is
 * what showed one account two different settlements on a phone and a desktop.
 * That reasoning was correct, and it does not apply here: reported directly
 * as wanting the game playable with no account at all (for a build with no
 * cloud configured, among other reasons), the fix is not bringing back a
 * *second* copy of each world — it's letting a world live in exactly one
 * place, decided once, local or cloud, never both. See LocalWorlds' own note.
 *
 * These check that local and cloud are genuinely two disjoint libraries
 * (nothing here ever asks which copy of a world is newer, because there is
 * only ever one), that nobody signed out hits a wall, and that the parts of
 * cloud sync that can bite — a failed save, a closed tab, a second device —
 * are still handled rather than assumed away.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/ui/HomeScreen.js', import.meta.url), 'utf8');
const local = readFileSync(new URL('../src/storage/LocalWorlds.js', import.meta.url), 'utf8');

// --- a local library exists, and Game.js actually reaches for it -------------

ok('there is a local world store', existsSync(new URL('../src/storage/LocalWorlds.js', import.meta.url)));
ok('Game.js always has one, cloud or not', /this\.local = new LocalWorlds\(\);/.test(game));
ok('a new world decides once where it lives, not per-save',
  /this\.worldIsLocal = !this\.cloud\?\.signedIn;/.test(game));
ok('saving dispatches on that decision, not on being signed in right now',
  /saveNow\(\) \{[\s\S]{0,200}if \(this\.worldIsLocal\) return this\.saveLocally\(\);/.test(game));
ok('opening asks the local library first — free, and synchronous, unlike the network',
  /if \(this\.local\.has\(id\)\)/.test(game));
ok('deleting checks the same way before ever reaching the cloud',
  /if \(this\.local\.has\(id\)\) \{[\s\S]{0,100}this\.local\.delete\(id\);/.test(game));
ok('the worlds screen lists both libraries, not just the account',
  /const local = this\.local\.list\(\);/.test(game) && /async listAllWorlds/.test(game));

// --- signing in is where a world moves, not a wall it has to already be behind ---

// A world built before an account existed must not be stranded the moment
// one is created — "create an account, play anywhere" has to be true for
// what you already built, not only from that point on.
ok('signing in sweeps up whatever was only ever saved in this browser',
  /async migrateLocalWorlds\(\)/.test(game));
ok('one world failing to move does not sink the rest, or lose it',
  /async migrateLocalWorlds\(\)[\s\S]{0,600}for \(const row of this\.local\.list\(\)\)[\s\S]{0,600}catch \{/.test(game));
ok('sign-in runs the sweep', /await this\.cloudAuth\.signIn\(email, password\);[\s\S]{0,200}await this\.migrateLocalWorlds\(\);/.test(game));
ok('so does sign-up — an existing local world is not only for people who already had an account',
  /await this\.cloudAuth\.signUp\(email, password\);\s*\n\s*const moved = await this\.migrateLocalWorlds\(\);/.test(game));

// --- no account is required to play -------------------------------------------

ok('there is no sign-in gate on the worlds screen any more', !/needsAccount/.test(home) && !/needsAccount/.test(ui));
ok('and no dead-end screen behind one', !/renderSignedOut/.test(home));
ok('the front door draws the list on its own step, unconditionally',
  /render\(\) \{\s*if \(this\.step === 'kind'\)/.test(home));
ok('signing in is still offered, just not forced',
  /data-signin/.test(home) && /Saved right here for now/.test(home));
ok('and hidden entirely in a build with no cloud to sign in to',
  /accountBtn\.hidden = !this\.cb\.isCloudConfigured\?\.\(\);/.test(home));

// --- LocalWorlds itself: a whole world in, a whole world back out ------------

{
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const { LocalWorlds } = await import('../src/storage/LocalWorlds.js');
  const lw = new LocalWorlds();

  ok('a fresh browser holds nothing', lw.list().length === 0 && !lw.has('a'));

  const fakeWorld = { serialize: () => ({ endless: false, sizeX: 8, sizeZ: 8, chunks: [] }) };
  const fakePlayer = { position: { x: 1, y: 2, z: 3 }, yaw: 0.5, pitch: -0.1 };
  const fakeDuilt = { toJSON: () => ({}), territory: { toJSON: () => ({ age: 3 }) } };
  const fakeEconomy = { toJSON: () => ({ gold: 4 }) };

  lw.save('w1', {
    world: fakeWorld, name: 'Test world', mode: 'duilt',
    player: fakePlayer, duilt: { territory: { age: 3 } }, economy: fakeEconomy,
  });
  ok('now it does', lw.has('w1') && lw.list().length === 1);
  ok('and the list carries what the worlds screen needs to show',
    lw.list()[0].name === 'Test world' && lw.list()[0].mode === 'duilt' && lw.list()[0].age === 3);

  const back = lw.restore('w1');
  ok('the whole thing comes back — position, name, everything',
    back.name === 'Test world' && back.player.x === 1 && back.player.yaw === 0.5);

  ok('a second save under the same id replaces it, not duplicates it',
    (lw.save('w1', { world: fakeWorld, name: 'Renamed', mode: 'duilt', economy: fakeEconomy }), lw.list().length === 1));
  ok('and the rename actually took', lw.list()[0].name === 'Renamed');

  lw.delete('w1');
  ok('deleting removes both the payload and the index row', !lw.has('w1') && lw.list().length === 0);
  ok('and restoring a gone world says so rather than returning nothing',
    (() => { try { lw.restore('w1'); return false; } catch { return true; } })());

  ok('progression rides along outside any one world',
    (lw.saveProgression({ xp: 40 }), lw.loadProgression().xp === 40));

  delete globalThis.localStorage;
}

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
ok('a failure stays pending — quietly, retried rather than announced every few minutes (backlog batch 2)',
  /this\.saveError = err\?\.message/.test(game) && !/Not saved to your account yet/.test(game) && /the copy keepSafe put aside survives a closed tab/.test(game));
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
  /failed \? '' : [\s\S]{0,300}<p class="home-note">No worlds yet/.test(home));

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
