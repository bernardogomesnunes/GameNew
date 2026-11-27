// VIL-1: villagers go to bed at night and get up at dawn.
import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { Settlers } from '../src/duilt/Settlers.js';
import { VillagerJobs } from '../src/duilt/VillagerJobs.js';
import { isBedtime } from '../src/duilt/sleepSpots.js';
import { BED, BED_HEAD, CAMPFIRE } from '../src/config/blocks.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

function setup({ beds = true, fire = false } = {}) {
  const world = new World({ sizeX: 64, sizeZ: 64, height: 32 });
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) { world.setBlock(x, 10, z, 1); world.surfaceHeightMap[x * 64 + z] = 11; }
  const inventory = new Inventory({ slots: 60 });
  inventory.add('vegetables', 500);
  const structures = new StructureRegistry({ world, bus: null, inventory });
  let id = 1;
  const add = (type, region) => { const s = { id: id++, type, region, valid: true, locked: true, claimedAt: 0, lastPaidAt: 0, brokenReason: null }; structures.structures.push(s); return s; };
  add('house', { minX: 4, maxX: 8, minY: 11, maxY: 14, minZ: 4, maxZ: 8 });
  const house = add('house', { minX: 14, maxX: 18, minY: 11, maxY: 14, minZ: 4, maxZ: 8 });
  const hall = add('work_hall', { minX: 30, maxX: 34, minY: 11, maxY: 14, minZ: 30, maxZ: 34 });
  // Bed facing +x (facing 1): foot at (5,11,6), head at (6,11,6).
  if (beds) { world.setBlock(5, 11, 6, BED + 1); world.setBlock(6, 11, 6, BED_HEAD + 1); }
  if (fire) world.setBlock(24, 11, 24, CAMPFIRE);
  let r = 7;
  const rand = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
  const settlers = new Settlers({ world, structures, inventory, skills: { settlerAllowance: () => 0 }, bus: null, rand });
  const jobs = new VillagerJobs({ world, settlers, structures, inventory, bus: null });
  settlers.arrive();
  return { world, settlers, jobs, hall, house, structures };
}
const run = (settlers, seconds, dt = 0.25) => { for (let t = 0; t < seconds; t += dt) { settlers.tick(dt); settlers.jobs.tick(dt); } };

ok('noon is not bedtime', !isBedtime(0.5));
ok('midnight is bedtime', isBedtime(0));
ok('0.4 is day, 0.05 is night', !isBedtime(0.4) && isBedtime(0.05));

{
  const { settlers } = setup();
  const p = settlers.people[0];
  ok('arrives in the empty house', p.homeId === 1);
  let night = false;
  settlers.night = () => night;
  run(settlers, 10);
  ok('awake by day', !p.sleep && !(p.lie > 0));
  night = true;
  run(settlers, 60);
  ok('asleep in the bed', p.sleep?.state === 'asleep' && p.sleep.kind === 'bed');
  ok('lying (lie 1) with head toward +x', p.lie === 1 && p.lieDir.x === 1 && p.lieDir.z === 0);
  ok('lies on the bed sheet', Math.abs(p.y - 11.54) < 0.01 && p.x >= 4.5 && p.x <= 7 && Math.abs(p.z - 6.5) < 0.01);
  const at = { x: p.x, z: p.z };
  run(settlers, 20);
  ok('stays put all night', p.x === at.x && p.z === at.z);
  night = false;
  run(settlers, 1);
  ok('up at dawn', !p.sleep && p.lie === 0);
  ok('standing on their feet, not in the bed', Math.hypot(p.x - 5.5, p.z - 6.5) > 0.9 && Math.abs(p.y - 11) < 0.5);
}

{
  const { settlers } = setup();
  const p = settlers.people[0];
  settlers.night = () => true;
  run(settlers, 60);
  const j = settlers.toJSON().people[0];
  ok('saved on their feet beside the bed', p.sleep?.state === 'asleep' && Math.abs(j.y - 11) < 0.5 && Math.hypot(j.x - 5.5, j.z - 6.5) > 0.9);
}

{
  const { settlers } = setup({ beds: false, fire: true });
  const p = settlers.people[0];
  settlers.night = () => true;
  run(settlers, 120);
  ok('no bed, a fire: sleeps by the fire', p.sleep?.state === 'asleep' && p.sleep.kind === 'fire' && Math.hypot(p.x - 24.5, p.z - 24.5) < 5);
}
{
  const { settlers } = setup({ beds: false });
  const p = settlers.people[0];
  settlers.night = () => true;
  run(settlers, 120);
  ok('no bed, no fire: sleeps on the ground', p.sleep?.state === 'asleep' && p.sleep.kind === 'ground' && p.lie === 1);
}

{
  const { settlers } = setup();
  const p = settlers.people[0];
  settlers.night = () => true;
  run(settlers, 60);
  settlers.hurt(p, 1);
  ok('a blow wakes a sleeper', !p.sleep && p.lie === 0);
  run(settlers, 5);
  ok('and they do not go back to bed that night', !p.sleep);
}

{
  const { settlers, jobs, hall } = setup();
  const p = settlers.people[0];
  jobs.assign(p.id, 'hauler', hall.id);
  const a = jobs.assignments.get(p.id);
  a.carrying = { item: 'vegetables', count: 3 };
  let night = true;
  settlers.night = () => night;
  run(settlers, 60);
  ok('hauler asleep, not working', p.sleep?.state === 'asleep' && /Asleep/.test(a.status));
  ok('cargo kept through the night', a.carrying?.count === 3);
  night = false;
  run(settlers, 2);
  ok('hauler working again by day', !/Asleep|bed/.test(a.status));
}

console.log(f ? `${f} failed` : 'all ok');
process.exit(f ? 1 : 0);
