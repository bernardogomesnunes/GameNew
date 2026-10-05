import { readFileSync } from 'node:fs';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES, recipesFor } from '../src/config/recipes.js';
import { LOOT, lootFor } from '../src/duilt/Loot.js';
import { STRUCTURES } from '../src/config/structures.js';
import { itemIcon } from '../src/config/cubes.js';

/**
 * The batch: "There should be coins as an item, that can be found in chests
 * randomly or made in the foundry." / "Foundry need to change, the pop up
 * should have the list of things that can be crafted there, let's keep the
 * craft nearby functionality cause I love it." / "Apply the same method to
 * workbench and other similar buildings." / "items could be something shown
 * in a grid, with the icon and name, and the make button".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const coin = ITEMS_BY_ID.get('coin');
ok('coins are an item, with an icon of their own', !!coin && !!itemIcon(coin, { size: 22 }));
const strike = RECIPES.filter((r) => r.output?.id === 'coin');
ok('struck at the foundry', strike.length >= 1 && strike.every((r) => r.station === 'foundry'));
ok('and only there', recipesFor(9, 'foundry').some((r) => r.output.id === 'coin'));

ok('every kind of chest can hold coins', Object.values(LOOT).every((t) => t.items.some(([id]) => id === 'coin')));
ok('added last, so a chest still rolls what it rolled before',
  Object.values(LOOT).every((t) => t.items[t.items.length - 1][0] === 'coin'));
let found = 0;
for (let i = 0; i < 200; i++) if (lootFor('cave', i * 7, 20, i * 13, 1234).coin) found++;
ok('and some do, but not all', found > 40 && found < 200);

const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
ok('a station\'s popup lists what it makes', /\$\{this\.stationRecipesHtml\(spec\)\}/.test(ui)
  && /d\.crafting\.available\(d\.age, \{ station: spec\.station, near, atStations: d\.stationsNear\(near\) \}\)/.test(ui));
ok('with Make buttons that craft where you stand', /this\.wireCraft\(body, /.test(ui)
  && /d\.crafting\.craft\(b\.dataset\.craft, Number\(b\.dataset\.times\),\s*\{ near: pos, atStations: d\.stationsNear\(pos\) \}\)/.test(ui));
ok('the bench draws the same tiles', /list\.innerHTML = this\.recipeGridHtml\(recipes\);/.test(ui));
ok('a tile: big icon, name, ingredients, Make', /class="recipe-tile[\s\S]*class="recipe-icon"[\s\S]*class="recipe-name"[\s\S]*class="recipe-cost"[\s\S]*data-craft=/.test(ui));
const stations = STRUCTURES.filter((s) => s.station).map((s) => s.station);
ok('every station building gets one', ['workshop', 'foundry', 'university', 'temple', 'engineering'].every((s) => stations.includes(s)));

const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
ok('two to a row on a phone', /#bench-list, \.recipe-grid \{\s*display: grid; grid-template-columns: repeat\(auto-fill, minmax\(148px, 1fr\)\);/.test(css));

process.exit(f ? 1 : 0);
