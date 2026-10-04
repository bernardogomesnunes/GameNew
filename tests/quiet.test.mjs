import { readFileSync } from 'node:fs';
import { RECIPES } from '../src/config/recipes.js';

/**
 * Quick fixes, batch 2 (docs/backlog-batch-2.md, priority 1): our own
 * pop-ups instead of the browser's, fewer system messages, no session
 * bonus, Clear and Mirror off the bench, and the bag's scroll kept to the bag.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const game = read('Game.js'), ui = read('ui/UIManager.js'), duilt = read('ui/DuiltUI.js'), home = read('ui/HomeScreen.js');
const css = read('ui/styles.css'), confirmJs = read('ui/Confirm.js'), gam = read('gamification/GamificationEngine.js');

// --- our own yes/no ----------------------------------------------------------------------------------

ok('no browser confirm() left anywhere', ![game, ui, duilt, home].some((s) => /(^|[^.\w])confirm\(`|(^|[^.\w])confirm\('/.test(s)));
ok('deleting a world, leaving without saving, deleting a design or a building all ask in the game\'s own dialog',
  /title: `Delete "\$\{label\}"\?`/.test(ui) && /title: 'Leave without saving\?'/.test(ui) && /title: 'Delete this design\?'/.test(ui) && /this\.confirm\(\{ title: `Delete this/.test(duilt));
ok('the worlds screen waits for the answer', /if \(!await this\.cb\.onRemove\(/.test(home));
ok('it sits over everything, panels included, and catches its own taps', /\.confirm-backdrop \{[\s\S]{0,200}z-index: 50;[\s\S]{0,120}pointer-events: auto;/.test(css));
ok('not a panel, so opening it closes nothing', !/class="overlay/.test(confirmJs) && /className = 'confirm-backdrop'/.test(confirmJs));
ok('names typed by you are text, never markup', /\.textContent = title;/.test(confirmJs));
ok('Escape and a tap outside say no', /if \(e\.key === 'Escape'\) \{ e\.stopPropagation\(\); done\(false\); \}/.test(confirmJs) && /if \(e\.target === el\) done\(false\);/.test(confirmJs));

// --- fewer messages ---------------------------------------------------------------------------------

ok('no "Saved" when you leave, no "Opened …" when you arrive', !/title: 'Saved', body: this\.game\.worldName/.test(ui) && !/title: `Opened "/.test(game));
ok('no "Not saved to your account yet" every few minutes — it retries quietly', !/Not saved to your account yet/.test(game));
ok('no "made it up after all"', !/made it up after all/.test(game));
ok('a browser out of room says so once a session, not on every autosave', /if \(!this\.toldSaveError\) \{\s*this\.toldSaveError = true;/.test(game));
ok('a world changed on another device is still said out loud', /This world was open somewhere else/.test(game));

// --- removed -------------------------------------------------------------------------------------------

ok('no "Session complete" bonus', !/addXp\([^)]*'Session complete'\)/.test(gam));
ok('Clear\'s pry bar and Mirror\'s chalk line aren\'t made at the bench', !RECIPES.some((r) => r.id === 'pry_bar' || r.id === 'chalk_line'));

// --- the bag ---------------------------------------------------------------------------------------------

ok('the bag\'s scroll stops at its end instead of dragging Wearing and Equipped away', /#bag-grid \{[^}]*overscroll-behavior: contain;/.test(css));

process.exit(f ? 1 : 0);
