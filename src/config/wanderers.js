/**
 * The people who aren't yours: who they are, what they look like, and what
 * a messenger has to say.
 *
 * Most of them are scenery — no quests, nothing to trade. The bandits are
 * the exception (Phase 6b, chosen directly): from Age 2 on they come for you
 * if you walk up to their camp, and at night a few of them raid your
 * settlement for what's in your storehouses. Before that they just watch.
 * Point at any of them and they're named, the same way a settler is.
 */
export const WANDERERS = {
  // Anyone can be struck (asked for directly: "when pointing to a player,
  // break should beat them"). The ones who don't fight run from you, and
  // drop what they carry if you beat them.
  hermit: {
    noun: 'the hermit',
    about: 'the hermit — keeps to themself',
    colours: [0x8b8f84],
    speed: 1.1,
    roam: 5,
    hp: 10, flees: true, run: 3,
    drops: { fruit: [1, 3], seeds: [1, 2] },
  },
  // The Stone Kingdom's people (Phase 7e): guards at their posts, and the
  // King on his throne. Guards stand their ground — they never run — and
  // only fight the bearer of the White Ring, or anyone who strikes one.
  guard: {
    noun: 'a guard of the Stone Kingdom',
    about: 'a guard of the Stone Kingdom — keeping watch',
    aboutHostile: 'a guard of the Stone Kingdom — hit to fight',
    colours: [0x3f3c45, 0x35323a, 0x4a4552],
    speed: 1.3,
    roam: 2,
    hp: 20,
    hits: 3,
    reach: 1.8,
    every: 1.2,
    aggro: 14,
    run: 3.6,
    fleeBelow: -1,
    drops: { gold: [1, 3], iron_ingot: [0, 1] },
  },
  king: {
    about: 'the Stone King, on his throne — tap to speak',
    colours: [0x2a2430],
    speed: 0,
    roam: 0,
  },
  bandit: {
    noun: 'a bandit',
    about: 'a bandit — watching you from the camp',
    // Once they're dangerous (Phase 6b): from Age 2 on.
    aboutHostile: 'a bandit — hit to fight',
    colours: [0x6b3f3a, 0x4d4545, 0x7a5a3a, 0x5a4a5e],
    speed: 1.7,
    roam: 8,
    wary: 6, // keeps at least this far from you, while they're peaceful
    hp: 12,           // six hearts' worth
    hits: 2,          // half-hearts a blow
    reach: 1.7,       // how close they have to be to land one
    every: 1.3,       // seconds between blows
    aggro: 11,        // a camp bandit comes for you this close
    run: 3.4,         // chasing, and running away
    fleeBelow: 4,     // runs for it at or below this many hit points
    drops: { gold: [1, 2] },
  },
  explorer: {
    noun: 'an explorer',
    about: 'an explorer, passing through',
    colours: [0x6f8f5a, 0x8a7a55, 0x5f7f86],
    speed: 2.3,
    hp: 10, flees: true, run: 3.6,
    drops: { gold: [0, 1], cooked_meat: [0, 1] },
  },
  messenger: {
    noun: 'a messenger',
    about: 'a messenger, with news for your settlement',
    colours: [0x5a7fa8],
    speed: 2.8,
    hp: 8, flees: true, run: 4,
    drops: { gold: [0, 1] },
  },
};

export const WANDERER_NAMES = [
  'Aldric', 'Bryn', 'Cato', 'Dela', 'Edda', 'Fenn', 'Garrow', 'Hesk', 'Ines', 'Joss',
  'Kell', 'Lark', 'Maren', 'Nell', 'Orrin', 'Pim', 'Quill', 'Rook', 'Saba', 'Teg',
  'Ulla', 'Vesk', 'Wyn', 'Yara', 'Zed',
];

/**
 * What a messenger says when they reach your settlement. `{dir}` becomes the
 * compass direction of the place from your settlement, so the news is also a
 * way to find it.
 */
export const NEWS = {
  hermit: [
    'Somebody lives alone in a hut out to the {dir}. Doesn\'t come to market.',
    'There\'s smoke from a hermit\'s chimney to the {dir}, most mornings.',
  ],
  camp: [
    'Bandits have made camp to the {dir}. Keep your storehouses shut at night.',
    'Saw a campfire to the {dir} last night — not travellers. Keep your eyes open.',
  ],
  kingdom: [
    'Far to the {dir} there\'s a city of black stone behind high walls. The Stone King rules it.',
    'Soldiers in dark iron on the road from the {dir}. They say the Stone King is gathering an army.',
  ],
  ruin: [
    'There are old walls standing in the grass to the {dir}. Nobody remembers whose.',
    'A shepherd found a ruin to the {dir} — says there\'s a chest under the rubble.',
  ],
  ruined_temple: [
    'Pillars to the {dir}, marble, half of them fallen. A temple to something, once.',
    'They say there\'s an altar to the {dir} that still has gold on it.',
  ],
  mine: [
    'There\'s an old mine to the {dir}. The miners left in a hurry and never came back.',
    'Timber over a hole in the ground, to the {dir}. Ore still in the walls, they say.',
  ],
  monument: [
    'You can see a tall black stone from the hills to the {dir}. Gold at the top.',
    'Somebody raised a monument to the {dir}, long ago. Somebody left things at its foot.',
  ],
  // What the Stone King says to you, by the ring you bear (Phase 7e).
  king: {
    none: ['Who are you, to walk into my city unbidden? Go home, little builder.', 'Bear no ring and you are nothing to me. Come back when a god has looked at you.'],
    white: ['The White Ring. I know that light — my army will come for it, round after round.', 'You wear the sky\'s gold in my hall? Leave, while my guards let you.'],
    black: ['The Black Ring... so the dark god looked at you too. Swear to him in my temple and my warriors are yours.', 'Kneel at the altar of Nightstone, ring-bearer. Then we will talk of armies.'],
  },
  quiet: [
    'The roads are quiet. That\'s all the news there is.',
    'An explorer came through mapping the far country. Didn\'t stay.',
    'Good weather on the plains. Herds are fat this year.',
  ],
};
