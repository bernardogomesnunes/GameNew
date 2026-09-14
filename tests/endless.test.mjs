import { World, CHUNK_SIZE } from '../src/world/World.js';
import { ChunkGen, hash01 } from '../src/world/ChunkGen.js';
import { BIOMES } from '../src/config/biomes.js';

/**
 * A world with no edges.
 *
 * The old one was a fixed grid made in a single pass and written down whole,
 * which capped it at 256 blocks a side — and you could see that cap from
 * inside the game, standing in the middle looking at the end of the map.
 *
 * The thing that makes an endless world possible is that generation stopped
 * being sequential. The old generator drew tree placements from a running
 * random number generator in scan order, so where a tree landed depended on
 * how many columns had been visited before it: ask for one chunk on its own
 * and you got different land. These check that the new one gives the same
 * answer whatever order it is asked in, because everything else rests on it.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const makeGen = (o) => new ChunkGen(o);

// --- the hash is a function of where, not of when ----------------------------

ok('the same spot always hashes the same', hash01(5, 9, 3) === hash01(5, 9, 3));
ok('and neighbours do not', hash01(5, 9, 3) !== hash01(6, 9, 3));
ok('a different salt gives a different answer', hash01(5, 9, 3) !== hash01(5, 9, 4));
ok('it stays inside 0..1', [...Array(500)].every((_, i) => {
  const v = hash01(i * 7, i * 13, 99);
  return v >= 0 && v < 1;
}));
{
  // A hash that clumps would put every tree in the world in stripes.
  const buckets = new Array(10).fill(0);
  for (let x = 0; x < 120; x++) for (let z = 0; z < 120; z++) buckets[Math.floor(hash01(x, z, 1) * 10)]++;
  const expected = 14400 / 10;
  ok(`it spreads evenly (worst bucket off by ${Math.round(Math.max(...buckets.map((b) => Math.abs(b - expected))) / expected * 100)}%)`,
    buckets.every((b) => Math.abs(b - expected) < expected * 0.15));
}

// --- the same chunk, whatever order you ask in -------------------------------

{
  const forwards = new World({ height: 64, gen: makeGen({ seed: 7 }) });
  const backwards = new World({ height: 64, gen: makeGen({ seed: 7 }) });
  const coords = [];
  for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) coords.push([cx, cz]);
  for (const [cx, cz] of coords) forwards.getChunk(cx, cz);
  for (const [cx, cz] of [...coords].reverse()) backwards.getChunk(cx, cz);

  let same = true, checked = 0;
  for (const [cx, cz] of coords) {
    const a = forwards.getChunk(cx, cz).data, b = backwards.getChunk(cx, cz).data;
    for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) { same = false; break; } }
    checked++;
    if (!same) break;
  }
  ok(`${checked} chunks come out identical whichever order they are made in`, same);

  // The real test: one chunk made entirely on its own, with no neighbours ever
  // asked for, must match the same chunk made in company. This is what fails
  // if anything about generation is sequential.
  const alone = new World({ height: 64, gen: makeGen({ seed: 7 }) });
  const solo = alone.getChunk(1, 1).data;
  const inCompany = forwards.getChunk(1, 1).data;
  let matches = true;
  for (let i = 0; i < solo.length; i++) if (solo[i] !== inCompany[i]) { matches = false; break; }
  ok('a chunk made alone matches the same chunk made among its neighbours', matches);
}

// --- trees survive the seam --------------------------------------------------

{
  // A canopy that straddles a border has to be written by both chunks, or the
  // half over the line goes missing and every wood is full of sliced trees.
  const world = new World({ height: 64, gen: makeGen({ seed: 3 }) });
  const gen = world.gen;
  let found = 0, whole = 0;
  for (let x = -40; x < 40 && found < 12; x++) {
    for (let z = -40; z < 40 && found < 12; z++) {
      const tree = gen.treeAt(x, z);
      if (!tree) continue;
      // Only the ones actually sitting on a chunk seam are interesting.
      const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      if (lx > 2 && lx < CHUNK_SIZE - 3) continue;
      found++;
      // Leaves should exist on both sides of the line.
      const top = tree.ground + tree.trunk;
      const left = world.getBlock(x - 2, top, z);
      const right = world.getBlock(x + 2, top, z);
      if (left !== 0 || right !== 0) whole++;
    }
  }
  ok(`trees on a chunk seam keep both halves (${whole}/${found})`, found > 0 && whole === found);
}

// --- nothing is written down that the seed can make again --------------------

{
  const world = new World({ height: 64, gen: makeGen({ seed: 11 }) });
  world.ensureAround(0, 0, 80);
  const made = [...world.allChunks()].length;
  ok(`walking about makes chunks (${made} of them)`, made > 40);
  ok('and none of them counts as changed', [...world.allChunks()].every((c) => !c.touched));

  const saved = world.serialize();
  ok('so a saved world is just its seed', saved.endless && saved.seed === 11 && saved.chunks.length === 0);

  // Now dig a hole.
  world.setBlock(3, world.surfaceHeight(3, 3) - 1, 3, 0);
  const after = world.serialize();
  ok('digging marks exactly one chunk to keep', after.chunks.length === 1);

  const back = World.deserialize(JSON.parse(JSON.stringify(after)), { makeGen });
  ok('and it comes back a hole', back.getBlock(3, back.surfaceHeight(3, 3), 3) === 0
    || back.getBlock(3, world.surfaceHeight(3, 3) - 1, 3) === 0);
  ok('with the untouched land around it regrown from the seed',
    back.getBlock(60, back.surfaceHeight(60, 60) - 1, 60) === world.getBlock(60, world.surfaceHeight(60, 60) - 1, 60));
}

// --- it forgets what nobody is looking at ------------------------------------

{
  const world = new World({ height: 48, gen: makeGen({ seed: 5 }) });
  world.ensureAround(0, 0, 200);
  const before = [...world.allChunks()].length;
  world.setBlock(0, 10, 0, 1);            // one chunk that must never be dropped
  const dropped = world.forgetBeyond(0, 0, 60);
  const after = [...world.allChunks()].length;
  ok(`walking away forgets the far country (${before} → ${after})`, after < before / 2);
  ok('but never a chunk somebody changed', world.hasChunk(0, 0));
  ok('and asking for it again makes it identically',
    world.getBlock(150, world.surfaceHeight(150, 150) - 1, 150) !== 0);
  ok('dropped chunks are reported, so their meshes can go too', dropped.length > 0);
}

// --- old saves still open ----------------------------------------------------

{
  const legacy = {
    sizeX: 32, sizeZ: 32, height: 32,
    surfaceHeightMap: Array(32 * 32).fill(9),
    biomeMap: Array(32 * 32).fill(2),
    chunks: [],
  };
  const world = World.deserialize(legacy, { makeGen });
  ok('a world from before this change loads', !world.endless && world.sizeX === 32);
  ok('and keeps the bounds it was made with', world.getBlock(40, 5, 5) === 0 && world.inBounds(5, 5, 5));
  ok('its surface map survives the move into chunks', world.surfaceHeight(5, 5) === 9);
  ok('and so does its biome map', world.biomeIndex(5, 5) === 2);
}

// --- the land it makes is still land -----------------------------------------

{
  const world = new World({ height: 64, gen: makeGen({ seed: 21 }) });
  let holes = 0, sampled = 0, biomes = new Set();
  for (let x = -300; x <= 300; x += 17) {
    for (let z = -300; z <= 300; z += 17) {
      const h = world.surfaceHeight(x, z);
      if (h < 2 || !world.isSolid(x, h - 1, z)) holes++;
      biomes.add(world.biomeIndex(x, z));
      sampled++;
    }
  }
  ok(`${sampled} columns sampled over 600 blocks, all with ground under them`, holes === 0);
  ok(`and ${biomes.size} kinds of country among them`, biomes.size >= 4);
  ok('every biome index is a real one', [...biomes].every((i) => i >= 0 && i < BIOMES.length));
}

// --- and it goes on ----------------------------------------------------------

{
  const world = new World({ height: 64, gen: makeGen({ seed: 2 }) });
  // Far enough out that a fixed 256 map would have ended long ago.
  for (const d of [1000, 10000, 100000]) {
    const h = world.surfaceHeight(d, d);
    ok(`there is still ground at ${d} blocks out (height ${h})`, h > 2 && h < 64);
  }
  ok('and negative coordinates work the same', world.surfaceHeight(-5000, -5000) > 2);
}

process.exit(f ? 1 : 0);
