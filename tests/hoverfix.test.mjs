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
 * item as often as not. A native `title` now carries the same text a slot's
 * click-to-lift detail box already assembled, the same lightweight approach
 * the block hotbar's own locked-slot tooltip already uses.
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

ok('slotHtml puts a title on the button, not just an aria-label',
  /class="bag-slot \$\{held[\s\S]{0,40}aria-label="[\s\S]{0,60}title="\$\{this\.slotTooltip\(s, spec\)\}"/.test(duiltUi));
ok('the tooltip and the detail box share one source of the actual facts, not two copies',
  /itemBits\(s, spec\)/.test(duiltUi)
  && (duiltUi.match(/itemBits\(/g) ?? []).length >= 3); // the method + both call sites
ok('the tooltip leads with the item\'s name — the detail box already shows it separately, this doesn\'t',
  /slotTooltip\(s, spec\)\s*\{\s*return \[itemName\(s\.id\)/.test(duiltUi));

process.exit(f ? 1 : 0);
