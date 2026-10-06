import { TRAPDOOR, TRAPDOOR_OPEN, TRAPDOOR_LOW, BLOCKS_BY_ID, isTrapdoor, isOpenTrapdoor, swungTrapdoor, trapdoorOnFace, facingOf } from '../src/config/blocks.js';
import { ITEM_FOR_BLOCK } from '../src/config/items.js';
import { readFileSync } from 'node:fs';

/** Asked for directly: "Trapdoors should be placed on the face of the block not with space below on top facing always." */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const shape = (id) => BLOCKS_BY_ID.get(id)?.shape;

const held = TRAPDOOR + 1;
ok('put on top of a block, it lies on the floor, the way you face', shape(trapdoorOnFace(held, { x: 0, y: 1, z: 0 })) === 'trapdoor_low' && facingOf(trapdoorOnFace(held, { x: 0, y: 1, z: 0 })) === 1);
ok('put under one, it shuts at the top', shape(trapdoorOnFace(held, { x: 0, y: -1, z: 0 })) === 'trapdoor');
const onWall = trapdoorOnFace(held, { x: 0, y: 0, z: 1 });
ok('put against a wall, it stands against that wall, hinged on it', shape(onWall) === 'trapdoor_open' && facingOf(onWall) === 0);
ok('every wall side hinges on its own side', [[{ x: 1, y: 0, z: 0 }, 3], [{ x: -1, y: 0, z: 0 }, 1], [{ x: 0, y: 0, z: -1 }, 2]].every(([n, fc]) => facingOf(trapdoorOnFace(held, n)) === fc));

const low = TRAPDOOR_LOW + 2;
ok('a floor one is a trapdoor, shut, and picks up as one', isTrapdoor(low) && !isOpenTrapdoor(low) && ITEM_FOR_BLOCK.get(low) === 'trapdoor');
ok('it opens to stand up the same way round', swungTrapdoor(low) === TRAPDOOR_OPEN + 2);
ok('and shuts back onto the floor when that is where it stands', swungTrapdoor(TRAPDOOR_OPEN + 2, { low: true }) === low);
ok('or at the top of its cell when not', swungTrapdoor(TRAPDOOR_OPEN + 2) === TRAPDOOR + 2);
const world = readFileSync(new URL('../src/world/World.js', import.meta.url), 'utf8');
ok('shut on the floor, it is a low step you stand on', /shape === 'trapdoor_low'\) return \{ minY: y, maxY: y \+ 0\.1875 \}/.test(world));
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('placing uses the face you point at', /trapdoorOnFace\(logOnFace\(this\.placedBlock\(type\), hit\.normal\), hit\.normal\)/.test(game));

process.exit(f ? 1 : 0);
