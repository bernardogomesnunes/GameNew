import { AGES } from './ages.js';
import { STRUCTURES_BY_ID } from './structures.js';
import { SECRETS } from './secrets.js';

/**
 * The goals, which are also how the game teaches itself.
 *
 * There was a How to play panel: six tabs of prose nobody opens twice, sitting
 * beside a list of achievements about placing a hundred blocks. Two halves of
 * the same job done separately and neither done well — the prose told you what
 * the buttons were, and the achievements rewarded you for things the game does
 * not actually care whether you do.
 *
 * So the prose is gone and this is the teaching. The shape is the world's own
 * shape: one band per age, each naming the handful of things that age is
 * about. Read top to bottom it is what to do next, in order, for as long as
 * there is a next thing — starting with the things that actually move the
 * border: "1. Build a forest, 2. Break ground on a farm, 3. Build yourself a
 * house" is Age 1's own goals from ages.js, numbered here rather than left
 * to a toast you saw once when you arrived and never again. requiredGoals()
 * below generates those from AGES.goals instead of restating them, so a
 * building added to an age's goals shows up here counted and numbered with
 * nothing else to remember. What is NOT listed is a card for reaching the
 * next age itself — the border growing is something you watch happen, not a
 * trophy for the thing you just watched happen. That is a different claim
 * from "list what it took to get there", which is what the required ones do.
 *
 * How to read one:
 *
 *   id           what the save records as unlocked
 *   age          which band it sits in
 *   required     true for one of Age N's own goals — it already gates the
 *                border in DuiltGame.ageComplete, which tests the same
 *                goals from ages.js directly rather than through here, so
 *                the one thing that must never be wrong about them is not
 *                routed through the achievement-unlock bookkeeping at all.
 *                Absent (falsy) for a teaching goal alongside it.
 *   name         the goal, as an instruction where it can be
 *   description  what to actually do
 *   icon         one emoji, for the card
 *   xpReward     what it pays
 *   check        a predicate over { stats, event, duilt }; see
 *                GamificationEngine.ctx. `duilt` is the live settlement,
 *                null outside a Duilt world — which is exactly when a
 *                required goal has nothing to test and stays undone.
 *   progress     optional; a "3/6" string over the same context, or null
 *                when a goal is a single yes/no rather than a count.
 */

/** The goals that teach the verbs, in the order a new player meets them. */
const OPENING = [
  {
    id: 'first_break',
    age: 1,
    name: 'Take something apart',
    description: 'Break a block. Whatever it was goes into your bag.',
    icon: '⛏️',
    xpReward: 10,
    check: (c) => c.stats.totalBlocksBroken >= 1,
  },
  {
    id: 'first_place',
    age: 1,
    name: 'Put it back',
    description: 'Place a block out of your bag.',
    icon: '🧱',
    xpReward: 10,
    check: (c) => c.stats.totalBlocksPlaced >= 1,
  },
  {
    id: 'first_walls',
    age: 1,
    name: 'Four walls',
    description: 'Place 40 blocks. A room you can stand in is about that many.',
    icon: '🏠',
    xpReward: 30,
    check: (c) => c.stats.totalBlocksPlaced >= 40,
    // Counting where you are: reported directly that this "does not count",
    // when it did — there was nothing on the card to show it moving.
    progress: (c) => `${Math.min(c.stats.totalBlocksPlaced, 40)}/40`,
  },
  {
    id: 'first_roof',
    age: 1,
    name: 'Something over your head',
    description: 'Point at what you built and put a roof on it.',
    icon: '🏘️',
    xpReward: 40,
    check: (c) => c.stats.totalBlocksPlaced >= 100,
    progress: (c) => `${Math.min(c.stats.totalBlocksPlaced, 100)}/100`,
  },
  {
    id: 'first_claim',
    age: 1,
    name: 'Make it a building',
    description: 'Point at what you built and claim it. A claimed building works on its own.',
    icon: '📐',
    xpReward: 60,
    check: (c) => c.stats.claimedCount >= 1,
  },
  {
    id: 'first_settler',
    age: 1,
    name: 'Somebody moves in',
    description: 'Put up a second house. The first one is yours; every one after brings somebody.',
    icon: '👤',
    xpReward: 80,
    check: (c) => c.stats.settlersEver >= 1,
  },
];

