import { ITEMS, ITEMS_BY_ID, isFood } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { CROPS } from '../src/config/crops.js';
import { FOODS } from '../src/config/soldiers.js';
import { UPGRADES } from '../src/config/upgrades.js';

/** PLAY-20 and PLAY-21: food values and names (docs/design/play-14-21.md). */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const TABLE = {
  fruit: 8, vegetables: 10, potato: 6, cabbage: 7, lettuce: 5, pepper: 6, zucchini: 6, broccoli: 7,
  raw_meat: 4, egg: 4, milk: 8, cooked_meat: 28,
  mushroom_soup: 36, forest_broth: 40, mushroom_dumplings: 44, hunters_stew: 50,
};
for (const [id, feeds] of Object.entries(TABLE)) ok(`${id} feeds ${feeds}`, ITEMS_BY_ID.get(id)?.feeds === feeds);

const RAW = ['fruit', 'vegetables', 'potato', 'cabbage', 'lettuce', 'pepper', 'zucchini', 'broccoli', 'raw_meat', 'egg', 'milk'];
ok('every raw food feeds 10 or less', RAW.every((id) => ITEMS_BY_ID.get(id).feeds <= 10));
const MEALS = ['mushroom_soup', 'forest_broth', 'mushroom_dumplings', 'hunters_stew'];
ok('cooked meat is 28, below every Cauldron meal', ITEMS_BY_ID.get('cooked_meat').feeds === 28 && MEALS.every((id) => ITEMS_BY_ID.get(id).feeds > 28));
ok('meals feed 36 to 50', MEALS.every((id) => { const v = ITEMS_BY_ID.get(id).feeds; return v >= 36 && v <= 50; }));
ok('nothing raw feeds more than anything cooked', Math.max(...RAW.map((id) => ITEMS_BY_ID.get(id).feeds)) < 28);
ok('drinks still have no feeds', ['beer', 'kombucha', 'coffee'].every((id) => ITEMS_BY_ID.get(id).feeds == null));
ok('cook_meat blurb says seven times', /Seven times/.test(RECIPES.find((r) => r.id === 'cook_meat').blurb));

// --- PLAY-21 -------------------------------------------------------------------
{
  const beans = ITEMS_BY_ID.get('coffee_beans');
  ok('coffee_beans is not food', !isFood('coffee_beans') && beans.kind === 'raw' && beans.feeds == null);
  ok('coffee_beans still brews coffee', RECIPES.some((r) => r.inputs?.coffee_beans && r.output.id === 'coffee'));
  ok('and is still an upgrade devotion input', Object.values(UPGRADES).some((u) => u.inputs?.coffee_beans));
  const veg = ITEMS_BY_ID.get('vegetables');
  ok('vegetables is named Carrots and is food', veg.name === 'Carrots' && isFood('vegetables'));
  ok('the carrot crop produces it', CROPS.some((c) => c.produce === 'vegetables'));
  const names = FOODS.map((x) => x.id);
  ok('soldiers eat fruit before carrots', names.indexOf('fruit') < names.indexOf('vegetables'));
  ok('and no coffee beans', !names.includes('coffee_beans'));
  ok('cheapest first: a 4 leads, the meals trail in order', ITEMS_BY_ID.get(names[0]).feeds === 4 && names.slice(-4).join() === MEALS.join());
}

process.exit(f ? 1 : 0);
