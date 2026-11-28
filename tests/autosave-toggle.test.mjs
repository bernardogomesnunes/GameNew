// Owner, 28 November: "a toggle for auto save world in settings ... if it's turned on we should auto save, if not we shouldn't".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const graphics = read('render/graphics.js'), game = read('Game.js'), save = read('game/GameSave.js'), ui = read('ui/UIManager.js');

assert.match(graphics, /autosave: true,/, 'on by default');
assert.match(game, /autosaveOn\(\) \{\s*return this\.graphics\?\.autosave !== false;/);
assert.match(game, /if \(this\.autosaveOn\(\) && performance\.now\(\) - this\.lastAutosave > AUTOSAVE_INTERVAL_MS\) this\.saveNow\(\);/, 'the five-minute save asks the setting');
assert.match(game, /saved = this\.autosaveOn\(\) && this\.saveNow\(\)/, 'a crash saves only with it on');
assert.match(save, /const save = \(\) => \{\s*\/\/[^\n]*\n\s*if \(this\.autosaveOn\?\.\(\) === false\) return false;/, 'hiding or closing the page saves only with it on');
assert.match(ui, /id="btn-save">Save<\/button>\s*<label[^>]*>\s*<input type="checkbox" id="set-autosave" \/> Auto save world/, 'the switch sits by Save in the menu');
assert.match(ui, /autosave\.addEventListener\('change', \(\) => this\.game\.setAutosave\(autosave\.checked\)\)/);

// The setting itself, round the real store.
globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };
const { loadSettings, saveSettings } = await import('../src/render/graphics.js');
assert.equal(loadSettings().autosave, true);
saveSettings({ ...loadSettings(), autosave: false });
assert.equal(loadSettings().autosave, false);
console.log('PASS Auto save world: on by default, off stops every save the game makes by itself');
