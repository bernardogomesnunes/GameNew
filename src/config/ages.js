/**
 * The arc of the game, from thirty-two blocks of land to a finished thing.
 *
 * Each age says how much land you hold, what you have to raise before the
 * border moves out, and one line of why. The goals are the game: everything
 * else — which buildings exist, what you can make, what the border looks like —
 * hangs off the age you are in.
 *
 * Sizes stop at the width of the world. The map being the reward only works
 * while there is map left to give, and a Duilt world is generated at 256
 * because that is what fits in a browser's storage: a 512 world serialises to
 * 4.2MB, which does not reliably survive localStorage, let alone several saves
 * of it. So the land grows every single age and the last ring is the whole
 * world — and the last two ages ask for something other than more ground,
 * because by then there is none left to want.
 *
 * How to read one:
 *
 *   age     what the player is told they are in
 *   name    the ring's name, shown on the goal list and the border
 *   size    the claimed square, in blocks
 *   intro   one line when the age begins
 *   goals   what has to be true to move on — `structure` and `count`, or a
 *           `test` for anything that is not a building
 */

export const AGES = [
  {
    age: 1,
    name: 'Settlement',
    size: 32,
    intro: 'Thirty-two blocks, an axe and a bucket. Claim a forest, break ground on a farm, and build somewhere to sleep.',
    goals: [
      { structure: 'forest', count: 1, label: 'Plant and claim a forest' },
      { structure: 'farm', count: 1, label: 'Break ground on a farm' },
      { structure: 'house', count: 1, label: 'Build yourself a house' },
    ],
  },
  {
    age: 2,
    name: 'Industry',
    size: 64,
    intro: 'Wood only gets you so far. Open a quarry, and put a second roof up while you are at it.',
    goals: [
      { structure: 'quarry', count: 1, label: 'Open a quarry' },
      { structure: 'house', count: 2, label: 'Have two houses standing' },
    ],
  },
  {
    age: 3,
    name: 'Craft',
    size: 96,
    intro: 'Stone and fire. A workshop lets you make what your hands cannot, and a kiln turns earth and sand into brick and glass.',
    goals: [
      { structure: 'workshop', count: 1, label: 'Build a workshop' },
      { structure: 'kiln', count: 1, label: 'Fire up a kiln' },
    ],
  },
  {
    age: 4,
    name: 'Town',
    size: 128,
    intro: 'Enough buildings to be a place. Raise a market among them, and house the people who will use it.',
    goals: [
      { structure: 'market', count: 1, label: 'Raise a market' },
      { structure: 'house', count: 4, label: 'Have four houses standing' },
    ],
  },
  {
    age: 5,
    name: 'Domain',
    size: 192,
    intro: 'Everything easy is above ground. Drive a mine into the rock, and feed the town that lives off it.',
    goals: [
      { structure: 'mine', count: 1, label: 'Drive a mine underground' },
      { structure: 'granary', count: 1, label: 'Fill a granary' },
      { structure: 'house', count: 6, label: 'Have six houses standing' },
    ],
  },
  {
    age: 6,
    name: 'Frontier',
    size: 256,
    intro: 'The whole map is yours. One thing left: build something that outlasts you.',
    goals: [
      { structure: 'monument', count: 1, label: 'Raise a monument' },
    ],
    // Nothing comes after this one. Finishing it finishes the game.
    final: true,
  },
];

export const AGES_BY_NUMBER = new Map(AGES.map((a) => [a.age, a]));

export const FINAL_AGE = AGES[AGES.length - 1].age;

export function ageOf(n) {
  return AGES_BY_NUMBER.get(n) ?? AGES[0];
}

/** The land each age holds — what Territory draws and enforces. */
export const RINGS = AGES.map(({ age, size, name }) => ({ age, size, name }));
