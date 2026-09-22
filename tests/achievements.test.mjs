import { GamificationEngine } from '../src/gamification/GamificationEngine.js';
import { EventBus } from '../src/core/EventBus.js';
import { ACHIEVEMENTS } from '../src/config/achievements.js';

/**
 * Reported as: "achievements is broken. I already did a lot of the stuff
 * that is there and it didn't trigger." The claimed-kind achievements
 * (three different buildings, one of everything) read state.claimed, a Set
 * built entirely from the 'structure:claimed' bus event — but
 * StructureRegistry emits `{ structure, spec }`, not `{ type }`, so the old
 * handler's `{ type }` destructure pulled undefined every time and the Set
 * never gained a member no matter how many kinds of building were claimed.
 * claimedCount (count-only goals) happened to still work, which is why the
 * bug read as "some achievements" rather than "all of them".
 *
 * Also removed here: one achievement per age just for reaching it ("Age 2",
 * "Age 3"...). The border growing is something you watch happen; a card
 * congratulating you for the thing you just watched happen isn't a goal.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the real bug: the event payload shape ----------------------------------

{
  const bus = new EventBus();
  const gam = new GamificationEngine(bus);

  bus.emit('structure:claimed', { structure: { type: 'quarry' }, spec: {} });
  bus.emit('structure:claimed', { structure: { type: 'farm' }, spec: {} });
  bus.emit('structure:claimed', { structure: { type: 'sawmill' }, spec: {} });

  ok('claiming three different kinds tracks all three kinds', gam.state.claimed.size === 3);
  ok('and the count-based side kept working too', gam.state.claimedCount === 3);
  ok('so "three different buildings" actually unlocks',
    gam.state.achievementsUnlocked.has('three_kinds'));
}

{
  // The same kind claimed six times over is six buildings, not six kinds.
  const bus = new EventBus();
  const gam = new GamificationEngine(bus);
  for (let i = 0; i < 6; i++) bus.emit('structure:claimed', { structure: { type: 'farm' }, spec: {} });

  ok('claiming the same kind repeatedly is one kind', gam.state.claimed.size === 1);
  ok('but still six buildings for the count-only goal', gam.state.achievementsUnlocked.has('a_street'));
  ok('and "one of everything" is correctly still out of reach',
    !gam.state.achievementsUnlocked.has('many_kinds'));
}

// --- age achievements are gone, not just hidden -----------------------------

ok('no achievement just restates reaching the next age',
  !ACHIEVEMENTS.some((a) => a.border || /^age_/.test(a.id)));
ok('but the real goals that shared those age bands are still there',
  ACHIEVEMENTS.some((a) => a.id === 'three_kinds') && ACHIEVEMENTS.some((a) => a.id === 'a_town'));

process.exit(f ? 1 : 0);
