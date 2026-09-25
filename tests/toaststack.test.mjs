import { readFileSync } from 'node:fs';

/**
 * Reported directly: "When opening the inventory, I should be able to see
 * there my inventory, or at least keep it above the overlay of the pop up
 * to be accessible. Right now I can't manage my inventory slots because of
 * this."
 *
 * Toasts render above every panel on purpose (see the comment on
 * `#toast-stack { z-index: 12; }` in styles.css) so a message answering
 * something you just pressed inside a panel — "Made 1 turned soil" at the
 * bench, "Threw away 5 wood" in the bag itself — is never hidden behind it.
 * On desktop up to five can be stacked at once, each alive for 3.4 seconds;
 * a burst of activity right before opening the bag left that whole stack
 * sitting over the slot grid, several rows deep, for as long as it took
 * them to fade on their own. Clicks still landed (the stack is
 * pointer-events: none) but there was nothing to see under them.
 *
 * Fix: any panel opening collapses whatever is already stacked (Panels'
 * onOpen hook, shared by every way a panel opens — UIManager.openPanel and
 * DuiltUI.toggleBag both go through the same Panels instance), and while a
 * panel stays open, toast() itself keeps the stack to one at a time — the
 * same rule touch devices already had, now shared rather than duplicated.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

ok('opening any panel collapses whatever toasts were already up',
  /this\.panels\.onOpen\(\(\) => this\.collapseToasts\(\)\);/.test(ui));
ok('collapseToasts is the one place that walks the stack, not copied per caller',
  (ui.match(/for \(const old of \[\.\.\.stack\.children\]\) this\.dismissToast\(old\);/g) ?? []).length === 1);
ok('a panel staying open also keeps new toasts to one at a time, the same rule touch already had',
  /if \(this\.isTouch \|\| this\.isAnyPanelOpen\(\)\) this\.collapseToasts\(\);/.test(ui));
ok('the collapse hook is registered on the one shared Panels instance, so every opener gets it',
  /this\.panels = new Panels\(root, \{ screens: \['blocker'\] \}\);\s*\n\s*this\.panels\.onOpen\(\(id\) => this\.populatePanel\(id\)\);\s*\n\s*this\.panels\.onOpen\(\(\) => this\.collapseToasts\(\)\);/.test(ui));

process.exit(f ? 1 : 0);
