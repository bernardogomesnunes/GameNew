import { doorBlock } from '../src/config/blocks.js';

/**
 * Requested directly: "When looking at the door the controls should adapt so
 * place should be open or close depending on the door stage."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { swingLabel } = await import('../src/Game.js');
const { UIManager } = await import('../src/ui/UIManager.js');

ok('a shut door opens', swingLabel(doorBlock({})) === 'Open' && swingLabel(doorBlock({ top: true, facing: 2 })) === 'Open');
ok('an open door closes', swingLabel(doorBlock({ open: true })) === 'Close' && swingLabel(doorBlock({ open: true, top: true })) === 'Close');
ok('a shut gate opens, an open one closes', swingLabel(48) === 'Open' && swingLabel(49) === 'Close');
ok('anything else leaves Place as it was', swingLabel(3) === null && swingLabel(0) === null);

// The thumb buttons, on a stand-in for the UI.
const labels = {};
const btn = (id) => ({ querySelector: () => ({ set textContent(t) { labels[id] = t; } }), classList: { toggle() {} } });
const ui = Object.create(UIManager.prototype);
Object.assign(ui, { selectedItemId: null, q: (sel) => ({ '#t-break': btn('break'), '#t-place': btn('place') })[sel] });
ui.setAimedSwing('Open');
ok('aiming at a shut door, Place reads Open', labels.place === 'Open' && labels.break === 'Break');
ui.setAimedSwing('Close');
ok('at an open one, Close', labels.place === 'Close');
ui.setAimedSwing(null);
ok('looking away, it is Place again', labels.place === 'Place');
ui.selectedItemId = 'fruit';
ui.setAimedSwing('Open');
ok('whatever you are holding — even food, which would otherwise Throw', labels.place === 'Open' && labels.break === 'Eat');
ui.setAimedSwing(null);
ok('and back to Throw after', labels.place === 'Throw');
ui.armedTool = 'roof';
labels.place = 'Turn';
ui.setAimedSwing('Open');
ok('a queued tool keeps its own labels', labels.place === 'Turn');

process.exit(f ? 1 : 0);
