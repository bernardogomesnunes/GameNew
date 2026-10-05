import { readFileSync } from 'node:fs';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { itemIcon } from '../src/config/cubes.js';

/**
 * The batch: "Catching fireflies should be done with a jar that needs to be
 * crafted with glass, a jar of fireflies can then craft a firefly lantern".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const jar = ITEMS_BY_ID.get('jar');
ok('a glass jar is a thing you carry, drawn as one', !!jar && !!itemIcon(jar, { size: 22 }));
const make = RECIPES.find((r) => r.output.id === 'jar');
ok('made from glass', !!make && Object.keys(make.inputs).join() === 'glass');
ok('what you catch is a jar of fireflies', ITEMS_BY_ID.get('fireflies').name === 'Jar of Fireflies');
const lantern = RECIPES.find((r) => r.output.id === 'firefly_lantern');
ok('and a jar of them makes a lantern, with no more glass on top', lantern.inputs.fireflies === 1 && !lantern.inputs.glass);

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('no jar, no fireflies — and it says how to get one',
  /if \(d && !d\.sandbox && d\.inventory\.countOf\('jar'\) < 1\) \{\s*this\.ui\.toast\(\{ kind: 'xp', title: 'You need a jar'/.test(game));
ok('an empty jar in, a full one out', /d\.inventory\.remove\('jar', 1\);\s*this\.fireflies\.catchFrom\(swarm\);\s*const got = d\?\.collect\(\{ fireflies: 1 \}\)/.test(game));
ok('and the jar back if the bag had no room for the full one', /if \(d && !d\.sandbox && !got\.fireflies\) d\.inventory\.add\('jar', 1\);/.test(game));

process.exit(f ? 1 : 0);
