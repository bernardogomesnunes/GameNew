/**
 * The arc of the game, from thirty-two blocks of land to a finished thing.
 *
 * Each age says how much land you hold, what you have to raise before the
 * border moves out, and one line of why. The goals are the game: everything
 * else — which buildings exist, what you can make, what the border looks like —
 * hangs off the age you are in.
 *
 * The land is a wall, not a suggestion: until the last age you can't walk
 * past your border, only grow it. That's the game — a place to make your
 * own, and an edge for an army to come over (asked for directly: "the main
 * goal of the game is to be locked in an area, or else it would be hard
 * for the army to appear"). So it grows every age, a little past the old
 * 256, and reaching the first open ring (WAR_AGE) does two things at
 * once: the wall comes down, so the world past it is yours to walk, and the
 * Stone Kingdom declares war on you (config/war.js) — whatever ring you bear.
 *
 * How to read one:
 *
 *   age     what the player is told they are in
 *   name    the ring's name, shown on the goal list and the border
 *   size    the claimed square, in blocks
 *   open    the border no longer stops you walking (it still bounds what
 *           you can build)
 *   intro   one line when the age begins — short enough for a phone's
 *           toast (about 140 characters), and kept in the Goals list; introDark instead, for an age
 *           that begins differently on the dark path (ageIntro)
 *   goals   what has to be true to move on — `structure` and `count`, or a
 *           `test` for anything that is not a building
 */

import { STRUCTURES_BY_ID } from './structures.js';

/** A building of yours, standing, `n` of them. */
const built = (structure, count = 1) => ({ structure, count });

/** How many buildings you have, of any kind. */
const buildings = (d) => d.structures.list().filter((s) => s.valid !== false).length;

/** The places out in the world you've found, by kind (DuiltGame.discover). */
const foundKind = (kind) => (d) => !!d.foundPlaces?.().some((p) => p.kind === kind);

/**
 * Twelve ages, asked for directly: "we need more ages to divide all this, and
 * increase the terrain available for building ... age 12", "3 goals per age
 * until age 5 and then we can go with 4", and "Age 1 should be teaching how
 * to play, like break tree, gather water, build a pick axe".
 *
 * Every goal in an age counts — an age is done when all of them are — and
 * none is a card you can tick from a later age early (achievements.js).
 * Ages 11 and 12 ask for what the game already has past the war; the new
 * stories of backlog batch 4 (docs/backlog-batch-4.md) will take their
 * places as they land.
 */
