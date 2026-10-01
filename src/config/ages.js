/**
 * The arc of the game, from thirty-two blocks of land to a finished thing.
 *
 * Each age says how much land you hold, what you have to raise before the
 * border moves out, and one line of why. The goals are the game: everything
 * else — which buildings exist, what you can make, what the border looks like —
 * hangs off the age you are in.
 *
 * The land is a wall, not a suggestion: until the last age you can't walk
 * past your border, only grow it. That's the game — a place to make your
 * own, and an edge for an army to come over (asked for directly: "the main
 * goal of the game is to be locked in an area, or else it would be hard
 * for the army to appear"). So it grows every age, a little past the old
 * 256, and reaching the last ring does two things at once: the wall comes
 * down, so the world past it is yours to walk, and the Stone Kingdom
 * declares war on you (config/war.js) — whatever ring you bear.
 *
 * How to read one:
 *
 *   age     what the player is told they are in
 *   name    the ring's name, shown on the goal list and the border
 *   size    the claimed square, in blocks
 *   open    the border no longer stops you walking (it still bounds what
 *           you can build)
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
    intro: 'Wood only gets you so far. Open a quarry, raise somewhere to put things, and put a second roof up while you are at it.',
    goals: [
      { structure: 'quarry', count: 1, label: 'Open a quarry' },
      // Age 2 is where forty slots stop being enough — a quarry alone fills
      // them. Asking for the shed here is the age teaching the lesson at the
      // moment you are learning it anyway.
      { structure: 'storehouse', count: 1, label: 'Raise a storehouse — your bag is not big enough' },
      // Named for what it does rather than what it counts: the first house is
      // yours, so this is the one that puts a person in the world, and a goal
      // that only says "two houses" leaves that a surprise.
      { structure: 'house', count: 2, label: 'Build a second house — somebody moves in' },
    ],
  },
  {
    age: 3,
    name: 'Craft',
    size: 128,
    intro: 'Stone and fire. A workshop lets you make what your hands cannot, and a kiln turns earth and sand into brick and glass.',
    goals: [
      { structure: 'workshop', count: 1, label: 'Build a workshop' },
      { structure: 'kiln', count: 1, label: 'Fire up a kiln' },
    ],
  },
  {
    age: 4,
    name: 'Town',
    size: 192,
    intro: 'Enough buildings to be a place. Raise a market among them, house the people who will use it, and give them somewhere to gather.',
    goals: [
      { structure: 'market', count: 1, label: 'Raise a market' },
      { structure: 'house', count: 4, label: 'Have four houses standing' },
      { structure: 'townhouse', count: 1, label: 'Raise a townhouse — three households under one roof' },
      { structure: 'tavern', count: 1, label: 'Raise a tavern' },
      { structure: 'foundry', count: 1, label: 'Raise a foundry' },
    ],
  },
  {
    age: 5,
    name: 'Domain',
    size: 256,
    intro: 'Everything easy is above ground. Drive a mine into the rock, feed the town that lives off it, and give it walls that could hold if they ever had to.',
    goals: [
      { structure: 'mine', count: 1, label: 'Drive a mine underground' },
      { structure: 'granary', count: 1, label: 'Fill a granary' },
      { structure: 'house', count: 6, label: 'Have six houses standing' },
      { structure: 'military', count: 1, label: 'Raise a garrison' },
    ],
  },
  {
    age: 6,
    name: 'Frontier',
    size: 320,
    open: true,
    intro: 'Your border is open and the world past it is yours to walk — but the Stone Kingdom has seen you grow, and it is coming. Hold your land through ten rounds, raise a village to hold it, then build something that outlasts you.',
    goals: [
      { structure: 'village', count: 1, label: 'Raise a village' },
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
export const RINGS = AGES.map(({ age, size, name, open = false }) => ({ age, size, name, open }));
