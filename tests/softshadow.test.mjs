import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { ChunkMesher, AO_LIGHT, cornerOcclusion, aoFlip } from '../src/world/ChunkMesher.js';
import { DEFAULTS } from '../src/render/graphics.js';

/**
 * Shadow where blocks meet (docs/plan-look-and-sound.md, section 2): "the
 * biggest single fix for 'flat'". Corners, under eaves, where a wall stands
 * on the ground — baked into the vertex colours of the chunk mesh.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const STONE = 3;
const scene = { add() {}, remove() {} };

// --- the rule -------------------------------------------------------------------------------------

ok('open corners stay full bright; an inner corner is darkest', AO_LIGHT[0] === 1 && AO_LIGHT[3] < AO_LIGHT[2] && AO_LIGHT[2] < AO_LIGHT[1] && AO_LIGHT[1] < 1);
ok('not so dark it reads as dirt', AO_LIGHT[3] >= 0.45);
ok('a corner counts its two sides and the diagonal', cornerOcclusion(0, 0, 0) === 0 && cornerOcclusion(1, 0, 0) === 1 && cornerOcclusion(0, 0, 1) === 1 && cornerOcclusion(1, 0, 1) === 2);
ok('both sides filled is a full inner corner, whatever the diagonal', cornerOcclusion(1, 1, 0) === 3 && cornerOcclusion(1, 1, 1) === 3);
ok('a quad is cut across its darkest corner, not through it', aoFlip(3, 0, 0, 0) === true && aoFlip(0, 3, 0, 0) === false && aoFlip(0, 0, 0, 0) === false);

// --- on a real mesh -------------------------------------------------------------------------------

const shades = (on) => {
  const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.setBlock(x, 0, z, STONE);
  for (let y = 1; y < 4; y++) for (let z = 4; z < 12; z++) world.setBlock(8, y, z, STONE); // a wall on the floor
  const mesher = new ChunkMesher(scene);
  mesher.ao = on;
  const chunk = world.getChunk(0, 0);
  mesher.rebuild(world, chunk);
  let min = 1, verts = 0;
  for (const m of chunk.mesh.values()) {
    const c = m.geometry.getAttribute('color');
    if (!c) continue;
    verts += c.count;
    for (let i = 0; i < c.count; i++) min = Math.min(min, c.getX(i), c.getY(i), c.getZ(i));
  }
  return { min, verts };
};
const off = shades(false), on = shades(true);
ok(`where the wall meets the floor, the floor darkens (${on.min.toFixed(2)} vs ${off.min.toFixed(2)})`, on.min < off.min * 0.85);
ok(`it costs a few more vertices, not many times more (${off.verts} → ${on.verts})`, on.verts > off.verts && on.verts < off.verts * 4);

// --- a setting ------------------------------------------------------------------------------------

ok('on by default', DEFAULTS.ao === true);
ok('"Soft shadows" in the graphics settings', /id="gfx-ao" \/> Soft shadows/.test(ui) && /ao: ao\.checked/.test(ui));
ok('changing it rebuilds the meshes', /this\.mesher\.ao = this\.graphics\.ao !== false;/.test(game) && /if \(ao !== this\.mesher\.ao\) \{\s*this\.mesher\.ao = ao;\s*if \(this\.world\) this\.rebuildAllChunks\(\);/.test(game));

process.exit(f ? 1 : 0);
