import { readFileSync } from 'node:fs';
import { materialOf } from '../src/config/blocks.js';
import { toolEffectiveness } from '../src/config/items.js';

/**
 * Requested as part of the tool system: "axes break plants and wood very
 * fast, but dirt slow, and rock is not possible. Pickaxes break rock and
 * hard materials, shovel dirt and so on" — with the explicit rule that bare
 * hands should always work, just slowly, never gated to impossible.
 *
 * materialOf/toolEffectiveness are the pure data half of that (config/
 * blocks.js and config/items.js); Game.js's breakDelayFor and breakBlock,
 * which can't run outside a browser, are checked against the source the
 * way the rest of Game.js's wiring is.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- what a block is made of -------------------------------------------------

ok('wood is wood', materialOf(4) === 'wood');
ok('leaves are a plant', materialOf(5) === 'plant');
ok('dirt is dirt', materialOf(2) === 'dirt');
ok('grass is dirt too — a shovel, not an axe, clears turf', materialOf(1) === 'dirt');
ok('stone is stone', materialOf(3) === 'stone');
ok('gravel counts as stone — a pickaxe job, not a shovel one', materialOf(23) === 'stone');
ok('a worked material like glass has none — no tool specialises in it', materialOf(10) === null);
ok('air has none', materialOf(0) === null);

// --- what a tool is actually for ---------------------------------------------

ok('an axe is fast on wood and plants', toolEffectiveness('axe', 'wood') === 'fast' && toolEffectiveness('axe', 'plant') === 'fast');
ok('slow on dirt', toolEffectiveness('axe', 'dirt') === 'slow');
ok('and flatly refuses stone', toolEffectiveness('axe', 'stone') === 'impossible');

ok('a pickaxe is fast on stone', toolEffectiveness('pickaxe', 'stone') === 'fast');
ok('but never impossible anywhere — just slow at everything else',
  toolEffectiveness('pickaxe', 'wood') === 'slow'
  && toolEffectiveness('pickaxe', 'plant') === 'slow'
  && toolEffectiveness('pickaxe', 'dirt') === 'slow');

ok('a shovel is fast on dirt', toolEffectiveness('shovel', 'dirt') === 'fast');
ok('and also never impossible', toolEffectiveness('shovel', 'stone') === 'slow');

// --- bare hands are the one thing that is never gated ------------------------

for (const material of ['wood', 'plant', 'dirt', 'stone']) {
  ok(`nothing selected is always 'normal' on ${material}, never impossible`,
    toolEffectiveness(null, material) === 'normal');
  ok(`neither is a non-mining item, like a bucket, on ${material}`,
    toolEffectiveness('bucket', material) === 'normal');
}
ok('an unrecognised material is always normal, whatever is selected',
  toolEffectiveness('axe', null) === 'normal' && toolEffectiveness('pickaxe', undefined) === 'normal');

// --- wired into breakBlock, the way holding/tapping already are -------------

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

ok('breakDelayFor reads the tool actually selected against what the block is made of',
  /breakDelayFor\(blockId\) \{[\s\S]{0,200}toolEffectiveness\(this\.selectedItemId, materialOf\(blockId\)\)/.test(game));
ok('an impossible pairing never costs time — it just refuses', /if \(tier === 'impossible'\) return \{ ms: 0, blocked: true, tier \};/.test(game));
ok('this only applies in Duilt — Creative keeps breaking instantly', /breakBlock\(\) \{[\s\S]{0,300}if \(this\.duilt\) \{/.test(game));
ok('digging progress is tracked by the block, not the click, so taps and holds both count',
  /isNewTarget = !this\.digTarget \|\| this\.digTarget\.key !== key/.test(game));
ok('a blocked attempt says why, once per new target rather than spamming while held',
  /if \(isNewTarget\) \{[\s\S]{0,250}Can't break that/.test(game));
ok('and a slow or normal break genuinely waits out its own delay before landing',
  /if \(ms > 0 && performance\.now\(\) - this\.digTarget\.startedAt < ms\) return;/.test(game));

// --- wear: the cost of the speed bonus, not of using the tool at all --------

ok('a tool only wears breaking something it is actually fast against',
  /if \(tier === 'fast'\) wornBy = this\.selectedItemId;/.test(game));
ok('wear only lands once the break actually happened, not on a refused or still-in-progress one',
  /const broke = this\.applyChanges\([\s\S]{0,150}if \(broke && wornBy\) \{/.test(game));
ok('spending the last use says the tool broke, by name', /`\$\{itemName\(wornBy\)\} broke`/.test(game));
ok('and reuses Inventory.useTool rather than a second wear mechanic', /this\.duilt\.inventory\.useTool\(wornBy\)/.test(game));

process.exit(f ? 1 : 0);
