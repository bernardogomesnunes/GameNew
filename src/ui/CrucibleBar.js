import { RECIPES } from '../config/recipes.js';
import { itemName } from '../config/items.js';
import { escapeHtml } from './html.js';
import { meltSeconds, mouldFor, MAX_BATCHES, POUR_MIN, POUR_MAX } from '../duilt/Crucible.js';

/**
 * CRAFT3D-3: the buttons over the crucible close-up. What it can melt (a tap
 * loads as much as the bag pays for), the mould, Pour (hold, let go when it
 * is full), Take, and Leave; a line saying what is happening and what to do.
 */
export class CrucibleBar {
  constructor({ root, view, crucibles, age = () => Infinity, onLeave = () => {}, onPoured = () => {} }) {
    this.view = view;
    this.crucibles = crucibles;
    this.age = age;
    this.onLeave = onLeave;
    this.onPoured = onPoured;
    this.el = document.createElement('div');
    this.el.className = 'counter-bar machine-bar crucible-bar';
    this.el.hidden = true;
    root.append(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    // Pour is held: down starts it, up (or the finger sliding off) pours.
    // The release is listened for on the window, so letting go anywhere
    // (off the button, off the bar) pours, and a hold can never stick.
    const release = () => { window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true); this.pour(false); };
    this.el.addEventListener('pointerdown', (e) => {
      if (!e.target.closest?.('[data-pour]')) return;
      e.preventDefault();
      window.addEventListener('pointerup', release, true);
      window.addEventListener('pointercancel', release, true);
      this.pour(true);
    });
  }

  show() { this.el.hidden = false; this.render(); }
  hide() { this.el.hidden = true; }

  pour(on) {
    const r = this.view.holdPour(on);
    if (!r) return;
    const say = r.result === 'made' ? `Poured: ${r.made.count} ${itemName(r.made.id).toLowerCase()}.`
      : r.result === 'short' ? 'Too little: it ran back into the pot. Hold longer.'
        : r.result === 'spilt' ? 'Too much: it spilt over and was lost.' : '';
    this.onPoured(r);
    this.render(say);
  }

  /** Moves the gauge to the mould's level (1.25 is the far end; full is at 80%). */
  showLevel(level) {
    const el = this.el.querySelector('[data-pour-level]');
    if (el) el.style.width = `${Math.min(100, level * 80)}%`;
  }

  recipes() {
    return RECIPES.filter((r) => r.station === 'crucible' && r.age <= this.age());
  }

  render(note = '') {
    if (this.el.hidden) return;
    const key = this.view.key, s = key ? this.crucibles.state(key) : null;
    const recipe = s ? RECIPES.find((r) => r.id === s.recipeId) : null;
    const tiles = this.recipes().map((r) => {
      const busy = s && s.recipeId !== r.id;
      const takes = Object.entries(r.inputs).map(([id, n]) => `${n} ${itemName(id).toLowerCase()}`).join(' + ');
      return `<button class="counter-piece${busy ? ' cant' : ''}" data-load="${r.id}" ${busy ? 'disabled' : ''}>${escapeHtml(itemName(r.output.id))}${r.output.count > 1 ? ` ×${r.output.count}` : ''}<small> ${escapeHtml(takes)} · ${meltSeconds(r)} s</small></button>`;
    }).join('');
    const poured = recipe && mouldFor(recipe);
    const state = !s ? 'Load something to melt. It melts on its own, also while you are away.'
      : `${s.waiting} melting, ${s.molten} molten${s.out ? `, ${s.out} ${itemName(recipe.output.id).toLowerCase()} ready` : ''}.`
        + (poured && s.molten ? ` Hold Pour and let go when the mould is full (${Math.round(POUR_MIN * 100)} to ${Math.round(POUR_MAX * 100)}%).` : '');
    this.el.innerHTML = `<p class="counter-say">${escapeHtml(note ? `${note} ${state}` : state)}</p>
      ${poured ? `<div class="pour-gauge" aria-label="How full the mould is"><i class="pour-window" style="left:${POUR_MIN * 80}%;width:${(POUR_MAX - POUR_MIN) * 80}%"></i><i class="pour-level" data-pour-level style="width:0%"></i></div>` : ''}
      <div class="counter-pieces">${tiles}</div>
      <div class="counter-actions">
        ${poured ? `<button class="secondary" data-mould="ingot" ${s.mould === 'ingot' ? 'aria-pressed="true"' : ''}>Ingot mould</button>
        <button class="secondary" data-mould="coin" ${s.mould === 'coin' ? 'aria-pressed="true"' : ''}>Coin mould</button>
        <button class="primary" data-pour ${this.view.canPour() ? '' : 'disabled'}>Pour (hold)</button>` : ''}
        ${s?.out ? '<button class="primary" data-take>Take</button>' : ''}
        <button class="secondary" data-leave>Leave</button>
      </div>`;
  }

  click(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const key = this.view.key;
    if (b.dataset.load) {
      const r = this.crucibles.load(key, b.dataset.load, MAX_BATCHES);
      this.render(r.ok ? `Loaded ${r.batches}.` : r.reason);
    } else if (b.dataset.mould) { this.crucibles.setMould(key, b.dataset.mould); this.render(); }
    else if ('take' in b.dataset) { const n = this.crucibles.take(key); this.render(n ? `Took ${n}.` : 'No room in your bag or a storehouse.'); }
    else if ('leave' in b.dataset) this.onLeave();
  }
}
