import { readFileSync } from 'node:fs';
import { TurfSpread, GRASS, DIRT, MIN_DAYS, MAX_DAYS } from '../src/duilt/TurfSpread.js';

/**
 * Asked for directly: "If I place a block of turf next to dirt both exposed
 * like top blocks dirt should become turf after some random time never
 * smaller than 5 days but it can take as long as 50 days."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const blocks = new Map();
const world = {
  getBlock: (x, y, z) => blocks.get(`${x},${y},${z}`) ?? 0,
  setBlock: (x, y, z, v) => blocks.set(`${x},${y},${z}`, v),
};
// A row of dirt, open to the sky, with one turf at the start.
for (let x = 0; x < 6; x++) world.setBlock(x, 10, 0, DIRT);
world.setBlock(0, 10, 0, GRASS);

const t = new TurfSpread({ rand: () => 0.5 });
t.consider(world, 0, 10, 0, 0);
const first = t.due.get('1,10,0');
ok('dirt beside turf is given its day', !!first && !t.due.has('2,10,0'));
ok('between 5 and 50 days off', first.at >= MIN_DAYS && first.at <= MAX_DAYS);
ok('nothing turns before then', t.spread(world, first.at - 0.01).length === 0 && world.getBlock(1, 10, 0) === DIRT);
ok('on the day, it turns', t.spread(world, first.at).length === 1 && world.getBlock(1, 10, 0) === GRASS);
ok('and its own neighbour gets a day of its own', t.due.has('2,10,0'));

world.setBlock(2, 11, 0, 3);
const day = t.due.get('2,10,0').at;
ok('dirt with something on top stays dirt', t.spread(world, day).length === 0 && world.getBlock(2, 10, 0) === DIRT);

const t2 = new TurfSpread({ rand: () => 0 }), t3 = new TurfSpread({ rand: () => 0.999 });
world.setBlock(2, 11, 0, 0);
t2.consider(world, 1, 10, 0, 100); t3.consider(world, 1, 10, 0, 100);
ok('never sooner than 5 days, never later than 50', t2.due.get('2,10,0').at === 100 + MIN_DAYS && t3.due.get('2,10,0').at <= 100 + MAX_DAYS);
ok('a claimed building\'s dirt is left bare', (() => { const t4 = new TurfSpread(); t4.consider(world, 1, 10, 0, 0, () => true); return t4.due.size === 0; })());

const back = new TurfSpread(); back.loadJSON(JSON.parse(JSON.stringify(t.toJSON())));
ok('kept with the world', back.due.size === t.due.size);

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('every edit to grass or dirt, or one that opens dirt to the sky, is looked at', /if \(TURFY\.has\(c\.prev\) \|\| TURFY\.has\(c\.next\) \|\| c\.next === AIR\) this\.duilt\.turf\.consider\(/.test(game));
ok('and it spreads as the days go by, with the crops', /this\.duilt\.turf\.spread\(this\.world, this\.duilt\.days, this\.turfSkip\(\)\)/.test(game));

process.exit(f ? 1 : 0);
