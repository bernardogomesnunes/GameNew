import { BIOMES } from '../src/config/biomes.js';
import { biomeCssColours, waterCssColour } from '../src/render/biomePalette.js';
import { sampleTerrainGrid, worldToCanvas } from '../src/render/mapDraw.js';

/**
 * Reported directly: "let's have some way of seeing where I am — a minimap
 * and a map." Both draw from the same sampled grid; these check the part
 * that has nothing to do with a canvas — the sampling and the coordinate
 * math a real browser's 2D context would otherwise be the only way to see
 * get right or wrong.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the palette --------------------------------------------------------

{
  const colours = biomeCssColours();
  ok('one colour per biome', colours.length === BIOMES.length);
  ok('every colour is a real CSS hex', colours.every((c) => /^#[0-9a-f]{6}$/.test(c)));
  // biomes.test.mjs already guarantees every biome's top block is unique;
  // this just checks that guarantee actually survives into a colour.
  ok('no two biomes read as the exact same colour on the map',
    new Set(colours).size === colours.length);
  ok('water is its own colour', /^#[0-9a-f]{6}$/.test(waterCssColour()));
}

// --- sampling: water wins, land reads its own biome ----------------------

{
  const SUMMER = 0; // whichever biome index wins at (0,0) with this fake gen
  const gen = {
    heightAt: () => 20,
    biomeIndexAt: () => SUMMER,
    waterLevelAt: (x, z) => (z < 0 ? 25 : 0),
  };
  const { size, step, cells } = sampleTerrainGrid(gen, 0, 0, { radius: 10, step: 2 });
  ok('grid size matches radius/step', size === 10);
  ok('step rides along on the result', step === 2);
  ok('every cell got a colour', cells.every((c) => typeof c === 'string' && c.length > 0));

  const land = biomeCssColours()[SUMMER];
  const water = waterCssColour();
  // Column 0 of the grid is centreX - radius = -10, well inside z<0 for the
  // first half of rows (z runs from -10 up) and z>=0 for the second half.
  const half = size / 2;
  ok('the water half of the grid is coloured like water',
    cells.slice(0, half * size).every((c) => c === water));
  ok('the dry half keeps the land colour',
    cells.slice(half * size).every((c) => c === land));
}

{
  // A generator with no water anywhere should never paint a drop of it.
  const gen = { heightAt: () => 20, biomeIndexAt: () => 2, waterLevelAt: () => 0 };
  const { cells } = sampleTerrainGrid(gen, 5, 5, { radius: 8, step: 2 });
  const land = biomeCssColours()[2];
  ok('a dry world samples as nothing but land', cells.every((c) => c === land));
}

// --- coordinate math: a point maps to where it actually is ---------------

{
  const [cx, cy] = worldToCanvas(0, 0, 0, 0, 100, 400, 400);
  ok('standing on the centre point lands dead centre', cx === 200 && cy === 200);

  const [ex] = worldToCanvas(100, 0, 0, 0, 100, 400, 400);
  ok('the edge of the view lands at the edge of the canvas', ex === 400);

  const [wx] = worldToCanvas(-100, 0, 0, 0, 100, 400, 400);
  ok('the opposite edge lands at the opposite edge', wx === 0);

  const [, sy] = worldToCanvas(0, 50, 0, 0, 100, 400, 400);
  ok('south (+Z) lands below centre, not above it', sy > 200);

  // Recentring the view moves everything with it rather than redrawing the
  // same world in a different place on screen.
  const [rx] = worldToCanvas(50, 0, 50, 0, 100, 400, 400);
  ok('a point level with the new centre reads as centred once the view moves there', rx === 200);
}

process.exit(f ? 1 : 0);
