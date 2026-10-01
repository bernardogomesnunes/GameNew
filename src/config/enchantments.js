/**
 * Enchanted armour and weapons (playtest, P6). Asked for directly:
 * "Special effects on armour that do simple stuff: speed on boots, extra
 * defence on chest plate and pants, and night vision on the helmet; and
 * special attacks on the sword, like thunder, fire and ice: paralysing,
 * burning and freezing."
 *
 * An enchantment is laid on a piece at the Temple — the piece, devotion and
 * one thing that suits it — and makes a new item: the same piece with its
 * enchantment's name in front. They turn up in the richer chests, too.
 */

export const ENCHANTMENTS = {
  swift: {
    name: 'Swift', slots: ['feet'], colour: '#7fd4ff', says: 'faster on your feet',
    devotion: 3, inputs: { coffee_beans: 3 },
  },
  warded: {
    name: 'Warded', slots: ['body', 'legs'], colour: '#b48cff', says: '+2 armour',
    devotion: 4, inputs: { iron_ingot: 2 }, armour: 2,
  },
  night: {
    name: 'Night Sight', slots: ['head'], colour: '#c6ff7a', says: 'see in the dark',
    devotion: 4, inputs: { fireflies: 3 },
  },
  thunder: {
    name: 'Thunder', weapon: true, element: 'thunder', colour: '#ffe066', says: 'stuns what it strikes',
    devotion: 5, inputs: { copper_ingot: 3 },
  },
  fire: {
    name: 'Fire', weapon: true, element: 'fire', colour: '#ff7a3a', says: 'sets what it strikes burning',
    devotion: 5, inputs: { lantern: 2 },
  },
  ice: {
    name: 'Ice', weapon: true, element: 'ice', colour: '#9fe6ff', says: 'freezes what it strikes',
    devotion: 5, inputs: { glass: 3 },
  },
};

/** The swords an element can be laid on. */
export const ENCHANTABLE_SWORDS = ['sword_stone', 'sword_iron'];

/** Swift boots: how much faster you move. */
export const SWIFT_SPEED = 1.2;
/** Thunder: seconds a struck enemy can't move or strike. */
export const STUN_SECONDS = 2;
/** Fire: seconds it burns, and what it takes each second. */
export const BURN_SECONDS = 4;
export const BURN_DAMAGE = 1;
/** Ice: seconds it's frozen, and how fast it moves and strikes meanwhile. */
export const FREEZE_SECONDS = 4;
export const FREEZE_SLOW = 0.3;

/** The id of `base` with enchantment `key` on it. */
export const enchantedId = (base, key) => `${base}_${key}`;
