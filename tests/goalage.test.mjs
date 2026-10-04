import { EventBus } from '../src/core/EventBus.js';
import { GamificationEngine } from '../src/gamification/GamificationEngine.js';

/**
 * Reported directly, with a screenshot: every Age 1 goal ticked, "Age 1 · 9
 * of 9 done", and "Age 2 appears here once you finish Age 1" — in a world
 * whose save says age 2. The panel's age only moved on the event fired at the
 * moment of advancing, and was never saved.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// A settlement reopened in its second age, with what was built last session.
const duilt = {
  sandbox: false, age: 2, territory: { size: 48 },
  structures: { list: () => [
    { type: 'forest', valid: true }, { type: 'farm', valid: true }, { type: 'forest', valid: true },
    { type: 'house', valid: true }, { type: 'house', valid: true }, { type: 'quarry', valid: false },
  ], countOf: () => 1 },
  settlers: { people: [{}] },
};
const g = new GamificationEngine(new EventBus());
g.loadJSON({ xp: 23, level: 9, achievementsUnlocked: ['first_break'] });
ok('before the settlement is known, it is Age 1', g.snapshot().age === 1);
g.setDuilt(duilt);
const s = g.snapshot();
ok(`the panel's age is the world's (${s.age})`, s.age === 2);
ok('what was claimed last session counts', s.claimed.has('farm') && s.claimed.has('house') && s.claimedCount === 5);
ok('a broken building does not', !s.claimed.has('quarry'));
ok('the settler who moved in counts', s.settlersEver === 1);
ok('and the land is the land you have', s.landSize === 48);
ok('so the goals about them unlock without doing it all again',
  g.state.achievementsUnlocked.has('first_claim') && g.state.achievementsUnlocked.has('first_settler'));

const sandbox = new GamificationEngine(new EventBus());
sandbox.setDuilt({ ...duilt, sandbox: true });
ok('a sandbox has no age to read', sandbox.snapshot().age === 1);

process.exit(f ? 1 : 0);
