import { World } from '../src/world/World.js';
import { CROPS, CROP_BASE, RIPE, STAGE_SECONDS, cropBlock, cropOf } from '../src/config/crops.js';
import { BLOCKS_BY_ID, PLACEABLE_BLOCKS } from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK, isFood } from '../src/config/items.js';
import { Crops, harvestOf, farmProduce, FARM_SEED_SLOTS } from '../src/duilt/Crops.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { itemIcon } from '../src/config/cubes.js';
import { readFileSync } from 'node:fs';

/**
 * Crops. Requested directly: "Farm should be dirt, and should have crops to
 * plant there, so add a couple of seeds from crops like carrots that we
 * already have, potatoes, cabbage, lettuce, peppers, zucchini and broccoli.
 * Seeds and fruit."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const FARMLAND = 21;

// --- the crops asked for -------------------------------------------------------

{
  const kinds = CROPS.map((c) => c.kind);
  ok('carrots, potatoes, cabbage, lettuce, peppers, zucchini and broccoli',
    ['carrot', 'potato', 'cabbage', 'lettuce', 'pepper', 'zucchini', 'broccoli'].every((k) => kinds.includes(k)));
  ok('each has seeds to plant', CROPS.every((c) => ITEMS_BY_ID.get(`seeds_${c.kind}`)?.block === cropBlock(c.kind, 0)));
  ok('and something to eat — or, for hemp, fibre', CROPS.every((c) => isFood(c.produce) || (c.fibre && ITEMS_BY_ID.has(c.produce))));
  ok('carrots are the vegetables the game already had', CROPS.find((c) => c.kind === 'carrot').produce === 'vegetables');
  ok('farmland is dirt-coloured, not green', (() => {
    const c = BLOCKS_BY_ID.get(FARMLAND).color;
    return ((c >> 16) & 255) > ((c >> 8) & 255);
  })());
}

// --- the blocks ----------------------------------------------------------------

{
  const ids = CROPS.flatMap((c) => [0, 1, 2, 3].map((s) => cropBlock(c.kind, s)));
  ok('four stages of each crop, all real blocks', ids.every((id) => BLOCKS_BY_ID.has(id)));
  ok('none of them overlap another block', new Set(ids).size === ids.length && ids[0] === CROP_BASE);
  ok('a crop block knows what and how grown it is', cropOf(cropBlock('pepper', 2)).kind === 'pepper' && cropOf(cropBlock('pepper', 2)).stage === 2);
  ok('and anything else is not a crop', cropOf(FARMLAND) === null && cropOf(CROP_BASE + ids.length) === null);
ok('nor is nothing at all', cropOf(undefined) === null && cropOf(null) === null);
  ok('a plant is not in the block list — you plant it from seeds', !PLACEABLE_BLOCKS.some((b) => b.crop));
  ok('picking a plant gives its seeds', ITEM_FOR_BLOCK.get(cropBlock('cabbage', 3)) === 'seeds_cabbage');
}

// --- growing -------------------------------------------------------------------

{
  ok('a fresh seed is stage 0', Crops.stageAt(0, 0) === 0);
  ok(`a stage every ${STAGE_SECONDS}s`, Crops.stageAt(0, STAGE_SECONDS * 1000) === 1);
  ok('and ripe stays ripe', Crops.stageAt(0, STAGE_SECONDS * 1000 * 20) === RIPE);

  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  world.setBlock(5, 10, 5, FARMLAND);
  world.setBlock(5, 11, 5, cropBlock('potato', 0));
  const crops = new Crops();
  crops.plant(5, 11, 5, 'potato', 0);
  let changes = crops.grow(world, STAGE_SECONDS * 1000 * 2 + 10);
  ok('growing moves a crop on to the stage its age says', world.getBlock(5, 11, 5) === cropBlock('potato', 2));
  ok('and reports what it changed', changes.length === 1 && changes[0].next === cropBlock('potato', 2));
  changes = crops.grow(world, STAGE_SECONDS * 1000 * 2 + 20);
  ok('nothing changes until the next stage is due', changes.length === 0);

  // Saved and loaded, it keeps its planting time — so it grows while you're away.
  const back = new Crops();
  back.loadJSON(JSON.parse(JSON.stringify(crops.toJSON())));
  back.grow(world, STAGE_SECONDS * 1000 * 10);
  ok('a saved field keeps growing where it left off', world.getBlock(5, 11, 5) === cropBlock('potato', RIPE));
  ok('a save with a crop that no longer exists is skipped', (() => {
    const c = new Crops(); c.loadJSON([{ x: 1, y: 1, z: 1, kind: 'turnip', at: 0 }]); return c.planted.size === 0;
  })());

  world.setBlock(5, 11, 5, 0);
  back.grow(world, STAGE_SECONDS * 1000 * 12);
  ok('a crop that has gone is forgotten', back.planted.size === 0);
}

// --- harvest -------------------------------------------------------------------

{
  const green = harvestOf(cropBlock('lettuce', 1));
  ok('picking it early gives the seed back', green.seeds_lettuce === 1 && !green.lettuce);
  const ripe = harvestOf(cropBlock('lettuce', RIPE));
  ok('picking it ripe gives the crop and more seeds than went in', ripe.lettuce === 2 && ripe.seeds_lettuce === 2);
  ok('a carrot gives carrots', harvestOf(cropBlock('carrot', RIPE)).vegetables === 2);
  ok('and anything else is not a harvest', harvestOf(FARMLAND) === null);
}

// --- the farm ------------------------------------------------------------------

{
  const farm = STRUCTURES_BY_ID.get('farm');
  // Backlog batch 2: nothing needs planting to build one, and it grows the
  // seeds put into it — see farmseeds.test.mjs for putting them in.
  ok('a farm needs nothing planted, and costs no seeds', !farm.requires.some((r) => r.id === 'crops') && !farm.cost);
  ok('and makes whatever seeds were put in it', farm.fromCrops === true);

  const made = farmProduce({ seeds: ['pepper', 'broccoli'] });
  ok('a pepper seed and a broccoli seed in make peppers and broccoli', made.pepper === 1 && made.broccoli === 1);
  ok('and a seed of each', made.seeds_pepper === 1 && made.seeds_broccoli === 1);
  ok('nothing it does not grow', !made.vegetables && !made.cabbage);
  ok('nothing put in, nothing grows', Object.keys(farmProduce({})).length === 0 && Object.keys(farmProduce({ seeds: [] })).length === 0);
  ok(`up to ${FARM_SEED_SLOTS} crops`, FARM_SEED_SLOTS === 4);

  const design = DESIGN_FOR_STRUCTURE.get('farm');
  const blocks = design?.blocks ?? [];
  ok('the starter plot is bare soil, so it costs no seeds (backlog batch 2)',
    blocks.length === 16 && blocks.every((b) => b.type === FARMLAND) && !Object.keys(design.cost).some((id) => id.startsWith('seeds')));
}

// --- in the game -----------------------------------------------------------------

ok('seeds only go in farmland', /Seeds go in farmland/.test(game) && /getBlock\(t\.x, t\.y - 1, t\.z\) !== FARMLAND/.test(game));
ok('what is planted is tracked as it is placed', /this\.duilt\.crops\.plant\(c\.x, c\.y, c\.z, is\.kind\)/.test(game));
ok('and forgotten when broken', /this\.duilt\.crops\.remove\(c\.x, c\.y, c\.z\)/.test(game));
ok('the game grows its crops as it runs', /this\.growCrops\(dt\)/.test(game) && /this\.duilt\.crops\.grow\(this\.world\)/.test(game));
ok('no mixed seeds any more (backlog batch 2)', !/plantMixed/.test(game));
ok('taking the soil away takes the crop with it', /withUprooted\(this\.with(Bed|Door)Halves/.test(game));
ok('animals follow you holding any of it', CROPS.every((c) => game.includes('c.produce, `seeds_${c.kind}`')));

// --- the icons -------------------------------------------------------------------

{
  // Reported directly: "improve the icons to the 3D version of each fruit
  // and veggie — now they are cards, weird, not matching the rest."
  const foods = ['fruit', ...CROPS.map((c) => c.produce)];
  ok('every fruit and vegetable is drawn as a model', foods.every((id) => /<svg class="cube"/.test(itemIcon(ITEMS_BY_ID.get(id)) ?? '')));
  ok('and each one differently', new Set(foods.map((id) => itemIcon(ITEMS_BY_ID.get(id)))).size === foods.length);
  ok('seed packets differ by crop', new Set(CROPS.map((c) => itemIcon(ITEMS_BY_ID.get(`seeds_${c.kind}`)))).size === CROPS.length);
}

process.exit(f ? 1 : 0);
