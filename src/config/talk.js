/**
 * What people say when you tap them. Asked for directly: "When I click npcs
 * in the game they should throw a message, but conversation like. For
 * example the messenger would give a message, explorer tell stories".
 *
 * Each tap is the next line, so tapping again carries the conversation on
 * rather than saying the same thing twice in a row. A line can carry:
 *
 *   {job}   what they work at, lower case ("farm")
 *   {dir}   a compass direction, to a real place when there is one
 *   {place} that place's name, lower case ("an old mine")
 *   {name}  their own name
 */

import { compass } from '../world/Wanderers.js';

/** Your settlers, by how they're doing. */
export const SETTLER_TALK = {
  hungry: [
    'There\'s nothing in the larder. I can\'t work on an empty stomach.',
    'Is there any food? Even a carrot. Anything.',
    'Fill a storehouse with food and I\'ll be back at it, I promise.',
  ],
  jobless: [
    'I\'ve a roof, thank you. Now I need something to do with my hands.',
    'Build something that needs working — a farm, a quarry — and I\'ll take it.',
    'I keep walking about. A person likes a job to go to.',
  ],
  working: [
    'The {job} keeps me busy. Busy is good.',
    'Another day at the {job}. Somebody has to.',
    'If you want the {job} to do more, give it what its next level asks for.',
    'I sleep well after a day at the {job}.',
  ],
  // A few for every settler, whatever they're doing.
  any: [
    'Good to have a roof. The first nights out here, I didn\'t.',
    'I heard you fell from the sky. Is that true?',
    'The traders say the roads are getting busier.',
    'Have you been down the deep layers? They say the stone changes colour.',
    'When the market\'s busy you can hear it from the fields.',
    'My name\'s {name}. Glad you took me in.',
  ],
};

/** By what they work at — said instead of the general working lines, now and then. */
export const JOB_TALK = {
  farm: ['The soil\'s good here. Plant me something new and I\'ll grow it.', 'Rain\'s due. The carrots will like that.'],
  forest: ['Plant a sapling for every tree you take and the forest never ends.', 'The birds are loud in the forest this morning.'],
  quarry: ['Stone, cobble, white and dark — this rock has a bit of everything in it.', 'Dig the face back further and the quarry gives more.'],
  kiln: ['Mind your fingers, the kiln\'s hot.', 'Clay in, brick out. Slow work, but it lasts.'],
  workshop: ['Bring me iron and I\'ll show you what a workshop can do.'],
  market: ['The goblins drive a hard bargain. Don\'t let them see you\'re keen.'],
  tavern: ['A full tavern\'s a happy town. An empty one\'s a worried one.'],
  mine: ['It\'s dark down there, and it goes deeper than you\'d think.'],
  granary: ['Every sack in here is a winter we don\'t have to worry about.'],
};

/**
 * What an explorer tells you. The first is who they are; after that,
 * stories — pointing at somewhere real, out in the world, when there is one.
 */
export const EXPLORER_TALK = {
  hello: [
    'Hello! Don\'t mind me — I\'m mapping the far country.',
    'A settlement! I didn\'t think anyone lived out this way.',
  ],
  place: {
    hermit: ['There\'s an old hermit in a hut to the {dir}. Talks to himself — and to anyone who\'ll listen.'],
    camp: ['I gave the bandit camp to the {dir} a wide berth. You should too.'],
    kingdom: ['To the {dir} there\'s a city of black stone. The gates were shut, and the guards didn\'t smile.'],
    ruin: ['I slept in an old ruin to the {dir}. Something rattled in the rubble all night.'],
    ruined_temple: ['Marble pillars to the {dir}, half of them down. Gold on the altar, still.'],
    mine: ['An old mine to the {dir} — the timbers creak, but there\'s ore in the walls.'],
    monument: ['From the hills you can see a tall black stone to the {dir}. Gold at the top.'],
    tribe: ['To the {dir} the trees are so tall people live in them — bridges, huts, a tower on top. They waved. I didn\'t touch anything.'],
  },
  stories: [
    'Up north the mountains are so high there\'s snow at noon in summer.',
    'I saw a light in the sky one night, moving. Too slow for a star.',
    'The deep caves have water you can hear long before you see it.',
    'There are trees out there taller than any tower you could build.',
    'They say before the kingdoms there were people who built in the trees and never came down.',
    'Every road I walk, somebody\'s already been. Every road but the next one.',
  ],
  bye: ['Well, the map won\'t draw itself. Safe building!', 'I\'ll be off. If I find anything, I\'ll send word.'],
};

