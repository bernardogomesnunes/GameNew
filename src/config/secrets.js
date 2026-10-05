import { QUESTS } from './quests.js';
import { MOMENTS } from './moments.js';
import { MOBS } from './mobs.js';
import { TRADERS } from './traders.js';

/**
 * Secrets: achievements you don't see coming. Asked for as part of the story
 * work: "hidden achievements for exploring". They sit in their own band at
 * the bottom of the Goals tab as a hint and a question mark until they're
 * done, and they're never one of an age's goals — no border waits on one,
 * and they're not in any age's count.
 *
 * Every one reads what's already true of your world (where you've been, what
 * you've hunted, who you've bought from), so none can be missed by doing it
 * at the wrong moment.
 *
 *   hint    what the locked card says
 *   check   ({ duilt }) => done — `duilt` is the live settlement, or null
 */

const PLACE_KINDS = ['ruin', 'ruined_temple', 'mine', 'monument', 'camp', 'hermit', 'kingdom'];
const placesFound = (d) => new Set((d?.foundPlaces?.() ?? []).map((p) => p.kind));

export const SECRETS = [
  {
    id: 's_cartographer', name: 'Cartographer', icon: '🗺️', xpReward: 300,
    hint: 'Some places can only be found on foot.',
    description: 'Found every kind of place out in the world: ruin, forgotten temple, old mine, monument, bandit camp, the hermit\'s hut and the Stone Kingdom.',
    check: (c) => PLACE_KINDS.every((k) => placesFound(c.duilt).has(k)),
  },
  {
    id: 's_every_ruin', name: 'Every last stone', icon: '🏚️', xpReward: 200,
    hint: 'There is never only one ruin.',
    description: 'Found all four ruins.',
    check: (c) => (c.duilt?.foundPlaces?.() ?? []).filter((p) => p.kind === 'ruin').length >= 4,
  },
  {
    id: 's_fireflies', name: 'Keeper of lights', icon: '✨', xpReward: 150,
    hint: 'Warm nights, and plenty of jars.',
    description: 'Held five jars of fireflies at once.',
    check: (c) => (c.duilt?.inventory?.countOf('fireflies') ?? 0) >= 5,
  },
  {
    id: 's_every_stall', name: 'Every stall', icon: '🛒', xpReward: 200,
    hint: 'Every goblin keeps a different stall.',
    description: 'Bought something from every trader in the market.',
    check: (c) => TRADERS.every((t) => c.duilt?.tradedWith?.has(t.id)),
  },
  {
    id: 's_woods', name: 'Know the woods', icon: '🦌', xpReward: 200,
    hint: 'Every creature that walks these lands.',
    description: 'Hunted one of every kind of animal.',
    check: (c) => MOBS.every((m) => c.duilt?.huntedKinds?.has(m.id)),
  },
  {
    id: 's_errands', name: 'Everyone\'s errand', icon: '📜', xpReward: 300,
    hint: 'Everyone who asked something of you, answered.',
    description: 'Handed in every errand anyone gave you.',
    check: (c) => QUESTS.every((q) => c.duilt?.quests?.[q.id]?.done),
  },
  {
    id: 's_whole_story', name: 'The whole story', icon: '📖', xpReward: 300,
    hint: 'Live long enough, and see enough.',
    description: 'Lived every story moment there is to live.',
    check: (c) => Object.keys(MOMENTS).every((id) => c.duilt?.moments?.includes(id)),
  },
].map((s) => ({ ...s, secret: true, age: null }));
