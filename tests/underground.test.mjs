import { ChunkGen, SOIL_MIN, SOIL_MAX, ROCK_LAYERS } from '../src/world/ChunkGen.js';
import { ITEM_FOR_BLOCK } from '../src/config/items.js';
import { BLOCKS_BY_ID, WHITE_STONE, TURQUOISE_STONE, ORANGE_STONE } from '../src/config/blocks.js';

/**
 * Asked for directly: "deeper dirt terrain ... the average should be 6,
 * ranging from 3 to 12, and add more cobblestone to the terrain, this should
 * be naturally appearing", and "different rock types, like grey, white, dark
 * grey, marbled, turquoise, and orangey. Ordered by rarity ... below dirt we
 * should have different layers of different rocks ... and sprinkle some ores
 * here and there but pretty rare."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const g = new ChunkGen({ seed: 7 });

const depths = [];
for (let i = 0; i < 4000; i++) depths.push(g.soilDepthAt((i * 37) % 2000 - 1000, Math.floor(i / 37) * 29 - 1000));
const mean = depths.reduce((a, b) => a + b, 0) / depths.length;
ok(`soil runs ${Math.min(...depths)} to ${Math.max(...depths)} deep`, Math.min(...depths) >= SOIL_MIN && Math.max(...depths) <= SOIL_MAX && SOIL_MIN === 3 && SOIL_MAX === 12);
ok(`and about 6 on average (${mean.toFixed(2)})`, mean > 5.3 && mean < 7);

const counts = new Map();
for (let i = 0; i < 20000; i++) {
  const r = g.rockAt((i * 13) % 800 - 400, 10 + (i % 50), (Math.floor(i / 60) * 7) % 800 - 400, 100);
  counts.set(r, (counts.get(r) ?? 0) + 1);
}
const order = ROCK_LAYERS.map(([id]) => counts.get(id) ?? 0);
ok(`six rocks in layers, each rarer than the last (${order.join(' > ')})`, order.every((n, i) => n > 0 && (i === 0 || n < order[i - 1])));
ok('grey, white, dark grey, marbled, turquoise, orange', ROCK_LAYERS.map(([id]) => BLOCKS_BY_ID.get(id).name).join(', ') === 'Stone, White Stone, Dark Grey Stone, Marble, Turquoise Stone, Orange Stone');
// Reported: "weird blue blocks that I don't recognise" — the dark grey layer
// was the Stone Kingdom's slate-blue cut Dark Stone. It is its own rock now.
ok('the dark grey layer is natural rock, not the Stone Kingdom\'s cut Dark Stone', !ROCK_LAYERS.some(([id]) => id === 156)
  && BLOCKS_BY_ID.get(238).glyph === 'stone');
ok('the new rocks can be mined and carried', [WHITE_STONE, TURQUOISE_STONE, ORANGE_STONE].every((id) => ITEM_FOR_BLOCK.has(id)));

let cobble = 0;
for (let i = 0; i < 20000; i++) if (g.rockAt(i % 200, 95, Math.floor(i / 200), 100) === 8) cobble++;
ok(`cobble lies in pockets near the top of the rock (${(cobble / 200).toFixed(1)}%)`, cobble > 200);
let outcrops = 0;
for (let i = 0; i < 40000; i++) if (g.outcropAt(i % 200, Math.floor(i / 200))) outcrops++;
ok(`and now and then breaks the surface (${(outcrops / 400).toFixed(1)}% of ground)`, outcrops > 100 && outcrops < 4000);

let ores = 0;
for (let i = 0; i < 100000; i++) if (g.strayOreAt(i % 300, 20 + (i % 40), Math.floor(i / 300))) ores++;
ok(`ore turns up in any rock, rarely (${(ores / 1000).toFixed(2)}%)`, ores > 50 && ores < 1000);

process.exit(f ? 1 : 0);
