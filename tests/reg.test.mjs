import { World } from '../src/world/World.js';
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
let f=0; const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n); if(!c)f++;};
const WATER=11, FARMLAND=21;

const setup = () => {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  for (let x=4;x<8;x++) for (let z=4;z<8;z++) world.setBlock(x,10,z,FARMLAND);
  world.setBlock(10,10,6,WATER);
  const inventory = new Inventory();
  const reg = new StructureRegistry({ world, bus: null, inventory });
  return { world, inventory, reg };
};
const FARM = {minX:4,maxX:7,minY:10,maxY:11,minZ:4,maxZ:7};

// cost is charged, and refused when unaffordable
let { inventory, reg, world } = setup();
let r = reg.claim(FARM, 'farm');
ok('claim refused without seeds', !r.ok && /seeds/.test(r.reason));
inventory.add('seeds', 10);
r = reg.claim(FARM, 'farm');
ok('claim succeeds with seeds', r.ok);
ok('4 seeds were charged', inventory.countOf('seeds') === 6);
ok('registry holds it', reg.list().length === 1 && reg.countOf('farm') === 1);

// no double-claiming the same ground
r = reg.claim({minX:5,maxX:8,minY:10,maxY:11,minZ:5,maxZ:8}, 'farm');
ok('overlapping claim refused', !r.ok && /overlap/i.test(r.reason));

// production over time, paid in whole cycles only
const t0 = reg.list()[0].lastPaidAt;
ok('nothing owed immediately', Object.keys(reg.collect({ now: t0 + 1000 })).length === 0);
let got = reg.collect({ now: t0 + 75_000 });   // farm: every 75s
ok('one cycle pays out', got.vegetables === 3 && got.seeds === 2 && got.fruit === 1);
got = reg.collect({ now: t0 + 75_000 + 74_000 });
ok('a partial second cycle pays nothing', Object.keys(got).length === 0);
got = reg.collect({ now: t0 + 300_000 });
ok('the remaining three cycles pay together', got.vegetables === 9);

// offline accrual is capped so eight hours away isn't a windfall of a week
({ inventory, reg, world } = setup());
inventory.add('seeds', 10);
reg.claim(FARM, 'farm');
const t1 = reg.list()[0].lastPaidAt;
got = reg.collect({ now: t1 + 72 * 3600_000 });  // three days away
const capCycles = Math.floor((8 * 3600) / 75);
ok(`offline capped at 8h (${capCycles} cycles, not 3456)`, got.vegetables === capCycles * 3);

// breaking a building stops it, with a reason
({ inventory, reg, world } = setup());
inventory.add('seeds', 10);
reg.claim(FARM, 'farm');
const cleared = [];
for (let x=4;x<8;x++) for (let z=4;z<8;z++) { if (cleared.length>=13) continue; world.setBlock(x,10,z,0); cleared.push({x,y:10,z}); }
reg.revalidateAround(cleared);
ok('digging up the farm breaks it', reg.list()[0].valid === false);
ok('and it says why', /tilled|farmland/i.test(reg.list()[0].brokenReason));
ok('broken buildings produce nothing', Object.keys(reg.collect({ now: Date.now() + 600_000 })).length === 0);
ok('and stop counting', reg.countOf('farm') === 0);

// putting it back repairs it
for (const c of cleared) world.setBlock(c.x,10,c.z,FARMLAND);
reg.revalidateAround(cleared);
ok('restoring the blocks repairs it', reg.list()[0].valid === true);

// a full bag stops production instead of destroying it
({ inventory, reg, world } = setup());
inventory.add('seeds', 10);
reg.claim(FARM, 'farm');
for (let i = 0; i < 40; i++) inventory.add('dirt', 500);
const t2 = reg.list()[0].lastPaidAt;
got = reg.collect({ now: t2 + 75_000 });
ok('full bag does not silently eat output', !got.vegetables);

// save round trip re-checks against the world rather than trusting the file
({ inventory, reg, world } = setup());
inventory.add('seeds', 10);
reg.claim(FARM, 'farm');
const saved = JSON.parse(JSON.stringify(reg.toJSON()));
let n=0; for (let x=4;x<8;x++) for (let z=4;z<8;z++) { if (n++<13) world.setBlock(x,10,z,0); }
const reg2 = new StructureRegistry({ world, bus: null, inventory });
reg2.loadJSON(saved);
ok('load re-checks the blocks, not the save', reg2.list()[0].valid === false);

process.exit(f?1:0);
