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
 * The two you press between every other thing you press sit against their own
 * stick — Jump by the one that walks, Place by the one that aims — and the
 * rest is one column down the left edge. Nothing overlaps a stick, nothing
 * sits beside anything else, and everything occasional is behind More in a
 * sheet rather than stacked up the edge.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const duiltUi = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

const column = ui.slice(ui.indexOf('id="touch-buttons-left"'), ui.indexOf('</div>\n    `;', ui.indexOf('id="touch-buttons-left"')));
const sideLeft = ui.slice(ui.indexOf('id="side-left"'), ui.indexOf('id="side-right"'));
const sideRight = ui.slice(ui.indexOf('id="side-right"'), ui.indexOf('id="touch-buttons-left"'));
const tray = ui.slice(ui.indexOf('id="touch-tray"'), ui.indexOf('</div>', ui.indexOf('id="touch-tray"')));

// --- which thumb does what ---------------------------------------------------

ok('the left stick walks', /bindStick\('#stick-left', \(x, y\) => this\.cb\.onMove/.test(ui));
ok('the right stick aims the camera', /bindStick\('#stick-right', \(x, y\) => this\.cb\.onLookStick/.test(ui));
// The camera keeps the finer curve wherever it lives; it is a property of
// aiming, not of a side of the screen. See the look-speed block below for what
// the number is and why.
ok('and the camera keeps its finer control near centre',
  /onLookStick[^\n]*curve: 1\.7/.test(ui) && /onMove[^\n]*curve: 1\.1/.test(ui));

// --- the two you press constantly sit against their own stick ----------------

// Reaching up the edge for the thing you press between every other thing you
// press is the reach that was costing time. Jump goes with the thumb that
// walks, Place with the thumb that aims.
ok('Jump is beside the stick that walks', sideLeft.includes('id="t-jump"'));
ok('with Down above it, once you are flying', sideLeft.includes('id="t-down"'));
ok('and Place beside the stick that aims', sideRight.includes('id="t-place"'));
ok('neither is left up in the column', !column.includes('id="t-jump"') && !column.includes('id="t-place"'));
// Outboard of either stick is the screen edge, so inboard is the only side
// there is — and the anchors say so in the stick's own terms rather than in a
// number that happens to match today.
ok('they anchor off the stick rather than a number',
  /#side-left \{ left: calc\(var\(--stick-inset\) \+ var\(--stick-size\)\); \}/.test(css)
  && /#side-right \{ right: calc\(var\(--stick-inset\) \+ var\(--stick-size\)\); \}/.test(css));
ok('so a smaller screen moves them with it, not onto it',
  /:root \{ --stick-inset: 16px; --stick-size: 88px;/.test(css));
ok('and they are centred on the base, so the reach is sideways only',
  /\.stick-side \{[\s\S]{0,200}\(var\(--stick-size\) - 54px\) \/ 2/.test(css));
// The middle of a 320px screen is only 112px wide once both sticks have theirs.
ok('a stick-side button is smaller than a column one',
  /\.touch-btn\.small \{ width: 54px/.test(css) && /\.touch-btn\.small \{ width: 50px/.test(css));

// --- what is left in the column ----------------------------------------------

ok('Break stays in the column', column.includes('id="t-break"'));
ok('Fly too, being a mode rather than an action', column.includes('id="t-fly"'));
ok('and More', column.includes('id="t-more"'));

// Two buttons side by side is two buttons you can hit by mistake.
ok('nothing is laid out in a row', !/class="row"/.test(ui));
{
  const order = [...column.matchAll(/id="(t-[a-z]+)"/g)].map((m) => m[1]);
  ok(`the column reads ${order.join(', ')}`,
    JSON.stringify(order) === JSON.stringify(['t-more', 't-fly', 't-break']));
}

// --- nothing on top of a stick ------------------------------------------------

// The column is what used to sit on a base: at 150px it started inside one, so
// a thumb reaching to walk hit Fly. The stick-side buttons are beside a base,
// never on it, which the browser check on two phone sizes confirms.
{
  const zone = Number(css.match(/\.stick-zone \{[^}]*bottom: calc\((\d+)px/)[1]);
  const vars = (from) => ({
    inset: Number(from.match(/--stick-inset: (\d+)px/)[1]),
    size: Number(from.match(/--stick-size: (\d+)px/)[1]),
    bottom: Number(from.match(/--stick-bottom: (\d+)px/)[1]),
  });
  const big = vars(css.slice(css.indexOf(':root {'), css.indexOf('.icon {')));
  const small = vars(css.slice(css.indexOf(':root { --stick-inset: 16px')));
  const buttons = Number(css.match(/\.touch-buttons \{[^}]*bottom: calc\((\d+)px/)[1]);
  ok(`the stick base reaches ${zone + big.bottom + big.size}px up`, zone + big.bottom + big.size === 206);
  ok(`and the column starts at ${buttons}px, above it`, buttons > zone + big.bottom + big.size);
  ok('a smaller screen shrinks the base and pulls it in', small.size < big.size && small.inset < big.inset);
  // 320px is the narrowest phone worth caring about; both sticks and both
  // stick-side buttons have to fit across it.
  for (const w of [320, 360, 393, 430]) {
    const gap = w - 2 * (small.inset + small.size) - 2 * 50;
    ok(`at ${w}px there is still ${gap}px between Jump and Place`, gap > 0);
  }
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

// --- you can see through them -------------------------------------------------

// They sit on top of the one thing you are trying to look at, so they are
// glass rather than slabs. The blur is what makes that readable: it settles
// whatever is behind a button into a wash instead of a busy hillside.
{
  const btn = css.slice(css.indexOf('.touch-btn {'), css.indexOf('.touch-btn .icon'));
  const alpha = Number(btn.match(/background: rgba\(13, 17, 23, ([\d.]+)\)/)[1]);
  ok(`a button is ${Math.round((1 - alpha) * 100)}% see-through`, alpha > 0.15 && alpha < 0.5);
  ok('with the blur kept, which is what keeps it readable', /backdrop-filter: var\(--blur\)/.test(btn));
  const stick = Number(css.match(/\.stick-base \{[\s\S]*?opacity: ([\d.]+);/)[1]);
  ok(`and a stick you are not holding is fainter still, at ${stick}`, stick < 0.45);
}
// A white glyph on glass over a bright sky is a white glyph on a bright sky.
ok('the icon carries its own shadow', /\.touch-btn \.icon \{[^}]*drop-shadow/.test(css));
ok('and so does the label', /\.touch-btn span \{[^}]*text-shadow/.test(css));
// No hover on a phone, so the press is the only feedback there is.
ok('pressing one brings it forward', /\.touch-btn:active \{[^}]*rgba\(13, 17, 23, 0\.68\)/.test(css));
ok('and a queued tool still reads as lit', /\.touch-btn\.active \{[^}]*border-color: var\(--accent\)/.test(css));
// Inside the sheet there is nothing to see through — it is on a solid panel —
// and hiding would only make them harder to read.
ok('the ones in the sheet stay solid', /\.touch-tray \.touch-btn \{ background: rgba\(255, 255, 255/.test(css));

// --- how fast the camera turns ------------------------------------------------

// A stick asks for a turn *rate*, so it trades top speed against fine aim, and
// this had been pushed too far the fast way: most of a full turn in a second,
// which reads as the camera running away from your thumb.
{
  const player = readFileSync(new URL('../src/player/PlayerController.js', import.meta.url), 'utf8');
  const n = (name) => Number(player.match(new RegExp(`const ${name} = ([\\d.]+);`))[1]);
  const yaw = n('LOOK_YAW_SPEED'), pitch = n('LOOK_PITCH_SPEED');
  const peak = yaw * n('LOOK_ACCEL_MAX') * 180 / Math.PI;
  ok(`full stick turns ${Math.round(yaw * 180 / Math.PI)} deg/s`, yaw * 180 / Math.PI < 150);
  ok(`and ${Math.round(peak)} deg/s with the ramp charged, under half a turn a second`, peak < 180);
  ok('pitch is slower than yaw, spanning only 180 degrees in all', pitch < yaw);
  // Most of what reads as "abrupt" is the first frame of a stick shoved from
  // rest going straight to full speed.
  ok(`the camera eases in over ${Math.round(1000 / n('LOOK_SMOOTHING'))}ms rather than snapping`,
    n('LOOK_SMOOTHING') <= 22 && n('LOOK_SMOOTHING') >= 8);
  ok('and the ramp takes its time getting there', n('LOOK_ACCEL_TIME') >= 0.7);
}
// Most of a look is a small correction; a linear stick spends nearly all its
// travel on speeds too fast to aim with.
ok('the look stick is curved harder than the walking one',
  /onLookStick[^\n]*curve: 1\.7/.test(ui) && /onMove[^\n]*curve: 1\.1/.test(ui));

ok('the top toolbar still has room without wrapping', /#top-buttons \{[^}]*max-width: 58%/.test(css));

process.exit(f ? 1 : 0);
