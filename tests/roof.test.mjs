import { World } from '../src/world/World.js';
import { ROOFS, ROOFS_BY_ID, facingLabel, roofProfileSvg } from '../src/config/roofs.js';
import { roofPlan, roofBlocks, roofPeak, roofPick } from '../src/tools/RoofTool.js';
import { pickFootprint } from '../src/tools/PointerPick.js';
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
 * You point at the house. A shape is asked, for each column, how far it is to
 * the edge the four ways out, and answers with heights — which is why the same
 * gable fits a 4-wide shed, a 17-wide hall and an L-shaped cottage.
 *
 * What is actually hard about it is not the slope, it is which way the slope
 * faces. Nothing about a building says which way it fronts, so the shape
 * guesses, and the guess has to be turnable — which is most of this file.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const PLANKS = 7, STONE = 3, DIRT = 2, GRASS = 1;
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../src/config/guide.js', import.meta.url), 'utf8');

/** A square building of side `n`, described the way a real pick describes one. */
function square(n) {
  const foot = new Set();
  for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) foot.add(`${x},${z}`);
  const spans = new Map();
  for (let x = 0; x < n; x++) {
    for (let z = 0; z < n; z++) {
      spans.set(`${x},${z}`, { xm: x + 1, xp: n - x, zm: z + 1, zp: n - z });
    }
  }
  return { y: 0, foot, spans, walls: foot, bounds: { minX: 0, maxX: n - 1, minZ: 0, maxZ: n - 1 } };
}

/** Flat ground at y=20, recorded as ground, with four walls standing on it. */
function world(at = 20, size = 64) {
  const w = new World({ sizeX: size, sizeZ: size, height: 64 });
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < at; y++) w.setBlock(x, y, z, y === at - 1 ? GRASS : DIRT);
      w.setSurfaceHeight(x, z, at - 1);
    }
  }
  return w;
}

function hut(w, { x = 20, z = 20, n = 8, h = 4, at = 20 } = {}) {
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) {
      if (!(ix === 0 || iz === 0 || ix === n - 1 || iz === n - 1)) continue;
      for (let iy = 0; iy < h; iy++) w.setBlock(x + ix, at + iy, z + iz, PLANKS);
    }
  }
  return { x, z, n, top: at + h - 1 };
}

const high = (blocks, x, z) => Math.max(...blocks.filter((b) => b.x === x && b.z === z).map((b) => b.dy));

// --- the shapes themselves ----------------------------------------------------

ok(`${ROOFS.length} shapes to choose from`, ROOFS.length >= 4);
ok('each has an id, a name and a line saying what it is for',
  ROOFS.every((r) => r.id && r.name && r.note && r.note.length > 20));
ok('no two share an id', new Set(ROOFS.map((r) => r.id)).size === ROOFS.length);
ok('each says how many ways round it goes', ROOFS.every((r) => r.turns >= 1 && r.turns <= 4));

// One shape, any building. A box could only ever be 2, 4, 8 or 16 a side.
for (const shape of ROOFS) {
  for (const n of [2, 3, 5, 8, 17]) {
    const blocks = roofBlocks(square(n), { shape });
    const covered = new Set(blocks.map((b) => `${b.x},${b.z}`));
    ok(`${shape.name} covers every column of a ${n}-wide building`, covered.size === n * n);
    ok(`${shape.name} at ${n} never goes below the eave`, blocks.every((b) => b.dy >= 0));
    // A roof taller than it is wide is a spike, not a roof.
    ok(`${shape.name} at ${n} stays lower than it is wide`, roofPeak(blocks) < n);
  }
}

// --- the slope actually slopes ------------------------------------------------

{
  const gable = ROOFS_BY_ID.get('gable');
  const b0 = roofBlocks(square(8), { shape: gable, turn: 0 });
  ok('a gable is low at the eave and high in the middle', high(b0, 0, 4) === 0 && high(b0, 3, 4) === 3);
  ok('and symmetrical across the ridge', high(b0, 0, 4) === high(b0, 7, 4) && high(b0, 2, 4) === high(b0, 5, 4));
  ok('while nothing changes along the ridge', high(b0, 3, 2) === high(b0, 3, 5));

  const b1 = roofBlocks(square(8), { shape: gable, turn: 1 });
  ok('turning a gable moves the ridge to the other axis', high(b1, 4, 0) === 0 && high(b1, 4, 3) === 3);
  ok('and the two are genuinely different roofs', JSON.stringify(b0) !== JSON.stringify(b1));

  // A gable open at the ends is a tunnel you can see daylight through.
  const end = b0.filter((b) => b.z === 0 && b.x === 3).map((b) => b.dy).sort((p, q) => p - q);
  ok('the gable ends are filled in rather than left open', JSON.stringify(end) === JSON.stringify([0, 1, 2, 3]));
  ok('but the middle is a shell, not a solid block of wood',
    b0.filter((b) => b.z === 4 && b.x === 3).length === 1);

  // An odd width has one ridge line rather than two. The selector could not
  // frame an odd building at all.
  const odd = roofBlocks(square(7), { shape: gable, turn: 0 });
  ok('an odd-width gable peaks on a single line', high(odd, 3, 3) === 3 && high(odd, 2, 3) === 2);
}

