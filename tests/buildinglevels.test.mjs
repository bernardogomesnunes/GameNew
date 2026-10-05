import { readFileSync } from 'node:fs';
import { STRUCTURES, STRUCTURES_BY_ID, STANDARD_LEVELS, producesAt, yieldAt, scaleProduce, hasLevels } from '../src/config/structures.js';
import { tierStatus } from '../src/structures/validate.js';

/**
 * The batch: "Let's work on the level up farms and buildings as a whole
 * please. Let's build it."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const makers = STRUCTURES.filter((s) => s.everySeconds && (Object.keys(s.produces ?? {}).length || s.fromCrops || s.fromAnimals));
ok('every building that makes something has levels', makers.length >= 10 && makers.every(hasLevels));
ok('farms and pens included', hasLevels(STRUCTURES_BY_ID.get('farm')) && hasLevels(STRUCTURES_BY_ID.get('pen')));
ok('a house, a workshop, a wall: nothing to level', !hasLevels(STRUCTURES_BY_ID.get('house')) && !hasLevels(STRUCTURES_BY_ID.get('workshop')));

const forest = STRUCTURES_BY_ID.get('forest');
const wood = [0, 1, 2, 3].map((t) => producesAt(forest, t).wood);
ok('each rung makes more than the last', wood.every((w, i) => i === 0 || w > wood[i - 1]));
ok('a single fruit still climbs', [0, 1, 2, 3].map((t) => producesAt(forest, t).fruit).join() === '1,2,3,4');
ok('every rung past the first is paid for', STANDARD_LEVELS.slice(1).every((l) => l.cost && Object.keys(l.cost).length));
ok('and coins are part of the bill higher up', STANDARD_LEVELS.slice(2).every((l) => l.cost.coin > 0));

const farm = STRUCTURES_BY_ID.get('farm');
ok('a farm grows more of what is in it', yieldAt(farm, 2) === 2.5 && scaleProduce({ vegetables: 1 }, yieldAt(farm, 2)).vegetables === 3);

// A forest with nothing but trees: level one, and it says what the next wants.
const world = { getBlock: () => 0 };
const region = { minX: 0, maxX: 3, minY: 0, maxY: 3, minZ: 0, maxZ: 3 };
let status = null;
try { status = tierStatus(world, region, 'forest', 0); } catch { status = null; }
ok('the next rung says what it wants', !!status && status.tier === 0 && status.next.missing.some((m) => /light/.test(m)) && status.next.cost.planks > 0);
ok('never claimed already up the ladder', /if \(currentTier == null && spec\.tiers\[i\]\.standard\) break;/.test(readFileSync(new URL('../src/structures/validate.js', import.meta.url), 'utf8')));

const reg = readFileSync(new URL('../src/structures/StructureRegistry.js', import.meta.url), 'utf8');
ok('a farm or pen pays out its level', /scaleProduce\(producesFor\?\.\(s\) \?\? \{\}, yieldAt\(spec, tier\)\)/.test(reg));

process.exit(f ? 1 : 0);
