import { STRUCTURES_BY_ID } from '../src/config/structures.js';

/**
 * Reported directly: "on the buildings manage pop ups, we should not be
 * throwing [filler] text there, we should say what it produces, and what's
 * needed to evolve the building."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { DuiltUI } = await import('../src/ui/DuiltUI.js');
const does = (type, { level = null, summary = null, herd = [] } = {}) =>
  DuiltUI.prototype.buildingDoes.call({ duilt: { herd } }, { id: 's1', type, region: { minX: 0, maxX: 5, minY: 0, maxY: 3, minZ: 0, maxZ: 5 } }, STRUCTURES_BY_ID.get(type), level, summary);

ok('a forest says what it makes', /Makes \d+ wood/.test(does('forest')[0]));
ok('a quarry says what it makes at its level', /stone/.test(does('quarry', { level: { rate: { produces: { stone: 2 }, everySeconds: 8640 } } })[0]));
ok('a house says how many it houses', /Room for 1 settler household$/.test(does('house')[0]));
ok('a workshop says what it lets you do', /craft workshop recipes/.test(does('workshop')[0]));
ok('a storehouse says what it holds', /Stores your things: empty, 20 slots/.test(does('storehouse', { summary: { items: 0, used: 0, size: 20 } }).join()));
ok('an empty pen says what it would make', /none in it yet/.test(does('pen')[0]));
ok('a pen with sheep in it says what they give', /wool/.test(does('pen', { herd: [{ type: 'sheep', penId: 's1', x: 2, y: 1, z: 2 }] })[0]));
ok('a monument says it makes nothing, and why it counts', /Nothing to collect/.test(does('monument')[0]));

import { readFileSync } from 'node:fs';
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
ok('the long paragraph about locking is gone', !/Protected, so you cannot take a wall out of it/.test(ui));
ok('the next level lists what it still needs', /To evolve to \$\{next\.name\}/.test(ui) && /this\.needsHtml\(next\)/.test(ui));

process.exit(f ? 1 : 0);
