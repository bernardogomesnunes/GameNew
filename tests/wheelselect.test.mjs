import { readFileSync } from 'node:fs';

/**
 * Requested directly: "would be nice for the scroll to change the item im
 * selecting, this way im not limited to the numbers or clicking esc" — the
 * hotbar could only be moved by a number key or a direct click; the wheel
 * did nothing. This wires it to the same selection the number keys and
 * clicks already use, so it works identically in Duilt and Creative without
 * caring which one it is.
 *
 * Game.js and UIManager can't run outside a browser (no canvas, no DOM), so
 * this is checked the way the rest of this session's input changes were:
 * against the source itself.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

ok('the canvas listens for wheel', /canvas\.addEventListener\('wheel', \(e\) => \{/.test(game));
ok('only while actually playing, not mid-panel or mid-move',
  /canvas\.addEventListener\('wheel'[\s\S]{0,80}if \(!this\.pointerLocked \|\| this\.moving\) return;/.test(game));
ok('it drives the same cycle the hotbar already has', /this\.ui\.cycleHotbarByDelta\(Math\.sign\(e\.deltaY\)\);/.test(game));
ok('and stops the page itself from scrolling', /canvas\.addEventListener\('wheel'[\s\S]{0,500}\{ passive: false \}\);/.test(game));

ok('cycleHotbarByDelta reads the same DOM the click handler and number keys do',
  /cycleHotbarByDelta\(delta\) \{\s*const slots = \[\.\.\.this\.root\.querySelectorAll\('#hotbar \.hotbar-slot'\)\]/.test(ui));
ok('a locked Creative slot is skipped, not landed on',
  /cycleHotbarByDelta\(delta\)[\s\S]{0,200}filter\(\(s\) => !s\.classList\.contains\('locked'\)\)/.test(ui));
ok('it wraps around both ends', /\(current \+ delta \+ slots\.length\) % slots\.length/.test(ui));
ok('and dispatches through the same selectItem\\/selectBlock split every other entry point uses',
  /cycleHotbarByDelta\(delta\)[\s\S]{0,400}if \(next\.dataset\.tool\) this\.selectItem\(next\.dataset\.item\);\s*else this\.selectBlock\(Number\(next\.dataset\.id\)\);/.test(ui));

process.exit(f ? 1 : 0);
