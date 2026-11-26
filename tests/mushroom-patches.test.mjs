import { World, CHUNK_SIZE } from '../src/world/World.js';
import { ChunkGen, WORLD_HEIGHT } from '../src/world/ChunkGen.js';
import { BIOMES, BIOME_INDEX } from '../src/config/biomes.js';
import { LOG_SIDE_BASE, BLOCKS_BY_ID } from '../src/config/blocks.js';
import { roadAt } from '../src/world/roads.js';

/**
 * PLAY-26: mushroom patches and fallen logs in the three forests.
 * Samples chunks of forest from fixed seeds and checks what stands there.
 */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const FORESTS = ['forestOak', 'forestBirch', 'forestDark'];
const MUSH = new Set([565, 566, 567]);
const LOGS = new Set([0, 1, 2, 3, 4, 5].map((i) => LOG_SIDE_BASE + i));
const SEEDS = [11, 222, 3333, 44444];
const WATER = 9;

const worlds = SEEDS.map((seed) => {
  const gen = new ChunkGen({ seed, height: WORLD_HEIGHT });
  return { seed, gen, world: new World({ gen, height: WORLD_HEIGHT }) };
});

// Chunks (per seed) whose centre is in each forest.
function forestChunks(w, want, limit) {
  const out = [];
  for (let cx = -60; cx < 60 && out.length < limit; cx += 2) {
    for (let cz = -60; cz < 60 && out.length < limit; cz += 2) {
      const x = cx * CHUNK_SIZE + 8, z = cz * CHUNK_SIZE + 8;
      if (BIOMES[w.gen.biomeIndexAt(x, z)].id === want) out.push([cx, cz]);
    }
  }
  return out;
}

const stats = {};
let floating = 0, wet = 0, onRoad = 0, wrongGround = 0, logCount = 0, patchMush = 0;
for (const id of FORESTS) {
  const s = stats[id] = { columns: 0, mush: 0, logs: 0, logsWithMush: 0, patchClusters: 0 };
  const idx = BIOME_INDEX.get(id);
  const def = BIOMES[idx];
  for (const w of worlds) {
    for (const [cx, cz] of forestChunks(w, id, 30)) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const x = cx * CHUNK_SIZE + lx, z = cz * CHUNK_SIZE + lz;
        if (w.gen.biomeIndexAt(x, z) !== idx) continue;
        s.columns++;
        const h = w.gen.heightAt(x, z);
        const here = w.world.getBlock(x, h, z);
        const below = w.world.getBlock(x, h - 1, z);
        if (MUSH.has(here)) {
          s.mush++;
          if (w.gen.waterLevelAt(x, z)) wet++;
          if (roadAt(w.gen, x, z)) onRoad++;
          if (below !== def.surface.top) wrongGround++;
        }
        if (LOGS.has(here)) {
          s.logs++; logCount++;
          if (!BLOCKS_BY_ID.get(below)?.solid && BLOCKS_BY_ID.get(below)?.solid !== undefined) floating++;
          if (below === 0 || below === WATER || LOGS.has(below) || MUSH.has(below)) floating++;
          if (w.gen.waterLevelAt(x, z)) wet++;
          if (roadAt(w.gen, x, z)) onRoad++;
          if (below !== def.surface.top) wrongGround++;
          if (MUSH.has(w.world.getBlock(x, h + 1, z))) s.logsWithMush++;
        }
      }
    }
  }
}
for (const id of FORESTS) {
  const s = stats[id];
  const per1000 = (n) => (n * 1000 / s.columns).toFixed(2);
  console.log(`${id}: ${s.columns} columns, mushrooms ${s.mush} (${per1000(s.mush)}/1000), log blocks ${s.logs} (${per1000(s.logs)}/1000), logs with a cap ${s.logsWithMush}`);
  ok(`${id}: has mushrooms`, s.mush > 0);
  ok(`${id}: has fallen logs`, s.logs > 0);
  // A forest column is a mushroom about 0.1% to 3% of the time with patches.
  ok(`${id}: mushroom rate is plausible`, s.mush / s.columns > 0.001 && s.mush / s.columns < 0.05);
  ok(`${id}: log rate is plausible`, s.logs / s.columns > 0.001 && s.logs / s.columns < 0.05);
}
ok('no mushroom or log on water', wet === 0);
ok('no mushroom or log on a road', onRoad === 0);
ok('every mushroom and log stands on its biome\'s own ground (log blocks sit on it)', wrongGround === 0);
ok(`no log floats (checked ${logCount} log blocks)`, floating === 0);

