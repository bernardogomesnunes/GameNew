import { BLOCKS_BY_ID, WOOD_FURNITURE, countsAs, turned, facingOf, shapeOf } from '../src/config/blocks.js';
import { ITEMS, ITEMS_BY_ID, FURNITURE_ITEM } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { boxesFor, boxColor } from '../src/world/propShapes.js';
import { shapeSvg } from '../src/config/cubes.js';

/**
 * Asked for directly: furniture in every wood. The oak pieces — table, chair,
 * cabinet, wardrobe, bedside table, plain and patterned panels — again in
 * white and in dark wood.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const KEYS = ['table', 'chair', 'cabinet', 'wardrobe', 'bedside_table', 'panel_plain', 'panel_pattern'];
const of = (wood, key) => WOOD_FURNITURE.find((p) => p.wood === wood && p.key === key);

ok('every piece in every wood', ['oak', 'white', 'dark'].every((w) => KEYS.every((k) => of(w, k) && BLOCKS_BY_ID.has(of(w, k).id))));
ok('each its own block', new Set(WOOD_FURNITURE.map((p) => p.id)).size === WOOD_FURNITURE.length);

for (const wood of ['white', 'dark']) {
  const W = wood[0].toUpperCase() + wood.slice(1);
  const planks = ITEMS_BY_ID.get(`${wood}_planks`);
  ok(`${W}: each piece is named for its wood and drawn in its shape`, KEYS.every((k) => {
    const b = BLOCKS_BY_ID.get(of(wood, k).id), oak = BLOCKS_BY_ID.get(of('oak', k).id);
    return b.name.startsWith(`${W} `) && shapeOf(b.id) === shapeOf(oak.id);
  }));
  ok(`${W}: and counts as the oak piece for a building's needs (a university studies at a ${wood} table)`,
    KEYS.every((k) => countsAs(of(wood, k).id) === countsAs(of('oak', k).id)) && countsAs(of(wood, 'table').id) === 31);
  ok(`${W}: what turns, turns — chair, cabinet, wardrobe, bedside table, panels`,
    KEYS.filter((k) => k !== 'table').every((k) => { const id = of(wood, k).id; return [0, 1, 2, 3].every((t) => facingOf(turned(id, t)) === t); })
    && facingOf(turned(of(wood, 'table').id, 2)) === 0);
  ok(`${W}: the chair faces you, the way an oak one does`, shapeOf(of(wood, 'chair').id) === 'chair');
  ok(`${W}: the cabinet, wardrobe and bedside table face you too`, ['cabinet', 'wardrobe', 'bedside_table'].every((k) => BLOCKS_BY_ID.get(of(wood, k).id).facesYou));
  ok(`${W}: panels go flat on the face you point at`, ['panel_plain', 'panel_pattern'].every((k) => BLOCKS_BY_ID.get(of(wood, k).id).panel));

  // Items and recipes: the oak piece's, in this wood's planks.
  for (const k of KEYS) {
    const item = ITEMS_BY_ID.get(FURNITURE_ITEM.get(`${wood}:${k}`));
    const oakItem = ITEMS_BY_ID.get(FURNITURE_ITEM.get(`oak:${k}`));
    const r = RECIPES.find((x) => x.output.id === item?.id);
    const oakR = RECIPES.find((x) => x.output.id === oakItem.id && !x.inputs.dark_planks);
    if (!item || !r || item.block !== of(wood, k).id
      || r.station !== oakR.station || r.age !== oakR.age || r.output.count !== oakR.output.count
      || r.inputs[`${wood}_planks`] !== oakR.inputs.planks || r.inputs.planks) {
      ok(`${W} ${k}: an item, made where the oak one is, from ${planks.name.toLowerCase()}`, false);
    }
  }
  ok(`${W}: each piece is an item, made where the oak one is and for as much, from ${planks.name.toLowerCase()}`, true);
}
ok('no item twice', new Set(ITEMS.map((i) => i.id)).size === ITEMS.length);

// One shape, every wood: a cabinet's top a shade lighter than its body, in
// whatever wood; its handles iron in all of them.
{
  const top = boxesFor('cabinet')[1], handle = boxesFor('cabinet')[4];
  const lum = (h) => ((h >> 16) & 255) + ((h >> 8) & 255) + (h & 255);
  ok('the cabinet\'s top is lighter than its body in every wood', ['oak', 'white', 'dark'].every((w) => {
    const c = BLOCKS_BY_ID.get(of(w, 'cabinet').id).color;
    return lum(boxColor(top, c)) > lum(c);
  }));
  ok('and the handles stay iron', ['oak', 'white', 'dark'].every((w) => boxColor(handle, BLOCKS_BY_ID.get(of(w, 'cabinet').id).color) === 0x4a3a2c));
  const dark = BLOCKS_BY_ID.get(of('dark', 'panel_pattern').id).color;
  ok('a dark patterned panel\'s squares are dark wood, not oak', boxesFor('panel_pattern').filter((b) => b.tone).every((b) => lum(boxColor(b, dark)) < lum(0xc49360)));
  ok('icons draw in each wood\'s colour', KEYS.every((k) => {
    const svg = shapeSvg(of('dark', k).id);
    return svg.includes('<path') && svg !== shapeSvg(of('oak', k).id);
  }));
}

process.exit(f ? 1 : 0);
