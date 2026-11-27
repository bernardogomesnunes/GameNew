// WORK-2: four hand-work mini games (forest, quarry, mine, farm).
import * as THREE from 'three';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { HandWork, HAND_GAMES, gameFor, markerAt, landed, nextTarget, SWINGS, MIN_REST } from '../src/duilt/HandWork.js';
import { SETTLERS } from '../src/config/settlers.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the bar ------------------------------------------------------------------
ok('four games: forest, quarry, mine, farm', Object.keys(HAND_GAMES).join() === 'forest,quarry,mine,farm');
ok('other buildings have none', gameFor('house') === null && gameFor('market') === null && gameFor('pen') === null);
ok('marker sweeps 0 to 1 and back', markerAt(0, 1) === 0 && markerAt(1, 1) === 1 && markerAt(2, 1) === 0 && Math.abs(markerAt(0.5, 1) - 0.5) < 1e-9 && Math.abs(markerAt(1.5, 1) - 0.5) < 1e-9);
ok('landed is inside half a width either side', landed(0.5, 0.5, 0.2) && landed(0.59, 0.5, 0.2) && !landed(0.61, 0.5, 0.2));
ok('the window always fits the bar', [0, 0.5, 0.999].every((r) => { const w = 0.26, t = nextTarget(w, () => r); return t - w / 2 >= 0 && t + w / 2 <= 1; }));
ok('every game is playable on a phone: window at least 18% of the bar, marker at most 1.1 bars a second', Object.values(HAND_GAMES).every((g) => g.width >= 0.18 && g.speed <= 1.1));

