import { RECIPES, recipesFor } from '../src/config/recipes.js';
import { ITEMS_BY_ID } from '../src/config/items.js';

/**
 * Played on: "Can't craft a framed window on duilt mode to build an house".
 * It came in at Age 3 and wanted glass from a workshop, so through the house
 * ages it was not on the bench at all.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const r = RECIPES.find((x) => x.id === 'window');
ok('the framed window is made by hand', r.station === 'hand');
ok('from the first age, when you build your first house', r.age === 1);
ok('out of things you have then: planks and sand', Object.keys(r.inputs).every((id) => ['planks', 'sand'].includes(id)));
ok('and it makes the window block', r.output.id === 'window' && ITEMS_BY_ID.get('window').block === 176);
ok('so the bench lists it at Age 1', recipesFor(1, 'hand').some((x) => x.id === 'window'));
ok('every input is a real item', Object.keys(r.inputs).every((id) => ITEMS_BY_ID.has(id)));
ok('the item says how it is made now', !/glass/i.test(ITEMS_BY_ID.get('window').madeBy));

process.exit(f ? 1 : 0);
