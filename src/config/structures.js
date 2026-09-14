/**
 * Building definitions for Duilt.
 *
 * A structure is a region of the world the game has agreed to call something.
 * Each entry says what has to be inside that region for the claim to stand, and
 * what the building gives back once it does.
 *
 * The rules are deliberately small. A farm is four dirt and four seeds, not a
 * fenced enterprise — cheap buildings mean you make many of them, and the
 * interest lives in chaining them rather than in one monumental barn.
 *
 * `requires` entries are checked in order and the first failure is what the
 * player is told, so put the most obvious one first. Every entry must be able
 * to explain itself: "needs 2 more dirt" teaches, "invalid" infuriates.
 */

const GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, SAND = 6, PLANKS = 7,
      COBBLE = 8, BRICK = 9, GLASS = 10, WATER = 11, GOLD = 13, MARBLE = 17,
      SAPLING = 20, FARMLAND = 21;

/** Counts matching blocks in the region. */
const count = (ctx, ids) => ctx.countOf(ids);

export const STRUCTURES = [
  {
    id: 'forest',
    name: 'Forest',
    icon: '🌲',
    age: 1,
    blurb: 'Standing trees that keep giving, instead of a stump you cut once.',
    minSize: 4,
    maxSize: 16,
    // Cost is paid from the bag when you claim, on top of what's already placed.
    cost: {},
    requires: [
      {
        id: 'trunks',
        test: (ctx) => count(ctx, [WOOD]) >= 12,
        say: (ctx) => `Needs ${12 - count(ctx, [WOOD])} more wood — grow or plant more trees`,
      },
      {
        id: 'canopy',
        test: (ctx) => count(ctx, [LEAVES]) >= 20,
        say: (ctx) => `Needs ${20 - count(ctx, [LEAVES])} more leaves — the trees are too bare`,
      },
      {
        id: 'soil',
        test: (ctx) => count(ctx, [DIRT, GRASS, SAPLING]) >= 8,
        say: () => 'Needs more open soil between the trees',
      },
    ],
    produces: { wood: 4, leaves: 3, seeds: 2, fruit: 1 },
    everySeconds: 60,
    skill: 'foraging',
  },

  {
    id: 'farm',
    name: 'Farm',
    icon: '🌾',
    age: 1,
    blurb: 'Turned soil beside fresh water. Four by four is enough to start.',
    minSize: 2,
    maxSize: 16,
    cost: { seeds: 4 },
    requires: [
      {
        id: 'tilled',
        test: (ctx) => count(ctx, [FARMLAND]) >= 4,
        say: (ctx) => `Needs ${4 - count(ctx, [FARMLAND])} more tilled soil — place farmland`,
      },
      {
        id: 'water',
        // The river is guaranteed in the starting plot precisely so this rule
        // is always satisfiable without a bucket run.
        test: (ctx) => ctx.hasWithin([WATER], 6),
        say: () => 'Needs fresh water within 6 blocks — build nearer the river',
      },
    ],
    produces: { vegetables: 3, seeds: 2, fruit: 1 },
    everySeconds: 75,
    skill: 'building',
  },

  {
    id: 'house',
    name: 'House',
    icon: '🏠',
    age: 1,
    blurb: 'Somewhere to sleep. Later, somewhere for a settler to sleep.',
    minSize: 4,
    maxSize: 16,
    cost: {},
    requires: [
      {
        id: 'walls',
        test: (ctx) => count(ctx, [WOOD]) >= 20,
        say: (ctx) => `Needs ${20 - count(ctx, [WOOD])} more wood in the walls`,
      },
      {
        // A doorway is expected, so this asks for a sheltered room rather than a
        // sealed box: walls on all sides and a roof over, with a way in.
        id: 'shelter',
        test: (ctx) => ctx.shelteredVolume() >= 8,
        say: (ctx) => ctx.shelteredVolume() === 0
          ? 'Needs a room inside — walls all round and a roof over the top'
          : 'The room is too small — make it at least 3 across inside',
      },
    ],
    produces: {},
    // One roof, one household. The first house you build is your own, so it is
    // the second that brings somebody — see duilt/Settlers.js.
    grantsCapacity: 1,
    everySeconds: 0,
    skill: 'building',
  },

  // ---- Age 2: stone -------------------------------------------------------

  {
    id: 'quarry',
    name: 'Quarry',
    icon: '⛏️',
    age: 2,
    blurb: 'A face of rock you have cut into, open to the weather.',
    minSize: 4,
    maxSize: 16,
    cost: {},
    requires: [
      {
        id: 'rock',
        test: (ctx) => count(ctx, [STONE, COBBLE]) >= 24,
        say: (ctx) => `Needs ${24 - count(ctx, [STONE, COBBLE])} more stone showing — dig down to the rock`,
      },
      {
        // A quarry is a hole in something. Without this, a flat patch of
        // untouched stone counts, and the building does no work to earn it.
        id: 'cut',
        test: (ctx) => ctx.countOf(0) >= 8,
        say: () => 'Nothing has been cut out of it yet — break some of the rock',
      },
      {
        id: 'sky',
        test: (ctx) => ctx.openSkyColumns() >= 4,
        say: () => 'It needs to be open to the sky — you are underground here',
      },
    ],
    produces: { stone: 5, cobblestone: 2 },
    everySeconds: 70,
    skill: 'building',
  },

  // ---- Age 3: fire --------------------------------------------------------

  {
    id: 'workshop',
    name: 'Workshop',
    icon: '🛠️',
    age: 3,
    blurb: 'A room with a bench in it. Stand here and you can make what your hands cannot.',
    minSize: 4,
    maxSize: 16,
    cost: {},
    requires: [
      {
        id: 'frame',
        test: (ctx) => count(ctx, [PLANKS, WOOD]) >= 28,
        say: (ctx) => `Needs ${28 - count(ctx, [PLANKS, WOOD])} more planks or wood in it`,
      },
      {
        id: 'floor',
        test: (ctx) => count(ctx, [STONE, COBBLE]) >= 9,
        say: (ctx) => `Needs ${9 - count(ctx, [STONE, COBBLE])} more stone for a floor that will take a spark`,
      },
      {
        id: 'shelter',
        test: (ctx) => ctx.shelteredVolume() >= 12,
        say: () => 'Needs a proper room — walls all round and a roof over it',
      },
    ],
    produces: {},
    everySeconds: 0,
    // The one building that is not a producer: it unlocks the recipes that
    // need somewhere to work, which you get by standing near it.
    station: 'workshop',
    skill: 'building',
  },

  {
    id: 'kiln',
    name: 'Kiln',
    icon: '🔥',
    age: 3,
    blurb: 'Earth and sand go in. Brick and glass come out.',
    minSize: 3,
    maxSize: 8,
    cost: { cobblestone: 6 },
    requires: [
      {
        id: 'shell',
        test: (ctx) => count(ctx, [COBBLE, BRICK, STONE]) >= 18,
        say: (ctx) => `Needs ${18 - count(ctx, [COBBLE, BRICK, STONE])} more stone or brick in the shell`,
      },
      {
        id: 'chamber',
        test: (ctx) => ctx.enclosedVolume() >= 2,
        say: () => 'Needs a sealed chamber inside to hold the heat',
      },
      {
        id: 'stock',
        test: (ctx) => ctx.hasWithin([SAND, DIRT], 6),
        say: () => 'Needs sand or earth within 6 blocks to feed it',
      },
    ],
    produces: { brick: 2, glass: 2 },
    everySeconds: 95,
    skill: 'building',
  },

  // ---- Age 4: people ------------------------------------------------------

  {
    id: 'market',
    name: 'Market',
    icon: '🏛️',
    age: 4,
    blurb: 'Somewhere the things your buildings make change hands.',
    minSize: 6,
    maxSize: 20,
    cost: { planks: 10 },
    requires: [
      {
        id: 'floor',
        test: (ctx) => count(ctx, [PLANKS, BRICK, STONE, COBBLE, MARBLE]) >= 36,
        say: (ctx) => `Needs ${36 - count(ctx, [PLANKS, BRICK, STONE, COBBLE, MARBLE])} more laid floor`,
      },
      {
        id: 'cover',
        test: (ctx) => ctx.shelteredVolume() >= 10,
        say: () => 'Needs stalls with something over them — a roof on posts is enough',
      },
      {
        id: 'town',
        // A market with nothing around it is a shed. This is the first rule in
        // the game about where a building sits rather than what it is made of,
        // which is why it looks outside the region: with `hasWithin` a market
        // built of planks satisfied a plank rule by existing.
        test: (ctx) => ctx.hasNeighbour([PLANKS, BRICK, GLASS, WOOD], 12),
        say: () => 'Build it among your town, not out in a field',
      },
    ],
    produces: { vegetables: 3, fruit: 2, planks: 4 },
    everySeconds: 85,
    skill: 'politics',
  },

  // ---- Age 5: depth -------------------------------------------------------

  {
    id: 'mine',
    name: 'Mine',
    icon: '⚒️',
    age: 5,
    blurb: 'Everything easy is above ground. This is not above ground.',
    minSize: 4,
    maxSize: 16,
    cost: { planks: 8 },
    requires: [
      {
        id: 'depth',
        test: (ctx) => ctx.region.minY <= 12,
        say: (ctx) => `Too shallow — the floor has to reach y 12 or lower, and it is at ${ctx.region.minY}`,
      },
      {
        id: 'rock',
        test: (ctx) => count(ctx, [STONE, COBBLE]) >= 40,
        say: (ctx) => `Needs ${40 - count(ctx, [STONE, COBBLE])} more rock around the workings`,
      },
      {
        id: 'shaft',
        test: (ctx) => ctx.countOf(0) >= 16,
        say: () => 'Needs a shaft cut into it — break more of the rock out',
      },
      {
        id: 'props',
        test: (ctx) => count(ctx, [PLANKS, WOOD]) >= 8,
        say: (ctx) => `Needs ${8 - count(ctx, [PLANKS, WOOD])} more timber to hold the roof up`,
      },
    ],
    produces: { stone: 8, gold: 1 },
    everySeconds: 120,
    skill: 'building',
  },

  {
    id: 'granary',
    name: 'Granary',
    icon: '🌽',
    age: 5,
    blurb: 'A dry room full of what the farms grew, so a bad season is not a crisis.',
    minSize: 4,
    maxSize: 12,
    cost: { vegetables: 8 },
    requires: [
      {
        id: 'walls',
        test: (ctx) => count(ctx, [PLANKS, BRICK]) >= 30,
        say: (ctx) => `Needs ${30 - count(ctx, [PLANKS, BRICK])} more planks or brick — it has to stay dry`,
      },
      {
        id: 'store',
        test: (ctx) => ctx.shelteredVolume() >= 16,
        say: () => 'The room inside is too small to hold a season',
      },
      {
        id: 'fields',
        test: (ctx) => ctx.hasWithin([FARMLAND], 16),
        say: () => 'Build it near the fields it is meant to serve',
      },
    ],
    produces: { vegetables: 6, seeds: 3 },
    everySeconds: 90,
    skill: 'foraging',
  },

  // ---- Age 6: the last thing ---------------------------------------------

  {
    id: 'monument',
    name: 'Monument',
    icon: '🗿',
    age: 6,
    blurb: 'Nothing useful. That is the point of it.',
    minSize: 7,
    maxSize: 24,
    cost: { gold: 4 },
    requires: [
      {
        id: 'stone',
        test: (ctx) => count(ctx, [MARBLE, GOLD, BRICK]) >= 60,
        say: (ctx) => `Needs ${60 - count(ctx, [MARBLE, GOLD, BRICK])} more marble, gold or brick — this one is meant to be expensive`,
      },
      {
        id: 'height',
        test: (ctx) => ctx.region.maxY - ctx.region.minY + 1 >= 8,
        say: (ctx) => `Needs to stand at least 8 blocks tall — yours is ${ctx.region.maxY - ctx.region.minY + 1}`,
      },
      {
        id: 'sky',
        test: (ctx) => ctx.openSkyColumns() >= 9,
        say: () => 'It has to be seen — nothing built over the top of it',
      },
    ],
    produces: {},
    everySeconds: 0,
    skill: 'politics',
  },
];

export const STRUCTURES_BY_ID = new Map(STRUCTURES.map((s) => [s.id, s]));

export function structuresForAge(age) {
  return STRUCTURES.filter((s) => s.age <= age);
}

export function structureName(id) {
  return STRUCTURES_BY_ID.get(id)?.name ?? id;
}
