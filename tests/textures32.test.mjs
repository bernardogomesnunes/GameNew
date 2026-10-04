import { readFileSync } from 'node:fs';
import { BLOCKS, BLOCKS_BY_ID, DARK_STONE, DARK_BRICK, CALCADA_DARK, SKY_MARBLE } from '../src/config/blocks.js';
import { blockTexture, BLOCK_TEXTURES, TILE_SCALE } from '../src/config/textures.js';
import { tileFor, tileValue, layerFor, topLayerFor, blockTextureArray, TILE_SIZE } from '../src/render/BlockTextures.js';
import { cubeSvg } from '../src/config/cubes.js';

/**
 * The look-and-sound plan, section 3 and the palette half of section 2:
 * textures at 32×32 with the colour inside them, darker joints and edges, and
 * a fresher palette in which the Stone Kingdom's four dark materials can be
 * told apart at a glance.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const mesher = readFileSync(new URL('../src/world/ChunkMesher.js', import.meta.url), 'utf8');
const painter = readFileSync(new URL('../src/render/BlockTextures.js', import.meta.url), 'utf8');

// --- colour science, enough to judge a palette ------------------------------------

const toLight = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
/** A hex colour in CIELAB: L 0..100, and a/b, how red-green and yellow-blue it is. */
function lab(hex) {
  const [r, g, b] = [16, 8, 0].map((s) => toLight(((hex >> s) & 255) / 255));
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const fn = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return { L: 116 * fn(Y) - 16, a: 500 * (fn(X) - fn(Y)), b: 200 * (fn(Y) - fn(Z)) };
}
/** How different two colours look (CIE76 ΔE: about 2 is just noticeable, 10 is plainly different). */
const deltaE = (p, q) => { const A = lab(p), B = lab(q); return Math.hypot(A.L - B.L, A.a - B.a, A.b - B.b); };
const chroma = (hex) => { const c = lab(hex); return Math.hypot(c.a, c.b); };
const colourOf = (name) => BLOCKS.find((b) => b.name === name).color;

// --- the atlas ------------------------------------------------------------------------

