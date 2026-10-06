import { BLOCKS_BY_ID, logOnFace, endAxisOf, LOG_SIDE_BASE } from '../src/config/blocks.js';
import { ITEM_FOR_BLOCK } from '../src/config/items.js';
import { inspect } from '../src/structures/validate.js';

/** Asked for directly: "Logs should be placed in vertical and horizontal directions." */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const WOOD = 4, WHITE = 41, DARK = 43;
ok('put on top of something, a log stands up', logOnFace(WOOD, { x: 0, y: 1, z: 0 }) === WOOD && endAxisOf(WOOD) === 1);
const alongX = logOnFace(WOOD, { x: 1, y: 0, z: 0 }), alongZ = logOnFace(WOOD, { x: 0, y: 0, z: -1 });
ok('against the side of a block, it lies along that way', endAxisOf(alongX) === 0 && endAxisOf(alongZ) === 2);
ok('every wood lies down', [WHITE, DARK].every((w) => endAxisOf(logOnFace(w, { x: -1, y: 0, z: 0 })) === 0 && BLOCKS_BY_ID.get(logOnFace(w, { x: -1, y: 0, z: 0 })).name === BLOCKS_BY_ID.get(w).name));
ok('nothing else turns', logOnFace(7, { x: 1, y: 0, z: 0 }) === 7);
ok('a lying log breaks into the same wood', ITEM_FOR_BLOCK.get(alongX) === ITEM_FOR_BLOCK.get(WOOD) && ITEM_FOR_BLOCK.get(alongZ) === ITEM_FOR_BLOCK.get(WOOD));
ok('and fits in the block ids', LOG_SIDE_BASE + 5 < 256);

const cells = new Map([['0,0,0', WOOD], ['1,0,0', alongX], ['2,0,0', alongZ]]);
const ctx = inspect({ getBlock: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0 }, { minX: 0, maxX: 2, minY: 0, maxY: 0, minZ: 0, maxZ: 0 });
ok('a building counts lying logs as wood', ctx.countOf([WOOD]) === 3);

process.exit(f ? 1 : 0);
