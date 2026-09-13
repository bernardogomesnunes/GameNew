/**
 * The four skills, and the milestones that raise them.
 *
 * They divide the game cleanly: foraging is your relationship with the world,
 * building with structures, athletics with your own body, politics with other
 * people. Nothing competes with anything, which is rarer in a skill list than
 * it sounds.
 *
 * Levelling is by milestone, never by repetition. "Chop a thousand trees to max
 * out foraging" is the exact grind the rest of this design spends its time
 * avoiding, so credit lands on your first, your tenth, your hundredth — and
 * then the curve flattens hard.
 */

export const SKILLS = [
  {
    id: 'foraging',
    name: 'Foraging',
    icon: '🌿',
    governs: 'What you can take from the world',
    // Each level: yield multiplier applied to gathering.
    perLevel: { yield: 0.12 },
    describe: (lvl) => `+${Math.round(lvl * 12)}% from everything you gather`,
  },
  {
    id: 'building',
    name: 'Building',
    icon: '🧱',
    governs: 'What you can raise, and how cheaply',
    perLevel: { claimCost: 0.05 },
    describe: (lvl) => `Buildings cost ${Math.round(lvl * 5)}% less to raise`,
  },
  {
    id: 'athletics',
    name: 'Athletics',
    icon: '🏃',
    governs: 'Your own body',
    perLevel: { speed: 0.04, hunger: -0.04 },
    describe: (lvl) => `+${Math.round(lvl * 4)}% speed, ${Math.round(lvl * 4)}% slower to tire`,
  },
  {
    id: 'politics',
    name: 'Politics',
    icon: '🤝',
    governs: 'The people who will one day live here',
    perLevel: { settlers: 1 },
    describe: (lvl) => `Room to govern ${lvl} more settler${lvl === 1 ? '' : 's'}`,
  },
];

export const SKILLS_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

/**
 * Milestone ladder shared by every skill. Reaching a count awards a level, and
 * the gaps widen fast so the tenth level is an achievement rather than an
 * afternoon.
 */
export const MILESTONES = [1, 10, 30, 75, 150, 300, 600, 1200, 2500, 5000];

export const MAX_LEVEL = MILESTONES.length;

/** Level implied by a raw count of qualifying actions. */
export function levelForCount(count) {
  let level = 0;
  for (const m of MILESTONES) if (count >= m) level++;
  return level;
}

/** Count needed for the next level, or null at the cap. */
export function nextMilestone(count) {
  for (const m of MILESTONES) if (count < m) return m;
  return null;
}
