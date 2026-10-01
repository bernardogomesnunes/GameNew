import { ARMOUR_PIECES } from './armour.js';
import { UPGRADES, UPGRADABLE_SWORDS, upgradedId } from './upgrades.js';

/**
 * What you can make, and where you can make it.
 *
 * `station` is the split from the notebook: `hand` recipes work anywhere from
 * the workbench menu, `workshop` ones need you to walk back to the building.
 * Age 1 is all hand work — the workshop itself isn't raised until Age 3, and
 * that walk is what will make where you put it matter.
 *
 * `needs` is a world condition rather than an ingredient: filling a bucket
 * requires standing by water, which is a place you have to be rather than a
 * thing you have to own.
 */

export const RECIPES = [
  {
    id: 'axe',
    name: 'Axe',
    station: 'hand',
    age: 1,
    inputs: { wood: 5 },
    output: { id: 'axe', count: 1 },
    blurb: 'Cuts trees far faster than bare hands. Wears out; make a spare.',
  },
  {
    id: 'pickaxe',
    name: 'Pickaxe',
    station: 'hand',
    age: 1,
    inputs: { wood: 3, stone: 4 },
    output: { id: 'pickaxe', count: 1 },
    blurb: 'Breaks stone far faster than bare hands. Wears out; make a spare.',
  },
  {
    id: 'shovel',
    name: 'Shovel',
    station: 'hand',
    age: 1,
    inputs: { wood: 4 },
    output: { id: 'shovel', count: 1 },
    blurb: 'Digs dirt and sand far faster than bare hands. Wears out; make a spare.',
  },
  {
    id: 'bucket',
    name: 'Bucket',
    station: 'hand',
    age: 1,
    inputs: { wood: 4 },
    output: { id: 'bucket', count: 1 },
    blurb: 'Carries water to wherever you need it.',
  },
  {
    id: 'pry_bar',
    name: 'Pry bar',
    station: 'hand',
    age: 1,
    inputs: { wood: 8, stone: 4 },
    output: { id: 'pry_bar', count: 1 },
    blurb: 'Takes a whole build, or a bite of hillside, away in one go.',
  },
  {
    id: 'chalk_line',
    name: 'Chalk line',
    station: 'hand',
    age: 1,
    inputs: { wood: 4, stone: 2 },
    output: { id: 'chalk_line', count: 1 },
    blurb: 'Echoes everything you place across the middle of the world.',
  },
  {
    id: 'fill_bucket',
    name: 'Fill the bucket',
    station: 'hand',
    age: 1,
    inputs: { bucket: 1 },
    output: { id: 'bucket_water', count: 1 },
    needs: 'water',
    blurb: 'Stand by the river and scoop.',
  },
  {
    id: 'empty_bucket',
    name: 'Empty the bucket',
    station: 'hand',
    age: 1,
    inputs: { bucket_water: 1 },
    output: { id: 'bucket', count: 1 },
    blurb: 'Pour it out and get the bucket back.',
  },
  {
    id: 'farmland',
    name: 'Turn soil',
    station: 'hand',
    age: 1,
    inputs: { dirt: 1 },
    output: { id: 'farmland', count: 1 },
    batch: 4, // tilling one square at a time is exactly the tedium to avoid
    blurb: 'Breaks dirt into soil a crop will actually grow in.',
  },
  {
    id: 'sapling',
    name: 'Sapling',
    station: 'hand',
    age: 1,
    inputs: { seeds: 2 },
    output: { id: 'sapling', count: 1 },
    batch: 4,
    blurb: 'Plant these to grow the forest you will claim.',
  },
  {
    id: 'planks',
    name: 'Planks',
    station: 'hand',
    age: 1,
    inputs: { wood: 1 },
    output: { id: 'planks', count: 2 },
    batch: 8,
    blurb: 'Two planks from one log — more wall for the same tree.',
  },
  {
    id: 'cook_meat',
    name: 'Cook meat',
    station: 'hand',
    age: 1,
    inputs: { raw_meat: 2, wood: 1 },
    output: { id: 'cooked_meat', count: 2 },
    batch: 4,
    blurb: 'A log on a fire. Six times the meal raw meat is.',
  },

  // --- Age 2: what stone is good for --------------------------------------
  {
    id: 'cobblestone',
    name: 'Split stone',
    station: 'hand',
    age: 2,
    inputs: { stone: 1 },
    output: { id: 'cobblestone', count: 2 },
    batch: 8,
    blurb: 'Two rough blocks from one cut one. Cheaper walls, uglier walls.',
  },

  // --- Age 3: the workshop, and the fire ----------------------------------
  //
  // These are the first recipes with a station. Making them at the bench in
  // your pocket would make the workshop a box you build once and never visit,
  // which is the opposite of the point of putting it somewhere.
  {
    id: 'brick',
    name: 'Brick',
    station: 'workshop',
    age: 3,
    inputs: { dirt: 3, cobblestone: 1 },
    output: { id: 'brick', count: 2 },
    batch: 6,
    blurb: 'Earth, shaped and fired. Holds a wall up far better than it has any right to.',
  },
  {
    id: 'glass',
    name: 'Glass',
    station: 'workshop',
    age: 3,
    inputs: { sand: 2 },
    output: { id: 'glass', count: 1 },
    batch: 8,
    blurb: 'Sand, taken hot enough to forget it was sand.',
  },
  {
    id: 'planks_fine',
    name: 'Dress planks',
    station: 'workshop',
    age: 3,
    inputs: { wood: 1 },
    output: { id: 'planks', count: 4 },
    batch: 8,
    blurb: 'The same log, cut properly. Twice what you get by hand.',
  },

  // --- Age 4: the foundry ---------------------------------------------------
  //
  // Raw ore is not the same thing as what a recipe wants — see the foundry's
  // own note in structures.js. Gold ore smelts straight into the same `gold`
  // item the tavern's jar already fills, rather than a separate currency
  // nothing else in the game would ever ask for.
  {
    id: 'smelt_iron',
    name: 'Smelt iron',
    station: 'foundry',
    age: 4,
    inputs: { iron_ore: 2 },
    output: { id: 'iron_ingot', count: 1 },
    batch: 8,
    blurb: 'Ore, taken hot enough to run clean.',
  },
  {
    id: 'smelt_copper',
    name: 'Smelt copper',
    station: 'foundry',
    age: 4,
    inputs: { copper_ore: 2 },
    output: { id: 'copper_ingot', count: 1 },
    batch: 8,
    blurb: 'The same fire, a softer metal.',
  },
  {
    id: 'smelt_gold',
    name: 'Smelt gold',
    station: 'foundry',
    age: 4,
    inputs: { gold_ore: 3 },
    output: { id: 'gold', count: 1 },
    batch: 6,
    blurb: 'What the tavern jar has always meant by "brought up from a mine."',
  },

  // --- Age 5: the expensive end -------------------------------------------
  {
    id: 'marble',
    name: 'Dress marble',
    station: 'workshop',
    age: 5,
    inputs: { stone: 4 },
    output: { id: 'marble', count: 1 },
    batch: 4,
    blurb: 'Four rough blocks down to one good one. Nothing else looks like it.',
  },

  // --- Phase 4: half-steps and furniture ----------------------------------
  //
  // Slabs and stairs are hand recipes rather than workshop ones — they are
  // cut planks and cut stone, not a new material, and Age 1 already has both
  // in hand. Furniture waits for the workshop, the same as the rest of what
  // it takes to make a place look like it's lived in rather than just built.
  {
    id: 'slab_plank',
    name: 'Plank Slab',
    station: 'hand',
    age: 1,
    inputs: { planks: 1 },
    output: { id: 'slab_plank', count: 2 },
    batch: 8,
    blurb: 'One plank, cut thin, makes two — a slab is half a block either way.',
  },
  {
    id: 'stairs_plank',
    name: 'Plank Stairs',
    station: 'hand',
    age: 1,
    inputs: { planks: 1 },
    output: { id: 'stairs_plank', count: 1 },
    batch: 6,
    blurb: 'Cut into a step instead of a slab.',
  },
  {
    // Somewhere to keep things that isn't a whole storehouse — and the
    // same box you'll find your things in where you fell.
    id: 'chest',
    name: 'Chest',
    station: 'hand',
    age: 1,
    inputs: { planks: 6 },
    output: { id: 'chest', count: 1 },
    blurb: 'Twenty-seven slots in a box you can put anywhere. Place opens it.',
  },
  // Swords (Phase 6b): at the bench, each a step harder than the last.
  {
    id: 'sword_wood',
    name: 'Wooden Sword',
    station: 'hand',
    age: 1,
    inputs: { wood: 2, planks: 3 },
    output: { id: 'sword_wood', count: 1 },
    blurb: 'Better than fists. Not by as much as you would like.',
  },
  {
    id: 'sword_stone',
    name: 'Stone Sword',
    station: 'hand',
    age: 2,
    inputs: { wood: 2, stone: 5 },
    output: { id: 'sword_stone', count: 1 },
    blurb: 'A stone edge on a wooden grip. Two good blows see off a bandit.',
  },
  {
    id: 'sword_iron',
    name: 'Iron Sword',
    station: 'hand',
    age: 4,
    inputs: { wood: 2, iron_ingot: 3 },
    output: { id: 'sword_iron', count: 1 },
    blurb: 'Foundry iron. Hits hardest and lasts longest.',
  },
  // Homes (playtest, P1): a bed and a painting, both from the first age.
  {
    id: 'bed', name: 'Bed', station: 'hand', age: 1, inputs: { planks: 4, leaves: 3 }, output: { id: 'bed', count: 1 },
    blurb: 'A frame, a mattress stuffed with leaves, a blanket. Two blocks long.',
  },
  {
    id: 'painting', name: 'Painting', station: 'hand', age: 1, inputs: { planks: 2, dirt: 1, leaves: 1 }, output: { id: 'painting', count: 1 },
    blurb: 'Earth and leaves for paint. Hang it in your house — Place on it, and that is where you wake after a fall.',
  },
  // The catapult (Phase 6c): put it down, man it, throw stones that break
  // whatever they land on. Ammunition is stone from your bag.
  {
    id: 'catapult',
    name: 'Catapult',
    station: 'hand',
    age: 3,
    inputs: { planks: 10, wood: 4, stone: 6 },
    output: { id: 'catapult', count: 1 },
    blurb: 'A stone-thrower on wheels. Look where you want it to land; it does the rest.',
  },
  {
    id: 'fence',
    name: 'Fence',
    station: 'hand',
    age: 2,
    inputs: { planks: 1 },
    output: { id: 'fence', count: 2 },
    batch: 8,
    blurb: 'Too tall to hop and too tall for anything to climb. What a pen is made of.',
  },
  {
    id: 'gate',
    name: 'Gate',
    station: 'hand',
    age: 2,
    inputs: { planks: 3 },
    output: { id: 'gate', count: 1 },
    blurb: 'The way into a pen. You walk through it; the animals can\'t.',
  },
  {
    id: 'door',
    name: 'Door',
    station: 'hand',
    age: 1,
    inputs: { planks: 4 },
    output: { id: 'door', count: 1 },
    blurb: 'Two blocks tall and hung the way you face. Place opens and shuts it.',
  },
  {
    id: 'slab_stone',
    name: 'Stone Slab',
    station: 'hand',
    age: 2,
    inputs: { stone: 1 },
    output: { id: 'slab_stone', count: 2 },
    batch: 8,
    blurb: 'Split thin instead of split rough — two slabs from one block.',
  },
  {
    id: 'roof_brick',
    name: 'Brick Roof Tiles',
    station: 'hand',
    age: 3,
    inputs: { brick: 1 },
    output: { id: 'roof_brick', count: 2 },
    batch: 8,
    blurb: 'Telhas: a real sloped roof in rows of tiles. Hold them and use the Roof tool.',
  },
  {
    id: 'roof_stone',
    name: 'Stone Roof Tiles',
    station: 'hand',
    age: 1,
    inputs: { stone: 1 },
    output: { id: 'roof_stone', count: 2 },
    batch: 8,
    blurb: 'Slates: the same sloped roof in grey stone.',
  },
  {
    id: 'stairs_stone',
    name: 'Stone Stairs',
    station: 'hand',
    age: 2,
    inputs: { stone: 1 },
    output: { id: 'stairs_stone', count: 1 },
    batch: 6,
    blurb: 'Cut into a step instead of a slab.',
  },
  {
    id: 'lantern',
    name: 'Lantern',
    station: 'workshop',
    age: 3,
    inputs: { planks: 2, glass: 1 },
    output: { id: 'lantern', count: 1 },
    blurb: 'A real light, not a decoration — see it burn from across your land.',
  },
  {
    id: 'chandelier',
    name: 'Chandelier',
    station: 'workshop',
    age: 3,
    inputs: { iron_ingot: 1, planks: 1 },
    output: { id: 'chandelier', count: 1 },
    blurb: 'Hangs from a ceiling and lights the whole room from above.',
  },
  {
    id: 'table_oak',
    name: 'Oak Table',
    station: 'workshop',
    age: 3,
    inputs: { planks: 4 },
    output: { id: 'table_oak', count: 1 },
    blurb: 'A tabletop on four legs, not just a block that says table.',
  },
  {
    id: 'chair_oak',
    name: 'Oak Chair',
    station: 'workshop',
    age: 3,
    inputs: { planks: 3 },
    output: { id: 'chair_oak', count: 1 },
    blurb: 'A seat and a back — sit-height, and it actually collides that way.',
  },
  {
    id: 'chair_red',
    name: 'Red Chair',
    station: 'workshop',
    age: 3,
    inputs: { planks: 2, brick: 1 },
    output: { id: 'chair_red', count: 1 },
    blurb: 'The same chair, finished in brick red.',
  },
  {
    id: 'rug_green',
    name: 'Green Rug',
    station: 'workshop',
    age: 3,
    inputs: { leaves: 4 },
    output: { id: 'rug_green', count: 1 },
    blurb: 'Woven from stripped leaves. You walk straight over it — it never collides.',
  },
  {
    id: 'rug_red',
    name: 'Red Rug',
    station: 'workshop',
    age: 3,
    inputs: { leaves: 3, brick: 1 },
    output: { id: 'rug_red', count: 1 },
    blurb: 'The same weave, dyed with crushed brick.',
  },
  {
    id: 'rug_blue',
    name: 'Blue Rug',
    station: 'workshop',
    age: 3,
    inputs: { leaves: 3, glass: 1 },
    output: { id: 'rug_blue', count: 1 },
    blurb: 'The same weave, dyed with ground glass.',
  },
  {
    id: 'table_marble',
    name: 'Marble Table',
    station: 'workshop',
    age: 5,
    inputs: { marble: 3 },
    output: { id: 'table_marble', count: 1 },
    blurb: 'The same shape as the oak table, cut from marble instead.',
  },
  // Phase 7a: the decorative pack — all at the bench.
  {
    id: 'dark_stone',
    name: 'Dark Stone',
    station: 'hand',
    age: 3,
    inputs: { stone: 4, dark_wood: 1 },
    output: { id: 'dark_stone', count: 4 },
    batch: 8,
    blurb: 'Stone smoked black over a dark-wood fire. What the Stone Kingdom is built of.',
  },
  {
    id: 'dark_brick',
    name: 'Dark Brick',
    station: 'hand',
    age: 3,
    inputs: { brick: 4, dark_wood: 1 },
    output: { id: 'dark_brick', count: 4 },
    batch: 8,
    blurb: 'Brick fired the same way. Grim, and very hard to argue with.',
  },
  {
    id: 'sky_marble',
    name: 'Sky Marble',
    station: 'hand',
    age: 5,
    inputs: { marble: 2, glass: 1 },
    output: { id: 'sky_marble', count: 2 },
    batch: 4,
    blurb: 'Marble polished until it takes the colour of the sky.',
  },
  {
    id: 'gold_trim',
    name: 'Gold Trim',
    station: 'hand',
    age: 4,
    inputs: { gold: 1, stone: 2 },
    output: { id: 'gold_trim', count: 2 },
    batch: 4,
    blurb: 'A band of gold set into stone, for the edges of something grand.',
  },
  {
    id: 'timber_frame',
    name: 'Timber Frame',
    station: 'hand',
    age: 2,
    inputs: { planks: 2, clay: 1 },
    output: { id: 'timber_frame', count: 2 },
    batch: 8,
    blurb: 'Clay plaster between dark beams. A house that looks like a house.',
  },
  {
    id: 'wall_cobble',
    name: 'Cobblestone Wall',
    station: 'hand',
    age: 2,
    inputs: { cobblestone: 3 },
    output: { id: 'wall_cobble', count: 4 },
    batch: 8,
    blurb: 'A low stone wall that joins its neighbours, with a post at every turn.',
  },
  {
    id: 'wall_stone',
    name: 'Stone Wall',
    station: 'hand',
    age: 2,
    inputs: { stone: 3 },
    output: { id: 'wall_stone', count: 4 },
    batch: 8,
    blurb: 'A low stone wall that joins its neighbours, with a post at every turn.',
  },
  {
    id: 'wall_brick',
    name: 'Brick Wall',
    station: 'hand',
    age: 3,
    inputs: { brick: 3 },
    output: { id: 'wall_brick', count: 4 },
    batch: 8,
    blurb: 'A low brick wall that joins its neighbours, with a post at every turn.',
  },
  {
    id: 'wall_dark',
    name: 'Dark Stone Wall',
    station: 'hand',
    age: 3,
    inputs: { dark_stone: 3 },
    output: { id: 'wall_dark', count: 4 },
    batch: 8,
    blurb: 'A low wall of dark stone, the way the Stone Kingdom builds them.',
  },
  {
    id: 'pillar_stone',
    name: 'Stone Pillar',
    station: 'hand',
    age: 3,
    inputs: { stone: 3 },
    output: { id: 'pillar_stone', count: 2 },
    batch: 6,
    blurb: 'Stack them: a base grows at the bottom and a capital at the top.',
  },
  {
    id: 'pillar_marble',
    name: 'Marble Pillar',
    station: 'hand',
    age: 5,
    inputs: { marble: 2 },
    output: { id: 'pillar_marble', count: 2 },
    batch: 6,
    blurb: 'Stack them: a base grows at the bottom and a capital at the top.',
  },
  {
    id: 'pillar_dark',
    name: 'Dark Pillar',
    station: 'hand',
    age: 3,
    inputs: { dark_stone: 2 },
    output: { id: 'pillar_dark', count: 2 },
    batch: 6,
    blurb: 'Stack them: a base grows at the bottom and a capital at the top.',
  },
  {
    id: 'trapdoor',
    name: 'Trapdoor',
    station: 'hand',
    age: 1,
    inputs: { planks: 3 },
    output: { id: 'trapdoor', count: 2 },
    batch: 4,
    blurb: 'A door in the floor. Place opens and shuts it.',
  },
  {
    id: 'window',
    name: 'Framed Window',
    station: 'hand',
    age: 3,
    inputs: { planks: 2, glass: 1 },
    output: { id: 'window', count: 1 },
    batch: 6,
    blurb: 'Glass in a wooden frame, with a cross of glazing bars.',
  },
  {
    id: 'vase',
    name: 'Vase',
    station: 'hand',
    age: 2,
    inputs: { clay: 2 },
    output: { id: 'vase', count: 1 },
    batch: 4,
    blurb: 'A painted vase, for a shelf or a doorstep.',
  },
  {
    id: 'urn',
    name: 'Urn',
    station: 'hand',
    age: 4,
    inputs: { copper_ingot: 2 },
    output: { id: 'urn', count: 1 },
    batch: 4,
    blurb: 'A lidded bronze urn with handles.',
  },
  {
    id: 'banner_white',
    name: 'White Banner',
    station: 'hand',
    age: 3,
    inputs: { wool: 3, planks: 1 },
    output: { id: 'banner_white', count: 1 },
    batch: 2,
    blurb: 'White, with the gold sun of the Sky Kingdom.',
  },
  {
    id: 'banner_black',
    name: 'Black Banner',
    station: 'hand',
    age: 3,
    inputs: { wool: 3, planks: 1, dark_wood: 1 },
    output: { id: 'banner_black', count: 1 },
    batch: 2,
    blurb: 'Black, with the red tower of the Stone Kingdom.',
  },
  {
    id: 'firefly_lantern',
    name: 'Firefly Lantern',
    station: 'hand',
    age: 3,
    inputs: { glass: 1, planks: 1, fireflies: 2 },
    output: { id: 'firefly_lantern', count: 1 },
    batch: 4,
    blurb: 'Fireflies you caught, in glass. A soft green light, the way the Sky Kingdom lights its paths.',
  },
];

