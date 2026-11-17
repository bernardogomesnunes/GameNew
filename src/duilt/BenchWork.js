/**
 * CRAFT3D-2, 4, 5, 6 and 7 (owner, 15 November: "proceed with the rest of
 * the crafting"): every placed bench machine works the way the crucible
 * pours. Pick what to make, hold the machine's action until the gauge sits
 * in the window, let go. In the window one batch is made, by the same rules
 * as the bench panel (station, tools, age, room). Let go short and nothing
 * is spent; hold past the window and the batch is spoilt, its materials lost.
 */
export const WORK_MIN = 0.85, WORK_MAX = 1.05;

/** Each machine: its verb, how its tool moves, and how long a full stroke takes. */
export const BENCH_MACHINES = {
  wood_mill: { verb: 'Saw', tool: 'saw', seconds: 1.6 },
  planing_bench: { verb: 'Plane', tool: 'plane', seconds: 1.4 },
  joinery_bench: { verb: 'Join', tool: 'hammer', seconds: 1.4 },
  stone_mill: { verb: 'Grind', tool: 'wheel', seconds: 1.8 },
  bleach_bucket: { verb: 'Dip', tool: 'dip', seconds: 1.5 },
  forge: { verb: 'Hammer', tool: 'hammer', seconds: 1.6 },
  spinning_wheel: { verb: 'Spin', tool: 'wheel', seconds: 1.5 },
  // CRAFT-9 part 4: tapped, not held (chiselTap).
  masons_bench: { verb: 'Chisel', tool: 'chisel', taps: 3 },
};

/** Chalk marks on the stone at the Mason's Bench: one tap each, the last makes the batch. */
export const CHISEL_TAPS = 3;

/**
 * One stroke at `level` (1 is a full gauge) on `recipeId`.
 * `crafting` is the world's Crafting; `ctx` is { near, atStations, age }.
 */
export function benchStroke(crafting, recipeId, level, { near = null, atStations = [], age = Infinity } = {}) {
  const status = crafting.availableRecipe(recipeId, age, { near, atStations });
  if (!status) return { result: 'none', reason: 'That is not made here.' };
  if (!status.ok) return { result: 'none', reason: status.reason };
  if (level < WORK_MIN) return { result: 'short' };
  if (level > WORK_MAX) {
    crafting.inventory.spend(status.inputs);
    return { result: 'spoilt' };
  }
  const r = crafting.craft(recipeId, 1, { near, atStations });
  return r.ok ? { result: 'made', made: { id: status.output.id, count: status.output.count } } : { result: 'none', reason: r.reason };
}

/**
 * CRAFT-9 part 4: one chisel tap at the Mason's Bench. Three chalk marks
 * stand on the stone; `done` is how many were tapped before this one. The
 * third tap makes one batch by benchStroke's rules (station, tools, age,
 * room). A tap spends nothing until then, and nothing spoils.
 * Returns { result: 'tap', done } for a mark, or benchStroke's result.
 */
export function chiselTap(crafting, recipeId, done, { near = null, atStations = [], age = Infinity } = {}) {
  const status = crafting.availableRecipe(recipeId, age, { near, atStations });
  if (!status) return { result: 'none', reason: 'That is not made here.' };
  if (!status.ok) return { result: 'none', reason: status.reason };
  if (done + 1 < CHISEL_TAPS) return { result: 'tap', done: done + 1 };
  return benchStroke(crafting, recipeId, 1, { near, atStations, age });
}