// --- the rules ----------------------------------------------------------------
const scene = new THREE.Scene();
const { world } = generateDuiltWorld({ sizeX: 96, sizeZ: 96, height: 64, seed: 4 });
const game = () => {
  const g = new DuiltGame({ world, scene, bus: null });
  const mk = (type, extra = {}) => {
    const s = { id: g.structures.nextId++, type, region: { minX: 0, maxX: 5, minY: 40, maxY: 42, minZ: 0, maxZ: 5 }, valid: true, locked: true, claimedAt: Date.now(), lastPaidAt: Date.now(), brokenReason: null, excludes: [], tier: 0, ...extra };
    g.structures.structures.push(s);
    return s;
  };
  return { g, mk };
};
const secondsPerItem = (g, s) => {
  const t = g.handProduces(s);
  return g.handWork.cycleSeconds(s) / (Object.values(t).reduce((n, v) => n + v, 0) * (1 + SETTLERS.workBonus));
};
{
  const { g, mk } = game();
  const forest = mk('forest'), quarry = mk('quarry'), mine = mk('mine'), farm = mk('farm');
  ok('all four can be worked at the start (farm needs a seed)', [forest, quarry, mine].every((s) => g.handWork.status(s).ok) && !g.handWork.status(farm).ok);
  ok('an empty farm says to sow', /Sow a seed/.test(g.handWork.status(farm).reason));
  farm.seeds = ['carrot'];
  ok('a sown farm can be worked', g.handWork.status(farm).ok);
  ok('a house cannot', !g.handWork.status(mk('house')).ok);

  // A round of three hits at each game.
  for (const [name, s] of [['forest', forest], ['quarry', quarry], ['mine', mine], ['farm', farm]]) {
    const before = g.inventory.slots.reduce((n, x) => n + (x?.count ?? 0), 0);
    const r = g.handWorkRound(s, SWINGS);
    const got = Object.values(r.made).reduce((n, v) => n + v, 0);
    const after = g.inventory.slots.reduce((n, x) => n + (x?.count ?? 0), 0);
    ok(`${name}: 3 hits make 3 items, all of what the building makes`, r.ok && got === 3 && after - before === 3 && Object.keys(r.made).every((id) => id in g.handProduces(s)));
    // No faster than a worker with their bonus.
    const workerRate = 1 / secondsPerItem(g, s);
    ok(`${name}: rests ${r.left}s, so ${got} items are no faster than a worker`, got / r.left <= workerRate * 1.01);
    ok(`${name}: it rests, then refuses`, !g.handWork.status(s).ok && g.handWork.status(s).reason === 'Resting.');
    ok(`${name}: a second round is refused while resting`, g.handWorkRound(s, 3).ok === false);
    g.handWork.tick(r.left - 1);
    ok(`${name}: still resting a second before the end`, !g.handWork.status(s).ok);
    g.handWork.tick(1);
    ok(`${name}: ready again after the rest`, g.handWork.status(s).ok);
  }

  // Misses.
  const miss = g.handWorkRound(forest, 0);
  ok('no hit: nothing made, short rest', miss.ok && Object.keys(miss.made).length === 0 && miss.left === MIN_REST);
  g.handWork.tick(MIN_REST);
  ok('hits are capped at the swings', Object.values(g.handWorkRound(forest, 99).made).reduce((n, v) => n + v, 0) === SWINGS);
  g.handWork.tick(9999);

  // Items follow the building's own proportions.
  const table = g.handProduces(forest), total = Object.values(table).reduce((n, v) => n + v, 0);
  const counts = {};
  for (let i = 0; i < total; i++) {
    const r = g.handWorkRound(forest, SWINGS);
    for (const [k, v] of Object.entries(r.made)) counts[k] = (counts[k] ?? 0) + v;
    g.handWork.tick(9999);
  }
  // total rounds of 3 hits = 3*total items; the forest's earlier rounds were folded into the carry as well.
  const sum = Object.values(counts).reduce((n, v) => n + v, 0);
  ok('forest goods come in its own proportions (wood most)', sum === SWINGS * total && counts.wood > sum / 2 && Object.keys(counts).every((k) => k in table));

  // A villager at work: refused.
  g.settlers.people.push({ id: 1, name: 'Ana', homeId: 99, workId: quarry.id, hungry: false, band: 'content', mood: 80 });
  ok('refused while a villager works there', !g.handWork.status(quarry).ok && /villager/.test(g.handWork.status(quarry).reason));
  ok('another building is still free to work', g.handWork.status(mine).ok);

  // Save and load.
  g.handWorkRound(mine, 2);
  const left = g.handWork.left(mine);
  const saved = JSON.parse(JSON.stringify(g.toJSON()));
  ok('the rest is in the save', saved.handWork.some((e) => e.id === mine.id && e.left > 0));
  const back = new DuiltGame({ world, scene, bus: null });
  back.loadJSON(saved);
  ok('the rest survives a reload', Math.abs(back.handWork.left(back.structures.list().find((s) => s.id === mine.id)) - left) <= 1);
  const old = JSON.parse(JSON.stringify(saved));
  delete old.handWork;
  const older = new DuiltGame({ world, scene, bus: null });
  older.loadJSON(old);
  ok('a save with no hand work loads with no rest', older.handWork.left(older.structures.list().find((s) => s.id === mine.id)) === 0);
}
{
  // Nothing fits: the round is refused and costs no rest.
  const hw = new HandWork({ produces: () => ({ stone: 1 }), cycleSeconds: () => 100, deliver: () => false });
  const s = { id: 1, type: 'quarry', valid: true };
  const r = hw.finish(s, 2);
  ok('no room: refused, and no rest started', !r.ok && /No room/.test(r.reason) && hw.left(s) === 0);
  const junk = new HandWork({ produces: () => ({ stone: 1 }), cycleSeconds: () => 100, deliver: () => true });
  junk.loadJSON([{ id: 'x', left: 5 }, { id: 2, left: NaN }, { id: 3, left: 99999, credit: { a: 1, b: 'z' } }, null]);
  ok('bad saved rows are dropped and rest is capped', junk.state.size === 1 && junk.state.get(3).left === 3600 && !('b' in junk.state.get(3).credit));
}
console.log(f ? `${f} failed` : 'all passed');
process.exit(f ? 1 : 0);
