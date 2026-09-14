import { ITEMS_BY_ID, itemName, stackLimit, isTool, isFood } from '../config/items.js';
import { STRUCTURES_BY_ID, structuresForAge } from '../config/structures.js';
import { howToGet } from '../config/recipes.js';
import { DESIGN_FOR_STRUCTURE } from '../config/starterDesigns.js';
import { MAX_HUNGER } from '../survival/Hunger.js';
import { glyphSvg } from '../config/glyphs.js';
import { renderPanels } from './Panel.js';

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
const GOALS_KEY = 'voxelgame:goals-open';

function loadGoalsOpen() {
  try { return localStorage.getItem(GOALS_KEY) !== '0'; } catch { return true; }
}

export class DuiltUI {
  constructor(root, { game, bus, panels }) {
    this.root = root;
    this.panels = panels;
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
        <!--
          Population sits beside hunger because it is the same kind of fact:
          how the settlement is doing, not what you are carrying. It says beds
          as well as people, so "why is nobody coming" is answerable without
          opening anything.
        -->
        <div class="vital" id="vital-people" title="Settlers" hidden>
          <span class="vital-icon">👤</span>
          <span class="vital-count" id="people-count">0</span>
        </div>
      </div>

      <div id="goals" hidden>
        <button class="goals-head" id="goals-toggle" aria-expanded="true">
          <span id="goals-age">Age 1 · Settlement</span>
          <span id="goals-land">32 × 32</span>
          <span class="goals-caret" aria-hidden="true"></span>
        </button>
        <ul id="goals-list"></ul>
      </div>

      ${renderPanels('duilt', {
        'panel-bag': `
          <div id="bag-grid"></div>
          <div id="bag-detail"></div>`,
        'panel-claim': `
          <div id="claim-list"></div>`,
        'panel-buildings': `
          <div id="buildings-list"></div>`,
        'panel-bench': `
          <div id="bench-list"></div>`,
        'panel-building': `
          <div id="building-body"></div>`,
        'panel-finish': `
          <div id="finish-body"></div>`,
        'panel-skills': `
          <div id="skills-list"></div>`,
      })}
    `;
    this.root.appendChild(el);
    this.el = el;
  }

  wire() {
    this.el.querySelectorAll('[data-close]').forEach((b) =>
      b.addEventListener('click', () => this.closePanel(b.dataset.close)));
    this.q('#btn-eat').addEventListener('click', () => this.eat());

    // The task list is a reminder, not a readout you stare at, and on a phone
    // it was taking a corner of the screen permanently. Collapsed it keeps the
    // one line that says where you are; the choice is remembered.
    const toggle = this.q('#goals-toggle');
    toggle.addEventListener('click', () => this.setGoalsOpen(!this.goalsOpen));
    this.setGoalsOpen(loadGoalsOpen());

    this.bus.on('inventory:change', () => { this.renderBag(); this.renderVitals(); this.onBagChanged?.(); });
    this.bus.on('hunger:change', () => this.renderVitals());
    this.bus.on('structure:claimed', () => this.renderGoals());
    this.bus.on('structure:broken', () => this.renderGoals());
    this.bus.on('territory:expanded', () => this.renderGoals());
    this.bus.on('structure:claimed', () => this.renderVitals());
    this.bus.on('settler:left', () => this.renderVitals());
    this.bus.on('settler:hungry', ({ count }) => {
      this.renderVitals();
      // Said once when it starts, not every meal: the HUD carries it from
      // then on and a toast every 90 seconds is nagging.
      if (this.saidHungry) return;
      this.saidHungry = true;
      this.bus.emit('toast', {
        kind: 'xp',
        title: count === 1 ? 'Somebody has nothing to eat' : `${count} of your people have nothing to eat`,
        body: 'They stop working until there is food — build a farm',
      });
    });
    this.bus.on('settler:arrived', ({ settler, population }) => {
      this.renderVitals();
      this.bus.emit('toast', {
        kind: 'challenge',
        title: `${settler.name} moved in`,
        body: `${population} living here now`,
      });
    });
  }

  // ---- visibility ----

  setActive(on) {
    this.q('#vitals').hidden = !on;
    this.q('#goals').hidden = !on;
    if (on) { this.renderVitals(); this.renderGoals(); }
    else this.panels.closeAll();
  }

  /**
   * These panels live in the same registry as every other one, so opening and
   * closing goes through it. What stays here is only what is particular to
   * them: what to draw on the way in, and what to forget on the way out.
   */
  populate(id) {
    if (id === 'panel-bag') this.renderBag();
    if (id === 'panel-skills') this.renderSkills();
    if (id === 'panel-buildings') this.renderBuildings();
    if (id === 'panel-bench') this.renderBench();
    if (id === 'panel-finish') this.renderFinish();
  }

  onPanelClosed(id) {
    if (id === 'panel-bag') this.held = null;
    if (id === 'panel-building') this.building = null;
  }

  /**
   * The building you are pointing at, and what you can do to it.
   *
   * Claimed buildings are locked, so this is the only way to change one. Two
   * doors out: unlock it and edit the blocks yourself, or release the claim
   * entirely and have the blocks back as ordinary blocks.
   */
  showBuilding(structure, actions = {}) {
    this.building = structure;
    const spec = STRUCTURES_BY_ID.get(structure.type);
    const body = this.q('#building-body');
    const sub = this.q('#building-sub');
    if (!body) return;

    const r = structure.region;
    const size = `${r.maxX - r.minX + 1} × ${r.maxZ - r.minZ + 1} × ${r.maxY - r.minY + 1}`;
    const locked = structure.locked !== false;
    if (sub) sub.textContent = spec?.name ?? 'A building you claimed';

    body.innerHTML = `
      <div class="building-state ${structure.valid ? 'good' : 'bad'}">
        ${structure.valid ? 'Standing and producing' : (structure.brokenReason ?? 'Something is missing')}
      </div>
      <div class="building-facts">
        <span>${size} blocks</span>
        <span>${locked ? 'Locked' : 'Unlocked — edits allowed'}</span>
      </div>
      <p class="building-note">
        ${locked
          ? 'Protected, so you cannot take a wall out of it by accident while clearing the ground beside it. '
            + 'Move it to pick it up and put it down somewhere else, or change it to edit the blocks.'
          : 'Open for changes: break and place inside it. It is re-checked as you go, and stops producing '
            + 'if it no longer qualifies. Press Done when you have finished.'}
      </p>
      <div class="building-actions">
        <button class="primary" data-move>Move it</button>
        <button class="secondary" data-change>${locked ? 'Change it' : 'Done changing'}</button>
        <button class="danger secondary" data-delete>Delete it</button>
      </div>`;

    body.querySelector('[data-move]').addEventListener('click', () => actions.onMove?.());
    body.querySelector('[data-change]').addEventListener('click', () => actions.onChange?.());
    body.querySelector('[data-delete]').addEventListener('click', () => {
      if (confirm(`Delete this ${spec?.name?.toLowerCase() ?? 'building'}? `
        + 'The blocks come back to your bag.')) actions.onDelete?.();
    });
  }

  openPanel(id) {
    this.panels.open(id);
  }

  closePanel(id) {
    this.panels.close(id);
  }

  isAnyPanelOpen() {
    return this.panels.anyOpen();
  }

  toggleBag() {
    if (this.panels.isOpen('panel-bag')) { this.panels.close('panel-bag'); return false; }
    this.panels.open('panel-bag');
    return true;
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
    this.renderPeople();
  }

  /** How many have moved in, out of how many your houses have room for. */
  renderPeople() {
    const d = this.duilt;
    const box = this.q('#vital-people');
    if (!d || !box) return;
    const { population, target, houses, hungry } = d.settlers;
    // Hidden until there is a house: a 0/0 on the HUD from the first minute is
    // a promise the game has not made yet.
    box.hidden = houses === 0 && population === 0;
    this.q('#people-count').textContent = `${population}/${target}`;
    // Hunger wins the tooltip: it is the one that is costing you something.
    box.title = hungry
      ? `${hungry === 1 ? 'Somebody has' : `${hungry} people have`} nothing to eat, so they are not working — build a farm`
      : (d.settlers.blockedReason() ?? `${target - population} more on the way`);
    box.classList.toggle('full', population >= target && target > 0 && !hungry);
    box.classList.toggle('hungry', hungry > 0);
    if (!hungry) this.saidHungry = false;
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

  setGoalsOpen(open) {
    this.goalsOpen = open;
    const el = this.q('#goals');
    el.classList.toggle('collapsed', !open);
    this.q('#goals-toggle').setAttribute('aria-expanded', String(open));
    try { localStorage.setItem(GOALS_KEY, open ? '1' : '0'); } catch { /* private window */ }
  }

  // ---- goals ----

  renderGoals() {
    const d = this.duilt;
    if (!d) return;
    const ring = d.territory.ring;
    this.q('#goals-age').textContent = `Age ${ring.age} · ${ring.name}`;
    this.q('#goals-land').textContent = `${ring.size} × ${ring.size}`;
    const goals = d.ageGoals();
    this.q('#goals-list').innerHTML = d.won
      ? `<li class="done"><span class="tick">✓</span>Finished. The whole map is yours.</li>`
      : goals.length
        ? goals.map((g) => `<li class="${g.done ? 'done' : ''}">`
            + `<span class="tick">${g.done ? '✓' : ''}</span>${g.label}`
            + `${g.progress ? `<span class="goal-count">${g.progress}</span>` : ''}</li>`).join('')
        : `<li class="done"><span class="tick">✓</span>This age is yours</li>`;
  }

  /**
   * The end of the game.
   *
   * Six ages, and then nothing after — which needed saying somewhere, because
   * a border that stops moving reads as a bug rather than an ending. It counts
   * what is actually standing in the world rather than congratulating you in
   * the abstract: the buildings are the record of what you did.
   */
  renderFinish() {
    const d = this.duilt;
    if (!d) return this.noWorld('#finish-body');
    const body = this.q('#finish-body');
    const sub = this.q('#finish-sub');
    if (sub) sub.textContent = 'Six ages, from thirty-two blocks to the whole map.';

    const byType = new Map();
    for (const s of d.structures.list()) {
      if (!s.valid) continue;
      byType.set(s.type, (byType.get(s.type) ?? 0) + 1);
    }
    const rows = [...byType.entries()]
      .map(([type, n]) => ({ spec: STRUCTURES_BY_ID.get(type), n }))
      .filter((r) => r.spec)
      .sort((a, b) => (a.spec.age - b.spec.age) || a.spec.name.localeCompare(b.spec.name));

    body.innerHTML = `
      <p class="finish-line">You arrived on thirty-two blocks of land with an axe and a bucket.
         What is standing now:</p>
      <ul class="finish-list">
        ${rows.map((r) => `<li><span class="finish-icon">${r.spec.icon}</span>${r.spec.name}<span class="finish-n">${r.n}</span></li>`).join('')
          || '<li>Nothing, somehow.</li>'}
      </ul>
      <p class="finish-line dim">The world stays as it is. You can keep building in it — nothing
         is taken away, there is just nothing further to unlock.</p>
      <div class="building-actions">
        <button class="primary" data-keep>Keep building</button>
        <button class="secondary" data-leave>Back to the worlds</button>
      </div>`;

    body.querySelector('[data-keep]').addEventListener('click', () => this.closePanel('panel-finish'));
    body.querySelector('[data-leave]').addEventListener('click', () => this.onLeave?.());
  }

  // ---- the bag ----

  /**
   * What a panel says when it is opened without a Duilt world behind it.
   *
   * These renderers used to just return, which left the title, the subtitle and
   * an empty box — indistinguishable from a broken panel, and that is exactly
   * how it reached a phone. A panel should always be able to explain itself.
   */
  noWorld(sel) {
    const box = this.q(sel);
    if (box) {
      box.innerHTML = `<div class="sub" style="margin:0">This is part of a Duilt world.
        Open Menu \u2192 New world \u2192 Duilt to begin one.</div>`;
    }
    return null;
  }

  renderBag() {
    const d = this.duilt;
    if (!d) {
      const g = this.q('#bag-grid');
      if (g) g.innerHTML = '';
      return this.noWorld('#bag-detail');
    }
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
          <span class="swatch" style="background:${colour}">${glyphSvg(spec?.glyph, { size: 20, color: spec?.color ?? 0x888888 })}</span>
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

  // ---- buildings ----

  /**
   * The age's building types, each with what it takes and both routes in.
   * This replaces pointing people at a generic template list and hoping they
   * work out what a farm is supposed to contain.
   */
  /**
   * What is missing, and where each missing thing comes from.
   *
   * "Starter needs 2 saplings" is a dead end if nothing in the game ever says
   * what a sapling is. Every line now carries its own answer, pulled from the
   * recipe list so it cannot go stale.
   */
  shortfallNote(missing) {
    const lines = Object.entries(missing).map(([id, n]) => {
      const spec = ITEMS_BY_ID.get(id);
      const from = howToGet(id, spec?.block != null ? itemName(id) : null);
      return `<li>${n} more ${itemName(id).toLowerCase()}${from ? ` — ${from}` : ''}</li>`;
    });
    return `<div class="warn shortfall"><strong>Not enough materials</strong><ul>${lines.join('')}</ul></div>`;
  }

  renderBuildings() {
    const d = this.duilt;
    if (!d) return this.noWorld('#buildings-list');
    const framed = this.game.selectorTool?.active ? this.game.selectorTool.bounds() : null;
    const region = framed ? { ...framed } : null;
    const options = region ? d.claimOptionsFor(region) : null;

    this.q('#buildings-list').innerHTML = structuresForAge(d.age).map((spec) => {
      const built = d.structures.countOf(spec.id);
      const design = DESIGN_FOR_STRUCTURE.get(spec.id);
      const opt = options?.find((o) => o.id === spec.id);
      const needs = spec.requires.map((r) => r.id).join(' · ');
      const makes = Object.entries(spec.produces ?? {}).map(([k, v]) => `${v} ${itemName(k).toLowerCase()}`).join(', ');
      const canStamp = design && d.inventory.hasAll(design.cost);
      const shortfall = design ? d.inventory.missing(design.cost) : {};

      return `
        <div class="building-card">
          <div class="building-head">
            <span class="building-icon">${spec.icon}</span>
            <div class="building-title">
              <strong>${spec.name}</strong>
              <em>${spec.blurb}</em>
            </div>
            ${built ? `<span class="building-count">${built} built</span>` : ''}
          </div>
          <div class="building-meta">
            <span>${this.whatItGivesYou(spec, makes)}</span>
            <span>Needs: ${needs}</span>
          </div>
          <div class="building-actions">
            <button class="secondary" data-claim-here="${spec.id}" ${opt?.ok ? '' : 'disabled'}>
              Claim what I framed
            </button>
            ${design ? `<button class="secondary" data-stamp="${spec.id}" ${canStamp ? '' : 'disabled'}>
              Place a ${design.footprint} starter
            </button>` : ''}
          </div>
          ${design && canStamp ? '<div class="building-note"><span>Aim where you want it and press Place.</span></div>' : ''}
          <div class="building-note">
            ${opt && !opt.ok ? `<span class="warn">${opt.reason}</span>` : ''}
            ${!region ? '<span>Turn on Select and frame a build to claim it.</span>' : ''}
            ${design && !canStamp ? this.shortfallNote(shortfall) : ''}
            ${design?.note && canStamp ? `<span>${design.note}</span>` : ''}
          </div>
        </div>`;
    }).join('');

    this.q('#buildings-list').querySelectorAll('[data-claim-here]').forEach((b) =>
      b.addEventListener('click', () => {
        this.closePanel('panel-buildings');
        this.onClaimType?.(b.dataset.claimHere);
      }));
    this.q('#buildings-list').querySelectorAll('[data-stamp]').forEach((b) =>
      b.addEventListener('click', () => {
        this.closePanel('panel-buildings');
        this.onStampStarter?.(b.dataset.stamp);
      }));
  }

  /**
   * The one line saying why you would want this building.
   *
   * Most of them produce something on a timer and that is the answer. The ones
   * that do not each have their own reason, and "Houses settlers, later on" —
   * which is what every non-producer used to say — is true of exactly one.
   */
  whatItGivesYou(spec, makes) {
    if (makes) return `Makes ${makes} a minute`;
    if (spec.station === 'workshop') return 'Lets you make things here that your hands cannot';
    if (spec.grantsCapacity) return 'Somebody moves in — the first one is yours';
    return 'Builds nothing and makes nothing. It is the point of the game';
  }

  // ---- the workbench ----

  renderBench() {
    const d = this.duilt;
    if (!d) return this.noWorld('#bench-list');
    const near = this.game.player?.position;
    const atStations = d.stationsNear(near);
    // Everything for the age, hand and workshop alike. A workshop recipe you
    // cannot see is a workshop you never learn you need, so they are listed
    // from the age they appear and greyed out until you are standing at one.
    const recipes = d.crafting.available(d.age, { station: null, near, atStations });

    this.q('#bench-list').innerHTML = recipes.map((r) => {
      const inputs = Object.entries(r.inputs)
        .map(([id, n]) => `${n} ${itemName(id).toLowerCase()}`).join(' + ');
      return `
        <div class="recipe-row ${r.ok ? '' : 'blocked'}">
          <div class="recipe-text">
            <strong>${r.name}${r.station !== 'hand' ? `<span class="recipe-station${r.atStation ? ' at' : ''}">${r.station}</span>` : ''}</strong>
            <em>${r.blurb}</em>
            <span class="recipe-cost">${inputs} → ${r.output.count} ${itemName(r.output.id).toLowerCase()}</span>
          </div>
          <div class="recipe-actions">
            <button class="secondary" data-craft="${r.id}" data-times="1" ${r.ok ? '' : 'disabled'}>Make</button>
            ${r.batch && r.maxBatch > 1 ? `<button class="secondary" data-craft="${r.id}" data-times="${r.maxBatch}">×${r.maxBatch}</button>` : ''}
          </div>
          ${r.reason ? `<div class="recipe-why warn">${r.reason}</div>` : ''}
        </div>`;
    }).join('');

    this.q('#bench-list').querySelectorAll('[data-craft]').forEach((b) =>
      b.addEventListener('click', () => {
        const pos = this.game.player?.position;
        const res = d.crafting.craft(b.dataset.craft, Number(b.dataset.times),
          { near: pos, atStations: d.stationsNear(pos) });
        this.bus.emit('toast', res.ok
          ? { kind: 'challenge', title: `Made ${res.made} ${res.name.toLowerCase()}` }
          : { kind: 'xp', title: 'Cannot make that', body: res.reason });
        this.renderBench();
      }));
  }

  // ---- skills ----

  renderSkills() {
    const d = this.duilt;
    if (!d) return this.noWorld('#skills-list');
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
