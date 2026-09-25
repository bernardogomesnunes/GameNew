import { STRUCTURES_BY_ID } from '../src/config/structures.js';

/**
 * Reported directly: "the stone factory is producing way too much stone I
 * get my inventory filled in and I can't receive the other items." Stone
 * has fewer sinks than wood or food (you don't eat it, most recipes want a
 * handful) so it piled up fastest and, once storehouses filled, started
 * eating bag slots by the stack — crowding out room for whatever else you
 * were actually gathering.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const quarry = STRUCTURES_BY_ID.get('quarry');
const perCycle = Object.values(quarry.produces).reduce((a, b) => a + b, 0);
const perMinute = (perCycle / quarry.everySeconds) * 60;

ok('a quarry produces well under half an item a second', perMinute < 4);
ok('specifically cut down from the old 7 items every 70s', perCycle <= 3 && quarry.everySeconds >= 90);

process.exit(f ? 1 : 0);
