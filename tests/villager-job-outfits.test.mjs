// Owner, 31 October: villagers "remain as they are and have a change of style
// and avatar when they get a job"; jobs only once the Work Hall is placed;
// "the job should match"; back to their own look when the job ends.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { Settlers } from '../src/duilt/Settlers.js';
import { SETTLERS } from '../src/config/settlers.js';
import { JOB_OUTFITS, JOB_FOR_BUILDING } from '../src/config/outfits.js';
import { STRUCTURES } from '../src/config/structures.js';

const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) { world.setBlock(x, 10, z, 3); world.surfaceHeightMap[x * 64 + z] = 11; }
const inventory = new Inventory();
inventory.add('vegetables', 50);
const structures = new StructureRegistry({ world, bus: null, inventory });
let id = 1;
const add = (type, region) => { const s = { id: id++, type, region, valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, brokenReason: null }; structures.structures.push(s); return s; };
add('house', { minX: 10, maxX: 14, minY: 11, maxY: 14, minZ: 10, maxZ: 14 });
add('house', { minX: 2, maxX: 6, minY: 11, maxY: 14, minZ: 2, maxZ: 6 });
add('quarry', { minX: 20, maxX: 25, minY: 11, maxY: 13, minZ: 10, maxZ: 15 });
let r = 0;
const settlers = new Settlers({ world, structures, inventory, skills: { settlerAllowance: () => 0 }, bus: null, rand: () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648) });
for (let i = 0; i < 3; i++) settlers.tick(SETTLERS.arriveEverySeconds + 1);
for (let i = 0; i < 40; i++) settlers.tick(0.5);
const p = settlers.people[0];
assert.ok(p, 'somebody moved in');
assert.equal(p.workId, null, 'no Work Hall: no job');
assert.equal(p.job, null, 'and their own look');
console.log('PASS before a Work Hall, villagers work nowhere and wear their own clothes');

const hall = add('work_hall', { minX: 40, maxX: 44, minY: 11, maxY: 14, minZ: 40, maxZ: 44 });
for (let i = 0; i < 40; i++) settlers.tick(0.5);
assert.ok(p.workId != null, 'with a Work Hall they find work');
assert.equal(p.job, 'miner', 'at the quarry, a miner');
console.log('PASS with a Work Hall they take a job, and dress for it (a quarry: a miner)');

hall.valid = false;
settlers.tick(0.5);
assert.equal(p.workId, null);
assert.equal(p.job, null, 'back to their own look');
console.log('PASS the Work Hall gone, the job and the work clothes go too');

settlers.jobs = { controls: () => true, assignment: () => ({ role: 'builder' }) };
hall.valid = true;
settlers.tick(0.5);
assert.equal(p.job, 'builder', 'a Work Hall builder dresses as a builder');
console.log('PASS a Work Hall role has its own work clothes');

for (const [building, job] of Object.entries(JOB_FOR_BUILDING)) {
  assert.ok(STRUCTURES.some((s) => s.id === building), `${building} is a building`);
  assert.ok(JOB_OUTFITS[job]?.vest != null && JOB_OUTFITS[job].tool, `${job} has work clothes`);
}
const working = STRUCTURES.filter((s) => s.everySeconds && Object.keys(s.produces ?? {}).length);
assert.ok(working.every((s) => JOB_FOR_BUILDING[s.id]), 'every building that employs someone gives a matching job');
console.log('PASS every working building gives its own matching job and outfit');

// Drawn on their own model: vest, hat and tool parts appear only with a job.
const { SettlerView } = await import('../src/render/SettlerView.js');
const { addKit } = await import('../src/render/Models.js');
const geo = (h) => { const g = new THREE.BoxGeometry(0.5, h, 0.3); g.translate(0, h / 2, 0); return g; };
const bone = (name, parent, y, g) => ({ name, parent, position: new THREE.Vector3(0, y, 0), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1), geometry: g });
addKit('settler', { id: 'settler', root: null, material: new THREE.MeshBasicMaterial(),
  bones: [bone('root', -1, 0, null), bone('body', 0, 0.75, geo(0.75)), bone('head', 1, 0.75, geo(0.5)), bone('arm_r', 1, 0.6, (() => { const g = new THREE.BoxGeometry(0.2, 0.6, 0.2); g.translate(0, -0.3, 0); return g; })())] });
const view = new SettlerView({ add() {} }, 'settlers');
const visible = (slot) => { const m = new THREE.Matrix4(); view.parts.getMatrixAt(slot, m); return Math.abs(m.determinant()) > 1e-9; };
const villager = { id: 1, name: 'Anna', kind: 'settler', x: 0, y: 0, z: 0 };
villager._hash = 0;  // the plain 'settler' model
view.update([villager]);
assert.ok(![11, 8, 13].some(visible), 'no vest, hat or tool without a job');
villager.job = 'farmer';
view.update([villager]);
assert.ok([11, 8, 13].every(visible), 'vest, hat and tool with one');
console.log('PASS work clothes are drawn on their own model, only while they have a job');
