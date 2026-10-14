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
    about: 'the hermit — keeps to themself, but will talk: tap to speak',
    colours: [0x8b8f84],
    speed: 1.1,
    roam: 5,
    hp: 10, flees: true, run: 3,
    drops: { fruit: [1, 3], seeds_lettuce: [1, 2] },
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
  // The Sky Kingdom's people (the dark path — world/skyKingdom.js): white
  // and gold, on the floating island. They fight the bearer of the Black
  // Ring on sight; nobody else ever sees them.
  sky_guard: {
    noun: 'a guard of the Sky Kingdom', sky: true,
    about: 'a guard of the Sky Kingdom — keeping watch over the island',
    aboutHostile: 'a guard of the Sky Kingdom — hit to fight',
    colours: [0xeef0f5, 0xe4e8f0, 0xf4efe2],
    helm: 0xd9b24a,
    speed: 1.3,
    roam: 2,
    hp: 22,
    hits: 3,
    reach: 1.8,
    every: 1.1,
    aggro: 14,
    run: 3.6,
    fleeBelow: -1,
    drops: { gold: [2, 4], sky_marble: [0, 2] },
  },
  // Two at the King's side always, while he lives (asked for directly):
  // tougher than the island's guards, and they don't leave the throne room.
  royal_guard: {
    noun: 'a royal guard of the Sky King', sky: true,
    about: 'a royal guard, at the Sky King\'s side',
    aboutHostile: 'a royal guard — they never leave the King\'s side',
    colours: [0xf6f1df],
    helm: 0xe8c04f,
    speed: 1.3,
    roam: 1,
    // Tuned against a simulated fight: the best sword, full armour and the
    // Black Ring should usually win alone, if not by much; less needs your
    // army, or cleverer fighting.
    hp: 28,
    hits: 3,
    reach: 1.9,
    every: 1.3,
    aggro: 11,
    leash: 9,
    run: 3.4,
    fleeBelow: -1,
    drops: { gold: [3, 6] },
  },
  sky_king: {
    noun: 'the Sky King', sky: true,
    about: 'the Sky King, on his golden throne',
    aboutHostile: 'the Sky King — bring him down and the Sky Kingdom falls',
    colours: [0xf7f3e6],
    helm: 0xe8c04f,
    speed: 1.2,
    roam: 0,
    hp: 70,
    hits: 4,
    reach: 2,
    every: 1.4,
    aggro: 9,
    leash: 12,    // stays in his throne room
    windup: 0.75, // his heavy blows are raised first, where you can see them
    run: 2.6,
    fleeBelow: -1,
    drops: { gold: [12, 20], sunstone: [1, 2] },
  },
  bandit: {
    noun: 'a bandit', one: 'a bandit', many: 'bandits',
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
  // The Stone Kingdom's army (the Ten Rounds — config/war.js). They come
  // from the King's side of the map, for your storehouses and for you, and
  // never wait for dark. `helm` colours the head where hair would be.
  archer: {
    noun: 'a Stone archer', one: 'an archer', many: 'archers',
    about: 'an archer of the Stone Kingdom',
    colours: [0x4a4636, 0x3d4a3a, 0x4f4234],
    helm: 0x3b3328,
    speed: 1.9,
    hp: 10, hits: 2, reach: 1.6, every: 2.4,
    shoots: 15,       // looses arrows at you from this far
    standOff: 9,      // and keeps about this far back
    aggro: 18, run: 3.6, fleeBelow: 3,
    drops: { gold: [0, 2] },
  },
  soldier: {
    noun: 'a Stone soldier', one: 'a Stone soldier', many: 'Stone soldiers',
    about: 'a soldier of the Stone Kingdom, in armour',
    colours: [0x3a3740, 0x45414d, 0x332f38],
    helm: 0x6d6a73,
    speed: 1.9,
    hp: 28, hits: 3, reach: 1.8, every: 1.2,
    aggro: 16, run: 3.4, fleeBelow: -1,
    drops: { gold: [1, 2], iron_ingot: [0, 1] },
  },
  warlord: {
    noun: 'the Warlord', one: 'the Warlord on his black beast', many: 'warlords',
    about: 'the Warlord of the Stone Kingdom',
    colours: [0x1d1a22],
    helm: 0xb08a3a,
    speed: 2.2,
    hp: 80, hits: 5, reach: 2.2, every: 1.3,
    aggro: 30, run: 3.8, fleeBelow: -1,
    drops: { gold: [8, 12], nightstone: [1, 1] },
  },
  // Not people: drawn by ArmyView, not as figures.
  warbeast: {
    noun: 'the Warlord\'s beast', one: 'a black beast', many: 'black beasts',
    about: 'the Warlord\'s black beast',
    beast: true,
    colours: [0x17131f],
    speed: 3.2,
    hp: 50, hits: 4, reach: 2.4, every: 1.1,
    aggro: 30, run: 5, fleeBelow: -1,
    drops: { hide: [1, 3] },
  },
  ram: {
    noun: 'a battering ram', one: 'a battering ram', many: 'battering rams',
    about: 'a battering ram — break it before it breaks your walls',
    siege: 'ram',
    colours: [0x6b4a2e],
    speed: 1.3,
    hp: 40, every: 2.5, // a blow on whatever's in its way, this often
    fleeBelow: -1,
    drops: { planks: [4, 8], iron_ingot: [0, 1] },
  },
  siege_catapult: {
    noun: 'a siege catapult', one: 'a siege catapult', many: 'siege catapults',
    about: 'a siege catapult — break it before it brings your walls down',
    siege: 'catapult',
    colours: [0x5a4030],
    speed: 1.1,
    hp: 30, every: 7, // a stone at your buildings, this often
    range: 26,        // and it stands this far off them to throw
    fleeBelow: -1,
    drops: { planks: [4, 8], stone: [2, 5] },
  },
  // A tree tribe (world/landmarks.js): up in the tallest trees, and they
  // never come down. Neutral — until you strike one of them or take from
  // their chests; then the whole tribe looses arrows at you from the decks.
  tribe: {
    noun: 'one of the tree people',
    about: 'one of the tree people — they never come down',
    aboutHostile: 'one of the tree people — angry now, hit to fight',
    colours: [0x4f8a3c, 0x3f7a4a, 0x6a9a3a, 0x2f6b46],
    helm: 0x2f5a2a,
    speed: 1.6,
    roam: 2.5,
    hp: 16, hits: 2, reach: 1.8, every: 1.3,
    shoots: 20,       // from the decks, at whoever's below
    shootsDown: 30,   // however far below
    standOff: 6,
    aggro: 22, run: 3, fleeBelow: -1,
    leash: 40,
    drops: { hemp_fibre: [1, 3], fruit: [0, 2], arrow: [1, 4] },
  },
  // The gods, in their cube (world/godCube.js) — whichever one you didn't
  // choose. Huge in strength, slow, heavy blows raised where you can see
  // them; every so often they call their creatures, faster when they're hurt.
  dark_god: {
    noun: 'the dark god', about: 'the dark god', aboutHostile: 'the dark god — beat him, or take his stash and run',
    colours: [0x1d1a22], helm: 0x2a2430,
    speed: 2.2, roam: 4,
    hp: 600, hits: 6, reach: 2.6, every: 1.6, windup: 0.8,
    aggro: 70, run: 3.4, fleeBelow: -1, leash: 400,
    god: true, minion: 'shade', noKnock: true,
    drops: { coin: [400, 600], diamond: [3, 6], nightstone: [2, 4] },
  },
  white_god: {
    noun: 'the white god', about: 'the white god', aboutHostile: 'the white god — beat him, or take his stash and run',
    colours: [0xf4efe2], helm: 0xe8c04f,
    speed: 2.2, roam: 4,
    hp: 600, hits: 6, reach: 2.6, every: 1.6, windup: 0.8,
    aggro: 70, run: 3.4, fleeBelow: -1, leash: 400,
    god: true, minion: 'seraph', noKnock: true,
    drops: { coin: [400, 600], diamond: [3, 6], sunstone: [2, 4] },
  },
  shade: {
    noun: 'a shade', about: 'a shade of the dark god', aboutHostile: 'a shade of the dark god — hit to fight',
    colours: [0x2a2430, 0x231f2a], helm: 0x16131a,
    speed: 2.6, roam: 6, hp: 22, hits: 3, reach: 1.8, every: 1.2, aggro: 70, run: 3.6, fleeBelow: -1, leash: 400,
    drops: { coin: [2, 6] },
  },
  seraph: {
    noun: 'a seraph', about: 'a seraph of the white god', aboutHostile: 'a seraph of the white god — hit to fight',
    colours: [0xf6f1df, 0xeef0f5], helm: 0xe8c04f,
    speed: 2.6, roam: 6, hp: 22, hits: 3, reach: 1.8, every: 1.2, aggro: 70, run: 3.6, fleeBelow: -1, leash: 400,
    drops: { coin: [2, 6] },
  },
  // The living cities (world/cities.js): citizens in the streets, guards at
  // the gates, merchants at the stalls. Neutral — strike one, or take from
  // a chest in their city, and the guards come for you and the rest run.
  citizen: {
    noun: 'a citizen',
    about: 'a citizen, about their day',
    colours: [0x8a5a44, 0x5a6f8a, 0x7a7a52, 0x8a4a6a, 0x4a7a6a],
    speed: 1.4,
    roam: 5,
    hp: 10, flees: true, run: 3.6,
    neutral: true,
    drops: { coin: [0, 3], fruit: [0, 1] },
  },
  city_guard: {
    noun: 'a city guard',
    about: 'a city guard — keeping the peace',
    aboutHostile: 'a city guard — after you now, hit to fight',
    colours: [0x5a5f6a, 0x4f5560],
    helm: 0x9a9fa8,
    speed: 1.4,
    roam: 2,
    hp: 24, hits: 3, reach: 1.9, every: 1.2,
    aggro: 18, run: 3.8, fleeBelow: -1,
    neutral: true,
    leash: 50,
    drops: { coin: [2, 6], iron_ingot: [0, 1] },
  },
  merchant: {
    noun: 'a merchant',
    about: 'a merchant at a stall',
    colours: [0x7a2f3a, 0x3f5a7a],
    speed: 0,
    roam: 0,
    hp: 10, flees: true, run: 3.4,
    neutral: true,
    drops: { coin: [3, 8] },
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
    // The Sky Kingdom fallen: you, Lord of the Sky.
    victor: ['Lord of the Sky! The island that cast you down hangs at your feet. My halls are open to you, always.', 'They will sing of this in the deep halls for a thousand years: the exile who brought down the Sky King.', 'The white god is silent at last. Rule your island well, my lord — and remember who gave you the army that took it.'],
    sworn: ['A thousand of my warriors march under your banner. Feed them, and they will follow you to the sky itself.', 'The Sky Kingdom hangs on its chains, far to the {dir} — look for its light low in the sky. Bring it down, and I will honour you above every lord I have.', 'Its anchor towers stand on the ground under it, each with a lift up the chain. Its King sits in the palace in the middle. Go to the {dir}.'],
  },
  tribe: [
    'There are people living up in the great trees to the {dir}. They never come down.',
    'Lights in the treetops to the {dir}, at night. The tree people, they say. Leave their chests alone.',
  ],
  city: [
    'There\'s a walled city to the {dir}, with a market in the square. They take coins.',
    'Merchants on the road from the {dir} — a city out that way, guards on the gate.',
  ],
  outpost: [
    'The Stone Kingdom has a fort out to the {dir}. Dark walls, black banners. They say its armoury is full.',
    'Soldiers in dark iron at a fort to the {dir}. Don\'t go near it wearing anything white.',
  ],
  ruined_city: [
    'To the {dir} there\'s a city with nobody in it. Walls fallen, roofs caved in. Chests still in the houses, they say.',
    'An empty city to the {dir}. Whatever happened there, the people never came back.',
  ],
  quiet: [
    'The roads are quiet. That\'s all the news there is.',
    'An explorer came through mapping the far country. Didn\'t stay.',
    'Good weather on the plains. Herds are fat this year.',
  ],
};
