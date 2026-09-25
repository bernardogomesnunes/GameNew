import { World, CHUNK_SIZE } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { SyncEngine } from '../src/storage/SyncEngine.js';

/**
 * Reported as a worry, not yet a bug: "as with world generation, if we keep
 * changing things as is, people will lose their games." Traced to a real
 * mechanism — an endless world only ever saves chunks somebody has *edited*
 * (`chunk.touched`); everything else is regenerated from the seed by
 * whatever generator code happens to be running when the chunk is next
 * needed, which is not necessarily the code that generated it the last time
 * the player actually saw it. Change TerrainGenerator/ChunkGen/the biome
 * logic and the untouched ground around something a player built can come
 * back a different height, or with the river gone, the next time they load.
 *
 * Fix: a save also carries every chunk touching the player's claimed land
 * (`keepBounds`, in World.serialize and SyncEngine.snapshot/diff/push),
 * touched or not — bounded to the one region somebody actually has a stake
 * in, not to everywhere they've ever walked (that would defeat the entire
 * point of an endless, seed-generated world).
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

function makeWorld() {
  return new World({ height: 32, gen: new ChunkGen({ seed: 7, height: 32 }) });
}

// --- World.serialize --------------------------------------------------------

{
  const world = makeWorld();
  // Touch one block, deep inside chunk (0,0).
  world.setBlock(2, 5, 2, 3);
  const touchedChunk = world.getChunk(0, 0);
  ok('editing a block marks its chunk touched', touchedChunk.touched);

  // Claimed land spanning several chunks the player never edited.
  const bounds = { minX: -CHUNK_SIZE, maxX: CHUNK_SIZE * 2 - 1, minZ: -CHUNK_SIZE, maxZ: CHUNK_SIZE * 2 - 1 };
  const expectedChunks = new Set();
  for (let cx = bounds.minX >> 4; cx <= bounds.maxX >> 4; cx++) {
    for (let cz = bounds.minZ >> 4; cz <= bounds.maxZ >> 4; cz++) expectedChunks.add(`${cx},${cz}`);
  }

  const withoutBounds = world.serialize();
  ok('without a territory, only the touched chunk is saved', withoutBounds.chunks.length === 1);

  const withBounds = world.serialize({ keepBounds: bounds });
  const savedKeys = new Set(withBounds.chunks.map((c) => `${c.cx},${c.cz}`));
  ok(`with a territory, every chunk it touches is saved too (${expectedChunks.size} chunks)`,
    [...expectedChunks].every((k) => savedKeys.has(k)));
  ok('including chunks the player never actually edited',
    savedKeys.has('1,1') && !world.getChunk(1, 1).touched);
  ok('and nothing outside the territory or the edit gets pulled in for free',
    !savedKeys.has('5,5'));
}

// --- restoring it: the territory really does survive a fresh generator ------

{
  // A world generated with the terrain generator as it exists *right now*,
  // saved with its territory, then reloaded through a *different* generator
  // standing in for "the code changed between sessions". The saved chunks
  // must come back exactly as they were, not as the new generator would
  // have made them.
  const world = makeWorld();
  const bounds = { minX: 0, maxX: CHUNK_SIZE - 1, minZ: 0, maxZ: CHUNK_SIZE - 1 };
  const chunk = world.getChunk(0, 0);
  const originalBlock = world.getBlock(3, 4, 3);
  const saved = world.serialize({ keepBounds: bounds });

  class DifferentGen extends ChunkGen {
    fill(w, c) {
      super.fill(w, c);
      // Stand in for "the generator changed": flood the chunk with a block
      // the real generator would never place here.
      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) w.setBlock(c.cx * CHUNK_SIZE + x, 4, c.cz * CHUNK_SIZE + z, 99);
      }
    }
  }
  const restored = World.deserialize(saved, {
    makeGen: (o) => new DifferentGen({ ...o, seed: 7 }),
  });
  ok('a chunk saved with the territory restores its real content',
    restored.getBlock(3, 4, 3) === originalBlock && restored.getBlock(3, 4, 3) !== 99);

  // A chunk *outside* the saved territory, asked for after the "upgrade",
  // does regenerate with the new generator — this is supposed to happen,
  // it's the entire point of an endless world.
  ok('a chunk outside the territory is free to reflect a changed generator',
    restored.getBlock(20 * CHUNK_SIZE, 4, 20 * CHUNK_SIZE) === 99);
}

// --- the same protection on the cloud sync path ------------------------------

{
  const world = makeWorld();
  world.setBlock(2, 5, 2, 3);
  const bounds = { minX: -CHUNK_SIZE, maxX: CHUNK_SIZE - 1, minZ: -CHUNK_SIZE, maxZ: CHUNK_SIZE - 1 };
  const engine = new SyncEngine({ transport: null, bus: null });

  const withoutBounds = engine.snapshot(world);
  ok('the sync snapshot also defaults to touched-only', withoutBounds.length === 1);

  const withBounds = engine.snapshot(world, bounds);
  ok('and also picks up the whole territory when asked',
    withBounds.length === 4 && withBounds.some((e) => e.cx === -1 && e.cz === -1));
}

process.exit(f ? 1 : 0);
