import { readFileSync } from 'node:fs';
import { slopeGeometry } from '../src/world/slopes.js';

/**
 * Asked for directly, of the roof's thick edge out over the wall: "can we have
 * that part of the roof appearing when they are connected to a block? That
 * would mean a cut on the side of the wood block the same height of the side
 * when it's not connected".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const SHELL = 0.16;

for (const shape of ['roof', 'roof_lo', 'roof_hi', 'roof_ridge_x', 'roof_peak']) {
  const open = slopeGeometry(shape, 0, null, { filled: false, style: 'slate' }).faces;
  const over = slopeGeometry(shape, 0, null, { filled: true, style: 'slate' }).faces;
  const wall = over.filter((x) => x.color === 'below'), rim = over.filter((x) => x.rim);
  // The open edge's band, as tall as an eave's.
  // The eave's band: four-cornered strips round the outside, bottom pair then top pair.
  const eave = open.filter((x) => x.out[1] === 0 && x.color == null && x.tone === 0.8 && x.pts.length === 4);
  // How thick a band is at its two ends.
  const bandTall = (faces) => Math.max(...faces.map((x) => Math.max(x.pts[3][1] - x.pts[0][1], x.pts[2][1] - x.pts[1][1])));
  // A peak comes down to nothing at every side: over a wall, an edge would
  // only sink into the wall's top, so there's none.
  if (shape === 'roof_peak') { ok(`${shape}: comes down to nothing at every side, so over a wall it has no edge`, rim.length === 0 && wall.length === 0); continue; }
  ok(`${shape}: over a wall, the roof's edge shows along the sides`, rim.length > 0);
  ok(`${shape}:   no taller than an eave's (${bandTall(rim).toFixed(2)} ≤ ${SHELL})`, bandTall(rim) <= SHELL + 1e-6);
  // Where the wall's top is, the rim's bottom is: they meet, never overlap.
  const meet = rim.every((r) => {
    const bottoms = [r.pts[0], r.pts[1]];
    return bottoms.every(([x, y, z]) => y < 1e-6 || wall.some((w) => w.pts.some(([wx, wy, wz]) => Math.abs(wx - x) < 1e-6 && Math.abs(wz - z) < 1e-6 && Math.abs(wy - y) < 1e-6)));
  });
  ok(`${shape}:   the wall comes up to the edge's underside and stops`, meet);
  const top = (faces) => Math.max(...faces.flatMap((x) => x.pts.map((p) => p[1])));
  ok(`${shape}:   the wall stops ${SHELL} under the tiles`, wall.length === 0 || top(wall) <= top(rim) - SHELL + 1e-6);
  ok(`${shape}:   and the edge is the same band an eave shows`, eave.length > 0 && Math.abs(bandTall(eave) - SHELL) < 1e-6);
}

const mesher = readFileSync(new URL('../src/world/ChunkMesher.js', import.meta.url), 'utf8');
ok('the edge is drawn in the roof\'s colour, and hidden against a solid block', /if \(f\.rim\) \{\s*const n = vol\[idx \+ f\.out\[0\] \+ f\.out\[2\] \* PAD\];\s*if \(n > 0 && IS_CUBE\[n\] && !IS_TRANSPARENT\[n\]\) continue;/.test(mesher));

process.exit(f ? 1 : 0);
