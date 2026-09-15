import { World } from '../src/world/World.js';
import { CLEARS, CLEARS_BY_ID, clearArtSvg } from '../src/config/clears.js';
import { clearPlan, clearCells, cellBounds } from '../src/tools/ClearTool.js';
import { PANELS_BY_ID } from '../src/config/panels.js';
import { readFileSync } from 'node:fs';

/**
 * Taking a lot of blocks away at once.
 *
 * Breaking is how you take a block back — it goes in your bag when you do — and
 * that was the only way, which is fine for one block and ridiculous for sixty.
 * A roof you have gone off, a hillside in the way of a foundation, a stump of
 * old wall: sixty taps is not a game mechanic, it is a chore the game was
 * making you do because nothing else could.
 *
 * So the roof tool pointed the other way. Two questions, two answers: "this
 * thing I built" is a shape the game can follow for itself, and "this bit of
 * ground" has no shape at all, so it takes a size.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const LOG = 4, DIRT = 2, GRASS = 1;
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../src/config/guide.js', import.meta.url), 'utf8');

/** Flat recorded ground at y=20, with a 5x5 hut of logs standing on it. */
function world({ hut = true } = {}) {
  const w = new World({ sizeX: 64, sizeZ: 64, height: 64 });
  for (let x = 0; x < 64; x++) {
    for (let z = 0; z < 64; z++) {
      for (let y = 0; y < 20; y++) w.setBlock(x, y, z, y === 19 ? GRASS : DIRT);
      w.setSurfaceHeight(x, z, 19);
    }
  }
  if (hut) {
    for (let ix = 0; ix < 5; ix++) {
      for (let iz = 0; iz < 5; iz++) {
        if (!(ix === 0 || iz === 0 || ix === 4 || iz === 4)) continue;
        for (let iy = 0; iy < 4; iy++) w.setBlock(30 + ix, 20 + iy, 30 + iz, LOG);
      }
    }
  }
  return w;
}

// --- the shapes ---------------------------------------------------------------

ok(`${CLEARS.length} ways to clear`, CLEARS.length >= 4);
ok('each has an id, a name and a line saying what it is for',
  CLEARS.every((c) => c.id && c.name && c.note && c.note.length > 20));
ok('no two share an id', new Set(CLEARS.map((c) => c.id)).size === CLEARS.length);
ok('one follows what you built', CLEARS.some((c) => c.kind === 'build'));
ok('and the rest take a fixed box', CLEARS.filter((c) => c.kind === 'cube').length >= 3);
// An even-sized cube has no middle, so what you aimed at would be off to one
// side of what went.
ok('every box is an odd number across, so the block you point at is the middle',
  CLEARS.filter((c) => c.kind === 'cube').every((c) => c.size % 2 === 1));

// --- what each one takes ------------------------------------------------------

{
  const w = world();
  const cells = clearCells(w, { x: 30, y: 21, z: 30 }, CLEARS_BY_ID.get('build'));
  ok('"this build" takes the whole hut', cells.length === 16 * 4);
  ok('and nothing below the ground it stands on', cells.every((c) => c.y >= 20));
  ok('pointing it at the lawn takes nothing at all',
    clearCells(w, { x: 5, y: 19, z: 5 }, CLEARS_BY_ID.get('build')).length === 0);
}

{
  const w = world({ hut: false });
  for (const id of ['cube3', 'cube5', 'cube9']) {
    const spec = CLEARS_BY_ID.get(id);
    // Aimed well under the surface, so the whole box is solid ground.
    const cells = clearCells(w, { x: 30, y: 10, z: 30 }, spec);
    ok(`"${spec.name}" buried in the ground takes ${spec.size}³`, cells.length === spec.size ** 3);
    const b = cellBounds(cells);
    ok(`and it is centred on what you aimed at`,
      b.minX === 30 - (spec.size - 1) / 2 && b.maxX === 30 + (spec.size - 1) / 2);
  }
  // Half in the air: only what is actually there goes.
  const surface = clearCells(w, { x: 30, y: 19, z: 30 }, CLEARS_BY_ID.get('cube3'));
  ok('a box half in the air only takes the solid part', surface.length === 9 * 2);
  ok('air is not something you can take', surface.every((c) => c.type !== 0));
}

