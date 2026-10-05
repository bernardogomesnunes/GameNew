import { readFileSync } from 'node:fs';

/**
 * Asked for directly: "can we have a on click mobile and hover desktop for
 * the recipes of buildings? Also bench should have the icons for the items".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

ok('one chip for an item and how many: its icon, its count, its name on a card',
  /function itemChip\(id, n, \{ have = null, short = false \} = \{\}\)/.test(ui) && /data-tip="\$\{escapeAttr\(name\)\}" data-tip-info=/.test(ui));
ok('a building\'s cost is chips', /\? Object\.entries\(design\.cost\)\.map\(\(\[id, n\]\) => itemChip\(id, n, \{/.test(ui));
ok('and the bench\'s ingredients are chips, with what you have', /const have = d\.inventory\.countOf\(id\);\s*return itemChip\(id, n, \{ have, short: !d\.sandbox && have < n \}\);/.test(ui));
ok('and what it makes, as the tile\'s big icon', /itemIcon\(spec, \{ size: 40 \}\)/.test(ui));
ok('no longer a line of words', !/\$\{n\} \$\{itemName\(id\)\.toLowerCase\(\)\}`\)\.join\(' \+ '\)/.test(ui));
ok('a mouse hovers a chip for its card', /const TIPPED = '\.bag-slot\[data-tip\], \.cost-chip\[data-tip\], \.recipe-icon\[data-tip\]';/.test(ui) && /if \(e\.pointerType === 'touch'\) return;\s*const btn = e\.target\.closest\?\.\(TIPPED\);\s*if \(btn\) this\.showSlotTip\(btn\);/.test(ui));
ok('a tap shows it, a second tap or a tap elsewhere hides it',
  /const chip = e\.target\.closest\?\.\('\.cost-chip\[data-tip\], \.recipe-icon\[data-tip\]'\);\s*if \(!chip\) \{ if \(this\.tipChip\) this\.hideSlotTip\(\); return; \}\s*if \(this\.tipChip === chip && !this\.tip\.hidden\) \{ this\.hideSlotTip\(\); return; \}\s*this\.showSlotTip\(chip\);\s*this\.tipChip = chip;/.test(ui));

process.exit(f ? 1 : 0);
