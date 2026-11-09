// Owner, 9 November: "if I talk with the npc it should not stop the building."
// Talking to a villager stops them for 4 s and drops where they were walking.
// A builder or hauler at a Work Hall now only turns to face you.
import assert from 'node:assert/strict';
globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { VillagerJobs } = await import('../src/duilt/VillagerJobs.js');
const { Inventory } = await import('../src/items/Inventory.js');
const { World } = await import('../src/world/World.js');
const { Game } = await import('../src/Game.js');

const world = new World({ sizeX: 48, sizeZ: 32, height: 24 });
for (let x = 0; x < 48; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 2);
const inventory = new Inventory(); inventory.add('planks', 40);
const hall = { id: 1, type: 'work_hall', valid: true, region: { minX: 1, maxX: 3, minY: 1, maxY: 4, minZ: 1, maxZ: 3 } };
const structures = { list: () => [hall], storeFor: () => null };
const builder = { id: 0, x: 3.5, y: 1, z: 4.5, homeId: 3, hungry: false, name: 'Ana' };
const farmer = { id: 1, x: 5.5, y: 1, z: 5.5, homeId: 3, hungry: false, name: 'Rui', target: { x: 9, z: 9 }, atWork: false };
const jobs = new VillagerJobs({ world, settlers: { people: [builder, farmer] }, structures, inventory });
jobs.assign(0, 'builder', 1);
jobs.enqueueBuild({ name: 'Wall', type: 'house', region: { minX: 12, maxX: 30, minY: 1, maxY: 1, minZ: 7, maxZ: 7 },
  changes: Array.from({ length: 19 }, (_, i) => ({ x: 12 + i, y: 1, z: 7, prev: 0, next: 7 })) });
const game = { player: { position: { x: 0, y: 1, z: 0 } }, duilt: { jobs, structures: { list: () => [] } }, wanderers: null, ui: { toast() {} } };

for (let n = 0; n < 60; n++) jobs.tick(0.1);
builder.target = { x: 20, z: 7 };
Game.prototype.talkTo.call(game, { who: 'settler', person: builder });
assert.deepEqual(builder.target, { x: 20, z: 7 }, 'the builder keeps where it was going');
assert.ok(!(builder.wait > 0), 'and does not stand still');
assert.ok(Number.isFinite(builder.facing), 'it turns to face you');
console.log('PASS talking to a builder turns it to you and leaves its work going');

const before = jobs.builds[0].cursor;
for (let k = 0; k < 10; k++) { Game.prototype.talkTo.call(game, { who: 'settler', person: builder }); for (let n = 0; n < 20; n++) jobs.tick(0.1); }
assert.ok(jobs.builds[0].cursor > before, `the wall goes on going up while you talk (${before} to ${jobs.builds[0].cursor})`);
console.log('PASS the build goes on while you keep talking');

Game.prototype.talkTo.call(game, { who: 'settler', person: farmer });
assert.equal(farmer.target, null);
assert.equal(farmer.wait, 4);
console.log('PASS anyone else still stops for a word, as before');
