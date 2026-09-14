import { PANELS, PANELS_BY_ID, panelsOn, panelForKey } from '../src/config/panels.js';
import { panelMarkup, renderPanels, panelDef } from '../src/ui/Panel.js';
import { readFileSync } from 'node:fs';

/**
 * The panel declarations, and the shell built from them.
 *
 * A panel used to be spread over five places and the forgotten parts were the
 * bugs: one that would not close on Escape, one whose shortcut fired while you
 * typed, one that opened on top of another. These check the properties that
 * made those possible — a missing close button, two panels claiming one key,
 * a declared panel nothing draws.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the declarations hold together -----------------------------------------

ok('there are panels to declare', PANELS.length >= 10);
ok('every panel has an id, a title and a layer',
  PANELS.every((p) => p.id && p.title && (p.layer === 'main' || p.layer === 'duilt')));
ok('every id is unique', new Set(PANELS.map((p) => p.id)).size === PANELS.length);
ok('every id is addressable', PANELS.every((p) => PANELS_BY_ID.get(p.id) === p));
ok('every mode is one the UI knows',
  PANELS.every((p) => ['any', 'duilt', 'sandbox'].includes(p.mode)));

// Two panels on one key is the bug that made a shortcut unpredictable.
const keys = PANELS.map((p) => p.key).filter(Boolean);
ok(`no two panels claim the same key (${keys.length} shortcuts)`, new Set(keys).size === keys.length);
ok('every shortcut is a KeyboardEvent code', keys.every((k) => /^(Key[A-Z]|Digit[0-9])$/.test(k)));
for (const k of keys) ok(`  ${k} opens ${panelForKey(k).id}`, panelForKey(k).key === k);
ok('a key nothing claims opens nothing', panelForKey('KeyZ') === null);

// A Duilt-only panel drawn on the main surface would never appear in a Duilt
// world, because the Duilt overlay is what gets shown.
ok('Duilt panels are drawn on the Duilt layer',
  PANELS.filter((p) => p.mode === 'duilt').every((p) => p.layer === 'duilt'));
ok('both layers have panels', panelsOn('main').length > 0 && panelsOn('duilt').length > 0);
ok('the layers partition the panels',
  panelsOn('main').length + panelsOn('duilt').length === PANELS.length);

// --- the shell comes with the panel -----------------------------------------

globalThis.document ??= undefined;
const html = renderPanels('main') + renderPanels('duilt');

for (const p of PANELS) {
  const has = html.includes(`id="${p.id}"`);
  const closes = html.includes(`data-close="${p.id}"`);
  ok(`${p.id} is rendered with a close button`, has && closes);
}
ok('every panel starts hidden', PANELS.every((p) => html.includes(`id="${p.id}" hidden>`)));
ok('every panel is an overlay, so the registry finds it',
  (html.match(/class="overlay"/g) || []).length === PANELS.length);
ok('every close button says what it is, for a screen reader',
  (html.match(/aria-label="Close"/g) || []).length === PANELS.length);

// --- titles and subtitles ----------------------------------------------------

{
  const def = { id: 'panel-x', title: 'Thing', sub: 'A line about it' };
  const m = panelMarkup(def, '<div id="x-body"></div>');
  ok('the title is the heading', m.includes('<h2>Thing</h2>'));
  ok('the subtitle is under it', m.includes('A line about it'));
  ok('the body goes inside', m.includes('<div id="x-body"></div>'));
  ok('a plain panel is not wide', !m.includes('panel-wide'));
}
{
  const m = panelMarkup({ id: 'panel-y', title: 'Grid', wide: true }, '');
  ok('a wide panel says so', m.includes('panel-wide'));
  ok('a panel with no subtitle has no empty subtitle line', !m.includes('class="sub"'));
}
{
  // Anything rewritten at runtime needs a handle to rewrite.
  const m = panelMarkup({ id: 'panel-z', title: 'Sign in', titleId: 'account-title', subId: 'account-sub', sub: 'x' }, '');
  ok('a retitled panel gets an id on its heading', m.includes('<h2 id="account-title">'));
  ok('a rewritten subtitle gets one too', m.includes('id="account-sub"'));
}

// Everything the rest of the UI reaches for by id must resolve.
ok('a declared panel resolves by id', panelDef('panel-bench')?.title === 'Workbench');
ok('an undeclared one resolves to nothing', panelDef('panel-nope') === null);

// A body supplied for a panel that is not on this layer would silently vanish.
{
  const only = renderPanels('duilt');
  ok('a layer renders only its own panels',
    panelsOn('duilt').every((p) => only.includes(`id="${p.id}"`))
    && !panelsOn('main').some((p) => only.includes(`id="${p.id}"`)));
}

// --- every panel has a way in -----------------------------------------------

// The Skills panel existed, was declared, was drawn, and nothing anywhere
// opened it — there was no button, no shortcut, no menu item. A panel you
// cannot reach is the same as a panel that is not there.

const sources = ['src/ui/UIManager.js', 'src/ui/DuiltUI.js', 'src/Game.js', 'src/ui/HomeScreen.js']
  .map((f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');

for (const p of PANELS) {
  const opened = sources.includes(`openPanel('${p.id}')`)
    || sources.includes(`openDuiltPanel('${p.id}')`)
    || sources.includes(`togglePanel('${p.id}')`)
    || !!p.key;
  ok(`${p.id} has a way in`, opened);
}

process.exit(f ? 1 : 0);
