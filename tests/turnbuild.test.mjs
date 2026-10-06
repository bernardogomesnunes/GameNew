import { readFileSync } from 'node:fs';
import { rotateTemplate } from '../src/tools/Templates.js';
import { facingOf, quarterTurned, doorBlock } from '../src/config/blocks.js';
import { pathBoxes, pathCornerGaps } from '../src/world/propShapes.js';
import { World } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';

/**
 * Asked for directly: "on creative buildings do not rotate when moving",
 * and "Rounded sand paths should fill the space with the block around
 * texture".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- a saved build turns, and what's in it turns with it ---------------------------------------

{
  const STAIR = 30, door = doorBlock({ facing: 0 });
  const t = { id: 't', name: 'Test build 1', size: 3, blocks: [{ dx: 0, dy: 0, dz: 0, type: STAIR }, { dx: 2, dy: 0, dz: 0, type: door }] };
  const once = rotateTemplate(t, 1);
  ok('a quarter-turn moves each block round the middle', once.blocks[0].dx === 2 && once.blocks[0].dz === 0 && once.blocks[1].dx === 2 && once.blocks[1].dz === 2);
  ok('and each one that faces a way faces the next way round, like a moved building',
    once.blocks[0].type === quarterTurned(STAIR) && facingOf(once.blocks[0].type) === (facingOf(STAIR) + 1) % 4 && once.blocks[1].type === quarterTurned(door));
  ok('four quarter-turns bring it back as it was', JSON.stringify(rotateTemplate(t, 4).blocks) === JSON.stringify(t.blocks)
    && rotateTemplate(rotateTemplate(t, 2), 2).blocks.every((b, i) => b.type === t.blocks[i].type && b.dx === t.blocks[i].dx && b.dz === t.blocks[i].dz));
}

ok('on a phone, Place turns a queued saved build (the second button says Turn)',
  /if \(this\.pendingTemplate\) return void this\.turnTemplate\(\);\s*if \(this\.armed\) return void this\.clearPending\(\);/.test(game)
  && /template: this\.pendingTemplate\.name, onBuild: !!hit, facing:/.test(game));
ok('R and the tool panel turn it the same way', /else if \(e\.code === turnKey && this\.pendingTemplate\) this\.turnTemplate\(\);/.test(game) && /onRotateTemplate: \(\) => this\.turnTemplate\(\)/.test(game));
ok('and you see it where it would go, turned, before you put it down',
  /this\.updateTemplatePreview\(!!hit\);/.test(game) && /this\.templateGhost\.show\(oriented\.blocks/.test(game) && /this\.templateGhost\.moveTo\(this\.stampAnchor/.test(game));
ok('a claimed building still turns while it is carried — tap the strip, or R', /onHintTap: \(\) => \(this\.moving \? this\.turnMove\(\)/.test(game));

// --- rounded paths: the corner they cut is the ground beside them -----------------------------

{
  const lone = pathCornerGaps({});
  ok('a lone path rounds all four corners, and each has its gap to fill', lone.length === 4 && lone.every((g) => g.boxes.length === 2));
  ok('one joined on a side rounds only the two corners away from it', pathCornerGaps({ px: 1 }).length === 2 && pathCornerGaps({ px: 1, nx: 1 }).length === 0);
  // Path and gap together cover the whole cell, with no overlap: the corner is filled, not doubled.
  const area = (bs) => bs.reduce((a, b) => a + (b.maxX - b.minX) * (b.maxZ - b.minZ), 0);
  const total = area(pathBoxes({})) + area(lone.flatMap((g) => g.boxes));
  ok(`the path and its filled corners make the whole block, no more (${total.toFixed(4)})`, Math.abs(total - 1) < 1e-9);
  ok('filled the full height of the ground beside it', lone.every((g) => g.boxes.every((b) => b.minY === 0 && b.maxY === 1)));
  ok('the ground looked for first beside it, then on the diagonal', JSON.stringify(lone[0].sides) === '[[-1,0],[0,-1],[-1,-1]]');

  // Meshed: a lone path in grass draws its corners in grass; one with air round it doesn't.
  const mesh = (around) => {
    const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) w.setBlock(x, 1, z, around);
    w.setBlock(5, 1, 5, 335);
    const c = w.getChunk(0, 0);
    new ChunkMesher({ add() {}, remove() {} }).rebuild(w, c);
    return c.propMesh?.geometry.groups.find((gr) => gr.materialIndex === 3)?.count ?? 0;
  };
  ok('in grass, the corners are drawn in the grass\'s own texture', mesh(1) > 0);
  ok('with nothing round it, there is nothing to fill them with', mesh(0) === 0);
}

process.exit(f ? 1 : 0);
