/**
 * The people who aren't yours: who they are, what they look like, and what
 * a messenger has to say.
 *
 * All of them are scenery for now — no quests, nothing to trade, nobody to
 * fight. The bandits just watch, and keep their distance, until there's
 * something to fight with (Phase 6). Point at any of them and they're named,
 * the same way a settler is.
 */
export const WANDERERS = {
  hermit: {
    about: 'the hermit — keeps to themself',
    colours: [0x8b8f84],
    speed: 1.1,
    roam: 5,
  },
  bandit: {
    about: 'a bandit — watching you from the camp',
    colours: [0x6b3f3a, 0x4d4545, 0x7a5a3a, 0x5a4a5e],
    speed: 1.7,
    roam: 8,
    wary: 6, // keeps at least this far from you
  },
  explorer: {
    about: 'an explorer, passing through',
    colours: [0x6f8f5a, 0x8a7a55, 0x5f7f86],
    speed: 2.3,
  },
  messenger: {
    about: 'a messenger, with news for your settlement',
    colours: [0x5a7fa8],
    speed: 2.8,
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
    'Bandits have made camp to the {dir}. They watch the roads, but they\'ve done nothing yet.',
    'Saw a campfire to the {dir} last night — not travellers. Keep your eyes open.',
  ],
  quiet: [
    'The roads are quiet. That\'s all the news there is.',
    'An explorer came through mapping the far country. Didn\'t stay.',
    'Good weather on the plains. Herds are fat this year.',
  ],
};
