import { RECIPES } from '../config/recipes.js';
import { itemName } from '../config/items.js';
import { escapeHtml } from './html.js';
import { chainLineHtml } from './chainLine.js';
import { pieceTile } from './pieceTile.js';
import { meltSeconds, mouldFor, MAX_BATCHES, POUR_MIN, POUR_MAX } from '../duilt/Crucible.js';

/**
 * The words each kind of pot uses. CRAFT-9 part 6: the Kiln Oven fires and
 * is drawn where the crucible melts and is poured; it has no mould to pick.
 */
const WORDS = {
  // PLAY-19: the Cauldron simmers a meal and serves it into a bowl.
  cauldron: { station: 'cauldron', verb: 'Serve', ing: 'Simmering', state: 'simmering', done: 'cooked', load: 'Load what goes in the pot. It simmers on its own, also while you are away.',
    hold: 'Hold Serve and let go when the bowl is full', made: 'Served', short: 'Too little: it ran back into the pot. Hold longer.', over: 'Too much: it slopped over and was lost.', bar: 'How far the meal has cooked', gauge: 'How full the bowl is' },
  // PLAY-16: the Dehydrator dries like the Kiln fires: load, wait, draw out the tray.
  dehydrator: { station: 'dehydrator', verb: 'Take out', ing: 'Drying', state: 'drying', done: 'dried', load: 'Load mushrooms to dry. They dry on their own, also while you are away.',
    hold: 'Hold Take out and let go when the tray reaches the front', made: 'Taken out', short: 'Not out yet: the tray slid back in. Hold longer.', over: 'Too far: it tipped off the tray and was lost.', bar: 'How far the batch has dried', gauge: 'How far the tray is out' },
  crucible: { station: 'crucible', verb: 'Pour', ing: 'Melting', state: 'melting', done: 'molten', load: 'Load something to melt. It melts on its own, also while you are away.',
    hold: 'Hold Pour and let go when the mould is full', made: 'Poured', short: 'Too little: it ran back into the pot. Hold longer.', over: 'Too much: it spilt over and was lost.', bar: 'How far the batch has melted', gauge: 'How full the mould is' },
  kiln: { station: 'kiln_oven', verb: 'Draw', ing: 'Firing', state: 'firing', done: 'fired', load: 'Load clay or sand to fire. It fires on its own, also while you are away.',
    hold: 'Hold Draw and let go when the tray reaches the mouth', made: 'Drawn', short: 'Not out yet: the tray slid back in. Hold longer.', over: 'Too far: it fell off the tray and cracked.', bar: 'How far the batch has fired', gauge: 'How far the tray is out' },
};

/**
 * CRAFT3D-3: the buttons over the crucible close-up. What it can melt (a tap
 * loads as much as the bag pays for), the mould, Pour (hold, let go when it
 * is full), Take, and Leave; a line saying what is happening and what to do.
 */
