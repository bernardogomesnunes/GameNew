import { World } from '../src/world/World.js';
import { ROOFS, ROOFS_BY_ID, facingLabel, roofProfileSvg } from '../src/config/roofs.js';
import { roofPlan, roofBlocks, roofBase, roofPeak } from '../src/tools/RoofTool.js';
import { PANELS_BY_ID } from '../src/config/panels.js';
import { readFileSync } from 'node:fs';

/**
 * Putting a roof on a house.
 *
 * A house you build by hand is four walls and a hole in the sky, because the
 * one thing nobody places by hand is a slope: every course is a block narrower
 * and a block higher than the one under it, and getting that wrong in the
 * middle is twenty blocks of undo. So the roof is a tool.
 *
 * What is actually hard about it is not the slope, it is which way the slope
 * faces. The selector box is square and tells the shape nothing about which
 * way the building fronts, so it guesses, and the guess has to be turnable —
 * which is what most of this file is about.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const PLANKS = 7, STONE = 3;
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../src/config/guide.js', import.meta.url), 'utf8');

/** A box of the given footprint, as the selector would hand one over. */
const box = (x, y, z, s) => ({
  minX: x, maxX: x + s - 1,
  minY: y, maxY: y + s - 1,
  minZ: z, maxZ: z + s - 1,
});

/** Four walls of planks, and the box framing their top course. */
function hut(world, { x = 20, y = 30, z = 20, s = 8, h = 4 } = {}) {
  for (let ix = 0; ix < s; ix++) {
    for (let iz = 0; iz < s; iz++) {
      const edge = ix === 0 || iz === 0 || ix === s - 1 || iz === s - 1;
      if (!edge) continue;
      for (let iy = 0; iy < h; iy++) world.setBlock(x + ix, y + iy, z + iz, PLANKS);
    }
  }
  return box(x, y, z, s);
}

const world = new World({ sizeX: 64, sizeZ: 64, height: 64 });

// --- the shapes themselves ----------------------------------------------------

ok(`${ROOFS.length} shapes to choose from`, ROOFS.length >= 4);
ok('each has an id, a name and a line saying what it is for',
  ROOFS.every((r) => r.id && r.name && r.note && r.note.length > 20));
ok('no two share an id', new Set(ROOFS.map((r) => r.id)).size === ROOFS.length);
ok('each says how many ways round it goes', ROOFS.every((r) => r.turns >= 1 && r.turns <= 4));

// A shape answers "how high here", so one shape fits every box. That is the
// whole reason this is a shape and not four saved designs.
for (const shape of ROOFS) {
  for (const span of [2, 4, 8, 16]) {
    const blocks = roofBlocks(box(0, 0, 0, span), { shape });
    const covered = new Set(blocks.map((b) => `${b.dx},${b.dz}`));
    ok(`${shape.name} covers every column of a ${span}-wide box`, covered.size === span * span);
    ok(`${shape.name} at ${span} never goes below the eave`, blocks.every((b) => b.dy >= 0));
    // A roof taller than it is wide is a spike, not a roof.
    ok(`${shape.name} at ${span} stays lower than it is wide`, roofPeak(blocks) < span);
  }
}

// --- the slope actually slopes ------------------------------------------------

{
  const gable = ROOFS_BY_ID.get('gable');
  const at = (blocks, dx, dz) => Math.max(...blocks.filter((b) => b.dx === dx && b.dz === dz).map((b) => b.dy));
  const b0 = roofBlocks(box(0, 0, 0, 8), { shape: gable, turn: 0 });
  ok('a gable is low at the eave and high in the middle', at(b0, 0, 4) === 0 && at(b0, 3, 4) === 3);
  ok('and symmetrical across the ridge', at(b0, 0, 4) === at(b0, 7, 4) && at(b0, 2, 4) === at(b0, 5, 4));
  ok('while nothing changes along the ridge', at(b0, 3, 2) === at(b0, 3, 5));

  // The turn is the point. If it did nothing the tool would be unusable on
  // half the houses anyone builds.
  const b1 = roofBlocks(box(0, 0, 0, 8), { shape: gable, turn: 1 });
  ok('turning a gable moves the ridge to the other axis', at(b1, 4, 0) === 0 && at(b1, 4, 3) === 3);
  ok('and the two are genuinely different roofs',
    JSON.stringify(b0) !== JSON.stringify(b1));

  // A gable open at the ends is a tunnel you can see daylight through.
  const endColumn = b0.filter((b) => b.dz === 0 && b.dx === 3).map((b) => b.dy).sort((p, q) => p - q);
  ok('the gable ends are filled in rather than left open',
    JSON.stringify(endColumn) === JSON.stringify([0, 1, 2, 3]));
  const middleColumn = b0.filter((b) => b.dz === 4 && b.dx === 3);
  ok('but the middle is a shell, not a solid block of wood', middleColumn.length === 1);
}

