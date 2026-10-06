/**
 * Armour and the ring (Phase 7b, docs/plan-phase7-lore.md).
 *
 * Five things you wear, apart from the bag: head, body, legs, feet (the
 * boots came with the playtest list, P6), and one ring.
 * Armour takes some of every blow — a bandit's, a stone off a catapult —
 * though not a fall or lava, which no helmet helps with. Each point of it
 * is ARMOUR_PER_POINT off the hit, and each blow it takes wears it a
 * little, the same way a tool wears with use.
 *
 * The sets, in tiers (backlog batch 2: "stone, iron, gold, sky and dark …
 * and armour" — leather is armour's first tier, as stone is the tools'):
 *   leather  what anyone can make from hides, early on;
 *   iron     plate from the foundry, Age 4;
 *   gold     softer but better — Age 5, from the mine;
 *   sky      white steel and gold — and since you were born in the sky,
 *            it lets you walk among its people (the dark path, later);
 *   dark     blackened iron, as the Stone Kingdom wears it. Its key is
 *            still `stone`, from when it was called that, so old saves keep it.
 * Sky and dark are the best there is, and stay at Age 4 where the story
 * first needs them (the Sky Kingdom disguise).
 *
 * The ring slot is for the ring you forge at the top of the Temple (7c).
 */

export const WEAR_SLOTS = ['head', 'body', 'legs', 'feet', 'back', 'ring'];
export const SLOT_NAMES = { head: 'Head', body: 'Body', legs: 'Legs', feet: 'Feet', back: 'Back', ring: 'Ring' };

/**
 * Backpacks (backlog batch 3, #1: "Crafted, worn in the boots/ring row.
 * Adds bag slots: e.g. +10 leather, +20 reinforced"). Worn on your back,
 * between the boots and the ring; while it's on, the bag has `slots` more.
 * The reinforced one is the leather one with iron at the seams.
 */
export const BACKPACKS = [
  { id: 'backpack_leather', name: 'Leather Backpack', slots: 10, age: 1, inputs: { hide: 4, string: 2 },
    main: 0x9a6b45, trim: 0x6b4a30, madeBy: 'Hide and string, stitched at the bench' },
  { id: 'backpack_reinforced', name: 'Reinforced Backpack', slots: 20, age: 4, inputs: { backpack_leather: 1, iron_ingot: 2, hide: 2 },
    main: 0x7d5538, trim: 0xc9ced6, madeBy: 'A leather backpack with iron at the seams' },
];

/** How much each point of armour takes off a blow — a full sky or dark set (13 points) takes about half. */
export const ARMOUR_PER_POINT = 0.04;

/** What armour helps with: being hit, not falling or burning. */
export const HIT_CAUSES = new Set(['bandit', 'catapult', 'army', 'sky']);

export const ARMOUR_SETS = [
  {
    key: 'leather', name: 'Leather', age: 1, durability: 80,
    main: 0x9a6b45, trim: 0x6b4a30,
    pieces: {
      head: { name: 'Leather Cap', points: 1, inputs: { hide: 3 } },
      body: { name: 'Leather Tunic', points: 2, inputs: { hide: 5 } },
      legs: { name: 'Leather Leggings', points: 1, inputs: { hide: 4 } },
      feet: { name: 'Leather Boots', points: 1, inputs: { hide: 2 } },
    },
    madeBy: 'Stitched from hides',
  },
  {
    key: 'iron', name: 'Iron', age: 4, durability: 200,
    main: 0xc9ced6, trim: 0x8a8f96,
    pieces: {
      head: { name: 'Iron Helm', points: 2, inputs: { iron_ingot: 3 } },
      body: { name: 'Iron Cuirass', points: 3, inputs: { iron_ingot: 5 } },
      legs: { name: 'Iron Greaves', points: 2, inputs: { iron_ingot: 4 } },
      feet: { name: 'Iron Boots', points: 1, inputs: { iron_ingot: 2 } },
    },
    madeBy: 'Plate from your foundry',
  },
  {
    key: 'gold', name: 'Gold', age: 5, durability: 160,
    main: 0xf0cf62, trim: 0xb8862e,
    pieces: {
      head: { name: 'Gold Helm', points: 2, inputs: { gold: 3 } },
      body: { name: 'Gold Cuirass', points: 4, inputs: { gold: 5 } },
      legs: { name: 'Gold Greaves', points: 2, inputs: { gold: 4 } },
      feet: { name: 'Gold Boots', points: 1, inputs: { gold: 2 } },
    },
    madeBy: 'Beaten gold — it turns a blow better than iron, and wears faster',
  },
  {
    key: 'sky', name: 'Sky', age: 4, durability: 300,
    main: 0xe6ebf2, trim: 0xe2c26a,
    pieces: {
      head: { name: 'Sky Helm', points: 3, inputs: { iron_ingot: 2, gold: 1 } },
      body: { name: 'Sky Cuirass', points: 5, inputs: { iron_ingot: 4, gold: 2 } },
      legs: { name: 'Sky Greaves', points: 3, inputs: { iron_ingot: 3, gold: 1 } },
      feet: { name: 'Sky Boots', points: 2, inputs: { iron_ingot: 2, gold: 1 } },
    },
    madeBy: 'White steel and gold, as the Sky Kingdom wears it',
    disguise: 'sky',
  },
  {
    key: 'stone', name: 'Dark', age: 4, durability: 300,
    main: 0x3f3c45, trim: 0x9a2c2c,
    pieces: {
      head: { name: 'Dark Helm', points: 3, inputs: { iron_ingot: 2, dark_stone: 1 } },
      body: { name: 'Dark Cuirass', points: 5, inputs: { iron_ingot: 4, dark_stone: 2 } },
      legs: { name: 'Dark Greaves', points: 3, inputs: { iron_ingot: 3, dark_stone: 1 } },
      feet: { name: 'Dark Boots', points: 2, inputs: { iron_ingot: 2, dark_stone: 1 } },
    },
    madeBy: 'Blackened iron, as the Stone Kingdom wears it',
  },
];

/** Every piece, flat: { id, set, slot, name, points, inputs, durability, ... }. */
export const ARMOUR_PIECES = ARMOUR_SETS.flatMap((set) =>
  ['head', 'body', 'legs', 'feet'].map((slot) => ({
    id: `armour_${set.key}_${slot}`, set: set.key, slot, age: set.age, durability: set.durability,
    main: set.main, trim: set.trim, madeBy: set.madeBy, disguise: set.disguise, ...set.pieces[slot],
  })));

/** What a blow of `amount` half-hearts comes to through `points` of armour: never less than half a heart. */
export function throughArmour(amount, points) {
  if (amount <= 0 || points <= 0) return amount;
  return Math.max(1, Math.round(amount * (1 - ARMOUR_PER_POINT * points)));
}
