import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { roofPart } from '../src/config/blocks.js';

/**
 * Asked for directly: "Detail the building, they're all looking too boxy."
 * The roomed designs are drawn the way they'd be built — a plinth, posts at
 * the corners, windows, eaves overhanging the walls, a step at the door —
 * and the first-age cabin only uses first-age things to do it.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const WINDOWS = new Set([176, 177, 178, 179]);
const STONE = 3, COBBLE = 8, WOOD = 4;
const at = (d) => new Map(d.blocks.map((b) => [`${b.dx},${b.dy},${b.dz}`, b.type]));

for (const id of ['house', 'storehouse', 'workshop', 'university', 'engineering', 'townhouse', 'tavern', 'military']) {
  const d = DESIGN_FOR_STRUCTURE.get(id);
  const cells = at(d);
  ok(`${id}: has windows`, d.blocks.some((b) => WINDOWS.has(b.type)));
  // The eaves: roof tiles out over column 0, where no wall stands.
  ok(`${id}: its eaves overhang the walls`,
    d.blocks.some((b) => b.dx === 0 && roofPart(b.type)) && !d.blocks.some((b) => b.dx === 0 && b.dy === 1 && !roofPart(b.type) && b.type !== 30 && b.type !== 29));
  // A plinth: the lowest course of wall isn't the wall's own material.
  const wallY = cells.has('3,0,3') ? 1 : 0;                 // a floor under the room lifts its walls
  const low = cells.get(`1,${wallY},2`), high = cells.get(`1,${wallY + 1},2`);
  ok(`${id}: stands on a plinth`, low != null && high != null && (low !== high || WINDOWS.has(high)));
}

const cabin = DESIGN_FOR_STRUCTURE.get('house');
ok('the cabin needs nothing a first age can\'t make (no cobblestone)', !cabin.cost.cobblestone);
ok('its plinth is stone', at(cabin).get('1,1,2') === STONE);
ok('its walls are logs', at(cabin).get('1,2,2') === WOOD);
ok('and it has a chimney', cabin.blocks.some((b) => b.type === STONE && b.dy > 4));
ok('the townhouse has a brick chimney', DESIGN_FOR_STRUCTURE.get('townhouse').blocks.some((b) => b.type === 9 && b.dy > 4));
ok('the kiln stands on a stone hearth with firewood by it', (() => {
  const k = at(DESIGN_FOR_STRUCTURE.get('kiln'));
  return k.get('2,0,2') === STONE && k.get('0,1,0') === WOOD;
})());
ok('the village has a lane between its houses', DESIGN_FOR_STRUCTURE.get('village').blocks.filter((b) => b.type === 23).length >= 20);
ok('nothing uses cobble before Age 2', ['house', 'farm', 'forest', 'quarry'].every((s) => !DESIGN_FOR_STRUCTURE.get(s).cost.cobblestone));
ok('every footprint is read off the blocks', [...DESIGN_FOR_STRUCTURE.values()].every((d) => d.footprint === `${d.extent.x + 1} × ${d.extent.z + 1}`));

console.log(f ? `\n${f} failed` : '\nall passed');
process.exit(f ? 1 : 0);
