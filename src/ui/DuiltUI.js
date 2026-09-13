import { ITEMS_BY_ID, itemName, stackLimit, isTool, isFood } from '../config/items.js';
import { MAX_HUNGER } from '../survival/Hunger.js';

/**
 * The Duilt interface: the bag, the stomach, the claim menu and the goal list.
 *
 * Designed for the phone first and inherited by the desktop, because forty
 * touch targets next to two thumbsticks is the hardest screen in this game and
 * the one most likely to make the whole thing feel clumsy. So: no dragging —
 * tap to lift, tap to drop, hold to split. That works identically with a mouse,
 * which is why the desktop gets the phone's design rather than the reverse.
 */

const HOLD_MS = 420;

export class DuiltUI {
  constructor(root, { game, bus }) {
    this.root = root;
    this.game = game;
    this.bus = bus;
    this.held = null;       // slot index lifted and waiting to be placed
    this.mount();
    this.wire();
  }

  /** The live Duilt state, or null in sandbox modes. */
  get duilt() {
    return this.game.duilt ?? null;
  }

  q(sel) {
    return this.root.querySelector(sel);
  }

  mount() {
    const el = document.createElement('div');
    el.id = 'duilt-layer';
    el.innerHTML = `
      <div id="vitals" hidden>
        <div class="vital" id="vital-hunger" title="Hunger">
          <span class="vital-icon">🍖</span>
          <div class="vital-track"><div class="vital-fill" id="hunger-fill"></div></div>
        </div>
        <button class="vital-eat" id="btn-eat" hidden>Eat</button>
      </div>

      <div id="goals" hidden>
        <div class="goals-head"><span id="goals-age">Age 1 · Settlement</span><span id="goals-land">32 × 32</span></div>
        <ul id="goals-list"></ul>
      </div>

      <div class="overlay" id="panel-bag" hidden>
        <div class="panel panel-wide">
          <button class="icon-btn panel-close" data-close="panel-bag">✕</button>
          <h2>Bag</h2>
          <div class="sub" id="bag-sub">Tap an item to lift it, tap a slot to put it down. Hold to split a stack.</div>
          <div id="bag-grid"></div>
          <div id="bag-detail"></div>
        </div>
      </div>

      <div class="overlay" id="panel-claim" hidden>
        <div class="panel">
          <button class="icon-btn panel-close" data-close="panel-claim">✕</button>
          <h2>What is this?</h2>
          <div class="sub">The game will check what you've built and tell you if anything's missing.</div>
          <div id="claim-list"></div>
        </div>
      </div>

      <div class="overlay" id="panel-skills" hidden>
        <div class="panel">
          <button class="icon-btn panel-close" data-close="panel-skills">✕</button>
          <h2>Skills</h2>
          <div class="sub">You get better by doing — and credit lands on milestones, not repetition.</div>
          <div id="skills-list"></div>
        </div>
      </div>
    `;
    this.root.appendChild(el);
    this.el = el;
  }

  wire() {
    this.el.querySelectorAll('[data-close]').forEach((b) =>
      b.addEventListener('click', () => this.closePanel(b.dataset.close)));
    this.q('#btn-eat').addEventListener('click', () => this.eat());

    this.bus.on('inventory:change', () => { this.renderBag(); this.renderVitals(); });
    this.bus.on('hunger:change', () => this.renderVitals());
    this.bus.on('structure:claimed', () => this.renderGoals());
    this.bus.on('structure:broken', () => this.renderGoals());
    this.bus.on('territory:expanded', () => this.renderGoals());
  }

  // ---- visibility ----

  setActive(on) {
    this.q('#vitals').hidden = !on;
    this.q('#goals').hidden = !on;
    if (on) { this.renderVitals(); this.renderGoals(); }
    else ['panel-bag', 'panel-claim', 'panel-skills'].forEach((p) => this.closePanel(p));
  }

  openPanel(id) {
    this.q(`#${id}`).hidden = false;
    if (id === 'panel-bag') this.renderBag();
    if (id === 'panel-skills') this.renderSkills();
  }

  closePanel(id) {
    const p = this.q(`#${id}`);
    if (p) p.hidden = true;
    if (id === 'panel-bag') this.held = null;
  }

  isAnyPanelOpen() {
    return ['panel-bag', 'panel-claim', 'panel-skills'].some((id) => !this.q(`#${id}`).hidden);
  }

  toggleBag() {
    const p = this.q('#panel-bag');
    p.hidden ? this.openPanel('panel-bag') : this.closePanel('panel-bag');
    return !p.hidden;
  }

  // ---- vitals ----

  renderVitals() {
    const d = this.duilt;
    if (!d) return;
    const pct = Math.max(0, Math.min(100, (d.hunger.value / MAX_HUNGER) * 100));
    const fill = this.q('#hunger-fill');
    fill.style.width = `${pct}%`;
    fill.classList.toggle('low', d.hunger.isHungry);
    const food = d.hunger.bestFoodIn(d.inventory);
    const eat = this.q('#btn-eat');
    eat.hidden = !(food && d.hunger.value < MAX_HUNGER - 1);
    if (food) eat.textContent = `Eat ${itemName(food)}`;
  }

  eat() {
    const d = this.duilt;
    if (!d) return;
    const r = d.eat();
    this.bus.emit('toast', r.ok
      ? { kind: 'challenge', title: 'That helps', body: `+${r.restored} hunger` }
      : { kind: 'xp', title: r.reason });
    this.renderVitals();
  }

  // ---- goals ----

