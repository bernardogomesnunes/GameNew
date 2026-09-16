import { ITEMS_BY_ID, itemName, stackLimit, isTool, isFood } from '../config/items.js';
import { STRUCTURES_BY_ID, structuresForAge } from '../config/structures.js';
import { howToGet } from '../config/recipes.js';
import { DESIGN_FOR_STRUCTURE } from '../config/starterDesigns.js';
import { MAX_HUNGER } from '../survival/Hunger.js';
import { glyphSvg } from '../config/glyphs.js';
import { itemIcon } from '../config/cubes.js';
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
          as well as people, and it is a button, because "0/0" is a number and
          not an answer — the answer used to be a title attribute, which is a
          hover on a desktop and nothing whatsoever on a phone.
        -->
        <button type="button" class="vital" id="vital-people" title="Settlers" hidden>
          <span class="vital-icon">👤</span>
          <span class="vital-count" id="people-count">0</span>
        </button>
      </div>

      ${renderPanels('duilt', {
        'panel-bag': `
          <div id="bag-grid"></div>
          <div id="bag-detail"></div>`,
        'panel-store': `
          <!--
            Both containers on one screen, because moving a thing between them
            is the only reason to be here. Two panels would mean remembering
            what was in the other one.
          -->
          <div class="store-head">
            <span id="store-where">On the shelves</span>
            <button class="secondary" id="btn-store-all">Put it all in</button>
          </div>
          <!--
            What it would take to make it bigger, said where you are standing
            when you notice it is too small. An upgrade you have to go and read
            about somewhere else is an upgrade nobody finds.
          -->
          <div id="store-next" class="store-next" hidden></div>
          <div id="store-grid"></div>
          <div class="store-head"><span>In your bag</span></div>
          <div id="store-bag-grid"></div>`,
        'panel-claim': `
          <div id="claim-list"></div>`,
        'panel-buildings': `
          <!--
            Claiming by pointing works for something you stacked up and cannot
            work for something you dug — the flood fill will not go below the
            original ground, so a quarry answered "point at what you built"
            wherever you stood. Drawing the area is the way in for both.
          -->
          <button class="secondary claim-area" id="btn-claim-area">Claim an area</button>
          <div class="export-note">Tap one corner of it and then the opposite corner. Use this for anything you dug out — a quarry, a mine, a farm.</div>
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
    this.q('#vital-people').addEventListener('click', () => this.sayPeople());
    this.q('#btn-claim-area').addEventListener('click', () => this.game.beginClaimSelection());
    this.q('#btn-store-all').addEventListener('click', () => this.storeEverything());

    this.bus.on('inventory:change', () => {
      this.renderBag();
      this.renderVitals();
      // A storehouse is an Inventory too, so its own changes come through
      // here — and so does the bag half of the store screen.
      if (this.panels.isOpen('panel-store')) this.renderStore();
      this.onBagChanged?.();
    });
    this.bus.on('hunger:change', () => this.renderVitals());
    // Claiming and losing a building both change how many houses there are,
    // which is the number the people pill is counting against.
    this.bus.on('structure:claimed', () => this.renderVitals());
    this.bus.on('structure:broken', () => this.renderVitals());
    this.bus.on('structure:stalled', ({ structures }) => {
      // Said once, then not again until something changes: this fires every
      // five seconds while the shelves are full, and the fix takes a walk.
      if (this.saidStalled) return;
      this.saidStalled = true;
      this.bus.emit('toast', {
        kind: 'xp',
        title: structures.length === 1 ? 'A building has nowhere to put what it made'
          : `${structures.length} buildings have nowhere to put what they made`,
        body: 'Nothing is lost — it waits until your bag or a storehouse has room',
      });
    });
    this.bus.on('structure:produced', () => { this.saidStalled = false; });
    this.bus.on('structure:upgraded', ({ name, slots, blurb }) => {
      if (this.panels.isOpen('panel-store')) this.renderStore();
      this.bus.emit('toast', {
        kind: 'achievement',
        title: `Your storehouse is now a ${name.toLowerCase()}`,
        body: `${blurb} ${slots} slots.`,
      });
    });
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
    if (on) this.renderVitals();
    else this.panels.closeAll();
  }

  /**
   * These panels live in the same registry as every other one, so opening and
   * closing goes through it. What stays here is only what is particular to
   * them: what to draw on the way in, and what to forget on the way out.
   */
  populate(id) {
    if (id === 'panel-bag') this.renderBag();
    if (id === 'panel-store') this.renderStore();
    if (id === 'panel-skills') this.renderSkills();
    if (id === 'panel-buildings') this.renderBuildings();
    if (id === 'panel-bench') this.renderBench();
    if (id === 'panel-finish') this.renderFinish();
  }

  onPanelClosed(id) {
    if (id === 'panel-bag') this.held = null;
    if (id === 'panel-building') this.building = null;
    // The open storehouse is forgotten on the way out, so the next one you
    // walk up to cannot be answered with the last one's shelves.
    if (id === 'panel-store') this.store = null;
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

    // A storehouse is worth answering before you open it: how full it is is
    // the question you walked over here to ask.
    const summary = this.duilt?.storeSummary(structure) ?? null;
    const held = summary
      ? `${summary.tier?.name ?? 'Shelves'} · ${summary.items ? `${summary.items} things in ${summary.used} of ${summary.size}` : `empty, ${summary.size} slots`}`
      : null;

    body.innerHTML = `
      <div class="building-state ${structure.valid ? 'good' : 'bad'}">
        ${structure.valid ? 'Standing and producing' : (structure.brokenReason ?? 'Something is missing')}
      </div>
      <div class="building-facts">
        <span>${size} blocks</span>
        ${held ? `<span>${held}</span>` : ''}
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
        ${summary ? '<button class="primary" data-store>Open it</button>' : ''}
        <button class="${summary ? 'secondary' : 'primary'}" data-move>Move it</button>
        <button class="secondary" data-change>${locked ? 'Change it' : 'Done changing'}</button>
        <button class="danger secondary" data-delete>Delete it</button>
      </div>`;

    body.querySelector('[data-store]')?.addEventListener('click', () => actions.onOpenStore?.());
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

  /**
   * The state of the settlement, said out loud.
   *
   * One house reads as "0/0" and looks broken, because from the outside it is
   * indistinguishable from a game that forgot to send anybody. It isn't: the
   * first house is yours and the second is the one that brings somebody, and
   * that rule was only ever written in a hover tooltip. Tapping asks.
   */
  sayPeople() {
    const d = this.duilt;
    if (!d) return;
    const { population, target, houses, hungry } = d.settlers;
    const say = (title, body) => this.bus.emit('toast', { kind: 'xp', title, body });
    if (hungry) {
      return say(hungry === 1 ? 'Somebody has nothing to eat' : `${hungry} people have nothing to eat`,
        'They stop working until there is food — build a farm');
    }
    const reason = d.settlers.blockedReason();
    if (reason) return say(houses ? `${population} living here` : 'Nobody lives here yet', reason);
    say(`${population} of ${target} moved in`,
      population < target ? 'Somebody is on the way' : 'Every house has a household');
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

  /**
   * One slot, drawn the same wherever it is.
   *
   * The bag and a storehouse are two containers of the same kind, and a slot
   * that looked different in one of them would read as a different sort of
   * thing. `attr` is what the click handler keys off, so each grid can tell
   * its own slots apart from the other's.
   */
  slotHtml(s, i, { attr = 'data-slot', held = false, empty = 'Empty slot' } = {}) {
    if (!s) return `<button class="bag-slot empty" ${attr}="${i}" aria-label="${empty} ${i + 1}"></button>`;
    const spec = ITEMS_BY_ID.get(s.id);
    const worn = spec?.durability ? Math.round((1 - s.wear / spec.durability) * 100) : null;
    const colour = `#${(spec?.color ?? 0x888888).toString(16).padStart(6, '0')}`;
    return `
      <button class="bag-slot ${held ? 'held' : ''}" ${attr}="${i}" aria-label="${itemName(s.id)}, ${s.count}">
        <span class="swatch${itemIcon(spec) ? ' swatch-cube' : ''}"${itemIcon(spec) ? '' : ` style="background:${colour}"`}>${
          itemIcon(spec, { size: 34 }) ?? glyphSvg(spec?.glyph, { size: 20, color: spec?.color ?? 0x888888 })}</span>
        ${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}
        ${worn != null ? `<span class="wear"><i style="width:${worn}%"></i></span>` : ''}
      </button>`;
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

    grid.innerHTML = slots
      .map((s, i) => this.slotHtml(s, i, { attr: 'data-slot', held: this.held === i }))
      .join('');

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

  // ---- storehouses ----

  /**
   * Opens a storehouse's shelves.
   *
   * Held is deliberately not shared with the bag screen: lifting a stack in
   * one container and putting it down in another is a different gesture from
   * rearranging one, and one tap doing both is how things end up somewhere
   * you did not mean. Here a tap moves the stack across, full stop.
   */
  showStore(structure) {
    this.store = structure ?? null;
    this.renderStore();
  }

  renderStore() {
    const d = this.duilt;
    const grid = this.q('#store-grid');
    const bagGrid = this.q('#store-bag-grid');
    if (!grid || !bagGrid) return;
    if (!d) { grid.innerHTML = ''; bagGrid.innerHTML = ''; return this.noWorld('#store-grid'); }

    const summary = this.store ? d.storeSummary(this.store) : null;
    if (!summary) {
      grid.innerHTML = `<div class="sub" style="margin:0">Point at a storehouse to open it.</div>`;
      bagGrid.innerHTML = '';
      return;
    }

    grid.innerHTML = summary.store.slots
      .map((s, i) => this.slotHtml(s, i, { attr: 'data-store-slot', empty: 'Empty shelf' }))
      .join('');
    bagGrid.innerHTML = d.inventory.slots
      .map((s, i) => this.slotHtml(s, i, { attr: 'data-bag-slot' }))
      .join('');

    grid.querySelectorAll('[data-store-slot]').forEach((btn) =>
      btn.addEventListener('click', () => this.takeFromStore(Number(btn.dataset.storeSlot))));
    bagGrid.querySelectorAll('[data-bag-slot]').forEach((btn) =>
      btn.addEventListener('click', () => this.putInStore(Number(btn.dataset.bagSlot))));

    const kind = summary.tier?.name ?? 'On the shelves';
    this.q('#store-where').textContent = summary.free
      ? `${kind} — ${summary.free} of ${summary.size} free`
      : `${kind} — full`;

    const next = this.q('#store-next');
    if (next) {
      const up = summary.tier?.next;
      next.hidden = !up;
      if (up) {
        // A list rather than a sentence: three things joined by commas reads
        // as one long clause on a phone, and these are a shopping list.
        next.innerHTML = up.missing.length
          ? `<strong>Build it up to a ${up.name.toLowerCase()} — ${up.slots} slots</strong>
             <ul>${up.missing.map((m) => `<li>${m}</li>`).join('')}</ul>`
          : `<strong>Build it up to a ${up.name.toLowerCase()} — ${up.slots} slots</strong>
             <span>It already qualifies — it will settle there on your next change to it.</span>`;
      }
    }

    const sub = this.q('#store-sub');
    if (sub) {
      sub.textContent = summary.items
        ? 'Tap anything to move it between your bag and the shelves.'
        : 'Nothing in here yet. Tap something in your bag to put it away.';
    }
  }

  putInStore(i) {
    const d = this.duilt;
    const store = this.store && d?.structures.storeFor(this.store);
    if (!store) return;
    const item = d.inventory.slots[i]?.id;
    if (!item) return;
    const moved = d.inventory.moveTo(store, i);
    if (!moved) {
      this.bus.emit('toast', { kind: 'xp', title: 'No room on the shelves', body: 'Take something out first' });
      return;
    }
    this.renderStore();
  }

  takeFromStore(i) {
    const d = this.duilt;
    const store = this.store && d?.structures.storeFor(this.store);
    if (!store?.slots[i]) return;
    const moved = store.moveTo(d.inventory, i);
    if (!moved) {
      this.bus.emit('toast', { kind: 'xp', title: 'Your bag is full', body: 'Put something on the shelves first' });
      return;
    }
    this.renderStore();
  }

  /**
   * Everything but your tools, onto the shelves.
   *
   * Tools stay because walking away from your own axe is never what you meant,
   * and it is the one thing you would have to notice and undo by hand.
   */
  storeEverything() {
    const d = this.duilt;
    const store = this.store && d?.structures.storeFor(this.store);
    if (!store) return;
    let moved = 0, stuck = 0;
    d.inventory.slots.forEach((s, i) => {
      if (!s || isTool(s.id)) return;
      const n = d.inventory.moveTo(store, i);
      if (n) moved += n; else stuck++;
    });
    this.renderStore();
    this.bus.emit('toast', moved
      ? { kind: 'xp', title: `Put ${moved} away`, body: stuck ? 'The shelves filled up before the rest' : 'Your tools stayed with you' }
      : { kind: 'xp', title: 'Nothing moved', body: stuck ? 'The shelves are full' : 'Only your tools are left' });
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
    // What you are pointing at, if it is a build — so the list can say which of
    // these you could claim right now rather than listing them all blankly.
    const build = this.game.buildUnderCrosshair?.();
    const region = build ? { ...build.bounds } : null;
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
            ${!region ? '<span>Point at something you built to claim it.</span>' : ''}
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
            <!--
              Never disabled. A dead button eats the tap and says nothing, so
              pressing one you cannot afford felt like the game was broken —
              the reason was on screen the whole time, in small grey type under
              a row you had already given up on. Press it and it tells you.
            -->
            <button class="secondary${r.ok ? '' : ' cannot'}" data-craft="${r.id}" data-times="1">Make</button>
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
