import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { Projectiles, aimAt, bestAim, fly, predictArc, craterCells, GRAVITY, LAUNCH_SPEED, MAX_RANGE, BLAST, LOB, STEEP } from '../src/world/Projectiles.js';
import { CATAPULT, isCatapult, turned, facingOf, BLOCKS_BY_ID, PLACEABLE_BLOCKS } from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { GLYPHS } from '../src/config/glyphs.js';
import { boxesFor } from '../src/world/propShapes.js';

/**
 * Phase 6c — the catapult. Chosen directly: "a buildable siege engine you
 * aim and fire. Stones fly on real arcs and break blocks where they land."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- the thing itself ------------------------------------------------------------------

ok('there is a catapult block', BLOCKS_BY_ID.get(CATAPULT)?.name === 'Catapult' && isCatapult(CATAPULT));
ok('that turns, its other facings states of it',
  [1, 2, 3].every((d) => isCatapult(turned(CATAPULT, d)) && facingOf(turned(CATAPULT, d)) === d && BLOCKS_BY_ID.get(CATAPULT + d).stateOf === CATAPULT));
ok('one in the block list, not four', PLACEABLE_BLOCKS.filter((b) => b.catapult).length === 1);
ok('modelled: wheels, a frame, an arm and a stone in the cup', boxesFor('catapult').length >= 15 && boxesFor('catapult').some((b) => b.maxY > 1.2));
ok('built at the bench from Age 3', RECIPES.some((r) => r.output.id === 'catapult' && r.station === 'hand' && r.age === 3));
ok('picked up as a catapult, whichever way it faced', ITEM_FOR_BLOCK.get(CATAPULT + 3) === 'catapult' && ITEMS_BY_ID.get('catapult').block === CATAPULT);
ok('and drawn as one', typeof GLYPHS.catapult === 'string');

// --- the arc -------------------------------------------------------------------------------

const flat = () => {
  const w = new World({ sizeX: 96, sizeZ: 96, height: 48 });
  for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) w.setBlock(x, 0, z, 3);
  return w;
};

ok(`the longest throw on level ground is v²/g (${MAX_RANGE.toFixed(0)} blocks)`, Math.abs(MAX_RANGE - LAUNCH_SPEED ** 2 / GRAVITY) < 1e-9 && MAX_RANGE > 30);

{
  const w = flat();
  const from = { x: 10.5, y: 2.35, z: 48.5 };
  for (const d of [8, 15, 25, 35]) {
    const to = { x: from.x + d, y: 1, z: from.z };
    const v = aimAt(from, to);
    const landed = fly(w, { ...from, ...v });
    ok(`aimed ${d} blocks out, it comes down there (${landed ? (landed.x - from.x).toFixed(1) : 'never'})`,
      v.inRange && landed && Math.abs(landed.x - to.x) < 1 && Math.abs(landed.z - to.z) < 0.5);
  }
  const near = aimAt(from, { x: from.x + 8, y: 1, z: from.z }), farther = aimAt(from, { x: from.x + 30, y: 1, z: from.z });
  const angle = (v) => Math.atan2(v.vy, Math.hypot(v.vx, v.vz));
  ok('it lobs, always at the same angle — a short throw is a softer one, not a steeper one',
    Math.abs(angle(near) - LOB) < 1e-9 && Math.abs(angle(farther) - LOB) < 1e-9 && Math.hypot(near.vx, near.vy) < Math.hypot(farther.vx, farther.vy));
  const t8 = fly(w, { ...from, ...near }).t;
  ok(`so a short throw is over quickly (${t8.toFixed(1)} s for 8 blocks)`, t8 < 1.5);

  const far = aimAt(from, { x: from.x + 80, y: 1, z: from.z });
  const flewTo = fly(w, { ...from, ...far });
  ok(`out of reach it says so, and throws as far as it can (${(flewTo.x - from.x).toFixed(0)})`,
    !far.inRange && flewTo.x - from.x > MAX_RANGE * 0.9 && flewTo.x - from.x < MAX_RANGE * 1.15);
}

{
  // A wall in the way: it goes over.
  const w = flat();
  for (let y = 1; y <= 7; y++) for (let z = 40; z < 56; z++) w.setBlock(20, y, z, 8);
  const from = { x: 12.5, y: 2.35, z: 48.5 };
  const v = bestAim(w, from, { x: 32.5, y: 1, z: 48.5 });
  const landed = fly(w, { ...from, ...v });
  ok(`over a seven-high wall to land behind it, lobbing higher to clear it (${landed.x.toFixed(1)})`,
    landed.x > 31.5 && landed.x < 33.5 && Math.abs(Math.atan2(v.vy, Math.hypot(v.vx, v.vz)) - STEEP) < 1e-9);
}

{
  // A hard flat shot doesn't tunnel through a one-block wall.
  const w = flat();
  for (let y = 1; y <= 6; y++) for (let z = 40; z < 56; z++) w.setBlock(30, y, z, 8);
  const landed = fly(w, { x: 12.5, y: 4.5, z: 48.5, vx: LAUNCH_SPEED, vy: 4, vz: 0 });
  ok('a fast stone stops at a wall, not past it', landed && landed.x < 30 && landed.cell.x === 30);
}

{
  const w = flat();
  const from = { x: 10.5, y: 2.35, z: 48.5 };
  const v = aimAt(from, { x: 30.5, y: 1, z: 48.5 });
  const arc = predictArc(w, from, v);
  ok(`the arc you see is the one it flies (${arc.points.length} points)`,
    arc.points.length > 10 && Math.abs(arc.landed.x - 30.5) < 1 && Math.max(...arc.points.map((p) => p.y)) > from.y + 4);
}

// --- landing ---------------------------------------------------------------------------------

{
  const w = flat();
  for (let x = 25; x <= 35; x++) for (let y = 1; y <= 4; y++) for (let z = 43; z <= 53; z++) w.setBlock(x, y, z, 7);
  const hits = [];
  const p = new Projectiles({ world: w, onImpact: (s, landed) => hits.push(landed) });
  const from = { x: 10.5, y: 2.35, z: 48.5 };
  p.fire(from, aimAt(from, { x: 30.5, y: 5, z: 48.5 }));
  let t = 0;
  while (p.list.length && t < 10) { p.tick(1 / 60); t += 1 / 60; }
  ok(`a stone in flight lands, in its own time (${t.toFixed(1)} s)`, hits.length === 1 && t > 0.8 && !p.list.length);
  const at = hits[0].cell;
  ok('on the block it was aimed at', Math.abs(at.x - 30) <= 1 && at.y === 4);
  const crater = craterCells(w, { x: at.x + 0.5, y: at.y + 0.5, z: at.z + 0.5 });
  ok(`and knocks out a crater round it (${crater.length} blocks)`, crater.length >= 7 && crater.length <= 30 && crater.every((c) => c.d <= BLAST));
}

// --- in the game -------------------------------------------------------------------------------

ok('Place on a catapult takes hold of it', /isCatapult\(aimed\.block\)\) return void this\.manCatapult\(aimed\)/.test(game));
ok('Break throws while you hold it, and Place lets go', /if \(this\.manning\) return void this\.throwStone\(\);/.test(game) && /if \(this\.manning\) return void this\.letGo\(\);/.test(game));
ok('it throws stone from your bag', /CATAPULT_AMMO = \['stone', 'cobblestone'\]/.test(game) && /inventory\.remove\(ammo\.id, 1\)/.test(game));
ok('you aim by looking: the arc and where it lands are drawn', /this\.projectileView\.setAim\(\{ points: arc\.points/.test(game));
ok('it breaks blocks where it lands, but spares your buildings and chests',
  /craterCells\(this\.world, c\)/.test(game) && /structures\.at\(x, y, z\)\) continue/.test(game) && /isChest\(id\) \|\| isFluid\(id\)/.test(game));
ok('and hurts any bandit or animal under it', /this\.wanderers\.hit\(p, STONE_HITS/.test(game) && /this\.mobs\.hit\(mob, STONE_HITS/.test(game));

process.exit(f ? 1 : 0);
