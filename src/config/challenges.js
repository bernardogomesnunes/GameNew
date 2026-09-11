// Rotating build challenges. `check(ctx)` receives { session } — the current
// build-session stats (reset whenever a new session starts, see
// gamification/GamificationEngine.js) — and returns true once satisfied.
// `unlockBlock` (optional) is a block id granted immediately on completion,
// bypassing its normal level/achievement gate.
export const CHALLENGES = [
  {
    id: 'minimalist',
    description: 'Build something using only 3 block types.',
    xpReward: 60,
    check: (ctx) => ctx.session.blocksPlaced >= 15 && ctx.session.distinctTypes.size <= 3,
  },
  {
    id: 'tall_tower',
    description: 'Build a structure taller than 10 blocks.',
    xpReward: 60,
    unlockBlock: 12,
    check: (ctx) => ctx.session.maxY - ctx.session.minY >= 10,
  },
  {
    id: 'sprawling',
    description: 'Spread a build across a 10x10 or larger footprint.',
    xpReward: 60,
    check: (ctx) => ctx.session.maxX - ctx.session.minX >= 10 && ctx.session.maxZ - ctx.session.minZ >= 10,
  },
  {
    id: 'century',
    description: 'Place 100 blocks in one session.',
    xpReward: 80,
    check: (ctx) => ctx.session.blocksPlaced >= 100,
  },
  {
    id: 'glasshouse',
    description: 'Use at least 5 glass blocks in a build.',
    xpReward: 50,
    unlockBlock: 15,
    check: (ctx) => (ctx.session.byType.get(10) || 0) + (ctx.session.byType.get(15) || 0) + (ctx.session.byType.get(16) || 0) >= 5,
  },
  {
    id: 'rainbow',
    description: 'Place 6 different block types without repeating in a row.',
    xpReward: 70,
    check: (ctx) => ctx.session.bestDistinctStreak >= 6,
  },
  {
    id: 'symmetrical',
    description: 'Place 10+ blocks while symmetry mode is active.',
    xpReward: 55,
    check: (ctx) => ctx.session.symmetryPlacements >= 10,
  },
  {
    id: 'excavator',
    description: 'Break 20 blocks underground.',
    xpReward: 55,
    check: (ctx) => ctx.session.undergroundBreaks >= 20,
  },
];

export const CHALLENGES_BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));

// Deterministic pseudo-random pick so every player sees the same rotation
// on the same calendar day, without needing a backend.
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function dailyChallengeIdsFor(dateStr) {
  const n = CHALLENGES.length;
  const first = hashString(dateStr) % n;
  let second = hashString(dateStr + ':2') % n;
  if (second === first) second = (second + 1) % n;
  return [CHALLENGES[first].id, CHALLENGES[second].id];
}
