/**
 * Armour and the ring (Phase 7b, docs/plan-phase7-lore.md).
 *
 * Four things you wear, apart from the bag: head, body, legs, and one ring.
 * Armour takes some of every blow — a bandit's, a stone off a catapult —
 * though not a fall or lava, which no helmet helps with. Each point of it
 * is ARMOUR_PER_POINT off the hit, and each blow it takes wears it a
 * little, the same way a tool wears with use.
 *
 * Three sets, one for each side of the story:
 *   leather  what anyone can make from hides, early on;
 *   sky      white steel and gold — and since you were born in the sky,
 *            it lets you walk among its people (the dark path, later);
 *   stone    blackened iron, as the Stone Kingdom wears it.
 *
 * The ring slot is for the ring you forge at the top of the Temple (7c).
 */

export const WEAR_SLOTS = ['head', 'body', 'legs', 'ring'];
export const SLOT_NAMES = { head: 'Head', body: 'Body', legs: 'Legs', ring: 'Ring' };

/** How much each point of armour takes off a blow — nine points, a full metal set, is just over a third. */
export const ARMOUR_PER_POINT = 0.04;

/** What armour helps with: being hit, not falling or burning. */
export const HIT_CAUSES = new Set(['bandit', 'catapult']);

export const ARMOUR_SETS = [
  {
    key: 'leather', name: 'Leather', age: 1, durability: 80,
    main: 0x9a6b45, trim: 0x6b4a30,
    pieces: {
      head: { name: 'Leather Cap', points: 1, inputs: { hide: 3 } },
      body: { name: 'Leather Tunic', points: 2, inputs: { hide: 5 } },
      legs: { name: 'Leather Leggings', points: 1, inputs: { hide: 4 } },
    },
    madeBy: 'Stitched from hides',
  },
  {
    key: 'sky', name: 'Sky', age: 4, durability: 240,
    main: 0xe6ebf2, trim: 0xe2c26a,
    pieces: {
      head: { name: 'Sky Helm', points: 2, inputs: { iron_ingot: 2, gold: 1 } },
      body: { name: 'Sky Cuirass', points: 4, inputs: { iron_ingot: 4, gold: 2 } },
      legs: { name: 'Sky Greaves', points: 3, inputs: { iron_ingot: 3, gold: 1 } },
    },
    madeBy: 'White steel and gold, as the Sky Kingdom wears it',
    disguise: 'sky',
  },
  {
    key: 'stone', name: 'Stone', age: 4, durability: 240,
    main: 0x3f3c45, trim: 0x9a2c2c,
    pieces: {
      head: { name: 'Stone Helm', points: 2, inputs: { iron_ingot: 2, dark_stone: 1 } },
      body: { name: 'Stone Cuirass', points: 4, inputs: { iron_ingot: 4, dark_stone: 2 } },
      legs: { name: 'Stone Greaves', points: 3, inputs: { iron_ingot: 3, dark_stone: 1 } },
    },
    madeBy: 'Blackened iron, as the Stone Kingdom wears it',
  },
];

/** Every piece, flat: { id, set, slot, name, points, inputs, durability, ... }. */
export const ARMOUR_PIECES = ARMOUR_SETS.flatMap((set) =>
  ['head', 'body', 'legs'].map((slot) => ({
    id: `armour_${set.key}_${slot}`, set: set.key, slot, age: set.age, durability: set.durability,
    main: set.main, trim: set.trim, madeBy: set.madeBy, disguise: set.disguise, ...set.pieces[slot],
  })));

/** What a blow of `amount` half-hearts comes to through `points` of armour: never less than half a heart. */
export function throughArmour(amount, points) {
  if (amount <= 0 || points <= 0) return amount;
  return Math.max(1, Math.round(amount * (1 - ARMOUR_PER_POINT * points)));
}
