// IMP-26 (owner, 8 November): "Builders are building but I'm not seeing
// their avatar placing blocks. Also when placing for them to build it should
// add the boundaries of the building. And not collapse with other buildings.
// When placed it should trigger the notification that the builder started."
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { VillagerJobs } from '../src/duilt/VillagerJobs.js';
import { BuildSitesView } from '../src/render/BuildSitesView.js';
import { Inventory } from '../src/items/Inventory.js';
import { World } from '../src/world/World.js';

function setup() {
  const world = new World({ sizeX: 48, sizeZ: 32, height: 24 });
  for (let x = 0; x < 48; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 2);
  const inventory = new Inventory(); inventory.add('planks', 40);
  const hall = { id: 1, type: 'work_hall', valid: true, region: { minX: 1, maxX: 3, minY: 1, maxY: 4, minZ: 1, maxZ: 3 } };
  const store = { id: 2, type: 'storehouse', valid: true, region: { minX: 30, maxX: 34, minY: 1, maxY: 4, minZ: 20, maxZ: 24 } };
  const person = { id: 0, name: 'Ada', x: 11.5, y: 1, z: 8.5, homeId: 3, hungry: false };
  const jobs = new VillagerJobs({ world, settlers: { people: [person] }, structures: { list: () => [hall, store], storeFor: () => null }, inventory });
  return { world, jobs, person };
}
const wall = (x0, z, n = 3) => Array.from({ length: n }, (_, i) => ({ x: x0 + i, y: 1, z, prev: 0, next: 7 }));

{
  const { jobs } = setup();
  assert.equal(jobs.hasBuilders(), false, 'nobody assigned: no builders');
  assert.equal(jobs.assign(0, 'builder', 1).ok, true);
  assert.equal(jobs.hasBuilders(), true, 'a builder at a standing Work Hall');
}
console.log('PASS whether there are builders to give a building to');

{
  const { jobs } = setup();
  const r = jobs.enqueueBuild({ name: 'Shed', type: 'house', changes: wall(32, 22) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'It would overlap your Storehouse. Move it clear of it.');
  assert.equal(jobs.enqueueBuild({ name: 'Hut', type: 'house', changes: wall(12, 7) }).ok, true);
  const again = jobs.enqueueBuild({ name: 'Shed', type: 'house', changes: wall(13, 7) });
  assert.equal(again.reason, 'It would overlap Hut, already being built there.');
}
console.log('PASS a building over one of yours, or over one being built, is refused and says which');

{
  const { world, jobs } = setup();
  jobs.assign(0, 'builder', 1);
  const started = [];
  jobs.onBuildStarted = (job, p) => started.push(`${p.name}:${job.name}`);
  jobs.enqueueBuild({ name: 'Hut', type: 'house', changes: wall(12, 7) });
  for (let i = 0; i < 2000 && world.getBlock(14, 1, 7) !== 7; i++) jobs.tick(0.05);
  assert.equal(world.getBlock(14, 1, 7), 7, 'built');
  assert.deepEqual(started, ['Ada:Hut'], 'word once, with the first block');
}
console.log('PASS word that the builder started, once, with the first block');

{
  const scene = new THREE.Scene();
  const view = new BuildSitesView(scene);
  const builds = [{ id: 1, state: 'queued', region: { minX: 0, maxX: 4, minY: 1, maxY: 3, minZ: 0, maxZ: 2 } }, { id: 2, state: 'completed', region: { minX: 9, maxX: 9, minY: 1, maxY: 1, minZ: 9, maxZ: 9 } }];
  view.update(builds);
  assert.equal(view.count, 1, 'an outline for each building being put up');
  const box = view.boxes[0];
  assert.deepEqual([box.position.x, box.position.y, box.position.z], [2.5, 2.5, 1.5], 'round its footprint');
  const first = box;
  view.update(builds);
  assert.equal(view.boxes[0], first, 'nothing remade while nothing changes');
  builds[0].state = 'completed';
  view.update(builds);
  assert.equal(view.count, 0, 'gone when it is done');
}
console.log('PASS the outline of each building being put up, gone when it is done');

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
assert.match(game, /workers \|\| design\.workers \|\| \(!this\.duilt\.sandbox && typeId !== 'mine' && this\.duilt\.jobs\.hasBuilders\(\)\)/);
assert.match(game, /d\.jobs\.onBuildStarted=\(job,p\)=>this\.ui\?\.toast/);
assert.match(game, /this\.buildSites\.update\(/);
console.log('PASS with builders at a Work Hall, what you place goes to them; the word and the outlines are wired');
