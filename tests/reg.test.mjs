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

// --- a claimed building is locked -------------------------------------------
//
// Break-and-hold makes it far too easy to take a wall out of your own house
// while clearing the ground beside it, and the first you would know is the
// structure reporting itself broken. So it is locked until you say otherwise.

{
  const { inventory: inv3, reg: reg3 } = setup();
  inv3.add('seeds', 10);
  const claimed = reg3.claim(FARM, 'farm');
  ok('a new claim starts locked', claimed.structure.locked === true);

  ok('a block inside it belongs to it', reg3.at(5, 10, 5)?.id === claimed.structure.id);
  ok('a block above it does not', reg3.at(5, 20, 5) === null);
  ok('a block beside it does not', reg3.at(20, 10, 20) === null);

  const inside = [{ x: 5, y: 10, z: 5, prev: FARMLAND, next: 0 }];
  const outside = [{ x: 20, y: 10, z: 20, prev: 0, next: FARMLAND }];
  ok('an edit inside it is blocked', reg3.blocking(inside)?.id === claimed.structure.id);
  ok('an edit elsewhere is not', reg3.blocking(outside) === null);
  ok('a batch is blocked if any part of it lands inside',
    reg3.blocking([...outside, ...inside])?.id === claimed.structure.id);

  reg3.setLocked(claimed.structure.id, false);
  ok('unlocked, the same edit goes through', reg3.blocking(inside) === null);
  reg3.setLocked(claimed.structure.id, true);
  ok('and locking it again stops it', reg3.blocking(inside)?.id === claimed.structure.id);

  // Releasing the claim hands the blocks back.
  reg3.remove(claimed.structure.id);
  ok('a released building guards nothing', reg3.blocking(inside) === null);
  ok('and is gone from the registry', reg3.list().length === 0);
}

// The lock survives a save, and a save written before locks existed is read as
// locked — someone claimed that building on purpose.
{
  const { inventory: inv4, reg: reg4, world: w4 } = setup();
  inv4.add('seeds', 10);
  const s4 = reg4.claim(FARM, 'farm').structure;
  reg4.setLocked(s4.id, false);
  const saved4 = JSON.parse(JSON.stringify(reg4.toJSON()));
  ok('the lock state is saved', saved4.structures[0].locked === false);

  const reload = new StructureRegistry({ world: w4, bus: null, inventory: inv4 });
  reload.loadJSON(saved4);
  ok('and comes back unlocked', reload.list()[0].locked === false);

  const old = { nextId: 2, structures: [{ id: 1, type: 'farm', region: FARM, valid: true, claimedAt: 1, lastPaidAt: 1 }] };
  const legacy = new StructureRegistry({ world: w4, bus: null, inventory: inv4 });
  legacy.loadJSON(old);
  ok('a save from before locks existed reads as locked', legacy.list()[0].locked === true);
}

// --- moving a building to a new spot ----------------------------------------
//
// "Release the claim" was a word about bookkeeping. What you want to do to
// something you put up is change it, move it, or get rid of it — and moving
// has to refuse the spots that would make it invalid before you commit, not
// after.

{
  const { inventory: inv5, reg: reg5, world: w5 } = setup();
  inv5.add('seeds', 10);
  const s5 = reg5.claim(FARM, 'farm').structure;

  // A second farm four blocks over, to collide with.
  const OTHER = { minX: 12, maxX: 15, minY: 10, maxY: 11, minZ: 12, maxZ: 15 };
  for (let x = 12; x <= 15; x++) for (let z = 12; z <= 15; z++) w5.setBlock(x, 10, z, FARMLAND);
  w5.setBlock(17, 10, 14, WATER);
  inv5.add('seeds', 10);
  const other = reg5.claim(OTHER, 'farm').structure;

  // overlaps() has to ignore the building being moved, or nothing could ever
  // be nudged one block sideways.
  ok('a region over its own old spot does not count as overlapping itself',
    !reg5.overlaps(FARM, s5.id));
  ok('but does when asked about a different building',
    reg5.overlaps(FARM, other.id));
  ok('and a spot on top of another building is refused',
    reg5.overlaps({ ...OTHER, minY: 10, maxY: 11 }, s5.id));

  const clear = { minX: 20, maxX: 23, minY: 10, maxY: 11, minZ: 20, maxZ: 23 };
  ok('an empty spot is free', !reg5.overlaps(clear, s5.id));

  // Moving is just a new region plus a re-check, so the building can stop
  // qualifying by being moved — away from its water, in a farm's case.
  s5.region = clear;
  reg5.recheck(s5);
  ok('a farm moved onto bare ground stops qualifying', s5.valid === false);
  // It names the first thing missing, which is the soil it left behind rather
  // than the water — the rules are checked in the order they are written.
  ok(`and says what is missing ("${s5.brokenReason}")`, /tilled soil/i.test(s5.brokenReason ?? ''));

  // Move it back onto the original tilled ground and it counts again.
  s5.region = FARM;
  reg5.recheck(s5);
  ok('moved back, it qualifies again', s5.valid === true);
  ok('and the break reason is cleared', s5.brokenReason === null);
}

process.exit(f?1:0);
