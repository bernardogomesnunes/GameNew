import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { layerFor } from '../src/render/BlockTextures.js';
import { roofBlock } from '../src/config/blocks.js';

/**
 * Reported with a picture: a log house's gable was filled with logs, but the
 * side of every slope tile over it was a flat brown wedge — props are drawn
 * in plain colour. The sides of a roof tile on a wall are drawn in the wall's
 * own texture now.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const WOOD = 4, AIR = 0;
const tile = roofBlock({ mat: 1, kind: 'steep', facing: 1 });
const meshOf = (setup) => {
  const w = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  setup(w);
  const chunk = w.getChunk(0, 0);
  new ChunkMesher({ add() {}, remove() {} }).rebuild(w, chunk);
  return chunk;
};
// Textured vertices on the log's layer, above the top of the wall (y = 5).
const logUp = (chunk) => {
  let n = 0;
  for (const mesh of chunk.mesh.values()) {
    const P = mesh.geometry.attributes.position.array, L = mesh.geometry.attributes.layer.array;
    for (let k = 0; k < L.length; k++) if (L[k] === layerFor(WOOD) && P[k * 3 + 1] > 5.01) n++;
  }
  return n;
};

const onWall = meshOf((w) => { w.setBlock(6, 4, 6, WOOD); w.setBlock(6, 5, 6, tile); });
ok('a roof tile on a log wall: its sides are drawn in the log\'s texture', logUp(onWall) > 0);
const alone = meshOf((w) => { w.setBlock(6, 5, 6, tile); w.setBlock(6, 4, 6, AIR); });
ok('a roof tile over nothing has no wall to borrow from', logUp(alone) === 0);
// Boxed in by a different wood, so the walls round it aren't counted too.
const boxed = meshOf((w) => {
  w.setBlock(6, 4, 6, WOOD); w.setBlock(6, 5, 6, tile);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) w.setBlock(6 + dx, 5, 6 + dz, 7);
});
ok('a side against a solid block is never seen, and not drawn', logUp(boxed) === 0);

process.exit(f ? 1 : 0);
