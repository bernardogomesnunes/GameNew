import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import {
  BLOCKS_BY_ID, PLACEABLE_BLOCKS, WALLS, PILLARS, TRAPDOOR, TRAPDOOR_OPEN, DARK_STONE, DARK_BRICK, SKY_MARBLE,
  isTrapdoor, swungTrapdoor, turned, facingOf, mirrored, lightOf,
} from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { GLYPHS } from '../src/config/glyphs.js';
import { textureFor } from '../src/config/textures.js';
import { tileFor } from '../src/render/BlockTextures.js';
import { boxesFor, wallBoxes, pillarBoxes, PROP_SHAPES } from '../src/world/propShapes.js';
import { itemIcon } from '../src/config/cubes.js';

/**
 * Phase 7a — the decorative pack (docs/plan-phase7-lore.md): walls that join
 * like fences, pillars that stack, trapdoors that open with Place, framed
 * windows, timber framing, vases and urns, banners for both kingdoms, dark
 * stone and dark brick for the Stone Kingdom, sky-marble, gold trim and
 * firefly lanterns for the Sky Kingdom. "Each piece: shape + collision, bag
 * icon, bench recipe, tests."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- every piece: a block, an item, a bench recipe, an icon ---------------------------

const PIECES = ['dark_stone', 'dark_brick', 'sky_marble', 'gold_trim', 'timber_frame',
  'wall_cobble', 'wall_stone', 'wall_brick', 'wall_dark', 'pillar_stone', 'pillar_marble', 'pillar_dark',
  'trapdoor', 'window', 'vase', 'urn', 'banner_white', 'banner_black', 'firefly_lantern'];
{
  const items = PIECES.map((id) => ITEMS_BY_ID.get(id));
  ok(`all ${PIECES.length} pieces are things you can hold`, items.every((i) => i && BLOCKS_BY_ID.has(i.block)));
  ok('each places a block you can put down', items.every((i) => PLACEABLE_BLOCKS.some((b) => b.id === i.block)));
  ok('each is made at the bench', PIECES.every((id) => RECIPES.some((r) => r.output.id === id && r.station === 'hand')));
  ok('from things that exist', PIECES.every((id) => Object.keys(RECIPES.find((r) => r.output.id === id).inputs).every((k) => ITEMS_BY_ID.has(k))));
  ok('each has a mark of its own to draw', items.every((i) => GLYPHS[i.glyph] && GLYPHS[BLOCKS_BY_ID.get(i.block).glyph]));
  ok('and an icon in the bag', items.every((i) => (itemIcon(i) ?? '').startsWith('<svg')));
  const shaped = items.map((i) => BLOCKS_BY_ID.get(i.block)).filter((b) => b.shape);
  ok(`the ${shaped.length} shaped ones are modelled, not left as slabs`, shaped.every((b) => PROP_SHAPES[b.shape]));
}

// --- the kingdoms' stone --------------------------------------------------------------

ok('dark stone and dark brick for the Stone Kingdom — dark, and textured like their pale kin',
  [DARK_STONE, DARK_BRICK].every((id) => (BLOCKS_BY_ID.get(id).color & 0xff) < 0x70)
  && BLOCKS_BY_ID.get(DARK_STONE).glyph === 'stone' && BLOCKS_BY_ID.get(DARK_BRICK).glyph === 'brick');
ok('sky-marble, near white with a cool cast, for the Sky Kingdom',
  (BLOCKS_BY_ID.get(SKY_MARBLE).color & 0xff) > ((BLOCKS_BY_ID.get(SKY_MARBLE).color >> 16) & 0xff));
{
  const tile = tileFor(160);
  let beams = 0;
  // Brown: red well over blue, as a multiple of the plaster's colour.
  for (let i = 0; i < tile.length / 4; i++) if (tile[i * 4] > tile[i * 4 + 2] * 1.6) beams++;
  ok(`timber framing has brown beams painted over its plaster (${beams} pixels)`, textureFor('timber')?.beams && beams > 40);
  ok('gold trim has a texture of its own', !!textureFor('trim') && !!tileFor(159));
}

// --- walls ------------------------------------------------------------------------------

{
  ok('walls: cobble, stone, brick and dark stone, and one for every other stone', WALLS.length === 13 && WALLS.every((w) => BLOCKS_BY_ID.get(w.id).shape === 'wall'));
  ok('running straight through, a wall is one piece with no post', wallBoxes({ px: 1, nx: 1 }).length === 1 && wallBoxes({ px: 1, nx: 1 })[0].maxY < 1);
  const corner = wallBoxes({ px: 1, pz: 1 });
  ok('at a corner it has a post, taller than the wall', corner.some((b) => b.maxY === 1 && b.minX === 0.25) && corner.length === 3);
  ok('alone it is just a post', wallBoxes().length === 1);
  const w = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  w.setBlock(3, 1, 3, 162);
  ok('nothing climbs a wall, the same as a fence', w.collisionBoxAt(3, 1, 3).maxY === 2.5);
  ok('walls join fences and fences join walls', /shape === 'wall'\n?\s*\|\| \(IS_CUBE/.test(readFileSync(new URL('../src/world/ChunkMesher.js', import.meta.url), 'utf8')));
}

// --- pillars ----------------------------------------------------------------------------

{
  ok('three pillars: stone, marble, dark', PILLARS.length === 3 && PILLARS.every((p) => BLOCKS_BY_ID.get(p.id).shape === 'pillar'));
  const alone = pillarBoxes({ base: true, capital: true }), mid = pillarBoxes({ base: false, capital: false });
  ok('alone, a pillar has a base and a capital', alone.length === 6 && alone.some((b) => b.minY === 0 && b.maxX - b.minX > 0.85) && alone.some((b) => b.maxY === 1 && b.maxX - b.minX > 0.85));
  ok('in the middle of a stack, just shaft from top to bottom', mid.length === 2 && mid.every((b) => b.minY === 0 && b.maxY === 1));
  // Three stacked: the mesher gives the bottom a base, the top a capital.
  const w = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  for (let y = 1; y <= 3; y++) w.setBlock(5, y, 5, 166);
  const single = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  single.setBlock(5, 1, 5, 166);
  const m = new ChunkMesher({ add() {}, remove() {} });
  const verts = (world) => { const c = world.getChunk(0, 0); m.rebuild(world, c); return c.propMesh.geometry.attributes.position.count; };
  // A box is 24 vertices: 6 for a lone pillar, and for three stacked
  // 4 (base) + 2 (shaft) + 4 (capital) = 10.
  ok(`three stacked read as one column (${verts(w) / 24} boxes, not ${3 * verts(single) / 24})`, verts(w) === 10 * 24 && verts(single) === 6 * 24);
}

// --- trapdoors ----------------------------------------------------------------------------

{
  ok('a trapdoor turns the way you face', [0, 1, 2, 3].every((d) => facingOf(turned(TRAPDOOR, d)) === d && isTrapdoor(turned(TRAPDOOR, d))));
  ok('Place swings it open, and shut again, keeping its facing',
    [0, 1, 2, 3].every((d) => {
      const shut = turned(TRAPDOOR, d), open = swungTrapdoor(shut);
      return open >= TRAPDOOR_OPEN && facingOf(open) === d && swungTrapdoor(open) === shut;
    }));
  ok('an open one picks up as a trapdoor', ITEM_FOR_BLOCK.get(TRAPDOOR_OPEN + 2) === 'trapdoor');
  ok('the mirror turns it too', facingOf(mirrored(turned(TRAPDOOR, 1), { flipX: true })) === 3);
  const w = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  w.setBlock(2, 1, 2, TRAPDOOR);
  w.setBlock(4, 1, 4, TRAPDOOR_OPEN);
  const shut = w.collisionBoxAt(2, 1, 2);
  ok('shut, it is a floor high in its cell, stood on', shut.minY === 1.8125 && shut.maxY === 2);
  ok('open, you go through', w.collisionBoxAt(4, 1, 4) === null);
  ok('in the game, Place opens and closes it', /trap \? swungTrapdoor\(c\.block, \{ low \}\)/.test(game) && /isTrapdoor\(id\)\) return isOpenTrapdoor\(id\) \? 'Close' : 'Open'/.test(game));
}

// --- windows, banners, vases, lanterns ------------------------------------------------------

{
  const pane = boxesFor('window').filter((b) => b.pane);
  ok('a framed window has crossbars and glass', pane.length === 1 && boxesFor('window').length >= 7);
  const w = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  w.setBlock(6, 1, 6, 176);
  const m = new ChunkMesher({ add() {}, remove() {} });
  const c = w.getChunk(0, 0);
  m.rebuild(w, c);
  const mat = c.propMesh.material[c.propMesh.geometry.groups.at(-1).materialIndex];
  ok('and the glass is drawn see-through', c.propMesh.geometry.groups.length === 3 && mat.transparent && mat.opacity < 0.6);
  ok('a window is solid to walk into', w.collisionBoxAt(6, 1, 6).maxY === 2);

  ok('banners stand taller than a block, on a pole', ['banner_white', 'banner_black'].every((s) => boxesFor(s).some((b) => b.maxY >= 1.9)));
  ok('white with a gold sun, black with a red tower', boxesFor('banner_white').some((b) => b.color === 0xe2c26a && b.minZ >= 0.6)
    && boxesFor('banner_black').some((b) => b.color === 0x9a2c2c && b.minZ >= 0.6));
  w.setBlock(8, 1, 8, 182);
  ok('you walk past a banner\'s cloth', w.collisionBoxAt(8, 1, 8) === null);
  ok('vases and urns are smaller than a block', ['vase', 'urn'].every((s) => boxesFor(s).every((b) => b.maxY <= 0.85)));
  ok('a firefly lantern glows green, with fireflies lit inside a glass case',
    (lightOf(190).color >> 8 & 0xff) > (lightOf(190).color >> 16 & 0xff) && boxesFor('firefly').filter((b) => b.glow).length >= 4 && boxesFor('firefly').some((b) => b.pane));
}

process.exit(f ? 1 : 0);
