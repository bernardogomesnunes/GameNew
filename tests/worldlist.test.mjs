import { readFileSync } from 'node:fs';

/**
 * The worlds list (docs/backlog-batch-2.md, priority 0), both reported
 * directly: "the game worlds saved the old way are always in the list as I
 * login, after a couple of seconds the recent worlds show up ... we should
 * load the page with all items there listed", and "sometimes when I delete
 * a world all the worlds disappear and I need to reload the page".
 *
 * Checked in a browser too: three worlds, one deleted — the other two stay.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/ui/HomeScreen.js', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../src/net/CloudAuth.js', import.meta.url), 'utf8');

// --- whole on the first answer -------------------------------------------------------------------

ok('the list waits for the account to be picked back up, so the first answer is whole', /async listAllWorlds\(\) \{[\s\S]{0,500}if \(this\.cloud && !this\.cloudAuth\.ready\) await this\.cloudAuth\.restore\(\);/.test(game));
ok('one session check, however many ask at once', /this\.restoring \?\?= \(async \(\) => \{/.test(auth) && /return this\.restoring;/.test(auth));
ok('the account\'s worlds are remembered on the device each time they\'re fetched', /const cloud = await this\.cloudList\(\);\s*this\.rememberWorlds\(cloud\);/.test(game));
ok('and shown the moment the screen opens, with this browser\'s own', /knownWorlds\(\) \{\s*return sortWorlds\(\[\.\.\.this\.local\.list\(\), \.\.\.\(this\.cloud \? this\.rememberedWorlds\(\) : \[\]\)\]\);/.test(game)
  && /const rows = this\.cloudWorlds \?\? this\.cb\.knownWorlds\?\.\(\) \?\? \[\];/.test(home));
ok('only what a row needs is kept', /rows\.map\(\(\{ id, name, mode, age, updatedAt \}\) => \(\{ id, name, mode, age, updatedAt \}\)\)/.test(game));
ok('forgotten on sign-out, for whoever signs in next', /await this\.cloudAuth\.signOut\(\);\s*\/\/[^\n]*\n\s*this\.forgetRememberedWorlds\(\);/.test(game));
ok('an account that can\'t be reached still shows what it last had', /err\.partial = sortWorlds\(\[\.\.\.local, \.\.\.this\.rememberedWorlds\(\)\]\);/.test(game));

// --- a delete takes one world, not all of them ------------------------------------------------------

ok('the rows on screen are taken before deleting, then filtered', /const shown = rows;\s*if \(!await this\.cb\.onRemove\(el\.dataset\.remove, el\.dataset\.removeName\)\) return;\s*this\.cloudWorlds = shown\.filter\(\(w\) => w\.id !== el\.dataset\.remove\);/.test(home));
ok('an out-of-date list is kept on screen and asked for again, never dropped', /forgetWorlds\(\) \{[\s\S]{0,200}this\.stale = true;\s*\}/.test(home) && !/forgetWorlds\(\) \{\s*this\.cloudWorlds = null;/.test(home)
  && /if \(this\.cloudWorlds && !this\.stale && !force\) return;\s*this\.stale = false;/.test(home));
ok('a deleted account world leaves the remembered list at once', /this\.rememberWorlds\(this\.rememberedWorlds\(\)\.filter\(\(w\) => w\.id !== id\)\);\s*this\.cloud\?\.delete\(id\)/.test(game));

ok('before the first answer, with nothing remembered: "Loading your worlds", never "No worlds yet"', /this\.cloudWorlds == null && this\.cb\.isCloudConfigured\?\.\(\)[\s\S]{0,200}Loading your worlds…/.test(home));

process.exit(f ? 1 : 0);
