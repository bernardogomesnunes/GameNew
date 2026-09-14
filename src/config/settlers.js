/**
 * The people who move in once there is somewhere for them to sleep.
 *
 * Houses have granted capacity since Age 1 and nothing ever read it; the
 * Politics skill has promised "room to govern N more settlers" with no settlers
 * to govern. This is that promise, given a body: somebody arrives, moves into
 * an empty house, walks to a building every morning, and makes it produce more
 * than it would have on its own.
 *
 * One roof, one household, and the first house is your own — so the second
 * house is what brings the first person. Lose somebody and the next one turns
 * up to take the empty house.
 *
 * They are deliberately not a management screen. You do not assign them, feed
 * them individually or watch a needs bar — they find their own work, and the
 * only lever you have is the one you already had: build more, and build it in
 * reach of where they live.
 */

export const SETTLERS = {
  /**
   * How long before the next household turns up.
   *
   * Short, because the rule is now simply one per house past the first: you
   * put a roof up, somebody should come and live under it while you are still
   * standing there looking at it.
   */
  arriveEverySeconds: 8,

  /**
   * A settler will not walk further than this to work.
   *
   * This is the whole reason where you put a building matters. A quarry on the
   * far side of your land is a quarry nobody staffs.
   */
  workRange: 40,

  /** What a staffed building produces, against the same building empty. */
  workBonus: 0.5,

  /** Blocks per second on foot. A settler is not in a hurry. */
  walkSpeed: 1.9,

  /** Seconds spent standing at each end before turning round. */
  restSeconds: [4, 11],

  /**
   * A settlement eats, and what it eats is what your farms grew.
   *
   * Every meal, one food each out of the bag — the cheapest first, so the
   * fruit goes before the vegetables you were saving. Anyone who gets nothing
   * spends the day looking for something to eat instead of going to work, so
   * an empty larder costs you production rather than lives.
   *
   * Deliberately not a gate on who moves in: houses decide that, and food
   * deciding it as well made "why is nobody coming" a question with two
   * answers. Nobody starves and nobody leaves — they just stop working, and
   * you can see it in what your buildings hand over.
   */
  eatEverySeconds: 90,

  /** How much one settler puts away per meal. */
  foodPerMeal: 1,

  /** Height and width in blocks, for the figure that gets drawn. */
  build: { height: 1.8, width: 0.55 },
};

/**
 * Names, so they read as people rather than units.
 *
 * Short, plain and from no particular place — a settler called "Villager 3" is
 * a counter with legs.
 */
export const SETTLER_NAMES = [
  'Ana', 'Bram', 'Cira', 'Dov', 'Esk', 'Fen', 'Gali', 'Haz', 'Ilse', 'Joss',
  'Kew', 'Lior', 'Mira', 'Nils', 'Oona', 'Pell', 'Quin', 'Rask', 'Sena', 'Torr',
  'Ubi', 'Vand', 'Wren', 'Xia', 'Yarn', 'Zell', 'Aro', 'Bree', 'Corm', 'Dela',
];

/** Coats, so a crowd is a crowd and not one person copied. */
export const SETTLER_COLOURS = [
  0xc25b52, 0x4f7fbf, 0x6fa85a, 0xc9963f, 0x8a6bb5, 0x3f9d91, 0xb5657f, 0x7b8794,
];

export function settlerName(n) {
  const base = SETTLER_NAMES[n % SETTLER_NAMES.length];
  const round = Math.floor(n / SETTLER_NAMES.length);
  return round === 0 ? base : `${base} ${'II III IV V VI'.split(' ')[round - 1] ?? round + 1}`;
}

export function settlerColour(n) {
  return SETTLER_COLOURS[n % SETTLER_COLOURS.length];
}
