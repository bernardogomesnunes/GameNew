/**
 * WIZ-5: the wizard's quest chain. Fixed order: one quest open at a time.
 *
 * Kinds:
 *   bring    hand over `items` (taken from the bag)
 *   brew     finish `n` batches at the Magic Cauldron
 *   kills    kill `n` mobs with the wand
 *   targets  hit the training targets `n` times
 *   casts    cast the wand `n` times
 * `level` (optional) asks for a Magic level too. `points` go to Magic.
 * `reward` is one of { item, recipe } (what he gives), in the order the owner
 * asked for: the Wand, then the Cauldron, then the potion recipes one by one,
 * then the Wizard Hat last.
 */

/**
 * What the Roots and Fruit quest asks for. Roots and the four fruits come with
 * their own work (FRUIT-1, FRUIT-5); until they are on main it asks for what
 * exists. Swap in carrot_root, broccoli_root, lettuce_root and apple here.
 */
export const ROOT_QUEST_ITEMS = { broccoli: 4, lettuce: 4, fruit: 4 };

export const WIZARD_QUESTS = [
  { id: 'offerings', name: 'First Offerings', kind: 'bring', items: { mushroom_red: 3, leaves: 6 },
    blurb: 'Bring me 3 red mushrooms and 6 leaves, and I will give you a wand.', points: 5, reward: { item: 'wizard_wand' } },
  { id: 'first_spark', name: 'First Spark', kind: 'casts', n: 10,
    blurb: 'Hold the wand and cast it 10 times. Point it away from your feet.', points: 5 },
  { id: 'aim_true', name: 'Aim True', kind: 'targets', n: 5,
    blurb: 'Hit the training targets by my hut 5 times.', points: 10 },
  { id: 'moss_and_stone', name: 'Moss and Stone', kind: 'bring', items: { cobblestone: 10, clay: 4, mushroom_lilac: 2 },
    blurb: 'Bring 10 cobblestone, 4 clay and 2 lilac mushrooms. I will make you a Magic Cauldron.', points: 10, reward: { item: 'magic_cauldron' } },
  { id: 'first_brew', name: 'First Brew', kind: 'brew', n: 3,
    blurb: 'Brew 3 batches of Moonwater in the Magic Cauldron: water, a pale mushroom and leaves.', points: 10, reward: { recipe: 'night_vision' } },
  { id: 'pest_control', name: 'Pest Control', kind: 'kills', n: 5,
    blurb: 'Kill 5 mobs with the wand.', points: 15, reward: { recipe: 'speed' } },
  { id: 'steady_hand', name: 'Steady Hand', kind: 'targets', n: 15,
    blurb: 'Hit the training targets 15 times.', points: 15, reward: { recipe: 'jump' } },
  { id: 'roots_and_fruit', name: 'Roots and Fruit', kind: 'bring', items: ROOT_QUEST_ITEMS,
    blurb: 'Bring 4 broccoli, 4 lettuce and 4 fruit for the strength potion.', points: 20, reward: { recipe: 'strength' } },
  { id: 'fire_in_the_pot', name: 'Fire in the Pot', kind: 'brew', n: 6, level: 3,
    blurb: 'Reach Magic level 3, then brew 6 more batches.', points: 25, reward: { recipe: 'fire' } },
  { id: 'cold_hands', name: 'Cold Hands', kind: 'kills', n: 15, level: 4,
    blurb: 'Reach Magic level 4, then kill 15 mobs with the wand.', points: 30, reward: { recipe: 'frost' } },
  { id: 'unseen', name: 'Unseen', kind: 'casts', n: 100, level: 5,
    blurb: 'Reach Magic level 5, then cast the wand 100 times.', points: 40, reward: { recipe: 'invisibility' } },
  // WAND-3: the last, and the hardest. Magic level 7 is 420 points, a long way on after the others.
  { id: 'the_hat', name: 'The Pointed Hat', kind: 'bring', items: { diamond: 3, ruby: 2, gold: 8, mushroom_lilac: 6 }, level: 7,
    blurb: 'Reach Magic level 7 and bring 3 diamonds, 2 rubies, 8 gold ingots and 6 lilac mushrooms. Then the hat is yours.', points: 60, reward: { item: 'wizard_hat' } },
];
export const WIZARD_QUESTS_BY_ID = new Map(WIZARD_QUESTS.map((q) => [q.id, q]));

/** The potion recipes he can teach, in the order the chain gives them. */
export const TAUGHT_ORDER = WIZARD_QUESTS.map((q) => q.reward?.recipe).filter(Boolean);