ok('tiles are 32×32', TILE_SIZE === 32 && tileFor(3).length === 32 * 32 * 4);
const arr = blockTextureArray();
ok(`one layer per textured block, stacked (${arr.layers} layers)`, arr.texture.image.width === 32 && arr.texture.image.depth === arr.layers);
// Colour and depth layers, a third more for the mips: kept well under a phone's appetite.
const bytes = arr.layers * 32 * 32 * 4 * (2 + 1 / 3);
ok(`the whole atlas is phone-sized (${Math.round(bytes / 1024)} KB)`, bytes < 1.5 * 1024 * 1024 && arr.layers <= 80);
ok('mipmapped for the distance, crisp up close', arr.texture.generateMipmaps && /LinearMipmapLinear/.test(painter) && /magFilter = THREE\.NearestFilter/.test(painter));
ok('sampled with the quad\'s own gradients, so tile seams do not blur', /textureGrad\(blockTiles, vec3\(fract\(vTileUv\), vLayer\), tileDx, tileDy\)/.test(mesher));
ok('and scaled back up by the tile scale in the shader', /diffuseColor\.rgb \*= tile\.rgb \* \$\{TILE_SCALE/.test(mesher));
ok('the depth reads its neighbours a 32nd of a tile away', /TEXEL = 1\.0 \/ \$\{TILE_SIZE/.test(mesher));
ok('and fades where texels are smaller than pixels, so it does not sparkle far off', /float fade = clamp\(2\.0 - max\(length\(duv1\), length\(duv2\)\)/.test(mesher));

// --- every block has a surface -----------------------------------------------------

const cubes = BLOCKS.filter((b) => !b.shape && !b.system && !b.stateOf && !/^Flowing/.test(b.name));
const bare = cubes.filter((b) => layerFor(b.id) < 0).map((b) => b.name);
ok(`every full block has a texture (${bare.join(', ') || 'none bare'})`, bare.length === 0);
ok('shaped blocks take no layer of their own', BLOCKS.filter((b) => b.shape).every((b) => layerFor(b.id) === -1));
ok('logs and grass have a top of their own', [4, 41, 43, 1].every((id) => topLayerFor(id) !== layerFor(id)));
ok('every per-block recipe names a real block', Object.keys(BLOCK_TEXTURES).every((n) => BLOCKS.some((b) => b.name === n)));

// --- a tile averages to its block's colour ---------------------------------------

/** A tile's mean, in light, weighted the way the eye weighs this colour's channels. */
function meanOf(id, top = false) {
  const t = tileFor(id, { top }), c = [16, 8, 0].map((s) => toLight(((BLOCKS_BY_ID.get(id).color >> s) & 255) / 255));
  const w = [0.2126 * c[0], 0.7152 * c[1], 0.0722 * c[2]], ws = w[0] + w[1] + w[2];
  let sum = 0, n = 0;
  for (let i = 0; i < t.length / 4; i++) {
    if (!t[i * 4 + 3]) continue;
    sum += (w[0] * tileValue(t[i * 4]) + w[1] * tileValue(t[i * 4 + 1]) + w[2] * tileValue(t[i * 4 + 2])) / ws; n++;
  }
  return sum / n;
}
const evened = cubes.filter((b) => !blockTexture(b).fringe && (blockTexture(b).lift ?? 1) > 0);
const off = evened.filter((b) => Math.abs(meanOf(b.id) - 1) > 0.06).map((b) => `${b.name} ${meanOf(b.id).toFixed(2)}`);
// So the far hills, the map and the plain-coloured slabs match the textured block.
ok(`each texture averages to its block's registry colour (${off.join(', ') || 'all within 6%'})`, off.length === 0);
ok('a byte reaches past the colour, so light mortar and glowing cracks can be painted', TILE_SCALE >= 2 && tileValue(255) === TILE_SCALE);

// --- colour inside the texture ------------------------------------------------------

/** How many pixels of a tile lean warm (red over blue) and cool (blue over red) relative to the tile. */
function leanings(id) {
  const t = tileFor(id);
  let warm = 0, cool = 0;
  for (let i = 0; i < t.length / 4; i++) {
    const r = t[i * 4], b = t[i * 4 + 2];
    if (r > b * 1.06) warm++;
    if (b > r * 1.06) cool++;
  }
  return { warm, cool };
}
{
  const s = leanings(3);
  ok(`stone has warm and cool flecks in it, not one grey (${s.warm} warm, ${s.cool} cool)`, s.warm > 30 && s.cool > 30);
  const t = tileFor(8);
  let moss = 0;
  for (let i = 0; i < t.length / 4; i++) if (t[i * 4 + 1] > t[i * 4] * 1.15 && t[i * 4 + 1] > t[i * 4 + 2] * 1.3) moss++;
  // Requested directly: "Cobble was fine as it was ... the only one I think
  // it got worse". It is the first cobblestone again: no moss.
  ok(`cobble is plain stones again, no moss (${moss} pixels)`, moss === 0);
  const brick = tileFor(9);
  let mortar = 0;
  for (let i = 0; i < brick.length / 4; i++) if (brick[i * 4 + 2] > brick[i * 4] * 0.9 && tileValue(brick[i * 4 + 2]) > 2) mortar++;
  ok(`red brick has pale mortar between the bricks (${mortar} pixels)`, mortar > 120);
  const dark = tileFor(DARK_BRICK);
  let joints = 0;
  for (let i = 0; i < dark.length / 4; i++) if (tileValue(dark[i * 4]) < 0.4) joints++;
  ok(`dark brick's mortar is darker than its bricks (${joints} pixels)`, joints > 120);
  const end = tileFor(4, { top: true }), side = tileFor(4);
  const lum = (t) => { let s = 0; for (let i = 0; i < t.length / 4; i++) s += t[i * 4] + t[i * 4 + 1]; return s; };
  ok('a log\'s cut end is pale wood inside dark bark', lum(end) > lum(side) * 1.6);
  const grass = tileFor(1);
  const at = (x, y) => grass.slice((y * 32 + x) * 4, (y * 32 + x) * 4 + 3);
  const top = at(16, 31), low = at(16, 4);
  // Multipliers of the grass colour: the earth below leans far redder than the turf.
  ok('a grass side is earth with the turf over its top edge', top[1] / top[0] > 1.5 * (low[1] / low[0]));
}

// Darker edges and joints, where they belong.
{
  const darkRow = (id, y) => { const t = tileFor(id); let s = 0; for (let x = 0; x < 32; x++) s += t[(y * 32 + x) * 4]; return s / 32; };
  ok('planks have a dark seam under each board', darkRow(7, 0) < darkRow(7, 4) * 0.6 && darkRow(7, 8) < darkRow(7, 12) * 0.6);
  ok('dark stone is cut into big blocks with fine joints', darkRow(DARK_STONE, 0) < darkRow(DARK_STONE, 8) * 0.6 && darkRow(DARK_STONE, 16) < darkRow(DARK_STONE, 8) * 0.6);
  ok('and a dark stone block is twice a brick\'s length (one joint per course)', /const ASHLAR_JOINTS = \[\[0\], \[16\]\]/.test(painter));
  ok('gold has a bevel: lit along the top, shadowed along the foot', darkRow(13, 30) > darkRow(13, 1) * 1.4);
}

// --- the palette ------------------------------------------------------------------

{
  // Four materials of the Stone Kingdom that used to read as one dark grey.
  const kingdom = { 'Dark Stone': DARK_STONE, 'Dark Brick': DARK_BRICK, Obsidian: 14, 'Dark Calçada': CALCADA_DARK };
  const names = Object.keys(kingdom);
  let least = Infinity, pair = '';
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const d = deltaE(BLOCKS_BY_ID.get(kingdom[names[i]]).color, BLOCKS_BY_ID.get(kingdom[names[j]]).color);
      if (d < least) { least = d; pair = `${names[i]} / ${names[j]}`; }
    }
  }
  ok(`the Stone Kingdom's materials are plainly different colours (closest: ${pair}, ΔE ${least.toFixed(1)})`, least >= 12);
  const ds = lab(BLOCKS_BY_ID.get(DARK_STONE).color), db = lab(BLOCKS_BY_ID.get(DARK_BRICK).color);
  const ob = lab(BLOCKS_BY_ID.get(14).color), dc = lab(BLOCKS_BY_ID.get(CALCADA_DARK).color);
  ok('dark stone is a cool blue-grey', ds.b < -5 && chroma(BLOCKS_BY_ID.get(DARK_STONE).color) < 20);
  ok('dark brick is a warm red-brown', db.a > 10 && db.b > 5);
  ok('obsidian is purple-black', ob.L < 20 && ob.a > 8 && ob.b < -8);
  ok('dark calçada is a true black: darkest of them, and neutral', dc.L < 12 && chroma(BLOCKS_BY_ID.get(CALCADA_DARK).color) < 5
    && [ds, db, ob].every((o) => o.L > dc.L));
  ok('and every one of them is still dark, as befits the dark path', [ds, db, ob, dc].every((o) => o.L < 45));
  // Their textures differ in pattern as well as colour.
  ok('dark stone and dark brick are laid differently', blockTexture(BLOCKS_BY_ID.get(DARK_STONE)).lines === 'ashlar' && blockTexture(BLOCKS_BY_ID.get(DARK_BRICK)).lines === 'brick');
  ok('obsidian has a sheen', !!blockTexture(BLOCKS_BY_ID.get(14)).sheen);
}
{
  // Fresher: not a palette of greys. The everyday materials carry real colour.
  const lively = ['Grass', 'Leaves', 'Dirt', 'Sand', 'Planks', 'Brick', 'Water', 'Gold Block', 'Wood', 'Moss', 'Farmland', 'Lava'];
  const dull = lively.filter((n) => chroma(colourOf(n)) < 20);
  ok(`everyday materials are properly coloured (${dull.join(', ') || 'none dull'})`, dull.length === 0);
  const cubesC = cubes.map((b) => chroma(b.color));
  const coloured = cubesC.filter((c) => c > 10).length;
  ok(`most full blocks are not grey (${coloured} of ${cubesC.length})`, coloured / cubesC.length > 0.6);
  // Similar materials told apart.
  for (const [a, b] of [['Stone', 'Cobblestone'], ['Grass', 'Moss'], ['Dirt', 'Farmland'], ['Sand', 'Gravel'], ['Marble', 'Sky Marble'], ['Brick', 'Dark Brick'], ['Planks', 'Wood'], ['Gold Block', 'Gold Trim']]) {
    const d = deltaE(colourOf(a), colourOf(b));
    ok(`${a} and ${b} differ in colour or in pattern (ΔE ${d.toFixed(1)})`, d >= 6 || blockTexture(BLOCKS.find((x) => x.name === a)) !== blockTexture(BLOCKS.find((x) => x.name === b)));
  }
  ok('sky marble is cool and near white', lab(BLOCKS_BY_ID.get(SKY_MARBLE).color).L > 90 && lab(BLOCKS_BY_ID.get(SKY_MARBLE).color).b < 0);
  // A slab, a stair or a wall is the same colour as the block it is cut from.
  for (const [cut, whole] of [['Stone Slab', 'Stone'], ['Plank Stairs', 'Planks'], ['Brick Wall', 'Brick'], ['Dark Stone Wall', 'Dark Stone'], ['Cobblestone Wall', 'Cobblestone']]) {
    ok(`${cut} matches ${whole}`, colourOf(cut) === colourOf(whole));
  }
}

// --- the bag ---------------------------------------------------------------------

{
  const svg = cubeSvg(9, { size: 40 });
  const b64 = svg.match(/base64,([^"]+)/)[1];
  const bmp = Buffer.from(b64, 'base64');
  ok('a bag icon carries the 32×32 tile', bmp.readInt32LE(18) === 32 && bmp.readInt32LE(22) === 32);
  // Middle of a brick in the icon: brick red, not a pink or a grey.
  const px = (x, y) => { const o = 54 + y * 96 + x * 3; return [bmp[o + 2], bmp[o + 1], bmp[o]]; };
  const [r, g, b] = px(8, 12);
  ok(`and in the brick's own colour (${r},${g},${b})`, r > g + 40 && r > b + 40);
}

process.exit(f ? 1 : 0);
