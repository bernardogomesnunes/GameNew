import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Reported directly: Creative mode's terrain was limited — a fixed 64x64
 * patch from the old TerrainGenerator, with none of Duilt's biomes, rivers,
 * mountains or ocean. Creative has no territory to fence in, so there was
 * never a reason it needed a smaller world than Duilt gets. Game.js's
 * newWorld() is untestable directly here (it needs a real Three.js scene),
 * so this checks its source the same way the rest of the suite does for
 * Game.js-only logic.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const gamePath = fileURLToPath(new URL('../src/Game.js', import.meta.url));
const src = readFileSync(gamePath, 'utf8');
// `indexOf('newWorld(')` alone finds the constructor's own call to it first
// — this needs the method definition itself, further down the file.
const defAt = src.indexOf('newWorld({ silent, mode');
const body = src.slice(defAt, defAt + 2000);

ok('newWorld no longer builds a small fixed-size world for Creative',
  !/sizeX:\s*64,\s*sizeZ:\s*64/.test(body));
ok('both modes call the same endless generator Duilt already used',
  (body.match(/generateEndlessWorld\(/g) ?? []).length === 1);
ok('the old fixed-size Creative generator is no longer imported into Game.js',
  !/from '\.\/world\/TerrainGenerator\.js'/.test(src));

process.exit(f ? 1 : 0);
