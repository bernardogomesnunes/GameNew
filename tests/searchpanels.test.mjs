import { readFileSync } from 'node:fs';
import { holdSearchHeight } from '../src/ui/Panels.js';

/**
 * Asked for directly: "Crafting pop up should be fixed size or else
 * searching is continuously changing sizes. All pop ups with search should."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

ok('every pop-up with a search has one height, not just the bench and the buildings',
  /\.overlay > \.panel:has\(\.panel-search\) \{ height: min\(86vh, 760px\); \}/.test(css));
ok('  and the storehouses\' search is one of them', /id="stores-search" class="panel-search"/.test(ui));
ok('pinned, nothing shrinks it — a keyboard coming up included — and it sits at the top so the search stays in sight',
  /\.overlay > \.panel\.held \{ max-height: none; \}/.test(css) && /\.overlay:has\(> \.panel\.held\) \{ align-items: flex-start; \}/.test(css));

// The pin itself, on a stand-in.
const classes = new Set();
const panel = {
  style: { height: '' }, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
  querySelector: (s) => (s === '.panel-search' ? {} : null), getBoundingClientRect: () => ({ height: 671.4 }),
};
holdSearchHeight({ querySelector: (s) => (s === '.panel' ? panel : null) });
ok('as it opens its height is pinned in pixels', panel.style.height === '671px' && classes.has('held'));
const plain = { style: { height: '' }, classList: { add: (c) => classes.add(`plain:${c}`), remove() {} }, querySelector: () => null, getBoundingClientRect: () => ({ height: 300 }) };
holdSearchHeight({ querySelector: (s) => (s === '.panel' ? plain : null) });
ok('a pop-up with no search is left to size itself', plain.style.height === '' && !classes.has('plain:held'));
const panels = readFileSync(new URL('../src/ui/Panels.js', import.meta.url), 'utf8');
ok('every pop-up goes through it as it opens', /el\.hidden = false;[\s\S]{0,140}holdSearchHeight\(el\);/.test(panels));

process.exit(f ? 1 : 0);
