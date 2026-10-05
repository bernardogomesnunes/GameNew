import { readFileSync } from 'node:fs';
import { EventBus } from '../src/core/EventBus.js';

/**
 * Reported directly: "the game is breaking after a while when opening in the
 * browser ... our game seems to have become too big for the browser."
 * Measured: the page's memory climbed by ~100 MB every time a world was
 * opened, and kept climbing while walking, to over 1.5 GB — far past what a
 * phone's browser allows a tab.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- old worlds let go ---------------------------------------------------------------
globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { GamificationEngine } = await import('../src/gamification/GamificationEngine.js');
const bus = new EventBus();
const count = () => [...bus.listeners.values()].reduce((n, s) => n + s.size, 0);
const before = count();
const a = new GamificationEngine(bus);
const per = count() - before;
ok(`an engine listens to the settlement (${per} subscriptions)`, per > 0);
a.dispose();
ok('and lets every one of them go when it is replaced', count() === before);
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('the game drops the old engine before making the next one',
  (game.match(/this\.gamification\?\.dispose\?\.\(\);\s*this\.gamification = new GamificationEngine\(this\.bus\);/g) ?? []).length === 2);

// --- chunk meshes don't keep a second copy ---------------------------------------------
const mesher = readFileSync(new URL('../src/world/ChunkMesher.js', import.meta.url), 'utf8');
ok('chunk geometry drops its arrays once they are on the GPU', /return freeAfterUpload\(geo\);/.test(mesher));
ok('so does the props geometry', /geo\.computeBoundingSphere\(\);\s*freeAfterUpload\(geo\);/.test(mesher));
ok('after the bounding sphere is worked out, which culling needs',
  /geo\.computeBoundingSphere\(\);\s*return freeAfterUpload\(geo\);/.test(mesher));

process.exit(f ? 1 : 0);
