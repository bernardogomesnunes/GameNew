import { readFileSync } from 'node:fs';
import { StructureRegistry } from '../src/structures/StructureRegistry.js';
import { Inventory } from '../src/items/Inventory.js';
import { World } from '../src/world/World.js';
import { GAME_DAY_SECONDS } from '../src/render/DayCycle.js';

/**
 * Played on: "The forest is not giving me the wood daily. After 3 days zero
 * wood in duilt mode". A game day is fifteen minutes; the forest paid every
 * six real hours, so three game days (45 minutes) paid nothing. A building's
 * day is the game's day now.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

ok(`a game day is fifteen real minutes (${GAME_DAY_SECONDS}s)`, GAME_DAY_SECONDS === 900);

const forestAfter = (seconds, opts = {}) => {
  const world = new World({ sizeX: 8, sizeZ: 8, height: 8 });
  const inventory = new Inventory();
  const reg = new StructureRegistry({ world, bus: null, inventory, ...opts });
  const t0 = 1_000_000_000_000;
  reg.structures.push({
    id: reg.nextId++, type: 'forest', region: { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 },
    valid: true, locked: true, claimedAt: t0, lastPaidAt: t0, brokenReason: null,
  });
  return { got: reg.collect({ now: t0 + seconds * 1000 }), reg, t0 };
};

const game = { dayLengthSeconds: GAME_DAY_SECONDS };
ok('a forest gives 20 wood in one game day', forestAfter(GAME_DAY_SECONDS, game).got.wood === 20);
{
  // Played through: the game collects every few seconds while you play.
  const { reg, t0 } = forestAfter(0, game);
  let wood = 0;
  for (let t = 5; t <= 3 * GAME_DAY_SECONDS; t += 5) wood += reg.collect({ now: t0 + t * 1000 }).wood ?? 0;
  ok(`and 60 over three played days (${wood})`, wood === 60);
}
ok('5 every quarter of a game day — nearly four minutes', forestAfter(GAME_DAY_SECONDS / 4, game).got.wood === 5 && !forestAfter(GAME_DAY_SECONDS / 4 - 1, game).got.wood);
{
  const { reg, t0 } = forestAfter(0, game);
  ok('the next payout is counted in game time too', reg.nextPayoutIn({ now: t0 }) === GAME_DAY_SECONDS / 4);
}
ok('away overnight pays two game days, not a mountain', forestAfter(8 * 3600, game).got.wood === 40);
ok('a registry left on real days still pays by real days', forestAfter(GAME_DAY_SECONDS).got.wood === undefined && forestAfter(6 * 3600).got.wood === 5);

const duilt = readFileSync(new URL('../src/duilt/DuiltGame.js', import.meta.url), 'utf8');
ok('Duilt runs its buildings on game days, at PRODUCTION_PACE', /new StructureRegistry\(\{ world, bus, inventory: this\.inventory, dayLengthSeconds: GAME_DAY_SECONDS \/ PRODUCTION_PACE \}\)/.test(duilt));

// Asked for directly: "Items are producing way too much now. Let's change this
// to 1st level like 3 to 4 items each max".
{
  const { STRUCTURES, producesAt, intervalAt, PRODUCTION_PACE } = await import('../src/config/structures.js');
  let most = 0, who = '';
  for (const spec of STRUCTURES) {
    const p = producesAt(spec, 0), e = intervalAt(spec, 0);
    if (!e) continue;
    for (const [id, n] of Object.entries(p)) {
      const perGameDay = n * PRODUCTION_PACE * 86400 / e;
      if (perGameDay > most) { most = perGameDay; who = `${spec.id} ${id}`; }
    }
  }
  ok(`at its first level no building makes more than 4 of anything a game day (most: ${who}, ${most})`, most <= 4 && most >= 3);
  const forest = forestAfter(GAME_DAY_SECONDS, { dayLengthSeconds: GAME_DAY_SECONDS / PRODUCTION_PACE }).got.wood ?? 0;
  const fiveDays = (() => { const { reg, t0 } = forestAfter(0, { dayLengthSeconds: GAME_DAY_SECONDS / PRODUCTION_PACE }); let w = 0; for (let t = 5; t <= 5 * GAME_DAY_SECONDS; t += 5) w += reg.collect({ now: t0 + t * 1000 }).wood ?? 0; return w; })();
  ok(`a forest makes 4 wood a game day at that pace (${fiveDays} over five days)`, fiveDays === 20 && forest <= 5);
}

process.exit(f ? 1 : 0);
