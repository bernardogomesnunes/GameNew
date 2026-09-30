import { readFileSync } from 'node:fs';

/**
 * Two reported directly, fixed together since both are small.
 *
 * "Pop headers are weird when we scroll there's a couple of pixels on top
 * that are not covered by the header." Confirmed live: `.panel-head` bled
 * flush to the panel's border edge with a negative margin, but its sticky
 * `top: 0` was measured from the panel's *padding* edge instead — so it
 * rendered flush before you scrolled and then snapped down by a whole
 * `--panel-pad-t` the moment it actually stuck, leaving a strip of the
 * scrolled-past content showing above it (measured at 15px on a panel whose
 * own padding is 14px — not a subpixel rounding thing).
 *
 * "On the inventory, when I click on an item below o can see its name and
 * what it does. O want that info on a tooltip when hovering on this
 * elements." Finding out what an item was meant lifting it first — the same
 * gesture that moves it — so learning what something did cost a misplaced
 * item as often as not.
 *
 * The first fix was a native `title`, and it was reported still broken: the
 * browser waits a second or more of stillness before showing one, and the
 * bag re-renders its whole grid on every inventory change, which throws the
 * hovered button away and restarts the wait. It's a real card now
 * (DuiltUI.wireSlotTip), shown at once and re-pointed after a re-render.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const duiltUi = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

// --- the sticky header sits at the same offset stuck or not ------------------

ok('panel-head is still sticky and still bleeds flush via the negative margin',
  /\.panel-head\s*\{\s*position:\s*sticky;/.test(css)
  && /margin:\s*calc\(-1 \* var\(--panel-pad-t\)\)\s+calc\(-1 \* var\(--panel-pad-x\)\)/.test(css));
ok('and its sticky offset now matches that same padding, not 0',
  /\.panel-head\s*\{\s*position:\s*sticky;\s*top:\s*calc\(-1 \* var\(--panel-pad-t\)\);/.test(css));
ok('the fix is not a second, copied rule — there is still exactly one panel-head block',
  (css.match(/\.panel-head\s*\{/g) ?? []).length === 1);

// --- a slot's tooltip carries what its click-to-lift detail box already did --

ok('a slot carries its name and facts for the hover card, not a native title',
  /class="bag-slot \$\{held[\s\S]{0,40}aria-label="[\s\S]{0,60}data-tip="\$\{escapeAttr\(itemName\(s\.id\)\)\}" data-tip-info=/.test(duiltUi)
  && !/class="bag-slot \$\{held[^>]*title=/.test(duiltUi));
ok('the card and the detail box share one source of the actual facts, not two copies',
  (duiltUi.match(/this\.itemBits\(/g) ?? []).length >= 2);
ok('the card is delegated from the panel root, so re-rendered buttons need no wiring',
  /this\.el\.addEventListener\('pointerover'/.test(duiltUi) && /closest\?\.\('\.bag-slot\[data-tip\]'\)/.test(duiltUi));
ok('and re-found after the bag and the storehouse redraw their grids',
  (duiltUi.match(/this\.refreshSlotTip\(\);/g) ?? []).length >= 2);
ok('and hidden when a panel closes', /onPanelClosed\(id\) \{\s*this\.hideSlotTip\(\);/.test(duiltUi));
ok('the card is fixed to the viewport, above the bag backdrop, and never eats the click',
  /\.slot-tip \{[^}]*position: fixed;[^}]*z-index: 13;[^}]*pointer-events: none;/.test(css));

process.exit(f ? 1 : 0);
