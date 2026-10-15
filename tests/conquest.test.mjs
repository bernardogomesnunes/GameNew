import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { ageOf } from '../src/config/ages.js';

/**
 * Ages 11 and 12, reworked (asked for directly: "Next fix 11 12 goals"):
 * Conquest — the peoples past your border — and then the god.
 */

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

ok('Age 11 is Conquest, Age 12 the god', ageOf(11).name === 'Conquest' && ageOf(12).name === 'The God' && ageOf(12).final);
ok('  Conquest: a city\'s treasure, another people, diamond armour, half the book',
  ageOf(11).goals.map((g) => g.id).join() === 'city_treasure,second_people,gem_armour,book_half');
ok('  the god: the way opened, the god beaten or his stash taken, three quarters of the book, forty buildings',
  ageOf(12).goals.map((g) => g.id).join() === 'cube_open,god_done,book_most,forty');

const { world } = generateDuiltWorld({ sizeX: 64, sizeZ: 64, seed: 3 });
const d = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
const goal = (age, id) => ageOf(age).goals.find((g) => g.id === id).test(d);
ok('nothing taken yet, nothing counts', !goal(11, 'city_treasure') && !goal(11, 'second_people'));
ok('taking from a place is recorded once', d.raid({ kind: 'ruined_city', x: 900, z: 40 }) && !d.raid({ kind: 'ruined_city', x: 900, z: 40 }));
ok('  an abandoned city\'s treasure counts as a city\'s', goal(11, 'city_treasure') && !goal(11, 'second_people'));
d.raid({ kind: 'outpost', x: -700, z: 300 });
ok('  and an outpost\'s as another people\'s', goal(11, 'second_people'));
d.worn.legs = { id: 'armour_iron_legs', wear: 0 };
ok('iron isn\'t gem armour', !goal(11, 'gem_armour'));
d.worn.legs = { id: 'armour_diamond_legs', wear: 0 };
ok('  diamond is', goal(11, 'gem_armour'));
ok('the cube not entered, the way isn\'t open', !goal(12, 'cube_open') && !goal(12, 'god_done'));
d.cube.entered = true; d.cube.stash = true;
ok('stepped through and the stash taken: both done', goal(12, 'cube_open') && goal(12, 'god_done'));
const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
back.loadJSON(JSON.parse(JSON.stringify(d.toJSON())));
ok('all of it saved and loaded', back.raidedKinds().has('ruined_city') && back.raidedKinds().has('outpost') && back.cube.entered && back.cube.stash);
const older = new DuiltGame({ world, scene: new THREE.Scene(), bus: { emit() {} } });
older.loadJSON({ ...JSON.parse(JSON.stringify(d.toJSON())), cube: { beaten: true, stash: false } });
ok('a save from before "entered" was kept: having beaten him, you went in', older.cube.entered);

ok('Game records a raid when you take from a city, an abandoned city, a tribe or an outpost',
  /l\.kind === 'tribe' \|\| l\.kind === 'city' \|\| l\.kind === 'outpost' \|\| l\.kind === 'ruined_city'/.test(game) && /this\.duilt\?\.raid\(lm\);/.test(game));
ok('  an abandoned city takes no offence', /if \(lm\.kind === 'ruined_city'\) return false;/.test(game));
ok('and stepping into the cube opens the way for good', /d\.cube\.inside = true;\s*d\.cube\.entered = true;/.test(game));

process.exit(f ? 1 : 0);
