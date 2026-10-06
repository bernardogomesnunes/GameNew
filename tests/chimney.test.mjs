import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { STONE_BRICK, CHIMNEYS, BLOCKS_BY_ID, countsAs } from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { GLYPHS } from '../src/config/glyphs.js';
import { itemIcon } from '../src/config/cubes.js';
import { chimneyBoxes } from '../src/world/propShapes.js';
import { tileFor } from '../src/render/BlockTextures.js';
import { SmokeView } from '../src/render/SmokeView.js';

/**
 * Backlog batch 3, #19: "A chimney block in stone brick and in brick. Needs a
 * new stone brick block."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the blocks, made at the bench ----------------------------------------------------

{
  const ids = [STONE_BRICK, ...CHIMNEYS, 332];
  const items = ids.map((id) => ITEM_FOR_BLOCK.get(id));
  ok(`stone brick, two chimneys and a stone brick wall: ${items.join(', ')}`, items.every((id) => ITEMS_BY_ID.has(id)));
  ok('each made at the bench from things that exist', items.every((id) => {
    const r = RECIPES.find((x) => x.output.id === id);
    return r && Object.keys(r.inputs).every((k) => ITEMS_BY_ID.has(k));
  }));
  ok('a chimney in stone brick and one in brick', RECIPES.find((r) => r.output.id === 'chimney_stone_brick').inputs.stone_brick > 0
    && RECIPES.find((r) => r.output.id === 'chimney_brick').inputs.brick > 0);
  ok('each has its mark and an icon', items.every((id) => GLYPHS[ITEMS_BY_ID.get(id).glyph] && (itemIcon(ITEMS_BY_ID.get(id)) ?? '').startsWith('<svg')));
  const a = tileFor(STONE_BRICK), b = tileFor(9);
  let differ = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 20) differ++;
  ok(`stone brick has big cut stones of its own, not brick's courses (${differ} pixels differ)`, differ > a.length / 16);
  ok('stone brick counts as stone for a building', countsAs(STONE_BRICK) === 3);
}

// --- a flue that stacks ------------------------------------------------------------------

{
  const top = chimneyBoxes({ top: true }), mid = chimneyBoxes({ top: false });
  ok('a chimney is hollow: four walls round a flue', mid.length === 4 && !mid.some((b) => b.minX <= 0.5 && b.maxX >= 0.5 && b.minZ <= 0.5 && b.maxZ >= 0.5));
  ok('the top one has a lip, wider than the flue', top.length === 8 && top.some((b) => b.minX < 0.1 && b.maxY === 1));
  ok('in a stack the walls run on, top to bottom', mid.every((b) => b.minY === 0 && b.maxY === 1));
  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  for (let y = 1; y <= 3; y++) w.setBlock(4, y, 4, CHIMNEYS[1]);
  const c = w.getChunk(0, 0);
  new ChunkMesher({ add() {}, remove() {} }).rebuild(w, c);
  ok(`three stacked: one lip, on the top one (${c.propMesh.geometry.attributes.position.count / 24} boxes)`, c.propMesh.geometry.attributes.position.count === (4 + 4 + 8) * 24);
  ok('you don\'t walk through a chimney', w.collisionBoxAt(4, 2, 4)?.maxY === 3);

  // --- and smoke from the top ------------------------------------------------------------
  ok('the world keeps track of every chimney', w.smokes.size === 3);
  w.setBlock(4, 3, 4, 0);
  ok('and forgets one taken away', w.smokes.size === 2);
  const scene = { added: [], add(o) { this.added.push(o); }, remove() {} };
  const smoke = new SmokeView(scene);
  smoke.update(w, { x: 4, y: 3, z: 4 }, 10000);
  const shown = smoke.stacks.filter((s) => s.group.visible);
  ok('smoke rises from the top of the stack only', shown.length === 1 && shown[0].group.position.y === 3);
  const first = shown[0].puffs.map((p) => p.position.y);
  smoke.update(w, { x: 4, y: 3, z: 4 }, 11000);
  ok('and moves', shown[0].puffs.some((p, i) => p.position.y !== first[i]));
  w.setBlock(9, 1, 9, STONE_BRICK);
  ok('stone brick itself doesn\'t smoke', w.smokes.size === 2 && BLOCKS_BY_ID.get(STONE_BRICK).smoke == null);
}

process.exit(f ? 1 : 0);
