/**
 * Building levels — a ladder a producer climbs by being built bigger, the
 * same mechanism a storehouse already grows its shelves with. The quarry is
 * the first building to use it: see config/structures.js's `tiers` on the
 * quarry, and isStore/hasLevels/producesAt/intervalAt just below the
 * registry, which are what tell a level ladder that changes storage apart
 * from one that changes production.
 *
 * What is checked here: that a quarry is a leveled building but not a store
 * (the thing isStore used to get wrong the moment a producer got tiers of
 * its own), that its rate and cadence actually change per level, that
 * building it bigger climbs the ladder the same way a storehouse does, and
 * that collect() pays out at whatever level it is actually standing at.
 */
import { Inventory } from '../src/items/Inventory.js';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import {
  STRUCTURES_BY_ID, hasLevels, isStore, producesAt, intervalAt,
} from '../src/config/structures.js';
import { tierStatus } from '../src/structures/validate.js';
import { World } from '../src/world/World.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const STONE = 3;
const QUARRY = STRUCTURES_BY_ID.get('quarry');
const HOUSE = STRUCTURES_BY_ID.get('house');

// --- telling a store apart from a producer, now that both have tiers --------

ok('a quarry has levels', hasLevels(QUARRY));
ok('but is not a store', !isStore(QUARRY));
ok('a storehouse has levels too', hasLevels(STRUCTURES_BY_ID.get('storehouse')));
ok('and is one', isStore(STRUCTURES_BY_ID.get('storehouse')));
ok('a house has neither — nothing to climb', !hasLevels(HOUSE) && !isStore(HOUSE));

// --- what each level actually produces ---------------------------------------

{
  ok('the quarry has more than one level', QUARRY.tiers.length >= 5);
  const first = producesAt(QUARRY, 0);
  ok(`level 1 makes a genuine trickle: ${JSON.stringify(first)}`,
    Object.values(first).reduce((a, b) => a + b, 0) * 86400 / intervalAt(QUARRY, 0) === 10);
  ok('a house, with no tiers, just falls back to its own produces either way',
    JSON.stringify(producesAt(HOUSE, 0)) === JSON.stringify(HOUSE.produces)
    && JSON.stringify(producesAt(HOUSE, 3)) === JSON.stringify(HOUSE.produces));
  ok('same fallback for the cadence', intervalAt(HOUSE, 0) === HOUSE.everySeconds
    && intervalAt(HOUSE, 3) === HOUSE.everySeconds);
  ok('a tier past the end of the ladder clamps to the last rung, not undefined',
    JSON.stringify(producesAt(QUARRY, 99)) === JSON.stringify(producesAt(QUARRY, QUARRY.tiers.length - 1)));
}

// --- climbing it by building it bigger, the same way a storehouse does ------

/** A solid stone cube on open ground, big enough that carving it out for
 *  every tier never drops the remaining stone below what the top level asks
 *  for — the region itself is the "rock" the quarry's rules count. */
function stoneBlock({ w = 10, d = 10, h = 6, x0 = 4, z0 = 4, y0 = 8 } = {}) {
  const world = new World({ sizeX: 48, sizeZ: 48, height: 32 });
  for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) for (let y = y0; y < y0 + h; y++) {
    world.setBlock(x, y, z, STONE);
  }
  const region = { minX: x0, maxX: x0 + w - 1, minZ: z0, maxZ: z0 + d - 1, minY: y0, maxY: y0 + h - 1 };
  let cleared = 0;
  const cells = [];
  for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) for (let y = y0; y < y0 + h; y++) {
    cells.push([x, y, z]);
  }
  // Cuts exactly up to `n` cells cleared in total, picking up where the last
  // call left off — climbing the ladder is carving further into the same
  // face, not starting a new one each time.
  return { world, region, cutTo: (n) => { while (cleared < n) world.setBlock(...cells[cleared++], 0); } };
}

{
  const { world, region, cutTo } = stoneBlock();
  cutTo(8); // the base claim's own "cut" threshold
  ok('freshly claimed, it is level 1', tierStatus(world, region, 'quarry').tier === 0);

  cutTo(16);
  ok('cut to the first rung\'s threshold, it is level 2', tierStatus(world, region, 'quarry').tier === 1);

  cutTo(64);
  const top = tierStatus(world, region, 'quarry');
  ok(`cut all the way back, it reaches the top level: ${top.name}`, top.tier === QUARRY.tiers.length - 1);
  ok('and there is nothing after it', top.next === null);
}

