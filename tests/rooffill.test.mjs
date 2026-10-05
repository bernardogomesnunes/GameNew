import { readFileSync } from 'node:fs';
import { roofBlock, roofPart, ROOF_MATERIALS } from '../src/config/blocks.js';
import { ROOFS_BY_ID } from '../src/config/roofs.js';
import { roofPlan, roofTypeFor, gableFill } from '../src/tools/RoofTool.js';

/**
 * The batch: "Roofing only works for pyramid roofs, if we see the side it
 * looks awful, can't we know which block is below and fill the space with
 * that texture? I know that this might be weird in some cases but majority
 * will be fine".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const PLANKS = 7, GLASS = 10, AIR = 0;
const brick = roofBlock({ mat: 0, kind: 'steep' });

ok('a plain wall block fills a gable end', gableFill(PLANKS) === PLANKS && roofTypeFor(brick, { slope: null }, PLANKS) === PLANKS);
ok('nothing under it: the tiles\' own brick, as before', roofTypeFor(brick, { slope: null }, AIR) === ROOF_MATERIALS[0].wall);
ok('nor glass, a roof tile or a stair', gableFill(GLASS) === null && gableFill(brick) === null && gableFill(27) === null);
ok('the tiles on top are still tiles', !!roofPart(roofTypeFor(brick, { slope: { kind: 'steep', facing: 1 } }, PLANKS)));

// A 5×7 plank house, walls 3 high, open inside: the roof over it.
const W = 5, D = 7, TOP = 3;
const grid = new Map();
for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
  if (x === 0 || x === W - 1 || z === 0 || z === D - 1) for (let y = 1; y <= TOP; y++) grid.set(`${x},${y},${z}`, PLANKS);
}
const world = { getBlock: (x, y, z) => grid.get(`${x},${y},${z}`) ?? AIR, inBounds: () => true };
const spans = new Map();
for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) spans.set(`${x},${z}`, { xm: x + 1, xp: W - x, zm: z + 1, zp: D - z });
const pick = { spans, y: TOP, bounds: { minX: 0, maxX: W - 1, minZ: 0, maxZ: D - 1 } };
const plan = roofPlan(world, pick, { shape: ROOFS_BY_ID.get('gable'), turn: 0, type: brick });
const solid = plan.filter((c) => !roofPart(c.next));
ok('a gable over a plank house has plank ends', solid.length > 0 && solid.every((c) => c.next === PLANKS));
ok('and tiles over the top', plan.some((c) => roofPart(c.next)));

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('what you lay is what the preview showed', (game.match(/roofTypeFor\([^)]*, b, roofUnder\(this\.world, b\.x, base, b\.z\)\)/g) ?? []).length === 2);

process.exit(f ? 1 : 0);
