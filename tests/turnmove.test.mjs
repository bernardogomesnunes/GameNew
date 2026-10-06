import { readFileSync } from 'node:fs';
import { quarterTurned, facingOf, turned, logOnFace, endAxisOf } from '../src/config/blocks.js';

/** Asked for directly: "Moving buildings should allow rotate, only when moving." */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');

const STAIRS = 29, STONE = 3;
const stair = turned(STAIRS, 0);
ok('a stair turns to face the next way round', facingOf(quarterTurned(stair)) === 1 && facingOf(quarterTurned(quarterTurned(quarterTurned(quarterTurned(stair))))) === 0);
const log = logOnFace(4, { x: 1, y: 0, z: 0 });
ok('a log lying along x lies along z, and back', endAxisOf(quarterTurned(log)) === 2 && quarterTurned(quarterTurned(log)) === log);
ok('a plain block is just itself', quarterTurned(STONE) === STONE);

// A 3-long, 1-wide building along x, turned, is 1-long and 3-wide along z.
const shown = [];
const g = {
  moving: { blocks: [{ dx: 0, dy: 0, dz: 0, type: STONE }, { dx: 1, dy: 0, dz: 0, type: STONE }, { dx: 2, dy: 0, dz: 0, type: stair }], extent: { x: 2, y: 0, z: 0 } },
  ghost: { show: (b, e) => shown.push(e) },
  updateMove() { this.updated = true; },
};
Game.prototype.turnMove.call(g);
ok('turned, a long building lies the other way', g.moving.extent.x === 0 && g.moving.extent.z === 2);
ok('every block goes round with it', g.moving.blocks.map((b) => `${b.dx},${b.dz}`).join(' ') === '0,0 0,1 0,2');
ok('and faces round with it', facingOf(g.moving.blocks[2].type) === 1);
ok('the ghost and the landing check follow', shown.length === 1 && g.updated);
for (let i = 0; i < 3; i++) Game.prototype.turnMove.call(g);
ok('four turns bring it back as it was', g.moving.extent.x === 2 && g.moving.blocks.map((b) => `${b.dx},${b.dz}`).join(' ') === '0,0 1,0 2,0' && g.moving.blocks[2].type === stair);

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('R turns it, only while carrying a building', /if \(e\.code === turnKey && this\.moving\) this\.turnMove\(\);/.test(game));
ok('and on a phone, tapping the hint does', /onHintTap: \(\) => \(this\.moving \? this\.turnMove\(\)/.test(game));

process.exit(f ? 1 : 0);
