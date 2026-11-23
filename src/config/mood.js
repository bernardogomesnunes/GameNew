/**
 * PLAY-13: villager mood. Numbers only; the rules are in duilt/Mood.js.
 * Design: docs/design/play-13.md.
 */

/** Seconds in a game day (render/DayCycle.js GAME_DAY_SECONDS, kept here so rules need no three.js). */
export const MOOD_DAY = 900;

export const MOOD = {
  min: 0,
  max: 100,
  /** A new arrival. */
  arrivalMood: 70,
  /** A person in a save from before PLAY-13. */
  legacyMood: 80,

  /** Change per game day. */
  perDay: {
    fed: 5,
    hungry: -25,
    job: 5,
    idle: -15,
  },

  /** Game days without a job that cost nothing. */
  graceDays: 3,

  /** One-off bumps so a fix shows at once. */
  bump: {
    fed: 10,
    job: 10,
  },

  /** Points above a band's lower edge needed to climb back into the band above. */
  hysteresis: 5,

  /** Game days spent Furious before somebody moves out. */
  furiousDaysToLeave: 1,

  /** Game days a vacated house stays empty. */
  emptyHouseDays: 2,

  /** No arrivals while the town average is below `stop`, until it is `resume` or more. */
  arrivals: { stop: 40, resume: 45 },

  /** Share of the work bonus kept, by band. */
  workBonusScale: { content: 1, grumbling: 0.5, angry: 0, furious: 0 },

  /** Builders take this many times as long a block while Grumbling. */
  grumblingBuildSlowdown: 1.5,
};

/** Best to worst. `from` is the lowest mood in the band. */
export const BANDS = [
  { id: 'content', from: 60, colour: null, label: 'Content' },
  { id: 'grumbling', from: 40, colour: '#e0b43a', label: 'Grumbling' },
  { id: 'angry', from: 20, colour: '#e07a2e', label: 'Angry' },
  { id: 'furious', from: 0, colour: '#d23a2a', label: 'Furious' },
];
export const BAND_IDS = BANDS.map((b) => b.id);
