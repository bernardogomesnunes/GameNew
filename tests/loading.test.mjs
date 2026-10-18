import { readFileSync } from 'node:fs';

/**
 * Asked for directly: "we have big loading to load the game in the
 * beginning, can we have a loading screen in style with the game showing
 * progress". Measured first: the page showed nothing for ~13 s on a slow
 * machine — a third of it a world made at boot and thrown away when the
 * title scene made its own.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
ok('the loading screen is in the page itself, up before any of the game arrives', /<div id="loading" role="progressbar"[\s\S]*class="ld-fill"[\s\S]*<div id="app">/.test(html));
ok('in the game\'s pixel font, from the start', /@font-face \{ font-family: 'Pixelify Sans'/.test(html) && /rel="preload" href="\/fonts\/pixelify-sans-latin-700-normal\.woff2"/.test(html));
ok('its glint keeps moving while the world is being made', /@keyframes ld-glint \{ from \{ transform:/.test(html));

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
ok('the bar moves with each real stage', /loadingProgress\(35, 'Building the world…'\);[\s\S]*await nextPaint\(\);[\s\S]*new Game\(app\)[\s\S]*loadingProgress\(60, 'Drawing the land…'\);[\s\S]*followDrawing\(\(\) => game\.titleProgress\(\)/.test(main));
ok('and goes away when the land is drawn', /game\.booting = false;\s*loadingDone\(\);/.test(main));
ok('a failure says so rather than leaving the bar there forever', /catch\(\(err\) => \{[\s\S]*Reload the page/.test(main));

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('boot makes the title scene\'s world, once', /this\.newWorld\(\{ mode: CREATIVE, name: 'Title', silent: true, scenery: true, title: true, seed: TITLE_SEED \}\);\s*this\.bootWorld = this\.world;/.test(game)
  && /if \(this\.world !== this\.bootWorld\) this\.newWorld\(/.test(game));
ok('under the loading screen the land is made faster', /this\.generateQueued\(this\.booting \? BOOT_BUDGET_MS : undefined\);\s*this\.drainRemeshQueue\(this\.booting \? BOOT_BUDGET_MS : undefined\);/.test(game));

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');
const chunks = new Map();
// The title camera starts 32 east of the middle (titleScene's orbitPose).
const fake = {
  drawnAround: Game.prototype.drawnAround,
  title: { site: { x: 0, y: 0, z: 0 }, t: 0, eyeY: 16 },
  world: { hasChunk: (cx, cz) => chunks.has(`${cx},${cz}`), getChunk: (cx, cz) => chunks.get(`${cx},${cz}`) },
};
ok('nothing drawn, nothing done', Game.prototype.titleProgress.call(fake) === 0);
// Reported directly: "The game is taking too long to load". It waits only
// for what the camera sees first: round the middle and under the camera.
for (let cx = -2; cx <= 3; cx++) for (let cz = -2; cz <= 1; cz++) chunks.set(`${cx},${cz}`, { mesh: new Map() });
ok('all it sees drawn, all done', Game.prototype.titleProgress.call(fake) === 1);
ok('  without the land behind the camera, or far past the middle', !chunks.has('5,0') && !chunks.has('-4,0'));
chunks.delete('0,0');
ok('  but not without the middle', Game.prototype.titleProgress.call(fake) < 1);

// The scenery lays out no settlement, and its land comes in nearest first.
{
  const { generateEndlessWorld } = await import('../src/world/StarterWorld.js');
  const { world } = generateEndlessWorld({ seed: 718281, settle: false });
  ok('the title scene\'s world makes no land up front: no settlement laid out', [...world.allChunks()].length === 0);
  ok('  it starts at the title scene, and streams its land in', /settle: !title/.test(game) && /let spawn = title\s*\? \{ x: TITLE_SITE\.x \+ 0\.5/.test(game) && /this\.rebuildAllChunks\(\{ all: !title \}\);/.test(game));
  ok('  and gets no kit; the showcase, scenery too, keeps its settlement and its kit', /if \(sandbox && !title\) this\.duilt\.grantCreativeKit\(\);/.test(game) && /name: 'Showcase', scenery: true, silent: true, seed: SHOWCASE_SEED/.test(game));
  ok('land is drawn nearest first', /\[\.\.\.this\.remeshQueue\]\.sort\(\(a, b\) => this\.chunkDistSq\(a\) - this\.chunkDistSq\(b\)\)/.test(game));
}

process.exit(f ? 1 : 0);
