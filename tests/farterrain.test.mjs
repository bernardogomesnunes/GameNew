import { FarTerrain, SINK, SPLIT, REACH } from '../src/render/FarTerrain.js';
import { BLOCKS_BY_ID } from '../src/config/blocks.js';

/**
 * FarTerrain sampled the generator's raw ground height and coloured every
 * cell by its land biome — never asking whether that ground was actually
 * underwater. A lake or the sea is ground that dips below water level (see
 * ChunkGen.waterLevelAt), so past render distance, where the real chunks
 * stop and this coarse mesh takes over, every body of water just turned
 * back into wrongly-coloured dry land. Reported directly as blocks that
 * looked unrendered right where real water met the horizon.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const fakeScene = { add() {}, remove() {} };

// A generator with a lake at z < 0 (waterLevelAt returns 40 there) and dry
// land everywhere else, so every sampled cell falls cleanly on one side.
const gen = {
  heightAt: (x, z) => (z < 0 ? 10 : 30),
  biomeIndexAt: () => 0,
  waterLevelAt: (x, z) => (z < 0 ? 40 : 0),
};

const far = new FarTerrain(fakeScene);
far.update(gen, 0, 0);

ok('tiles get built', far.meshes.length > 0);

const waterHex = BLOCKS_BY_ID.get(11)?.color;
const waterRgb = far.waterColour;
ok('the water colour actually is the water block\'s colour', waterRgb.getHex() === waterHex);

let sawWaterVertex = false, sawLandVertex = false, waterVertexIsFlat = true, anyLandAtWaterHeight = false;
for (const mesh of far.meshes) {
  const pos = mesh.geometry.attributes.position.array;
  const col = mesh.geometry.attributes.color.array;
  for (let i = 0; i < pos.length / 3; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const r = col[i * 3], g = col[i * 3 + 1], b = col[i * 3 + 2];
    const isWaterColoured = Math.abs(r - waterRgb.r) < 0.001 && Math.abs(g - waterRgb.g) < 0.001 && Math.abs(b - waterRgb.b) < 0.001;
    if (z < 0) {
      if (isWaterColoured) {
        sawWaterVertex = true;
        if (y !== 40 - SINK) waterVertexIsFlat = false;
      }
    } else if (!isWaterColoured) {
      sawLandVertex = true;
      if (y === 40 - SINK) anyLandAtWaterHeight = true;
    }
  }
}

ok('cells over the lake are coloured like water, not the land biome', sawWaterVertex);
ok('cells on dry land keep their land colour', sawLandVertex);
ok('a water cell sits flat at the water surface, not the ground it is floating on', waterVertexIsFlat);
ok('dry land never gets pulled down to the water height it is not under', !anyLandAtWaterHeight);

// --- reported directly: "the terrain moves with me... blocks flicker" --------
//
// It was one ring rebuilt around you, with its inner edge jumping between two
// sizes as the chunk queue rose and fell, drawn over the real chunks. Now it
// is world-fixed tiles, made a few at a time, masked off wherever a real
// chunk is drawn.

{
  const t = new FarTerrain(fakeScene);
  t.update(gen, 0, 0);
  const firstTiles = new Map(t.layers.map((l, i) => [i, new Map(l.tiles)]));
  ok('the first update makes everything within reach at once', t.layers[0].tiles.size > 20 && t.layers[1].tiles.size > 20);

  // Walk 40 blocks: every tile that was there is the very same mesh, untouched.
  t.update(gen, 40, 0, { budgetMs: 1000 });
  let kept = 0, same = 0;
  for (const [i, before] of firstTiles) {
    for (const [key, mesh] of before) {
      if (!t.layers[i].tiles.has(key)) continue;
      kept++;
      if (t.layers[i].tiles.get(key) === mesh) same++;
    }
  }
  ok(`walking doesn't remake the ground you can already see (${same}/${kept} tiles untouched)`, kept > 0 && same === kept);

  let anyMoved = false;
  for (const mesh of t.meshes) {
    const p = mesh.geometry.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] % 4 !== 0 || p[i + 2] % 4 !== 0) { anyMoved = true; break; }
    }
  }
  ok('every vertex sits on the world grid, not offset to wherever you stood', !anyMoved);

  // Fly a long way: new tiles come a few at a time, not all in one frame.
  const before = t.meshes.length;
  t.update(gen, 3000, 0, { budgetMs: 0 });
  ok('far away, a frame with no time to spare makes at most one tile', t.meshes.length <= before + 1);
  for (let i = 0; i < 400; i++) t.update(gen, 3000, 0, { budgetMs: 1000 });
  const reach = t.meshes.every((m) => {
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox;
    const dx = Math.max(b.min.x - 3000, 0, 3000 - b.max.x), dz = Math.max(b.min.z, 0, -b.max.z);
    return Math.hypot(dx, dz) < REACH + 384;
  });
  ok('and the tiles left behind are let go', reach);

  // The mask: drawn chunks are marked, and an unchanged mask isn't re-sent.
  t.setChunkMask(-2, -2, 4, (cx, cz) => cx === 0 && cz === 0, 16);
  ok('a drawn chunk is marked in the mask', t.maskData[2 * 4 + 2] === 255 && t.maskData.reduce((a, b) => a + b, 0) === 255);
  t.maskTexture.needsUpdate = false;
  const version = t.maskTexture.version;
  t.setChunkMask(-2, -2, 4, (cx, cz) => cx === 0 && cz === 0, 16);
  ok('the same mask twice uploads nothing', t.maskTexture.version === version);
  ok('the split between fine and coarse sits past where real chunks reach', SPLIT > 300);
}

// --- blocky, from the real world ---------------------------------------------------------
// Reported directly: "I still dont like the render distance fake shapes. They
// should be blocky. Cant we like check for whats rendered, and make a fake
// image out of it?"
{
  const { ChunkGen } = await import('../src/world/ChunkGen.js');
  const { BIOMES, surfaceFor } = await import('../src/config/biomes.js');
  const gen = new ChunkGen({ seed: 4242 });
  const t = new FarTerrain(fakeScene);
  t.gen = gen;
  const mesh = t.makeTile(t.layers[0], 6, 6);
  const P = mesh.geometry.attributes.position.array, N = mesh.geometry.attributes.normal.array;
  let slanted = 0, faces = 0;
  for (let i = 0; i < N.length; i += 3) {
    const ny = Math.abs(N[i + 1]);
    if (ny !== 0 && ny !== 1) slanted++;
  }
  // Every face is either flat or upright — no slopes anywhere.
  for (let q = 0; q < P.length; q += 12) {
    faces++;
    const ys = [P[q + 1], P[q + 4], P[q + 7], P[q + 10]];
    const flat = ys.every((y) => y === ys[0]);
    const upright = (P[q] === P[q + 3] && P[q + 3] === P[q + 6]) || (P[q + 2] === P[q + 5] && P[q + 5] === P[q + 8]);
    if (!flat && !upright) slanted++;
  }
  ok(`far ground is made of flat tops and upright sides, nothing sloping (${faces} faces)`, slanted === 0);
}
{
  const { ChunkGen } = await import('../src/world/ChunkGen.js');
  const { BIOMES, surfaceFor } = await import('../src/config/biomes.js');
  const gen = new ChunkGen({ seed: 4242 });
  const t = new FarTerrain(fakeScene);
  t.gen = gen;
  // A column far out is the height and the colour of the real one.
  let checked = 0, right = 0, wooded = 0;
  for (let x = 900; x < 2900 && checked < 60; x += 97) {
    const col = t.column(x, 700, 8);
    if (col.water) continue;
    checked++;
    const h = gen.heightAt(x + 4, 704), b = BIOMES[gen.biomeIndexAt(x + 4, 704)];
    const top = h <= 104 ? 6 : surfaceFor(b, h);
    if (col.top === h - SINK && col.colour.getHex() === BLOCKS_BY_ID.get(top).color) right++;
    if (col.canopy) wooded++;
  }
  ok(`each far column stands at the real ground height, in the colour of the real top block (${right}/${checked})`, checked > 10 && right === checked);
  ok(`and the woods stand up as leaves (${wooded} wooded columns)`, wooded > 0);
}

process.exit(f ? 1 : 0);
