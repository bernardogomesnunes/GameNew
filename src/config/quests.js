/**
 * Quests: errands people give you, with a reason, a reward, and a piece of
 * the story when you hand them in. Asked for directly: "I'd like to build
 * guided quest. But we need to have attention to details here, and avoid
 * soft blocking the game with this ... make sure no dependence's exist
 * between new advancements."
 *
 * So, the rules every quest here keeps:
 *
 *   - Nothing waits on a quest. Ages, buildings and recipes never ask for
 *     one; a quest is something extra you can do, never something you must.
 *   - No quest needs another. Each opens at its age on its own; there are no
 *     chains to get stuck halfway along.
 *   - Each can be done with what its age can reach. The border keeps you in
 *     until Age 6, so nothing before then asks you to go anywhere; nothing
 *     asks for an item before the age that makes it (tests/quests.test).
 *   - What it asks is read off the world, not caught as it happens: what's
 *     in your bag, what you've claimed, where you've been. A count (animals
 *     hunted, things bought, buildings evolved) runs from when the quest
 *     opened, so it can't have been missed before.
 *   - It's handed in from the Quests tab, wherever you are. Whoever asked
 *     doesn't have to be found, or even alive.
 *
 * How to read one:
 *
 *   id, age   when it opens (and stays open until it's done)
 *   from      who asks — see GIVERS
 *   title     its name
 *   ask       what they say, asking
 *   needs     one of:
 *               { deliver: { item: count } }  handed over from your bag
 *               { claim: 'structure' }        one of yours, standing
 *               { hunt: n }                   animals hunted since it opened
 *               { trade: n }                  things bought since it opened
 *               { evolve: n }                 buildings evolved since it opened
 *               { find: 'landmark kind' }     a place you've found
 *   reward    { items: { item: count }, xp }
 *   thanks    what you're told when you hand it in — the story it pays
 */

export const GIVERS = {
  hermit: { name: 'The hermit', icon: '🧓', note: 'by messenger' },
  messenger: { name: 'A messenger', icon: '📜' },
  settlers: { name: 'Your settlers', icon: '🏘️' },
  grub: { name: 'Grub the trader', icon: '🪙' },
};

