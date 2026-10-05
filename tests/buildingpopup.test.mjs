import { STRUCTURES_BY_ID } from '../src/config/structures.js';

/**
 * Reported directly: "on the buildings manage pop ups, we should not be
 * throwing [filler] text there, we should say what it produces, and what's
 * needed to evolve the building." And later: "Copy should be straightforward
 * about game, not about concepts, like 'what the building do? Builds nothing
 * yarda yada'".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { DuiltUI } = await import('../src/ui/DuiltUI.js');
const self = (herd) => ({ duilt: { herd }, makesOf: DuiltUI.prototype.makesOf });
const region = { minX: 0, maxX: 5, minY: 0, maxY: 3, minZ: 0, maxZ: 5 };
const does = (type, { level = null, summary = null, herd = [] } = {}) =>
  DuiltUI.prototype.buildingDoes.call(self(herd), { id: 's1', type, region }, STRUCTURES_BY_ID.get(type), level, summary);
const makes = (type, { level = null, herd = [] } = {}) =>
  DuiltUI.prototype.makesOf.call(self(herd), { id: 's1', type, region }, STRUCTURES_BY_ID.get(type), level);

ok('a forest makes wood, a day', makes('forest')?.wood >= 1);
ok('a forest needs no line saying so — the pills say it', does('forest').length === 0);
ok('a quarry makes stone at its level', makes('quarry', { level: { rate: { produces: { stone: 2 }, everySeconds: 8640 } } })?.stone >= 1);
ok('a house says who lives there', /^Home for one family\.$/.test(does('house')[0]));
ok('a workshop says what you make there', /^Make .+ here\.$/.test(does('workshop')[0]));
ok('a storehouse says what it holds', /^Empty — 20 slots\.$/.test(does('storehouse', { summary: { items: 0, used: 0, size: 20 } }).join()));
ok('an empty pen says what to do', /Lead sheep, cows or chickens in/.test(does('pen')[0]));
ok('a pen with sheep in it makes wool', makes('pen', { herd: [{ type: 'sheep', penId: 's1', x: 2, y: 1, z: 2 }] })?.wool >= 1);
ok('a monument says it makes nothing, plainly', /^Makes nothing\./.test(does('monument')[0]));
ok('a university says what you do there', does('university').includes('Research skills and engineering here.'));

import { readFileSync } from 'node:fs';
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
ok('the long paragraph about locking is gone', !/Protected, so you cannot take a wall out of it/.test(ui));
ok('the next level lists what it still needs', /Next: <strong>\$\{escapeHtml\(next\.name\)\}<\/strong>/.test(ui) && /this\.needsHtml\(next\)/.test(ui));
ok('Evolve sits with the level, not in the footer', /building-evolve" data-evolve/.test(ui) && !/building-tools[\s\S]{0,600}data-evolve/.test(ui));
ok('a building that fails to draw still opens, with its tools', /catch \(err\)[\s\S]{0,400}buildingToolsHtml/.test(ui));

process.exit(f ? 1 : 0);
