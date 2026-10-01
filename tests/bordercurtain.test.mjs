import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { Territory } from '../src/world/Territory.js';
import { ChunkGen } from '../src/world/ChunkGen.js';

/**
 * Reported: "Age 6 borders disappear completely, no visual cue." The border
 * was four flat sheets hung at one height for the whole ring; at 320 blocks
 * across the edge runs over hills, so the sheet was buried in one place and
 * floating over the next. Now it stands on the ground column by column, and
 * fills in where the ground hadn't loaded yet.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// A real generated world, all of a 256 border loaded.
const TREES = new Set([4, 5, 41, 42, 43, 44]);
const world = new World({ height: 120, gen: new ChunkGen({ seed: 11 }) });
for (let cx = -10; cx <= 10; cx++) for (let cz = -10; cz <= 10; cz++) world.getChunk(cx, cz);
// The ground in a column, found the slow way: down from the sky.
const heightAt = (x, z) => {
  for (let y = world.height - 1; y >= 0; y--) {
    if (TREES.has(world.getBlock(x, y, z))) continue;
    if (world.isSolid(x, y, z)) return y + 1;
  }
  return 0;
};

const t = new Territory({ world, scene: new THREE.Scene(), age: 5 });
const b = t.bounds();
const curtain = t.fence.children.find((c) => c.isMesh);
const pos = curtain.geometry.attributes.position, alpha = curtain.geometry.attributes.color;

// Every column's quad: its head stands CURTAIN (7) over the ground there.
let worst = 0, columns = 0, lo = Infinity, hi = -Infinity;
for (let q = 0; q < pos.count; q += 4) {
  const x = Math.floor(Math.min(pos.getX(q), pos.getX(q + 1)) + 0.01);
  const z = Math.floor(Math.min(pos.getZ(q), pos.getZ(q + 1)) + 0.01);
  const cx = Math.min(Math.max(x, b.minX), b.maxX), cz = Math.min(Math.max(z, b.minZ), b.maxZ);
  const ground = heightAt(cx, cz);
  lo = Math.min(lo, ground); hi = Math.max(hi, ground);
  worst = Math.max(worst, Math.abs(pos.getY(q + 2) - 7 - ground));
  columns++;
}
ok(`the curtain is one column per block of edge (${columns} for a ${t.size}-block border)`, columns === t.size * 4 && t.gaps === 0);
ok(`each stands on its own ground, over ground from ${lo} to ${hi} high (worst ${worst.toFixed(2)} off)`, hi - lo > 6 && worst < 0.01);
ok('strong at the ground, gone at the top', alpha.getW(0) > 0.3 && alpha.getW(2) === 0);
ok('and the ground line is still there', !!t.edge && t.edge.geometry.attributes.position.count > t.size * 8);

// An endless world: the edge past what's loaded is a gap, filled in when it loads.
{
  const gen = new ChunkGen({ seed: 7 });
  const w = new World({ height: 120, gen });
  for (let cx = -3; cx <= 2; cx++) for (let cz = -3; cz <= 2; cz++) w.getChunk(cx, cz);
  const e = new Territory({ world: w, scene: new THREE.Scene(), age: 5 });
  const was = e.gaps;
  ok(`an edge that isn't loaded yet is left as a gap (${was} columns)`, was > 0);
  for (let cx = -10; cx <= 10; cx++) for (let cz = -10; cz <= 10; cz++) w.getChunk(cx, cz);
  ok('nothing redrawn before it\'s time', !e.refreshIfStale(0) || e.gaps < was);
  e.refreshIfStale(Date.now() + 10_000);
  ok(`once the land is there, the border fills in (${e.gaps} gaps left)`, e.gaps === 0);
  ok('and with nothing missing, it\'s left alone', !e.refreshIfStale(Date.now() + 20_000));
}

process.exit(f ? 1 : 0);
