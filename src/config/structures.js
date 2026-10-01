import { CROPS, CROP_BASE } from './crops.js';
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
      SAPLING = 20, FARMLAND = 21, FENCE = 47, GATE = 48, GATE_OPEN = 49;

// The Temple's materials (Phase 7c) — see blocks.js for the ids.
const PILLARS = [165, 166, 167];
const STONEWORK = [STONE, COBBLE, BRICK, MARBLE, 156, 157, 158, 159, ...PILLARS];
const ALTARS = [32, GOLD, 180, 181];
const LIGHTS = [26, 85, 190];
const WINDOWS = [GLASS, 15, 16, 176, 177, 178, 179];
const GILDING = [159, GOLD];
const BANNERS = [182, 183, 184, 185, 186, 187, 188, 189];
// The Sanctuaries' (Phase 7d).
const WHITE_STONE = [MARBLE, 158, 159, 166];
const BLACK_STONE = [14, 156, 157, 167];

/** "1 more window", "3 more windows". */
const plural = (n, word) => `${n} more ${word}${n === 1 ? '' : 's'}`;

/** Every crop block, at every stage — see config/crops.js. */
const CROP_IDS = Array.from({ length: CROPS.length * 4 }, (_, i) => CROP_BASE + i);

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
    // Requested directly: no building should hand over more than 10-15 of
    // anything in a day. An 8-hour cycle keeps wood — the one item here
    // worth staying near the ceiling, since building genuinely eats it —
    // at 12 a day; the foraged extras riding the same cycle fall out at a
    // real trickle instead, which is what a standing forest should feel
    // like next to a claimed farm.
    produces: { wood: 4, leaves: 1, seeds: 1, fruit: 1 },
    everySeconds: 28800,
    skill: 'foraging',
  },

  {
    id: 'farm',
    name: 'Farm',
    icon: '🌾',
    age: 1,
    blurb: 'Turned soil beside fresh water, with crops growing in it. It makes whatever you planted.',
    minSize: 2,
    maxSize: 16,
    cost: { seeds: 2 },
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
      {
        // Requested directly: a farm "should have crops to plant there".
        id: 'crops',
        test: (ctx) => count(ctx, CROP_IDS) >= 4,
        say: (ctx) => `Needs ${4 - count(ctx, CROP_IDS)} more crops planted — put seeds in the farmland`,
      },
    ],
    // What it makes is what's growing in it — see duilt/Crops.js's
    // cropProduce. `produces` below is only what it's known for.
    fromCrops: true,
    // Requested directly: no building should hand over more than 10-15 of
    // anything in a day. A 2-hour cycle at one of each keeps a farm at a
    // dozen a day, not the twelve dozen a 12-minute cycle worked out to.
    produces: { vegetables: 1, seeds: 1, fruit: 1 },
    everySeconds: 7200,
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
    // Stone has fewer sinks than wood or food — you don't eat it, and most
    // recipes want a handful, not a steady stream — so it piled up faster
    // than anything else and, once storehouses filled, started eating bag
    // slots by the stack. A fresh scrape at the rock is worth barely
    // anything — ten stone a day, already under the 10-15/day ceiling
    // asked for across every building — and it is the levels below, not
    // the building itself, that turn it into something worth having
    // staffed, climbing toward that same ceiling rather than past it.
    produces: { stone: 1 },
    everySeconds: 8640,
    skill: 'building',
    /**
     * How a quarry grows — the first building to use the same ladder a
     * storehouse already climbs. `tiers` gives any building levels; a tier
     * with `slots` makes it a storehouse, a tier with `produces` and/or
     * `everySeconds` makes it a faster, richer producer instead. Nothing
     * else about the mechanism changes — see isStore/producesAt/intervalAt
     * in this file and StructureRegistry.retier/collect.
     *
     * Climbed by building, exactly like a storehouse: cut the face back
     * further and the level follows, with nothing to press and nothing to
     * strip back down to once it has.
     */
    // Requested directly: no building should hand over more than 10-15 of
    // anything in a day. Each rung still climbs — both in what a cycle
    // pays and in how often one runs — but stone tops out at fifteen a
    // day even at the last rung, not the 480 the old flat 8-per-120s rate
    // worked out to.
    tiers: [
      { id: 'seam', name: 'A Seam Cut', blurb: 'A scrape at the rock. Barely worth the walk.', needs: [] },
      {
        id: 'face', name: 'A Working Face', blurb: 'Wide enough to work properly.',
        produces: { stone: 1, cobblestone: 1 }, everySeconds: 10800,
        needs: [
          { test: (ctx) => count(ctx, [STONE, COBBLE]) >= 40, say: (ctx) => `${40 - count(ctx, [STONE, COBBLE])} more stone showing` },
          { test: (ctx) => ctx.countOf(0) >= 16, say: (ctx) => `${16 - ctx.countOf(0)} more cut out of it` },
        ],
      },
      {
        id: 'deepcut', name: 'A Deep Cut', blurb: 'Cut back far enough to keep two haulers busy.',
        produces: { stone: 2, cobblestone: 1 }, everySeconds: 14400,
        needs: [
          { test: (ctx) => count(ctx, [STONE, COBBLE]) >= 60, say: (ctx) => `${60 - count(ctx, [STONE, COBBLE])} more stone showing` },
          { test: (ctx) => ctx.countOf(0) >= 28, say: (ctx) => `${28 - ctx.countOf(0)} more cut out of it` },
        ],
      },
      {
        id: 'quarryface', name: 'A Quarry Face', blurb: 'A proper face of rock, opened right up.',
        produces: { stone: 2, cobblestone: 2 }, everySeconds: 14400,
        needs: [
          { test: (ctx) => count(ctx, [STONE, COBBLE]) >= 90, say: (ctx) => `${90 - count(ctx, [STONE, COBBLE])} more stone showing` },
          { test: (ctx) => ctx.countOf(0) >= 44, say: (ctx) => `${44 - ctx.countOf(0)} more cut out of it` },
        ],
      },
      {
        id: 'openpit', name: 'An Open Pit', blurb: 'As much rock as a claim this size can show.',
        produces: { stone: 3, cobblestone: 2 }, everySeconds: 17280,
        needs: [
          { test: (ctx) => count(ctx, [STONE, COBBLE]) >= 130, say: (ctx) => `${130 - count(ctx, [STONE, COBBLE])} more stone showing` },
          { test: (ctx) => ctx.countOf(0) >= 64, say: (ctx) => `${64 - ctx.countOf(0)} more cut out of it` },
        ],
      },
    ],
  },

  {
    id: 'pen',
    name: 'Pen',
    icon: '🐑',
    age: 2,
    blurb: 'A fence with a gate, and animals inside it. Lead them in with food in your hand, then shut the gate.',
    minSize: 3,
    maxSize: 16,
    cost: {},
    requires: [
      {
        id: 'fenced',
        test: (ctx) => count(ctx, [FENCE, GATE, GATE_OPEN]) >= 8,
        say: (ctx) => `Needs ${8 - count(ctx, [FENCE, GATE, GATE_OPEN])} more fence round it — it has to hold them`,
      },
      {
        id: 'gate',
        test: (ctx) => count(ctx, [GATE, GATE_OPEN]) >= 1,
        say: () => 'Needs a gate — a way in that you can shut behind them',
      },
    ],
    // What it gives is decided by what lives in it, not by a list here: see
    // duilt/Ranch.js — eggs from hens, wool from sheep, milk from cows, meat
    // from pigs, one per animal a cycle up to two of each. Six cycles a day
    // keeps any one of them at the 10-15/day ceiling every building keeps to.
    produces: {},
    fromAnimals: true,
    everySeconds: 14400,
    skill: 'foraging',
  },

  {
    id: 'storehouse',
    name: 'Storehouse',
    icon: '📦',
    age: 2,
    blurb: 'Shelves that are not your back. Build it bigger and it holds more.',
    minSize: 3,
    maxSize: 16,
    cost: {},
    requires: [
      {
        id: 'shell',
        test: (ctx) => count(ctx, [PLANKS, WOOD]) >= 20,
        say: (ctx) => `Needs ${20 - count(ctx, [PLANKS, WOOD])} more planks or wood — it has to keep the rain off`,
      },
      {
        id: 'room',
        test: (ctx) => ctx.shelteredVolume() >= 6,
        say: (ctx) => ctx.shelteredVolume() === 0
          ? 'Needs a room inside — walls all round and a roof over the top'
          : 'The room is too small to put anything in',
      },
    ],
    produces: {},
    everySeconds: 0,
    /**
     * How a storehouse grows.
     *
     * `tiers` is what makes a building hold things at all: the registry gives
     * anything with tiers a container, production delivers into it, and the
     * panel opens it. Give another building a `tiers` and it becomes a
     * storehouse too, without a line of code anywhere else.
     *
     * The rungs are climbed by building, not by pressing an upgrade button.
     * That is the whole point in a game where you place blocks: you want more
     * room, so you go and make the shed bigger, and the game notices. It is
     * re-read whenever the blocks change, which also means it cannot be
     * cheated by building a warehouse and then stripping it back to a shed —
     * the shelves come off again as soon as they are empty enough to.
     *
     * Tier 0 is the building as claimed and asks for nothing beyond the
     * `requires` above. Each rung after it adds its own tests, and they are a
     * ladder: failing one stops the climb rather than skipping it.
     */
    tiers: [
      {
        id: 'shelves',
        name: 'Shelves',
        // Requested directly: room for around 200 in the storehouse. Kept
        // as a ladder rather than the same number at every rung — the
        // point of building it bigger is still that it holds more — just
        // all three rungs now sit in that neighbourhood instead of a shed
        // that outgrew everything a building could actually pay out.
        slots: 200,
        blurb: 'A shed with a few shelves in it.',
        needs: [],
      },
      {
        id: 'loft',
        name: 'Loft',
        slots: 240,
        blurb: 'Room overhead as well as around, so more goes in.',
        needs: [
          {
            test: (ctx) => count(ctx, [PLANKS, WOOD]) >= 60,
            say: (ctx) => `${60 - count(ctx, [PLANKS, WOOD])} more planks or wood`,
          },
          {
            test: (ctx) => ctx.shelteredVolume() >= 18,
            say: (ctx) => `a bigger room inside — ${18 - ctx.shelteredVolume()} more cells of it`,
          },
        ],
      },
      {
        id: 'warehouse',
        name: 'Warehouse',
        slots: 280,
        blurb: 'A hard floor and a proper span. Everything you own fits in here.',
        needs: [
          {
            test: (ctx) => count(ctx, [PLANKS, WOOD, BRICK]) >= 140,
            say: (ctx) => `${140 - count(ctx, [PLANKS, WOOD, BRICK])} more planks, wood or brick`,
          },
          {
            test: (ctx) => count(ctx, [STONE, COBBLE, BRICK]) >= 25,
            say: (ctx) => `${25 - count(ctx, [STONE, COBBLE, BRICK])} more stone or brick, for a floor that will take the weight`,
          },
          {
            test: (ctx) => ctx.shelteredVolume() >= 40,
            say: (ctx) => `a much bigger room — ${40 - ctx.shelteredVolume()} more cells of it`,
          },
        ],
      },
    ],
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
    // Requested directly: no building should hand over more than 10-15 of
    // anything in a day. A 2-hour cycle keeps both at a dozen, not the
    // near-300 a 300-second cycle worked out to.
    produces: { brick: 1, glass: 1 },
    everySeconds: 7200,
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
    // Requested directly: no building should hand over more than 10-15 of
    // anything in a day — see the farm's own note above for the same fix.
    produces: { vegetables: 1, fruit: 1, planks: 1 },
    everySeconds: 7200,
    skill: 'politics',
  },

  // Two buildings a town grows into rather than needs — nothing in Age 4's
  // goals asks for either of them, the way nothing ever asked for a second
  // kiln. They exist for what they give back once you want it.

  {
    id: 'townhouse',
    name: 'Townhouse',
    icon: '🏘️',
    age: 4,
    blurb: 'More roof than one family needs, so more than one family lives under it.',
    minSize: 6,
    maxSize: 16,
    cost: { planks: 16 },
    requires: [
      {
        id: 'walls',
        // Finished material rather than a house's raw wood — three households
        // expect better than the first roof you ever put up.
        test: (ctx) => count(ctx, [PLANKS, BRICK]) >= 44,
        say: (ctx) => `Needs ${44 - count(ctx, [PLANKS, BRICK])} more planks or brick in the walls`,
      },
      {
        id: 'floor',
        test: (ctx) => count(ctx, [STONE, COBBLE, BRICK]) >= 14,
        say: (ctx) => `Needs ${14 - count(ctx, [STONE, COBBLE, BRICK])} more stone, cobble or brick — more feet than one family's worth`,
      },
      {
        id: 'shelter',
        test: (ctx) => ctx.shelteredVolume() >= 20,
        say: (ctx) => ctx.shelteredVolume() === 0
          ? 'Needs rooms inside — walls all round and a roof over the top'
          : 'The rooms are too small — this has to hold three households, not one',
      },
    ],
    produces: {},
    // Three roofs folded into one building, so a townhouse is what you raise
    // once "build another house" stops being the interesting problem.
    grantsCapacity: 3,
    everySeconds: 0,
    skill: 'politics',
  },

  {
    id: 'tavern',
    name: 'Tavern',
    icon: '🍻',
    age: 4,
    blurb: 'Somewhere to eat, drink and hear the news. Small coin changes hands too.',
    minSize: 5,
    maxSize: 14,
    cost: { planks: 8, brick: 4 },
    requires: [
      {
        id: 'walls',
        test: (ctx) => count(ctx, [PLANKS, WOOD, BRICK]) >= 30,
        say: (ctx) => `Needs ${30 - count(ctx, [PLANKS, WOOD, BRICK])} more planks, wood or brick in it`,
      },
      {
        id: 'hearth',
        test: (ctx) => count(ctx, [BRICK, STONE, COBBLE]) >= 10,
        say: (ctx) => `Needs ${10 - count(ctx, [BRICK, STONE, COBBLE])} more stone, cobble or brick for a hearth`,
      },
      {
        id: 'shelter',
        test: (ctx) => ctx.shelteredVolume() >= 12,
        say: () => 'Needs a proper room — walls all round and a roof over it',
      },
      {
        id: 'town',
        test: (ctx) => ctx.hasNeighbour([PLANKS, BRICK, GLASS, WOOD], 12),
        say: () => 'Build it among your town, not out in a field',
      },
    ],
    // A trickle, not an income — a mine works a claim for it, this just
    // keeps a jar behind the counter. Requested directly: no building
    // should hand over more than 10-15 of anything in a day, gold
    // included — a 2h24m cycle keeps the jar at ten a day rather than the
    // 240 a 360-second cycle worked out to.
    produces: { gold: 1 },
    everySeconds: 8640,
    skill: 'politics',
  },

  {
    id: 'foundry',
    name: 'Foundry',
    icon: '🔥',
    age: 4,
    blurb: 'A hotter fire than the kiln keeps — hot enough to run ore.',
    minSize: 4,
    maxSize: 12,
    cost: { cobblestone: 8 },
    requires: [
      {
        id: 'shell',
        test: (ctx) => count(ctx, [STONE, COBBLE, BRICK]) >= 26,
        say: (ctx) => `Needs ${26 - count(ctx, [STONE, COBBLE, BRICK])} more stone or brick in the shell — the fire has to hold`,
      },
      {
        // A bigger, hotter chamber than the kiln's own two cells — this is
        // meant to be the building you raise once the kiln, not the one
        // you raise instead of it.
        id: 'chamber',
        test: (ctx) => ctx.enclosedVolume() >= 3,
        say: () => 'Needs a bigger sealed chamber than the kiln\'s — this fire runs hotter',
      },
      {
        id: 'town',
        test: (ctx) => ctx.hasNeighbour([PLANKS, BRICK, GLASS, WOOD], 12),
        say: () => 'Build it among your town, not out at the ore face',
      },
    ],
    // Nothing on a timer: what a foundry gives back is standing near it with
    // ore in your bag, at the workbench — see config/recipes.js's smelt_iron
    // and its neighbours. The same shape Workshop already is.
    produces: {},
    everySeconds: 0,
    station: 'foundry',
    skill: 'building',
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
    // Requested directly: no building should hand over more than 10-15 of
    // anything in a day. At ten stone a day this also still sits under a
    // maxed quarry's own fifteen (see quarry's produces note) — a mine
    // going straight down was never meant to out-produce a quarry that
    // actually worked its way up to it.
    produces: { stone: 1, gold: 1 },
    everySeconds: 8640,
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
    // Requested directly: no building should hand over more than 10-15 of
    // anything in a day — see the farm's own note above for the same fix.
    produces: { vegetables: 1, seeds: 1 },
    everySeconds: 7200,
    skill: 'foraging',
  },

  {
    id: 'military',
    name: 'Garrison',
    icon: '🛡️',
    age: 5,
    blurb: 'Walls with people behind them. Nothing has tested them yet, and that is rather the point.',
    minSize: 6,
    maxSize: 18,
    cost: { stone: 20, planks: 10 },
    requires: [
      {
        id: 'walls',
        test: (ctx) => count(ctx, [STONE, COBBLE, BRICK]) >= 50,
        say: (ctx) => `Needs ${50 - count(ctx, [STONE, COBBLE, BRICK])} more stone, cobble or brick in the walls — this has to hold`,
      },
      {
        id: 'watch',
        test: (ctx) => ctx.region.maxY - ctx.region.minY + 1 >= 5,
        say: (ctx) => `Needs to stand at least 5 blocks tall to see anything coming — yours is ${ctx.region.maxY - ctx.region.minY + 1}`,
      },
      {
        id: 'barracks',
        test: (ctx) => ctx.shelteredVolume() >= 14,
        say: () => 'Needs a barracks inside — walls all round and a roof over it',
      },
      {
        id: 'sky',
        test: (ctx) => ctx.openSkyColumns() >= 4,
        say: () => 'The watch needs open sky above it — nothing built over the top',
      },
    ],
    // What a standing garrison brings back with nothing yet to defend
    // against: patrols that forage and salvage as they go. The building is
    // deliberately plain — a normal producer, on the same footing as
    // everything else here — so that whatever it should do once there is
    // something to defend *against* can be added to this one entry later
    // without moving anything that depends on it. Requested directly: no
    // building should hand over more than 10-15 of anything in a day.
    produces: { stone: 1, planks: 1 },
    everySeconds: 7200,
    skill: 'politics',
  },

  // ---- Age 6: the last thing ---------------------------------------------

  {
    id: 'village',
    name: 'Village',
    icon: '🏡',
    age: 6,
    blurb: 'A forest, a farm, housing and a shed, folded into one claim — everything a start needs, raised at once.',
    minSize: 14,
    maxSize: 28,
    cost: { wood: 20, seeds: 8 },
    requires: [
      {
        id: 'trunks',
        test: (ctx) => count(ctx, [WOOD]) >= 24,
        say: (ctx) => `Needs ${24 - count(ctx, [WOOD])} more wood — a village needs a woodlot, not a tree`,
      },
      {
        id: 'canopy',
        test: (ctx) => count(ctx, [LEAVES]) >= 30,
        say: (ctx) => `Needs ${30 - count(ctx, [LEAVES])} more leaves in the canopy`,
      },
      {
        id: 'tilled',
        test: (ctx) => count(ctx, [FARMLAND]) >= 8,
        say: (ctx) => `Needs ${8 - count(ctx, [FARMLAND])} more tilled soil — the fields are too small`,
      },
      {
        id: 'water',
        test: (ctx) => ctx.hasWithin([WATER], 8),
        say: () => 'Needs fresh water within 8 blocks — build nearer the river',
      },
      {
        id: 'walls',
        test: (ctx) => count(ctx, [WOOD, PLANKS]) >= 60,
        say: (ctx) => `Needs ${60 - count(ctx, [WOOD, PLANKS])} more wood or planks — three households' worth of walls`,
      },
      {
        id: 'housing',
        test: (ctx) => ctx.shelteredVolume() >= 40,
        say: (ctx) => ctx.shelteredVolume() === 0
          ? 'Needs real rooms inside — walls all round and roofs over them'
          : 'Not enough room under roof yet — housing for three households and a shed, not one',
      },
      {
        id: 'soil',
        test: (ctx) => count(ctx, [DIRT, GRASS, SAPLING]) >= 12,
        say: () => 'Needs more open soil between the trees and the fields',
      },
    ],
    // The forest and the farm folded in, at a fraction of what either gives
    // alone — the point of a village is the housing, not out-earning the
    // buildings it is standing in for. Requested directly: no building
    // should hand over more than 10-15 of anything in a day, so wood — the
    // one item here worth staying near that ceiling — tops out at fifteen,
    // with the rest a real trickle alongside it.
    produces: { wood: 3, leaves: 1, vegetables: 1, seeds: 1 },
    grantsCapacity: 3,
    everySeconds: 17280,
    skill: 'building',
  },

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

  // ---- Phase 7c: the Temple ------------------------------------------------
  //
  // A place of worship, from Age 3 (docs/plan-phase7-lore.md). It makes
  // devotion — slowly by itself, faster with settlers who worship there
  // (the same staffing every building has), and from offerings you bring it
  // (recipes at the temple: food, gold, a lantern). It climbs from a Shrine
  // to a High Temple by building it up, and each rung asks devotion too.
  // At the top it forges a ring: the White or the Black — one, for good.
  {
    id: 'temple',
    name: 'Temple',
    icon: '⛪',
    age: 3,
    blurb: 'Somewhere to pray. Offerings and worshippers turn into devotion, and devotion into blessings.',
    minSize: 4,
    maxSize: 20,
    cost: { gold: 1 },
    station: 'temple',
    requires: [
      {
        id: 'stone',
        test: (ctx) => count(ctx, STONEWORK) >= 16,
        say: (ctx) => `Needs ${16 - count(ctx, STONEWORK)} more stone, marble or brick — a temple is built to last`,
      },
      {
        id: 'altar',
        test: (ctx) => count(ctx, ALTARS) >= 1,
        say: () => 'Needs an altar — a marble table, a vase, an urn or a block of gold',
      },
      {
        id: 'light',
        test: (ctx) => count(ctx, LIGHTS) >= 1,
        say: () => 'Needs a light to keep — a lantern or a chandelier',
      },
      {
        id: 'roof',
        test: (ctx) => ctx.shelteredVolume() >= 2,
        say: () => 'Needs a covered room round the altar',
      },
    ],
    produces: { devotion: 1 },
    everySeconds: 21600,
    skill: 'building',
    // Each rung is built, then paid for in devotion (`cost`, spent from your
    // bag when you evolve it — see StructureRegistry.evolve). The High
    // Temple is where a ring is forged (recipes.js, `tier: 4`).
    tiers: [
      { id: 'shrine', name: 'A Shrine', blurb: 'An altar, a light, and a roof over them.', needs: [] },
      {
        id: 'chapel', name: 'A Chapel', blurb: 'Light comes in through its windows now.',
        produces: { devotion: 1 }, everySeconds: 14400, cost: { devotion: 3 },
        needs: [
          { test: (ctx) => count(ctx, WINDOWS) >= 2, say: (ctx) => plural(2 - count(ctx, WINDOWS), 'window') },
          { test: (ctx) => count(ctx, LIGHTS) >= 2, say: (ctx) => plural(2 - count(ctx, LIGHTS), 'light') },
        ],
      },
      {
        id: 'temple', name: 'A Temple', blurb: 'Columns now, and room for a congregation.',
        produces: { devotion: 2 }, everySeconds: 21600, cost: { devotion: 8 },
        needs: [
          { test: (ctx) => count(ctx, PILLARS) >= 4, say: (ctx) => plural(4 - count(ctx, PILLARS), 'pillar') },
          { test: (ctx) => count(ctx, STONEWORK) >= 60, say: (ctx) => `${60 - count(ctx, STONEWORK)} more stonework` },
        ],
      },
      {
        id: 'great', name: 'A Great Temple', blurb: 'Gold on the stone, and light enough to read by at night.',
        produces: { devotion: 2 }, everySeconds: 14400, cost: { devotion: 15 },
        needs: [
          { test: (ctx) => count(ctx, PILLARS) >= 8, say: (ctx) => plural(8 - count(ctx, PILLARS), 'pillar') },
          { test: (ctx) => count(ctx, GILDING) >= 4, say: (ctx) => `${4 - count(ctx, GILDING)} more gold trim or gold` },
          { test: (ctx) => count(ctx, LIGHTS) >= 4, say: (ctx) => plural(4 - count(ctx, LIGHTS), 'light') },
        ],
      },
      {
        id: 'high', name: 'The High Temple', blurb: 'Banners hang in it. Here the rings are forged — the White, or the Black.',
        produces: { devotion: 3 }, everySeconds: 21600, cost: { devotion: 25 },
        needs: [
          { test: (ctx) => count(ctx, BANNERS) >= 2, say: (ctx) => plural(2 - count(ctx, BANNERS), 'banner') },
          { test: (ctx) => count(ctx, GILDING) >= 8, say: (ctx) => `${8 - count(ctx, GILDING)} more gold trim or gold` },
          { test: (ctx) => count(ctx, PILLARS) >= 12, say: (ctx) => plural(12 - count(ctx, PILLARS), 'pillar') },
        ],
      },
    ],
  },

  // ---- Phase 7d: the Sanctuaries -------------------------------------------
  //
  // Only your god's can be raised — the one for the ring you forged at the
  // High Temple (`ring`; see DuiltGame.claim). Raising it summons the
  // guardian, tamed to you (world/Guardian.js).
  {
    id: 'sanctuary_white',
    name: 'White Sanctuary',
    icon: '🕊️',
    age: 3,
    ring: 'white',
    blurb: 'Open marble and light, under the sky. Raising it calls the white guardian — a great stag of light.',
    minSize: 5,
    maxSize: 16,
    cost: { devotion: 10 },
    requires: [
      {
        id: 'marble',
        test: (ctx) => count(ctx, WHITE_STONE) >= 30,
        say: (ctx) => `Needs ${30 - count(ctx, WHITE_STONE)} more marble, sky marble or gold trim`,
      },
      {
        id: 'light',
        test: (ctx) => count(ctx, LIGHTS) >= 4,
        say: (ctx) => `Needs ${plural(4 - count(ctx, LIGHTS), 'light')} — it is a place of light`,
      },
      {
        id: 'sky',
        test: (ctx) => ctx.openSkyColumns() >= 9,
        say: () => 'It has to stand open to the sky — nothing built over it',
      },
    ],
    produces: {},
    everySeconds: 0,
    skill: 'building',
  },
  {
    id: 'sanctuary_black',
    name: 'Black Sanctuary',
    icon: '🕳️',
    age: 3,
    ring: 'black',
    blurb: 'Obsidian round a pit. Raising it calls the black guardian — a beast of shadow.',
    minSize: 5,
    maxSize: 16,
    cost: { devotion: 10 },
    requires: [
      {
        id: 'obsidian',
        test: (ctx) => count(ctx, BLACK_STONE) >= 30,
        say: (ctx) => `Needs ${30 - count(ctx, BLACK_STONE)} more obsidian, dark stone or dark brick`,
      },
      {
        id: 'pit',
        test: (ctx) => ctx.countOf(0) >= 9,
        say: () => 'Needs a pit at its heart — dig out at least nine blocks of it',
      },
    ],
    produces: {},
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

/**
 * True for any building with a ladder of rungs to climb — a storehouse
 * growing its shelves, a quarry cutting a bigger face. `tiers` is the one
 * mechanism behind both; which kind a building is comes down to what its
 * rungs actually change, not to having rungs at all. See isStore below for
 * the narrower "does it hold things" question.
 */
export function hasLevels(spec) {
  return !!spec?.tiers?.length;
}

/** A tier index, clamped to the tiers a building actually has. */
function clampTier(spec, tier) {
  return Math.max(0, Math.min(tier, spec.tiers.length - 1));
}

/** True for a building that holds things — a tiers entry with `slots` on it. */
export function isStore(spec) {
  return hasLevels(spec) && spec.tiers.some((t) => t.slots != null);
}

/** How many slots a building has at a tier, clamped to the tiers it actually has. */
export function holdsAt(spec, tier = 0) {
  if (!isStore(spec)) return 0;
  return spec.tiers[clampTier(spec, tier)].slots;
}

/**
 * What a building actually hands over at a given tier.
 *
 * A tier with no `produces` of its own falls back to the building's base
 * rate — tier 0 never needs to repeat it, the same way a storehouse's first
 * tier repeats no `needs` because the claim already asked for them.
 */
export function producesAt(spec, tier = 0) {
  if (!hasLevels(spec)) return spec?.produces ?? {};
  return spec.tiers[clampTier(spec, tier)].produces ?? spec.produces ?? {};
}

/** How long a cycle takes at a given tier — see producesAt, same fallback. */
export function intervalAt(spec, tier = 0) {
  if (!hasLevels(spec)) return spec?.everySeconds ?? 0;
  return spec.tiers[clampTier(spec, tier)].everySeconds ?? spec.everySeconds ?? 0;
}

/**
 * Every item id any building ever hands over, at any tier, in the order a
 * building that makes it first appears.
 *
 * This is what a storehouse's "won't take" list is built from — read off the
 * registry rather than written out a second time, so a new building's output
 * is routable the moment it is added here, with nothing else to remember.
 */
export const PRODUCIBLE_ITEMS = [...new Set(STRUCTURES.flatMap((s) => [
  ...Object.keys(s.produces ?? {}),
  ...(s.tiers ?? []).flatMap((t) => Object.keys(t.produces ?? {})),
]))];
