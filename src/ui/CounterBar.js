import { FURNITURE, AGE, partsFor, isPatterned } from '../config/furnitureParts.js';
import { itemName } from '../config/items.js';
import { RECIPES_BY_ID } from '../config/recipes.js';
import { escapeHtml } from './html.js';

/**
 * CRAFT3D-1: the buttons over the counter close-up (render/CounterView.js).
 * A strip of pieces to pick, then Saw (one tap a part), Carve for patterned
 * pieces, and Leave; a line saying what to do next or what is missing.
 * Dragging the parts happens on the picture itself, not here.
 */
export class CounterBar {
  /**
   * @param root   where the bar goes (the game's #ui-root)
   * @param view   the CounterView
   * @param age    () => the world's age (Infinity in Creative)
   * @param onLeave () => close the counter
   */
  constructor({ root, view, counters, age = () => Infinity, onLeave = () => {} }) {
    this.view = view;
    this.counters = counters;
    this.age = age;
    this.onLeave = onLeave;
    this.el = document.createElement('div');
    this.el.className = 'counter-bar';
    this.el.hidden = true;
    root.append(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
  }

  show() { this.el.hidden = false; this.render(); }
  hide() { this.el.hidden = true; }

  /** The pieces open at this age: each piece's own, and never before the Counter's. */
  pieces() {
    const counterAge = RECIPES_BY_ID.get('counter')?.age ?? 1;
    return FURNITURE.filter((id) => Math.max(AGE.get(id) ?? 1, counterAge) <= this.age());
  }

  render(note = '') {
    if (this.el.hidden) return;
    const key = this.view.key, w = key ? this.counters.work(key) : null;
    if (!w) {
      const tiles = this.pieces().map((id) => {
        const can = this.counters.ready(id);
        return `<button class="counter-piece${can.ok ? '' : ' cant'}" data-piece="${id}" title="${escapeHtml(can.reason ?? '')}">${escapeHtml(itemName(id))}</button>`;
      }).join('');
      this.el.innerHTML = `<p class="counter-say">${escapeHtml(note || 'Pick a piece to make.')}</p><div class="counter-pieces">${tiles}</div><button class="secondary" data-leave>Leave</button>`;
      return;
    }
    const n = partsFor(w.item).length, fitted = w.fitted.filter(Boolean).length;
    const cut = this.counters.canCut(key);
    const say = note || (w.cut < n ? (cut.ok ? `Saw the ${itemName(w.item).toLowerCase()}'s parts: ${w.cut} of ${n} cut.` : cut.reason)
      : fitted < n ? `Drag each part onto its place: ${fitted} of ${n} fitted.`
        : isPatterned(w.item) && !w.carved ? 'Carve the pattern with the chisel.' : 'Done.');
    this.el.innerHTML = `<p class="counter-say">${escapeHtml(say)}</p>
      <div class="counter-actions">
        ${w.cut < n ? `<button class="primary" data-saw ${cut.ok ? '' : 'disabled'}>Saw (${w.cut} of ${n})</button>` : ''}
        ${isPatterned(w.item) && fitted === n && !w.carved ? '<button class="primary" data-carve>Carve</button>' : ''}
        <button class="secondary" data-leave>Leave</button>
      </div>`;
  }

  click(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.piece) {
      const r = this.view.pick(b.dataset.piece);
      this.render(r.ok ? '' : r.reason);
    } else if ('saw' in b.dataset) {
      const r = this.view.saw();
      this.render(r.ok ? '' : r.reason);
    } else if ('carve' in b.dataset) {
      const r = this.view.carve();
      this.render(r.ok ? '' : r.reason);
    } else if ('leave' in b.dataset) this.onLeave();
  }
}
