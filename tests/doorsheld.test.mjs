import { readFileSync } from 'node:fs';
import { doorBlock } from '../src/config/blocks.js';

/**
 * Asked for directly: "When 2 doors are next to each other we should have
 * them open each from their side, leaving the middle open", and "Blocks the
 * player is holding should be the same as the icon".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { doorMirrored } = await import('../src/world/ChunkMesher.js');

const shut = (facing = 0, top = false) => doorBlock({ open: false, top, facing });
ok('a door alone is drawn as it always was', !doorMirrored(shut(), 0));
ok('a door with a door on its hinge side, facing the same way, is mirrored', doorMirrored(shut(), shut()));
ok('and open or shut alike', doorMirrored(doorBlock({ open: true, facing: 0 }), shut()));
ok('a door facing the other way beside it is not a pair', !doorMirrored(shut(0), shut(2)));
ok('a top half pairs with a top half', doorMirrored(shut(0, true), shut(0, true)) && !doorMirrored(shut(0, true), shut(0, false)));

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('opening one of a pair opens both', /\[\.\.\.this\.doorCells\(hit\), \.\.\.this\.doorPartnerCells\(hit, door\)\]/.test(game));

const held = readFileSync(new URL('../src/render/heldModel.js', import.meta.url), 'utf8');
const hand = readFileSync(new URL('../src/render/HandView.js', import.meta.url), 'utf8');
ok('a plain block in the hand is textured with its own tiles, top and sides', /export function heldTexturedCube\(blockId\)/.test(held) && /materials: \[s, s, mat\(top\), s, s, s\]/.test(held));
ok('the hand shows it in place of the flat-coloured box', /const cube = heldCubeFor\(held\);/.test(hand) && /this\.cube\.material = cube\.materials;/.test(hand));

process.exit(f ? 1 : 0);
