/**
 * POT-1 to POT-8: the wizard's potions. Each is a drink with a timed effect
 * (the `boost` mechanism of config/drinks.js), brewed at a Magic Cauldron from
 * Moonwater and things in the game, once the wizard has taught the recipe
 * (config/wizardQuests.js gives them in this order).
 *
 *   id        what the quest reward names
 *   boost     the key in DuiltGame.boosts (and config/drinks.js BOOSTS)
 *   seconds   how long it lasts at Magic level 1 (levels add 5% each)
 *   brew      the cauldron's seconds a batch
 *   inputs    what one potion costs: Moonwater, roots, fruit, mushrooms, ores
 */
export const POTIONS = [
  { id: 'night_vision', name: 'Night Vision', boost: 'p_night', color: 0x6a8cff, seconds: 300, brew: 45,
    says: 'The night looks like dusk', inputs: { moonwater: 1, fireflies: 2, mushroom_lilac: 1, grape: 2 } },
  { id: 'speed', name: 'Speed', boost: 'p_speed', color: 0xffd23a, seconds: 180, brew: 45,
    says: 'Walk and run faster', inputs: { moonwater: 1, coffee: 1, carrot_root: 2 } },
  { id: 'jump', name: 'Jump', boost: 'p_jump', color: 0x7fe08a, seconds: 180, brew: 45,
    says: 'Jump much higher', inputs: { moonwater: 1, feather: 2, lettuce_root: 2, mushroom_red: 1 } },
  { id: 'strength', name: 'Strength', boost: 'p_strength', color: 0xd0402f, seconds: 240, brew: 45,
    says: 'Every hit does more damage', inputs: { moonwater: 1, raw_meat: 1, broccoli_root: 2, iron_ingot: 1 } },
  { id: 'fire', name: 'Fire', boost: 'p_fire', color: 0xff7a2a, seconds: 150, brew: 45,
    says: 'Flames rise from you; mobs that touch or feel your blows burn', inputs: { moonwater: 1, coal: 3, mushroom_red: 1, passion_fruit: 2 } },
  { id: 'frost', name: 'Frost', boost: 'p_frost', color: 0x9fe6ff, seconds: 180, brew: 45,
    says: 'Snow where you walk; mobs that touch or feel your blows freeze', inputs: { moonwater: 1, snow: 4, mushroom_pale: 1, raspberry: 2 } },
  { id: 'invisibility', name: 'Invisibility', boost: 'p_invis', color: 0xdfe6ee, seconds: 120, brew: 45,
    says: 'Mobs and bandits ignore you until you hit them', inputs: { moonwater: 1, mushroom_pale: 3, dried_pale: 1, string: 1 } },
];
export const POTIONS_BY_ID = new Map(POTIONS.map((p) => [p.id, p]));
export const POTIONS_BY_BOOST = new Map(POTIONS.map((p) => [p.boost, p]));

/** The item a potion is: `potion_speed`. */
export const potionItem = (id) => `potion_${id}`;

/** POT-6: Strength adds this to every blow, plus 1 per 3 Magic levels above 1. */
export const STRENGTH_DAMAGE = 3;
/** POT-3: Speed's multiplier on walking, POT-5: Jump's on jump height. */
export const SPEED_POTION = 1.5, JUMP_POTION = 1.7;
/** POT-8: how long a frozen mob stays frozen, seconds; POT-7: how long a burn lasts. */
export const FROST_MOB_SECONDS = 60, FIRE_MOB_SECONDS = 6;
/** How near a mob has to be to touch you, in blocks. */
export const TOUCH_REACH = 1.3;
/** POT-8: a snow layer you leave stays this many seconds. */
export const SNOW_LAYER_SECONDS = 90;
