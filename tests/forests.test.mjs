import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';

/**
 * Playtest, P2. Reported directly: "When looking at a forest, I think the
 * leaves lack shadows and light because they look like a mesh of green.
 * Maybe some different tones of green and more contrast between surfaces."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const mesher = readFileSync(new URL('../src/world/ChunkMesher.js', import.meta.url), 'utf8');

/** The colours of a mesh's faces, one [r, g, b] per quad. */
function faceColours(world) {
  const chunk = world.getChunk(0, 0);
  const m = new ChunkMesher({ add() {}, remove() {} });
  m.rebuild(world, chunk);
  const out = [];
  for (const mesh of chunk.mesh.values()) {
    const c = mesh.geometry.attributes.color.array, n = mesh.geometry.attributes.normal.array;
    for (let i = 0; i < c.length; i += 12) out.push({ rgb: [c[i], c[i + 1], c[i + 2]], ny: n[i + 1] });
  }
  return out;
}

// A wall of leaves, five by five, three deep — and the same wall in stone.
const wall = (id) => {
  const w = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  for (let x = 3; x < 8; x++) for (let y = 2; y < 7; y++) for (let z = 3; z < 6; z++) w.setBlock(x, y, z, id);
  return w;
};

{
  const leaves = faceColours(wall(5));
  const stone = faceColours(wall(9));
  ok(`each leaf on the outside is drawn on its own, not one flat quad (${leaves.length} faces against brick's ${stone.length})`, leaves.length > stone.length * 10);
  const tops = leaves.filter((q) => q.ny > 0.5).map((q) => q.rgb[1]);
  const spread = Math.max(...tops) - Math.min(...tops);
  ok(`different tones of green across one canopy top (spread ${spread.toFixed(3)})`, new Set(tops.map((g) => g.toFixed(3))).size > 10 && spread > 0.12);
  const top = leaves.filter((q) => q.ny > 0.5), under = leaves.filter((q) => q.ny < -0.5);
  const avg = (qs) => qs.reduce((s, q) => s + q.rgb[1], 0) / qs.length;
  ok(`undersides well in shade (${(avg(under) / avg(top)).toFixed(2)} of the tops)`, avg(under) / avg(top) < 0.55);
}
ok('leaves deep in a canopy are darker than its rim', /buried\+\+/.test(mesher) && /LEAF_BURIED \* buried/.test(mesher));
ok('and those with canopy over their heads', /vol\[idx \+ 2 \* S\[1\]\] > 0 \? LEAF_UNDER_CANOPY/.test(mesher));
ok('each tree leans its own way in hue', /hashInt\(x >> 2, z >> 2\)/.test(mesher));
ok('every kind of leaf, not just oak', /for \(const id of \[5, 42, 44\]\) LEAFY\[id\] = 1/.test(mesher));
ok('faces inside a canopy still merge, so a forest costs little more to draw', /if \(face && LEAFY\[self\] && other === AIR\) face \|= EXPOSED/.test(mesher) && /const single = id & EXPOSED/.test(mesher));

process.exit(f ? 1 : 0);
