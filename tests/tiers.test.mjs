import { ITEMS_BY_ID, toolEffectiveness } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { ARMOUR_SETS, ARMOUR_PIECES } from '../src/config/armour.js';
import { TOOL_TIERS, tieredId } from '../src/config/tiers.js';
import { heldBoxes } from '../src/render/heldModel.js';
import { ITEM_MODELS } from '../src/config/itemModels.js';
import { newGearAt } from '../src/ui/UIManager.js';

/**
 * Backlog batch 2: "tiers for tools, weapons and armour: stone, iron, gold,
 * sky and dark, for swords, axes, shovels and armour", and "tools reveal as
 * you progress, the way buildings already do".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const recipe = (id) => RECIPES.find((r) => r.id === id);

ok('four tiers past stone: iron, gold, sky, dark', TOOL_TIERS.map((t) => t.key).join() === 'iron,gold,sky,dark');
for (const t of TOOL_TIERS) {
  for (const kind of ['axe', 'pickaxe', 'shovel', 'sword']) {
    const id = tieredId(kind, t.key);
    const item = ITEMS_BY_ID.get(id);
    ok(`${t.name} ${kind}: an item, a bench recipe from its age, a model in the hand`,
      item?.kind === 'tool' && recipe(id)?.age === (id === 'sword_iron' ? 4 : t.age) && recipe(id).station === 'hand'
      && heldBoxes({ itemId: id }).length > 1);
  }
}
ok('named by material', ITEMS_BY_ID.get('axe_gold').name === 'Gold Axe' && ITEMS_BY_ID.get('shovel_dark').name === 'Dark Shovel' && ITEMS_BY_ID.get('sword_sky').name === 'Sky Sword');
ok('each made from its own metal', recipe('axe_iron').inputs.iron_ingot > 0 && recipe('axe_gold').inputs.gold > 0
  && recipe('axe_sky').inputs.sky_marble > 0 && recipe('axe_dark').inputs.dark_stone > 0);
ok('in the hand, a tier\'s head is its own colour', heldBoxes({ itemId: 'axe_gold' }).some((b) => b.color === 0xf0cf62));
ok('swords past iron have their own models', ['sword_gold', 'sword_sky', 'sword_dark'].every((id) => ITEM_MODELS[id]));

// What a tier changes.
const dur = (id) => ITEMS_BY_ID.get(id).durability, dmg = (id) => ITEMS_BY_ID.get(id).damage;
ok('iron lasts longer than stone, and gold is softer than iron', dur('axe_iron') > dur('axe') && dur('axe_gold') < dur('axe_iron') && dur('axe_gold') > dur('axe'));
ok('sky and dark last longest', dur('axe_sky') > dur('axe_iron') && dur('axe_dark') > dur('axe_iron'));
ok('swords hit harder each tier: stone, iron, gold, sky, dark',
  dmg('sword_stone') < dmg('sword_iron') && dmg('sword_iron') < dmg('sword_gold') && dmg('sword_gold') < dmg('sword_sky') && dmg('sword_sky') < dmg('sword_dark'));
ok('still just as quick on the job it is for', toolEffectiveness('axe_iron', 'wood') === 'fast' && toolEffectiveness('pickaxe_dark', 'stone') === 'fast');
ok('past stone, the wrong job is only ordinary', toolEffectiveness('pickaxe', 'dirt') === 'slow' && toolEffectiveness('pickaxe_iron', 'dirt') === 'normal');
ok('and nothing is out of reach — a metal axe will take on stone, slowly', toolEffectiveness('axe', 'stone') === 'impossible' && toolEffectiveness('axe_iron', 'stone') === 'slow');

// Armour tiers.
ok('armour comes in leather, iron, gold, sky and dark', ARMOUR_SETS.map((s) => s.name).join() === 'Leather,Iron,Gold,Sky,Dark');
ok('the Stone Kingdom\'s set is Dark now, under the same ids', ITEMS_BY_ID.get('armour_stone_head').name === 'Dark Helm');
const points = (key) => ARMOUR_PIECES.filter((p) => p.set === key).reduce((n, p) => n + p.points, 0);
ok(`each tier guards more than the one before (${['leather', 'iron', 'gold', 'sky', 'stone'].map(points).join(' < ')})`,
  points('leather') < points('iron') && points('iron') < points('gold') && points('gold') < points('sky') && points('sky') <= points('stone'));
ok('every piece has a recipe', ARMOUR_PIECES.every((p) => recipe(p.id)));

// Revealed as you go.
ok('at Age 4 the bench says what is new: iron tools and armour', ['Iron Axe', 'Iron Pickaxe', 'Iron Shovel', 'Iron Helm'].every((n) => newGearAt(4).includes(n)));
ok('at Age 5, gold', ['Gold Axe', 'Gold Sword', 'Gold Cuirass'].every((n) => newGearAt(5).includes(n)) && !newGearAt(5).includes('Iron Axe'));
ok('at Age 6, sky and dark', ['Sky Axe', 'Dark Sword'].every((n) => newGearAt(6).includes(n)));
ok('nothing from a later age shows at the bench early', RECIPES.filter((r) => r.age <= 3).every((r) => !/^(Iron|Gold|Sky|Dark) (Axe|Pickaxe|Shovel)/.test(r.name)));

process.exit(f ? 1 : 0);
