import { readFileSync } from 'node:fs';

/**
 * Reported directly: "the current system of storing, and block generation
 * will slowly soft block me. If i leave the game all my slots will be
 * filled with items. Would be nice to have some sort of discard icons in
 * my bag when its open." There was no way to get rid of anything except
 * spending it — crafting it away, or handing it to a storehouse that fills
 * up just as surely. See Inventory.discard (tests/inv.test.mjs) for the
 * real behaviour; this checks the icon is actually wired to it.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

ok('a discard button is drawn beside a filled slot, not inside it',
  /A sibling button, not nested inside the slot/.test(ui) && /class="slot-discard"/.test(ui));
ok('an empty slot gets no discard button', /if \(!s\) return `<button class="bag-slot empty"/.test(ui));
// The storehouse's shelves have it too now, with a "Sure?" first (asked for
// directly: "Storehouses now don't allow me to delete one item they should")
// — see tests/storediscard.test.mjs. Each grid wires its own.
ok('the bag throws away straight off; a storehouse its own way, asking first',
  /const bin = d\.inventory\.endless \? null : 'data-discard'/.test(ui) && (ui.match(/discardAttr: bin/g) ?? []).length === 2
    && /const bin = summary\.grave \? null : 'data-store-discard'/.test(ui) && !/discardAttr: 'data-discard'/.test(ui));
ok('and never in a creative bag, where nothing is thrown away', /d\.inventory\.endless \? null/.test(ui));
ok('clicking it never reaches the slot\'s own lift/drop handler',
  /data-discard\]'\)\.forEach\(\(btn\) =>\s*btn\.addEventListener\('click', \(e\) => \{ e\.stopPropagation\(\)/.test(ui));
ok('it calls Inventory.discard by slot, not remove by item id',
  /discardSlot\(i\) \{[\s\S]{0,300}inv\.discard\(i\)/.test(ui));
ok('discarding the slot you were holding clears the hold, so you are not left holding nothing',
  /discardSlot\(i\)[\s\S]{0,300}if \(this\.held === i\) this\.held = null;/.test(ui));
ok('it says what was thrown away rather than staying silent',
  /Threw away \$\{gone\.count > 1/.test(ui));

process.exit(f ? 1 : 0);
