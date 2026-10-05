import { readFileSync } from 'node:fs';

/**
 * The autosave's clock was set once at startup and never again, so five
 * minutes in every frame saved — a whole copy of the world into the browser
 * and another upload, every frame. Found looking into "Pick axe ... if I use
 * it and leave the game when I get back it seems to be full again of health".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');

const g = { lastAutosave: 0, discarded: false, worldId: 'w', worldIsLocal: true, saves: 0, saveLocally() { this.saves++; return true; } };
Game.prototype.saveNow.call(g);
ok('a save starts the autosave clock again', g.lastAutosave > 0 && g.saves === 1);
const scenery = { lastAutosave: 0, discarded: true, worldId: 'w' };
Game.prototype.saveNow.call(scenery);
ok('even one that has nothing to write, so it is not retried every frame', scenery.lastAutosave > 0);

const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('the autosave only fires once its interval has passed since the last save',
  /if \(performance\.now\(\) - this\.lastAutosave > AUTOSAVE_INTERVAL_MS\) this\.saveNow\(\);/.test(game)
  && /saveNow\(\) \{[\s\S]{0,600}this\.lastAutosave = performance\.now\(\);\s*if \(this\.discarded \|\| !this\.worldId\) return false;/.test(game));

process.exit(f ? 1 : 0);
