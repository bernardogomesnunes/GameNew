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
 *   intro   one line when the age begins — short enough for a phone's
 *           toast (about 140 characters), and kept in the Goals list; introDark instead, for an age
 *           that begins differently on the dark path (ageIntro)
 *   goals   what has to be true to move on — `structure` and `count`, or a
 *           `test` for anything that is not a building
 */

export const AGES = [
  {
    age: 1,
    name: 'Exile',
    size: 32,
    intro: 'Thrown down from the sky with nothing. Claim a forest, break ground on a farm, and build somewhere to sleep.',
    goals: [
      { structure: 'forest', count: 1, label: 'Plant and claim a forest' },
      { structure: 'farm', count: 1, label: 'Break ground on a farm' },
      { structure: 'house', count: 1, label: 'Build yourself a house' },
    ],
  },
  {
    age: 2,
    name: 'Roots',
    size: 64,
    intro: 'There is no climbing back. Put roots down: open a quarry, raise a storehouse, and a second house — someone is coming.',
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
    name: 'Forge',
    size: 128,
    intro: 'Stone and fire: a workshop for what your hands cannot make, a kiln for brick and glass. Deep down, Sunstone and Nightstone wait.',
    goals: [
      { structure: 'workshop', count: 1, label: 'Build a workshop' },
      { structure: 'kiln', count: 1, label: 'Fire up a kiln' },
    ],
  },
  {
    age: 4,
    name: 'Hearth',
    size: 192,
    intro: 'Enough people to be a place. Raise a market, a townhouse and a tavern, and hear travellers\' news of the two kingdoms.',
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
    name: 'Bastion',
    size: 256,
    intro: 'The Stone Kingdom has heard of you. Drive a mine, fill a granary, raise a garrison — and at your Temple\'s height, choose your god.',
    goals: [
      { structure: 'mine', count: 1, label: 'Drive a mine underground' },
      { structure: 'granary', count: 1, label: 'Fill a granary' },
      { structure: 'house', count: 6, label: 'Have six houses standing' },
      { structure: 'military', count: 1, label: 'Raise a garrison' },
    ],
  },
  {
    age: 6,
    name: 'Reckoning',
    size: 320,
    open: true,
    intro: 'The wall is down, and the Stone Kingdom is coming. Hold your land through ten rounds, then raise a village and a monument.',
    // Sworn to the dark god, there's no war coming: the reckoning is the Sky Kingdom's.
    introDark: 'The wall is down. The Stone King calls you his own, and the Sky Kingdom doesn\'t know you\'re coming. Raise a village — and take back the sky.',
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

/** The line an age begins with, for the ring you bear. */
export function ageIntro(n, ring = null) {
  const a = ageOf(n);
  return (ring === 'black' && a?.introDark) || a?.intro;
}

/** The land each age holds — what Territory draws and enforces. */
export const RINGS = AGES.map(({ age, size, name, open = false }) => ({ age, size, name, open }));
