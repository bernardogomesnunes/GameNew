import { World } from '../src/world/World.js';
import {
  columnTop, wallCourse, enclose, spans, boundsOf, pickFootprint, pickBuild, PICK_CAP,
} from '../src/tools/PointerPick.js';
import { readFileSync } from 'node:fs';

/**
 * Working out what you are pointing at.
 *
 * There used to be a selector: a mode you switched on, which put a grid-snapped
 * cube in front of you, which you aimed, and only then could you save a design,
 * claim a building or roof anything. It was a mode — so half the buttons meant
 * something different depending on whether it was on — and it snapped to powers
 * of two, so a 7-wide house got an 8-wide roof and so did a 5-wide one.
 *
 * It is gone. You point at the building and the game works out where it ends.
 * These are the rules it works that out by.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const PLANKS = 7, LOG = 4, DIRT = 2, GRASS = 1;
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

/** A world with flat ground at y=20, recorded as the ground, and nothing above. */
function ground(size = 64, at = 20) {
  const w = new World({ sizeX: size, sizeZ: size, height: 64 });
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < at; y++) w.setBlock(x, y, z, y === at - 1 ? GRASS : DIRT);
      w.setSurfaceHeight(x, z, at - 1);
    }
  }
  return w;
}

/** Four walls on the ground: `[x0, z0]` low corner, w by l, h high. */
function hut(world, { x = 20, z = 20, w = 8, l = 8, h = 4, at = 20, type = PLANKS } = {}) {
  for (let ix = 0; ix < w; ix++) {
    for (let iz = 0; iz < l; iz++) {
      if (!(ix === 0 || iz === 0 || ix === w - 1 || iz === l - 1)) continue;
      for (let iy = 0; iy < h; iy++) world.setBlock(x + ix, at + iy, z + iz, type);
    }
  }
  return { x, z, w, l, h, top: at + h - 1 };
}

// --- finding the top of a wall -----------------------------------------------

{
  const world = ground();
  const b = hut(world);
  // Aiming at the middle of a wall is the normal way to aim at a wall. Making
  // you climb up and aim down at a one-block edge would not be an improvement
  // on the selector.
  ok('pointing halfway up a wall finds the top of it', columnTop(world, 20, 21, 20) === b.top);
  ok('and pointing at the top course stays there', columnTop(world, 20, b.top, 20) === b.top);
}

// --- following the wall round -------------------------------------------------

{
  const world = ground();
  const b = hut(world);
  const course = wallCourse(world, 20, b.top, 20);
  ok('the top course of an 8x8 hut is its 28 wall blocks', course.size === 28);
  ok('and it is square', JSON.stringify(boundsOf(course)) === JSON.stringify({ minX: 20, maxX: 27, minZ: 20, maxZ: 27 }));

  const foot = enclose(course, boundsOf(course));
  ok('filled in, it covers the whole 8 by 8', foot.size === 64);
  ok('walls included', foot.has('20,20') && foot.has('27,27'));
  ok('and the room inside', foot.has('23,23'));
}

// A hillside is not a building, and roofing one is not what anybody meant.
{
  const world = ground();
  ok('pointing at open ground finds no building', pickFootprint(world, { x: 5, y: 19, z: 5 }) === null);
  ok('because the fill runs past what a building could be', wallCourse(world, 5, 19, 5, 200) === null);
  ok(`and the cap is ${PICK_CAP} blocks, which is a large house, not a hill`,
    PICK_CAP >= 1000 && PICK_CAP <= 20000);
}

// --- shapes that are not rectangles -------------------------------------------

// The selector could not do this at all: a box is a box. The whole reason for
// following the walls is that buildings are not.
{
  const world = ground();
  // An L: an 8x8 with a 4x4 bite out of one corner.
  const wall = (x, z) => world.setBlock(x, 23, z, PLANKS);
  const inL = (ix, iz) => !(ix >= 4 && iz >= 4);
  for (let ix = 0; ix < 8; ix++) {
    for (let iz = 0; iz < 8; iz++) {
      if (!inL(ix, iz)) continue;
      const edge = !inL(ix - 1, iz) || !inL(ix + 1, iz) || !inL(ix, iz - 1) || !inL(ix, iz + 1)
        || ix === 0 || iz === 0 || ix === 7 || iz === 7;
      if (edge) wall(40 + ix, 40 + iz);
    }
  }
  const pick = pickFootprint(world, { x: 40, y: 23, z: 40 });
  ok('an L-shaped building is picked up as an L', pick && pick.foot.size === 64 - 16);
  ok('the notch is left out', pick && !pick.foot.has('46,46'));
  ok('and the rest is in', pick && pick.foot.has('42,42') && pick.foot.has('42,46'));
}

// --- how far to the edge ------------------------------------------------------

