import { readFileSync } from 'node:fs';

/**
 * Reported directly: "When I open the bag, I can't see my inventory there
 * to organize. And if I try to move items from bag to my inventory the
 * bottom bar is locked, I should be able to change my inventory."
 *
 * The bag itself worked — lifting and dropping a slot moved the item fine.
 * What was actually broken: the touch hotbar and the Fill/Jump action
 * buttons stayed fully visible at the bottom of the screen while the bag
 * (or a storehouse, or buildings, or the bench…) was open on top of them,
 * and answered no tap at all. They looked like a "bottom bar" you could
 * use to change what you were holding; they were dead.
 *
 * The hiding rule that already existed for the worlds screen was a CSS
 * sibling selector — `#blocker:not([hidden]) ~ #hotbar-wrap` — which only
 * works for a panel that is a direct sibling of the HUD in the DOM. Two
 * main-layer panels (panel-stats, panel-menu) had been added to the same
 * list by hand and so happened to work; every Duilt-layer panel — the bag
 * included — lives a level deeper inside #duilt-layer and could never be
 * reached by a sibling selector at all, however many ids got added to the
 * list. See UIManager.updateHudVisibility, which reads the one shared
 * Panels registry instead of a hand-kept list of ids.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');

// --- wired on the one shared registry, for open and close alike -------------

ok('opening any panel updates HUD visibility',
  /this\.panels\.onOpen\(\(\) => this\.updateHudVisibility\(\)\);/.test(ui));
ok('so does closing one — the HUD has to come back, not just go away',
  /this\.panels\.onClose\(\(\) => this\.updateHudVisibility\(\)\);/.test(ui));

// --- reads every overlay there is, not a hand-kept list of panel ids --------

ok('it asks Panels for every overlay, screens included — the worlds screen counts too',
  /updateHudVisibility\(\)\s*\{\s*const hidden = this\.panels\.all\(\)\.some\(\(el\) => !el\.hidden\);/.test(ui));
ok('and sets one class the CSS reads, rather than touching each element by hand',
  /document\.body\.classList\.toggle\('panel-open', hidden\);/.test(ui));

// --- the CSS is class-based now, not a sibling selector with a DOM-depth limit --

ok('the touch controls hide off the shared class', /body\.panel-open #touch-controls/.test(css));
ok('so does the hotbar', /body\.panel-open #hotbar-wrap/.test(css));
ok('and the top HUD and toolbar', /body\.panel-open #hud-top/.test(css) && /body\.panel-open #top-buttons/.test(css));
ok('and the tool readout and vitals, the same set the old blocker-only rule covered',
  /body\.panel-open #tool-readout/.test(css) && /body\.panel-open #duilt-layer #vitals/.test(css));

// --- the old sibling-selector rules are gone, not left stacked alongside ----

ok('no leftover sibling selector for touch-controls tied to specific panel ids',
  !/#panel-stats:not\(\[hidden\]\) ~ #touch-controls/.test(css)
  && !/#panel-menu:not\(\[hidden\]\) ~ #touch-controls/.test(css));
ok('no leftover sibling selector hiding the hotbar only for #blocker',
  !/#blocker:not\(\[hidden\]\) ~ #hotbar-wrap/.test(css));

// --- the one deliberate exception: toasts still show over an ordinary panel -

ok('the toast stack keeps its own narrower rule — only the worlds screen silences it',
  /#blocker:not\(\[hidden\]\) ~ #toast-stack \{ display: none !important; \}/.test(css));
ok('toasts are not folded into the general panel-open hiding — they are meant to show over a panel',
  !/body\.panel-open #toast-stack/.test(css));

process.exit(f ? 1 : 0);
