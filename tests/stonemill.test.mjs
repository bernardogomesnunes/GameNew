import { Inventory } from '../src/items/Inventory.js';
import { Crafting } from '../src/duilt/Crafting.js';
import { RECIPES, RECIPES_BY_ID } from '../src/config/recipes.js';
import { BLOCKS_BY_ID, STONE_MILL, stationOf, SLABS } from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { oneWayEach } from '../src/ui/DuiltUI.js';

/**
 * Asked for directly: "We need a machine like wood mill to treat stone and
 * make all the variations easier and cheaper and mill it for gravel too",
 * and "two trapdoors that look the same on bench".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the machine --------------------------------------------------------------------------------

ok('the stone mill is a block you stand by, like the wood mill', stationOf(STONE_MILL) === 'stone_mill' && BLOCKS_BY_ID.get(STONE_MILL).facesYou);
ok('made by hand, from Age 2', RECIPES_BY_ID.get('stone_mill')?.station === 'hand' && RECIPES_BY_ID.get('stone_mill').age === 2 && ITEMS_BY_ID.get('stone_mill')?.block === STONE_MILL);

// --- what it grinds -----------------------------------------------------------------------------

const at = (id) => RECIPES_BY_ID.get(id);
ok('gravel from cobblestone, and from stone', at('mill_gravel').output.id === 'gravel' && at('mill_gravel').inputs.cobblestone && at('mill_gravel_stone').inputs.stone);
ok('sand from gravel', at('mill_sand').inputs.gravel && at('mill_sand').output.id === 'sand');

// --- every stone variation, half as much again ---------------------------------------------------

const milled = RECIPES.filter((r) => r.id.startsWith('stone_mill_'));
ok(`${milled.length} stone recipes have a mill way`, milled.length >= 20);
ok('each for the same stone, half as much again or more', milled.every((m) => {
  const r = at(m.id.slice('stone_mill_'.length));
  return m.station === 'stone_mill' && JSON.stringify(m.inputs) === JSON.stringify(r.inputs) && m.output.id === r.output.id && m.output.count >= r.output.count * 1.5;
}));
ok('walls, bricks, stairs, roof tiles, pillars, chimneys and calçada among them',
  ['wall_stone', 'stone_brick', 'stairs_stone', 'roof_stone', 'pillar_stone', 'chimney_stone_brick', 'calcada'].every((id) => at(`stone_mill_${id}`)));

// No loop at the mill makes stone from nothing: nothing it makes turns back
// into what went in, and slabs (two make a whole stone block) aren't milled.
{
  const RAW = new Set(['stone', 'cobblestone', 'marble', 'stone_white', 'stone_grey', 'stone_turquoise', 'stone_orange', 'sandstone']);
  const millOut = new Set(RECIPES.filter((r) => r.station === 'stone_mill').map((r) => r.output.id));
  ok('the mill never makes raw stone', [...millOut].every((id) => !RAW.has(id)));
  const backToRaw = RECIPES.filter((r) => RAW.has(r.output.id) && Object.keys(r.inputs).some((k) => millOut.has(k) && !['gravel', 'sand'].includes(k)));
  ok(`and nothing it makes is turned back into raw stone (${backToRaw.map((r) => r.id).join(', ') || 'none'})`, !backToRaw.length);
  const slabs = SLABS.map((s) => ITEM_FOR_BLOCK.get(s.id));
  ok('slabs aren\'t made cheaper there', !RECIPES.some((r) => r.station === 'stone_mill' && slabs.includes(r.output.id)));
}

// --- at the bench: one tile per thing ------------------------------------------------------------

{
  const inv = new Inventory();
  inv.add('stone', 40); inv.add('planks', 20); inv.add('cobblestone', 10);
  const c = new Crafting({ inventory: inv, world: null });
  const tiles = (atStations) => oneWayEach(c.available(5, { station: null, atStations }));
  const count = (list, out) => list.filter((r) => r.output.id === out).length;
  const away = tiles([]), mill = tiles(['wood_mill']), stoneMill = tiles(['stone_mill']);
  ok('away from a mill: one trapdoor, the hand one', count(away, 'trapdoor') === 1 && away.find((r) => r.output.id === 'trapdoor').station === 'hand');
  ok('at the wood mill: one trapdoor, the mill\'s cheaper one', count(mill, 'trapdoor') === 1 && mill.find((r) => r.output.id === 'trapdoor').station === 'wood_mill');
  ok('at the stone mill: one stone wall, the mill\'s', count(stoneMill, 'wall_stone') === 1 && stoneMill.find((r) => r.output.id === 'wall_stone').station === 'stone_mill');
  ok('and gravel, which only the mill makes, is still there to find (greyed) away from it', count(away, 'gravel') === 2);
  ok('stone made two ways by hand keeps both', count(away, 'stone') >= 3);

  // Making them: at the mill, and not away from it.
  const r1 = c.craft('stone_mill_wall_stone', 1, { atStations: ['stone_mill'] });
  ok(`at the stone mill, 3 stone make ${r1.made} walls`, r1.ok && inv.countOf('wall_stone') === 6 && inv.countOf('stone') === 37);
  ok('away from it, it says where to stand', !c.craft('mill_gravel', 1, { atStations: [] }).ok);
  ok('gravel, ground', c.craft('mill_gravel', 2, { atStations: ['stone_mill'] }).ok && inv.countOf('gravel') === 4);
}

process.exit(f ? 1 : 0);
