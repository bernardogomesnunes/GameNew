// Owner, 8 November: "I am having issues in age 9 to place a village,
// receive the message saying that the building would cross protected land."
// One message stood for three problems. The reason now says which: outside
// your land, over one of your buildings, or you standing in its outline.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VillagerJobs } from '../src/duilt/VillagerJobs.js';
import { Inventory } from '../src/items/Inventory.js';
import { World } from '../src/world/World.js';

const world = new World({ sizeX: 32, sizeZ: 32, height: 16 });
const inventory = new Inventory(); inventory.add('planks', 12);
const hall = { id: 1, type: 'work_hall', valid: true, region: { minX: 1, maxX: 3, minY: 1, maxY: 4, minZ: 1, maxZ: 3 } };
const structures = { list: () => [hall], storeFor: () => null };
const plan = { name: 'Starter village', type: 'village', changes: [{ x: 12, y: 1, z: 7, prev: 0, next: 7 }] };
for (const why of ['Part of it is outside your land. Move it in, or grow your land first.', 'It would build over your Storehouse. Move it clear of it.', 'You are standing where it would be built. Step out of its outline and place it again.']) {
  const jobs = new VillagerJobs({ world, settlers: { people: [] }, structures, inventory, canPlace: () => false });
  jobs.placeProblem = () => why;
  const r = jobs.enqueueBuild(plan);
  assert.equal(r.ok, false);
  assert.equal(r.reason, why);
}
// Without a reason to give, the old message still stands.
const plain = new VillagerJobs({ world, settlers: { people: [] }, structures, inventory, canPlace: () => false });
assert.equal(plain.enqueueBuild(plan).reason, 'The building would cross protected land.');
console.log('PASS a refused build says why: outside your land, over a building, or you in the way');

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
assert.match(game, /d\.jobs\.placeProblem=c=>\{[\s\S]{0,900}outside your land[\s\S]{0,400}build over your[\s\S]{0,400}You are standing where it would be built/);
console.log('PASS Game gives each reason, in the order it checks them');
