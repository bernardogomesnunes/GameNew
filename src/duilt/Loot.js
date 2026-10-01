import { hash01 } from '../world/ChunkGen.js';

/**
 * What's in a chest you find (Phase 7c): one left on a deep cave floor, in
 * a bandit's tent, or in the hermit's hut. Decided with the user: the ring
 * ores are "found in chests or deep in the caves as a very rare material".
 *
 * Rolled from where the chest stands and the world's seed, the first time
 * it's opened (or broken) — so the same chest always holds the same things,
 * and there's nothing to gain by leaving and coming back.
 *
 * Each table entry: [item, chance, min, max]. `ring` is the chance of a
 * ring ore — Sunstone or Nightstone, whichever the roll says.
 */
export const LOOT = {
  cave: {
    name: 'An old chest',
    items: [['gold', 0.7, 2, 5], ['iron_ingot', 0.5, 1, 3], ['copper_ingot', 0.4, 1, 3], ['cooked_meat', 0.3, 1, 3], ['lantern', 0.25, 1, 1], ['coffee', 0.2, 1, 2]],
    ring: 0.3,
  },
  camp: {
    name: 'The bandits\' takings',
    items: [['gold', 0.85, 1, 4], ['cooked_meat', 0.6, 2, 4], ['iron_ingot', 0.35, 1, 2], ['wool', 0.3, 1, 3], ['sword_stone', 0.12, 1, 1], ['beer', 0.5, 1, 3], ['kombucha', 0.2, 1, 2]],
    ring: 0.12,
  },
  hermit: {
    name: 'The hermit\'s chest',
    items: [['fruit', 0.8, 2, 5], ['seeds', 0.7, 2, 4], ['egg', 0.3, 1, 3], ['lantern', 0.4, 1, 1], ['gold', 0.4, 1, 2], ['kombucha', 0.4, 1, 2], ['seeds_coffee', 0.5, 2, 4], ['coffee_beans', 0.4, 2, 5]],
    ring: 0.2,
  },
};

/** What a found chest of `kind` at (x, y, z) holds: { itemId: count }. */
export function lootFor(kind, x, y, z, seed = 0) {
  const table = LOOT[kind] ?? LOOT.cave;
  const roll = (salt) => hash01(x * 73 + y * 7, z * 31 - y, (seed ^ (0x10a7 + salt * 977)) >>> 0);
  const out = {};
  table.items.forEach(([id, chance, lo, hi], i) => {
    if (roll(i * 2) >= chance) return;
    out[id] = lo + Math.floor(roll(i * 2 + 1) * (hi - lo + 1));
  });
  if (roll(90) < table.ring) out[roll(91) < 0.5 ? 'sunstone' : 'nightstone'] = 1 + (roll(92) < 0.25 ? 1 : 0);
  return out;
}