{
  const hip = ROOFS_BY_ID.get('hip');
  const blocks = roofBlocks(box(0, 0, 0, 8), { shape: hip });
  const at = (dx, dz) => Math.max(...blocks.filter((b) => b.dx === dx && b.dz === dz).map((b) => b.dy));
  ok('a hipped roof falls away on all four sides',
    at(0, 4) === 0 && at(4, 0) === 0 && at(7, 4) === 0 && at(4, 7) === 0);
  ok('and peaks in the middle', at(3, 3) === 3 && at(3, 4) === 3);
  ok('it has one orientation, because it looks the same every way round', hip.turns === 1);
}

{
  const lean = ROOFS_BY_ID.get('lean');
  const high = (blocks, dx, dz) => Math.max(...blocks.filter((b) => b.dx === dx && b.dz === dz).map((b) => b.dy));
  const b = [0, 1, 2, 3].map((t) => roofBlocks(box(0, 0, 0, 8), { shape: lean, turn: t }));
  ok('a lean-to falls one way only', high(b[0], 0, 4) === 0 && high(b[0], 7, 4) === 3);
  ok('and all four turns are different', new Set(b.map((x) => JSON.stringify(x))).size === 4);
  ok('each turn puts the low edge on a different side',
    high(b[0], 0, 4) === 0 && high(b[1], 4, 0) === 0 && high(b[2], 7, 4) === 0 && high(b[3], 4, 7) === 0);
  // Two blocks across per block up: a shed roof at a gable's pitch is a wall.
  ok('it is the shallow one', lean.run === 2);
}

{
  const flat = ROOFS_BY_ID.get('flat');
  const blocks = roofBlocks(box(0, 0, 0, 8), { shape: flat });
  ok('a flat top is one course', blocks.filter((b) => b.dx === 4 && b.dz === 4).length === 1);
  ok('with a low wall round the edge', blocks.filter((b) => b.dx === 0 && b.dz === 4).length === 2);
}

// --- where it lands -----------------------------------------------------------

// Not the bottom of the box: the box snaps to a grid of its own size, so its
// floor is wherever the grid fell and almost never on top of your walls.
{
  const b = hut(world, { x: 20, y: 30, z: 20, s: 8, h: 4 });
  ok('the eave sits one above the wall top, not on the box floor', roofBase(world, b) === 34);
  const empty = box(40, 30, 40, 8);
  ok('and an empty box roofs from its own floor', roofBase(world, empty) === 30);
}

{
  const b = hut(world, { x: 20, y: 30, z: 20, s: 8, h: 4 });
  const changes = roofPlan(world, b, { shape: ROOFS_BY_ID.get('gable'), turn: 0, type: PLANKS });
  ok(`roofing the hut is ${changes.length} blocks`, changes.length > 60);
  ok('all of it above the walls', changes.every((c) => c.y >= 34));
  ok('and inside the footprint',
    changes.every((c) => c.x >= 20 && c.x <= 27 && c.z >= 20 && c.z <= 27));
  ok('it is made of the block you asked for', changes.every((c) => c.next === PLANKS));
  ok('and it knows what was there, so it can be undone', changes.every((c) => 'prev' in c));

  for (const c of changes) world.setBlock(c.x, c.y, c.z, c.next);
  // The plain rule sits on whatever is highest, so once a roof is there it
  // would sit on that — which is why the caller remembers the eave it used and
  // hands it back. Given it, the same roof is already right.
  ok('the plain rule would stack a second roof on the first', roofBase(world, b) === 38);
  ok('but re-laid at the eave it used, nothing needs doing',
    roofPlan(world, b, { shape: ROOFS_BY_ID.get('gable'), turn: 0, type: PLANKS, base: 34 }).length === 0);
  // Changing your mind about the material re-lays the same roof.
  const stone = roofPlan(world, b, { shape: ROOFS_BY_ID.get('gable'), turn: 0, type: STONE, base: 34 });
  ok('and asking for a different material relays the same shape',
    stone.length === changes.length && stone.every((c) => c.next === STONE));
  // Turning it puts blocks somewhere else; the old ones have to come down too,
  // or the house ends up with a cross on it. Game does that half.
  const turned = roofPlan(world, b, { shape: ROOFS_BY_ID.get('gable'), turn: 1, type: PLANKS, base: 34 });
  ok('and turning it lays a different roof at the same height',
    turned.length > 0 && turned.every((c) => c.y >= 34 && c.y <= 37));
}

// The world has a ceiling, and a 16-box on a hilltop can reach it.
{
  const high = box(40, 60, 40, 8);   // world height is 64
  const changes = roofPlan(world, high, { shape: ROOFS_BY_ID.get('gable'), type: PLANKS });
  ok('a roof that would poke through the sky is trimmed rather than lost',
    changes.length > 0 && changes.every((c) => c.y < 64));
}

// --- saying which way it faces ------------------------------------------------

