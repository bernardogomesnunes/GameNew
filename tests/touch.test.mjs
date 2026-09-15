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
ok('Break is beside the stick that walks', sideLeft.includes('id="t-break"'));
ok('Jump is beside the stick that aims', sideRight.includes('id="t-jump"'));
ok('with Down under it, once you are flying', sideRight.includes('id="t-down"'));
{
  // One button on the ground, two in the air. Up has to be the upper one —
  // it was the lower one, which is a control arguing with its own arrow.
  const order = [...sideRight.matchAll(/id="(t-[a-z]+)"/g)].map((m) => m[1]);
  ok(`the flying pair reads ${order.join(', ')}`,
    JSON.stringify(order) === JSON.stringify(['t-jump', 't-down']));
  ok('and Jump is the one that becomes Up', /label\.textContent = flying \? 'Up' : 'Jump'/.test(ui));
  // Dropping Down into the slot the single button had means a thumb reaching
  // for Up by reflex sinks instead.
  ok('the pair moves off the slot the single button had',
    /this\.q\('#side-right'\)\?\.classList\.toggle\('paired'/.test(ui)
    && /\.stick-side\.paired \{ transform: translateY\(calc\(var\(--side-btn\) \/ 2\)\)/.test(css));
  // Straddling needs room underneath, and sideways the hotbar is right there.
  ok('and lifts instead of straddling where there is no room below',
    /body\.touch \.stick-side\.paired \{ transform: translateY\(calc\(var\(--side-btn\) \/ -2\)\)/.test(css));
  ok('the button size is one name, so the maths cannot drift from it',
    /--side-btn: 54px/.test(css) && /--side-btn: 50px/.test(css) && /--side-btn: 40px/.test(css)
    && /\.touch-btn\.small \{ width: var\(--side-btn\)/.test(css));
}
ok('and neither is left up in the column',
  !column.includes('id="t-jump"') && !column.includes('id="t-break"'));
// Break inboard and Jump outboard, which is why they anchor differently — and
// why the two sticks are inset differently: each sits as far out as its own
// side allows, which is what keeps air in the middle of a 320px screen.
ok('Break is anchored past the walking stick',
  /#side-left \{ left: calc\(var\(--stick-edge\) \+ var\(--stick-size\) \+ 10px\); \}/.test(css));
ok('and Jump against the edge, outboard of the aiming one',
  /#side-right \{ right: var\(--stick-edge\); \}/.test(css));
ok('so the stick with nothing outboard sits at the edge',
  /#stick-left \.stick-base \{ left: var\(--stick-edge\); \}/.test(css));
ok('and the one with Jump beside it comes in past it',
  /#stick-right \.stick-base \{ right: var\(--stick-inset\); \}/.test(css));
ok('and they are centred on the base, so the reach is sideways only',
  /\.stick-side \{[\s\S]{0,200}\(var\(--stick-size\) - var\(--side-btn\)\) \/ 2/.test(css));
// Smaller than a column button: the edge strip they sit in is narrow, and the
// stick has to be inset past them without crowding the middle.
{
  const col = Number(css.match(/\.touch-btn \{\n  width: (\d+)px/)[1]);
  const side = Number(css.match(/--side-btn: (\d+)px/)[1]);
  ok(`a stick-side button is ${side}px against the column's ${col}px`, side < col);
}

// --- what is left in the column ----------------------------------------------

ok('Place is in the column, where Break used to be', column.includes('id="t-place"'));
ok('Fly too, being a mode rather than an action', column.includes('id="t-fly"'));
ok('and More', column.includes('id="t-more"'));

// Two buttons side by side is two buttons you can hit by mistake.
ok('nothing is laid out in a row', !/class="row"/.test(ui));
{
  const order = [...column.matchAll(/id="(t-[a-z]+)"/g)].map((m) => m[1]);
  ok(`the column reads ${order.join(', ')}`,
    JSON.stringify(order) === JSON.stringify(['t-more', 't-fly', 't-place']));
}

// --- nothing on top of a stick ------------------------------------------------

// The column is what used to sit on a base: at 150px it started inside one, so
// a thumb reaching to walk hit Fly. The stick-side buttons are beside a base,
// never on it, which the browser check on two phone sizes confirms.
{
  const vars = (from) => ({
    inset: Number(from.match(/--stick-inset: (\d+)px/)[1]),
    size: Number(from.match(/--stick-size: (\d+)px/)[1]),
    bottom: Number(from.match(/--stick-bottom: (\d+)px/)[1]),
    zone: Number(from.match(/--stick-zone: (\d+)px/)[1]),
    gap: Number(from.match(/--stick-gap: (\d+)px/)[1]),
  });
  const big = vars(css.slice(css.indexOf(':root {'), css.indexOf('.icon {')));
  const small = vars(css.slice(css.indexOf(':root { --stick-inset: 72px')));
  const top = (v) => v.zone + v.bottom + v.size;
  ok(`the stick base reaches ${top(big)}px up`, top(big) === 206);
  ok(`and the column starts ${big.gap}px above it`, big.gap > 0);
  ok('a smaller screen shrinks the base and pulls it in', small.size < big.size && small.inset < big.inset);
  // Four things across the bottom: the left stick, Break, the right stick and
  // Jump. They have to clear each other on the narrowest phone worth caring
  // about, which is where this arrangement is actually tested.
  const edge = Number(css.match(/:root \{ --stick-inset: 72px; --stick-edge: (\d+)px/)[1]);
  const side = 50;
  ok(`the aiming stick is inset ${small.inset}px, past Jump's ${edge + side}px`,
    small.inset >= edge + side + 4);
  for (const w of [320, 360, 393, 430]) {
    const breakEnds = edge + small.size + 10 + side;
    const rightBase = w - small.inset - small.size;
    ok(`at ${w}px Break clears the aiming stick by ${rightBase - breakEnds}px`, rightBase > breakEnds);
  }
}

// --- everything occasional is behind More -------------------------------------

for (const id of ['t-bag', 't-bench', 't-build', 't-skills', 't-designs', 't-roof', 't-stats', 't-screen']) {
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

// --- what is left at the top --------------------------------------------------

// The How to play panel is gone — the goals teach the game now — so the top
// right is the one button that is not a game control at all.
ok('there is no guide button any more', !/id="btn-guide"/.test(ui));
ok('and the menu reads as settings', /id="btn-menu"[^>]*>\$\{icon\('settings'\)\}<span>Settings<\/span>/.test(ui));
ok('the goals moved into the tray with everything else you open', tray.includes('id="t-stats"'));
// Made, not given.
ok('Clear and Mirror are there only once you have made the tool',
  /id="t-clear" data-tool="clear" hidden/.test(ui) && /id="t-symmetry" data-tool="mirror" hidden/.test(ui));
ok('and the game says which ones you hold', /heldTools:/.test(readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8')));

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

// --- a phone on its side ------------------------------------------------------

// Turned sideways a phone keeps its width and loses two thirds of its height.
// Both things this broke were the same mistake in different places: a number
// that assumed portrait.
{
  const short = css.slice(css.indexOf('@media (max-height: 560px) and (pointer: coarse)'));
  const v = (name) => Number(short.match(new RegExp(`--${name}: (\\d+)px`))[1]);
  const num = (re) => Number(short.match(re)[1]);

  ok('there is a block for a short screen at all', short.startsWith('@media (max-height'));
  // 890px wide, so every "this is a phone" rule keyed to a narrow viewport
  // stopped applying and it got the desktop's chrome.
  ok('and a phone gets phone chrome by its pointer, not just its width',
    /@media \(max-width: 640px\), \(pointer: coarse\) \{/.test(css));
  ok('the goal list and the XP bar go, being what you can most afford to lose',
    /body\.touch #goals \{ display: none; \}/.test(short)
    && /body\.touch #hud-top \{ display: none; \}/.test(short));
  ok('the hunger bar stays, since running out of it stops you working',
    /body\.touch #vitals \{ top: 8px; left: 64px; \}/.test(short));

  // The column used to be anchored 230px up: three 62px buttons on it need
  // 436, and a landscape phone has about 390. It ran off the top of the screen.
  ok('the column is anchored above the stick rather than at a number',
    /bottom: calc\(var\(--stick-zone\) \+ var\(--stick-bottom\) \+ var\(--stick-size\) \+ var\(--stick-gap\)/.test(css));
  ok('so shrinking the stick brings the column down with it',
    v('stick-zone') < 78 && v('stick-size') < 104 && v('stick-gap') < 24);

  // Does it actually fit? The column has to start below the chrome and end
  // above the stick base, on every height a phone on its side can be.
  const btn = num(/body\.touch \.touch-btn \{ width: (\d+)px/);
  const gap = num(/body\.touch \.touch-buttons \{ gap: (\d+)px/);
  const baseTop = v('stick-zone') + v('stick-bottom') + v('stick-size');
  const colBottom = baseTop + v('stick-gap');
  const colTop = colBottom + 3 * btn + 2 * gap;
  ok(`the column clears the stick base by ${v('stick-gap')}px`, colBottom > baseTop);
  for (const h of [320, 340, 390, 430]) {
    ok(`at ${h}px tall the column sits ${h - colTop}px from the top`, h - colTop > 8 && colTop < h);
  }
  ok('a button is still big enough to hit', btn >= 40);
  // The sheet is most of the screen at this height, so it has to scroll rather
  // than run off the top with half the tools past the edge.
  ok('the More sheet scrolls instead of overflowing', /body\.touch \.touch-tray \{[\s\S]{0,200}overflow-y: auto/.test(short));
}

ok('the top toolbar still has room without wrapping', /#top-buttons \{[^}]*max-width: 58%/.test(css));

process.exit(f ? 1 : 0);
