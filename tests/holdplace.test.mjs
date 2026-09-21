import { readFileSync } from 'node:fs';

/**
 * Requested directly: "when placing blocks would be nice to have similar
 * behaviour to breaking, and place multiple ones if i keep clicking."
 *
 * Break has held-to-repeat: a mouse button or a touch button held down past
 * a short delay keeps firing every interval, so clearing or building a wall
 * doesn't mean forty separate clicks. Place never had that — one tap, one
 * block, always. This mirrors the same mechanism (setBreaking/tickBreaking,
 * the mousedown/mouseup wiring, the touch button's hold) for Place.
 *
 * Game.js and UIManager can't run outside a browser (no canvas, no DOM), so
 * this is checked the way account.test.mjs checks other Game.js wiring: the
 * source itself, not a live instance.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

// --- the repeat mechanism itself, mirroring Break's ---------------------

ok('placing has its own held-since/last-fired state, like breaking',
  /this\.placing = false;/.test(game) && /this\.placeHeldSince = 0;/.test(game) && /this\.lastPlaceAt = 0;/.test(game));
ok('setPlacing starts the hold the same way setBreaking does',
  /setPlacing\(on\) \{\s*const want = on && !this\.armed && !this\.moving;/.test(game));
ok('tickPlacing waits out the same kind of delay-then-interval as tickBreaking',
  /tickPlacing\(now\) \{\s*if \(!this\.placing\) return;\s*if \(now - this\.placeHeldSince < HOLD_PLACE_DELAY_MS\) return;\s*if \(now - this\.lastPlaceAt < HOLD_PLACE_INTERVAL_MS\) return;/.test(game));
ok('and each fire actually places a block', /tickPlacing\(now\) \{[\s\S]{0,300}this\.placeBlock\(\);/.test(game));
ok('the frame loop drives it every frame, next to tickBreaking',
  /this\.tickBreaking\(performance\.now\(\)\);\s*this\.tickPlacing\(performance\.now\(\)\);/.test(game));

// --- mouse: right button held down keeps placing -----------------------

ok('right mousedown starts the hold, not just one placeBlock',
  /e\.button === 2\) \{ this\.secondaryAction\(\); this\.setPlacing\(true\); \}/.test(game));
ok('every way a button can stop being down also stops placing',
  /this\.setBreaking\(false\); this\.setPlacing\(false\);/.test(game));
ok('leaving the playing phase stops a held place, the same as a held break',
  /this\.setBreaking\(false\);\s*this\.setPlacing\(false\);/.test(game));

// --- touch: the Place button holds, like the Break button already does --

ok('Game wires a hold callback for Place, like it already does for Break',
  /onBreakHold: \(held\) => this\.setBreaking\(held\),\s*onPlaceTap: \(\) => this\.secondaryAction\(\),\s*onPlaceHold: \(held\) => this\.setPlacing\(held\),/.test(game));
ok('the Place button listens for touchstart/touchend/touchcancel like Break does',
  /const btn = this\.q\('#t-place'\);[\s\S]{0,400}touchstart[\s\S]{0,150}touchend[\s\S]{0,150}touchcancel/.test(ui));
ok('a touch on Place fires the hold callback the same way Break does',
  /this\.cb\.onPlaceTap\(\);\s*this\.cb\.onPlaceHold\?\.\(true\);/.test(ui));

process.exit(f ? 1 : 0);
