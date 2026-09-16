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
// The goals left Settings for the controls tray: they teach the game, and
// Settings is where you go between builds rather than during one.
ok('the goals are not a settings card', !MENU_BY_ID.has('menu-achievements'));

// --- what the build actually offers -----------------------------------------

{
  const withCloud = menuFor({ cloud: true, dev: true });
  const without = menuFor({ cloud: false, dev: true });
  ok('a cloud build shows the profile', withCloud.some((m) => m.id === 'menu-profile'));
  ok('a local-only build does not', !without.some((m) => m.id === 'menu-profile'));
  ok('and everything else shows either way', without.length === MENU.length - 1);

  // Graphics and Files were folded behind a switch, which put two of the three
  // things people open settings for behind a button labelled "workshop tools".
  const plain = menuFor({ cloud: true });
  ok('settings holds the world, the graphics and the files',
    plain.map((m) => m.id).join() === 'menu-world,menu-graphics,menu-files,menu-profile');
  ok('and none of it is behind a switch any more', plain.length === withCloud.length);
  // The switch itself stays, with nothing on it, for whatever earns it next.
  ok('the UI still knows how to unfold something', /HAS_DEV_SECTIONS/.test(ui));
  ok('and remembers whether it is unfolded', /this\.devOpen/.test(ui));
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

// Three ways out, and only three. "Save a copy" made a second world out of the
// one you were in, which is not what Save means in a pause menu.
{
  const index = ui.slice(ui.indexOf('menu-actions menu-resume'), ui.indexOf('panel-account'));
  ok('Back to the world is on the index', index.includes('id="btn-resume"'));
  ok('and Save and leave', index.includes('id="btn-leave"'));
  ok('and Leave without saving', index.includes('id="btn-leave-nosave"'));
  ok('and nothing else', (index.match(/<button/g) ?? []).length === 3);
  ok('saving a copy is gone', !ui.includes('id="btn-save"'));
  // Which leaves renaming to the field itself.
  ok('the name is still editable', ui.includes('id="save-name"'));
  ok('and renaming happens when you leave the field',
    /this\.q\('#save-name'\)\.addEventListener\('change'/.test(ui));
  ok('and still tells the world its new name', /onRenameWorld\?\.\(name\)/.test(ui));
}

// --- the mobile screen gets its space back ----------------------------------

// The goals live with the controls, beside Roof. Not in the top corner, where
// they cost the screen its scarcest space, and not on the HUD as a standing
// card of three tasks — one way in, where your thumb already is.
ok('the goals are in the controls tray', ui.includes('id="t-stats"'));
ok('and open the panel', ui.includes("['#t-stats'"));
ok('they have no button in the top corner', !ui.includes('id="btn-stats"'));
ok('no card in settings', !MENU.some((m) => m.opens === 'panel-stats'));
ok('and the goal card is off the HUD entirely', !ui.includes('id="goals"'));

// Which leaves one button up there, so the XP bar can have its width back.
{
  const phone = css.slice(css.indexOf('@media (max-width: 640px), (pointer: coarse)'));
  const bar = Number(phone.match(/#hud-top \{[^}]*width: (\d+)%/)[1]);
  const btns = Number(phone.match(/#top-buttons \{[^}]*max-width: (\d+)%/)[1]);
  ok(`the xp bar takes ${bar}% of the width`, bar >= 50);
  ok(`and the one button ${btns}%, which still fits alongside`, bar + btns <= 100);
}

process.exit(f ? 1 : 0);