// --- what it hands back -------------------------------------------------------

{
  const w = world();
  const changes = clearPlan(w, { x: 30, y: 21, z: 30 }, CLEARS_BY_ID.get('build'));
  ok('a plan turns every block to air', changes.every((c) => c.next === 0));
  ok('and remembers what was there, so the bag knows what it got',
    changes.every((c) => c.prev === LOG));
  ok('nothing outside the world is in it', changes.every((c) => w.inBounds(c.x, c.y, c.z)));
}

ok('a clear with nothing in it has no box', cellBounds([]) === null);
ok('and no shape at all plans nothing', clearPlan(world(), { x: 30, y: 21, z: 30 }, null).length === 0);

// --- every shape draws itself -------------------------------------------------

ok('each one shows what it would take', CLEARS.every((c) => clearArtSvg(c).includes('<')));
ok('and no two are drawn the same', new Set(CLEARS.map((c) => clearArtSvg(c))).size === CLEARS.length);
ok('a bigger box is drawn as more squares',
  (clearArtSvg(CLEARS_BY_ID.get('cube9')).match(/<rect/g) ?? []).length
  > (clearArtSvg(CLEARS_BY_ID.get('cube3')).match(/<rect/g) ?? []).length);
ok('nothing draws for no shape', clearArtSvg(null) === '');

// --- how it behaves in the game ----------------------------------------------

ok('the panel is declared with the rest', PANELS_BY_ID.has('panel-clear'));
ok('and works in every kind of world', PANELS_BY_ID.get('panel-clear').mode === 'any');
ok('there is a button for it', /id="btn-clear"/.test(ui) && /id="t-clear"/.test(ui));
ok('picking one queues it rather than clearing blind', /onPickClear\(btn\.dataset\.clear\)/.test(ui));

// Straight through the one place blocks change, so your border refuses it, a
// claimed building refuses it, bedrock is filtered out of it, and every block
// lands in your bag exactly as breaking it by hand would.
ok('it goes the normal way, so the same rules apply',
  /runClear\(\)[\s\S]{0,700}this\.applyChanges\(changes, \{ chargeResources: false \}\)/.test(game));
ok('and points rather than framing', /runClear\(\)[\s\S]{0,120}const hit = this\.toolAim\(\)/.test(game));
ok('nothing there says so rather than doing nothing quietly',
  /title: 'Nothing there to take'/.test(game));
// A tool that removes sixty blocks with no warning of which sixty is a tool
// nobody presses twice.
ok('what it would take is outlined first', /updateClearPreview\(cells\)/.test(game));
ok('worked out once per aim, not once per caller', /if \(key !== this\.clearPickKey\)/.test(game));
ok('and it takes the first press, ahead of the other tools',
  /if \(this\.pendingClear\) return void this\.runClear\(\);/.test(game));
ok('putting a tool away clears it too', /clearPending\(\{[\s\S]{0,200}this\.pendingClear = null;/.test(game));
ok('and it counts as armed, so Break does not break underneath it',
  /pendingRoof \|\| this\.pendingTemplate \|\| this\.pendingClear/.test(game));

// --- and undo really is gone --------------------------------------------------

ok('no undo anywhere in the game', !/undoTool|toolHistory|doUndo|doRedo/.test(game));
ok('no button for one', !/btn-undo|btn-redo/.test(ui));
ok('and no key', !/KeyZ|KeyY/.test(game));
ok('the guide says so plainly', /There is no undo/.test(guide));
ok('and points at the tool that replaces it', /Clear takes it away/.test(guide));

process.exit(f ? 1 : 0);
