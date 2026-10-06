import { Inventory } from '../src/items/Inventory.js';
import { Crafting } from '../src/duilt/Crafting.js';
import { RECIPES, RECIPES_BY_ID } from '../src/config/recipes.js';
import { ITEM_FOR_BLOCK } from '../src/config/items.js';

/**
 * Played on: "I need rocks to make a pickaxe and digging ... does not work,
 * only for surface stone ... we need some kind of gateway. Maybe make stone
 * from cobble." Dug out, the layers under the soil come up as marble, white
 * stone and cobblestone — none of them stone, which the first tools need.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

ok('the layers you dig through are not plain stone', [8, 17, 235].every((b) => ITEM_FOR_BLOCK.get(b) !== 'stone'));
ok('and the first pickaxe needs plain stone', RECIPES_BY_ID.get('pickaxe').inputs.stone > 0 && RECIPES_BY_ID.get('pickaxe').age === 1);

const ways = ['stone_from_cobblestone', 'stone_from_white', 'stone_from_marble'].map((id) => RECIPES_BY_ID.get(id));
ok('each one knocks back into stone, by hand, from the first age', ways.every((r) => r && r.station === 'hand' && r.age === 1 && r.output.id === 'stone'));

// Never a loop that makes stone out of nothing: what stone makes, back to
// stone, gives no more than went in.
const back = (item) => { const r = ways.find((w) => w.inputs[item]); return r.output.count / r.inputs[item]; };
const split = RECIPES_BY_ID.get('cobblestone'), dress = RECIPES_BY_ID.get('marble');
ok(`stone → cobblestone → stone gives nothing extra (${(split.output.count / split.inputs.stone) * back('cobblestone')} per stone)`, (split.output.count / split.inputs.stone) * back('cobblestone') <= 1);
ok(`stone → marble → stone gives nothing extra (${(dress.output.count / dress.inputs.stone) * back('marble')} per stone)`, (dress.output.count / dress.inputs.stone) * back('marble') <= 1);
const whiteMade = RECIPES.filter((r) => r.output.id === 'stone_white' && r.inputs.stone);
ok('white stone isn\'t made from stone, so nothing loops there', whiteMade.length === 0);

// In a bag: what was dug up turns into a pickaxe.
{
  const inv = new Inventory();
  inv.add('cobblestone', 31); inv.add('stone_white', 21); inv.add('wood', 10);
  const c = new Crafting({ inventory: inv, world: null, skills: null });
  ok('the recipes show at Age 1', c.available(1).some((a) => (a.recipe ?? a).id === 'stone_from_cobblestone'));
  c.craft('stone_from_cobblestone', 2);
  c.craft('stone_from_white', 2);
  ok(`two goes of each: ${inv.countOf('stone')} stone`, inv.countOf('stone') === 4 && inv.countOf('cobblestone') === 27 && inv.countOf('stone_white') === 19);
  const r = c.craft('pickaxe', 1);
  ok('and that makes a pickaxe', r.ok && inv.countOf('pickaxe') === 1);
}

process.exit(f ? 1 : 0);