// This is what a roof shape actually asks, and it has to be right for any
// outline, not just squares.
{
  const foot = new Set();
  for (let x = 0; x < 6; x++) for (let z = 0; z < 4; z++) foot.add(`${x},${z}`);
  const d = spans(foot);
  ok('a corner is one step from both edges',
    d.get('0,0').xm === 1 && d.get('0,0').zm === 1);
  ok('and the far side of a 6-wide row is 6 from the near edge', d.get('5,0').xm === 6);
  ok('counted the other way it is 1', d.get('5,0').xp === 1);
  ok('the middle of a 4-deep column is 2 and 3', d.get('3,1').zm === 2 && d.get('3,1').zp === 3);
  ok('every cell gets an answer', d.size === foot.size);
}

// --- which blocks are the building --------------------------------------------

// "Somebody put it there" rather than a list of building materials — which
// would have been wrong the first time anyone built a house out of dirt.
{
  const world = ground();
  hut(world, { x: 30, z: 30, w: 5, l: 5, h: 3 });
  const build = pickBuild(world, { x: 30, y: 21, z: 30 });
  ok('a 5x5 hut 3 high is its 48 wall blocks', build && build.blocks.length === 16 * 3);
  ok('and the box round it is 5 by 5 by 3',
    build && build.bounds.minX === 30 && build.bounds.maxX === 34
    && build.bounds.minY === 20 && build.bounds.maxY === 22);
  ok('the ground it stands on is not part of it',
    build && build.blocks.every((b) => b.y >= 20));
  ok('pointing at the lawn picks nothing up', pickBuild(world, { x: 5, y: 19, z: 5 }) === null);
}

{
  // A doorway is a hole in a wall, and the fill has to go round it rather than
  // out through it and across the garden.
  const world = ground();
  hut(world, { x: 30, z: 30, w: 6, l: 6, h: 4, type: LOG });
  world.setBlock(33, 20, 35, 0);
  world.setBlock(33, 21, 35, 0);
  const build = pickBuild(world, { x: 30, y: 21, z: 30 });
  ok('a hut with a doorway in it is still just the hut', build && build.blocks.length === 20 * 4 - 2);
}

// --- no mode anywhere ---------------------------------------------------------

ok('there is no selector left to switch on', !/selectorTool/.test(game) && !/btn-select/.test(ui));
ok('and no box size to cycle', !/btn-size/.test(ui) && !/SELECTOR_SIZES/.test(game));
// Break used to mean five different things depending on a mode you may have
// forgotten was on.
ok('Break breaks unless a tool is queued', /if \(this\.pendingRoof\) return void this\.stampRoof\(\);/.test(game));
ok('and a queued tool is the only thing that changes what a button does',
  /get armed\(\) \{[\s\S]{0,120}pendingRoof \|\| this\.pendingTemplate/.test(game));
ok('Place cancels rather than placing while something is queued',
  /if \(this\.armed\) return void this\.clearPending\(\);/.test(game));

// Arm's length is right for breaking one block and wrong for a tool that works
// on a building: to see a house you have to stand back from it, and at arm's
// length you are looking at one wall.
{
  const reach = Number(game.match(/const REACH = (\d+);/)[1]);
  const tool = Number(game.match(/const TOOL_REACH = (\d+);/)[1]);
  ok(`you reach ${reach} blocks but a tool points ${tool}`, tool > reach * 2);
  ok('and the tools use it', /toolAim\(\) \{[\s\S]{0,120}this\.raycast\(TOOL_REACH\)/.test(game));
  ok('the roof, a design and a clear all go through it',
    (game.match(/this\.toolAim\(\)/g) ?? []).length >= 3);
  ok('while breaking a block still only reaches as far as you do',
    /castVoxelRay\(this\.world, origin, dir, reach\)/.test(game)
    && /raycast\(reach = REACH\)/.test(game));
}

// openClaim() reads the wall you're pointing at with wallFootprintAt rather
// than buildUnderCrosshair's pickBuild — see PointerPick.js and
// tests/claimcolumn.test.mjs for why: pickBuild required the exact block you
// clicked to sit above the terrain's recorded surface height, which failed
// on a wall's own lowest course more often than it worked.
ok('claiming asks what wall you are pointing at', /openClaim\(\)[\s\S]{0,900}wallFootprintAt\(this\.world, hit\)/.test(game));
ok('saving a design asks what build you are pointing at', /saveTemplate\(name\) \{[\s\S]{0,80}this\.buildUnderCrosshair\(\)/.test(game));
ok('and the answer is worked out once per aim, not once per caller',
  /if \(key !== this\.pickKey\)/.test(game));

// --- tools are not a kind of world --------------------------------------------

// A roof is a thing you do to blocks. Blocks are the same in every world.
{
  const panels = readFileSync(new URL('../src/config/panels.js', import.meta.url), 'utf8');
  ok('no panel is sandbox-only any more', !/mode: 'sandbox'/.test(panels));
  ok('and nothing in the HUD is hidden for being in the wrong kind of world',
    !/sandbox-only/.test(ui));
  // The Duilt systems are still Duilt: there is no bag in a creative world.
  ok('but the settlement panels stay where they belong', /mode: 'duilt'/.test(panels));
}

process.exit(f ? 1 : 0);
