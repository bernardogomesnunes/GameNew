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
 *
 * And a rare shelf (backlog batch 4, D2: "Traders stock the hard-to-get
 * items at a price, and their stock rotates"): `rare` is what each trader
 * can turn up with that nobody can make — [item, how many, price, from age]
 * — and goodsFor puts RARE_SHOWN of them out, a different pick every
 * RARE_EVERY game days. Nothing that decides the story: no Sky or Dark gear,
 * no ring ore.
 */

/** How often a trader's rare shelf changes, in game days; and how much is on it. */
export const RARE_EVERY = 2, RARE_SHOWN = 2;

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
    rare: [
      ['clay', 8, 4, 1], ['snow', 8, 3, 1], ['moss', 8, 3, 1], ['dark_moss', 8, 4, 2], ['silt', 8, 3, 1],
      ['coal', 8, 5, 3], ['sky_marble', 4, 9, 5], ['obsidian', 4, 12, 6],
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
    rare: [
      ['coal', 8, 5, 3], ['gold', 3, 8, 5], ['ruby', 1, 35, 8], ['diamond', 1, 50, 10],
      ['sword_diamond', 1, 120, 10], ['pickaxe_diamond', 1, 110, 10],
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
    rare: [
      ['fireflies', 2, 5, 3], ['obsidian', 2, 12, 6], ['firefly_lantern', 1, 7, 5], ['sky_marble', 4, 9, 5], ['gold', 3, 8, 5], ['dark_brick', 8, 6, 5],
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
    rare: [
      ['potato', 6, 3, 1], ['cabbage', 6, 3, 1], ['lettuce', 6, 3, 1], ['pepper', 6, 3, 2], ['zucchini', 6, 3, 2],
      ['broccoli', 6, 3, 2], ['coffee_beans', 6, 4, 3], ['raw_meat', 4, 2, 1],
    ],
  },
];

/**
 * The merchants of the living cities (world/cities.js): people, not goblins,
 * at stalls in the plaza — goods from far away a market at home doesn't
 * carry, at a price. Not one of a market's own (tradersFor).
 */
export const CITY_TRADERS = [
  {
    id: 'merchant',
    name: 'Ottavio',
    trade: 'Fine goods from far away',
    coat: 0x7a2f3a,
    cap: 0x3a1f25,
    goods: [
      ['marble', 8, 5], ['sky_marble', 4, 9], ['gold', 3, 7], ['gold_trim', 4, 6], ['amethyst', 2, 8],
      ['window', 4, 4], ['chandelier', 1, 6], ['painting', 1, 5], ['firefly_lantern', 2, 6],
      ['diamond', 1, 45], ['ruby', 1, 30], ['sword_gold', 1, 22], ['armour_gold_head', 1, 18], ['armour_gold_body', 1, 26], ['armour_gold_legs', 1, 22], ['armour_gold_feet', 1, 18],
    ],
  },
  {
    id: 'provisioner',
    name: 'Mabel',
    trade: 'Food, drink and seed',
    coat: 0x3f5a7a,
    cap: 0x2a3d55,
    goods: [
      ['cooked_meat', 4, 3], ['fruit', 6, 2], ['vegetables', 6, 2], ['egg', 6, 2], ['milk', 2, 3],
      ['beer', 2, 3], ['kombucha', 2, 3], ['coffee', 2, 3], ['wool', 4, 3],
      ['seeds_pepper', 3, 3], ['seeds_zucchini', 3, 3], ['seeds_broccoli', 3, 3], ['seeds_coffee', 3, 4], ['seeds_hemp', 4, 2],
    ],
  },
];

export const TRADERS_BY_ID = new Map([...TRADERS, ...CITY_TRADERS].map((t) => [t.id, t]));

/**
 * What a trader has out today: their own goods, then the rare shelf's pick
 * for `day` — each [item, n, price, rare]. The same day always gives the
 * same pick, and buying reads it the same way the stall draws it.
 */
export function goodsFor(trader, { day = 0, age = Infinity } = {}) {
  const goods = (trader?.goods ?? []).map(([id, n, price]) => [id, n, price, false]);
  const shelf = (trader?.rare ?? []).filter(([, , , from]) => (from ?? 1) <= age);
  if (!shelf.length) return goods;
  const window = Math.floor(Math.max(0, day) / RARE_EVERY);
  // A shuffle seeded by who they are and which window it is.
  let h = 2166136261;
  for (const c of `${trader.id}:${window}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const order = shelf.map((g, i) => {
    h = Math.imul(h ^ (i + 1), 2654435761) >>> 0;
    return { g, k: h };
  }).sort((a, b) => a.k - b.k).slice(0, RARE_SHOWN);
  return goods.concat(order.map(({ g: [id, n, price] }) => [id, n, price, true]));
}

/** Game days until a trader's rare shelf turns over. */
export function restockIn(day = 0) {
  return RARE_EVERY - (Math.max(0, Math.floor(day)) % RARE_EVERY);
}

/** Who lives in a market at a level (0 = as claimed): one more each level. */
export function tradersFor(tier = 0) {
  return TRADERS.slice(0, Math.min(TRADERS.length, (tier ?? 0) + 1));
}

/** A goblin's skin, and the cap they all wear. */
export const GOBLIN_SKIN = 0x8fb35a;
