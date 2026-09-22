import { AGES } from './ages.js';

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
 * there is a next thing.
 *
 * Reaching the next age isn't itself listed here — the border growing is
 * something you watch happen, not a card that congratulates you for it after
 * the fact. The bands still come from ages.js, so a new age with real goals
 * gets its own band without a line of this file changing.
 *
 * How to read one:
 *
 *   id           what the save records as unlocked
 *   age          which band it sits in
 *   name         the goal, as an instruction where it can be
 *   description  what to actually do
 *   icon         one emoji, for the card
 *   xpReward     what it pays
 *   check        a predicate over { stats, event }; see GamificationEngine
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
  },
  {
    id: 'first_roof',
    age: 1,
    name: 'Something over your head',
    description: 'Point at what you built and put a roof on it.',
    icon: '🏘️',
    xpReward: 40,
    check: (c) => c.stats.totalBlocksPlaced >= 100,
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
  {
    id: 'three_kinds',
    age: 2,
    name: 'Three different buildings',
    description: 'Claim three kinds of building. Each one makes something the next one needs.',
    icon: '🏗️',
    xpReward: 80,
    check: (c) => c.stats.claimed.size >= 3,
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
    id: 'a_town',
    age: 5,
    name: 'Fifteen buildings',
    description: 'A settlement that would show up on a map.',
    icon: '🌆',
    xpReward: 300,
    check: (c) => c.stats.claimedCount >= 15,
  },
];

export const ACHIEVEMENTS = [...OPENING, ...LATER].sort((x, y) => x.age - y.age);

export const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** The goals of one age, in the order they are meant to be met. */
export function achievementsForAge(age) {
  return ACHIEVEMENTS.filter((a) => a.age === age);
}

/** Every age that has goals, with its name — what the panel draws as bands. */
export function goalBands() {
  return AGES
    .map(({ age, name }) => ({ age, name, goals: achievementsForAge(age) }))
    .filter((b) => b.goals.length);
}
