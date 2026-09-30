import { cubeSvg, itemIcon, hasCube, shade } from '../src/config/cubes.js';
import { BLOCKS, BLOCKS_BY_ID, PLACEABLE_BLOCKS } from '../src/config/blocks.js';
import { ITEMS } from '../src/config/items.js';
import { TEXTURES, textureFor, TILE_BASE } from '../src/config/textures.js';
import { readFileSync } from 'node:fs';

/**
 * How the game looks: cubes in the slots, and ground that is not one colour.
 *
 * A bag of flat coloured squares with a line drawing on each says "here is an
 * icon for a thing". A bag of little cubes says "here is the thing" — which it
 * is, since every one of them is about to be a block in the world.
 *
 * And a field was one flat green over hundreds of blocks, which is what made a
 * meadow read as a painted plane. The colours wander now, in hue as well as
 * brightness, because brightness alone just looks like patchy cloud over the
 * same green.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const mesher = readFileSync(new URL('../src/world/ChunkMesher.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const duilt = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');

// --- a cube for every block --------------------------------------------------

ok('every placeable block can be drawn as a cube', PLACEABLE_BLOCKS.every((b) => hasCube(b.id)));
ok('and nothing throws drawing them', PLACEABLE_BLOCKS.every((b) => cubeSvg(b.id).length > 100));
ok('an unknown block draws nothing rather than breaking', cubeSvg(9999) === '');

{
  // Reported directly: "bricks icon is different from the brick itself, I
  // think it is worth it to review all of them." A cube's icon is drawn
  // with the same tile the world draws the block with.
  const svg = cubeSvg(9, { size: 40 });
  ok('a brick is drawn with its own world texture', /<image id="tile-9" href="data:image\/bmp;base64,/.test(svg));
  ok('on all three faces', (svg.match(/<use href="#tile-9"/g) ?? []).length === 3);
  ok('with the two sides shaded darker than the top', (svg.match(/fill="#000" opacity="/g) ?? []).length === 2);
  ok('the size asked for is the size drawn', svg.includes('width="40"') && svg.includes('height="40"'));
  ok('every full block in the game has its texture on its icon',
    PLACEABLE_BLOCKS.filter((b) => (b.shape ?? 'cube') === 'cube').every((b) => cubeSvg(b.id).includes('<image')));
  ok('and the same block draws the same icon every time', cubeSvg(9) === cubeSvg(9));
  ok('different blocks, different tiles', cubeSvg(9).match(/base64,([^"]+)/)[1] !== cubeSvg(7).match(/base64,([^"]+)/)[1]);
}

ok('see-through blocks are drawn see-through', cubeSvg(10).includes('opacity="0.62"'));
ok('and solid ones are not', cubeSvg(3).includes('opacity="1"'));

ok('shading stays inside a byte', shade(0xffffff, 2) === 'rgb(255,255,255)' && shade(0x000000, 1) === 'rgb(0,0,0)');

// --- what goes in a slot -----------------------------------------------------

{
  const placers = ITEMS.filter((i) => i.block != null);
  ok(`${placers.length} items place a block, and all of them show it`,
    placers.length > 5 && placers.every((i) => !!itemIcon(i)));
  const tools = ITEMS.filter((i) => i.kind === 'tool');
  ok('tools keep their drawing — a cube would be a lie about what you hold',
    tools.length > 0 && tools.every((i) => itemIcon(i) === null));
  ok('and so does food', ITEMS.filter((i) => i.kind === 'food').every((i) => itemIcon(i) === null));
}

ok('the hotbar draws each block as it is — a cube, or its real shape', /blockIcon\(b\.id/.test(ui));
// The Duilt hotbar is real equipped slots now (see items/Inventory.js's
// PLAYABLE_SLOTS), drawn with the same itemIcon(spec, ...) call the bag
// panel already used — one drawing rule for "what does this item look
// like", not two separate ones for "in the hotbar" vs "in the bag".
ok('the Duilt hotbar draws whatever the item places, the same way the bag does',
  (ui.match(/itemIcon\(spec, \{ size: 30 \}\)/g) ?? []).length > 0);
ok('and so does the bag', /itemIcon\(spec/.test(duilt));
ok('a cube is its own swatch, with no coloured tile behind it',
  /\.swatch-cube[\s\S]{0,200}background: none/.test(css));

// --- the ground is not one colour --------------------------------------------

ok('the mesher varies a block colour by where it is', /patchNoise\(ox, oz\)/.test(mesher));
ok('and the wobble is fixed to the position, so nothing shimmers as you walk',
  /function hashInt/.test(mesher) && !/Math\.random/.test(mesher));
// Brightness alone reads as cloud shadow over one colour; the channels have to
// come apart for it to read as a different green.
ok('the channels move apart, not just up and down', /const skew = /.test(mesher));
ok('each channel takes the skew differently',
  /r \*= light - skew;/.test(mesher)
  && /g \*= light \+ skew \* 0\.7;/.test(mesher));

{
  const table = mesher.slice(mesher.indexOf('const VARIATION'), mesher.indexOf('}, { get:'));
  const amounts = [...table.matchAll(/:\s*(0\.\d+)/g)].map((m) => Number(m[1]));
  ok(`${amounts.length} materials vary`, amounts.length >= 8);
  ok('none of them so much that the palette stops being flat', amounts.every((a) => a <= 0.35));
  ok('and grass varies most, being the thing you see by the thousand',
    /1: 0\.2\d/.test(table));
  // A mottled brick is a damaged brick, not a natural one.
  ok('worked materials are left alone',
    !/\b9:\s*0\./.test(table) && !/\b10:\s*0\./.test(table) && !/\b17:\s*0\./.test(table));
}

// --- the surface of a block, close up ----------------------------------------

// Dots, lines and shading painted from a recipe rather than downloaded. A
// texture pack would arrive with its own palette and be the one thing on
// screen that could not follow the block registry.
{
  const names = Object.keys(TEXTURES);
  ok(`${names.length} materials have a recipe`, names.length >= 15);
  ok('every recipe darkens by something', Object.values(TEXTURES).every((r) => (r.depth ?? 0) > 0));
  // Tiles multiply the block's colour, so anything approaching black would
  // wipe the palette out rather than shade it.
  ok('and none of them so much that the colour is lost',
    Object.values(TEXTURES).every((r) => (r.depth ?? 0) <= 0.3));
  ok('every recipe names something to draw', Object.values(TEXTURES).every((r) =>
    r.marks || r.lines || r.blobs || r.veins || r.cracks || r.band || r.speck));
  ok('the glyphs they key off are real',
    names.every((n) => BLOCKS.some((b) => b.glyph === n) || ITEMS.some((i) => i.glyph === n)));
  ok('a material with no recipe is simply flat', textureFor('nonesuch') === null);
  ok('tiles start near white, so they only ever shade', TILE_BASE > 0.9 && TILE_BASE <= 1);
}

// The shader has to declare its own attributes: three only plumbs `uv` and
// `vMapUv` through for a material with a `map`, and this one cannot have one —
// the tiles are an array, which `map` will not hold. Leaning on those was why
// the first attempt would not compile at all.
ok('the mesher patches a material rather than writing one',
  /onBeforeCompile/.test(mesher) && /MeshLambertMaterial/.test(mesher));
ok('with its own attribute names', /attribute vec2 tileUv/.test(mesher) && /attribute float layer/.test(mesher));
ok('and its own varyings', /varying vec2 vTileUv/.test(mesher) && /varying float vLayer/.test(mesher));
ok('hooked where they always exist', /#include <begin_vertex>/.test(mesher) && /#include <color_fragment>/.test(mesher));
ok('a block with no recipe is left alone', /if \(vLayer > -0\.5\)/.test(mesher));
// A greedy quad can span ten blocks; its tile has to repeat, not stretch.
ok('the tile repeats across a merged quad', /fract\(vTileUv\)/.test(mesher));
ok('and the UVs are sized to the quad', /U\[t \+ 2\] = w;[\s\S]{0,80}U\[t \+ 4\] = w; U\[t \+ 5\] = h;/.test(mesher));
// Shading after the vertex colour, so it shades the colour the block ended up.
ok('the tile shades the varied colour, not the flat registry one',
  /#include <color_fragment>[\s\S]{0,300}diffuseColor\.rgb \*= tile\.rgb/.test(mesher));
ok('and a tile with holes in it (leaves) is see-through there', /if \(tile\.a < 0\.5\) discard;/.test(mesher));


// --- the crosshair and the camera are the same point --------------------------

/**
 * The crosshair was positioned at 50% of the UI layer, which is a *sibling* of
 * the canvas. That is only the middle of the picture while the two elements
 * have identical boxes. They do on a desktop. On a phone browser, whose
 * address bar and toolbar grow and shrink the page under you, they can differ
 * by the height of a toolbar — and then the mark you are aiming with is not
 * where the camera is pointing, so you break the block below the one you meant.
 *
 * Measuring the canvas removes the assumption rather than tuning it.
 */
