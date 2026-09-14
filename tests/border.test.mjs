import * as THREE from 'three';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { PlayerController } from '../src/player/PlayerController.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

/**
 * The border has to be a wall, not a rule.
 *
 * Blocking only the edits meant you could walk off your land and discover it
 * by finding that nothing you tried out there worked. These check that the
 * land actually holds you in, that it does not interfere inside, and that
 * editing beyond it is still refused.
 */

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera();

// --- you cannot walk out, from any side, in any world ------------------------

let escapes = 0, stuckInside = 0;
for (let seed = 1; seed <= 12; seed++) {
  const { world, origin } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed });
  const g = new DuiltGame({ world, scene, bus: null });
  const b = g.territory.bounds();
  const p = new PlayerController(world, cam, origin.spawn);
  p.setBounds(b);
  p.flying = true;
  // Well clear of every hill, so the only thing that can stop us is the border.
  const sky = world.height - 4;

  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    p.position.set(origin.spawn.x, sky, origin.spawn.z);
    for (let i = 0; i < 300; i++) p.moveAndCollide(dx * 0.4, 0, dz * 0.4);
    const out = p.position.x < b.minX || p.position.x > b.maxX + 1
             || p.position.z < b.minZ || p.position.z > b.maxZ + 1;
    if (out) escapes++;
  }

  // and moving a little inside must still work
  p.position.set((b.minX + b.maxX) / 2, sky, (b.minZ + b.maxZ) / 2);
  const before = p.position.x;
  for (let i = 0; i < 6; i++) p.moveAndCollide(0.4, 0, 0);
  if (p.position.x - before < 2) stuckInside++;
}
ok(`nobody escapes their land (${escapes} escapes in 48 attempts)`, escapes === 0);
ok(`movement inside the border is unaffected (${stuckInside} stuck)`, stuckInside === 0);

// --- the sandbox keeps the whole world --------------------------------------

{
  const { world, origin } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed: 3 });
  const p = new PlayerController(world, cam, origin.spawn);
  p.setBounds(null);
  p.flying = true;
  p.position.set(origin.spawn.x, world.height - 4, origin.spawn.z);
  const before = p.position.x;
  for (let i = 0; i < 100; i++) p.moveAndCollide(0.4, 0, 0);
  ok('with no border set the player roams freely', p.position.x - before > 30);
}

// --- editing beyond it is still refused -------------------------------------

{
  const { world, origin } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed: 5 });
  const g = new DuiltGame({ world, scene, bus: null });
  const b = g.territory.bounds();
  ok('inside your land is editable', g.canEditAt(b.minX + 3, b.minZ + 3).ok);
  ok('one block past the border is not', !g.canEditAt(b.minX - 1, b.minZ + 3).ok);
  ok('and it says why', /outside your land/i.test(g.canEditAt(b.maxX + 1, b.minZ).reason));
}

// --- the wall moves with the land -------------------------------------------

{
  const { world } = generateDuiltWorld({ sizeX: 256, sizeZ: 256, height: 64, seed: 9 });
  const g = new DuiltGame({ world, scene, bus: null });
  const before = g.territory.bounds();
  g.territory.advance();
  const after = g.territory.bounds();
  ok(`claiming the next ring widens the land (${before.maxX - before.minX + 1} to ${after.maxX - after.minX + 1})`,
    after.maxX - after.minX > before.maxX - before.minX);
}

// --- the stroke sits on the blocks that touch the border ---------------------

{
  const { world } = generateDuiltWorld({ sizeX: 128, sizeZ: 128, height: 64, seed: 3 });
  const g = new DuiltGame({ world, scene, bus: null });
  const t = g.territory;
  const b = t.bounds();

  const stroke = () => t.fence.children.find((c) => c.isLineSegments);
  const verts = () => {
    const pos = stroke().geometry.attributes.position;
    const out = [];
    for (let i = 0; i < pos.count; i++) out.push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
    return out;
  };

  ok('the border is drawn as a stroke, not just a wall', !!stroke());

  const pts = verts();
  // Every point must be on one of the four boundary planes.
  const onEdge = pts.every(([x, , z]) =>
    x === b.minX || x === b.maxX + 1 || z === b.minZ || z === b.maxZ + 1);
  ok('every point of it lies on the boundary', onEdge);

  // And must rest on the block under it, not float or sink.
  const topOf = (x, z) => {
    for (let y = world.height - 1; y >= 0; y--) if (world.isSolid(x, y, z)) return y + 1;
    return null;
  };
  let wrong = 0;
  for (const [x, y, z] of pts) {
    // Sample the block just inside the boundary from this point.
    const bx = Math.min(Math.max(Math.floor(x - (x === b.maxX + 1 ? 0.5 : -0.5)), b.minX), b.maxX);
    const bz = Math.min(Math.max(Math.floor(z - (z === b.maxZ + 1 ? 0.5 : -0.5)), b.minZ), b.maxZ);
    const top = topOf(bx, bz);
    if (top == null) continue;
    // A riser joins two heights, so a point may sit at either neighbour's top.
    const near = [topOf(bx - 1, bz), topOf(bx + 1, bz), topOf(bx, bz - 1), topOf(bx, bz + 1), top];
    if (!near.some((h) => h != null && Math.abs(y - h) < 0.1)) wrong++;
  }
  ok(`it rests on the ground all the way round (${wrong} stray of ${pts.length})`, wrong === 0);

  // It follows the terrain rather than sitting at one height.
  const ys = new Set(pts.map(([, y]) => Math.round(y)));
  ok(`it steps with the land rather than lying flat (${ys.size} heights)`, ys.size > 1);

  // Digging a hole on the edge moves it; digging in the middle does not.
  const ex = b.minX, ez = b.minZ + 6;
  const eTop = topOf(ex, ez);
  const beforeCount = verts().length;
  world.setBlock(ex, eTop - 1, ez, 0);
  t.onBlocksChanged([{ x: ex, y: eTop - 1, z: ez }]);
  const lowered = verts().some(([x, y, z]) =>
    Math.abs(x - ex) < 1.01 && Math.abs(z - ez) < 1.01 && y < eTop - 0.5);
  ok('breaking a block on the edge redraws the stroke lower', lowered);

  const mid = { x: (b.minX + b.maxX) >> 1, y: 20, z: (b.minZ + b.maxZ) >> 1 };
  const snapshot = JSON.stringify(verts());
  t.onBlocksChanged([mid]);
  ok('an edit in the middle of the land leaves it alone', JSON.stringify(verts()) === snapshot);
  ok('and the stroke still closes all four sides', verts().length >= beforeCount - 8);

  // The next ring gets its own, drawn round the wider land.
  t.setAge(2);
  const wide = t.bounds();
  ok('a wider ring gets its own stroke', !!stroke() && verts().length > pts.length);
  ok('drawn round the new boundary, not the old one', verts().every(([x, , z]) =>
    x === wide.minX || x === wide.maxX + 1 || z === wide.minZ || z === wide.maxZ + 1));
}

process.exit(f ? 1 : 0);
