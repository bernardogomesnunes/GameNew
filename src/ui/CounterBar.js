import { FURNITURE, AGE, partsFor, partLabel, isPatterned } from '../config/furnitureParts.js';
import { itemName } from '../config/items.js';
import { RECIPES_BY_ID } from '../config/recipes.js';
import { WORK_MIN, WORK_MAX } from '../duilt/BenchWork.js';
import { escapeHtml } from './html.js';
import { chainLineHtml } from './chainLine.js';

/**
 * CRAFT3D-1, CRAFT-9: the buttons over the Carpenter's Table's close-up
 * (render/CounterView.js). A strip of pieces to pick, then Saw (held, let go
 * in the light band: one stroke cuts every part), the parts as numbered
 * buttons (a tap sends one to its place, as a tap on the picture does),
 * Carve for patterned pieces, Make another, and Leave; a line saying what to
 * do next or what is missing. The action buttons sit bottom centre.
 */
export class CounterBar {
  /**
   * @param root   where the bar goes (the game's #ui-root)
   * @param view   the CounterView
   * @param age    () => the world's age (Infinity in Creative)
   * @param onLeave () => close the table
   * @param onHold (on) => Saw is held or let go
   * @param onPart (i) => part `i` was tapped
   */
  constructor({ root, view, counters, age = () => Infinity, onLeave = () => {}, onHold = () => {}, onPart = () => {} }) {
    this.view = view;
    this.counters = counters;
    this.age = age;
    this.onLeave = onLeave;
    this.onHold = onHold;
    this.onPart = onPart;
    this.el = document.createElement('div');
    this.el.className = 'counter-bar table-bar';
    this.el.hidden = true;
    root.append(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    // Held like the benches' action: let go anywhere and the stroke ends, so a hold never sticks.
    const release = () => { window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true); this.onHold(false); };
    this.el.addEventListener('pointerdown', (e) => {
      const b = e.target.closest?.('[data-saw]');
      if (!b || b.disabled) return;
      e.preventDefault();
      window.addEventListener('pointerup', release, true);
      window.addEventListener('pointercancel', release, true);
      this.onHold(true);
    });
  }

  show() { this.el.hidden = false; this.render(); }
  hide() { this.el.hidden = true; }

  /** The saw gauge, as the benches show theirs: full width is a level of 1.25. */
  showLevel(level) {
    const el = this.el.querySelector('[data-work-level]');
    if (el) el.style.width = `${Math.min(100, level * 80)}%`;
  }

  /** The pieces open at this age: each piece's own, and never before the table's. */
  pieces() {
    const counterAge = RECIPES_BY_ID.get('counter')?.age ?? 1;
    return FURNITURE.filter((id) => Math.max(AGE.get(id) ?? 1, counterAge) <= this.age());
  }

  render(note = '') {
    if (this.el.hidden) return;
    const key = this.view.key, w = key ? this.counters.work(key) : null;
    if (!w) {
      const last = key ? this.counters.lastMade(key) : null, again = last ? this.counters.ready(last) : null;
      const tiles = this.pieces().map((id) => {
        const can = this.counters.ready(id);
        return `<button class="counter-piece${can.ok ? '' : ' cant'}" data-piece="${id}" title="${escapeHtml(can.reason ?? '')}">${escapeHtml(itemName(id))}</button>`;
      }).join('');
      const say = note || (last ? (again.ok ? `Make another ${itemName(last).toLowerCase()}, or pick a piece.` : again.reason) : 'Pick a piece to make.');
      this.el.innerHTML = `<p class="counter-say">${escapeHtml(say)}</p><div class="counter-pieces">${tiles}</div>
        <div class="counter-actions">
          ${last ? `<button class="primary" data-again ${again.ok ? '' : 'disabled'}>Make another</button>` : ''}
          <button class="secondary" data-leave>Leave</button>
        </div>`;
      return;
    }
    const parts = partsFor(w.item), n = parts.length, fitted = w.fitted.filter(Boolean).length;
    const sawn = w.cut >= n, cut = this.counters.canCut(key), next = this.counters.next(key);
    const settled = !this.view.flying && !this.view.pendingTake;
    const say = note || (!sawn ? (cut.ok ? `Hold Saw and let go in the light band. One stroke cuts the ${itemName(w.item).toLowerCase()}'s ${n === 1 ? 'part' : `${n} parts`}.` : cut.reason)
      : fitted < n ? (w.quick ? 'Tap a part: every part flies to its place.' : `Tap a part and it flies to its place, or drag it: ${fitted} of ${n} fitted.`)
        : isPatterned(w.item) && !w.carved ? 'Carve the pattern with the chisel.'
          : settled ? 'Done. Make room in your bag and take it.' : 'Done.');
    const gauge = sawn ? '' : `<div class="pour-gauge" aria-label="How far the saw has gone"><i class="pour-window" style="left:${WORK_MIN * 80}%;width:${(WORK_MAX - WORK_MIN) * 80}%"></i><i class="pour-level" data-work-level style="width:0%"></i></div>`;
    const chips = sawn && fitted < n ? `<div class="counter-pieces">${parts.map((p, i) =>
      `<button class="counter-piece${i === next || (w.quick && !w.fitted[i]) ? ' next' : ''}" data-part="${i}" ${w.fitted[i] ? 'disabled' : ''}><kbd>${i + 1}</kbd> ${escapeHtml(partLabel(p))}</button>`).join('')}</div>` : '';
    this.el.innerHTML = `${chainLineHtml(w.item, 'counter')}<p class="counter-say">${escapeHtml(say)}</p>${gauge}${chips}
      <div class="counter-actions">
        ${sawn ? '' : `<button class="primary" data-saw ${cut.ok ? '' : 'disabled'}>Saw (hold)</button>`}
        ${isPatterned(w.item) && fitted === n && !w.carved ? '<button class="primary" data-carve>Carve</button>' : ''}
        ${w.done && settled ? '<button class="primary" data-take>Take it</button>' : ''}
        ${!w.paid && w.cut === 0 ? '<button class="secondary" data-back>Back</button>' : ''}
        <button class="secondary" data-leave>Leave</button>
      </div>`;
  }

  click(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.piece) {
      const r = this.view.pick(b.dataset.piece);
      this.render(r.ok ? '' : r.reason);
    } else if (b.dataset.part) {
      this.onPart(Number(b.dataset.part));
    } else if ('again' in b.dataset) {
      const r = this.view.again();
      this.render(r.ok ? '' : r.reason);
    } else if ('back' in b.dataset) {
      this.view.back();
      this.render();
    } else if ('carve' in b.dataset) {
      const r = this.view.carve();
      this.render(r.ok ? '' : r.reason);
    } else if ('take' in b.dataset) {
      this.view.finishIfDone();
    } else if ('leave' in b.dataset) this.onLeave();
  }
}
