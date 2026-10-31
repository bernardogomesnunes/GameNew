// IMP-10 step 5: the kiln and foundry panels, shaped like the barracks: what
// comes out, how far the one going is, and what it needs.
import assert from 'node:assert/strict';

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
globalThis.document ??= { createElement: () => ({ style: {}, setAttribute() {}, append() {} }), querySelector: () => null };
const { DuiltUI } = await import('../src/ui/DuiltUI.js');
const { STRUCTURES_BY_ID, intervalAt } = await import('../src/config/structures.js');

const kiln = STRUCTURES_BY_ID.get('kiln'), foundry = STRUCTURES_BY_ID.get('foundry');
const period = intervalAt(kiln, 0) * 1000;
const ui = { duilt: { structures: { dayScale: 1 }, inventory: { countOf: (id) => (id === 'iron_ore' ? 7 : 0) } } };
ui.firingProgress = DuiltUI.prototype.firingProgress;

const half = ui.firingProgress({ lastPaidAt: 0, tier: 0 }, kiln, period / 2);
assert.equal(half.ratio, 0.5);
assert.match(half.text, /2 h 0 min left/);
const owed = ui.firingProgress({ lastPaidAt: 0, tier: 0 }, kiln, period * 2);
assert.equal(owed.ratio, 1);
assert.match(owed.text, /room/);
assert.equal(ui.firingProgress({ lastPaidAt: 0 }, foundry, 10), null, 'the foundry has no timer');
console.log('PASS the kiln shows how far its firing is and what it waits on');

const html = DuiltUI.prototype.firingHtml.call(ui, { valid: true, lastPaidAt: Date.now(), tier: 0 }, kiln);
assert.match(html, /Firing/);
assert.match(html, /progressbar/);
assert.match(html, /Brick/);
assert.equal(DuiltUI.prototype.firingHtml.call(ui, { valid: false, lastPaidAt: 0 }, kiln), '');
console.log('PASS the kiln panel shows each firing and its bar');

const stock = DuiltUI.prototype.foundryStockHtml.call(ui, foundry);
assert.match(stock, /In your bag/);
assert.match(stock, /Iron Ore/);
assert.match(stock, /<b>7<\/b>/);
console.log('PASS the foundry panel shows the ore you carry');
