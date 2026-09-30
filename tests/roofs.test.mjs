import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { cornerOf, slopeGeometry, SLOPE_KIND } from '../src/world/slopes.js';
import { roofPart, roofBlock, turned, facingOf, PLACEABLE_BLOCKS, lightOf, ROOF_MATERIALS } from '../src/config/blocks.js';
import { ITEM_FOR_BLOCK, ITEMS_BY_ID } from '../src/config/items.js';
import { ROOFS_BY_ID } from '../src/config/roofs.js';
import { roofBlocks, roofTypeFor, slopeAt } from '../src/tools/RoofTool.js';
import { itemIcon } from '../src/config/cubes.js';

/**
 * Requested directly: "on the stairs a small detail that would be pretty
 * nice, is to have corner stairs. We should do a similar work for roofing,
 * we should have something similar but with 'telhas'. roofing can be done
 * with bricks and stone" — and "the lantern is super weird ... that should be
 * a chandelier", "there should be a lantern, and a chandelier, two
 * different things".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const STAIR = SLOPE_KIND.stair;

// --- corners ---------------------------------------------------------------------------------

{
  const grid = (cells) => (dx, dz) => cells[`${dx},${dz}`] ?? null;
  // A stair climbing -z with one behind it climbing +x, and nothing carrying the run on: outer.
  const outer = cornerOf(STAIR, 0, grid({ '0,-1': { kind: STAIR, facing: 1 } }));
  ok('a stair with one turned across it behind is an outer corner', outer?.type === 'outer' && outer.second === 1);
  const inner = cornerOf(STAIR, 0, grid({ '0,1': { kind: STAIR, facing: 3 } }));
  ok('with one turned across it in front, an inner corner', inner?.type === 'inner' && inner.second === 3);
  ok('in a straight run, no corner', cornerOf(STAIR, 0, grid({ '1,0': { kind: STAIR, facing: 0 }, '-1,0': { kind: STAIR, facing: 0 } })) === null);
  ok('a stair only turns a corner with a stair, not a roof',
    cornerOf(STAIR, 0, grid({ '0,-1': { kind: SLOPE_KIND.roof, facing: 1 } })) === null);

  const heights = (g) => g.boxes.map((b) => b.maxY);
  const o = slopeGeometry('stair', 0, { type: 'outer', second: 1 });
  const i = slopeGeometry('stair', 0, { type: 'inner', second: 1 });
  const full = (g) => g.boxes.filter((b) => b.maxY === 1).length;
  ok(`an outer corner is high only at its corner (${full(o)} of 9 columns full height)`, full(o) === 1);
  ok(`an inner corner is high along both backs (${full(i)} of 9)`, full(i) === 5);
  ok('both still step in thirds', [...heights(o), ...heights(i)].every((h) => [1, 2 / 3, 1 / 3].some((t) => Math.abs(t - h) < 1e-9)));
}

// --- roof tiles --------------------------------------------------------------------------------

{
  const brick = PLACEABLE_BLOCKS.find((b) => b.name === 'Brick Roof Tiles');
  const stone = PLACEABLE_BLOCKS.find((b) => b.name === 'Stone Roof Tiles');
  ok('roof tiles come in brick and in stone', brick && stone && brick.color !== stone.color);
  ok('each is an item with a recipe name to match', ITEMS_BY_ID.get('roof_brick')?.block === brick.id && ITEMS_BY_ID.get('roof_stone')?.block === stone.id);
  ok('placed by hand they turn like a stair', facingOf(turned(brick.id, 3)) === 3 && roofPart(turned(brick.id, 3)).kind === 'steep');
  ok('every piece gives the same tiles back', ['lo', 'hi', 'ridge_x', 'peak'].every((kind) => ITEM_FOR_BLOCK.get(roofBlock({ mat: 1, kind, facing: 2 })) === 'roof_stone'));
  ok('only one piece of each is held', PLACEABLE_BLOCKS.filter((b) => b.roof).length === 2);

  const g = slopeGeometry('roof', 0);
  const top = g.faces.filter((fc) => fc.out[1] > 0);
  const slanted = top.some((fc) => new Set(fc.pts.map((p) => p[1].toFixed(3))).size > 1);
  ok('a roof tile is a real slope, not steps', g.boxes.length === 0 && slanted);
  // Reported directly: "The roofs look weird ... it fills the space in a
  // triangle form, they need texture and details like the tiles."
  ok(`laid in rows of curved tiles (${top.length - 1} tile facets on the slope)`, top.length - 1 === 24);
  const ys = g.faces.flatMap((fc) => fc.pts.map((p) => p[1]));
  const upright = g.faces.filter((fc) => fc.out[1] === 0).map((fc) => {
    // How tall a side is at any one point along it: its top less its bottom there.
    const xs = fc.pts.map((p) => p[0] + p[2]);
    const at = (v) => fc.pts.filter((p) => Math.abs(p[0] + p[2] - v) < 1e-9).map((p) => p[1]);
    return Math.max(...xs.map((v) => { const h = at(v); return Math.max(...h) - Math.min(...h); }));
  });
  ok(`a thin shell, not a solid wedge: no side stands taller than the shell's edge (${Math.max(...upright).toFixed(2)})`,
    Math.max(...upright) < 0.3 && Math.max(...ys) < 1.1);
  ok('with timber under it', g.faces.some((fc) => fc.out[1] < 0 && typeof fc.color === 'number'));
  const filled = slopeGeometry('roof', 0, null, { filled: true });
  ok('over a wall it fills down to the wall, in the wall\'s own colour', filled.faces.some((fc) => fc.color === 'below')
    && !filled.faces.some((fc) => typeof fc.color === 'number'));
  // Found in play: every roof facing east or west came out bare — its tiles
  // were thrown away as if they had no size.
  const tiled = (sh, f, c, st) => slopeGeometry(sh, f, c, { style: st }).faces.filter((fc) => fc.out[1] > 0 && !fc.bed).length;
  const bare = [];
  for (const st of ['clay', 'slate']) {
    for (let f = 0; f < 4; f++) {
      for (const c of [null, { type: 'outer', second: (f + 1) & 3 }, { type: 'inner', second: (f + 3) & 3 }]) {
        if (tiled('roof', f, c, st) < 6) bare.push(`${st} ${f} ${c?.type ?? 'straight'}`);
      }
    }
    for (const sh of ['roof_lo', 'roof_hi', 'roof_ridge_x', 'roof_ridge_z', 'roof_peak']) if (tiled(sh, 1, null, st) < 6) bare.push(`${st} ${sh}`);
  }
  ok(`every piece, every way round, in both materials, is tiled (${bare.join('; ') || 'none bare'})`, bare.length === 0);
  const slate = slopeGeometry('roof', 0, null, { style: 'slate' });
  const flat = (fc) => fc.out[1] > 0 && fc.tone !== undefined;
  ok('slate is laid differently: flat slates, three courses, staggered', slate.faces.filter(flat).length !== g.faces.filter(flat).length);

  const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  world.setBlock(4, 1, 4, brick.id);
  world.setBlock(5, 1, 4, roofBlock({ mat: 0, kind: 'lo' }));
  ok('you walk up a roof like a stair', world.collisionBoxAt(4, 1, 4).stair && world.collisionBoxAt(4, 1, 4).maxY === 2);
  ok('a half-pitch piece comes up half way', world.collisionBoxAt(5, 1, 4).maxY === 1.5);
  const mesher = new ChunkMesher({ add() {}, remove() {} });
  const chunk = world.getChunk(0, 0);
  mesher.rebuild(world, chunk);
  const N = chunk.propMesh.geometry.attributes.normal.array;
  let tilted = 0;
  for (let k = 0; k < N.length; k += 3) if (N[k + 1] > 0.3 && N[k + 1] < 0.95) tilted++;
  ok('and it is drawn sloping in the world', tilted > 0);
  ok('with a real preview in the bag', /<path/.test(itemIcon(ITEMS_BY_ID.get('roof_brick'))));
}

// --- the Roof tool lays them --------------------------------------------------------------------

{
  // A 5-wide, 7-deep building: every column's distances to the four edges.
  const W = 5, D = 7;
  const spans = new Map();
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) spans.set(`${x},${z}`, { xm: x + 1, xp: W - x, zm: z + 1, zp: D - z });
  const pick = { spans, y: 0, bounds: { minX: 0, maxX: W - 1, minZ: 0, maxZ: D - 1 } };
  const brick = roofBlock({ mat: 0, kind: 'steep' });

  const gable = roofBlocks(pick, { shape: ROOFS_BY_ID.get('gable'), turn: 0 }).map((b) => ({ ...b, id: roofTypeFor(brick, b) }));
  const at = (x, z) => gable.filter((b) => b.x === x && b.z === z).sort((a, b) => b.dy - a.dy)[0];
  ok('a gable climbs from both eaves to the ridge', roofPart(at(0, 3).id).facing === 1 && roofPart(at(4, 3).id).facing === 3);
  ok('and is capped along the ridge', roofPart(at(2, 3).id).kind === 'ridge_z');
  const end = gable.filter((b) => b.x === 1 && b.z === 0).sort((a, b) => a.dy - b.dy);
  ok('its ends are filled with brick under the tiles', end.length === 2 && end[0].id === ROOF_MATERIALS[0].wall && roofPart(end[1].id));

  const hip = roofBlocks(pick, { shape: ROOFS_BY_ID.get('hip'), turn: 0 });
  const hipAt = (x, z) => slopeAt(ROOFS_BY_ID.get('hip'), spans.get(`${x},${z}`), 0);
  ok('a hipped roof climbs away from every side', hipAt(0, 3).facing === 1 && hipAt(3, 0).facing === 2 && hipAt(4, 3).facing === 3 && hipAt(2, 6).facing === 0);
  ok('with a ridge along its length, and a peak at each end of it', hipAt(2, 3).kind === 'ridge_z' && hipAt(2, 2).kind === 'peak');
  ok('and nothing but tiles on top', hip.every((b) => b.slope || !roofPart(roofTypeFor(brick, b))));

  const lean = [0, 1, 2, 3].map((x) => slopeAt(ROOFS_BY_ID.get('lean'), spans.get(`${x},3`), 0));
  ok('a lean-to is a shallow pitch: low half, high half, and again', lean.map((s) => s.kind).join() === 'lo,hi,lo,hi' && lean.every((s) => s.facing === 1));
  ok('a flat roof stays flat', slopeAt(ROOFS_BY_ID.get('flat'), spans.get('2,3'), 0) === null
    && roofTypeFor(brick, { slope: null }) === ROOF_MATERIALS[0].wall);
  ok('any other block is laid just as it is', roofTypeFor(7, { slope: { kind: 'steep', facing: 1 } }) === 7);
}

// --- a lantern, and a chandelier -----------------------------------------------------------------

{
  const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  world.setBlock(2, 1, 2, 26);
  world.setBlock(4, 3, 4, 85);
  // Reported directly: the light was "such a circle in the centre", and
  // should be "blurred", reach further, and "go from more light to less".
  ok('a lantern shines from just above itself, not from the floor under it', lightOf(26).y > 1);
  ok('a chandelier from under its candles, not against the ceiling', lightOf(85).y < 0.5);
  ok('both fade gently with distance, not with its square, and reach well past five blocks',
    [26, 85].every((id) => lightOf(id).decay === 1 && lightOf(id).distance >= 18));
  ok('a lantern is small enough to step over', world.collisionBoxAt(2, 1, 2).maxY === 1.5);
  ok('you walk under a chandelier', world.collisionBoxAt(4, 3, 4) === null);
  ok('both are things you can hold', ITEMS_BY_ID.get('lantern')?.block === 26 && ITEMS_BY_ID.get('chandelier')?.block === 85);
  const mesher = new ChunkMesher({ add() {}, remove() {} });
  const chunk = world.getChunk(0, 0);
  mesher.rebuild(world, chunk);
  const groups = chunk.propMesh.geometry.groups;
  ok('their flames are drawn lit, day or night', groups.length === 2 && groups[1].count > 0 && Array.isArray(chunk.propMesh.material));
}

process.exit(f ? 1 : 0);
