/**
 * VIL-4, VIL-5, VIL-6: villager levels, stats and defence. Numbers only; the
 * rules are in duilt/Levels.js.
 *
 * A villager has experience (xp), earned by working. Level follows from xp.
 * Two stats follow from level and from the buildings the village has:
 *
 *   strength      base + perLevel * (level - 1) + military buildings
 *   intelligence  base + perLevel * (level - 1) + the University
 *
 * Work speed and build speed come from intelligence. Health, punch damage and
 * weapon damage come from strength. Strength does not follow the Age (owner,
 * 27 November): only levels and military buildings raise it.
 */

export const LEVELS = {
  /** Highest level. */
  max: 10,
  /** Total xp needed to be each level: index 0 is level 1. */
  thresholds: [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500],
  /** Where xp comes from. */
  xp: {
    /** Per second on the job: 1 xp every 10 s at a staffed building, building or hauling. */
    perWorkSecond: 0.1,
    /** Per item a building makes while this villager works it. */
    perItem: 1,
    /** Per block this villager places as a builder. */
    perBlock: 0.5,
  },
  /** Stats of a level 1 villager in a village with no such buildings. */
  base: { strength: 10, intelligence: 10 },
  /** Added at each level after the first. */
  perLevel: { strength: 2, intelligence: 2 },
  /**
   * Speeds are 1 at base intelligence and rise by `perPoint` for each point
   * above it, to at most `max`. Work speed multiplies what a building makes
   * while they work it. Build speed divides the time a block takes.
   */
  speed: {
    work: { perPoint: 0.02, max: 3 },
    build: { perPoint: 0.03, max: 3.5 },
  },
};

/**
 * VIL-5: stat points the village's buildings add to every villager. One list
 * entry per tier (index = the building's tier, the last entry holds for any
 * higher tier). Only the best building of each type counts, so a second
 * barracks adds nothing: strength cannot be bought by building the same
 * thing again. Only valid (standing, not broken) buildings count.
 *
 * Ages here are the ones in config/structures.js: University 4, Garrison,
 * Barracks and Armoury 8, War Hall 9. Fully upgraded, the military buildings
 * give 14 + 14 + 10 + 16 = 54 strength.
 */
export const BUILDING_BONUS = {
  intelligence: {
    university: [10],
  },
  strength: {
    military: [6, 10, 14], // Garrison, Bastion, Citadel
    barracks: [6, 10, 14], // Barracks, Drill Hall, Fortress Barracks
    armoury: [10],
    war_hall: [16],
  },
};

/** VIL-6: how a villager fights when raiders come into reach. */
export const DEFENCE = {
  /** A villager goes for (or runs from) a raider this near. Blocks. */
  alarm: 16,
  /** Chase and flee speed, times a villager's walk speed. */
  runFactor: 1.6,
  /** Health: base + perStrength * (strength - 10). Strength 10 is today's 10. */
  hp: { base: 10, perStrength: 0.75 },
  /** Health regained per second, as a share of the maximum (today's 0.5 of 10). */
  healShare: 0.05,
  /** Below this share of maximum health an armed villager runs home. */
  fleeBelow: 0.25,
  /** Weapon damage = the item's `damage` * (base + strength * perStrength). */
  scale: { base: 0.75, perStrength: 0.025 },
  /** Bare hands: damage = base + perStrength * (strength - 10). */
  punch: { base: 1, perStrength: 0.05, reach: 1.6, every: 1.2 },
  /** A held sword (any `weapon` item that is not ranged). */
  melee: { reach: 1.8, every: 1.2 },
  /** A held bow: it has no damage of its own, and no arrows are used. */
  bow: { damage: 4, range: 14, every: 2.2 },
};
