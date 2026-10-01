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
  // Places to find (playtest, P4): "all with a chest with goodies: armour,
  // weapons, food, and a super rare ring-crafting item."
  // The Stone Kingdom (Phase 7e): its armoury and market stalls.
  kingdom: {
    name: 'A chest of the Stone Kingdom',
    items: [['iron_ingot', 0.7, 2, 5], ['dark_stone', 0.6, 4, 10], ['gold', 0.6, 2, 6], ['sword_iron', 0.25, 1, 1],
      ['armour_stone_head', 0.2, 1, 1], ['armour_stone_body', 0.15, 1, 1], ['armour_stone_legs', 0.15, 1, 1], ['armour_stone_feet', 0.2, 1, 1],
      ['beer', 0.4, 1, 3], ['cooked_meat', 0.5, 1, 3]],
    ring: 0.06,
  },
  ruin: {
    name: 'A chest in the rubble',
    items: [['cooked_meat', 0.6, 1, 3], ['fruit', 0.5, 2, 4], ['sword_stone', 0.3, 1, 1], ['armour_leather_head', 0.2, 1, 1],
      ['armour_leather_body', 0.15, 1, 1], ['beer', 0.35, 1, 2], ['gold', 0.5, 1, 3]],
    ring: 0.05,
  },
  ruined_temple: {
    name: 'An offering, long forgotten',
    items: [['gold', 0.8, 3, 7], ['holy_water', 0.5, 1, 2], ['devotion', 0.5, 2, 5], ['sword_iron', 0.2, 1, 1],
      ['armour_sky_head', 0.15, 1, 1], ['armour_sky_legs', 0.12, 1, 1], ['kombucha', 0.35, 1, 2],
      ['armour_sky_head_night', 0.05, 1, 1], ['sword_iron_thunder', 0.04, 1, 1]],
    ring: 0.1,
  },
  mine: {
    name: 'The miners\' chest',
    items: [['iron_ingot', 0.7, 2, 4], ['copper_ingot', 0.6, 2, 4], ['gold', 0.5, 1, 4], ['coffee', 0.5, 1, 3],
      ['armour_stone_head', 0.2, 1, 1], ['armour_stone_legs', 0.15, 1, 1], ['cooked_meat', 0.4, 1, 2],
      ['armour_leather_feet', 0.25, 1, 1], ['armour_stone_body_warded', 0.04, 1, 1]],
    ring: 0.08,
  },
  monument: {
    name: 'What was left at the monument',
    items: [['gold', 0.9, 4, 9], ['sword_iron', 0.3, 1, 1], ['armour_stone_body', 0.2, 1, 1], ['armour_sky_body', 0.15, 1, 1],
      ['kombucha', 0.3, 1, 2], ['beer', 0.3, 1, 2], ['fruit', 0.4, 2, 4],
      ['armour_stone_feet_swift', 0.06, 1, 1], ['sword_iron_fire', 0.04, 1, 1], ['sword_stone_ice', 0.05, 1, 1]],
    ring: 0.12,
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
