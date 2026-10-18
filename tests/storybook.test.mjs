import { readFileSync } from 'node:fs';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { RECIPES } from '../src/config/recipes.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { BLOCKS_BY_ID, ROOF_MATERIALS, roofPart, roofStyle, CAP_RED, CAP_LILAC, MUSHROOM_STEM, STAINED_GLASS, HANGING_VINES, WISTERIA, FAIRY_LIGHTS, CURL } from '../src/config/blocks.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';

/**
 * The storybook look (asked for directly: buildings "need to fit more the
 * mood and vibe of the mobs whimsical and mystical", with four pictures, then
 * "build the house, the marketplace and the storehouse with this new style").
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const NEW_ITEMS = ['roof_teal', 'roof_mint', 'roof_lilac', 'cap_red', 'cap_lilac', 'mushroom_stem', 'glass_stained', 'vines', 'wisteria', 'fairy_lights', 'trim_curl'];
ok('every new block is an item with a recipe', NEW_ITEMS.every((id) => ITEMS_BY_ID.get(id)?.block != null && RECIPES.some((r) => r.output.id === id)));
ok('teal, mint and lilac shingles, flat like slate', ['teal', 'mint', 'lilac'].every((k) => ROOF_MATERIALS.findIndex((m) => m.key === k) >= 2 && roofStyle(ROOF_MATERIALS.findIndex((m) => m.key === k)) === 'slate'));
ok('brick still curved, stone still flat', roofStyle(0) === 'clay' && roofStyle(1) === 'slate');
ok('vines, wisteria, fairy lights and the curl each have a shape', ['vines', 'wisteria', 'fairy_lights', 'curl'].every((s) => PROP_SHAPES[s]?.length > 0));
ok('the fairy lights glow and give light', PROP_SHAPES.fairy_lights.some((b) => b.glow) && !!BLOCKS_BY_ID.get(FAIRY_LIGHTS).light);
const world = readFileSync(new URL('../src/world/World.js', import.meta.url), 'utf8');
ok('you walk through what hangs, and the curl', /'vines', 'wisteria', 'fairy_lights', 'curl'\]\)/.test(world));

const uses = (id) => {
  const d = DESIGN_FOR_STRUCTURE.get(id);
  return { d, has: (type) => d.blocks.some((b) => b.type === type), mats: new Set(d.blocks.map((b) => roofPart(b.type)?.mat).filter((m) => m != null)) };
};
const mat = (k) => ROOF_MATERIALS.findIndex((m) => m.key === k);
{
  const { has, mats } = uses('house');
  ok('the house: teal shingles patched with mint', mats.has(mat('teal')) && mats.has(mat('mint')) && !mats.has(mat('stone')));
  ok('  curls on its gables, vines under its eaves', [0, 1, 2, 3].some((f) => has(CURL + f)) && has(HANGING_VINES));
}
{
  const { has, mats } = uses('storehouse');
  ok('the storehouse: mint shingles patched with teal', mats.has(mat('mint')) && mats.has(mat('teal')));
  ok('  a red mushroom growing out of its roof', has(CAP_RED) && has(MUSHROOM_STEM));
}
{
  const { has, mats } = uses('market');
  ok('the market: lilac shingles patched with mint', mats.has(mat('lilac')) && mats.has(mat('mint')));
  ok('  mushroom-cap awnings, red and lilac', has(CAP_RED) && has(CAP_LILAC));
  ok('  stained glass, wisteria and fairy lights', has(STAINED_GLASS) && has(WISTERIA) && has(FAIRY_LIGHTS));
}
for (const id of ['house', 'storehouse', 'market']) {
  const { d } = uses(id), age = STRUCTURES_BY_ID.get(id).age;
  const late = Object.keys(d.cost).filter((item) => (RECIPES.find((r) => r.output.id === item)?.age ?? 0) > age);
  ok(`the ${id}'s design can be made by its age (${age})${late.length ? `: not ${late.join(', ')}` : ''}`, !late.length);
}
{
  // Patches, not stripes: no long diagonal runs of the second colour.
  const tiles = DESIGN_FOR_STRUCTURE.get('market').blocks.filter((b) => roofPart(b.type)?.mat === mat('mint'));
  const at = new Set(tiles.map((b) => `${b.dx},${b.dy},${b.dz}`));
  const diagonal = tiles.filter((b) => at.has(`${b.dx + 1},${b.dy},${b.dz + 1}`) && at.has(`${b.dx + 2},${b.dy},${b.dz + 2}`)).length;
  ok(`the second colour lies in patches, not stripes (${diagonal} diagonal runs)`, diagonal <= 2);
}

process.exit(f ? 1 : 0);
