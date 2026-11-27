import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { BLOCKS, BLOCKS_BY_ID } from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { EXPLORER_PACK } from '../src/config/wanderers.js';
import { itemIcon } from '../src/config/cubes.js';
import { boxesFor } from '../src/world/propShapes.js';
import {
  FRUIT_PLANTS, FRUIT_SEEDS, POT_BLOCK, SEGMENTS, PLANT_IDS, plantBlock, plantOf, YOUNG_AT, GROWN_AT,
} from '../src/config/fruitPlants.js';
import * as GameBuild from '../src/game/GameBuild.js';

/** FRUIT-3 and FRUIT-4: the Plant Pot and the fruit plants that grow in it. */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const flat = () => {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 48 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 1);
  return world;
};
/** A stand-in for Game: just what the plant code in GameBuild reaches for. */
function rig() {
  const world = flat();
  const duilt = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, sandbox: false });
  const toasts = [];
  const game = { world, duilt, ui: { toast: (t) => toasts.push(t) }, remeshDirty() {}, toasts };
  game.withPlants = (c) => GameBuild.withPlants.call(game, c);
  game.pickFruitPlant = (x, y, z) => GameBuild.pickFruitPlant.call(game, x, y, z);
  game.fruitPlantHint = (h) => GameBuild.fruitPlantHint.call(game, h);
  return game;
}
/** Pot at y=1, seed in the cell above, as placing it does. */
function sow(game, kind, at = 0, x = 5, z = 5) {
  game.world.setBlock(x, 1, z, POT_BLOCK);
  game.world.setBlock(x, 2, z, plantBlock(kind, 'sprout'));
  game.duilt.fruitPlants.plant(x, 2, z, kind, at);
  return { x, y: 2, z };
}
const column = (game, { x, y, z }) => [0, 1, 2, 3].map((d) => plantOf(game.world.getBlock(x, y + d, z))?.segment ?? null);

// --- items, blocks, recipes ---------------------------------------------------------------

const ids = BLOCKS.map((b) => b.id);
ok('no two blocks share an id', new Set(ids).size === ids.length);
ok('a pot and 4 kinds x 9 segments', PLANT_IDS.length === 36 && PLANT_IDS.every((id) => BLOCKS_BY_ID.has(id)) && BLOCKS_BY_ID.has(POT_BLOCK));
ok('every plant look is drawn', PLANT_IDS.every((id) => boxesFor(BLOCKS_BY_ID.get(id).shape).length >= 3) && boxesFor('plant_pot').length >= 3);
ok('the pot is an item that places the pot block', ITEMS_BY_ID.get('plant_pot')?.block === POT_BLOCK && ITEM_FOR_BLOCK.get(POT_BLOCK) === 'plant_pot');
ok('four fruit seeds, each places its sprout', FRUIT_SEEDS.length === 4 && FRUIT_PLANTS.every((p) => ITEMS_BY_ID.get(p.seed)?.block === plantBlock(p.kind, 'sprout')));
ok('the pot and seeds have icons', ['plant_pot', ...FRUIT_SEEDS].every((id) => /<svg class="cube"/.test(itemIcon(ITEMS_BY_ID.get(id)) ?? '')));
{
  const pots = RECIPES.filter((r) => r.output.id === 'plant_pot');
  ok('made at the workbench from clay or planks', pots.length === 2 && pots.every((r) => r.station === 'workbench') && pots.some((r) => r.inputs.clay) && pots.some((r) => r.inputs.planks));
  ok('explorers can carry each fruit seed', FRUIT_SEEDS.every((s) => EXPLORER_PACK.some((p) => p[s] === 1)));
}
ok('plants are not walked into', (() => { const w = flat(); w.setBlock(3, 1, 3, plantBlock('apple', 'mid')); return w.collisionBoxAt(3, 1, 3) === null; })());

// --- growing --------------------------------------------------------------------------------

for (const p of FRUIT_PLANTS) {
  const g = rig();
  const base = sow(g, p.kind, 0);
  const fp = g.duilt.fruitPlants;
  ok(`${p.kind}: takes ${p.days} days (3 to 5)`, p.days >= 3 && p.days <= 5);
  fp.grow(g.world, 0);
  ok(`${p.kind}: a sprout on day 0`, column(g, base).join() === 'sprout,,,');
  fp.grow(g.world, p.days * YOUNG_AT + 0.01);
  ok(`${p.kind}: young after a third of the time`, column(g, base).join() === 'young,,,');
  fp.grow(g.world, p.days * GROWN_AT + 0.01);
  ok(`${p.kind}: four blocks high, no fruit yet`, column(g, base).join() === 'base,low,mid,top');
  fp.grow(g.world, p.days);
  ok(`${p.kind}: ripe fruit shows on the low, mid and top`, column(g, base).join() === 'base,low_ripe,mid_ripe,top_ripe');
  ok(`${p.kind}: a ripe look differs from a bare one`, boxesFor(`fplant_${p.kind}_mid_ripe`).length > boxesFor(`fplant_${p.kind}_mid`).length);
}

// --- picking --------------------------------------------------------------------------------

