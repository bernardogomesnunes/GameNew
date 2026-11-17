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
ok('made by hand, from Age 3', ['hand', 'workbench'].includes(RECIPES_BY_ID.get('stone_mill')?.station) && RECIPES_BY_ID.get('stone_mill').age === 3 && ITEMS_BY_ID.get('stone_mill')?.block === STONE_MILL);

// --- what it grinds -----------------------------------------------------------------------------

const at = (id) => RECIPES_BY_ID.get(id);
ok('gravel from cobblestone, and from stone', at('mill_gravel').output.id === 'gravel' && at('mill_gravel').inputs.cobblestone && at('mill_gravel_stone').inputs.stone);
ok('sand from gravel', at('mill_sand').inputs.gravel && at('mill_sand').output.id === 'sand');

// --- cut stone, half as much again ---------------------------------------------------------------
// CRAFT-9 part 4: the mill cuts bricks and setts; shaping moved to the Mason's Bench.

const milled = RECIPES.filter((r) => r.id.startsWith('stone_mill_'));
ok('the mill cuts stone brick, sandstone brick and both calçadas', milled.map((r) => r.id).sort().join() === 'stone_mill_calcada,stone_mill_calcada_dark,stone_mill_sandstone_brick,stone_mill_stone_brick');
ok('each at the mill, 6 where the old workbench cut gave 4', milled.every((m) => m.station === 'stone_mill' && m.output.count === 6));

// No loop at the mill makes stone from nothing: nothing it makes turns back
// into what went in, and slabs (two make a whole stone block) aren't milled.
{
  const RAW = new Set(['stone', 'cobblestone', 'marble', 'stone_white', 'stone_grey', 'stone_turquoise', 'stone_orange', 'sandstone']);
  const millOut = new Set(RECIPES.filter((r) => r.station === 'stone_mill').map((r) => r.output.id));
  ok('the mill processes stone into cobble; the Wash Tub tints orange stone (CRAFT-9 part 5)', millOut.has('cobblestone') && at('stone_orange').station === 'bleach_bucket');
  ok('marble is dressed at the Mason\'s Bench now', at('marble').station === 'masons_bench' && !millOut.has('marble'));
  ok('reclaiming cobble cannot multiply stone', at('cobblestone').output.count / at('cobblestone').inputs.stone * at('stone_from_cobblestone').output.count / at('stone_from_cobblestone').inputs.cobblestone <= 1);
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
  const away = tiles([]), mill = tiles(['joinery_bench']), mason = tiles(['masons_bench']);
  ok('away from a mill: one trapdoor, the hand one', count(away, 'trapdoor') === 1 && ['hand', 'workbench'].includes(away.find((r) => r.output.id === 'trapdoor').station));
  ok('at the joinery bench: one trapdoor, the bench\'s cheaper one', count(mill, 'trapdoor') === 1 && mill.find((r) => r.output.id === 'trapdoor').station === 'joinery_bench');
  ok('at the Mason\'s Bench: one stone wall, the bench\'s', count(mason, 'wall_stone') === 1 && mason.find((r) => r.output.id === 'wall_stone').station === 'masons_bench');
  ok('and gravel, which only the mill makes, is still there to find (greyed) away from it', count(away, 'gravel') === 2);
  ok('stone made two ways by hand keeps both', count(away, 'stone') >= 3);

  // Making them: at the bench, and not away from it.
  const r1 = c.craft('mason_wall_stone', 1, { atStations: ['masons_bench'] });
  ok(`at the Mason's Bench, 3 stone make ${r1.made} walls`, r1.ok && inv.countOf('wall_stone') === 6 && inv.countOf('stone') === 37);
  ok('away from it, it says where to stand', !c.craft('mill_gravel', 1, { atStations: [] }).ok);
  ok('gravel, ground', c.craft('mill_gravel', 2, { atStations: ['stone_mill'] }).ok && inv.countOf('gravel') === 4);
}

process.exit(f ? 1 : 0);
