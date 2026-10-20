import { readFileSync } from 'node:fs';
import { Panels } from '../src/ui/Panels.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Inventory } from '../src/items/Inventory.js';
import { Granary } from '../src/items/Granary.js';
import { FARM_ITEMS } from '../src/config/crops.js';

/**
 * Asked for directly: "the storage manager block, it would be nice to have
 * the ability to push things here too that would go to the storages", then
 * "in desktop we could have pop ups that can move inside the screen, and
 * then I can open my inventory and interact with them. This would be nice
 * for both storage and controller. In desktop we should show both as we do
 * in the same pop up, but we need to take a look into scrolling beahaviours
 * as they look odd".
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the controller puts things away ----------------------------------------------
{
  const bag = new Inventory({ slots: 10 });
  const empty = new Inventory({ slots: 4 }), keeps = new Inventory({ slots: 4 });
  const granary = new Granary({ accepts: (id) => FARM_ITEMS.has(id) });
  keeps.add('stone', 5);
  const g = { inventory: bag, structures: { stores: () => [{ store: granary }, { store: empty }, { store: keeps }] } };
  const put = (i) => DuiltGame.prototype.putInStores.call(g, i);
  bag.add('stone', 20);
  const i = bag.slots.findIndex((s) => s?.id === 'stone');
  ok('a stack from the bag goes into the storehouses', put(i) === 20 && !bag.slots[i]);
  ok('  onto the shelf that already keeps it, not the first empty one', keeps.countOf('stone') === 25 && empty.countOf('stone') === 0);
  ok('  and never into the granary', granary.countOf('stone') === 0);
  const seed = [...FARM_ITEMS][0];
  bag.add(seed, 3);
  put(bag.slots.findIndex((s) => s?.id === seed));
  ok(`what farms grow goes to the granary first (${seed})`, granary.countOf(seed) === 3);
  ok('an empty slot moves nothing', put(9) === 0);
  const none = { inventory: bag, structures: { stores: () => [] } };
  bag.add('dirt', 4);
  ok('no storehouses, nothing moves', DuiltGame.prototype.putInStores.call(none, bag.slots.findIndex((s) => s?.id === 'dirt')) === 0 && bag.countOf('dirt') === 4);
}

// --- two pop-ups at once, on a desktop -------------------------------------------
class El {
  constructor(id) {
    this.id = id; this.hidden = true; this.style = {}; this.classes = new Set(['overlay']);
    this.classList = { toggle: (c, on) => (on ? this.classes.add(c) : this.classes.delete(c)), contains: (c) => this.classes.has(c) };
  }
}
class Root {
  constructor(els) { this.els = els; }
  querySelectorAll() { return this.els; }
  querySelector(sel) { return this.els.find((e) => e.id === sel.replace(/^#/, '')) ?? null; }
}
globalThis.CSS ??= { escape: (s) => s };
const make = (desk) => {
  const root = new Root(['panel-bag', 'panel-store', 'panel-stores', 'panel-menu'].map((id) => new El(id)));
  const p = new Panels(root, { companions: { 'panel-bag': ['panel-store', 'panel-stores'] }, sideBySide: () => desk });
  return { root, p, el: (id) => root.querySelector(id) };
};
{
  const { p, el } = make(true);
  p.open('panel-store');
  p.open('panel-bag');
  ok('desktop: the bag opens beside a storehouse', p.openIds().join() === 'panel-store,panel-bag');
  ok('  both paired, the one behind keeps the dim, the newer in front',
    el('panel-store').classList.contains('paired') && el('panel-bag').classList.contains('paired')
    && el('panel-store').classList.contains('paired-base') && Number(el('panel-bag').style.zIndex) > Number(el('panel-store').style.zIndex));
  p.toFront('panel-store');
  ok('  a click on the one behind brings it to the front', Number(el('panel-store').style.zIndex) > Number(el('panel-bag').style.zIndex));
  ok('  Escape closes the one in front', p.closeTop() === 'panel-store' && p.openIds().join() === 'panel-bag');
  ok('  alone again, not paired', !el('panel-bag').classList.contains('paired') && el('panel-bag').style.zIndex === '');
  p.open('panel-stores');
  ok('  and beside the storage controller', p.openIds().join() === 'panel-bag,panel-stores');
  p.open('panel-menu');
  ok('  anything else still opens alone', p.openIds().join() === 'panel-menu');
}
{
  const { p } = make(false);
  p.open('panel-store');
  p.open('panel-bag');
  ok('a phone: one pop-up at a time, as before', p.openIds().join() === 'panel-bag');
}

// --- wiring --------------------------------------------------------------------
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const mgr = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const panels = readFileSync(new URL('../src/config/panels.js', import.meta.url), 'utf8');
ok('the controller shows your bag, and a tap puts a stack away',
  /id="stores-hotbar-grid"/.test(ui) && /id="stores-bag-grid"/.test(ui) && /onTap: \(i\) => this\.putInStores\(i\)/.test(ui));
ok('the storehouse and the controller are two columns on a desktop, each scrolling on its own',
  (panels.match(/split: true,/g) ?? []).length === 2
  && /\.panel\.panel-split \{[^}]*overflow: hidden;/.test(css) && /\.panel-split \.split-col \{[^}]*overflow-y: auto; overscroll-behavior: contain;/.test(css));
ok('  nothing inside a column scrolls as well', /\.panel-split #store-grid, \.panel-split #store-bag-grid, \.panel-split #stores-bag-grid,[^{]*\{ max-height: none; overflow: visible; \}/.test(css));
ok('  the bag always out beside them there', /bag\.hidden = !open && !isDesktop\(\);/.test(ui));
ok('pop-ups are moved by their title bar, and the bag pairs with the stores',
  /this\.windows = bindPanelWindows\(root, this\.panels\);/.test(mgr) && /companions: \{ 'panel-bag': \['panel-store', 'panel-stores'\] \}/.test(mgr));
ok('stacks are dragged between them: bag to shelves or controller, and back',
  /if \(src\.kind === 'bag' && kind === 'store'\) this\.putInStore\(src\.ref\);/.test(ui)
  && /else if \(src\.kind === 'bag' && kind === 'stores'\) this\.putInStores\(src\.ref\);/.test(ui)
  && /else if \(src\.kind === 'store' && kind === 'bag'\) this\.takeFromStore\(src\.ref\);/.test(ui)
  && /else if \(src\.kind === 'stores' && kind === 'bag'\) this\.takeFromStores\(src\.ref\);/.test(ui));

process.exit(f ? 1 : 0);