/** The goals that are about running the place rather than starting it. */
const LATER = [
  // The building ladder, the market's traders and their coins (the batch:
  // "level up farms and buildings as a whole", the goblin traders, coins).
  {
    id: 'first_evolve',
    age: 2,
    name: 'Look after it',
    description: 'Evolve a building a level: give it what its next level asks for — lights, a chest — and press Evolve in its pop-up.',
    icon: '⬆️',
    xpReward: 60,
    check: (c) => c.event?.type === 'upgraded',
  },
  {
    id: 'coin_purse',
    age: 4,
    name: 'A full purse',
    description: 'Hold twenty coins. Strike them at a foundry from gold or copper, or find them in old chests.',
    icon: '🪙',
    xpReward: 80,
    check: (c) => (c.duilt?.inventory?.countOf('coin') ?? 0) >= 20,
    progress: (c) => (c.duilt ? `${Math.min(20, c.duilt.inventory.countOf('coin'))}/20` : null),
  },
  {
    id: 'first_trade',
    age: 4,
    name: 'Strike a bargain',
    description: 'Buy something from the goblin who keeps your market. Point at them and tap.',
    icon: '🤝',
    xpReward: 80,
    check: (c) => c.event?.type === 'bought',
  },
  {
    id: 'market_town',
    age: 5,
    name: 'A market town',
    description: 'Evolve a market until all four traders live in it — stone, steel, glass and seed.',
    icon: '🏪',
    xpReward: 200,
    check: (c) => (c.duilt?.marketTraders?.().length ?? 0) >= 4,
  },
  {
    id: 'renowned',
    age: 5,
    name: 'Known across the land',
    description: 'Take any building to Renowned, the top of its ladder.',
    icon: '🌟',
    xpReward: 250,
    check: (c) => c.event?.type === 'upgraded'
      && STRUCTURES_BY_ID.get(c.event.structure?.type)?.tiers?.[c.event.structure.tier ?? 0]?.id === 'renowned',
  },
  {
    id: 'three_kinds',
    age: 2,
    name: 'Three different buildings',
    description: 'Claim three kinds of building. Each one makes something the next one needs.',
    icon: '🏗️',
    xpReward: 80,
    check: (c) => c.stats.claimed.size >= 3,
  },
  // Backlog batch 2: the University, and what studying there opens up.
  {
    id: 'a_university',
    age: 3,
    structure: 'university',
    name: 'Found a university',
    description: 'A room with two tables in it, walls and a roof. Study there to raise your skills — and learn engineering.',
    icon: '🎓',
    xpReward: 80,
    check: (c) => c.stats.claimed.has('university'),
  },
  {
    id: 'a_engineering',
    age: 3,
    structure: 'engineering',
    name: 'Raise an Engineering Centre',
    description: 'Learn engineering at your university, then build a hall with a stone floor and claim it.',
    icon: '⚙️',
    xpReward: 100,
    check: (c) => c.stats.claimed.has('engineering'),
  },
  {
    id: 'a_townhall',
    age: 4,
    structure: 'townhall',
    name: 'Raise a town hall',
    description: 'A stone-floored hall with four windows and a bell tower, among your town. It hands you a storage controller: every storehouse in one list.',
    icon: '🔔',
    xpReward: 120,
    check: (c) => c.stats.claimed.has('townhall'),
  },
  {
    id: 'a_pen',
    age: 2,
    structure: 'pen', // the goal that sends you to it — see ages.test.mjs
    name: 'Keep animals',
    description: 'Fence a pen with a gate, lead farm animals in with food in your hand, and claim it.',
    icon: '🐑',
    xpReward: 80,
    check: (c) => c.stats.claimed.has('pen'),
  },
  {
    id: 'a_shrine',
    age: 3,
    structure: 'temple', // the goal that sends you to it — see ages.test.mjs
    name: 'A place to pray',
    description: 'Raise a shrine — an altar, a light and a roof over them. Build it up, and at the top it forges a ring.',
    icon: '⛪',
    xpReward: 100,
    check: (c) => c.stats.claimed.has('temple'),
  },
  {
    id: 'a_sanctuary_white',
    age: 3,
    structure: 'sanctuary_white',
    name: 'The stag of light',
    description: 'Bear the White Ring and raise the White Sanctuary. Its guardian comes to you.',
    icon: '🕊️',
    xpReward: 200,
    check: (c) => c.stats.claimed.has('sanctuary_white'),
  },
  {
    id: 'a_sanctuary_black',
    age: 3,
    structure: 'sanctuary_black',
    name: 'The beast of shadow',
    description: 'Bear the Black Ring and raise the Black Sanctuary. Its guardian comes to you.',
    icon: '🕳️',
    xpReward: 200,
    check: (c) => c.stats.claimed.has('sanctuary_black'),
  },
  // The defence buildings (White path): what to raise before the war comes.
  {
    id: 'a_wall', age: 5, structure: 'wall', name: 'Walls that could hold',
    description: 'Raise a stretch of stone wall with battlements, and claim it. Claimed, each block takes three blows to break.',
    icon: '🧱', xpReward: 150, check: (c) => c.stats.claimed.has('wall'),
  },
  {
    id: 'a_gatehouse', age: 5, structure: 'gatehouse', name: 'A gate in the wall',
    description: 'Raise a gatehouse — two towers and a gate between them. It shuts itself when a round of the war is coming.',
    icon: '🏰', xpReward: 200, check: (c) => c.stats.claimed.has('gatehouse'),
  },
  {
    id: 'a_watchtower', age: 5, structure: 'watchtower', name: 'Eyes on the road',
    description: 'Raise a watchtower with a stair up to its lookout. Two archers keep watch from it.',
    icon: '🗼', xpReward: 200, check: (c) => c.stats.claimed.has('watchtower'),
  },
  {
    id: 'a_barracks', age: 5, structure: 'barracks', name: 'Soldiers of your own',
    description: 'Raise a barracks with bunks, arms and a yard to train in. Train soldiers there, a soldier a bunk.',
    icon: '⚔️', xpReward: 200, check: (c) => c.stats.claimed.has('barracks'),
  },
  {
    id: 'a_street',
    age: 2,
    name: 'A street of them',
    description: 'Claim six buildings.',
    icon: '🏙️',
    xpReward: 120,
    check: (c) => c.stats.claimedCount >= 6,
  },
  {
    id: 'a_crowd',
    age: 3,
    name: 'Five people living here',
    description: 'Houses bring settlers, and settlers work your buildings.',
    icon: '👥',
    xpReward: 150,
    check: (c) => c.stats.settlersEver >= 5,
  },
  {
    id: 'a_design',
    age: 3,
    name: 'Build it twice',
    description: 'Save something you built as a design, then stamp it somewhere else.',
    icon: '📋',
    xpReward: 90,
    check: (c) => c.stats.templatesPlaced >= 1,
  },
  {
    id: 'many_kinds',
    age: 4,
    name: 'One of everything',
    description: 'Claim six different kinds of building.',
    icon: '🗂️',
    xpReward: 200,
    check: (c) => c.stats.claimed.size >= 6,
  },
  {
    id: 'first_ore',
    age: 4,
    name: 'Something in the rock',
    description: 'Climb the one mountain tall enough to have it, and bring back iron, copper or gold ore.',
    icon: '⛏️',
    xpReward: 220,
    check: (c) => !!c.duilt
      && ['iron_ore', 'copper_ore', 'gold_ore'].some((id) => c.duilt.inventory?.countOf(id) >= 1),
  },
  {
    id: 'a_town',
    age: 5,
    name: 'Fifteen buildings',
    description: 'A settlement that would show up on a map.',
    icon: '🌆',
    xpReward: 300,
    check: (c) => c.stats.claimedCount >= 15,
  },
];

