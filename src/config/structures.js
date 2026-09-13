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

const GRASS = 1, DIRT = 2, WOOD = 4, LEAVES = 5, WATER = 11, SAPLING = 20, FARMLAND = 21;

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
    grantsCapacity: 4,
    everySeconds: 0,
    skill: 'building',
  },
];

export const STRUCTURES_BY_ID = new Map(STRUCTURES.map((s) => [s.id, s]));

export function structuresForAge(age) {
  return STRUCTURES.filter((s) => s.age <= age);
}

export function structureName(id) {
  return STRUCTURES_BY_ID.get(id)?.name ?? id;
}
