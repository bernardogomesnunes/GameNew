import { readFileSync } from 'node:fs';

/**
 * Reported directly: "I'm receiving a 'this browser does not have more
 * memory' message." A world made before the start-up sign-in check finished
 * was decided as this browser's, and only an explicit sign-in ever moved
 * browser worlds to the account — so for someone who stays signed in they
 * sat in the browser for good, growing until it was full.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const local = readFileSync(new URL('../src/storage/LocalWorlds.js', import.meta.url), 'utf8');

const resume = game.slice(game.indexOf('resumeSession() {'), game.indexOf('async cloudList('));
ok('signed in at start-up, browser worlds move to the account', /this\.adoptLocalWorlds\(\);/.test(resume));
const adopt = game.slice(game.indexOf('async adoptLocalWorlds()'), game.indexOf('async migrateLocalWorlds()'));
ok('the open one included', /if \(this\.worldIsLocal && !this\.discarded && this\.worldId\) \{\s*this\.worldIsLocal = false;\s*this\.local\.delete\(this\.worldId\);\s*this\.saveNow\(\);/.test(adopt));
const saveLocal = game.slice(game.indexOf('  saveLocally() {'), game.indexOf('async flush()'));
ok('a full browser, signed in, sends the world to the account instead', /catch \(err\) \{[\s\S]{0,300}if \(this\.cloud\?\.signedIn\) \{\s*this\.worldIsLocal = false;[\s\S]{0,300}return this\.saveNow\(\);/.test(saveLocal));
ok('signed out, it says what to do about it', /This browser is full\. Sign in to keep your worlds in your account, or delete a world you don\\'t need\./.test(local));

process.exit(f ? 1 : 0);