ok('a shape with one orientation says nothing about facing', facingLabel(ROOFS_BY_ID.get('hip'), 0) === '');
ok('a gable names its ridge', /ridge/.test(facingLabel(ROOFS_BY_ID.get('gable'), 0)));
ok('a lean-to names the way it falls', /falls/.test(facingLabel(ROOFS_BY_ID.get('lean'), 2)));
ok('and every turn of every shape has words for it',
  ROOFS.every((r) => Array.from({ length: r.turns }, (_, t) => facingLabel(r, t))
    .every((s) => r.turns === 1 ? s === '' : s.length > 4)));

// Drawn from the shape's own rules, so it cannot illustrate something the
// shape no longer does.
ok('every shape draws its own profile', ROOFS.every((r) => roofProfileSvg(r).includes('<rect')));
{
  // The drawing is the cross-section, so a pitched shape has to be drawn
  // taller than a flat one or the panel is four pictures of the same thing.
  const height = (id) => Number(roofProfileSvg(ROOFS_BY_ID.get(id)).match(/height="(\d+)"/)[1]);
  ok('a gable is drawn taller than a flat top', height('gable') > height('flat'));
  ok('and no two shapes are drawn as the same picture',
    new Set(ROOFS.map((r) => roofProfileSvg(r))).size === ROOFS.length);
}
ok('and nothing draws for no shape', roofProfileSvg(null) === '');

// --- how you reach it ---------------------------------------------------------

ok('the roof panel is declared with the rest', PANELS_BY_ID.has('panel-roof'));
// Designs is sandbox-only; a Duilt house with a hole in the sky is exactly
// what this is for, and it pays from the bag like anything else.
ok('and exists in a Duilt world too', PANELS_BY_ID.get('panel-roof').mode === 'any');
ok('there is a button for it', /id="btn-roof"/.test(ui) && /id="t-roof"/.test(ui));
ok('and it opens the panel', /#btn-roof.*openPanel\('panel-roof'\)/.test(ui));
ok('picking a shape queues it rather than placing it blind', /onPickRoof\(btn\.dataset\.roof\)/.test(ui));
ok('and turns the selector on, since that is where it goes',
  /onPickRoof[\s\S]{0,120}setSelectorActive\(true\)/.test(ui));

ok('it goes through the one place blocks change, so it undoes and is paid for',
  /roofPlan\(this\.world[\s\S]{0,900}this\.applyChanges\(changes\)/.test(game));
ok('it is made of what you are holding',
  /stampRoof\(\)[\s\S]{0,300}const type = this\.selectedBlockId;[\s\S]{0,500}roofPlan/.test(game));
// Placing, seeing it face the wrong way, turning it and placing again is how
// this tool actually gets used. Without a relay that leaves a cross on the roof.
ok('re-laying over the same box replaces the roof rather than stacking on it',
  /roofRelay\(bounds\)/.test(game) && /relay\?\.base \?\? roofBase/.test(game));
ok('and takes down what the new shape no longer covers',
  /for \(const c of relay\.cells\)[\s\S]{0,260}next: AIR/.test(game));
ok('but only while the roof it remembers is untouched',
  /if \(this\.world\.getBlock\(c\.x, c\.y, c\.z\) !== c\.type\) return null;/.test(game));
ok('and the preview shows the same height it will land at', /this\.roofEave\(bounds\)/.test(game));
ok('a block you have not unlocked is refused before anything is built',
  /stampRoof\(\)[\s\S]{0,400}blockAvailability\(type\)/.test(game));

// R turns a design already. Two keys for "turn the thing before you put it
// down" would be one too many.
ok('R turns it', /e\.code === 'KeyR' && this\.pendingRoof/.test(game));
// And a phone has no R, so the second thumb button takes over while a roof
// that can turn is queued.
ok('and on a phone the second button does', /this\.pendingRoof\?\.turns > 1[\s\S]{0,60}this\.turnRoof\(\)/.test(game));
ok('which is labelled to match', /const second = state\.facing \? 'Turn' : 'Size'/.test(ui));

// Seeing the slope before you commit is the answer to "which way does it face".
ok('the roof hangs in the air before you place it', /updateRoofPreview\(bounds\)/.test(game));
ok('rebuilt only when it would look different, not every frame',
  /if \(key === this\.roofKey\) return;/.test(game));
ok('and the turn is part of what makes it different', /this\.roofId|this\.roofTurn, this\.selectedBlockId/.test(game));
ok('turning the selector off puts it away', /clearPending\(\)[\s\S]{0,200}this\.roofGhost\.hide\(\)/.test(game));
// Two things queued at once is two things fighting over one click.
ok('and picking one thing unqueues the other',
  (game.match(/this\.clearPending\(\);/g) ?? []).length >= 2);

ok('the guide says how to use it', /Pitches a roof over the box/.test(guide));

process.exit(f ? 1 : 0);