{
  const hip = ROOFS_BY_ID.get('hip');
  const b = roofBlocks(square(8), { shape: hip });
  ok('a hipped roof falls away on all four sides',
    high(b, 0, 4) === 0 && high(b, 4, 0) === 0 && high(b, 7, 4) === 0 && high(b, 4, 7) === 0);
  ok('and peaks in the middle', high(b, 3, 3) === 3 && high(b, 3, 4) === 3);
  ok('it has one orientation, because it looks the same every way round', hip.turns === 1);
}

{
  const lean = ROOFS_BY_ID.get('lean');
  const b = [0, 1, 2, 3].map((t) => roofBlocks(square(8), { shape: lean, turn: t }));
  ok('a lean-to falls one way only', high(b[0], 0, 4) === 0 && high(b[0], 7, 4) === 3);
  ok('and all four turns are different', new Set(b.map((x) => JSON.stringify(x))).size === 4);
  ok('each turn puts the low edge on a different side',
    high(b[0], 0, 4) === 0 && high(b[1], 4, 0) === 0 && high(b[2], 7, 4) === 0 && high(b[3], 4, 7) === 0);
  // Two blocks across per block up: a shed roof at a gable's pitch is a wall.
  ok('it is the shallow one', lean.run === 2);
}

{
  const flat = ROOFS_BY_ID.get('flat');
  const b = roofBlocks(square(8), { shape: flat });
  ok('a flat top is one course', b.filter((c) => c.x === 4 && c.z === 4).length === 1);
  ok('with a low wall round the edge', b.filter((c) => c.x === 0 && c.z === 4).length === 2);
}

// A building that is not a rectangle gets a roof that is not a rectangle. This
// is the thing the old grid-snapped box could not do at any size.
{
  const foot = new Set(), spans = new Map();
  const inL = (x, z) => x >= 0 && z >= 0 && x < 8 && z < 8 && !(x >= 4 && z >= 4);
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) if (inL(x, z)) foot.add(`${x},${z}`);
  const run = (x, z, dx, dz) => { let n = 0; while (inL(x, z)) { n++; x += dx; z += dz; } return n; };
  for (const k of foot) {
    const [x, z] = k.split(',').map(Number);
    spans.set(k, { xm: run(x, z, -1, 0), xp: run(x, z, 1, 0), zm: run(x, z, 0, -1), zp: run(x, z, 0, 1) });
  }
  const pick = { y: 0, foot, spans, walls: foot, bounds: { minX: 0, maxX: 7, minZ: 0, maxZ: 7 } };
  const b = roofBlocks(pick, { shape: ROOFS_BY_ID.get('hip') });
  const covered = new Set(b.map((c) => `${c.x},${c.z}`));
  ok('an L-shaped house gets an L-shaped roof', covered.size === 48 && !covered.has('6,6'));
  // It falls away from the inside corner as well as from the outside walls,
  // which is the whole reason for measuring distance rather than box position.
  ok('and it slopes away from the inside corner too',
    high(b, 3, 3) === 3 && high(b, 3, 5) === 0 && high(b, 2, 5) === 1);
}

// --- where it lands -----------------------------------------------------------

{
  const w = world();
  const b = hut(w);
  const pick = roofPick(w, { x: 20, y: 21, z: 20 });
  ok('pointing halfway up a wall finds the top course', pick && pick.y === b.top);
  ok('and the footprint is the whole building', pick && pick.foot.size === 64);

  const changes = roofPlan(w, pick, { shape: ROOFS_BY_ID.get('gable'), turn: 0, type: PLANKS });
  ok(`roofing the hut is ${changes.length} blocks`, changes.length > 60);
  ok('all of it above the walls', changes.every((c) => c.y > b.top));
  ok('and inside the footprint',
    changes.every((c) => c.x >= 20 && c.x <= 27 && c.z >= 20 && c.z <= 27));
  ok('it is made of the block you asked for', changes.every((c) => c.next === PLANKS));
  ok('and it knows what was there, so it can be undone', changes.every((c) => 'prev' in c));

  for (const c of changes) w.setBlock(c.x, c.y, c.z, c.next);
  // The plain rule sits on whatever is on top, so once a roof is there it
  // would sit on that — which is why the caller remembers the eave it used.
  const after = roofPick(w, { x: 20, y: 21, z: 20 });
  ok('the plain rule now reads the roof as the top of the building', after.y === b.top + 1);
  ok('but re-laid at the eave it used, nothing needs doing',
    roofPlan(w, pick, { shape: ROOFS_BY_ID.get('gable'), turn: 0, type: PLANKS, base: b.top + 1 }).length === 0);
  const stone = roofPlan(w, pick, { shape: ROOFS_BY_ID.get('gable'), turn: 0, type: STONE, base: b.top + 1 });
  ok('and asking for a different material relays the same shape',
    stone.length === changes.length && stone.every((c) => c.next === STONE));
}

