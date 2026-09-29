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
];

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
