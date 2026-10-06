import { Fireflies } from '../src/world/Fireflies.js';

/**
 * Reported directly: "Fireflies movement is not organic, we can see the
 * pattern. Would be nice for it to be a perfect loop like they'll roam
 * around until the starting point."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const world = { getBlock: (x, y) => (y < 50 ? 1 : 0), height: 200 };
const ff = new Fireflies({ world });
ff.groundAt = () => 50;
const s = ff.spawnNear({ x: 0, y: 50, z: 0 });
ok('a swarm comes out', !!s && s.dots.length > 0);
ff.level = 1;

const at = () => { const out = []; ff.dots((x, y, z) => out.push([x, y, z])); return out; };
const d = s.dots[0];
ff.clock = 0;
const start = at()[0];
ff.clock = (Math.PI * 2) / d.w;
const round = at()[0];
ok('after one time round, a firefly is exactly where it started', Math.hypot(start[0] - round[0], start[1] - round[1], start[2] - round[2]) < 1e-6);
ff.clock = (Math.PI * 2) / d.w / 2;
const half = at()[0];
ok('and on the way it has roamed somewhere else', Math.hypot(start[0] - half[0], start[2] - half[2]) > 0.05);
const periods = new Set(s.dots.map((x) => x.w.toFixed(4)));
ok('each goes round at its own pace, so the swarm never moves as one', periods.size > s.dots.length / 2);

process.exit(f ? 1 : 0);