ok('the crosshair is placed from the canvas, not from a percentage',
  /placeCrosshair\(canvas\)/.test(ui) && /canvas\.getBoundingClientRect\(\)/.test(ui));
ok('and it is put wherever the middle of that rectangle is',
  /c\.left - root\.left \+ c\.width \/ 2/.test(ui) && /c\.top - root\.top \+ c\.height \/ 2/.test(ui));
ok('resizing moves it', /this\.ui\?\.placeCrosshair\(this\.renderer\.domElement\)/.test(game));
ok('a canvas with no size yet is left alone', /if \(!c\.width \|\| !c\.height\) return;/.test(ui));

// A phone browser sliding its bars in and out does not always fire `resize`.
ok('the visual viewport is watched too', /window\.visualViewport\?\.addEventListener/.test(game));
ok('for both the ways it changes', /for \(const event of \['resize', 'scroll'\]\)/.test(game));
ok('and an orientation change is re-measured once it has settled',
  /orientationchange[\s\S]{0,120}setTimeout\(\(\) => this\.onResize\(\), 250\)/.test(game));

{
  // The bag showed two tools as blank squares: nothing drawn for them at all.
  const { GLYPHS } = await import('../src/config/glyphs.js');
  const blank = ITEMS.filter((i) => !itemIcon(i) && !GLYPHS[i.glyph]).map((i) => i.id);
  ok(`every item in the game has a picture (${blank.join(', ') || 'none missing'})`, blank.length === 0);
}

process.exit(f ? 1 : 0);
