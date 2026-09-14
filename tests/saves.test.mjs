import { readFileSync } from 'node:fs';
import { KEEP_VERSIONS, SNAPSHOT_EVERY_MS } from '../src/storage/SaveManager.js';

/**
 * When a world is written down, and how far back you can go.
 *
 * There was one autosave, overwritten every minute, and leaving a world did
 * not deliberately save at all — it just stopped playing and hoped the last
 * tick had caught it. So an afternoon that went wrong, a hill levelled that
 * should not have been, was simply the world now: nothing to go back to.
 *
 * Now: a version every few minutes, a handful kept, saving on the way out, and
 * the choice not to.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const sm = readFileSync(new URL('../src/storage/SaveManager.js', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

// --- how often, and how many --------------------------------------------------

{
  const m = game.match(/const AUTOSAVE_INTERVAL_MS = (\d+) \* 60_000;/);
  ok(`the world saves itself every ${m?.[1]} minutes`, m && Number(m[1]) === 5);
}
ok(`${KEEP_VERSIONS} earlier versions are kept`, KEEP_VERSIONS >= 5 && KEEP_VERSIONS <= 20);
ok(`spaced at least ${SNAPSHOT_EVERY_MS / 60000} minutes apart`, SNAPSHOT_EVERY_MS >= 2 * 60000);
// A history nobody prunes is what fills a browser's storage and then loses you
// the save you actually needed.
ok('and the ring drops the oldest rather than growing',
  /while \(list\.length > KEEP_VERSIONS\) list\.shift\(\)/.test(sm));
ok('running out of room drops old versions rather than failing the save',
  /list = list\.slice\(Math\.ceil\(list\.length \/ 2\)\)/.test(sm));

// --- one shape, written and read in one place --------------------------------

// An earlier version being a different shape from the current one is the way a
// restore quietly loses your bag.
ok('the live save and a version share one payload builder', /function payloadOf\(/.test(sm));
ok('and one unpacker', /function unpack\(/.test(sm));
ok('save writes through it', /const payload = payloadOf\(state, Date\.now\(\), name\)/.test(sm));
ok('a snapshot writes through it too', /JSON\.stringify\(payloadOf\(state, at\)\)/.test(sm));
ok('load reads through it', /return unpack\(JSON\.parse\(raw\), name\)/.test(sm));
ok('and so does a restore', /return unpack\(JSON\.parse\(entry\.json\), entry\.name\)/.test(sm));

// --- leaving ------------------------------------------------------------------

ok('leaving can save', /leaveWorld\(save = true\)/.test(game));
ok('and saving is what it does by default', /if \(save\) this\.autosaveNow\(\)/.test(game));
// Not saving has to mean not saving. The autosave that fires when the page is
// put away would otherwise write the very state you just refused.
ok('leaving without saving holds against the page being put away',
  /else this\.discarded = true/.test(game) && /if \(this\.discarded\) return false/.test(game));
ok('and opening or making a world turns saving back on',
  (game.match(/this\.discarded = false/g) ?? []).length >= 2);

ok('the menu offers to save and leave', /id="btn-leave">Save and leave/.test(ui));
ok('and to leave without saving', /id="btn-leave-nosave"/.test(ui));
ok('which asks first, naming what would be lost',
  /Leave without saving\? Everything since \$\{since\} is lost/.test(ui));
ok('and says when that was', /lastSavedLabel\(\)/.test(ui));
ok('the quieter choice reads as the quieter choice', /\.menu-quit/.test(css));

// --- going back ---------------------------------------------------------------

ok('the earlier versions are listed', /renderVersions\(\)/.test(ui));
ok('newest first, since that is the one you usually want',
  /\.map\(\(\{ at, name \}, i\) => \(\{ at, name, index: i \}\)\)\.reverse\(\)/.test(sm));
ok('each says how long ago it was', /timeAgo\(v\.at\)/.test(ui));
ok('going back asks first', /Go back to the world as it was/.test(ui));
// Restoring must not be a trapdoor: where you were is worth keeping too.
ok('and what you had is kept as a version of its own',
  /restoreVersion\(index\)[\s\S]{0,700}this\.autosaveNow\(\)/.test(game));
ok('an empty history says so rather than showing nothing',
  /Nothing yet\. A version is kept every few minutes/.test(ui));
ok('restoring a version that is gone fails quietly', /if \(!data\) return false/.test(game));

process.exit(f ? 1 : 0);
