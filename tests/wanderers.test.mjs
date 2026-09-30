import { generateEndlessWorld } from '../src/world/StarterWorld.js';
import { landmarksFor, CLEAR } from '../src/world/landmarks.js';
import { Wanderers, compass } from '../src/world/Wanderers.js';
import { WANDERERS } from '../src/config/wanderers.js';

/**
 * Phase 5c: the people who aren't yours. A hermit in a hut and bandits at
 * their camps, both placed from the seed and built into the land as it's
 * generated; explorers crossing the country; messengers bringing news that
 * points the way to them. All harmless, all ambient.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

// --- where the landmarks are ---------------------------------------------------------

const seeds = [1, 42, 777, 4242, 99999, 31337];
let allHaveHut = true, allDry = true, allFar = true, campsOk = true;
for (const seed of seeds) {
  const { world } = generateEndlessWorld({ seed });
  const lms = landmarksFor(world.gen);
  const hut = lms.find((l) => l.kind === 'hermit');
  if (!hut) allHaveHut = false;
  if (lms.filter((l) => l.kind === 'camp').length < 2) campsOk = false;
  for (const l of lms) {
    if (world.gen.waterLevelAt(l.x, l.z)) allDry = false;
    const d = Math.hypot(l.x, l.z);
    if (d < 250) allFar = false;
  }
}
ok('every world gets a hermit\'s hut', allHaveHut);
ok('and at least two bandit camps', campsOk);
ok('all on dry land', allDry);
ok('and well away from where you start', allFar);

{
  const a = landmarksFor(generateEndlessWorld({ seed: 42 }).world.gen);
  const b = landmarksFor(generateEndlessWorld({ seed: 42 }).world.gen);
  ok('the same seed puts them in the same places', JSON.stringify(a.map(({ kind, x, z, y }) => [kind, x, z, y])) === JSON.stringify(b.map(({ kind, x, z, y }) => [kind, x, z, y])));
  const c = landmarksFor(generateEndlessWorld({ seed: 43 }).world.gen);
  ok('a different seed puts them somewhere else', a[0].x !== c[0].x || a[0].z !== c[0].z);
}

// --- built into the land, the same whichever chunk comes first ------------------------

{
  const { world: w1 } = generateEndlessWorld({ seed: 777 });
  const hut = landmarksFor(w1.gen).find((l) => l.kind === 'hermit');
  // One world makes the hut's chunks west to east, the other east to west.
  const { world: w2 } = generateEndlessWorld({ seed: 777 });
  const cxs = [(hut.x - 8) >> 4, (hut.x + 8) >> 4], czs = [(hut.z - 8) >> 4, (hut.z + 8) >> 4];
  for (let cx = cxs[0]; cx <= cxs[1]; cx++) for (let cz = czs[0]; cz <= czs[1]; cz++) w1.getChunk(cx, cz);
  for (let cx = cxs[1]; cx >= cxs[0]; cx--) for (let cz = czs[1]; cz >= czs[0]; cz--) w2.getChunk(cx, cz);
  let same = true;
  for (let x = hut.x - 7; x <= hut.x + 7; x++) for (let z = hut.z - 7; z <= hut.z + 7; z++) for (let y = hut.y - 2; y < hut.y + CLEAR; y++) {
    if (w1.getBlock(x, y, z) !== w2.getBlock(x, y, z)) same = false;
  }
  ok('the hut comes out identical whichever order its chunks are made in', same);
  ok('it has walls', w1.getBlock(hut.x - 2, hut.y, hut.z) === 8 && w1.getBlock(hut.x + 2, hut.y + 1, hut.z) === 8);
  ok('a roof', w1.getBlock(hut.x, hut.y + 3, hut.z) === 7);
  ok('a way in', w1.getBlock(hut.x, hut.y, hut.z + 2) === 0 && w1.getBlock(hut.x, hut.y + 1, hut.z + 2) === 0);
  ok('and room inside, with a light', w1.getBlock(hut.x, hut.y + 1, hut.z) === 0 && w1.getBlock(hut.x, hut.y, hut.z - 1) === 26);
  ok('standing on solid ground, not floating over a dip', w1.getBlock(hut.x - 2, hut.y - 1, hut.z - 2) !== 0);
}

// --- the people ------------------------------------------------------------------------------

{
  const { world } = generateEndlessWorld({ seed: 42 });
  const lms = landmarksFor(world.gen);
  const hut = lms.find((l) => l.kind === 'hermit');
  const camp = lms.find((l) => l.kind === 'camp');
  const news = [];
  const home = { x: world.centreX, z: world.centreZ };
  const w = new Wanderers({ world, rand: rng(5), home: () => home, onNews: (p, line) => news.push({ p, line }) });

  const near = { x: hut.x + 20, y: hut.y, z: hut.z + 20 };
  world.ensureAround(near.x, near.z, 48);
  w.tick(0.05, near);
  const hermit = w.list.find((p) => p.kind === 'hermit');
  ok('come near the hut and the hermit is there', !!hermit && Math.hypot(hermit.x - hut.x, hermit.z - hut.z) < 6);
  for (let i = 0; i < 1200; i++) w.tick(0.05, near);
  ok('and stays about the place', Math.hypot(hermit.x - hut.x - 0.5, hermit.z - hut.z - 0.5) <= WANDERERS.hermit.roam + 1.5);
  ok('only one of them, however long you stand there', w.list.filter((p) => p.kind === 'hermit').length === 1);
  w.tick(0.05, { x: hut.x + 400, y: hut.y, z: hut.z });
  ok('walk away and they\'re gone', !w.list.some((p) => p.kind === 'hermit'));

  const atCamp = { x: camp.x + 0.5, y: camp.y, z: camp.z + 0.5 };
  world.ensureAround(atCamp.x, atCamp.z, 48);
  w.tick(0.05, { x: camp.x + 40, y: camp.y, z: camp.z });
  const bandits = w.list.filter((p) => p.kind === 'bandit');
  ok(`a camp has its bandits (${bandits.length})`, bandits.length >= 3);
  for (let i = 0; i < 400; i++) w.tick(0.05, atCamp);
  const closest = Math.min(...bandits.map((b) => Math.hypot(b.x - atCamp.x, b.z - atCamp.z)));
  ok(`walk into the camp and they back off rather than come at you (nearest ${closest.toFixed(1)})`, closest > 2.5);

  // A messenger, sent straight away.
  world.ensureAround(home.x, home.z, 96);
  const m = w.sendMessenger(home);
  ok('a messenger sets out for your settlement', !!m && Math.hypot(m.x - home.x, m.z - home.z) > 40);
  for (let i = 0; i < 3000 && !news.length; i++) w.tick(0.05, { x: home.x, y: 100, z: home.z });
  ok(`and arrives with news: "${news[0]?.line}"`, news.length === 1 && news[0].p === m);
  const dirs = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const named = dirs.find((d) => news[0]?.line.includes(` ${d}.`) || news[0]?.line.includes(` ${d} `));
  if (named) {
    const lm = lms.find((l) => compass(l.x - home.x, l.z - home.z) === named);
    ok(`news of a place points the right way (${named})`, !!lm);
  } else {
    ok('news with no place in it is just news', true);
  }
  for (let i = 0; i < 400; i++) w.tick(0.05, { x: home.x, y: 100, z: home.z });
  ok('says it once, not every frame', news.length === 1);
}

ok('north is up the map (-z), east is +x', compass(0, -10) === 'north' && compass(10, 0) === 'east' && compass(-5, 5) === 'south-west');

process.exit(f ? 1 : 0);
