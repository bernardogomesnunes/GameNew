import { cubeSvg, itemIcon, hasCube, shade } from '../src/config/cubes.js';
import { BLOCKS, BLOCKS_BY_ID, PLACEABLE_BLOCKS } from '../src/config/blocks.js';
import { ITEMS } from '../src/config/items.js';
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

// --- a cube for every block --------------------------------------------------

ok('every placeable block can be drawn as a cube', PLACEABLE_BLOCKS.every((b) => hasCube(b.id)));
ok('and nothing throws drawing them', PLACEABLE_BLOCKS.every((b) => cubeSvg(b.id).length > 100));
ok('an unknown block draws nothing rather than breaking', cubeSvg(9999) === '');

{
  const svg = cubeSvg(1, { size: 40 });
  ok('a cube has three faces', (svg.match(/<path/g) ?? []).length === 3);
  ok('and they are three different shades',
    new Set(svg.match(/fill="rgb\([^)]*\)"/g) ?? []).size === 3);
  ok('the size asked for is the size drawn', svg.includes('width="40"') && svg.includes('height="40"'));
  // The top face is the lit one; a cube lit from below reads as a hole.
  const fills = [...svg.matchAll(/fill="rgb\((\d+),(\d+),(\d+)\)"/g)]
    .map((m) => Number(m[1]) + Number(m[2]) + Number(m[3]));
  ok('with the top face brightest', fills[0] > fills[1] && fills[1] > fills[2]);
}

ok('see-through blocks are drawn see-through', cubeSvg(10).includes('opacity="0.62"'));
ok('and solid ones are not', cubeSvg(3).includes('opacity="1"'));

// A hint of texture, not a texture. The palette is meant to stay flat.
{
  const grass = cubeSvg(1), glass = cubeSvg(10);
  ok('ground materials carry a few grain marks', (grass.match(/<circle/g) ?? []).length >= 3);
  ok('but never many', BLOCKS.every((b) => (cubeSvg(b.id).match(/<circle/g) ?? []).length <= 6));
  ok('and worked materials like glass carry none', (glass.match(/<circle/g) ?? []).length === 0);
}

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

ok('the hotbar draws cubes', /cubeSvg\(b\.id/.test(ui));
ok('the Duilt hotbar draws whatever the item places', /itemIcon\(e\.spec/.test(ui));
ok('and so does the bag', /itemIcon\(spec/.test(duilt));
ok('a cube is its own swatch, with no coloured tile behind it',
  /\.swatch-cube[\s\S]{0,200}background: none/.test(css));

// --- the ground is not one colour --------------------------------------------

ok('the mesher varies a block colour by where it is', /patchNoise\(origin\[0\], origin\[2\]\)/.test(mesher));
ok('and the wobble is fixed to the position, so nothing shimmers as you walk',
  /function hashInt/.test(mesher) && !/Math\.random/.test(mesher));
// Brightness alone reads as cloud shadow over one colour; the channels have to
// come apart for it to read as a different green.
ok('the channels move apart, not just up and down', /const skew = /.test(mesher));
ok('each channel takes the skew differently',
  /col\.r \* shade \* \(light - skew\)/.test(mesher)
  && /col\.g \* shade \* \(light \+ skew/.test(mesher));

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

process.exit(f ? 1 : 0);
