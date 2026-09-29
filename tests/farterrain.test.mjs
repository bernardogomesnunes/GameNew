import { FarTerrain } from '../src/render/FarTerrain.js';
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
far.build(gen, 0, 0, 0);

ok('a ring gets built', far.meshes.length > 0);

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
        if (y !== 40) waterVertexIsFlat = false;
      }
    } else if (!isWaterColoured) {
      sawLandVertex = true;
      if (y === 40) anyLandAtWaterHeight = true;
    }
  }
}

ok('cells over the lake are coloured like water, not the land biome', sawWaterVertex);
ok('cells on dry land keep their land colour', sawLandVertex);
ok('a water cell sits flat at the water surface, not the ground it is floating on', waterVertexIsFlat);
ok('dry land never gets pulled down to the water height it is not under', !anyLandAtWaterHeight);

process.exit(f ? 1 : 0);