{
  // The rungs are a ladder, same as a storehouse's: a huge hole that skips
  // past the rock threshold for a middle rung still lands on the rung it
  // actually qualifies for in order.
  const { world, region, cutTo } = stoneBlock({ w: 6, d: 6, h: 4 }); // 144 cells total
  cutTo(64); // clears the cut requirement for every level...
  // ...but only 80 stone is left, short of level 4's 90 and level 5's 130.
  const status = tierStatus(world, region, 'quarry');
  ok(`short on rock for the top rungs, it stops at the one it can still afford: ${status.name}`,
    status.tier === 2);
}

// --- reaching a level is a button, losing one is still automatic -----------

/**
 * Reported directly: leveling used to happen the instant the blocks
 * qualified, with nothing to press and nothing on screen marking the
 * moment. recheck() (called after every edit) now only ever takes a level
 * away, the way it always could — see the next block — and StructureRegistry
 * .evolve is the only thing that moves a building up, one rung at a time
 * even when the blocks already qualify for several.
 */
{
  const { world, region, cutTo } = stoneBlock();
  cutTo(8);
  const inventory = new Inventory();
  const reg = new StructureRegistry({ world, bus: null, inventory });
  const quarry = {
    id: 1, type: 'quarry', region, valid: true, locked: true,
    claimedAt: Date.now(), lastPaidAt: Date.now(), brokenReason: null,
  };
  reg.structures.push(quarry);
  // Pushed in already built up, the way claim() retiers a fresh structure
  // `{ initial: true }` — the starting size, not a level reached.
  reg.retier(quarry, { initial: true });
  ok('claimed at level 1', quarry.tier === 0);
  ok('and retiering a producer does not go looking for a container',
    quarry.store === undefined);

  cutTo(28); // level 3's cut threshold — two rungs past where it stands
  reg.recheck(quarry);
  ok('built up, recheck alone leaves it right where it was',
    quarry.tier === 0);

  const first = reg.evolve(quarry.id);
  ok('evolving climbs exactly one rung', first.ok && quarry.tier === 1);
  const second = reg.evolve(quarry.id);
  ok(`evolving again reaches level ${quarry.tier + 1}, as far as it currently qualifies`,
    second.ok && quarry.tier === 2);
  const third = reg.evolve(quarry.id);
  ok("a third press has nothing further to give it yet", !third.ok && quarry.tier === 2);
}

// --- collect() pays out at whatever level it is actually standing at --------

{
  const { world, region, cutTo } = stoneBlock();
  cutTo(28); // level 3
  const inventory = new Inventory();
  const reg = new StructureRegistry({ world, bus: null, inventory });
  const now = Date.now();
  const quarry = {
    id: 1, type: 'quarry', region, valid: true, locked: true,
    claimedAt: now, lastPaidAt: now, brokenReason: null,
  };
  reg.structures.push(quarry);
  reg.retier(quarry, { initial: true });
  ok('it is standing at level 3 before anything is collected', quarry.tier === 2);

  const rate = producesAt(QUARRY, 2);
  const cycle = intervalAt(QUARRY, 2);
  // One whole cycle: level 3's cycle is long enough now (structures.js —
  // each level strictly better than the last) that two would run past the
  // 8-hour offline cap this same collect() enforces, which is a different
  // mechanism than the one this checks.
  quarry.lastPaidAt = now - cycle * 1000;
  const gained = reg.collect({ now });
  const expectedStone = rate.stone;
  ok(`a cycle at level 3 pays ${expectedStone} stone, not level 1's rate: ${JSON.stringify(gained)}`,
    gained.stone === expectedStone && (expectedStone !== producesAt(QUARRY, 0).stone || intervalAt(QUARRY, 0) !== cycle));
  ok('the clock only advances by whole cycles, same as any producer',
    quarry.lastPaidAt === now);
}

// --- and it survives being saved, like the storehouse's tier already does ---

{
  const { world, region, cutTo } = stoneBlock();
  cutTo(44); // level 4
  const reg = new StructureRegistry({ world, bus: null, inventory: new Inventory() });
  const quarry = {
    id: 1, type: 'quarry', region, valid: true, locked: true,
    claimedAt: Date.now(), lastPaidAt: Date.now(), brokenReason: null,
  };
  reg.structures.push(quarry);
  reg.retier(quarry, { initial: true });
  ok('reached level 4 before saving', quarry.tier === 3);

  const saved = JSON.parse(JSON.stringify(reg.toJSON()));
  const back = new StructureRegistry({ world, bus: null, inventory: new Inventory() });
  back.loadJSON(saved);
  const reopened = back.list().find((s) => s.type === 'quarry');
  ok('the level it was built up to is what comes back', reopened.tier === 3);
}

process.exit(f ? 1 : 0);
