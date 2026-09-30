import { readFileSync } from 'node:fs';

/**
 * Three reported directly.
 *
 * "About achievements, feels weird to see the whole thing listed there
 * without accomplishing anything... only showing the age 2 after finishing
 * age 1." UIManager.populateStats now draws only the ages you've reached,
 * counts only those, and says in one line that the next age comes after.
 *
 * "When opening the bag in mobile I should not see the bottom equipped
 * thing, since we have it represented in the pop up." The HUD hotbar was
 * forced back on over the bag everywhere; on a phone it just doubled the
 * bag's own Equipped row.
 *
 * And, measured on a phone while fixing that ("slots are not square" was
 * reported earlier): a filled slot came out 52px beside a 60px empty one,
 * and the scrolling bag grid packed its rows 58px apart for 60px slots.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

// --- goals: only the ages reached --------------------------------------------

ok('only bands up to your age are drawn', /const shown = bands\.filter\(\(band\) => band\.age <= s\.age\);/.test(ui)
  && /this\.q\('#ach-grid'\)\.innerHTML = shown\.map\(/.test(ui));
ok('the header counts what is shown, not every goal in the game',
  /\$\{shownDone\} of \$\{shownGoals\.length\} done/.test(ui) && !/ACHIEVEMENTS\.length/.test(ui));
ok('one line says the next age is coming, without listing it',
  /Age \$\{next\.age\} appears here once you finish Age \$\{s\.age\}\./.test(ui) && /\.goal-next \{/.test(css));
ok('no dimmed "ahead" bands left over', !/goal-band\.ahead/.test(css) && !/'ahead'/.test(ui));

// --- bag on a phone: no HUD hotbar under it -----------------------------------

ok('the hotbar comes back over the bag on desktop only',
  /body\.bag-open:not\(\.touch\) #hotbar-wrap \{ display: flex !important;/.test(css)
  && !/body\.bag-open #hotbar-wrap/.test(css));

// --- bag slots are all the same square ----------------------------------------

ok('a filled slot fills its cell like an empty one does', /\.bag-slot-wrap > \.bag-slot \{ width: 100%; \}/.test(css));
ok('bag grids size rows to the square slots, not short of them',
  /#bag-hotbar-grid, #bag-grid \{[^}]*align-items: start;/.test(css)
  && /#store-grid, #store-hotbar-grid, #store-bag-grid \{[^}]*align-items: start;/.test(css));

process.exit(f ? 1 : 0);