/**
 * Age N's own goals from ages.js, as achievements — "1. Build a forest,
 * 2. Break ground on a farm, 3. Build yourself a house" is Age 1's `goals`
 * array, read off rather than written out a second time. These are the ones
 * `required` is true for, and the ones a `progress` count comes from — see
 * the file doc comment above for why DuiltGame.ageComplete does not read
 * achievement-unlock state to ask the same question.
 */
function requiredGoals() {
  return AGES.flatMap((age) => age.goals.map((g, i) => {
    const spec = g.structure ? STRUCTURES_BY_ID.get(g.structure) : null;
    return {
      id: `req_${age.age}_${g.structure ?? i}`,
      age: age.age,
      required: true,
      name: g.label,
      description: spec ? spec.blurb : g.label,
      icon: spec?.icon ?? '🚩',
      xpReward: 30 * age.age,
      check: (c) => !!c.duilt && (g.structure
        ? c.duilt.structures.countOf(g.structure) >= (g.count ?? 1)
        : !!g.test?.(c.duilt)),
      progress: (c) => {
        if (!g.structure || (g.count ?? 1) <= 1 || !c.duilt) return null;
        return `${Math.min(c.duilt.structures.countOf(g.structure), g.count)}/${g.count}`;
      },
    };
  }));
}

// Required goals first within a band, then the teaching goals alongside
// them — Array.prototype.sort is stable, so a tie on `age` keeps whichever
// of the two came first here.
export const ACHIEVEMENTS = [
  ...[...requiredGoals(), ...OPENING, ...LATER].sort((x, y) => x.age - y.age),
  // The secrets (config/secrets.js) last, and in no age: never one of an
  // age's goals, never in its count — a band of their own in the panel.
  ...SECRETS,
];

export const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** The goals of one age, in the order they are meant to be met. */
export function achievementsForAge(age) {
  return ACHIEVEMENTS.filter((a) => a.age === age);
}

/** Every age that has goals, with its name — what the panel draws as bands. */
/** The secrets, for their own band at the bottom of the Goals tab. */
export function secretGoals() {
  return ACHIEVEMENTS.filter((a) => a.secret);
}

export function goalBands() {
  return AGES
    .map(({ age, name }) => ({ age, name, goals: achievementsForAge(age) }))
    .filter((b) => b.goals.length);
}
