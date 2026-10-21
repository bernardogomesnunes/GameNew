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

// Plain stone only: finishing is done through the processing stations.
ok('the first quarry produces twelve stone a day', perDay(0) === 12);
const kiln = STRUCTURES_BY_ID.get('kiln');
const per = (spec, tier, id) => (producesAt(spec, tier)[id] ?? 0) * 86400 / intervalAt(spec, tier);
ok('every level gives only stone', quarry.tiers.every((_,i) => Object.keys(producesAt(quarry,i)).join() === 'stone'));
ok(`a first quarry makes more stone (${per(quarry, 0, 'stone')}) than a first kiln makes brick (${per(kiln, 0, 'brick')})`,
  per(quarry, 0, 'stone') > per(kiln, 0, 'brick'));
ok('clay is no longer quarry output', quarry.tiers.every((_, i) => per(quarry, i, 'clay') === 0));
ok('no one thing past fifteen a day, at any level', quarry.tiers.every((_, i) => Object.keys(producesAt(quarry, i)).every((id) => per(quarry, i, id) <= 15)));
ok('it has more than one level to climb', quarry.tiers.length >= 5);
ok('and every level produces more than the one before it',
  quarry.tiers.every((_, i) => i === 0 || perDay(i) > perDay(i - 1)));
ok('even maxed out it stays well under the old flat rate of 1920 stone a day',
  perDay(quarry.tiers.length - 1) < 1920);

process.exit(f ? 1 : 0);
