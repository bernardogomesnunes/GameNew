// IMP-12: builders are seen placing each block, a block takes BUILD_SECONDS,
// and building goes on while the game is closed (owe).
import assert from 'node:assert/strict';
import { VillagerJobs, BUILD_SECONDS, BLOCK_SECONDS_AWAY } from '../src/duilt/VillagerJobs.js';
import { Inventory } from '../src/items/Inventory.js';
import { World } from '../src/world/World.js';

function setup(n = 3) {
  const world = new World({ sizeX: 48, sizeZ: 32, height: 24 });
  for (let x = 0; x < 48; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 2);
  const inventory = new Inventory(); inventory.add('planks', 40);
  const hall = { id: 1, type: 'work_hall', valid: true, region: { minX: 1, maxX: 3, minY: 1, maxY: 4, minZ: 1, maxZ: 3 } };
  const structures = { list: () => [hall], storeFor: () => null };
  const person = { id: 0, x: 11.5, y: 1, z: 8.5, homeId: 3, hungry: false };
  const jobs = new VillagerJobs({ world, settlers: { people: [person] }, structures, inventory });
  jobs.assign(0, 'builder', 1);
  const changes = Array.from({ length: n }, (_, i) => ({ x: 12 + i, y: 1, z: 7, prev: 0, next: 7 }));
  jobs.enqueueBuild({ name: 'Wall', type: 'house', region: { minX: 12, maxX: 12 + n - 1, minY: 1, maxY: 1, minZ: 7, maxZ: 7 }, changes });
  return { world, jobs, person };
}

{
  const { world, jobs, person } = setup(1);
  let swings = 0, t = 0;
  while (world.getBlock(12, 1, 7) === 0 && t < 30) {
    const was = person.strike ?? 0;
    jobs.tick(0.05); t += 0.05;
    if ((person.strike ?? 0) > was) swings++;
  }
  assert.ok(t >= BUILD_SECONDS, `a block takes at least ${BUILD_SECONDS} s (${t.toFixed(2)} s)`);
  assert.ok(swings >= 2, `you see the builder swing at it (${swings} swings)`);
  console.log('PASS a builder swings at each block, which takes time to go in');
}
{
  const { world, jobs } = setup(5);
  jobs.owe(BLOCK_SECONDS_AWAY * 3 * 1000);
  for (let i = 0; i < 3; i++) jobs.tick(0.05);
  const placed = [12, 13, 14, 15, 16].filter((x) => world.getBlock(x, 1, 7) === 7).length;
  assert.equal(placed, 3, 'the blocks owed while closed went in');
  const saved = jobs.toJSON();
  assert.equal(saved.owedSeconds, 0);
  console.log('PASS building goes on while the game is closed, and catches up on opening');
}
{
  const { jobs } = setup(2);
  jobs.owe(3600 * 1000);
  assert.equal(jobs.owedSeconds, 2 * BLOCK_SECONDS_AWAY, 'never more than what is left to build');
  console.log('PASS what is owed never exceeds the blocks left');
}
{
  // IMP-20: your own building goes up by itself, 1.5 times as slow, no Work Hall needed.
  const { SELF_BLOCK_SECONDS } = await import('../src/duilt/VillagerJobs.js');
  const world = new World({ sizeX: 48, sizeZ: 32, height: 24 });
  for (let x = 0; x < 48; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 2);
  const inventory = new Inventory(); inventory.add('planks', 10);
  const builder = { id: 0, x: 30.5, y: 1, z: 20.5, hungry: false };
  const jobs = new VillagerJobs({ world, settlers: { people: [builder] }, structures: { list: () => [], storeFor: () => null }, inventory });
  const done = [];
  jobs.onBuildComplete = (j) => done.push(j.id);
  const changes = [12, 13, 14].map((x) => ({ x, y: 1, z: 7, prev: 0, next: 7 }));
  const r = jobs.enqueueBuild({ name: 'Hut', type: 'house', changes }, undefined, { self: true });
  assert.ok(r.ok, r.reason);
  assert.equal(inventory.countOf('planks'), 7, 'paid up front');
  assert.equal(SELF_BLOCK_SECONDS, BLOCK_SECONDS_AWAY * 1.5);
  let t = 0;
  while (world.getBlock(12, 1, 7) === 0 && t < 20) { jobs.tick(0.1); t += 0.1; }
  assert.ok(Math.abs(t - SELF_BLOCK_SECONDS) < 0.15, `one block every ${SELF_BLOCK_SECONDS} s (${t.toFixed(1)})`);
  for (let i = 0; i < 200; i++) jobs.tick(0.1);
  assert.deepEqual(done, [r.job.id], 'done, and claimed through onBuildComplete');
  console.log('PASS a building you place goes up by itself, 1.5 times as slow as villagers');
  // Closed: not owed.
  const r2 = jobs.enqueueBuild({ name: 'Shed', type: 'house', changes: [{ x: 20, y: 1, z: 7, prev: 0, next: 7 }] }, undefined, { self: true });
  jobs.owe(3600 * 1000);
  assert.ok(!(jobs.owedSeconds > 0), 'nothing owed for your own building while closed');
  assert.ok(r2.ok);
  console.log('PASS your own building waits while the game is closed');
}