{
  const g = rig();
  const base = sow(g, 'apple', 0);
  const fp = g.duilt.fruitPlants;
  g.duilt.days = 1;
  fp.grow(g.world, g.duilt.days);
  const hit = { x: base.x, y: base.y + 2, z: base.z };
  let kept = g.withPlants([{ ...hit, prev: g.world.getBlock(hit.x, hit.y, hit.z), next: 0 }]);
  ok('hitting an unripe plant breaks nothing and picks nothing', kept.length === 0 && g.duilt.inventory.countOf('apple') === 4 && g.toasts.length === 1);
  g.duilt.days = 5;
  fp.grow(g.world, g.duilt.days);
  g.duilt.rand = () => 0;
  kept = g.withPlants([{ ...hit, prev: g.world.getBlock(hit.x, hit.y, hit.z), next: 0 }]);
  ok('hitting a ripe one picks and leaves it standing', kept.length === 0 && column(g, base).join() === 'base,low,mid,top');
  const got = g.duilt.inventory.countOf('apple');
  ok('2 to 4 fruit (here 2)', got === 0 + 2);
  const rec = fp.get(base.x, base.y, base.z);
  ok('regrow is 1 or 2 days', rec.regrow === 1 || rec.regrow === 2);
  g.duilt.days = 5 + rec.regrow - 0.1;
  fp.grow(g.world, g.duilt.days);
  ok('not ripe again before then', !column(g, base).some((s) => s?.endsWith('_ripe')));
  g.duilt.days = 5 + rec.regrow;
  fp.grow(g.world, g.duilt.days);
  ok('ripe again after 1 to 2 days', column(g, base).join() === 'base,low_ripe,mid_ripe,top_ripe');
  g.duilt.rand = () => 0.99;
  g.pickFruitPlant(hit.x, hit.y, hit.z);
  ok('a top pick gives 4', g.duilt.inventory.countOf('apple') === got + 4);
}

// --- breaking -------------------------------------------------------------------------------

{
  const g = rig();
  const base = sow(g, 'grape', 0);
  g.duilt.days = 5;
  g.duilt.fruitPlants.grow(g.world, 5);
  const out = g.withPlants([{ x: base.x, y: 1, z: base.z, prev: POT_BLOCK, next: 0 }]);
  ok('breaking the pot takes every cell of the plant with it', out.length === 5 && out.every((c) => c.next === 0));
  for (const c of out) g.world.setBlock(c.x, c.y, c.z, 0);
  g.duilt.onBlocksBroken(out);
  ok('and gives the seed back, once', g.duilt.inventory.countOf('seeds_grape') === 1 && !g.duilt.fruitPlants.get(base.x, base.y, base.z));
}
{
  const g = rig();
  const base = sow(g, 'raspberry', 0);
  g.duilt.days = 5;
  g.duilt.fruitPlants.grow(g.world, 5);
  const out = g.withPlants([{ ...base, prev: g.world.getBlock(base.x, base.y, base.z), next: 0 }]);
  ok('breaking the base takes the whole plant', out.length === 4);
}
{
  const g = rig();
  const base = sow(g, 'passion', 0);
  const out = g.withPlants([{ ...base, prev: g.world.getBlock(base.x, base.y, base.z), next: 0 }]);
  ok('a sprout breaks like a block', out.length === 1);
}

// --- saving ---------------------------------------------------------------------------------

{
  const g = rig();
  const base = sow(g, 'apple', 2);
  g.duilt.fruitPlants.get(base.x, base.y, base.z).pickedAt = 4;
  g.duilt.fruitPlants.get(base.x, base.y, base.z).regrow = 2;
  const save = JSON.parse(JSON.stringify(g.duilt.toJSON()));
  ok('saved', save.fruitPlants.length === 1 && save.fruitPlants[0].kind === 'apple' && save.fruitPlants[0].pickedAt === 4);
  const h = rig();
  h.duilt.loadJSON(save);
  const rec = h.duilt.fruitPlants.get(base.x, base.y, base.z);
  ok('loaded with its days', rec && rec.at === 2 && rec.pickedAt === 4 && rec.regrow === 2);
  delete save.fruitPlants;
  const old = rig();
  old.duilt.loadJSON(save);
  ok('an old save with no plants loads', old.duilt.fruitPlants.planted.size === 0);
}

// --- while away -------------------------------------------------------------------------------

{
  const g = rig();
  const base = sow(g, 'raspberry', 0);
  g.duilt.fruitPlants.grow(g.world, 40);
  ok('a long absence finds it ripe in one step', column(g, base).join() === 'base,low_ripe,mid_ripe,top_ripe');
}
{
  const g = rig();
  const base = sow(g, 'apple', 0);
  g.world.setBlock(base.x, base.y + 2, base.z, 3);
  g.duilt.fruitPlants.grow(g.world, 9);
  ok('a roof over it keeps it young and says why', column(g, base).join() === 'young,,3'.replace('3', '') || plantOf(g.world.getBlock(base.x, base.y, base.z))?.segment === 'young');
  ok('and the hint names the room it needs', /room/.test(g.fruitPlantHint({ ...base, block: g.world.getBlock(base.x, base.y, base.z) })));
}

process.exit(f ? 1 : 0);
