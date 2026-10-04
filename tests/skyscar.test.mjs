import { Chunk } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { skyAt, skyColumn, FLOOR, SCAR_DEPTH } from '../src/world/skyKingdom.js';
import { isWater } from '../src/config/blocks.js';

/**
 * Backlog batch 2: "the Sky Kingdom island — a hole in the ground below it,
 * as if it had been torn out of the land."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const H = 200;
// The top of the ground in a column of a chunk, below the island.
const groundIn = (chunk, lx, lz, below) => { for (let y = below; y > 0; y--) if (chunk.get(lx, y, lz) !== 0) return y; return -1; };

// Find a seed whose island sits over dry land in its middle, so there's ground to scar.
let found = null;
for (let seed = 1; seed < 40 && !found; seed++) {
  const plain = new ChunkGen({ seed });
  const at = skyAt(plain);
  const cx = Math.floor(at.x / 16), cz = Math.floor(at.z / 16);
  const before = new Chunk(cx, cz, H); plain.fill(null, before);
  const lx = ((at.x % 16) + 16) % 16, lz = ((at.z % 16) + 16) % 16;
  const col = skyColumn(seed, at.x, at.z, at.x, at.z);
  const g0 = groundIn(before, lx, lz, col.bottom - 1);
  if (g0 > 10 && !isWater(before.get(lx, g0, lz))) found = { seed, at, cx, cz, lx, lz, col, g0, before };
}
ok('some world has its island over dry ground', !!found);

if (found) {
  const { seed, at, cx, cz, lx, lz, col, g0, before } = found;
  const sky = new ChunkGen({ seed }); sky.sky = true;
  const after = new Chunk(cx, cz, H); sky.fill(null, after);
  const g1 = groundIn(after, lx, lz, col.bottom - 1);
  const want = Math.round((FLOOR - 1 - col.bottom) * SCAR_DEPTH);
  ok(`under its middle the ground is dug out (${g0} → ${g1}, ${want} deep)`, g0 - g1 === want);
  ok('to a floor of loose dirt or gravel', [2, 23].includes(after.get(lx, g1, lz)));
  ok('half as deep as the island is thick there, so it fits under it', SCAR_DEPTH === 0.5 && want > 10);

  // Shallower towards the rim: the hole is the island's underside in reverse.
  let rimDug = null;
  for (let r = 100; r > 60 && rimDug == null; r -= 4) {
    const x = at.x + r, z = at.z, c = skyColumn(seed, at.x, at.z, x, z);
    if (!c) continue;
    rimDug = Math.round((FLOOR - 1 - c.bottom) * SCAR_DEPTH);
  }
  ok(`shallow near the rim (${rimDug}), deepest in the middle (${want})`, rimDug != null && rimDug < want / 2);

  // Off the island, the ground is as it was.
  const plain = new ChunkGen({ seed });
  const ocx = Math.floor((at.x + 200) / 16);
  const a = new Chunk(ocx, cz, H), b = new Chunk(ocx, cz, H);
  plain.fill(null, a); sky.fill(null, b);
  let same = true;
  for (let x = 0; x < 16 && same; x++) for (let z = 0; z < 16 && same; z++) for (let y = 0; y < 120; y++) if (a.get(x, y, z) !== b.get(x, y, z)) { same = false; break; }
  ok('away from it, nothing is dug', same);
}

// Not on the white path: no island, no hole.
{
  const { seed, cx, cz, before } = found ?? {};
  if (found) {
    const again = new Chunk(cx, cz, H); new ChunkGen({ seed }).fill(null, again);
    let same = true;
    for (let x = 0; x < 16 && same; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 120; y++) if (again.get(x, y, z) !== before.get(x, y, z)) { same = false; break; }
    ok('without the island (the white path), the ground is whole', same);
  }
}

process.exit(f ? 1 : 0);
