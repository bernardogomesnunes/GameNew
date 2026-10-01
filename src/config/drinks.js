/**
 * Drinks that make you better for a while (playtest, P5). Asked for
 * directly: "Stats improvement items, found here too and craftable: beer,
 * kombucha and coffee. Beer gives you energy and lets you throw more hits per
 * second; kombucha gives you 2 more points when hitting; coffee gives you
 * speed."
 *
 * Each drink gives one boost for a few minutes. One of each can be going at
 * once — drinking another of the same only tops its time back up — so all
 * three together is as strong as it gets.
 */

/** Seconds a boost lasts once drunk. */
export const BOOST_SECONDS = 180;

export const BOOSTS = {
  haste: { drink: 'beer', name: 'Beer', says: 'Quicker blows', color: '#e0a83a' },
  strength: { drink: 'kombucha', name: 'Kombucha', says: '+2 on every hit', color: '#d0705a' },
  speed: { drink: 'coffee', name: 'Coffee', says: 'Faster on your feet', color: '#8a5a3a' },
};

/** Beer: how long between blows, as a fraction of the usual. */
export const BEER_COOLDOWN = 0.55;
/** Kombucha: added to every blow. */
export const KOMBUCHA_DAMAGE = 2;
/** Coffee: how much faster you move. */
export const COFFEE_SPEED = 1.3;

/** "2:45" for a number of seconds. */
export function clockOf(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
