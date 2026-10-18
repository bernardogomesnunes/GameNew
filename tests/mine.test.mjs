import { STRUCTURES_BY_ID, producesAt, intervalAt } from '../src/config/structures.js';
import { RECIPES } from '../src/config/recipes.js';
import { AGES } from '../src/config/ages.js';
import { ITEMS_BY_ID } from '../src/config/items.js';

/**
 * Asked for directly: "a mine building, which generates ores, with 5 levels
 * and starts with copper and then iron and goes to gold at 3 and diamonds
 * at 5".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const mine = STRUCTURES_BY_ID.get('mine');
const foundry = STRUCTURES_BY_ID.get('foundry');
const at = (level) => producesAt(mine, level - 1);

ok('five levels', mine.tiers.length === 5);
ok('level 1: copper', at(1).copper_ore > 0 && !at(1).iron_ore && !at(1).gold_ore && !at(1).diamond);
ok('level 2: copper and iron', at(2).copper_ore > 0 && at(2).iron_ore > 0 && !at(2).gold_ore && !at(2).diamond);
ok('level 3: gold too', at(3).gold_ore > 0 && !at(3).diamond);
ok('level 4: still no diamonds', !at(4).diamond);
ok('level 5: diamonds', at(5).diamond > 0 && at(5).copper_ore > 0 && at(5).iron_ore > 0 && at(5).gold_ore > 0);
ok('coal for the trains at every level', [1, 2, 3, 4, 5].every((l) => at(l).coal > 0));
ok('each level is at least as good as the one before', [2, 3, 4, 5].every((l) => intervalAt(mine, l - 1) <= intervalAt(mine, l - 2)
  && Object.entries(at(l - 1)).every(([id, n]) => (at(l)[id] ?? 0) >= n)));
ok('no more than 15 of anything a day, as every building', [1, 2, 3, 4, 5].every((l) => Object.values(at(l)).every((n) => n * 86400 / intervalAt(mine, l - 1) <= 15)));
ok('everything it brings up is a real item', [1, 2, 3, 4, 5].every((l) => Object.keys(at(l)).every((id) => ITEMS_BY_ID.has(id))));

ok(`opens with the foundry that smelts it (mine Age ${mine.age}, foundry Age ${foundry.age})`, mine.age === foundry.age);
for (const ore of ['copper_ore', 'iron_ore', 'gold_ore']) {
  const smelt = RECIPES.find((r) => r.inputs?.[ore] && r.station === 'foundry');
  ok(`the foundry smelts its ${ore.replace('_', ' ')} by then`, !!smelt && smelt.age <= mine.age);
}

ok('dug, not built: digging it out is never refused, and it takes in what you open up', mine.growsWhenDug === true);
const dug = (t) => t.needs.find((n) => n.key === 'dug')?.short({ countOf: () => 0 });
ok('each level asks you to dig further than the last', mine.tiers.slice(1).every((t, i, a) => dug(t) > 0 && (i === 0 || dug(t) > dug(a[i - 1]))));

const goal = (label) => AGES.flatMap((a) => a.goals.map((g) => ({ ...g, age: a.age }))).find((g) => label.test(g.label));
const fake = (tier) => ({ structures: { list: () => [{ type: 'mine', valid: true, tier }], countOf: () => 1 } });
const iron = goal(/mine down to iron/), gold = goal(/mine down to gold/);
ok(`Age ${iron?.age}: dig your mine down to iron`, iron?.age === 6 && !iron.test(fake(0)) && iron.test(fake(1)));
ok(`Age ${gold?.age}: dig it down to gold`, gold?.age === 8 && !gold.test(fake(1)) && gold.test(fake(2)));

process.exit(f ? 1 : 0);