// The Temple (Phase 7c). Offerings turn what you have into devotion; a
// chapel (tier 1) blesses water; the High Temple (tier 4) forges a ring —
// the White or the Black, and once one is forged the other is closed to
// you for good (`ring`, see Crafting's `locked`).
RECIPES.push(
  { id: 'offer_fruit', name: 'Offer fruit', station: 'temple', age: 3, inputs: { fruit: 6 }, output: { id: 'devotion', count: 1 }, batch: 6, blurb: 'Laid on the altar.' },
  { id: 'offer_harvest', name: 'Offer a harvest', station: 'temple', age: 3, inputs: { vegetables: 4 }, output: { id: 'devotion', count: 1 }, batch: 6, blurb: 'The first of what the farm gave.' },
  { id: 'offer_meat', name: 'Offer a meal', station: 'temple', age: 3, inputs: { cooked_meat: 2 }, output: { id: 'devotion', count: 1 }, batch: 6, blurb: 'A feast for the god, eaten by the priests.' },
  { id: 'offer_gold', name: 'Offer gold', station: 'temple', age: 3, inputs: { gold: 1 }, output: { id: 'devotion', count: 2 }, batch: 8, blurb: 'Gold buys devotion faster than anything.' },
  { id: 'offer_candle', name: 'Light a candle', station: 'temple', age: 3, inputs: { lantern: 1 }, output: { id: 'devotion', count: 1 }, batch: 4, blurb: 'A light left burning at the altar.' },
  // Calçada portuguesa (playtest, P9): knapped at the bench, white from
  // stone, dark from dark stone, and the wave from both.
  { id: 'calcada', name: 'Calçada', station: 'hand', age: 2, inputs: { stone: 2 }, output: { id: 'calcada', count: 4 }, batch: 8, blurb: 'Little white setts, for a road or a square.' },
  { id: 'calcada_dark', name: 'Dark Calçada', station: 'hand', age: 2, inputs: { stone: 1, dark_stone: 1 }, output: { id: 'calcada_dark', count: 4 }, batch: 8, blurb: 'Little dark setts, for a pattern in the white.' },
  { id: 'calcada_wave', name: 'Calçada Wave', station: 'hand', age: 2, inputs: { calcada: 2, calcada_dark: 1 }, output: { id: 'calcada_wave', count: 3 }, batch: 6, blurb: 'The wave of dark through white, as on a Lisbon square.' },
  // Drinks (playtest, P5): a few minutes better at something — see config/drinks.js.
  { id: 'beer', name: 'Beer', station: 'workshop', age: 3, inputs: { potato: 2, seeds: 1 }, output: { id: 'beer', count: 2 }, batch: 4, blurb: 'Potatoes and grain, left to work. Quicker blows for three minutes.' },
  { id: 'kombucha', name: 'Kombucha', station: 'workshop', age: 3, inputs: { fruit: 2, leaves: 1 }, output: { id: 'kombucha', count: 2 }, batch: 4, blurb: 'Fruit and leaf tea, soured. +2 on every hit for three minutes.' },
  { id: 'coffee', name: 'Coffee', station: 'workshop', age: 3, inputs: { coffee_beans: 3 }, output: { id: 'coffee', count: 2 }, batch: 4, blurb: 'Roasted, ground and brewed. Faster on your feet for three minutes.' },
  { id: 'holy_water', name: 'Holy Water', station: 'temple', tier: 1, age: 3, inputs: { glass: 1, devotion: 1 }, output: { id: 'holy_water', count: 2 }, batch: 4, blurb: 'Blessed at a chapel or better. Drink it to heal four hearts.' },
  {
    id: 'ring_white', name: 'Forge the White Ring', station: 'temple', tier: 4, age: 3, ring: 'white',
    inputs: { sunstone: 3, gold: 4, devotion: 12 }, output: { id: 'ring_white', count: 1 },
    blurb: 'Gold and Sunstone. You move faster and jump higher. Forge it, and the Black Ring is closed to you.',
  },
  {
    id: 'ring_black', name: 'Forge the Black Ring', station: 'temple', tier: 4, age: 3, ring: 'black',
    inputs: { nightstone: 3, obsidian: 4, devotion: 12 }, output: { id: 'ring_black', count: 1 },
    blurb: 'Obsidian and Nightstone. A dark spark hurts whoever strikes you. Forge it, and the White Ring is closed to you.',
  },
);

