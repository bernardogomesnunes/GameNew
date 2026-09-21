import { readFileSync } from 'node:fs';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';

/**
 * Requested directly, out of the farm confusion this session already dug
 * into: a building card only ever said what you were short, never what the
 * whole thing actually costs — "4 more turned soil" and never the 16 it
 * really takes, so the only way to learn the real number was to try, fail,
 * and subtract. Every card with a stampable starter design now also shows
 * its full cost up front, unconditionally, not only when you can't afford it.
 *
 * DuiltUI needs a DOM this suite doesn't have, so the rendering itself is
 * checked against the source, the way account.test.mjs checks other
 * Game.js/UI wiring; the cost numbers themselves are checked for real
 * against the actual starter designs, since that's what would go stale.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

ok('a card computes its full cost from the design, not the shortfall',
  /const costLine = design\s*\? Object\.entries\(design\.cost\)/.test(ui));
ok('and shows it unconditionally, not only when something is missing',
  /\$\{costLine \? `<span>Costs: \$\{costLine\}<\/span>` : ''\}/.test(ui));
ok('the shortfall note still exists alongside it, for what is actually missing',
  /design && !canStamp \? this\.shortfallNote\(shortfall\)/.test(ui));

// The real number this session's farm confusion was actually about.
const farm = DESIGN_FOR_STRUCTURE.get('farm');
ok('the farm starter plot costs 16 turned soil, not the 4 the claim check alone needs',
  farm.cost.farmland === 16);

process.exit(f ? 1 : 0);
