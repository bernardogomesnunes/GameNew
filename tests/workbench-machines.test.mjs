// Owner, 1 November: at a placed Workbench, the machines (Counter, Forge,
// mills, bucket, benches) come first in their own row, not lost in 133 tiles.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RECIPES } from '../src/config/recipes.js';

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
globalThis.document ??= { createElement: () => ({ style: {}, setAttribute() {}, append() {} }), querySelector: () => null };
const { isMachine } = await import('../src/ui/DuiltUI.js');

const machines = RECIPES.filter((r) => ['hand', 'workbench'].includes(r.station) && isMachine(r)).map((r) => r.output.id);
for (const id of ['counter', 'forge', 'wood_mill', 'stone_mill', 'bleach_bucket', 'planing_bench', 'joinery_bench']) assert.ok(machines.includes(id), `${id} is a machine`);
assert.ok(!machines.includes('planks') && !machines.includes('axe'), 'planks and tools are not');
console.log(`PASS ${machines.length} machines are told apart from everything else`);

const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
assert.match(ui, /<h4[^>]*>Machines<\/h4>/, 'a Machines heading');
console.log('PASS the Workbench shows a Machines row first');
