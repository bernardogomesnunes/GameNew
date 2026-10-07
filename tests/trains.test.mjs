import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { Trains, RAIL, PART_LENGTH, MAX_CARS, MAX_SPEED, BLOCKS_PER_COAL, BUNKER, CAR_SLOTS, trainLength, nextRail } from '../src/world/Trains.js';
import { BLOCKS_BY_ID, COAL_ORE } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES_BY_ID } from '../src/config/recipes.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { BIOMES } from '../src/config/biomes.js';
import { railBoxes } from '../src/world/propShapes.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

/**
 * Backlog batch 2, asked for directly: "Age 5: a train on a one-block rail
 * down the middle. Each part 8 long, 3 wide and 4 high, built from iron. An
 * engine plus up to 5 cars ... Runs on coal, which comes from the mine as
 * passive output and is found in the big mountains."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

const Y = 4;
function flat() {
  const w = new World({ sizeX: 96, sizeZ: 96, height: 16 });
  for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) w.setBlock(x, Y - 1, z, 3);
  return w;
}
const lay = (w, cells) => { for (const [x, z, y = Y] of cells) w.setBlock(x, y, z, RAIL); };
const line = (x0, x1, z) => Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, z]);

// --- what it's made of ------------------------------------------------------------------------

ok('rail is a block you walk over, with its own shape', BLOCKS_BY_ID.get(RAIL)?.shape === 'rail');
ok('coal ore gives coal, not itself', BLOCKS_BY_ID.get(COAL_ORE)?.drops === 'coal' && ITEMS_BY_ID.has('coal'));
ok('coal is in the high peaks', BIOMES.find((b) => b.id === 'mountains2').ores.some((o) => o.block === COAL_ORE));
ok('and a mine brings it up', STRUCTURES_BY_ID.get('mine').produces.coal > 0);
ok('or wood burns down to it at the foundry — dearer than digging it', (() => {
  const r = RECIPES_BY_ID.get('charcoal');
  return r?.station === 'foundry' && r.output.id === 'coal' && r.inputs.wood >= 3 && r.age <= 5;
})());
ok('engine, cars and rail are worked out at the engineering centre, in Age 5, from iron',
  ['rail', 'locomotive', 'rail_car'].every((id) => { const r = RECIPES_BY_ID.get(id); return r?.station === 'engineering' && r.age === 5 && r.inputs.iron_ingot > 0; }));
ok('each part 8 long', PART_LENGTH === 8 && MAX_CARS === 5);

// --- rail joins up ----------------------------------------------------------------------------

{
  const along = (bs, axis) => bs.filter((b) => b.color == null).every((b) => (axis === 'x' ? b.maxX - b.minX > b.maxZ - b.minZ : b.maxZ - b.minZ > b.maxX - b.minX));
  ok('rail on its own lies along x; joined on z, it runs along z', along(railBoxes({}), 'x') && along(railBoxes({ pz: 1, nz: 1 }), 'z'));
  ok('meeting rail on an x side and a z side, it turns the corner', railBoxes({ px: 1, nz: 1 }).some((b) => b.color == null && b.maxX - b.minX > 0.3) && railBoxes({ px: 1, nz: 1 }).some((b) => b.color == null && b.maxZ - b.minZ > 0.3));
}

// --- set one down -----------------------------------------------------------------------------

{
  const w = flat();
  lay(w, line(10, 40, 20));
  const trains = new Trains({ world: w });
  ok('not on a rail: no', !trains.place({ x: 10, y: Y, z: 30 }, { x: 1, z: 0 }).ok);
  const short = flat(); lay(short, line(10, 14, 20));
  ok('on too short a line: no, and it says how much it needs', /9/.test(new Trains({ world: short }).place({ x: 14, y: Y, z: 20 }, { x: 1, z: 0 }).reason));
  const r = trains.place({ x: 35, y: Y, z: 20 }, { x: 1, z: 0 });
  ok('on a line of rail: there, facing the way you look', r.ok && trains.parts(r.train)[0].yaw > 1.5 && trains.parts(r.train)[0].yaw < 1.6);
  const t = r.train;
  const front = trains.pointAt(t, t.head);
  ok(`its front is the rail you pointed at (${front.x}, ${front.z})`, front.x === 35.5 && front.z === 20.5);

  // Cars couple on behind, as long as there's rail for them.
  for (let i = 0; i < 2; i++) trains.couple(t);
  ok('cars couple on behind', t.cars === 2 && trains.parts(t).length === 3 && trains.parts(t)[2].x < trains.parts(t)[1].x);
  const tooFar = trains.couple(t);
  ok('but not past the end of the rail behind it', !tooFar.ok && t.cars === 2);

  // Driving: no coal, no go; coal, and it goes, and burns it.
  t.throttle = 1;
  for (let i = 0; i < 60; i++) trains.tick(1 / 30);
  ok('with no coal it doesn\'t move', t.speed === 0);
  trains.loadCoal(t, 3);
  const x0 = trains.pointAt(t, t.head).x;
  for (let i = 0; i < 90; i++) trains.tick(1 / 30);
  const x1 = trains.pointAt(t, t.head).x;
  ok(`fired, it pulls away along the rail (${(x1 - x0).toFixed(1)} blocks in 3 s)`, x1 > x0 + 2 && x1 <= 40.5 && t.speed <= MAX_SPEED);
  ok('and burns coal as it goes', t.coal < 3);
  // The cars follow on the rail.
  ok('the cars come along behind it, on the line', trains.parts(t).every((p) => Math.abs(p.z - 20.5) < 1e-6));
  // To the end of the line: it stops there.
  for (let i = 0; i < 600; i++) trains.tick(1 / 30);
  ok(`at the end of the line it stops (${trains.pointAt(t, t.head).x})`, t.speed === 0 && trains.pointAt(t, t.head).x === 40.5);
  // Let go: it rolls to a stop.
  t.throttle = -1;
  for (let i = 0; i < 60; i++) trains.tick(1 / 30);
  t.throttle = 0;
  for (let i = 0; i < 600; i++) trains.tick(1 / 30);
  ok('back the other way, then let go: it rolls to a stop', t.speed === 0 && trains.pointAt(t, t.head).x < 40.5);
  ok('a coal takes it a good way', BLOCKS_PER_COAL >= 100 && BUNKER > 0);
}

// --- round a bend, and up a step ---------------------------------------------------------------

{
  const w = flat();
  // East along z=20 to x=40, then north along x=40 to z=60, a step up at z=50.
  lay(w, line(10, 40, 20));
  lay(w, Array.from({ length: 29 }, (_, i) => [40, 21 + i]));
  lay(w, Array.from({ length: 11 }, (_, i) => [40, 50 + i, Y + 1]));
  for (let z = 50; z <= 60; z++) w.setBlock(40, Y, z, 3);
  ok('the rail ahead round a bend is found', JSON.stringify(nextRail(w, { x: 39, y: Y, z: 20 }, { x: 40, y: Y, z: 20 })) === JSON.stringify({ x: 40, y: Y, z: 21 }));
  const trains = new Trains({ world: w });
  const t = trains.place({ x: 28, y: Y, z: 20 }, { x: 1, z: 0 }).train;
  trains.couple(t);
  t.throttle = 1;
  for (let i = 0; i < 30 * 30; i++) trains.tick(1 / 30, { endless: true });
  const [engine, car] = trains.parts(t);
  ok(`round the bend and up the step to the end (${engine.x}, ${engine.y}, ${engine.z})`, engine.x === 40.5 && engine.z > 55 && engine.y === Y + 1);
  ok('facing north now', Math.abs(engine.yaw) < 0.01);
  ok('its car followed it round', Math.abs(car.x - 40.5) < 1e-6 && car.z < engine.z);
  // Saved and back.
  const back = new Trains({ world: w });
  back.loadJSON(JSON.parse(JSON.stringify(trains.toJSON())));
  ok('saved with the world, where it was', back.list.length === 1 && Math.abs(back.parts(back.list[0])[0].z - engine.z) < 0.01 && back.list[0].cars === 1);
}

// --- picking it out, and the bag --------------------------------------------------------------

{
  const w = flat();
  lay(w, line(10, 40, 20));
  const d = new DuiltGame({ world: w, scene: new THREE.Scene(), bus: null, age: 5 });
  d.inventory.add('locomotive', 1); d.inventory.add('rail_car', 2); d.inventory.add('coal', 10);
  const r = d.placeTrain({ x: 30, y: Y, z: 20 }, { x: 1, z: 0 });
  ok('your steam engine goes from your bag onto the rail', r.ok && d.inventory.countOf('locomotive') === 0);
  ok('a car from your bag couples on', d.coupleCar(r.train).ok && d.inventory.countOf('rail_car') === 1);
  ok('coal from your bag into its bunker', d.fuelTrain(r.train) === 10 && d.inventory.countOf('coal') === 0 && r.train.coal === 10);
  // A ray at the engine's side picks it; past its end, nothing.
  const hit = d.trains.pick({ x: 27, y: Y + 2, z: 15 }, { x: 0, y: 0, z: 1 }, 10);
  ok('a look at its side picks it out', hit?.part.kind === 'engine');
  ok('a look past it picks nothing', !d.trains.pick({ x: 45, y: Y + 2, z: 15 }, { x: 0, y: 0, z: 1 }, 10));
  ok('hit, the last car comes off first', d.pickUpTrain(r.train).piece === 'rail_car' && d.inventory.countOf('rail_car') === 2);
  ok('then the engine, with its coal', d.pickUpTrain(r.train).piece === 'locomotive' && d.inventory.countOf('locomotive') === 1 && d.inventory.countOf('coal') === 10 && !d.trains.list.length);
  const saved = JSON.parse(JSON.stringify(d.toJSON()));
  ok('trains are kept in the save', Array.isArray(saved.trains));
}

// --- what a car carries ---------------------------------------------------------------------

{
  const w = flat();
  lay(w, line(10, 40, 20));
  const d = new DuiltGame({ world: w, scene: new THREE.Scene(), bus: null, age: 5 });
  d.inventory.add('locomotive', 1); d.inventory.add('rail_car', 1); d.inventory.add('stone', 300);
  const t = d.placeTrain({ x: 35, y: Y, z: 20 }, { x: 1, z: 0 }).train;
  d.coupleCar(t);
  const car = d.containerFor({ car: t.loads[0] });
  ok(`a car carries ${CAR_SLOTS} slots`, CAR_SLOTS === 1000 && car?.size === 1000);
  const sum = d.storeSummary({ car });
  ok('and opens like a cart, as a car', sum.car && sum.size === 1000 && sum.free === 1000);
  d.inventory.moveTo(car, d.inventory.slots.findIndex((x) => x?.id === 'stone'));
  ok('goods go from your bag into it', car.countOf('stone') > 0);
  ok('a car with goods in it stays on — empty it first', !d.pickUpTrain(t).ok && t.cars === 1);
  // Kept with the world, slot for slot, and small: only what's in it.
  const saved = JSON.parse(JSON.stringify(d.toJSON()));
  const back = new DuiltGame({ world: w, scene: new THREE.Scene(), bus: null, age: 5 });
  back.loadJSON(saved);
  ok('what\'s in the car comes back with the save', back.trains.list[0]?.loads[0]?.countOf('stone') === car.countOf('stone'));
  ok('and an empty thousand slots costs the save nothing', JSON.stringify(saved.trains).length < 600);
}

// --- in the game --------------------------------------------------------------------------------

ok('Place with an engine sets it on the rail you point at', /locomotive: 'setDownTrain'/.test(game) && /setDownTrain\(\) \{/.test(game));
ok('Place on a train: coal fires it, a car couples, else you drive', /const train = this\.trainTarget\(aimed\);\s*if \(train\) return void this\.useTrain\(train\.train, train\.part\);/.test(game));
ok('forward and back are the throttle, keys or stick alike', /t\.throttle = p\.moveInput\(\)\.z;/.test(game));
ok('Sneak gets you down', /if \(p\.sneaking\) return void this\.leaveTrain\(\);/.test(game));
ok('hit a train and it comes apart into your bag', /if \(this\.pickUpMachine\(hit\) \|\| this\.pickUpTrain\(hit\)\) return true;/.test(game));
ok('the length of a full train', trainLength(5) === 48 + 2.5);

process.exit(f ? 1 : 0);
