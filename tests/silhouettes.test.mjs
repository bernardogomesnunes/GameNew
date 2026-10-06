import { DESIGN_FOR_STRUCTURE, STARTER_DESIGNS } from '../src/config/starterDesigns.js';
import { roofPart, isOpenTrapdoor, CHIMNEYS, STONE_BRICK, BLOCKS_BY_ID } from '../src/config/blocks.js';
import { recipesFor } from '../src/config/recipes.js';
import { ITEM_FOR_BLOCK } from '../src/config/items.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';

/**
 * Backlog batch 3, #5: "Building designs that read from a distance. Each
 * building type gets its own silhouette: small roofs, pyramid roofs,
 * chimneys, towers." And #17: "Workshop, engineering centre and university
 * redone with the new walls, trapdoors and chimneys."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const design = (id) => DESIGN_FOR_STRUCTURE.get(id);
const has = (id, test) => design(id).blocks.some((b) => test(b.type));
const roofKinds = (id) => new Set(design(id).blocks.map((b) => roofPart(b.type)?.kind).filter(Boolean));

// --- from a distance: no two buildings the same outline -------------------------

/** What you see of a design from far off: how tall it stands, column by column. */
const outline = (d) => {
  const top = new Map();
  for (const b of d.blocks) top.set(`${b.dx},${b.dz}`, Math.max(top.get(`${b.dx},${b.dz}`) ?? -1, b.dy));
  return [...top].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, y]) => `${k}:${y}`).join(' ');
};
const roofed = STARTER_DESIGNS.filter((d) => d.blocks.some((b) => roofPart(b.type)));
const outlines = new Map();
for (const d of roofed) {
  const o = outline(d);
  ok(`the ${d.structure} has an outline of its own${outlines.has(o) ? ` — it's the ${outlines.get(o)}'s` : ''}`, !outlines.has(o));
  outlines.set(o, d.structure);
}

// --- pyramid roofs, small roofs, chimneys, towers ----------------------------------

// Hipped: slopes climbing all four ways, where a gable climbs two.
const climbs = (id) => new Set(design(id).blocks.map((b) => roofPart(b.type)).filter((r) => r?.kind === 'steep').map((r) => r.facing));
ok('pyramid roofs: the university, the garrison and the granary are hipped',
  ['university', 'military', 'granary'].every((id) => climbs(id).size === 4) && climbs('workshop').size === 2);
ok('a small roof: the storehouse is a lean-to, half-pitch tiles only',
  [...roofKinds('storehouse')].every((k) => k === 'lo' || k === 'hi'));
ok('and hoods over the doors of the workshop, the tavern and the townhouse',
  ['workshop', 'tavern', 'townhouse'].every((id) => design(id).blocks.some((b) => roofPart(b.type)?.kind === 'lo' && b.dz === 0)));
{
  // A chimney stands clear of its roof, so it shows against the sky.
  const clear = (id) => {
    const d = design(id);
    const stack = d.blocks.filter((b) => CHIMNEYS.includes(b.type) || (b.type === 3 && id === 'house'));
    const top = Math.max(...stack.map((b) => b.dy));
    const at = stack.find((b) => b.dy === top);
    const roofTop = Math.max(...d.blocks.filter((b) => roofPart(b.type) && Math.abs(b.dx - at.dx) <= 1 && Math.abs(b.dz - at.dz) <= 1).map((b) => b.dy));
    return top - roofTop;
  };
  for (const id of ['house', 'workshop', 'engineering', 'tavern', 'townhouse']) {
    ok(`the ${id}'s chimney stands ${clear(id)} clear of the roof round it`, clear(id) >= 1);
  }
}
{
  // The university's tower: higher than the rest of the roof, with its own pyramid.
  const d = design('university');
  const tower = d.blocks.filter((b) => b.dx >= 1 && b.dx <= 3 && b.dz >= 1 && b.dz <= 3);
  const rest = d.blocks.filter((b) => !(b.dx >= 1 && b.dx <= 3 && b.dz >= 1 && b.dz <= 3));
  ok('a tower: the university\'s rises well over its own roof',
    Math.max(...tower.map((b) => b.dy)) >= Math.max(...rest.map((b) => b.dy)) + 3);
  const crown = Math.max(...tower.filter((b) => b.type === STONE_BRICK).map((b) => b.dy)) - 1;
  const open = [[2, 1], [3, 2], [2, 3], [1, 2]].every(([x, z]) => !tower.some((b) => b.dx === x && b.dz === z && b.dy === crown));
  ok('  open on every side at the top, capped in a pyramid',
    open && tower.some((b) => roofPart(b.type)?.kind === 'peak'));
}
{
  // The engineering centre's crane: a mast past the ridge, a jib, a rope.
  const d = design('engineering');
  const ridge = Math.max(...d.blocks.filter((b) => roofPart(b.type)).map((b) => b.dy));
  const mast = d.blocks.filter((b) => b.dx === 10 && b.dz === 4 && b.type === 4);
  ok('and the engineering centre\'s crane stands over its ridge', Math.max(...mast.map((b) => b.dy)) > ridge);
}

// --- #17: new walls, trapdoors, chimneys — and none of it brick ------------------------

for (const id of ['workshop', 'university', 'engineering']) {
  ok(`the ${id} is on a stone-brick plinth`, has(id, (t) => t === STONE_BRICK));
  ok(`  with shutters at its windows`, has(id, isOpenTrapdoor));
  if (id !== 'university') ok(`  a stone-brick chimney`, has(id, (t) => t === CHIMNEYS[0]));
  if (id !== 'university') ok(`  and stone-brick walls`, has(id, (t) => t === 332));
  // Brick is first made at a workshop, so none of these can ask for it
  // (reported once already: "I need the workshop to build them").
  const age = STRUCTURES_BY_ID.get(id).age;
  const makeable = new Set(recipesFor(age).map((r) => r.output.id));
  const added = ['stone_brick', 'chimney_stone_brick', 'wall_stone_brick', 'trapdoor'];
  const needs = [...new Set(design(id).blocks.map((b) => ITEM_FOR_BLOCK.get(b.type)))].filter((item) => added.includes(item));
  const late = needs.filter((item) => !makeable.has(item));
  ok(`  what's new on it can all be made by age ${age} (${needs.join(', ')})${late.length ? ` — not ${late.join(', ')}` : ''}`, late.length === 0);
  ok('  and none of it is brick', !has(id, (t) => t === 9 || t === CHIMNEYS[1] || roofPart(t)?.mat === 0));
}
ok('shutters hang flat against the wall, never in a window',
  STARTER_DESIGNS.every((d) => {
    const at = new Map(d.blocks.map((b) => [`${b.dx},${b.dy},${b.dz}`, b.type]));
    return d.blocks.filter((b) => isOpenTrapdoor(b.type)).every((b) => {
      // Facing points at the wall it's hinged on.
      const f = BLOCKS_BY_ID.get(b.type).facing;
      const [sx, sz] = [[0, -1], [1, 0], [0, 1], [-1, 0]][f];
      return at.has(`${b.dx + sx},${b.dy},${b.dz + sz}`);
    });
  }));

process.exit(f ? 1 : 0);