export const QUESTS = [
  // ---- Age 1: Exile -------------------------------------------------------
  {
    id: 'q_shelter', age: 1, from: 'hermit', title: 'Before the first winter',
    ask: 'A messenger brings word from an old hermit past the hills: "I fell too, once. The first nights down here are the coldest. Build four walls and a roof before anything else."',
    needs: { claim: 'house' },
    reward: { items: { coin: 5 }, xp: 60 },
    thanks: '"Good. A roof is the first thing the sky can\'t take from you. Keep it." — the hermit',
  },
  {
    id: 'q_fruit', age: 1, from: 'hermit', title: 'A bare orchard',
    ask: '"My trees have gone bare this year. If your forest gives, send me six fruit, and I\'ll send you seeds for a garden."',
    needs: { deliver: { fruit: 6 } },
    reward: { items: { seeds_lettuce: 2, seeds_cabbage: 2 }, xp: 50 },
    thanks: 'Seeds come back wrapped in a leaf, with a note: "Lettuce and cabbage. Put one of each in your farm and it\'ll grow them for you."',
  },
  {
    id: 'q_hunt', age: 1, from: 'messenger', title: 'Meat for the winter',
    ask: 'A passing messenger looks you over: "There\'s deer and boar in these woods. Hunt three, and you won\'t go hungry this winter."',
    needs: { hunt: 3 },
    reward: { items: { coin: 5 }, xp: 60 },
    thanks: '"There — the land feeds whoever works it. Cook the meat before you eat it."',
  },

  // ---- Age 2: Roots -------------------------------------------------------
  {
    id: 'q_cobble', age: 2, from: 'settlers', title: 'Mud in the doorways',
    ask: '"Mud in the doorways, mud in the bread. Bring us thirty-two cobblestones and we\'ll lay a proper yard."',
    needs: { deliver: { cobblestone: 32 } },
    reward: { items: { coin: 10 }, xp: 80 },
    thanks: '"The yard\'s laid. You can hear boots on stone now — it sounds like a town."',
  },
  {
    id: 'q_pen', age: 2, from: 'settlers', title: 'Eggs without chasing',
    ask: '"If we had animals penned, we\'d have eggs and wool without running after them. Fence a pen and lead some in."',
    needs: { claim: 'pen' },
    reward: { items: { seeds_potato: 3 }, xp: 80 },
    thanks: '"The children have named every one of them. Here — potato seed, from a sack we carried all the way here."',
  },
  {
    id: 'q_cooked', age: 2, from: 'messenger', title: 'The hermit is unwell',
    ask: '"The old hermit is too sick to hunt. Send five cooked meats, and he says he\'ll owe you a story."',
    needs: { deliver: { cooked_meat: 5 } },
    reward: { items: { seeds_coffee: 2 }, xp: 70 },
    thanks: 'The messenger comes back: "He ate, and he talked. He says the island you fell from hangs on four chains, and the chains are older than either kingdom. He sent coffee seed, too."',
  },

  // ---- Age 3: Forge -------------------------------------------------------
  {
    id: 'q_glass', age: 3, from: 'hermit', title: 'A dark hut',
    ask: '"In the Sky Kingdom every window caught the light. Make me eight panes of glass — my hut has been dark for twenty years."',
    needs: { deliver: { glass: 8 } },
    reward: { items: { lantern: 2 }, xp: 100 },
    thanks: '"Light again. I\'d forgotten how it falls through glass in the morning. Take these lanterns — I\'ve no use for them now."',
  },
  {
    id: 'q_fireflies', age: 3, from: 'hermit', title: 'The white god\'s lights',
    ask: '"They say the white god\'s fireflies came down with me. Catch two jars of them on a warm night, and let me see them once more."',
    needs: { deliver: { fireflies: 2 } },
    reward: { items: { devotion: 3 }, xp: 100 },
    thanks: '"The same ones. The same green. Here — take this to your temple. It\'s more yours than mine."',
  },
  {
    id: 'q_bricks', age: 3, from: 'settlers', title: 'A hearth in every house',
    ask: '"The workshop smokes and the kiln roars — let\'s have something to show for it. Twenty-four bricks, for a proper hearth in every house."',
    needs: { deliver: { brick: 24 } },
    reward: { items: { coin: 15 }, xp: 100 },
    thanks: '"Warm hearths. Folk stay up later now, telling stories about where you came from."',
  },

  // ---- Age 4: Hearth ------------------------------------------------------
  {
    id: 'q_trade', age: 4, from: 'grub', title: 'First customer',
    ask: 'Grub the goblin leans over his counter: "Market\'s open, chief. First customer gets a coin back for luck. Buy anything."',
    needs: { trade: 1 },
    reward: { items: { coin: 10 }, xp: 80 },
    thanks: '"Pleasure doing business. Come back when your purse is heavier — I\'ve cousins who sell steel."',
  },
  {
    id: 'q_tavern', age: 4, from: 'settlers', title: 'Somewhere to sit at night',
    ask: '"A town needs a place to sit at night and hear the news. Raise a tavern and we\'ll fill it."',
    needs: { claim: 'tavern' },
    reward: { items: { beer: 2 }, xp: 120 },
    thanks: '"Full every night. The talk is all of the Stone Kingdom, and whether it will come for us."',
  },
  {
    id: 'q_foundry', age: 4, from: 'messenger', title: 'Iron of your own',
    ask: '"The Stone Kingdom smelts its own iron. Whether you mean to stand against it or beside it, you\'ll want a foundry of your own."',
    needs: { claim: 'foundry' },
    reward: { items: { iron_ingot: 4 }, xp: 120 },
    thanks: '"Iron of your own. Here are four ingots from a friend in the hills, to start you off."',
  },

  // ---- Age 5: Bastion -----------------------------------------------------
  {
    id: 'q_wall', age: 5, from: 'messenger', title: 'Before they test you',
    ask: '"Bandits test every new town. Raise a stretch of stone wall, with battlements, before they test yours."',
    needs: { claim: 'wall' },
    reward: { items: { coin: 25 }, xp: 150 },
    thanks: '"They\'ll think twice now. So will others."',
  },
  {
    id: 'q_mine', age: 5, from: 'settlers', title: 'Below the easy ground',
    ask: '"Everything easy is above ground, chief. Let\'s dig a proper mine."',
    needs: { claim: 'mine' },
    reward: { items: { coin: 20 }, xp: 150 },
    thanks: '"Down there it\'s dark and cool, and the rock rings when you strike it."',
  },
  {
    id: 'q_evolve', age: 5, from: 'grub', title: 'Worth walking past',
    ask: '"Your buildings could do more, chief. Give one what its next level asks for — lights, a chest — and evolve it."',
    needs: { evolve: 1 },
    reward: { items: { coin: 20 }, xp: 150 },
    thanks: '"Look at it now. Folk walk out of their way to see it — and walk past my stall on the way."',
  },

  // ---- Age 6: Reckoning (the wall is down) --------------------------------
  {
    id: 'q_ruin', age: 6, from: 'messenger', title: 'Older than kingdoms',
    ask: '"With the wall down you can go where you like. There are ruins out there from before either kingdom — find one."',
    needs: { find: 'ruin' },
    reward: { items: { coin: 30 }, xp: 200 },
    thanks: '"So you\'ve seen them. Whoever built those walls built them to last, and still they fell."',
  },
  {
    id: 'q_hermit', age: 6, from: 'hermit', title: 'Come yourself',
    ask: '"You\'ve sent me fruit and glass and fireflies. Now come yourself — my hut is out past the hills."',
    needs: { find: 'hermit' },
    reward: { items: { coin: 20 }, xp: 200 },
    thanks: 'The hermit takes your hand: "You still have the Sky Kingdom\'s look about you. Go well — and don\'t spend too long looking up."',
  },
  {
    id: 'q_kingdom', age: 6, from: 'messenger', title: 'Where every road ends',
    ask: '"Every old road ends at the Stone Kingdom. See it for yourself — the dark walls, the red tower."',
    needs: { find: 'kingdom' },
    reward: { items: { coin: 30 }, xp: 250 },
    thanks: '"Now you know what\'s out there — and who you might stand against, or beside."',
  },
];

export const QUESTS_BY_ID = new Map(QUESTS.map((q) => [q.id, q]));
