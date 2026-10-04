import { readFileSync } from 'node:fs';
import { DEFAULT_CONTROLS, touchLayoutClasses } from '../src/config/controls.js';

/**
 * Requested directly: "controls in mobile can be different, like allowing to
 * change sides of the buttons." Two choices in Settings › Controls: which
 * side the walking stick is on, and which thumb Break, Place, Fly and More
 * sit beside.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

ok('by default you walk on the left, with the buttons by that thumb',
  DEFAULT_CONTROLS.walkSide === 'left' && DEFAULT_CONTROLS.actionSide === 'walk');
{
  const none = touchLayoutClasses(DEFAULT_CONTROLS);
  ok('and the default layout adds no classes', !Object.values(none).some(Boolean));
  const both = touchLayoutClasses({ walkSide: 'right', actionSide: 'look' });
  ok('walking on the right mirrors the sticks', both['touch-walk-right'] === true);
  ok('and the buttons can go by the aiming thumb', both['touch-act-look'] === true);
  ok('an old save with neither set gets the default', !Object.values(touchLayoutClasses({})).some(Boolean));
}

// Settings.
ok('there is a choice for each', /data-seg="walkSide"/.test(ui) && /data-seg="actionSide"/.test(ui));
ok('with a picture of where things go', /id="ctl-touch-preview"/.test(ui) && /function touchLayoutPreview/.test(ui));
ok('picking one applies it straight away', /apply\(\{ \[seg\.dataset\.seg\]: b\.dataset\.val \}\)/.test(ui));
ok('it is only offered on a touch screen', /\.ctl-touch \{ display: none; \}/.test(css) && /body\.touch \.ctl-touch \{ display: flex/.test(css));
ok('where the keyboard list is hidden instead', /body\.touch \.ctl-keys \{ display: none; \}/.test(css));

// Applied at start and on every change, and remembered with the rest of the controls.
ok('the layout is applied when the game starts', /this\.ui\.applyTouchLayout\(this\.controls\);\n\s*this\.ui\.refreshForMode\(\)/.test(game));
ok('and whenever the controls change', /applyControls\(next\) \{[\s\S]{0,400}this\.ui\?\.applyTouchLayout\(this\.controls\)/.test(game));

// The layout itself: each piece moves, none is left where it was.
for (const sel of ['#stick-left', '#stick-right', '#stick-left .stick-base', '#stick-right .stick-base', '#side-left', '#side-right', '#touch-buttons-left']) {
  ok(`mirrored, ${sel} moves`, css.includes(`body.touch-walk-right ${sel} {`));
}
ok('by the aiming thumb, Break and the column move over',
  css.includes('body.touch-act-look #side-left {') && css.includes('body.touch-act-look #touch-buttons-left {'));
ok('and both together put them back on the left, beside the aiming stick',
  css.includes('body.touch-act-look.touch-walk-right #side-left {') && css.includes('body.touch-act-look.touch-walk-right #touch-buttons-left {'));
// The sticks keep their jobs: only where they are changes.
ok('the walking stick still walks, and the picture still aims — only the sides move',
  /bindStick\('#stick-left', \(x, y\) => this\.cb\.onMove/.test(ui) && /this\.bindLookSurface\(\);/.test(ui));

process.exit(f ? 1 : 0);
