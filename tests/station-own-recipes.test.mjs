// Owner: "When I open the bleach bucket it's opening the workbench pop up."
// Using a placed station (a bleach bucket, a forge, a wood mill, a planing
// bench) shows what is made there, not every recipe in the game.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RECIPES } from '../src/config/recipes.js';
import { stationOf } from '../src/config/blocks.js';

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const duiltUI = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

assert.ok(/stationOf\(aimed\.block\)\) return void this\.ui\.openBench\('', stationOf\(aimed\.block\)\)/.test(game), 'Place on a station opens its own recipes');
assert.ok(/onOpenBench: \(\) => this\.ui\.openBench\(\)/.test(game), 'the menu still opens everything');
assert.ok(/openBench\(query = '', station = null\)/.test(ui) && /duiltUI\.benchStation = station/.test(ui));
assert.ok(/r\.station === only/.test(duiltUI), 'the list is limited to that station');
// IMP-14: no way out to the workbench's recipes from a station.
assert.ok(!/id="bench-all"/.test(duiltUI), 'no "Show every recipe" at a station');
// IMP-13: the station's own name is the title.
assert.ok(/title\.textContent = only \? stationTitle\(only\) : 'Bench'/.test(duiltUI), 'titled with the station');
console.log('PASS using a placed station opens only what is made there');

// And each station block has recipes of its own to show.
for (const station of ['bleach_bucket', 'forge', 'wood_mill']) {
  assert.ok(RECIPES.some((r) => r.station === station), `${station} has recipes`);
}
assert.equal(stationOf(524), 'bleach_bucket');
console.log('PASS every placed station has recipes to show');

const panels = readFileSync(new URL('../src/config/panels.js', import.meta.url), 'utf8');
assert.ok(/id: 'panel-bench',[\s\S]{0,200}titleId: 'bench-title'/.test(panels), 'the bench title can be rewritten');
console.log('PASS a station is titled with its own name, and lists only its own recipes');