  renderGoals() {
    const d = this.duilt;
    if (!d) return;
    const ring = d.territory.ring;
    this.q('#goals-age').textContent = `Age ${ring.age} · ${ring.name}`;
    this.q('#goals-land').textContent = `${ring.size} × ${ring.size}`;
    const goals = d.ageGoals();
    this.q('#goals-list').innerHTML = goals.length
      ? goals.map((g) => `<li class="${g.done ? 'done' : ''}"><span class="tick">${g.done ? '✓' : ''}</span>${g.label}</li>`).join('')
      : `<li class="done"><span class="tick">✓</span>This age is yours</li>`;
  }

  // ---- the bag ----

  renderBag() {
    const d = this.duilt;
    if (!d) return;
    const grid = this.q('#bag-grid');
    if (!grid) return;
    const slots = d.inventory.slots;

    grid.innerHTML = slots.map((s, i) => {
      if (!s) return `<button class="bag-slot empty" data-slot="${i}" aria-label="Empty slot ${i + 1}"></button>`;
      const spec = ITEMS_BY_ID.get(s.id);
      const worn = spec?.durability ? Math.round((1 - s.wear / spec.durability) * 100) : null;
      const colour = `#${(spec?.color ?? 0x888888).toString(16).padStart(6, '0')}`;
      return `
        <button class="bag-slot ${this.held === i ? 'held' : ''}" data-slot="${i}" aria-label="${itemName(s.id)}, ${s.count}">
          <span class="swatch" style="background:${colour}"></span>
          ${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}
          ${worn != null ? `<span class="wear"><i style="width:${worn}%"></i></span>` : ''}
        </button>`;
    }).join('');

    grid.querySelectorAll('[data-slot]').forEach((btn) => this.bindSlot(btn));
    this.q('#bag-sub').textContent = this.held != null
      ? `Holding ${itemName(slots[this.held]?.id ?? '')} — tap a slot to put it down.`
      : 'Tap an item to lift it, tap a slot to put it down. Hold to split a stack.';
    this.renderDetail();
  }

  /** Tap lifts and drops; a long hold splits. Identical on mouse and finger. */
  bindSlot(btn) {
    const i = Number(btn.dataset.slot);
    let timer = null, didHold = false;

    const start = () => {
      didHold = false;
      timer = setTimeout(() => {
        didHold = true;
        if (this.duilt?.inventory.split(i)) {
          this.bus.emit('toast', { kind: 'xp', title: 'Split the stack' });
        }
      }, HOLD_MS);
    };
    const end = (e) => {
      clearTimeout(timer);
      if (didHold) { e?.preventDefault?.(); return; }
      this.tapSlot(i);
    };
    const cancel = () => clearTimeout(timer);

    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointerleave', cancel);
    btn.addEventListener('pointercancel', cancel);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  tapSlot(i) {
    const inv = this.duilt?.inventory;
    if (!inv) return;
    if (this.held == null) {
      if (inv.slots[i]) this.held = i;
    } else if (this.held === i) {
      this.held = null;
    } else {
      inv.move(this.held, i);
      this.held = null;
    }
    this.renderBag();
  }

  /** What the lifted or first item actually is — the bag shouldn't be a colour puzzle. */
  renderDetail() {
    const inv = this.duilt?.inventory;
    const box = this.q('#bag-detail');
    if (!inv || !box) return;
    const idx = this.held ?? inv.slots.findIndex((s) => s);
    const slot = idx >= 0 ? inv.slots[idx] : null;
    if (!slot) { box.innerHTML = `<div class="sub" style="margin:0">Your bag is empty. Go and break something.</div>`; return; }
    const spec = ITEMS_BY_ID.get(slot.id);
    const bits = [`Stacks to ${stackLimit(slot.id)}`];
    if (spec?.madeBy) bits.push(spec.madeBy);
    if (isTool(slot.id) && spec?.durability) bits.push(`${spec.durability - slot.wear} uses left`);
    if (isFood(slot.id)) bits.push(`Restores ${spec.feeds} hunger`);
    box.innerHTML = `
      <div class="bag-detail-row">
        <strong>${itemName(slot.id)}</strong>
        <span>${slot.count}</span>
      </div>
      <div class="sub" style="margin:4px 0 0">${bits.join(' · ')}</div>`;
  }

  // ---- claiming ----

  openClaim(region, onClaim) {
    const d = this.duilt;
    if (!d || !region) return;
    const list = this.q('#claim-list');
    const options = d.claimOptionsFor(region);
    list.innerHTML = options.map((o) => `
      <button class="claim-row ${o.ok ? 'ok' : 'blocked'}" data-claim="${o.id}" ${o.ok ? '' : 'disabled'}>
        <span class="claim-icon">${o.icon}</span>
        <span class="claim-text">
          <strong>${o.name}</strong>
          <em>${o.ok ? o.blurb : o.reason}</em>
        </span>
        <span class="claim-state">${o.ok ? 'Claim' : '—'}</span>
      </button>
    `).join('');
    list.querySelectorAll('[data-claim]').forEach((b) =>
      b.addEventListener('click', () => { onClaim(b.dataset.claim); this.closePanel('panel-claim'); }));
    this.openPanel('panel-claim');
  }

  // ---- skills ----

  renderSkills() {
    const d = this.duilt;
    if (!d) return;
    this.q('#skills-list').innerHTML = d.skills.summary().map((s) => `
      <div class="skill-row">
        <div class="skill-head">
          <span class="skill-icon">${s.icon}</span>
          <strong>${s.name}</strong>
          <span class="skill-level">${s.level} / ${s.maxLevel}</span>
        </div>
        <div class="skill-governs">${s.governs}</div>
        <div class="skill-track"><div class="skill-fill" style="width:${Math.round(s.ratio * 100)}%"></div></div>
        <div class="skill-effect">${s.level > 0 ? s.effect : 'Not started'}${s.next ? ` · next at ${s.next}` : ''}</div>
      </div>
    `).join('');
  }
}
