import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { BED, BED_HEAD, PAINTING, bedPart, pairPart, pairOther, WAR_TENT, WAR_TENT_BACK, isTent, isPainting, turned, facingOf, mirrored, FACING_STEP, BLOCKS_BY_ID } from '../src/config/blocks.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { DESIGN_FOR_STRUCTURE } from '../src/config/starterDesigns.js';
import { validateStructure } from '../src/structures/validate.js';
import { boxesFor } from '../src/world/propShapes.js';
import { itemIcon } from '../src/config/cubes.js';

/**
 * Playtest, P1 — homes worth living in. Asked for directly: "Houses should
 * have windows and furniture. We should have a bed too. Windows and bed
 * should be an item of course. We should have a painting in each house, and
 * as an item, that can set the spawn point for when we die."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- the bed ------------------------------------------------------------------------------

ok('a bed is a thing you make and hold', ITEMS_BY_ID.get('bed')?.block === BED && RECIPES.some((r) => r.output.id === 'bed' && r.station === 'hand' && r.age === 1));
ok('two blocks long: a foot and a head, each modelled', boxesFor('bed_foot').length >= 5 && boxesFor('bed_head').some((b) => b.maxY > 0.8));
ok('it turns the way you face, head and foot alike', [0, 1, 2, 3].every((d) => facingOf(turned(BED, d)) === d && facingOf(turned(BED_HEAD, d)) === d));
ok('the mirror turns it too', bedPart(mirrored(turned(BED, 1), { flipX: true })).facing === 3);
ok('broken, the foot gives back the bed and the head nothing — one bed, not two',
  ITEM_FOR_BLOCK.get(BED + 2) === 'bed' && !ITEM_FOR_BLOCK.has(BED_HEAD + 2));
{
  // Beds and war tents are both two-block things now (blocks.js PAIRS).
  const foot = pairPart(BED + 1), head = pairOther(foot, 5, 5);
  ok('placing one puts its head in the next block along, the way it faces',
    head.x === 6 && head.z === 5 && /const part = pairPart\(next\);\s*const at = pairOther\(part, t\.x, t\.z\);[\s\S]{0,400}next: part\.pair\.second \+ part\.facing/.test(game));
  ok('and the head finds its foot again', JSON.stringify(pairOther(pairPart(BED_HEAD + 1), 6, 5)) === '{"x":5,"z":5}');
  const flap = pairPart(WAR_TENT), back = pairOther(flap, 5, 5);
  ok('a war tent is two blocks long too: its back goes behind the flap (backlog batch 2)',
    back.x === 5 && back.z === 6 && isTent(WAR_TENT_BACK) && JSON.stringify(pairOther(pairPart(WAR_TENT_BACK), 5, 6)) === '{"x":5,"z":5}');
}
ok('and breaking either half takes the other with it', /withBedHalves\(this\.withDoorHalves\(/.test(game));
ok('a step for each facing: -z, +x, +z, -x', JSON.stringify(FACING_STEP) === '[[0,-1],[1,0],[0,1],[-1,0]]');
{
  const w = new World({ sizeX: 8, sizeZ: 8, height: 8 });
  w.setBlock(2, 1, 2, BED); w.setBlock(2, 1, 1, BED_HEAD);
  ok('you can sit on it, not sink into it', w.collisionBoxAt(2, 1, 2).maxY === 1.5);
}
ok('drawn whole in the bag', (itemIcon(ITEMS_BY_ID.get('bed')) ?? '').startsWith('<svg'));

// --- the painting ---------------------------------------------------------------------------

ok('a painting is a thing you make and hold', ITEMS_BY_ID.get('painting')?.block === PAINTING && RECIPES.some((r) => r.output.id === 'painting' && r.age === 1));
ok('flat on the wall, framed, with a landscape in it', boxesFor('painting').every((b) => b.maxZ <= 0.08) && boxesFor('painting').length >= 8);
{
  const w = new World({ sizeX: 8, sizeZ: 8, height: 8 });
  w.setBlock(3, 2, 3, PAINTING);
  ok('you walk past it', w.collisionBoxAt(3, 2, 3) === null && isPainting(PAINTING + 3));
}
ok('Place on it makes it where you wake', /isPainting\(aimed\.block\)\) return void this\.setSpawn\(aimed\)/.test(game));
ok('dying, you wake beside it while it still hangs', /respawnPoint\(\) \{[\s\S]{0,300}const at = this\.world\.getBlock\(s\.x, s\.y, s\.z\);\s*if \(isPainting\(at\) \|\| isTent\(at\)\)[\s\S]{0,200}standingNear/.test(game));
ok('and at home if it\'s gone', /this\.duilt\.spawn = null;[\s\S]{0,200}return this\.homeSpawn\(\)/.test(game));
{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  g.spawn = { x: 4, y: 5, z: 6 };
  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('the painting you chose is saved with the world', back.spawn?.x === 4 && back.spawn.z === 6);
}

// --- furnished houses ---------------------------------------------------------------------------

const has = (design, test) => design.blocks.some((b) => test(b.type));
{
  const cabin = DESIGN_FOR_STRUCTURE.get('house');
  ok('the starter cabin has a bed and a painting', has(cabin, (t) => bedPart(t) && !bedPart(t).head) && has(cabin, (t) => bedPart(t)?.head) && has(cabin, isPainting));
  const town = DESIGN_FOR_STRUCTURE.get('townhouse');
  ok('the townhouse has framed windows, beds, a table and chairs, a rug, a lantern and a painting',
    town.blocks.filter((b) => BLOCKS_BY_ID.get(b.type)?.shape === 'window').length >= 4
    && town.blocks.filter((b) => bedPart(b.type) && !bedPart(b.type).head).length === 2
    && has(town, (t) => t === 31) && has(town, (t) => t === 33) && has(town, (t) => t === 35) && has(town, (t) => t === 26) && has(town, isPainting));
  for (const [id, d] of [['house', cabin], ['townhouse', town]]) {
    const world = new World({ sizeX: 48, sizeZ: 48, height: 32 });
    for (let x = 0; x < 48; x++) for (let z = 0; z < 48; z++) world.setBlock(x, 0, z, 3);
    for (const b of d.blocks) world.setBlock(10 + b.dx, 1 + b.dy, 10 + b.dz, b.type);
    const v = validateStructure(world, { minX: 10, minY: 1, minZ: 10, maxX: 10 + d.extent.x, maxY: 1 + d.extent.y, maxZ: 10 + d.extent.z }, id);
    ok(`  furnished, the ${id} still stands (${v.reason ?? 'ok'})`, v.ok);
  }
}

process.exit(f ? 1 : 0);
