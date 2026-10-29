import assert from 'node:assert/strict';
import { World } from '../src/world/World.js';
import { Defenders } from '../src/world/Defenders.js';

let failed = 0;
const check = (name, run) => {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failed++; console.log(`FAIL ${name}: ${error.message}`); }
};
const region = { minX: 30, maxX: 40, minY: 4, maxY: 9, minZ: 30, maxZ: 40 };
function setup({ floor = true, type = 'barracks', cap = 40 } = {}) {
  const world = new World({ sizeX: 80, sizeZ: 80, height: 32 });
  if (floor) for (let x = 0; x < 80; x++) for (let z = 0; z < 80; z++) world.setBlock(x, 3, z, 3);
  const defenders = new Defenders({ world, rand: () => 0.5 });
  const post = { id: 1, type, region, valid: true, cap };
  for (let i = 0; i < 40; i++) defenders.order(1, type === 'military' ? 'shield_guard' : 'warrior', 0);
  return { world, defenders, post };
}
function safeAndDistinct(world, soldiers) {
  const places = new Set();
  for (const soldier of soldiers) {
    const x = Math.floor(soldier.x), z = Math.floor(soldier.z);
    const floor = world.collisionBoxAt(x, Math.ceil(soldier.y) - 1, z);
    assert.equal(floor?.maxY, soldier.y, `slot ${soldier.slot} has no supporting floor`);
    for (let y = Math.ceil(soldier.y); y < soldier.y + 1.8; y++) {
      assert.equal(world.collisionBoxAt(x, y, z), null, `slot ${soldier.slot} intersects a block`);
    }
    const place = `${x},${z}`;
    assert.ok(!places.has(place), 'two soldiers occupy the same column');
    places.add(place);
    assert.ok(z < region.minZ, 'formation extends inside or behind the building');
  }
}

check('a blocked formation slot uses another clear position', () => {
  const { world, defenders, post } = setup();
  for (let y = 4; y <= 9; y++) world.setBlock(31, y, 28, 3);
  defenders.sync([post], 100);
  assert.equal(defenders.soldiers.length, 40);
  safeAndDistinct(world, defenders.soldiers);
});

check('each formation slot stands on its own slope height', () => {
  const { world, defenders, post } = setup();
  for (let x = 35; x < 80; x++) for (let z = 0; z < 30; z++) world.setBlock(x, 4, z, 3);
  defenders.sync([post], 100);
  assert.equal(defenders.soldiers.length, 40);
  safeAndDistinct(world, defenders.soldiers);
  assert.ok(new Set(defenders.soldiers.map((s) => s.y)).size > 1, 'slope heights were ignored');
});

check('a small platform benches troops without overlap and retries when ground is added', () => {
  const { world, defenders, post } = setup({ floor: false, cap: 10 });
  for (let x = 34; x <= 36; x++) world.setBlock(x, 3, 28, 3);
  defenders.sync([post], 100);
  assert.equal(defenders.soldiers.length, 3);
  assert.equal(defenders.residents, 40);
  safeAndDistinct(world, defenders.soldiers);
  defenders.sync([post], 100);
  assert.equal(defenders.soldiers.length, 3, 'retry stacked troops on occupied ground');
  for (let x = 30; x <= 40; x++) world.setBlock(x, 3, 27, 3);
  defenders.sync([post], 100);
  assert.equal(defenders.soldiers.length, 10);
  safeAndDistinct(world, defenders.soldiers);
});

for (const type of ['barracks', 'military']) check(`${type} benches overflow consistently across save/load and restores the paid roster`, () => {
  const { world, defenders, post } = setup({ type });
  defenders.sync([post], 100);
  assert.equal(defenders.soldiers.length, 40);
  const roster = [...defenders.barracks(1).roster];
  post.cap = 10;
  defenders.sync([post], 100);
  assert.equal(defenders.soldiers.length, 10, 'live downgrade kept excess troops active');
  assert.deepEqual(defenders.barracks(1).roster, roster, 'downgrade deleted paid troops');
  assert.equal(defenders.residents, 40);
  const loaded = new Defenders({ world });
  loaded.loadJSON(JSON.parse(JSON.stringify(defenders.toJSON())));
  loaded.sync([post], 100);
  assert.equal(loaded.soldiers.length, 10);
  assert.deepEqual(loaded.barracks(1).roster, roster);
  post.cap = 40;
  defenders.sync([post], 100);
  loaded.sync([post], 100);
  assert.equal(defenders.soldiers.length, 40);
  assert.equal(loaded.soldiers.length, 40);
  safeAndDistinct(world, defenders.soldiers);
});

check('nearby posts reserve distinct formation positions', () => {
  const { world, defenders, post } = setup();
  for (let i = 0; i < 40; i++) defenders.order(2, 'shield_guard', 0);
  defenders.sync([post, { ...post, id: 2, type: 'military' }], 100);
  assert.equal(defenders.soldiers.length, 80);
  safeAndDistinct(world, defenders.soldiers);
});

check('formation searches leave unloaded terrain ungenerated', () => {
  const world = new World({ height: 32, gen: { fill() {}, biomes: { centreX: 0, centreZ: 0 } } });
  for (let x = 0; x < 16; x++) for (let z = 16; z < 32; z++) world.setBlock(x, 3, z, 3);
  const before = world.chunks.size;
  const defenders = new Defenders({ world });
  for (let i = 0; i < 40; i++) defenders.order(1, 'warrior', 0);
  const post = { id: 1, type: 'barracks', valid: true, cap: 40, region: { ...region, minX: 1, maxX: 11 } };
  defenders.sync([post], 100);
  assert.equal(world.chunks.size, before, 'formation search generated more chunks');
  assert.equal(defenders.soldiers.length, 40);
});

if (failed) process.exit(1);