export class CrucibleBar {
  constructor({ root, view, crucibles, kind = 'crucible', age = () => Infinity, onLeave = () => {}, onPoured = () => {} }) {
    this.words = WORDS[kind] ?? WORDS.crucible;
    this.view = view;
    this.crucibles = crucibles;
    this.age = age;
    this.onLeave = onLeave;
    this.onPoured = onPoured;
    this.el = document.createElement('div');
    this.el.className = `counter-bar machine-bar crucible-bar${kind === 'kiln' || kind === 'dehydrator' ? ' kiln-bar' : ''}`;
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

  show() { this.el.hidden = false; this.said = ''; this.render(); }
  hide() { this.el.hidden = true; }

  pour(on) {
    const r = this.view.holdPour(on);
    if (!r) return;
    const w = this.words;
    const say = r.result === 'made' ? `${w.made}: ${r.made.count} ${itemName(r.made.id).toLowerCase()}.`
      : r.result === 'short' ? w.short
        : r.result === 'spilt' ? w.over : '';
    this.onPoured(r);
    // What came of the pour stays on the bar until the next tap, also when a
    // batch melts (or fires) meanwhile and the bar is drawn again.
    this.said = say;
    this.render(say);
  }

  /** Moves the gauge to the mould's level (1.25 is the far end; full is at 80%). */
  showLevel(level) {
    const el = this.el.querySelector('[data-pour-level]');
    if (el) el.style.width = `${Math.min(100, level * 80)}%`;
  }

  /**
   * The melting bar (owner, 9 November: "the crucible needs progress bar on
   * the melting"): how far the batch in the fire has got, and the seconds
   * left. Called every frame; it only touches two elements.
   */
  showMelt() {
    const key = this.view.key, s = key ? this.crucibles.state(key) : null;
    const bar = this.el.querySelector('[data-melt-bar]'), left = this.el.querySelector('[data-melt-left]');
    if (!s || !bar) return;
    const recipe = RECIPES.find((r) => r.id === s.recipeId);
    bar.style.width = `${Math.round(s.progress * 100)}%`;
    if (left) left.textContent = `${Math.ceil((1 - s.progress) * meltSeconds(recipe))} s`;
  }

  recipes() {
    return RECIPES.filter((r) => r.station === this.words.station && r.age <= this.age());
  }

  render(note = this.said ?? '') {
    if (this.el.hidden) return;
    const key = this.view.key, s = key ? this.crucibles.state(key) : null;
    const recipe = s ? RECIPES.find((r) => r.id === s.recipeId) : null;
    const tiles = this.recipes().map((r) => {
      const busy = s && s.recipeId !== r.id;
      const takes = Object.entries(r.inputs).map(([id, n]) => `${n} ${itemName(id).toLowerCase()}`).join(' + ');
      return pieceTile({ id: r.output.id, count: r.output.count, sub: `${takes} · ${meltSeconds(r)} s`, attrs: `data-load="${escapeHtml(r.id)}"`,
        cls: busy ? 'cant' : '', disabled: busy });
    }).join('');
    const w = this.words, poured = recipe && mouldFor(recipe), moulds = poured === 'ingot' || poured === 'coin';
    const state = !s ? w.load
      : `${s.waiting} ${w.state}, ${s.molten} ${w.done}${s.out ? `, ${s.out} ${itemName(recipe.output.id).toLowerCase()} ready` : ''}.`
        + (poured && s.molten ? ` ${w.hold} (${Math.round(POUR_MIN * 100)} to ${Math.round(POUR_MAX * 100)}%).` : '');
    const melting = s?.waiting ? `<div class="melt-row"><span class="melt-name">${w.ing} ${escapeHtml(itemName(recipe.output.id).toLowerCase())}</span>
        <div class="research-bar melt-bar" role="progressbar" aria-label="${w.bar}"><i data-melt-bar style="width:${Math.round(s.progress * 100)}%"></i></div>
        <b data-melt-left>${Math.ceil((1 - s.progress) * meltSeconds(recipe))} s</b></div>` : '';
    this.el.innerHTML = `${chainLineHtml(recipe?.output?.id ?? this.recipes()[0]?.output?.id, 'crucible')}<p class="counter-say">${escapeHtml(note ? `${note} ${state}` : state)}</p>
      ${melting}
      ${poured ? `<div class="pour-gauge" aria-label="${w.gauge}"><i class="pour-window" style="left:${POUR_MIN * 80}%;width:${(POUR_MAX - POUR_MIN) * 80}%"></i><i class="pour-level" data-pour-level style="width:0%"></i></div>` : ''}
      <div class="counter-pieces">${tiles}</div>
      <div class="counter-actions">
        ${moulds ? `<button class="secondary" data-mould="ingot" ${s.mould === 'ingot' ? 'aria-pressed="true"' : ''}>Ingot mould</button>
        <button class="secondary" data-mould="coin" ${s.mould === 'coin' ? 'aria-pressed="true"' : ''}>Coin mould</button>` : ''}
        ${s?.out ? '<button class="primary" data-take>Take</button>' : ''}
        <button class="secondary" data-leave>Leave</button>
      </div>
      ${poured ? `<button class="primary machine-action" data-pour ${this.view.canPour() ? '' : 'disabled'}>${w.verb} (hold)</button>` : ''}`;
  }

  click(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const key = this.view.key;
    this.said = '';
    if (b.dataset.load) {
      const r = this.crucibles.load(key, b.dataset.load, MAX_BATCHES);
      this.render(r.ok ? `Loaded ${r.batches}.` : r.reason);
    } else if (b.dataset.mould) { this.crucibles.setMould(key, b.dataset.mould); this.render(); }
    else if ('take' in b.dataset) { const n = this.crucibles.take(key); this.render(n ? `Took ${n}.` : 'No room in your bag or a storehouse.'); }
    else if ('leave' in b.dataset) this.onLeave();
  }
}
