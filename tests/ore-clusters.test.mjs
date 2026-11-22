import { ChunkGen, WORLD_HEIGHT } from '../src/world/ChunkGen.js';
import { Chunk, CHUNK_SIZE } from '../src/world/World.js';

/**
 * PLAY-5: iron and copper come in face-connected clusters (iron 2 to 3,
 * copper 3 to 4), gold stays single. Groups are measured per chunk, the same
 * bounds the generator grows them in. Two clusters touching by chance, or a
 * cluster cut short by a cave or the chunk edge, are allowed for: the claim
 * is about the large majority.
 */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const IRON = 38, COPPER = 39, GOLD = 40;
const sizes = { [IRON]: [], [COPPER]: [], [GOLD]: [] };
const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function groupsOf(chunk, id) {
  const seen = new Set(), out = [];
  const key = (x, y, z) => (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
  for (let x = 0; x < CHUNK_SIZE; x++) for (let z = 0; z < CHUNK_SIZE; z++) for (let y = 0; y < chunk.height; y++) {
    if (chunk.get(x, y, z) !== id || seen.has(key(x, y, z))) continue;
    let n = 0;
    const stack = [[x, y, z]];
    seen.add(key(x, y, z));
    while (stack.length) {
      const [a, b, c] = stack.pop();
      n++;
      for (const [dx, dy, dz] of dirs) {
        const p = a + dx, q = b + dy, r = c + dz;
        if (p < 0 || r < 0 || p >= CHUNK_SIZE || r >= CHUNK_SIZE || q < 0 || q >= chunk.height) continue;
        if (chunk.get(p, q, r) !== id || seen.has(key(p, q, r))) continue;
        seen.add(key(p, q, r));
        stack.push([p, q, r]);
      }
    }
    out.push(n);
  }
  return out;
}

const gen = (seed) => new ChunkGen({ seed });
const make = (g, cx, cz) => { const c = new Chunk(cx, cz, WORLD_HEIGHT); g.fill(null, c); return c; };

let chunks = 0;
for (const seed of [1, 7, 42]) {
  const g = gen(seed);
  for (let cx = -6; cx < 6; cx++) for (let cz = -6; cz < 6; cz++) {
    const c = make(g, cx, cz);
    chunks++;
    for (const id of [IRON, COPPER, GOLD]) sizes[id].push(...groupsOf(c, id));
  }
}
const share = (id, lo, hi) => sizes[id].filter((n) => n >= lo && n <= hi).length / Math.max(1, sizes[id].length);
const hist = (id) => { const h = {}; for (const n of sizes[id]) h[n] = (h[n] || 0) + 1; return JSON.stringify(h); };
console.log(`chunks ${chunks}; copper groups ${sizes[COPPER].length} ${hist(COPPER)}; iron groups ${sizes[IRON].length} ${hist(IRON)}; gold groups ${sizes[GOLD].length} ${hist(GOLD)}`);
console.log(`share in range: copper 3-4 ${share(COPPER, 3, 4).toFixed(3)}, iron 2-3 ${share(IRON, 2, 3).toFixed(3)}, gold 1 ${share(GOLD, 1, 1).toFixed(3)}`);

ok('copper appears', sizes[COPPER].length >= 30);
ok('iron appears', sizes[IRON].length >= 30);
ok('gold appears', sizes[GOLD].length >= 10);
ok('at least 90% of copper groups have 3 to 4 blocks', share(COPPER, 3, 4) >= 0.9);
ok('at least 90% of iron groups have 2 to 3 blocks', share(IRON, 2, 3) >= 0.9);
ok('at least 95% of gold groups are single blocks', share(GOLD, 1, 1) >= 0.95);

// Deterministic: the same seed and chunk give the same blocks.
{
  const a = make(gen(42), 2, 3), b = make(gen(42), 2, 3);
  ok('same seed and chunk generate identical blocks', a.data.every((v, i) => v === b.data[i]));
}

process.exit(f ? 1 : 0);
