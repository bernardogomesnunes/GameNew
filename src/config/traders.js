/**
 * The market's traders. Asked for directly: "a new mob ... The trader, and
 * this guy which is a goblin looking creature, sells all the blocks. But
 * here's the thing, each trader only sell a selective set of blocks. Like
 * rocks, wood and food, or weapons armour and ores. And to start the market
 * only has one trader, but evolving it will lead to have more. As residents
 * of the city of course."
 *
 * So a market keeps one trader for each of its levels (see tradersFor): the
 * first one is there the day it is claimed, and each Evolve brings the next
 * to live in it. They take coins (items.js `coin` — struck at a foundry, or
 * found in chests) and nothing else.
 *
 * Each of `goods` is [item, how many you get, price in coins].
 */

export const TRADERS = [
  {
    id: 'stonemonger',
    name: 'Grub',
    trade: 'Rocks, wood and food',
    coat: 0x8a6a44,
    cap: 0x5a4a32,
    goods: [
      ['stone', 16, 2], ['cobblestone', 16, 2], ['stone_white', 8, 3], ['stone_turquoise', 8, 5], ['stone_orange', 8, 6],
      ['marble', 8, 6], ['wood', 16, 2], ['planks', 32, 2], ['white_wood', 8, 3], ['dark_wood', 8, 3],
      ['fruit', 6, 2], ['vegetables', 6, 2], ['cooked_meat', 4, 3], ['coffee', 2, 3],
    ],
  },
  {
    id: 'smith',
    name: 'Snikkit',
    trade: 'Weapons, armour and ores',
    coat: 0x4a4e57,
    cap: 0x2c2f35,
    goods: [
      ['iron_ore', 4, 4], ['copper_ore', 4, 3], ['gold_ore', 3, 8], ['iron_ingot', 2, 6],
      ['sword_stone', 1, 4], ['sword_iron', 1, 14], ['axe_iron', 1, 10], ['pickaxe_iron', 1, 12],
      ['bow', 1, 8], ['arrow', 8, 3],
      ['armour_leather_head', 1, 4], ['armour_leather_body', 1, 6], ['armour_leather_legs', 1, 5], ['armour_leather_feet', 1, 4],
      ['armour_iron_head', 1, 12], ['armour_iron_body', 1, 18], ['armour_iron_legs', 1, 15], ['armour_iron_feet', 1, 12],
    ],
  },
  {
    id: 'glazier',
    name: 'Mottle',
    trade: 'Glass, brick and finery',
    coat: 0x6d4a7a,
    cap: 0x4a2f55,
    goods: [
      ['glass', 8, 3], ['glass_red', 4, 3], ['glass_blue', 4, 3], ['window', 4, 4], ['brick', 16, 3],
      ['gold_trim', 4, 6], ['lantern', 2, 4], ['chandelier', 1, 6], ['vase', 1, 3], ['urn', 1, 4],
      ['rug_red', 2, 3], ['rug_blue', 2, 3], ['rug_green', 2, 3], ['painting', 1, 5], ['amethyst', 2, 8],
    ],
  },
  {
    id: 'seedwife',
    name: 'Bramble',
    trade: 'Seeds, eggs and wool',
    coat: 0x5f7a3e,
    cap: 0x3f5428,
    goods: [
      ['seeds_carrot', 4, 2], ['seeds_potato', 4, 2], ['seeds_cabbage', 4, 2], ['seeds_lettuce', 4, 2],
      ['seeds_pepper', 3, 3], ['seeds_zucchini', 3, 3], ['seeds_broccoli', 3, 3], ['seeds_coffee', 3, 4],
      ['sapling', 2, 3], ['egg', 4, 2], ['milk', 2, 3], ['wool', 4, 3], ['feather', 4, 2], ['hide', 2, 3],
      ['seeds_hemp', 4, 2], ['hemp_fibre', 6, 2], ['string', 4, 3],
    ],
  },
];

export const TRADERS_BY_ID = new Map(TRADERS.map((t) => [t.id, t]));

/** Who lives in a market at a level (0 = as claimed): one more each level. */
export function tradersFor(tier = 0) {
  return TRADERS.slice(0, Math.min(TRADERS.length, (tier ?? 0) + 1));
}

/** A goblin's skin, and the cap they all wear. */
export const GOBLIN_SKIN = 0x8fb35a;