export const AGES = [
  {
    age: 1,
    name: 'Exile',
    size: 32,
    intro: 'Thrown down from the sky with nothing but an axe and a bucket. Chop a tree, fetch water, and make yourself a pickaxe.',
    goals: [
      { id: 'wood', label: 'Break a tree for wood', test: (d) => !!d.noted?.('wood') },
      { id: 'water', label: 'Fill your bucket with water', test: (d) => !!d.noted?.('water') },
      { id: 'pickaxe', label: 'Make a pickaxe', test: (d) => !!d.noted?.('pickaxe') },
    ],
  },
  {
    age: 2,
    name: 'Roots',
    size: 64,
    intro: 'There is no climbing back. Claim a forest, break ground on a farm, and build somewhere to sleep.',
    goals: [
      { ...built('forest'), label: 'Plant and claim a forest' },
      { ...built('farm'), label: 'Break ground on a farm' },
      { ...built('house'), label: 'Build yourself a house' },
    ],
  },
  {
    age: 3,
    name: 'Settle',
    size: 96,
    intro: 'Put roots down: open a quarry, raise a storehouse, and a second house — someone is coming.',
    goals: [
      { ...built('quarry'), label: 'Open a quarry' },
      // Where forty slots stop being enough — a quarry alone fills them.
      { ...built('storehouse'), label: 'Raise a storehouse — your bag is not big enough' },
      // The first house is yours; this one puts a person in the world.
      { ...built('house', 2), label: 'Build a second house — somebody moves in' },
    ],
  },
  {
    age: 4,
    name: 'Forge',
    size: 128,
    intro: 'Stone and fire: a workshop for what your hands cannot make, a kiln for brick and glass, and animals of your own.',
    goals: [
      { ...built('workshop'), label: 'Build a workshop' },
      { ...built('kiln'), label: 'Fire up a kiln' },
      { ...built('pen'), label: 'Keep animals in a pen' },
    ],
  },
  {
    age: 5,
    name: 'Hearth',
    size: 160,
    intro: 'Enough people to be a place. Raise a market, a tavern and a foundry, and hear travellers\' news of the two kingdoms.',
    goals: [
      { ...built('market'), label: 'Raise a market' },
      { ...built('tavern'), label: 'Raise a tavern' },
      { ...built('foundry'), label: 'Raise a foundry' },
    ],
  },
  {
    age: 6,
    name: 'Town',
    size: 192,
    intro: 'A town needs a hall, a place of learning, and homes for more than one family. Look after what you have built.',
    goals: [
      { ...built('townhouse'), label: 'Raise a townhouse — three households under one roof' },
      { ...built('university'), label: 'Found a university' },
      { ...built('townhall'), label: 'Raise a town hall' },
      { id: 'evolve', label: 'Evolve a building a level', test: (d) => d.structures.list().some((s) => (s.tier ?? 0) >= 1) },
    ],
  },
  {
    age: 7,
    name: 'Faith',
    size: 224,
    intro: 'Deep down, Sunstone and Nightstone wait. Raise a shrine, build it up, and at its height choose your god.',
    goals: [
      { ...built('temple'), label: 'Raise a shrine' },
      { ...built('engineering'), label: 'Raise an engineering centre' },
      { ...built('granary'), label: 'Fill a granary' },
      { id: 'ring', label: 'Forge a ring — choose your god', test: (d) => !!d.ring },
    ],
  },
  {
    age: 8,
    name: 'Bastion',
    size: 256,
    intro: 'The Stone Kingdom has heard of you. Drive a mine, raise a garrison and a barracks, and your god\'s Sanctuary.',
    goals: [
      { ...built('mine'), label: 'Drive a mine underground' },
      { ...built('military'), label: 'Raise a garrison' },
      { ...built('barracks'), label: 'Raise a barracks' },
      // Asked for directly: one goal, not one for each god — you build yours.
      { id: 'sanctuary', label: 'Build your Sanctuary', test: (d) => d.structures.countOf('sanctuary_white') + d.structures.countOf('sanctuary_black') > 0 },
    ],
  },
  {
    age: 9,
    name: 'Walls',
    size: 320,
    intro: 'Soon the wall comes down, and they will come over it. Raise walls, a gate and a watchtower while there is time.',
    goals: [
      { ...built('wall'), label: 'Raise a stone wall' },
      { ...built('gatehouse'), label: 'Raise a gatehouse' },
      { ...built('watchtower'), label: 'Raise a watchtower' },
      { id: 'fifteen', label: 'Fifteen buildings standing', test: (d) => buildings(d) >= 15, progress: (d) => `${Math.min(buildings(d), 15)}/15` },
    ],
  },
  {
    age: 10,
    name: 'Reckoning',
    size: 384,
    open: true,
    intro: 'The wall is down, and the Stone Kingdom is coming. Hold your land through ten rounds, then raise a village and a monument.',
    // Sworn to the dark god, there's no war coming: the reckoning is the Sky Kingdom's.
    introDark: 'The wall is down. The Stone King calls you his own, and the Sky Kingdom doesn\'t know you\'re coming. Raise a village — and take back the sky.',
    goals: [
      {
        id: 'war',
        label: 'End the war — win it, or bring down the Sky Kingdom',
        test: (d) => (d.ring === 'black' ? !!d.skyFallen : d.war?.stage === 'won' || d.war?.stage === 'truce'),
      },
      { ...built('village'), label: 'Raise a village' },
      { ...built('monument'), label: 'Raise a monument' },
      { id: 'renowned', label: 'Take a building to Renowned', test: (d) => d.structures.list().some((s) => STRUCTURES_BY_ID.get(s.type)?.tiers?.[s.tier ?? 0]?.id === 'renowned') },
    ],
  },
  // Ages 11 and 12, reworked as the draft had them (backlog batch 4, B;
  // asked for directly: "Next fix 11 12 goals"): after the war, Conquest —
  // the peoples past your border and their treasure — and then the god. The
  // time-travel goals the draft had came with time travel itself.
  {
    age: 11,
    name: 'Conquest',
    size: 448,
    open: true,
    intro: 'Past your border are peoples with treasure of their own: cities, tree tribes, the Kingdom\'s outposts. Take what you can carry.',
    goals: [
      { id: 'city_treasure', label: 'Take a city\'s treasure', test: (d) => ['city', 'ruined_city'].some((k) => d.raidedKinds?.().has(k)) },
      { id: 'second_people', label: 'Raid another people', test: (d) => ['tribe', 'outpost'].some((k) => d.raidedKinds?.().has(k)) },
      { id: 'gem_armour', label: 'Wear a piece of diamond armour', test: (d) => ['head', 'body', 'legs', 'feet'].some((k) => d.worn?.[k]?.id?.startsWith('armour_diamond_')) },
      { id: 'book_half', label: 'Fill half the collection book', test: (d) => (d.collection?.progress() ?? 0) >= 0.5, progress: (d) => `${Math.floor((d.collection?.progress() ?? 0) * 100)}/50%` },
    ],
  },
  {
    age: 12,
    name: 'The God',
    size: 512,
    open: true,
    intro: 'The god you didn\'t choose waits in his cube beyond the world, and the machine waits for the Past. Your Sanctuary opens the way.',
    goals: [
      { id: 'cube_open', label: 'Open the way at your Sanctuary', test: (d) => !!d.cube?.entered },
      { id: 'god_done', label: 'Beat the other god, or steal his stash', test: (d) => !!(d.cube?.beaten || d.cube?.stash) },
      // Time travel (world/past.js), as the draft had it.
      { id: 'past', label: 'Travel to the Past', test: (d) => !!d.time?.pastVisited },
      { id: 'hatch', label: 'Hatch a dinosaur from an egg', test: (d) => (d.time?.hatched ?? 0) > 0 },
    ],
    // Nothing comes after this one. Finishing it finishes the game.
    final: true,
  },
];

export const AGES_BY_NUMBER = new Map(AGES.map((a) => [a.age, a]));

export const FINAL_AGE = AGES[AGES.length - 1].age;

/** The age the wall comes down and the Stone Kingdom declares war: the first open one. */
export const WAR_AGE = AGES.find((a) => a.open).age;

/**
 * Saves from before there were twelve ages: the age they were in, moved to
 * the one with at least as much land, so nothing built ever ends up outside
 * the border — and the war, if it had started, still has.
 */
export const OLD_AGE = { 1: 2, 2: 3, 3: 4, 4: 6, 5: 8, 6: 10 };
export const AGES_VERSION = 2;

export function ageOf(n) {
  return AGES_BY_NUMBER.get(n) ?? AGES[0];
}

/** The line an age begins with, for the ring you bear. */
export function ageIntro(n, ring = null) {
  const a = ageOf(n);
  return (ring === 'black' && a?.introDark) || a?.intro;
}

/** The land each age holds — what Territory draws and enforces. */
export const RINGS = AGES.map(({ age, size, name, open = false }) => ({ age, size, name, open }));
