// IMP-10 step 4: the chisel is held, and Break with it turns a block into its
// decorative form.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');
const { CHISELLED, BLOCKS_BY_ID } = await import('../src/config/blocks.js');

const name = (id) => BLOCKS_BY_ID.get(id)?.name;
assert.equal(name(CHISELLED.get(3)), 'Stone Brick');
assert.equal(name(CHISELLED.get(333)), 'Sandstone Brick');
assert.equal(name(CHISELLED.get(156)), 'Dark Brick');
assert.equal(name(CHISELLED.get(17)), 'Marble Pillar');
for (const [from, to] of CHISELLED) assert.ok(BLOCKS_BY_ID.get(from) && BLOCKS_BY_ID.get(to), `${from} -> ${to} are real blocks`);
console.log('PASS every chisel step goes from a real block to its decorative form');

function fake(block) {
  const g = {
    applied: null, toasts: [], world: { getBlock: () => block },
    raycast: () => ({ x: 1, y: 2, z: 3, block }),
    hitBandit: () => false, hitMob: () => false,
    applyChanges(changes, opts) { g.applied = { changes, opts }; return true; },
    ui: { toast: (t) => g.toasts.push(t) }, sound: { dig() {} },
  };
  return g;
}
const g = fake(3);
Game.prototype.chiselBlock.call(g);
assert.deepEqual(g.applied.changes, [{ x: 1, y: 2, z: 3, prev: 3, next: 329 }]);
assert.equal(g.applied.opts.chargeResources, false);
assert.equal(g.applied.opts.gather, false);
console.log('PASS it goes through the usual edit rules, spending and gathering nothing');

const h = fake(1);
Game.prototype.chiselBlock.call(h);
assert.equal(h.applied, null);
assert.equal(h.toasts.length, 1);
console.log('PASS a block it cannot shape is left alone, and it says so');

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
assert.match(game, /carpentry_chisel: 'chiselBlock'/);
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
assert.match(ui, /carpentry_chisel: \['Chisel', 'Place'\]/);
console.log('PASS held, Break says Chisel and chisels');
