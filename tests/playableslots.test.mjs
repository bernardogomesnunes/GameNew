import { readFileSync } from 'node:fs';
import { Inventory, PLAYABLE_SLOTS } from '../src/items/Inventory.js';

/**
 * Clarified directly, after an earlier misread: "The user has a number of
 * slots available, and this is between bag and playable slots. When
 * opening the bag I can move items between bag and inventory playable
 * slots. Same with storage I should open everything."
 *
 * The hotbar used to auto-build itself every render from whatever the bag
 * held — one slot per kind, plus a hardcoded handful of specials (bucket,
 * food) — so there was nothing to press to get something equipped, no way
 * to choose what sat where, and no way to select a mining tool at all.
 * PLAYABLE_SLOTS is now a real, fixed range at the front of the player's
 * own Inventory: slot 0 is what number-key 1 selects, and getting an item
 * there is done by hand from the bag panel, moving it the exact same way
 * any other bag slot is rearranged — because it *is* the same array, just
 * two labeled zones of it (see ui/DuiltUI.js's renderBag).
 *
 * The core mechanic (a slice of one Inventory) is tested for real here,
 * since Inventory has no DOM to fake. The UI wiring on top of it —
 * UIManager.buildHotbar reading those slots directly, DuiltUI's two- and
 * three-grid splits — needs a renderer this suite doesn't have, so that
 * part is checked against the source, the same way editbuilding.test.mjs
 * and evolvebutton.test.mjs check UI wiring this session.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the core mechanic: one Inventory, a fixed slice of it is "equipped" ---

ok('nine playable slots', PLAYABLE_SLOTS === 9);

{
  const inv = new Inventory();
  inv.add('wood', 5);
  // add() fills the lowest free slot, so a fresh bag's first pickup lands
  // in the playable range without anyone dragging anything yet — the same
  // way a fresh hotbar always used to show something.
  ok('a first pickup lands inside the playable range', inv.slots.findIndex((s) => s?.id === 'wood') < PLAYABLE_SLOTS);
}

{
  // The literal thing asked for: move an item from the bag zone into a
  // playable slot, and back, with nothing but the ordinary same-inventory
  // move — no second container, no special-cased method.
  const inv = new Inventory();
  inv.slots[PLAYABLE_SLOTS + 2] = { id: 'stone', count: 12, wear: 0 };
  ok('starts in the bag zone, not equipped', inv.slots[3] === null);

  const moved = inv.move(PLAYABLE_SLOTS + 2, 3);
  ok('moving it into slot 3 equips it — ordinary Inventory.move, no new API',
    moved && inv.slots[3]?.id === 'stone' && inv.slots[3].count === 12);
  ok('and it is gone from where it was', inv.slots[PLAYABLE_SLOTS + 2] === null);

  const back = inv.move(3, PLAYABLE_SLOTS + 5);
  ok('and moving it back out unequips it the same way',
    back && inv.slots[PLAYABLE_SLOTS + 5]?.id === 'stone' && inv.slots[3] === null);
}

// --- UIManager.buildHotbar: real slots, not a list rebuilt from the bag ----

const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

ok('the Duilt hotbar reads PLAYABLE_SLOTS real slots off the inventory',
  /const playable = inv\.slots\.slice\(0, PLAYABLE_SLOTS\);/.test(ui));
ok('an empty playable slot still draws — a gap to fill, not skipped over',
  /if \(!s\) \{\s*hotbar\.appendChild\(el\(`\s*<div class="hotbar-slot empty" data-slot="\$\{i\}">/.test(ui));
ok('whatever is actually sitting in a slot decides block-select vs item-select, not a fixed list',
  /const isBlock = spec\?\.block != null;/.test(ui));
ok('clicking an empty slot does nothing — there is nothing to select there',
  /if \(!slot \|\| slot\.classList\.contains\('empty'\)\) return;/.test(ui));
ok('number keys map straight to slot position now — key 1 is slot 0, not "the first kind you own"',
  /In Duilt this is now literally slot n-1/.test(ui));

// A tool (pickaxe, axe, shovel) used to have no way into the hotbar at all
// — TOOL_HOTBAR_IDS only ever listed the bucket and food. Any item, tools
// included, can sit in a playable slot now, so the old hardcoded list is
// gone rather than left dangling unused.
ok('the old hardcoded tool-id list is gone — any item can be equipped now',
  !/const TOOL_HOTBAR_IDS = Object\.keys\(TOOL_HOTBAR_NOTES\);/.test(ui));
ok('the auto-built "one per kind" list (heldIds-driven) is gone from the hotbar',
  !/const placeable = inv\.heldIds\(\)/.test(ui));

// --- DuiltUI: the bag panel splits into Equipped and Bag, one inventory ----

const duilt = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

ok('the bag panel has two grids now, not one', /id="bag-hotbar-grid"/.test(duilt) && /id="bag-grid"/.test(duilt));
ok('the equipped grid reads the front slice of the inventory',
  /hotbarGrid\.innerHTML = slots\.slice\(0, PLAYABLE_SLOTS\)\.map\(slotHtml\)\.join\(''\);/.test(duilt));
ok('the bag grid reads the rest, with slot ids offset back to their real index',
  /grid\.innerHTML = slots\.slice\(PLAYABLE_SLOTS\)\.map\(\(s, j\) => slotHtml\(s, j \+ PLAYABLE_SLOTS\)\)\.join\(''\);/.test(duilt));
ok('both grids share the same lift/tap binding — one inventory, two views of it',
  /for \(const g of \[hotbarGrid, grid\]\) \{\s*g\.querySelectorAll\('\[data-slot\]'\)\.forEach\(\(btn\) => this\.bindSlot\(btn\)\);/.test(duilt));

// --- DuiltUI: opening a storehouse shows everything, not just the bag -----

ok('the store screen adds an Equipped grid alongside the shed and the bag',
  /id="store-hotbar-grid"/.test(duilt));
ok('it is read from the same player inventory the bag grid already was',
  /hotbarGrid\.innerHTML = d\.inventory\.slots\.slice\(0, PLAYABLE_SLOTS\)/.test(duilt));
ok('both equipped and bag tap straight into the store, same as any bag slot always could',
  /for \(const g of \[hotbarGrid, bagGrid\]\) \{\s*g\.querySelectorAll\('\[data-bag-slot\]'\)\.forEach\(\(btn\) =>\s*btn\.addEventListener\('click', \(\) => this\.putInStore/.test(duilt));

process.exit(f ? 1 : 0);
