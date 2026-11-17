import { itemName } from '../config/items.js';
import { escapeHtml } from './html.js';
import { chainLineHtml } from './chainLine.js';
import { WORK_MIN, WORK_MAX } from '../duilt/BenchWork.js';

/**
 * The buttons over a bench machine's close-up: what it makes (greyed when it
 * can't yet, with why), the held action and its gauge, Many at once (the
 * bench panel, for whole batches) and Leave.
 */
export class BenchBar {
  constructor({ root, onHold, onPick, onMany, onLeave }) {
    Object.assign(this, { onHold, onPick, onMany, onLeave });
    this.el = document.createElement('div');
    this.el.className = 'counter-bar machine-bar bench-bar';
    this.el.hidden = true;
    root.append(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    // Held like the crucible's Pour: let go anywhere and the stroke ends, so a hold never sticks.
    const release = () => { window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true); this.onHold(false); };
    this.el.addEventListener('pointerdown', (e) => {
      if (!e.target.closest?.('[data-work]') || e.target.closest('[data-work]').disabled) return;
      e.preventDefault();
      window.addEventListener('pointerup', release, true);
      window.addEventListener('pointercancel', release, true);
      this.onHold(true);
    });
  }

  show() { this.el.hidden = false; }
  hide() { this.el.hidden = true; }

  showLevel(level) {
    const el = this.el.querySelector('[data-work-level]');
    if (el) el.style.width = `${Math.min(100, level * 80)}%`;
  }

  /** `recipes` are Crafting.recipeStatus results; `picked` the chosen one's id. */
  render({ machine, recipes, picked, say, taps = 0, station = null }) {
    const chosen = recipes.find((r) => r.id === picked);
    const tiles = recipes.map((r) => {
      const takes = Object.entries(r.inputs).map(([id, n]) => `${n} ${itemName(id).toLowerCase()}`).join(' + ');
      return `<button class="counter-piece${r.ok ? '' : ' cant'}" data-pick="${escapeHtml(r.id)}" ${r.id === picked ? 'aria-pressed="true"' : ''} title="${escapeHtml(r.reason ?? '')}">${escapeHtml(itemName(r.output.id))}${r.output.count > 1 ? ` ×${r.output.count}` : ''}<small> ${escapeHtml(takes)}</small></button>`;
    }).join('');
    const line = say || (!recipes.length ? 'Nothing is made here at this age.'
      : !chosen ? 'Pick what to make.'
        : !chosen.ok ? chosen.reason
          : machine.taps ? `Tap ${machine.verb} on each chalk mark: the ${machine.taps === 3 ? 'third' : 'last'} tap makes the batch.`
            : `Hold ${machine.verb} and let go when the bar is in the light band.`);
    // A tapped machine (the Mason's Bench) shows its chalk marks, lit as they are tapped; nothing spoils, so no window.
    const gauge = machine.taps
      ? `<div class="chisel-marks" aria-label="Chalk marks tapped">${Array.from({ length: machine.taps }, (_, i) => `<i class="chisel-mark${i < taps ? ' done' : ''}"></i>`).join('')}</div>`
      : `<div class="pour-gauge" aria-label="How far the work has gone"><i class="pour-window" style="left:${WORK_MIN * 80}%;width:${(WORK_MAX - WORK_MIN) * 80}%"></i><i class="pour-level" data-work-level style="width:0%"></i></div>`;
    // The action sits in the middle of the bottom row, under the thumb.
    this.el.innerHTML = `${chainLineHtml(chosen?.output?.id, station)}<p class="counter-say">${escapeHtml(line)}</p>
      ${gauge}
      <div class="counter-pieces">${tiles}</div>
      <div class="counter-actions">
        <button class="secondary" data-many title="Many at once">Many</button>
        <button class="primary" data-work ${chosen?.ok ? '' : 'disabled'}>${escapeHtml(machine.verb)} (${machine.taps ? 'tap' : 'hold'})</button>
        <button class="secondary" data-leave>Leave</button>
      </div>`;
  }

  click(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.pick) this.onPick(b.dataset.pick);
    else if ('many' in b.dataset) this.onMany();
    else if ('leave' in b.dataset) this.onLeave();
  }
}
