import { readFileSync } from 'node:fs';

/**
 * The phone controls.
 *
 * They had grown to eight buttons across two columns before you opened
 * anything — Bag, Bench, Build, Skills, Guide, Designs, Mirror, Screen, Fly,
 * More, Jump, Break, Place — on the device with the least glass to spare. A
 * screen that is a third controls is a screen you cannot see the world
 * through.
 *
 * Four now: Break and Place under the right thumb, More and Jump under the
 * left, and everything else one tap away. The sticks are swapped from the
 * console convention on purpose — in a game where you stand still and mine,
 * the hand that never lets go is the one aiming.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

// The markup between the two cluster divs, so "which side is it on" is a
// question the source can actually answer.
const leftCluster = ui.slice(ui.indexOf('id="touch-buttons-left"'), ui.indexOf('id="touch-buttons-right"'));
const rightCluster = ui.slice(ui.indexOf('id="touch-buttons-right"'), ui.indexOf('</div>\n      </div>', ui.indexOf('id="touch-buttons-right"')));
const tray = ui.slice(ui.indexOf('id="touch-tray"'), ui.indexOf('</div>', ui.indexOf('id="touch-tray"')));

// --- which thumb does what ---------------------------------------------------

ok('the left stick aims the camera', /bindStick\('#stick-left', \(x, y\) => this\.cb\.onLookStick/.test(ui));
ok('the right stick walks', /bindStick\('#stick-right', \(x, y\) => this\.cb\.onMove/.test(ui));
// The camera keeps the gentler curve wherever it lives; it is a property of
// aiming, not of a side of the screen.
ok('and the camera keeps its finer control near centre',
  /onLookStick[^\n]*curve: 1\.25/.test(ui) && /onMove[^\n]*curve: 1\.1/.test(ui));

// --- what is on screen before you open anything ------------------------------

ok('Break is under the moving thumb', rightCluster.includes('id="t-break"'));
ok('and so is Place', rightCluster.includes('id="t-place"'));
ok('and nothing else is', (rightCluster.match(/class="touch-btn"/g) ?? []).length === 2);

ok('More is under the aiming thumb', leftCluster.includes('id="t-more"'));
ok('and Jump', leftCluster.includes('id="t-jump"'));
ok('and Down, once you are flying', leftCluster.includes('id="t-down"'));

// Everything occasional went behind More. Bag was the last hold-out.
for (const id of ['t-bag', 't-bench', 't-build', 't-skills', 't-designs', 't-symmetry', 't-screen', 't-fly']) {
  ok(`${id} is behind More`, tray.includes(`id="${id}"`));
}
ok('there is no always-on row of Duilt buttons any more', !ui.includes('touch-duilt-row'));

// --- the guide moved to the top ---------------------------------------------

ok('the guide has a button at the top', /id="btn-guide"/.test(ui));
ok('and it is not hidden on a phone like the rest of the toolbar',
  !/touch-moved" id="btn-guide"/.test(ui));
ok('so it is gone from the tray', !tray.includes('id="t-guide"'));
ok('and nothing is left wired to the old one', !ui.includes("'#t-guide'"));

// --- the cluster has to fit ---------------------------------------------------

// The tray grows up the left side now, which is exactly where the goal list
// lives. Left uncapped it grows straight through it.
ok('the tray folds into a second column rather than growing forever',
  /max-height: calc\(100dvh - 530px\)/.test(css));
ok('and it stacks away from the screen edge it sits on',
  /\.touch-tray\b[\s\S]{0,400}align-items: flex-start/.test(css));
ok('the cluster sits lower than it did, having lost two rows',
  /bottom: calc\(150px \+ env\(safe-area-inset-bottom\)\)/.test(css));
ok('and the top toolbar has room for five buttons without wrapping',
  /#top-buttons \{[^}]*max-width: 58%/.test(css));

process.exit(f ? 1 : 0);
