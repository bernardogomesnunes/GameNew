import { readFileSync } from 'node:fs';
import { World, CHUNK_SIZE } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';

/**
 * A chunk can come into being two ways: World.ensureAround() walking a ring
 * around the player and creating whatever is missing, or as a side effect of
 * a NEIGHBOUR's own meshing pass — ChunkMesher.rebuild's blockAt reaches
 * across the chunk boundary via world.getBlock to check whether a face is
 * visible, and getBlock generates whatever chunk it lands in if it doesn't
 * exist yet (World.getChunk's create:true default).
 *
 * Only the first kind used to get queued for its own mesh: ensureAround
 * only ever reports the chunks *it* had to create (skipping anything
 * hasChunk() already says exists), so a chunk born the second way was real —
 * solid, selectable, breakable, since world.getBlock doesn't care whether a
 * mesh exists — but had no mesh at all. Reported directly as blocks that
 * looked unrendered but could still be selected.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- the mechanism: a chunk really can be born this way, dirty and unqueued ---

{
  const world = new World({ height: 32, gen: new ChunkGen({ seed: 1, height: 32, homeX: 0, homeZ: 0 }) });
  const mesher = new ChunkMesher({ add() {}, remove() {} });

  // A radius that reaches exactly one chunk out from the origin, so the
  // chunk mesher's own cross-boundary lookups (up to a few blocks past the
  // edge, via greedy meshing's neighbour sample) land just past what
  // ensureAround itself created.
  const made = world.ensureAround(0, 0, 0);
  const madeIds = new Set(made.map((c) => `${c.cx},${c.cz}`));
  ok('ensureAround made at least the origin chunk', madeIds.has('0,0'));

  const edgeNeighbourExistsBefore = world.hasChunk(1, 0);
  ok('the chunk just past the edge does not exist yet', !edgeNeighbourExistsBefore);

  // Rebuilding the edge chunk's mesh reaches across into its neighbour to
  // decide whether the boundary faces are visible — the same call path a
  // real frame's remesh takes.
  mesher.rebuild(world, world.getChunk(0, 0, false));

  const bornAsSideEffect = world.hasChunk(1, 0);
  ok('meshing the edge chunk silently generated its neighbour', bornAsSideEffect);

  if (bornAsSideEffect) {
    const neighbour = world.getChunk(1, 0, false);
    ok('that neighbour was never in the made list ensureAround returned', !madeIds.has('1,0'));
    ok('but it is real: dirty, solid data, nothing rendered for it yet',
      neighbour.dirty === true && neighbour.mesh === null);
    ok('so it does show up in a sweep of every dirty chunk',
      world.dirtyChunks().includes(neighbour));
  }
}

// --- the fix: streamChunks sweeps dirty chunks too, not just what it made ---

ok('every chunk streaming makes is queued for its mesh (generateQueued)', /generateQueued\([\s\S]{0,1200}this\.remeshQueue\.add\(this\.world\.getChunk\(cx, cz\)\);/.test(game));
ok('streamChunks also sweeps every dirty chunk, not just the ones it made',
  /streamChunks\(\)[\s\S]{0,2500}for \(const chunk of this\.world\.dirtyChunks\(\)\) this\.remeshQueue\.add\(chunk\);/.test(game));

process.exit(f ? 1 : 0);
