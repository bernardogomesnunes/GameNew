import { readFileSync } from 'node:fs';

/**
 * The phone controls.
 *
 * They had grown to eight buttons in two clusters before you opened anything,
 * on the device with the least glass to spare, with the sticks swapped from the
 * convention and the buttons sitting on top of the stick bases — so a thumb
 * reaching to walk hit Fly instead.
 *
 * Now: movement left, camera right, the way round a thumb already expects.
 * Everything you press is a single column down the left edge with Break and
 * Place at the bottom where the thumb is, Fly above them and More above that.
 * Jump keeps the right, with the hand looking where you are going. Nothing
 * overlaps a stick, nothing sits beside anything else, and everything
 * occasional is behind More in a sheet rather than stacked up the edge.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const duiltUi = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

const leftCluster = ui.slice(ui.indexOf('id="touch-buttons-left"'), ui.indexOf('id="touch-buttons-right"'));
const rightCluster = ui.slice(ui.indexOf('id="touch-buttons-right"'), ui.indexOf('</div>\n    `;', ui.indexOf('id="touch-buttons-right"')));
const tray = ui.slice(ui.indexOf('id="touch-tray"'), ui.indexOf('</div>', ui.indexOf('id="touch-tray"')));

// --- which thumb does what ---------------------------------------------------

ok('the left stick walks', /bindStick\('#stick-left', \(x, y\) => this\.cb\.onMove/.test(ui));
ok('the right stick aims the camera', /bindStick\('#stick-right', \(x, y\) => this\.cb\.onLookStick/.test(ui));
// The camera keeps the gentler curve wherever it lives; it is a property of
// aiming, not of a side of the screen.
ok('and the camera keeps its finer control near centre',
  /onLookStick[^\n]*curve: 1\.25/.test(ui) && /onMove[^\n]*curve: 1\.1/.test(ui));

// --- one column, on the left --------------------------------------------------

ok('Break is on the left, with the hand that is not aiming', leftCluster.includes('id="t-break"'));
ok('and so is Place', leftCluster.includes('id="t-place"'));
ok('Fly too, being a mode rather than an action', leftCluster.includes('id="t-fly"'));
ok('and More', leftCluster.includes('id="t-more"'));
ok('Jump stays with the aiming hand', rightCluster.includes('id="t-jump"'));
ok('and Down, once you are flying', rightCluster.includes('id="t-down"'));

// Two buttons side by side is two buttons you can hit by mistake.
ok('neither side puts two buttons in a row', !/class="row"/.test(ui));
{
  // Reading down the left column: More at the top, then Fly, then the two you
  // press constantly at the bottom where the thumb already is.
  const order = [...leftCluster.matchAll(/id="(t-[a-z]+)"/g)].map((m) => m[1]);
  ok(`the left column reads ${order.join(', ')}`,
    JSON.stringify(order) === JSON.stringify(['t-more', 't-fly', 't-break', 't-place']));
}

// --- nothing on top of a stick ------------------------------------------------

// The bases are drawn from 102px off the bottom (the zone's 78 plus the base's
// own 24) to 206px. A column starting at 150 sat squarely on one.
{
  const zone = Number(css.match(/\.stick-zone \{[^}]*bottom: calc\((\d+)px/)[1]);
  const base = Number(css.match(/\.stick-base \{\s*\n?[^}]*bottom: (\d+)px/)[1]);
  const size = Number(css.match(/\.stick-base \{\s*\n?[^}]*width: (\d+)px/)[1]);
  const buttons = Number(css.match(/\.touch-buttons \{[^}]*bottom: calc\((\d+)px/)[1]);
  ok(`the stick base reaches ${zone + base + size}px up`, zone + base + size === 206);
  ok(`and the button column starts at ${buttons}px, above it`, buttons > zone + base + size);
}

// --- everything occasional is behind More -------------------------------------

for (const id of ['t-bag', 't-bench', 't-build', 't-skills', 't-designs', 't-roof', 't-clear', 't-symmetry', 't-screen']) {
  ok(`${id} is behind More`, tray.includes(`id="${id}"`));
}
// Fly changes what every other control does. Behind More it was a mode you
// could forget the game had.
ok('Fly is out on the glass, not in the tray', !tray.includes('id="t-fly"'));
ok('there is no always-on row of Duilt buttons any more', !ui.includes('touch-duilt-row'));

// A stack up the edge ran out of screen at the sixth tool and folded into a
// second column — two columns of controls, which is what one column was for.
ok('More opens a sheet rather than a stack', /\.touch-tray \{[\s\S]{0,300}display: grid/.test(css));
ok('which grows sideways within the screen rather than up past it',
  /grid-template-columns: repeat\(auto-fit/.test(css));
ok('and no longer needs a ceiling to stop it', !/max-height: calc\(100dvh - 530px\)/.test(css));
ok('it sits clear of the hotbar', /\.touch-tray \{[\s\S]{0,300}bottom: calc\(84px/.test(css));

// --- the guide stays at the top ----------------------------------------------

ok('the guide has a button at the top', /id="btn-guide"/.test(ui));
ok('and it is not hidden on a phone like the rest of the toolbar',
  !/touch-moved" id="btn-guide"/.test(ui));
ok('so it is gone from the tray', !tray.includes('id="t-guide"'));

// --- the goal list is out of the way ------------------------------------------

// It lived down the left side, which is now a column of controls.
// Under the XP bar and the hunger bar, which own the top-left corner.
ok('the goals go to the top on a phone', /body\.touch #goals \{[^}]*top: calc\(84px/.test(css));
ok('and start folded there, being a reminder rather than a readout',
  /return !document\.body\.classList\.contains\('touch'\);/.test(duiltUi));
ok('but a tap still opens the whole list', /toggle\.addEventListener\('click', \(\) => this\.setGoalsOpen\(!this\.goalsOpen\)\)/.test(duiltUi));
ok('and the choice is remembered either way', /if \(saved !== null\) return saved !== '0';/.test(duiltUi));

ok('the top toolbar still has room without wrapping', /#top-buttons \{[^}]*max-width: 58%/.test(css));

process.exit(f ? 1 : 0);
