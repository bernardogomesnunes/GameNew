import { World } from '../src/world/World.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { validateStructure } from '../src/structures/validate.js';
import { BLOCKS_BY_ID, WAR_TABLE } from '../src/config/blocks.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES_BY_ID } from '../src/config/recipes.js';

/** PLAY-12 chunk 1: the Armoury, the War Hall and the War Table (docs/design/play-12.md). */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

/** A flat world with a design stamped in it; `mutate` may return another block id for each block. */
function stamped(id, mutate = null, at = { x: 40, y: 4, z: 40 }) {
  const world = new World({ sizeX: 128, sizeZ: 128, height: 48 });
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) for (let y = 0; y < at.y; y++) world.setBlock(x, y, z, 3);
  const d = DESIGN_FOR_STRUCTURE.get(id);
  for (const b of d.blocks) world.setBlock(at.x + b.dx, at.y + b.dy, at.z + b.dz, mutate ? mutate(b) : b.type);
  return { world, region: { minX: at.x, maxX: at.x + d.extent.x, minY: at.y, maxY: at.y + d.extent.y, minZ: at.z, maxZ: at.z + d.extent.z } };
}
const without = (id, test) => {
  const { world, region } = stamped(id, (b) => (test(b) ? 0 : b.type));
  return validateStructure(world, region, id);
};

// The War Table block.
ok('War Table is block 571', WAR_TABLE === 571 && BLOCKS_BY_ID.get(571)?.name === 'War Table');
ok('War Table shape has 9 boxes', PROP_SHAPES.war_table?.length === 9 && BLOCKS_BY_ID.get(571).shape === 'war_table');
const item = ITEMS_BY_ID.get('war_table');
ok('War Table item: refined, stack 10, places block 571', item?.block === 571 && item.stackTo === 10 && item.kind === 'refined');
const rec = RECIPES_BY_ID.get('war_table');
ok('War Table recipe: hand, Age 9, planks 6, string 2, gold 1', rec?.station === 'hand' && rec.age === 9 && rec.inputs.planks === 6 && rec.inputs.string === 2 && rec.inputs.gold === 1);

// The structures.
const arm = STRUCTURES_BY_ID.get('armoury'), hall = STRUCTURES_BY_ID.get('war_hall');
ok('Armoury: Age 8, optional, size 6 to 14, iron 4 planks 12, politics',
  arm.age === 8 && arm.optional && arm.minSize === 6 && arm.maxSize === 14 && arm.cost.iron_ingot === 4 && arm.cost.planks === 12 && arm.skill === 'politics' && arm.station === 'armoury');
ok('War Hall: Age 9, optional, size 6 to 14, gold 4 planks 12, politics',
  hall.age === 9 && hall.optional && hall.minSize === 6 && hall.maxSize === 14 && hall.cost.gold === 4 && hall.cost.planks === 12 && hall.skill === 'politics');
ok('Armoury requirement order', arm.requires.map((r) => r.id).join() === 'shell,forge,arms,plans,room');
ok('War Hall requirement order', hall.requires.map((r) => r.id).join() === 'shell,table,banners,lights,room');

// Starter designs pass their own claim.
for (const id of ['armoury', 'war_hall']) {
  ok(`${id}: a starter design exists`, !!DESIGN_FOR_STRUCTURE.get(id));
  const { world, region } = stamped(id);
  const v = validateStructure(world, region, id);
  ok(`${id}: the starter design stands as one (${v.reason ?? 'ok'})`, v.ok);
}

// Each requirement fails with its hint.
{
  const r = without('armoury', (b) => b.type === 525);
  ok('Armoury without a forge says so', !r.ok && /forge/.test(r.reason));
  const r2 = without('armoury', (b) => b.type >= 212 && b.type <= 215);
  ok('Armoury without racks says so', !r2.ok && /weapon rack/.test(r2.reason));
  const r3 = without('armoury', (b) => b.type === 31);
  ok('Armoury without a table says so', !r3.ok && /table/.test(r3.reason));
  const r4 = without('armoury', (b) => b.type === 3 || b.type === 8 || b.type === 9);
  ok('Armoury without stone says so first', !r4.ok && /stone, cobble or brick/.test(r4.reason));
}
{
  const r = without('war_hall', (b) => b.type === 571);
  ok('War Hall without a war table says so', !r.ok && /war table/.test(r.reason));
  const r2 = without('war_hall', (b) => b.type >= 182 && b.type <= 189);
  ok('War Hall without banners says so', !r2.ok && /banner/.test(r2.reason));
  const r3 = without('war_hall', (b) => b.type === 26 || b.type === 85);
  ok('War Hall without lights says so', !r3.ok && /light/.test(r3.reason));
}
process.exit(f ? 1 : 0);