// Wood matches the biome.
{
  const woodOf = { forestOak: 4, forestBirch: 41, forestDark: 43 };
  let bad = 0;
  for (const id of FORESTS) {
    const idx = BIOME_INDEX.get(id);
    for (const w of worlds) for (const [cx, cz] of forestChunks(w, id, 12)) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const x = cx * CHUNK_SIZE + lx, z = cz * CHUNK_SIZE + lz;
        const b = w.world.getBlock(x, w.gen.heightAt(x, z), z);
        if (LOGS.has(b) && w.gen.biomeIndexAt(x, z) === idx && BLOCKS_BY_ID.get(b).stateOf !== woodOf[id]) bad++;
      }
    }
  }
  ok('each forest lays its own wood', bad === 0);
}

// Same seed, same land: a fresh generator builds identical chunks, and
// features that span a chunk border agree from both sides.
{
  const w = worlds[0];
  const fresh = new World({ gen: new ChunkGen({ seed: w.seed, height: WORLD_HEIGHT }), height: WORLD_HEIGHT });
  let same = true, spans = 0, borderPatches = 0;
  for (const id of FORESTS) {
    for (const [cx, cz] of forestChunks(w, id, 8)) {
      // This chunk and its east neighbour, from two worlds built in opposite orders.
      const a = w.world.getChunk(cx + 1, cz), b = w.world.getChunk(cx, cz);
      const c = fresh.getChunk(cx, cz), d = fresh.getChunk(cx + 1, cz);
      for (let y = 100; y < 140 && same; y++) for (let i = 0; i < CHUNK_SIZE && same; i++) for (let k = 0; k < CHUNK_SIZE; k++) {
        if (a.get(k, y, i) !== d.get(k, y, i) || b.get(k, y, i) !== c.get(k, y, i)) { same = false; break; }
      }
      // A log with blocks on both sides of the x border (x = (cx+1)*16).
      const border = (cx + 1) * CHUNK_SIZE;
      for (let z = cz * CHUNK_SIZE; z < (cz + 1) * CHUNK_SIZE; z++) {
        const h = w.gen.heightAt(border - 1, z);
        if (LOGS.has(w.world.getBlock(border - 1, h, z)) && LOGS.has(w.world.getBlock(border, w.gen.heightAt(border, z), z))) spans++;
        if (MUSH.has(w.world.getBlock(border - 1, h, z)) && MUSH.has(w.world.getBlock(border, w.gen.heightAt(border, z), z))) borderPatches++;
      }
    }
  }
  ok('two generators of one seed build identical neighbouring chunks', same);
  console.log(`border: ${spans} log columns and ${borderPatches} mushroom pairs span a chunk border`);
}

// A log is whole across a border: find logs from the generator's own list
// that cross a border, and check every cell is in the world.
{
  const w = worlds[1];
  let crossing = 0, whole = true;
  for (const id of FORESTS) for (const [cx, cz] of forestChunks(w, id, 40)) {
    const logs = w.gen.fallenLogsFor(cx * CHUNK_SIZE, cz * CHUNK_SIZE);
    for (const log of logs) {
      const cells = log.cells.filter((c) => c[4]);
      const xs = new Set(cells.map((c) => Math.floor(c[0] / CHUNK_SIZE))), zs = new Set(cells.map((c) => Math.floor(c[2] / CHUNK_SIZE)));
      if (xs.size < 2 && zs.size < 2) continue;
      crossing++;
      for (const [x, y, z, b] of cells) if (w.world.getBlock(x, y, z) !== b) whole = false;
    }
  }
  ok(`logs that cross a chunk border are whole (${crossing} found)`, crossing > 0 && whole);
}

// Patches: more than one mushroom close together, away from lone scatter.
{
  const w = worlds[0], gen = w.gen;
  let clustered = 0, total = 0;
  for (const [cx, cz] of forestChunks(w, 'forestOak', 30)) {
    for (const c of gen.patchCentres(cx * CHUNK_SIZE, cz * CHUNK_SIZE)) {
      let n = 0;
      for (let dx = -c.r; dx <= c.r; dx++) for (let dz = -c.r; dz <= c.r; dz++) {
        const x = c.x + dx, z = c.z + dz;
        if (MUSH.has(w.world.getBlock(x, gen.heightAt(x, z), z))) n++;
      }
      total++; if (n >= 3) clustered++;
    }
  }
  ok(`oak patches hold 3 or more mushrooms (${clustered} of ${total})`, total > 0 && clustered / total > 0.5);
}

console.log(f ? `${f} FAILED` : 'all passed');
process.exit(f ? 1 : 0);
