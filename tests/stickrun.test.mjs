import { readFileSync } from 'node:fs';

/**
 * Played on a phone: "the joystick on the left needs to be slightly bigger.
 * The buttons on top can be slightly smaller. And the difference between
 * walking and running needs to be more pronounced or else I'll be sprinting
 * all the time. Make sure it's only sprinting when reaching max front."
 * And: "when searching for an item in the bench pop up, the pop up reduces a
 * lot its size if it shows only one item — would be nice to have it fixed
 * height to keep the same view".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// Running is past the rim, straight ahead — the rim itself walks.
const reach = Number(ui.match(/const STICK_RUN_REACH = ([\d.]+);/)[1]);
const spread = Number(ui.match(/const STICK_RUN_SPREAD = ([\d.]+);/)[1]);
ok(`you run only with the thumb carried past the knob's reach (${reach}×)`, reach > 1.2);
ok(`and only straight ahead (within ${Math.round(Math.atan(spread) * 180 / Math.PI)}°)`, spread > 0.3 && spread < 0.8);
ok('the stick decides, from how far up the thumb is',
  /running = -dy >= RADIUS \* STICK_RUN_REACH && Math\.abs\(dx\) <= -dy \* STICK_RUN_SPREAD;/.test(ui));
ok('walking is measured inside the rim, so the rim is full walking pace',
  /if \(len > RADIUS\) \{ dx = \(dx \/ len\) \* RADIUS; dy = \(dy \/ len\) \* RADIUS; \}\s*setKnob/.test(ui));
ok('and handed on to the game', /onChange\(out\.x, -out\.y, running\);/.test(ui) && /this\.player\.stickSprint = running;/.test(game));
ok('letting go stops running', /running = false;\s*base\.classList\.remove\('active', 'running'\);/.test(ui));
ok('you can see it: the rim lights and the knob goes over it', /\.stick-base\.running \{/.test(css) && /STICK_RUN_KNOB/.test(ui));
ok('the reach follows the base as drawn', /RADIUS = Math\.max\(30, base\.offsetWidth \* 0\.4\)/.test(ui));

// Simulated: where the thumb is → walking or running.
const RADIUS = 43;
const runs = (dx, dy) => -dy >= RADIUS * reach && Math.abs(dx) <= -dy * spread;
ok('the thumb at the rim, straight up, walks', !runs(0, -RADIUS));
ok('a little over the rim still walks', !runs(0, -RADIUS * 1.2));
ok('well past it, straight up, runs', runs(0, -RADIUS * 1.7));
ok('well past it but off to the side walks', !runs(RADIUS * 1.5, -RADIUS * 1.6));
ok('backwards never runs', !runs(0, RADIUS * 2));

// Sizes on a phone.
const phone = css.slice(css.indexOf(':root { --stick-inset: 72px'));
const size = Number(phone.match(/--stick-size: (\d+)px/)[1]);
ok(`the walking stick is bigger on a phone (${size}px, was 84)`, size >= 104);
ok('its knob is centred on it whatever the size', /top: calc\(\(var\(--stick-size\) - var\(--knob\)\) \/ 2/.test(css));
const btn = Number(phone.match(/\.touch-buttons \.touch-btn \{ width: (\d+)px; height: (\d+)px/)[1]);
ok(`the column above it is smaller (${btn}px, was 56)`, btn < 56 && btn >= 44);

// The bench keeps its height while you search.
ok('the bench and the buildings list keep their height while searching',
  /#panel-bench > \.panel, #panel-buildings > \.panel \{ height: min\(86vh, 760px\); \}/.test(css));

process.exit(f ? 1 : 0);
