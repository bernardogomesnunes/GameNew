/**
 * Magic (WIZ-4): the points and level the player gets once the wizard arrives,
 * and the wizard's shop. Numbers are the lead's to tune; tests read them from here.
 */

/** LEVEL_POINTS[n] is the points needed for level n+1: level 1 at 0, level 10 at 900. */
export const LEVEL_POINTS = [0, 20, 60, 120, 200, 300, 420, 560, 720, 900];
export const MAX_MAGIC_LEVEL = LEVEL_POINTS.length;

/** Points from each source. Quests carry their own. */
export const POINTS = { cast: 1, target: 2 };

/** Wand bolt damage: base plus per Magic level above 1 (a fist does 1). */
export const WAND_BASE_DAMAGE = 3;
export const WAND_DAMAGE_PER_LEVEL = 1;
/** A potion lasts this fraction longer per Magic level above 1. */
export const POTION_TIME_PER_LEVEL = 0.05;

/**
 * What the wizard sells from the first visit: fruit seeds for coins.
 * The seeds come with the fruit work (FRUIT-3/4). Until those items exist,
 * Magic.offers() lists only the ones that do.
 */
export const SHOP = [
  { item: 'seeds_apple', price: 12 },
  { item: 'seeds_grape', price: 10 },
  { item: 'seeds_raspberry', price: 8 },
  { item: 'seeds_passion', price: 14 },
];

/** The coin item the game spends. */
export const COIN = 'coin';

/** The structure id of the hut, and the wizard's kind in WANDERERS. */
export const HUT = 'wizard_hut';
export const WIZARD_KIND = 'wizard';

/** Talk lines, one per visit in turn. */
export const WIZARD_TALK = [
  'The moss remembers every spell. Sit a while.',
  'A wand is only a stick that listens.',
  'Mushrooms first, mastery after.',
  'Mind the lantern. It burns what it likes.',
];
