import { STRUCTURES_BY_ID, producesAt, intervalAt } from '../src/config/structures.js';

/**
 * Reported directly: "the stone factory is producing way too much stone I
 * get my inventory filled in and I can't receive the other items." Stone
 * has fewer sinks than wood or food (you don't eat it, most recipes want a
 * handful) so it piled up fastest and, once storehouses filled, started
 * eating bag slots by the stack — crowding out room for whatever else you
 * were actually gathering.
 *
 * Cut twice now: once to a handful every couple of minutes, then again to a
 * genuine trickle at its first level — see structures.js's `tiers` on the
 * quarry, the first building to use the same ladder a storehouse climbs, and
 * the only way back up from here.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const quarry = STRUCTURES_BY_ID.get('quarry');

function perDay(tier) {
  const produces = producesAt(quarry, tier);
  const everySeconds = intervalAt(quarry, tier);
  return Object.values(produces).reduce((a, b) => a + b, 0) * 86400 / everySeconds;
}

ok('its first level is a genuine trickle — ten stone a day', perDay(0) === 10);
ok('it has more than one level to climb', quarry.tiers.length >= 5);
ok('and every level produces more than the one before it',
  quarry.tiers.every((_, i) => i === 0 || perDay(i) > perDay(i - 1)));
ok('even maxed out it stays well under the old flat rate of 1920 stone a day',
  perDay(quarry.tiers.length - 1) < 1920);

process.exit(f ? 1 : 0);
