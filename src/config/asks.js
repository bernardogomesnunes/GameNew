/**
 * VIL-2: what villagers ask for. Numbers only; the rules are in duilt/Asks.js.
 *
 * A villager asks for one thing now and then. Giving it raises mood by
 * `gift[kind]`. Ignoring it costs nothing: the ask lapses after `expireDays`
 * game days (900 s each, config/mood.js MOOD_DAY), and the next one comes
 * `gapDays` after the last one ended, given or lapsed.
 */
export const ASKS = {
  /** Game days an ask stays up: a random value in [lo, hi]. */
  expireDays: [2, 3],
  /** Game days from the end of one ask (or arrival) to the next: [lo, hi]. */
  gapDays: [1, 2],
  /** Mood points a gift is worth, by kind. */
  gift: { food: 8, drink: 10, mushroom: 12, tool: 12, weapon: 15 },
  /** What each kind draws from (item ids in config/items.js). */
  pool: {
    food: ['apple', 'cooked_meat', 'egg', 'milk', 'hunters_stew', 'mushroom_soup', 'mushroom_dumplings'],
    drink: ['beer', 'kombucha', 'coffee'],
    mushroom: ['mushroom_red', 'mushroom_lilac', 'mushroom_pale'],
    tool: ['axe', 'pickaxe', 'shovel', 'bucket'],
    weapon: ['sword_wood', 'sword_stone', 'sword_iron', 'bow'],
  },
};