// Armour (Phase 7b): each piece at the bench, from config/armour.js.
for (const p of ARMOUR_PIECES) {
  RECIPES.push({
    id: p.id, name: p.name, station: 'hand', age: p.age, inputs: p.inputs, output: { id: p.id, count: 1 },
    blurb: `${p.points} armour, worn on the ${p.slot === 'body' ? 'body' : p.slot}. ${p.madeBy}.`,
  });
}

// Upgrades (playtest, P6): laid on at a chapel or better — the piece,
// devotion and one thing that suits it. See config/upgrades.js.
for (const [key, e] of Object.entries(UPGRADES)) {
  const bases = e.weapon ? UPGRADABLE_SWORDS : ARMOUR_PIECES.filter((p) => e.slots.includes(p.slot)).map((p) => p.id);
  for (const base of bases) {
    const id = upgradedId(base, key);
    RECIPES.push({
      id, name: `Upgrade: ${e.name}`, station: 'temple', tier: 2, age: 3,
      inputs: { [base]: 1, devotion: e.devotion, ...e.inputs }, output: { id, count: 1 },
      blurb: `Lays ${e.name} on it — ${e.says}.`,
    });
  }
}

export const RECIPES_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

/**
 * Where an item comes from, in one line a player can act on.
 *
 * "Needs 2 saplings" is only useful if you know what a sapling is made of.
 * This is checked against the recipe list rather than written out per item, so
 * a new recipe explains its own output the moment it exists.
 */
export function howToGet(itemId, blockName = null) {
  const recipe = RECIPES.find((r) => r.output.id === itemId);
  if (recipe) {
    const from = Object.entries(recipe.inputs)
      .map(([id, n]) => `${n} ${id.replace(/_/g, ' ')}`).join(' and ');
    return recipe.needs === 'water'
      ? `make it at the workbench by the river, from ${from}`
      : `make it at the workbench from ${from}`;
  }
  if (blockName) return `break ${blockName.toLowerCase()} to collect it`;
  return null;
}

export function recipesFor(age, station = null) {
  return RECIPES.filter((r) => r.age <= age && (!station || r.station === station));
}
