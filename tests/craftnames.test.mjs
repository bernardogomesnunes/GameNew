import { readFileSync } from 'node:fs';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { matchesSearch } from '../src/ui/DuiltUI.js';

/**
 * Backlog batch 2, crafting: "Name tools by material, e.g. 'Stone axe', not
 * 'Axe'; drop the wood axe", and "add a search to the crafting panel".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

const recipe = (id) => RECIPES.find((r) => r.id === id);
for (const [id, name] of [['axe', 'Stone Axe'], ['pickaxe', 'Stone Pickaxe'], ['shovel', 'Stone Shovel']]) {
  ok(`the ${id} is the ${name}, in the bag and at the bench`, ITEMS_BY_ID.get(id).name === name && recipe(id).name === name);
  ok(`and it takes stone to make`, recipe(id).inputs.stone > 0);
}
ok('there is no wooden axe', !RECIPES.some((r) => /wood(en)? axe/i.test(r.name)) && ![...ITEMS_BY_ID.values()].some((i) => /wood(en)? axe/i.test(i.name)));
ok('the swords already say what they are made of', ['sword_wood', 'sword_stone', 'sword_iron'].every((id) => /^(Wooden|Stone|Iron) /.test(ITEMS_BY_ID.get(id).name)));

// --- search ------------------------------------------------------------------------

ok('an empty search shows everything', matchesSearch('', ['Stone Axe']) && matchesSearch('   ', ['x']));
ok('any case, part of a word', matchesSearch('AX', ['Stone Axe']) && matchesSearch('sto', ['Stone Axe']));
ok('every word has to match, in any order', matchesSearch('axe stone', ['Stone Axe']) && !matchesSearch('stone sword', ['Stone Axe']));
ok('what goes into it counts too', matchesSearch('planks', ['Bed', 'A place to sleep', 'Bed', 'Planks', 'Wool']));
ok('the bench has a search box over its list', /<input id="bench-search" class="panel-search" type="search"/.test(ui));
ok('which filters by name, what it makes and what goes in',
  /matchesSearch\(query, \[r\.name, r\.blurb, r\.station, itemName\(r\.output\.id\), \.\.\.Object\.keys\(r\.inputs\)\.map\(itemName\)\]\)/.test(ui));
ok('and says so when nothing matches', /Nothing you can make matches/.test(ui));

process.exit(f ? 1 : 0);
