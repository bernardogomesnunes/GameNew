import { MENU, MENU_BY_ID, menuFor, inlineSections } from '../src/config/menu.js';
import { PANELS_BY_ID } from '../src/config/panels.js';
import { readFileSync } from 'node:fs';

/**
 * The menu, as an index rather than a scroll.
 *
 * It had become one column holding a name field, three graphics controls,
 * three file buttons and three actions, stacked with nothing between them but
 * a label — a page you scroll looking for the thing you came for. And the
 * thing most people came for, their achievements, was not in it at all: it had
 * a button of its own eating space on the screen with the least to spare.
 *
 * These check the shape that replaced it: a card per section, each card going
 * somewhere real, and no section stranded without a way in or out.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const icons = readFileSync(new URL('../src/ui/icons.js', import.meta.url), 'utf8');

// --- the declarations hold together -----------------------------------------

ok(`there are ${MENU.length} sections`, MENU.length >= 4);
ok('every section has an id, a name and a blurb', MENU.every((m) => m.id && m.name && m.blurb));
ok('every id is unique', new Set(MENU.map((m) => m.id)).size === MENU.length);
ok('every id is addressable', MENU.every((m) => MENU_BY_ID.get(m.id) === m));
ok('every icon is one that exists', MENU.every((m) => icons.includes(`  ${m.icon}:`)));
// A card is a signpost: the heading alone does not say what is behind it.
ok('the blurbs are sentences, not labels', MENU.every((m) => m.blurb.length > 20));
ok('the names fit a card heading', MENU.every((m) => m.name.length <= 20));

// --- every card goes somewhere ----------------------------------------------

for (const m of MENU) {
  if (m.opens) {
    ok(`${m.id} opens a panel that exists`, PANELS_BY_ID.has(m.opens));
  } else {
    // Rendered inside the menu, so the markup has to carry it — with a way back.
    ok(`${m.id} has a section in the menu`, ui.includes(`class="menu-section" id="${m.id}"`));
    ok(`  and a way back to the index`, new RegExp(`id="${m.id}"[\\s\\S]{0,200}data-menu-back`).test(ui));
  }
}
ok('the sections that render in place are the ones without a panel',
  inlineSections().every((m) => !m.opens));
ok('and achievements are not one of them — one such screen is enough',
  MENU_BY_ID.get('menu-achievements')?.opens === 'panel-stats');

// --- what the build actually offers -----------------------------------------

{
  const withCloud = menuFor({ cloud: true });
  const without = menuFor({ cloud: false });
  ok('a cloud build shows the profile', withCloud.some((m) => m.id === 'menu-profile'));
  ok('a local-only build does not', !without.some((m) => m.id === 'menu-profile'));
  ok('and everything else shows either way', without.length === MENU.length - 1);
}

// --- the UI draws it from the declaration -----------------------------------

ok('the index is rendered from the config', /menuFor\(\{ cloud:/.test(ui));
ok('a card that names a panel opens it', /def\?\.opens\) this\.openPanel\(def\.opens\)/.test(ui));
ok('and one that does not shows its section', /else this\.showMenuSection/.test(ui));
ok('opening the menu returns to the index', /showMenuSection\(null\)/.test(ui));
ok('the heading follows which section you are in', /title\.textContent = def \? def\.name/.test(ui));
ok('and comes back from the panel declaration, not a second copy of the word',
  /panelDef\('panel-menu'\)\?\.title/.test(ui));
ok('the cards are styled', css.includes('.menu-card') && css.includes('.menu-card-icon'));
ok('and the way back is too', css.includes('.menu-back'));

// --- the things you came to do are on the first screen -----------------------

// Save and Leave were inside World details, which made leaving a world two
// taps down a page named after something else.
{
  const index = ui.slice(ui.indexOf('menu-actions menu-resume'), ui.indexOf('panel-account'));
  ok('Back to the world is on the index', index.includes('id="btn-resume"'));
  ok('and so is Save', index.includes('id="btn-save"'));
  ok('and Leave', index.includes('id="btn-leave"'));
  const worldSection = ui.slice(ui.indexOf('id="menu-world"'), ui.indexOf('id="menu-graphics"'));
  ok('World details holds the name and nothing you act with',
    worldSection.includes('id="save-name"')
    && !worldSection.includes('id="btn-save"') && !worldSection.includes('id="btn-leave"'));
}

// --- the mobile screen gets its space back ----------------------------------

ok('the touch tray no longer carries a Stats button', !ui.includes('id="t-stats"'));
ok('and nothing is left wired to it', !ui.includes("'#t-stats'"));
// Removing the button must not remove the way in.
ok('achievements are still reachable from the menu',
  MENU.some((m) => m.opens === 'panel-stats'));
ok('and still have their own button on a desktop toolbar', ui.includes('id="btn-stats"'));

process.exit(f ? 1 : 0);
