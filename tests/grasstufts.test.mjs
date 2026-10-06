import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { GrassView, RADIUS, MAX_TUFTS, DENSITY, GRASS, tuftHash } from '../src/render/GrassView.js';
import { DEFAULTS } from '../src/render/graphics.js';

/**
 * Backlog batch 3, #8: "3D grass tufts on turf. They're light: drawn in
 * batches near you, and fade with distance."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

const scene = { added: [], add(o) { this.added.push(o); }, remove() {} };
const flat = (block = GRASS) => {
  const w = new World({ sizeX: 64, sizeZ: 64, height: 8 });
  for (let x = 0; x < 64; x++) {
    for (let z = 0; z < 64; z++) {
      w.setBlock(x, 0, z, 2);
      w.setBlock(x, 1, z, block);
      w.setSurfaceHeight(x, z, 2);
    }
  }
  return w;
};

{
  const view = new GrassView(scene);
  ok('one batch: a single instanced mesh', scene.added.length === 1 && scene.added[0].isInstancedMesh);
  const w = flat();
  const at = { x: 32, y: 2, z: 32 };
  view.update(w, at, 1000);
  const n = view.mesh.count;
  const area = Math.PI * RADIUS * RADIUS;
  ok(`tufts on the grass round you (${n}), about ${Math.round(DENSITY * 100)}% of it`, n > area * DENSITY * 0.6 && n <= MAX_TUFTS);
  // Every tuft stands on top of the grass, not in it.
  const m = view.mesh.instanceMatrix.array;
  let onTop = true, far = 0, near = 0;
  for (let i = 0; i < n; i++) {
    const y = m[i * 16 + 13], x = m[i * 16 + 12], z = m[i * 16 + 14];
    if (y !== 2) onTop = false;
    const d = Math.hypot(x - 32.5, z - 32.5), s = Math.hypot(m[i * 16], m[i * 16 + 1], m[i * 16 + 2]);
    if (d > RADIUS - 2) far = Math.max(far, s);
    if (d < RADIUS - 8) near = Math.max(near, s);
  }
  ok('each stands on top of the turf', onTop);
  ok(`and they shrink away towards the edge, so there's no line where they stop (${far.toFixed(2)} at the edge, ${near.toFixed(2)} near)`, far < near * 0.4);
  // Where they are doesn't change as you look round or come back.
  const before = Array.from(m.slice(0, n * 16));
  view.update(w, { x: 32.3, y: 2, z: 32.2 }, 1100);
  ok('nothing moves while you stand about', view.mesh.count === n && before.every((v, i) => v === view.mesh.instanceMatrix.array[i]));
  view.update(w, { x: 40, y: 2, z: 32 }, 1200);
  ok('walk on, and they come with you', view.mesh.instanceMatrix.array[12] !== before[12] || view.mesh.count !== n);
  ok('the same column always gets the same tuft', tuftHash(5, 9) === tuftHash(5, 9) && tuftHash(5, 9) !== tuftHash(9, 5));
}

{
  const view = new GrassView(scene);
  view.update(flat(2), { x: 32, y: 2, z: 32 }, 1000);
  ok('none on dirt', view.mesh.count === 0);
  const w = flat();
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) w.setBlock(x, 2, z, 7);
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) w.setSurfaceHeight(x, z, 3);
  view.update(w, { x: 32, y: 3, z: 32 }, 5000);
  ok('none under a floor', view.mesh.count === 0);
  const w2 = flat();
  view.update(w2, { x: 32, y: 2, z: 32 }, 9000);
  const had = view.mesh.count;
  for (let x = 20; x < 44; x++) for (let z = 20; z < 44; z++) w2.setBlock(x, 1, z, 3);
  view.update(w2, { x: 32, y: 2, z: 32 }, 11000);
  const mm = view.mesh.instanceMatrix.array;
  let inside = 0;
  for (let i = 0; i < view.mesh.count; i++) if (mm[i * 16 + 12] >= 20 && mm[i * 16 + 12] < 44 && mm[i * 16 + 14] >= 20 && mm[i * 16 + 14] < 44) inside++;
  ok(`dig the grass up, and its tufts go (${had} → ${view.mesh.count}, ${inside} left on the stone)`, inside === 0 && view.mesh.count < had);
  view.update(w2, { x: 32, y: 2, z: 32 }, 12000, { enabled: false });
  ok('and the setting turns them off', view.mesh.visible === false);
}

ok('on by default, with a switch in graphics settings', DEFAULTS.grass === true && /id="gfx-grass"/.test(ui) && /grass: grass\.checked/.test(ui));
ok('the game draws them every frame, near the player', /this\.grass\.update\(this\.world, this\.player\.position, performance\.now\(\), \{ enabled: this\.graphics\.grass !== false \}\)/.test(game));

process.exit(f ? 1 : 0);