/** One of the tree people (world/landmarks.js), while they're not angry with you. */
export const TRIBE_TALK = [
  'You walk on the ground? All day? How strange.',
  'The trees remember everything. Be kind to them.',
  'We have not come down since my grandmother\'s grandmother. Why would we?',
  'Our chests are ours. Take from them and you will hear our bows.',
  'Up here the wind sings. Down there you only hear your own feet.',
  'The great tree is older than both kingdoms. It will be here after them.',
];

/** A soldier or tower archer of yours. */
export const SOLDIER_TALK = [
  'All quiet on the walls.',
  'Feed us and we hold the line. That\'s the deal.',
  'I keep my sword sharp. You never know what comes over the hill.',
  'If the horn sounds, we\'re ready.',
];

/** One of your army, in the field. */
export const WARRIOR_TALK = [
  'Point us at them.',
  'We march when you march.',
  'A thousand strong, and every one sworn to you.',
];

/** The place a line points at: a landmark near enough to mean something, or none. */
function nearestPlace(landmarks, at, rand) {
  if (!landmarks?.length || !at) return null;
  const near = landmarks
    .filter((l) => EXPLORER_TALK.place[l.kind])
    .map((l) => ({ l, d: Math.hypot(l.x - at.x, l.z - at.z) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  return near.length ? near[Math.floor(rand() * near.length)].l : null;
}

const fill = (line, vars) => line.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

/**
 * The next thing someone says.
 *
 *   who      'settler' | 'explorer' | 'soldier' | 'warrior' | 'tribe'
 *   person   the person; their `said` counts how far the conversation got
 *   job      a settler's work, lower case, or null
 *   jobId    that building's id ('farm'), for lines about it
 *   at       where you are, for directions
 *   landmarks  places in the world (Wanderers.landmarks)
 *   rand     random source
 */
export function talkLine({ who, person, job = null, jobId = null, at = null, landmarks = [], rand = Math.random }) {
  const said = person.said ?? 0;
  person.said = said + 1;
  const vars = { job: job ?? 'work', name: person.name ?? 'nobody', dir: 'east', place: '' };
  // A different starting point for each person, so two people don't recite the same list.
  const pick = (pool) => pool[((person.id ?? 0) * 7 + said) % pool.length];

  if (who === 'explorer') {
    if (said === 0) return fill(pick(EXPLORER_TALK.hello), vars);
    // Every few, a goodbye: an explorer is passing through, not staying.
    if (said % 5 === 4) return fill(pick(EXPLORER_TALK.bye), vars);
    const lm = said % 4 === 1 ? nearestPlace(landmarks, at, rand) : null;
    if (lm) {
      const lines = EXPLORER_TALK.place[lm.kind];
      return fill(lines[said % lines.length], { ...vars, dir: compass(lm.x - at.x, lm.z - at.z) });
    }
    return fill(pick(EXPLORER_TALK.stories), vars);
  }
  if (who === 'soldier') return fill(pick(SOLDIER_TALK), vars);
  if (who === 'tribe') return fill(pick(TRIBE_TALK), vars);
  if (who === 'warrior') return fill(pick(WARRIOR_TALK), vars);

  // A settler: what's on their mind first, then whatever else.
  if (person.hungry) return fill(pick(SETTLER_TALK.hungry), vars);
  if (!job) return fill(said % 2 ? pick(SETTLER_TALK.any) : pick(SETTLER_TALK.jobless), vars);
  const own = JOB_TALK[jobId];
  const pool = said % 3 === 0 ? SETTLER_TALK.working : said % 3 === 1 && own ? own : SETTLER_TALK.any;
  return fill(pick(pool), vars);
}
