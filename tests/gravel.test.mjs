import { ChunkGen } from '../src/world/ChunkGen.js';

/**
 * Asked for directly: "Gravel should appear underground more often to be
 * fair" — it was only ever on the bare tops of the green mountains, and the
 * workshop, engineering centre and barracks designs all want some.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

for (const seed of [12345, 777, 2026]) {
  const g = new ChunkGen({ seed });
  let rock = 0, gravel = 0, pockets = 0;
  for (let x = 0; x < 48; x++) for (let z = 0; z < 48; z++) {
    let inPocket = false;
    for (let y = 20; y < 90; y++) {
      const b = g.rockAt(x * 3, y, z * 3, 200);
      rock++;
      if (b === 23) { gravel++; if (!inPocket) pockets++; inPocket = true; } else inPocket = false;
    }
  }
  const share = 100 * gravel / rock;
  ok(`seed ${seed}: gravel is a few in every hundred blocks of rock (${share.toFixed(1)}%), not a seam you hunt for, nor everywhere`, share > 2 && share < 8);
  ok(`seed ${seed}: in pockets all through it (${pockets} met digging straight down here and there)`, pockets > 100);
}

process.exit(f ? 1 : 0);
