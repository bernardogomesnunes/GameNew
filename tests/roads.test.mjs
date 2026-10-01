import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { landmarksFor } from '../src/world/landmarks.js';
import { roadsFor, roadAt, roadBlock, HOME_CLEAR } from '../src/world/roads.js';
import { BLOCKS_BY_ID, CALCADA, CALCADA_DARK, CALCADA_WAVE } from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { textureFor } from '../src/config/textures.js';

/**
 * Playtest, P9. Asked for directly: "Would be nice to have a road block
 * looking like calçada portuguesa, and have old roads generating in terrain
 * connected to the structures that we already added."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const textures = readFileSync(new URL('../src/render/BlockTextures.js', import.meta.url), 'utf8');

// --- the calçada -------------------------------------------------------------------------------

ok('three calçada blocks: white, dark and the wave', [CALCADA, CALCADA_DARK, CALCADA_WAVE].every((id) => BLOCKS_BY_ID.get(id)?.name.startsWith('Calçada') || BLOCKS_BY_ID.get(id)?.name === 'Dark Calçada'));
ok('white is white and dark is dark', (BLOCKS_BY_ID.get(CALCADA).color >> 16) > 0xd0 && (BLOCKS_BY_ID.get(CALCADA_DARK).color >> 16) < 0x60);
ok('little square setts in mortar', textureFor('calcada')?.setts > 0 && /if \(recipe\.setts\)/.test(textures));
ok('and the wave of dark stone through white', textureFor('calcada_wave')?.wave === true && /if \(recipe\.wave\)/.test(textures));
ok('made at the bench from stone', ['calcada', 'calcada_dark', 'calcada_wave'].every((id) =>
  ITEMS_BY_ID.get(id)?.block && RECIPES.some((r) => r.output.id === id && r.station === 'hand')));

// --- old roads -----------------------------------------------------------------------------------

for (const seed of [5, 41, 2024]) {
  const gen = new ChunkGen({ seed });
  const cells = roadsFor(gen);
  const lms = landmarksFor(gen);
  // A landmark is on the road if road cells come up to its edge.
  const reached = lms.filter((l) => {
    for (let x = l.x - l.half - 5; x <= l.x + l.half + 5; x++) for (let z = l.z - l.half - 5; z <= l.z + l.half + 5; z++) if (cells.has(`${x},${z}`)) return true;
    return false;
  });
  ok(`seed ${seed}: ${cells.size} road cells, reaching ${reached.length} of ${lms.length} places`, cells.size > 1500 && reached.length >= lms.length * 0.6);
  const home = gen.biomes;
  ok('  they stop short of your own land', [...cells.keys()].every((k) => {
    const [x, z] = k.split(',').map(Number);
    return Math.hypot(x - home.centreX, z - home.centreZ) > HOME_CLEAR - 6;
  }));
  ok('  and run past no landmark\'s middle', lms.every((l) => !cells.has(`${l.x},${l.z}`)));
}

{
  const gen = new ChunkGen({ seed: 41 });
  ok('the same roads every time for a seed', roadsFor(gen) === roadsFor(gen)
    && roadsFor(new ChunkGen({ seed: 41 })).size === roadsFor(gen).size);
  // Worn: crowns are mostly calçada and cobble, some gravel, a few gaps.
  const crowns = [...roadsFor(gen)].filter(([, k]) => k === 'crown').map(([key]) => key.split(',').map(Number));
  const laid = crowns.map(([x, z]) => roadBlock('crown', x, z, gen.seed, { calcada: 'c', cobble: 'o', gravel: 'g' }));
  const share = (v) => laid.filter((b) => b === v).length / laid.length;
  ok(`an old road: calçada (${(share('c') * 100).toFixed(0)}%), cobble, gravel and gaps of grass (${(share(null) * 100).toFixed(0)}%)`,
    share('c') > 0.45 && share('o') > 0.1 && share('g') > 0.05 && share(null) > 0.05 && share(null) < 0.2);

  // In the world: on the ground, following it up and down, bridged over water.
  const world = new World({ height: 160, gen });
  let onGround = 0, checked = 0, bridged = 0, trees = 0;
  for (const [x, z] of crowns.slice(0, 4000)) {
    if (!world.getChunk(x >> 4, z >> 4)) continue;
    const water = gen.waterLevelAt(x, z);
    const h = gen.heightAt(x, z);
    const top = world.getBlock(x, water ? water - 1 : h - 1, z);
    if (water) { if (top === 7) bridged++; continue; }
    checked++;
    if ([CALCADA, 8, 23].includes(top) || BLOCKS_BY_ID.get(top)?.soil || top === 6) onGround++;
    if (gen.treeAt(x, z)) trees++;
  }
  ok(`laid in the ground's top, rising and falling with it (${onGround} of ${checked})`, checked > 100 && onGround / checked > 0.9);
  ok(`no tree grows in the road (${trees})`, trees === 0);
  ok(`planked over where it crosses water (${bridged} bridge planks)`, bridged > 0);
}

process.exit(f ? 1 : 0);
