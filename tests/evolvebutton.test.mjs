import { readFileSync } from 'node:fs';

/**
 * Follow-up to levels.test.mjs and storehouse.test.mjs, which cover
 * StructureRegistry.evolve and tierStatus's canEvolve itself. This checks
 * the UI wiring on top of it: the button the building panel now shows
 * instead of reaching the next level the instant the blocks qualified.
 *
 * Reported directly, clarifying an earlier fix: "the progress is to evolve
 * a building to have a button in the pop up." DuiltUI/Game.js need a DOM and
 * a renderer this suite doesn't have, so — same as editbuilding.test.mjs and
 * buildingcost.test.mjs — the wiring is checked against the source.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const duiltGame = readFileSync(new URL('../src/duilt/DuiltGame.js', import.meta.url), 'utf8');

// --- the button only shows once tierStatus says the level is reachable -----

ok('the panel shows an Evolve button exactly when level.canEvolve says so',
  /\$\{level\?\.canEvolve \? `<button class="primary" data-evolve>Evolve to \$\{withArticle\(next\.name\)\}<\/button>` : ''\}/.test(ui));
ok('withArticle does not double up on a tier name that already carries its own',
  /function withArticle\(name\) \{\s*const lower = name\.toLowerCase\(\);\s*return \/\^an\? \/\.test\(lower\) \? lower : `a \$\{lower\}`;/.test(ui));
ok('and the panel says it is ready, instead of the old "settles on your next change to it" line',
  /Ready to evolve to \$\{next\.name\}/.test(ui)
  && !/settles there on your next change to it/.test(ui));
ok('the click wires to the same onEvolve callback Game.js supplies',
  /data-evolve.*addEventListener\('click', \(\) => actions\.onEvolve\?\.\(\)\)/.test(ui));

// --- Game.js: the button's press goes through the registry, not straight to state --

ok('buildingActions exposes onEvolve alongside change/move/delete',
  /onEvolve: \(\) => this\.evolveBuilding\(structure\)/.test(game));
ok('evolveBuilding asks the registry and only complains on the way back',
  /evolveBuilding\(structure\) \{\s*const r = this\.duilt\.structures\.evolve\(structure\.id\);\s*if \(!r\.ok\)/.test(game));

// --- DuiltUI redraws the open panel off the bus event, not a local call ----

ok('a level reached refreshes the open panel if it is the one that changed',
  /structure:upgraded.*\{[\s\S]{0,300}this\.building\?\.id === structure\?\.id[\s\S]{0,80}this\.showBuilding\(structure, this\.buildingActionsCache\)/.test(ui));
ok('so does a level lost — the demotion path fires the same redraw',
  /structure:downgraded.*\{[\s\S]{0,300}this\.building\?\.id === structure\?\.id[\s\S]{0,80}this\.showBuilding\(structure, this\.buildingActionsCache\)/.test(ui));
ok('the toast names the actual building, not always "storehouse" the way it used to for every leveled building',
  !/Your storehouse is now a/.test(ui)
  && /Your \$\{kind\} is now \$\{withArticle\(name\)\}/.test(ui));

// --- the two places that ask a live building's level pass its own tier -----

ok('storeSummary reads the level relative to what the structure actually stands at',
  /tierStatus\(this\.world, structure\.region, structure\.type, structure\.tier \?\? 0\)/.test(duiltGame));
ok('so does levelSummary — omitting the current tier would read the floor instead, not the button-gated state',
  (duiltGame.match(/tierStatus\(this\.world, structure\.region, structure\.type, structure\.tier \?\? 0\)/g) ?? []).length === 2);

process.exit(f ? 1 : 0);