// A 5-wide house gets a 5-wide roof. The box only came in 2, 4, 8 and 16.
{
  const w = world();
  hut(w, { x: 40, z: 40, n: 5, h: 3 });
  const pick = roofPick(w, { x: 40, y: 21, z: 40 });
  const changes = roofPlan(w, pick, { shape: ROOFS_BY_ID.get('gable'), type: PLANKS });
  ok('an odd-sized house gets an exactly-sized roof',
    changes.every((c) => c.x >= 40 && c.x <= 44 && c.z >= 40 && c.z <= 44));
  ok('and no part of it hangs over the edge',
    new Set(changes.map((c) => `${c.x},${c.z}`)).size === 25);
}

// The world has a ceiling, and a big building on a hilltop can reach it.
{
  const w = world(58);
  hut(w, { x: 40, z: 40, n: 8, h: 3, at: 58 });
  const pick = roofPick(w, { x: 40, y: 59, z: 40 });
  const changes = roofPlan(w, pick, { shape: ROOFS_BY_ID.get('gable'), type: PLANKS });
  ok('a roof that would poke through the sky is trimmed rather than lost',
    changes.length > 0 && changes.every((c) => c.y < 64));
}

ok('and pointing at open ground is no building at all',
  roofPick(world(), { x: 5, y: 19, z: 5 }) === null);

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
  const height = (id) => Number(roofProfileSvg(ROOFS_BY_ID.get(id)).match(/height="(\d+)"/)[1]);
  ok('a gable is drawn taller than a flat top', height('gable') > height('flat'));
  ok('and no two shapes are drawn as the same picture',
    new Set(ROOFS.map((r) => roofProfileSvg(r))).size === ROOFS.length);
}
ok('and nothing draws for no shape', roofProfileSvg(null) === '');

// --- how you reach it ---------------------------------------------------------

ok('the roof panel is declared with the rest', PANELS_BY_ID.has('panel-roof'));
ok('and exists in every kind of world', PANELS_BY_ID.get('panel-roof').mode === 'any');
ok('so does Designs, which used to be creative-only', PANELS_BY_ID.get('panel-templates').mode === 'any');
ok('there is a button for it', /id="btn-roof"/.test(ui) && /id="t-roof"/.test(ui));
ok('and it opens the panel', /#btn-roof.*openPanel\('panel-roof'\)/.test(ui));
ok('picking a shape queues it rather than placing it blind', /onPickRoof\(btn\.dataset\.roof\)/.test(ui));

ok('it goes through the one place blocks change, so it undoes and is paid for',
  /roofPlan\(this\.world[\s\S]{0,900}this\.applyChanges\(changes\)/.test(game));
ok('it is made of what you are holding',
  /stampRoof\(\)[\s\S]{0,600}const type = this\.selectedBlockId;[\s\S]{0,500}roofPlan/.test(game));
ok('a block you have not unlocked is refused before anything is built',
  /stampRoof\(\)[\s\S]{0,700}blockAvailability\(type\)/.test(game));
ok('and pointing at nothing says so rather than doing nothing',
  /title: 'Point at a building'/.test(game));

// R turns a design already. Two keys for "turn the thing before you put it
// down" would be one too many.
ok('R turns it', /e\.code === 'KeyR' && this\.pendingRoof/.test(game));
// And a phone has no R, so the second thumb button takes over while a roof
// that can turn is queued.
ok('and on a phone the second button does', /this\.pendingRoof\?\.turns > 1\) return void this\.turnRoof\(\)/.test(game));
ok('which is labelled to match', /const second = state\.facing \? 'Turn' : 'Cancel'/.test(ui));

// Seeing the slope before you commit is the answer to "which way does it face".
ok('the roof hangs in the air before you place it', /updateRoofPreview\(pick\)/.test(game));
ok('rebuilt only when it would look different, not every frame',
  /if \(key === this\.roofKey\) return;/.test(game));
ok('and the turn is part of what makes it different', /this\.pendingRoof\.id, this\.roofTurn/.test(game));
// The other half of the question: did it find the whole house, or one wing?
ok('the building it decided on is outlined too', /this\.selection\.update\([\s\S]{0,140}course, this\.world/.test(game));
ok('putting the tool away clears both', /clearPending\(\)[\s\S]{0,260}this\.roofGhost\.hide\(\)/.test(game));

// Placing, seeing it face the wrong way, turning it and placing again is how
// this tool actually gets used. Without a relay that leaves a cross on the roof.
ok('re-laying on the same house replaces the roof rather than stacking on it',
  /roofRelay\(pick\)/.test(game) && /relay\?\.base \?\? pick\.y \+ 1/.test(game));
ok('and takes down what the new shape no longer covers',
  /for \(const c of relay\.cells\)[\s\S]{0,260}next: AIR/.test(game));
ok('but only while the roof it remembers is untouched',
  /if \(this\.world\.getBlock\(c\.x, c\.y, c\.z\) !== c\.type\) return null;/.test(game));
ok('and the preview shows the same height it will land at', /this\.roofEave\(pick\)/.test(game));

ok('the guide says how to use it', /Pitches a roof over the building you point at/.test(guide));
ok('and that it works everywhere', /works in any world/.test(guide));

process.exit(f ? 1 : 0);
