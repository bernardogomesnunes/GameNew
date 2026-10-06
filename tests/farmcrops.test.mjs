import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Crops } from '../src/duilt/Crops.js';
import { cropOf, cropBlock, STAGE_SECONDS, RIPE } from '../src/config/crops.js';

/**
 * Backlog batch 3, #13: "Farms show their crops. A farm's crops grow visibly
 * on its farmland, the same as ones you plant yourself. You can plant in the
 * farm's tilled soil by hand."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const FARMLAND = 21, DIRT = 2;
const RIPE_MS = RIPE * STAGE_SECONDS * 1000;

/** A claimed, locked 4×4 farm at (4..7, 1, 4..7) on dirt, nothing put in it yet. */
function setup() {
  const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.setBlock(x, 0, z, DIRT);
  for (let x = 4; x < 8; x++) for (let z = 4; z < 8; z++) world.setBlock(x, 1, z, FARMLAND);
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  const farm = { id: 1, type: 'farm', valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, brokenReason: null,
    region: { minX: 4, maxX: 7, minY: 1, maxY: 1, minZ: 4, maxZ: 7 } };
  g.structures.structures.push(farm);
  return { world, g, farm };
}
const cropsAt = (world) => {
  const out = [];
  for (let x = 4; x < 8; x++) for (let z = 4; z < 8; z++) { const c = cropOf(world.getBlock(x, 2, z)); if (c) out.push(c); }
  return out;
};

{
  const { world, g, farm } = setup();
  g.tendFarms(world, 1000);
  ok('nothing put in, nothing comes up', cropsAt(world).length === 0);

  g.inventory.add('seeds_carrot', 1); g.inventory.add('seeds_potato', 1);
  g.sowFarm(farm, 'carrot'); g.sowFarm(farm, 'potato');
  const changed = g.tendFarms(world, 1000);
  const up = cropsAt(world);
  ok(`what's put in comes up on every bare tilled block (${up.length} of 16)`, up.length === 16 && changed.length === 16);
  ok('the crops take turns across the field, half and half', up.filter((c) => c.kind === 'carrot').length === 8 && up.filter((c) => c.kind === 'potato').length === 8);
  ok('as seedlings', up.every((c) => c.stage === 0));
  ok('and they are crops like any other: the same clock grows them', g.crops.planted.size === 16 && [...g.crops.planted.values()].every((c) => c.farm === farm.id));

  g.crops.grow(world, 1000 + STAGE_SECONDS * 1000);
  ok('a stage on', cropsAt(world).every((c) => c.stage === 1));
  g.crops.grow(world, 1000 + RIPE_MS);
  ok('and ripe, in time', cropsAt(world).every((c) => c.stage === RIPE));
  ok('tending again changes nothing while they stand ripe', g.tendFarms(world, 1000 + RIPE_MS).length === 0);

  // The farm pays out after they ripened: it cuts them and sows again.
  farm.lastPaidAt = 1000 + RIPE_MS + 5000;
  const cut = g.tendFarms(world, farm.lastPaidAt + 1000);
  ok('when the farm pays out, what was ripe is cut and sown again', cut.length === 16 && cropsAt(world).every((c) => c.stage === 0));
  // ...and they grow back, rather than being cut again the moment they ripen.
  g.crops.grow(world, farm.lastPaidAt + 1000 + RIPE_MS);
  ok('they grow back and stand ripe till the next payout', g.tendFarms(world, farm.lastPaidAt + 1000 + RIPE_MS).length === 0 && cropsAt(world).every((c) => c.stage === RIPE));

  // Taken out of the farm: its crops come up out of the soil.
  g.unsowFarm(farm, 'potato');
  g.tendFarms(world, farm.lastPaidAt + 2000 + RIPE_MS);
  const left = cropsAt(world);
  ok('a crop taken out comes up out of its soil — and its bare soil gets the one left', left.length === 16 && left.filter((c) => c.kind === 'carrot').length === 16);
}

{
  // A crop that was already growing when the farm paid out isn't cut the moment it ripens.
  const { world, g, farm } = setup();
  g.inventory.add('seeds_carrot', 1); g.sowFarm(farm, 'carrot');
  g.tendFarms(world, 0);
  farm.lastPaidAt = 60_000;
  g.crops.grow(world, RIPE_MS);
  ok('sown before a payout but ripe after it, it stands ripe', g.tendFarms(world, RIPE_MS).length === 0 && cropsAt(world).every((c) => c.stage === RIPE));
}

{
  // Planting by hand in the farm's soil.
  const { world, g, farm } = setup();
  const plantOn = { x: 5, y: 2, z: 5, prev: 0, next: cropBlock('cabbage', 0) };
  ok('a locked farm lets you plant in its soil', g.structures.blocking([plantOn]) == null);
  ok('and pick from it', g.structures.blocking([{ x: 5, y: 2, z: 5, prev: cropBlock('cabbage', 3), next: 0 }]) == null);
  ok('but not dig up its soil', g.structures.blocking([{ x: 5, y: 1, z: 5, prev: FARMLAND, next: 0 }]) === farm);
  ok('or build on it', g.structures.blocking([{ x: 5, y: 1, z: 5, prev: FARMLAND, next: 3 }]) === farm);
  farm.region.maxY = 2;                       // a farm claimed with the air above its soil
  ok('even when the farm was claimed with the air above its soil', g.structures.blocking([plantOn]) == null);
  // What you plant there is yours: the farm sows round it and never touches it.
  world.setBlock(5, 2, 5, plantOn.next);
  g.crops.plant(5, 2, 5, 'cabbage', 0);
  g.inventory.add('seeds_carrot', 1); g.sowFarm(farm, 'carrot');
  g.tendFarms(world, 0);
  g.inventory.add('seeds_potato', 1); g.unsowFarm(farm, 'carrot');
  g.tendFarms(world, 10);
  ok('what you plant there yourself is yours: the farm sows round it and never pulls it up', cropOf(world.getBlock(5, 2, 5))?.kind === 'cabbage' && !g.crops.planted.get('5,2,5').farm);
}

{
  // Saved and loaded, a farm's crops are still its own.
  const c = new Crops();
  c.plant(1, 2, 3, 'carrot', 50, 7);
  c.plant(4, 2, 3, 'potato', 60);
  const back = new Crops();
  back.loadJSON(JSON.parse(JSON.stringify(c.toJSON())));
  ok('saved and loaded, a farm\'s crops still know their farm', back.planted.get('1,2,3').farm === 7 && back.planted.get('4,2,3').farm === undefined);
}

ok('the game tends farms on the crop clock', /this\.duilt\.tendFarms\(this\.world\)/.test(game));
ok('and the farm says so', /They grow in its soil/.test(ui));

process.exit(f ? 1 : 0);
