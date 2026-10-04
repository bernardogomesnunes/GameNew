import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { tileFor, TILE_SIZE } from '../src/render/BlockTextures.js';

/**
 * Requested directly: "Leaves block could have small holes in it like trees
 * have and be somehow more rounded instead of sharp cubes."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const LEAVES = 5, WOOD = 4, STONE = 3;

{
  const tile = tileFor(LEAVES);
  let holes = 0;
  for (let i = 3; i < tile.length; i += 4) if (tile[i] === 0) holes++;
  // The same share of the face as at 16×16: between a twenty-fifth and a quarter.
  const n = TILE_SIZE, all = n * n;
  ok(`a leaf has real holes you see through (${holes} of ${all} pixels)`, holes >= all * 0.04 && holes < all * 0.24);
  const corner = (x, y) => tile[(y * n + x) * 4 + 3];
  ok('its corners are bitten off, so a face reads rounded, not square', corner(0, 0) === 0 && corner(n - 1, 0) === 0 && corner(0, n - 1) === 0 && corner(n - 1, n - 1) === 0);
  ok('and the middle of each edge is still there', corner(n / 2, 0) === 255 && corner(0, n / 2) === 255);
  const stone = tileFor(STONE);
  let solid = true;
  for (let i = 3; i < stone.length; i += 4) if (stone[i] !== 255) solid = false;
  ok('stone has no holes', solid);
}

{
  // Through a hole you see the leaf behind it, not the sky.
  const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  world.setBlock(5, 5, 5, LEAVES); world.setBlock(6, 5, 5, LEAVES);
  world.setBlock(8, 5, 5, STONE); world.setBlock(9, 5, 5, STONE);
  world.setBlock(5, 8, 5, WOOD); world.setBlock(6, 8, 5, LEAVES);
  const mesher = new ChunkMesher({ add() {}, remove() {} });
  const chunk = world.getChunk(0, 0);
  mesher.rebuild(world, chunk);
  const facesAt = (x, y) => {
    let n = 0;
    for (const m of chunk.mesh.values()) {
      const P = m.geometry.attributes.position.array, N = m.geometry.attributes.normal.array;
      for (let q = 0; q < P.length; q += 12) {
        if (Math.abs(N[q]) === 1 && P[q] === x && P[q + 1] >= y && P[q + 1] <= y + 1) n++;
      }
    }
    return n;
  };
  ok('two leaves side by side both draw the face between them', facesAt(6, 5) === 2);
  ok('two stones side by side still hide theirs', facesAt(9, 5) === 0);
  ok('and a trunk inside a canopy shows through the leaves beside it', facesAt(6, 8) >= 1);
}

{
  // A rounded crown: no square layers.
  const gen = new ChunkGen({ seed: 11 });
  const cells = new Map();
  const chunk = { cx: 0, cz: 0, height: 60, get: (x, y, z) => cells.get(`${x},${y},${z}`) ?? 0, set: (x, y, z, b) => cells.set(`${x},${y},${z}`, b) };
  let squareLayers = 0, trees = 0, domed = 0;
  for (let t = 0; t < 12; t++) {
    cells.clear();
    gen.plant(chunk, 8, 8, { style: { canopy: 2, wood: WOOD, leaves: LEAVES }, trunk: 5 + (t % 2), ground: 10 + t });
    trees++;
    const topY = 10 + t + 5 + (t % 2);
    for (let dy = -1; dy <= 1; dy++) {
      let corners = 0;
      for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) if (cells.get(`${8 + dx},${topY + dy},${8 + dz}`) === LEAVES) corners++;
      if (corners === 4) squareLayers++;
    }
    let crown = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (cells.get(`${8 + dx},${topY + 2},${8 + dz}`) === LEAVES) crown++;
    if (crown > 1) domed++;
  }
  ok(`crowns are rounded — no layer fills its square's corners (${squareLayers} square layers in ${trees} trees)`, squareLayers === 0);
  ok(`and domed on top rather than capped with one block (${domed}/${trees})`, domed === trees);
}

process.exit(f ? 1 : 0);
