import { readFileSync } from 'node:fs';
import { isFluid, WATER } from '../src/config/blocks.js';

/** Asked for directly: "water blocks should not be breakable". */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

ok('water is a fluid', isFluid(WATER));
ok('Break at water (or lava) does nothing', /if \(!hit \|\| isFluid\(hit\.block\)\) \{ this\.digTarget = null; return; \}/.test(game));
ok('nor does a mirrored copy of a break that lands in water', /if \(prev === AIR \|\| isFluid\(prev\)\) continue;/.test(game));
ok('the bucket still fills from it (its own Break, before breaking is reached)', /bucket: 'fillBucket'/.test(game));

process.exit(f ? 1 : 0);
