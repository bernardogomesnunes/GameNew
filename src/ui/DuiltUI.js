import { ITEMS_BY_ID, itemName, stackLimit, isTool, isFood } from '../config/items.js';
import { PLAYABLE_SLOTS } from '../items/Inventory.js';
import { penProduce } from '../duilt/Ranch.js';
import { STRUCTURES, STRUCTURES_BY_ID, structuresForAge, PRODUCIBLE_ITEMS, producesAt, intervalAt } from '../config/structures.js';
import { howToGet } from '../config/recipes.js';
import { DESIGN_FOR_STRUCTURE } from '../config/starterDesigns.js';
import { MAX_HUNGER } from '../survival/Hunger.js';
import { glyphSvg } from '../config/glyphs.js';
import { itemIcon } from '../config/cubes.js';
import { renderPanels } from './Panel.js';
import { icon } from './icons.js';

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

/**
 * "a" or "an" in front of a tier name, without doubling one it already
 * carries. A quarry's tier names spell out their own article ("A Working
 * Face") so "Next level: A Working Face" reads as a phrase; a storehouse's
 * don't ("Loft"), so the same sentence needs one supplied. Lowercased first
 * since every place this is used is mid-sentence.
 */
function withArticle(name) {
  const lower = name.toLowerCase();
  return /^an? /.test(lower) ? lower : `a ${lower}`;
}

/**
 * A production rate as a line you can read, or null for nothing produced.
 *
 * Most cycles are a minute or two, where restating the raw per-cycle number
 * under "a minute" is close enough to be honest; a cycle longer than that —
 * a quarry's first level, cut back to barely anything on purpose — reads by
 * the day instead, converted for real rather than relabelled, so "10 a day"
 * actually means ten a day.
 */
function rateText(produces, everySeconds) {
  if (!produces || !Object.keys(produces).length || !everySeconds) return null;
  const daily = everySeconds > 300;
  const makes = Object.entries(produces)
    .map(([k, v]) => `${daily ? Math.round(v * 86400 / everySeconds) : v} ${itemName(k).toLowerCase()}`)
    .join(', ');
  return `Makes ${makes} a ${daily ? 'day' : 'minute'}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
const escapeAttr = escapeHtml;

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
      <div id="hurt-flash" aria-hidden="true"></div>
      <div id="vitals" hidden>
        <!-- Ten hearts, in halves — see survival/Health.js. Not in Creative. -->
        <div class="vital vital-hearts" id="vital-health" title="Health"></div>
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
          <!--
            Two zones of the one bag, not two containers — moving between
            them is the same lift/tap gesture as rearranging either one on
            its own (renderBag/tapSlot), just able to land on either side.
            Equipped is what the hotbar actually shows; see
            Inventory.PLAYABLE_SLOTS and UIManager.buildHotbar.
          -->
          <div class="bag-section-head">Equipped <span class="sub">— what the hotbar shows, in order</span></div>
          <div id="bag-hotbar-grid" class="bag-hotbar-grid"></div>
          <div class="bag-section-head">Your bag</div>
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
          <!--
            What this shed refuses to take from a building's own payout, so one
            fast producer stops crowding the rest out of it. Manual moves are
            never blocked — this only steers deliver(), see StructureRegistry.
          -->
          <div id="store-routing" class="store-routing" hidden>
            <span class="store-routing-label">Won't take from deliveries:</span>
            <div id="store-routing-chips" class="store-routing-chips"></div>
          </div>
          <div class="store-head"><span>Equipped</span></div>
          <div id="store-hotbar-grid"></div>
          <div class="store-head"><span>In your bag</span></div>
          <div id="store-bag-grid"></div>`,
        'panel-claim': `
          <div id="claim-list"></div>`,
        'panel-buildings': `
          <!--
            Two ways in, because a claim is either something you stacked up or
            something you dug. "Claim what I framed" follows the wall you are
            pointing at for its footprint and lets you set the height yourself,
            growing up from the block you're on — the one you actually stand at
            while building. "Claim an area" draws a footprint from two corners
            instead and reads its own height off whatever is there, which is
            the only thing that works for a hole: a quarry has no wall to point
            at, and the fill will not go below the ground it started at.
          -->
          <button class="secondary claim-column" id="btn-claim-column">Claim what I framed</button>
          <div class="export-note">Point at a wall you built. Scroll to set how tall, then press Break.</div>
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
    this.q('#btn-claim-column').addEventListener('click', () => this.game.beginClaimColumn());
    this.q('#btn-claim-area').addEventListener('click', () => this.game.beginClaimSelection());
    this.q('#btn-store-all').addEventListener('click', () => this.storeEverything());
    this.wireSlotTip();

    this.bus.on('inventory:change', () => {
      this.renderBag();
      this.renderVitals();
      // A storehouse is an Inventory too, so its own changes come through
      // here — and so does the bag half of the store screen.
      if (this.panels.isOpen('panel-store')) this.renderStore();
      this.onBagChanged?.();
    });
    this.bus.on('hunger:change', () => this.renderVitals());
    this.bus.on('health:change', ({ hurt }) => {
      this.renderHealth();
      if (hurt) this.flashHurt(false);
    });
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
    // Fired by StructureRegistry.evolve (a level reached by pressing the
    // button, not the instant the blocks qualified) and by retier's own
    // automatic drop the other way, if an edit costs a building the rung it
    // was standing on. `name`/`slots` used to always mean a storehouse's own
    // words — evolve fires for a producer's level too now, so this reads
    // the actual building's name instead of assuming one.
    this.bus.on('structure:upgraded', ({ structure, name, slots, blurb }) => {
      if (this.panels.isOpen('panel-store')) this.renderStore();
      if (this.building?.id === structure?.id) this.showBuilding(structure, this.buildingActionsCache);
      const kind = STRUCTURES_BY_ID.get(structure?.type)?.name?.toLowerCase() ?? 'building';
      this.bus.emit('toast', {
        kind: 'achievement',
        title: `Your ${kind} is now ${withArticle(name)}`,
        body: slots ? `${blurb} ${slots} slots.` : blurb,
      });
    });
    this.bus.on('structure:downgraded', ({ structure, name, blurb }) => {
      if (this.panels.isOpen('panel-store')) this.renderStore();
      if (this.building?.id === structure?.id) this.showBuilding(structure, this.buildingActionsCache);
      const kind = STRUCTURES_BY_ID.get(structure?.type)?.name?.toLowerCase() ?? 'building';
      this.bus.emit('toast', {
        kind: 'xp',
        title: `Your ${kind} dropped back to ${withArticle(name)}`,
        body: `${blurb} Build it back up to reach the next level again.`,
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
    this.hideSlotTip();
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
    // Kept so an event that changes this exact building (evolving it,
    // losing a level) can redraw the open panel with the same handlers
    // rather than needing Game.js's action factory reached from here.
    this.buildingActionsCache = actions;
    const spec = STRUCTURES_BY_ID.get(structure.type);
    const body = this.q('#building-body');
    const sub = this.q('#building-sub');
    if (!body) return;

    const r = structure.region;
    const size = `${r.maxX - r.minX + 1} × ${r.maxZ - r.minZ + 1} × ${r.maxY - r.minY + 1}`;
    const locked = structure.locked !== false;
    if (sub) sub.textContent = spec?.name ?? 'A building you claimed';

    // Reported directly: "on the buildings manage pop ups, we should not be
    // throwing [filler] text there, we should say what it produces, and
    // what's needed to evolve the building." So: what it does, what the next
    // level needs, and the buttons. Nothing else.
    const summary = this.duilt?.storeSummary(structure) ?? null;
    const level = this.duilt?.levelSummary(structure) ?? null;
    const does = this.buildingDoes(structure, spec, level, summary);
    const next = level?.next;
    const evolve = !level ? ''
      : !next
        ? `<p>${level.name} is its top level.</p>`
        : `
        <p><strong>${level.canEvolve ? `Ready to evolve to ${next.name}` : `To evolve to ${next.name}`}</strong></p>
        ${level.canEvolve ? '' : next.missing?.length ? `<ul>${next.missing.map((m) => `<li>${m}</li>`).join('')}</ul>` : ''}
        ${next.rate ? `<p class="dim">Then: ${rateText(next.rate.produces, next.rate.everySeconds)}</p>` : ''}`;

    body.innerHTML = `
      <div class="building-state ${structure.valid ? 'good' : 'bad'}">
        ${structure.valid ? 'Working' : `Stopped: ${structure.brokenReason ?? 'something it needs is missing'}`}
      </div>
      <div class="building-sec">
        <h4>What it does</h4>
        <ul>${does.map((d) => `<li>${d}</li>`).join('')}</ul>
      </div>
      ${level ? `<div class="building-sec"><h4>Level: ${level.name}</h4>${evolve}</div>` : ''}
      <div class="building-facts">
        <span>${size} blocks</span>
        <span>${locked ? 'Locked' : 'Open for changes'}</span>
      </div>
      <div class="building-actions">
        ${level?.canEvolve ? `<button class="primary" data-evolve>Evolve to ${withArticle(next.name)}</button>` : ''}
        ${summary ? `<button class="${level?.canEvolve ? 'secondary' : 'primary'}" data-store>Open it</button>` : ''}
        <button class="${summary || level?.canEvolve ? 'secondary' : 'primary'}" data-move>Move it</button>
        <button class="secondary" data-change>${locked ? 'Change it' : 'Done changing'}</button>
        <button class="danger secondary" data-delete>Delete it</button>
      </div>`;

    body.querySelector('[data-evolve]')?.addEventListener('click', () => actions.onEvolve?.());
    body.querySelector('[data-store]')?.addEventListener('click', () => actions.onOpenStore?.());
    body.querySelector('[data-move]').addEventListener('click', () => actions.onMove?.());
    body.querySelector('[data-change]').addEventListener('click', () => actions.onChange?.());
    body.querySelector('[data-delete]').addEventListener('click', () => {
      if (confirm(`Delete this ${spec?.name?.toLowerCase() ?? 'building'}? `
        + 'The blocks come back to your bag.')) actions.onDelete?.();
    });
  }

  /** What a building gives you, one plain line per thing. */
  buildingDoes(structure, spec, level, summary) {
    const out = [];
    const rate = spec?.fromCrops ? null : level?.rate ?? (spec && Object.keys(spec.produces ?? {}).length
      ? { produces: spec.produces, everySeconds: spec.everySeconds } : null);
    const made = rate && rateText(rate.produces, rate.everySeconds);
    if (made) out.push(made);
    if (spec?.fromCrops) {
      const grown = this.duilt?.producesFor(structure) ?? {};
      out.push(rateText(grown, spec.everySeconds) ?? 'Makes whatever is planted in it — nothing planted yet');
    }
    if (spec?.fromAnimals) {
      const kept = penProduce(structure, this.duilt?.herd ?? []);
      const pen = rateText(kept, spec.everySeconds);
      out.push(pen ?? 'Makes wool, milk or eggs from the animals kept in it — none in it yet');
    }
    if (spec?.grantsCapacity) out.push(`Room for ${spec.grantsCapacity} settler household${spec.grantsCapacity > 1 ? 's' : ''}`);
    if (spec?.station) out.push(`Lets you craft ${spec.station} recipes while you're near it`);
    if (summary) {
      out.push(`Stores your things: ${summary.items ? `${summary.items} in ${summary.used} of ${summary.size} slots` : `empty, ${summary.size} slots`}`);
    }
    if (!out.length) out.push('Nothing to collect — it counts towards your age goals');
    return out;
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

  /** Ten hearts: full, half or empty. Hidden in Creative, where nothing hurts. */
  renderHealth() {
    const d = this.duilt;
    const box = this.q('#vital-health');
    if (!d || !box) return;
    box.hidden = !!d.sandbox;
    if (box.hidden) return;
    const v = d.health.value;
    const heart = (fill) => `<span class="heart ${fill}"><svg viewBox="0 0 24 24"><path d="M12 20.5s-7.4-4.5-9.4-9C1.1 8.2 3.1 4.5 6.7 4.5c2.2 0 3.7 1.2 5.3 3.1 1.6-1.9 3.1-3.1 5.3-3.1 3.6 0 5.6 3.7 4.1 7-2 4.5-9.4 9-9.4 9Z"/></svg>`
      + `<span class="heart-red"><svg viewBox="0 0 24 24"><path d="M12 20.5s-7.4-4.5-9.4-9C1.1 8.2 3.1 4.5 6.7 4.5c2.2 0 3.7 1.2 5.3 3.1 1.6-1.9 3.1-3.1 5.3-3.1 3.6 0 5.6 3.7 4.1 7-2 4.5-9.4 9-9.4 9Z"/></svg></span></span>`;
    box.innerHTML = Array.from({ length: 10 }, (_, i) => heart(v >= 2 * (i + 1) ? 'full' : v === 2 * i + 1 ? 'half' : 'empty')).join('');
    box.classList.toggle('low', v <= 6);
    box.title = `Health: ${v / 2} of 10 hearts`;
  }

  /** A red flash at the edges of the screen when you're hurt — stronger when you die. */
  flashHurt(strong = false) {
    const el = this.q('#hurt-flash');
    if (!el) return;
    el.classList.remove('on', 'strong');
    void el.offsetWidth; // restart the fade
    el.classList.add('on');
    if (strong) el.classList.add('strong');
  }

  renderVitals() {
    const d = this.duilt;
    if (!d) return;
    this.renderHealth();
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
  slotHtml(s, i, { attr = 'data-slot', held = false, empty = 'Empty slot', discardAttr = null } = {}) {
    if (!s) return `<button class="bag-slot empty" ${attr}="${i}" aria-label="${empty} ${i + 1}"></button>`;
    const spec = ITEMS_BY_ID.get(s.id);
    const worn = spec?.durability ? Math.round((1 - s.wear / spec.durability) * 100) : null;
    const colour = `#${(spec?.color ?? 0x888888).toString(16).padStart(6, '0')}`;
    const button = `
      <button class="bag-slot ${held ? 'held' : ''}" ${attr}="${i}" aria-label="${itemName(s.id)}, ${s.count}" data-tip="${escapeAttr(itemName(s.id))}" data-tip-info="${escapeAttr(this.itemBits(s, spec).join(' · '))}">
        <span class="swatch${itemIcon(spec) ? ' swatch-cube' : ''}"${itemIcon(spec) ? '' : ` style="background:${colour}"`}>${
          itemIcon(spec, { size: 34 }) ?? glyphSvg(spec?.glyph, { size: 20, color: spec?.color ?? 0x888888 })}</span>
        ${s.count > 1 ? `<span class="count">${s.count}</span>` : ''}
        ${worn != null ? `<span class="wear"><i style="width:${worn}%"></i></span>` : ''}
      </button>`;
    // A sibling button, not nested inside the slot — a button inside a button
    // is invalid markup, and this one needs its own click that the slot's
    // lift/drop never sees.
    if (!discardAttr) return button;
    return `
      <div class="bag-slot-wrap">
        ${button}
        <button class="slot-discard" ${discardAttr}="${i}" title="Throw away" aria-label="Throw away ${itemName(s.id)}">${icon('close')}</button>
      </div>`;
  }

  /**
   * Two grids over one inventory, not two containers — the split is purely
   * where PLAYABLE_SLOTS falls in `d.inventory.slots`, so lifting from one
   * grid and dropping in the other is the exact same `inv.move(from, to)`
   * that already reorders either grid on its own. `data-slot` always carries
   * the real, absolute index into the one array, whichever grid drew it.
   *
   * Reported directly: the hotbar used to fill itself from the bag with
   * nothing to press and nothing to arrange. This is that arranging —
   * Equipped is read straight off by UIManager.buildHotbar, so dragging an
   * item up here is what puts it in the hotbar, and dragging it back down is
   * what takes it out.
   */
  renderBag() {
    const d = this.duilt;
    if (!d) {
      const hg = this.q('#bag-hotbar-grid');
      const g = this.q('#bag-grid');
      if (hg) hg.innerHTML = '';
      if (g) g.innerHTML = '';
      return this.noWorld('#bag-detail');
    }
    const hotbarGrid = this.q('#bag-hotbar-grid');
    const grid = this.q('#bag-grid');
    if (!grid || !hotbarGrid) return;
    const slots = d.inventory.slots;
    // Nothing is thrown away from a creative bag — see Inventory's `endless`.
    const bin = d.inventory.endless ? null : 'data-discard';
    const slotHtml = (s, i) => this.slotHtml(s, i, { attr: 'data-slot', held: this.held === i, discardAttr: bin });

    hotbarGrid.innerHTML = slots.slice(0, PLAYABLE_SLOTS).map(slotHtml).join('');
    grid.innerHTML = slots.slice(PLAYABLE_SLOTS).map((s, j) => slotHtml(s, j + PLAYABLE_SLOTS)).join('');

    for (const g of [hotbarGrid, grid]) {
      g.querySelectorAll('[data-slot]').forEach((btn) => this.bindSlot(btn));
      g.querySelectorAll('[data-discard]').forEach((btn) =>
        btn.addEventListener('click', (e) => { e.stopPropagation(); this.discardSlot(Number(btn.dataset.discard)); }));
    }
    this.q('#bag-sub').textContent = this.held != null
      ? `Holding ${itemName(slots[this.held]?.id ?? '')} — tap a slot to put it down.`
      : 'Tap an item to lift it, tap a slot to put it down. Hold to split a stack.';
    this.renderDetail();
    this.refreshSlotTip();
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

  /**
   * The trash icon on a slot — thrown out on the spot, no lift-and-drop
   * needed. Reported directly: with how fast the bag fills up, every slot
   * eventually has *something* in it, and there was no way to clear space
   * except crafting it away or handing it to a storehouse that is also full.
   */
  discardSlot(i) {
    const inv = this.duilt?.inventory;
    if (!inv) return;
    const gone = inv.discard(i);
    if (!gone) return;
    if (this.held === i) this.held = null;
    this.bus.emit('toast', { kind: 'xp', title: `Threw away ${gone.count > 1 ? `${gone.count} ` : ''}${itemName(gone.id).toLowerCase()}` });
    this.renderBag();
  }

  /**
   * The same handful of facts about a slot — what it stacks to, where it
   * comes from, what's left of it — wherever they're read: the bag's own
   * detail box below the grid, and slotTooltip's hover card on the slot
   * itself.
   */
  itemBits(s, spec) {
    const bits = [`Stacks to ${stackLimit(s.id)}`];
    if (spec?.madeBy) bits.push(spec.madeBy);
    if (isTool(s.id) && spec?.durability) bits.push(`${spec.durability - s.wear} uses left`);
    if (isFood(s.id)) bits.push(`Restores ${spec.feeds} hunger`);
    return bits;
  }

  /**
   * The name-and-what-it-does card over whichever slot the mouse is on.
   *
   * This was a native `title` first, and it didn't work in play: the browser
   * waits a second or more of perfect stillness before showing one, and the
   * bag re-renders its whole grid on every inventory change (a building
   * producing, a stack landing), which throws the hovered button away and
   * resets that wait — so in a live world it effectively never appeared.
   * This card shows at once, is delegated from the panel root so it needs no
   * per-button wiring, and re-finds its slot by index after a re-render.
   */
  wireSlotTip() {
    const tip = document.createElement('div');
    tip.className = 'slot-tip';
    tip.hidden = true;
    tip.setAttribute('role', 'tooltip');
    this.root.appendChild(tip);
    this.tip = tip;
    this.tipAt = null; // { attr, index } of the hovered slot

    this.el.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      const btn = e.target.closest?.('.bag-slot[data-tip]');
      if (btn) this.showSlotTip(btn);
    });
    this.el.addEventListener('pointerout', (e) => {
      const btn = e.target.closest?.('.bag-slot[data-tip]');
      if (btn && !btn.contains(e.relatedTarget)) this.hideSlotTip();
    });
    this.el.addEventListener('scroll', () => this.hideSlotTip(), true);
  }

  showSlotTip(btn) {
    const attr = ['data-slot', 'data-store-slot', 'data-bag-slot'].find((a) => btn.hasAttribute(a));
    this.tipAt = { attr, index: btn.getAttribute(attr) };
    const info = btn.dataset.tipInfo;
    this.tip.innerHTML = `<strong>${escapeHtml(btn.dataset.tip)}</strong>${info ? `<span>${escapeHtml(info)}</span>` : ''}`;
    this.tip.hidden = false;
    const r = btn.getBoundingClientRect();
    const t = this.tip.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - t.width - 8, r.left + r.width / 2 - t.width / 2));
    const top = r.top - t.height - 8 >= 8 ? r.top - t.height - 8 : r.bottom + 8;
    this.tip.style.left = `${left}px`;
    this.tip.style.top = `${top}px`;
  }

  hideSlotTip() {
    this.tipAt = null;
    if (this.tip) this.tip.hidden = true;
  }

  /** After a grid re-render, points the card at the new button for the same slot. */
  refreshSlotTip() {
    if (!this.tipAt) return;
    const { attr, index } = this.tipAt;
    const btn = this.el.querySelector(`.bag-slot[${attr}="${index}"]`);
    if (btn?.dataset.tip && btn.offsetParent) this.showSlotTip(btn);
    else this.hideSlotTip();
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
    box.innerHTML = `
      <div class="bag-detail-row">
        <strong>${itemName(slot.id)}</strong>
        <span>${slot.count}</span>
      </div>
      <div class="sub" style="margin:4px 0 0">${this.itemBits(slot, spec).join(' · ')}</div>`;
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
    const hotbarGrid = this.q('#store-hotbar-grid');
    const bagGrid = this.q('#store-bag-grid');
    if (!grid || !hotbarGrid || !bagGrid) return;
    if (!d) { grid.innerHTML = ''; hotbarGrid.innerHTML = ''; bagGrid.innerHTML = ''; return this.noWorld('#store-grid'); }

    const summary = this.store ? d.storeSummary(this.store) : null;
    if (!summary) {
      grid.innerHTML = `<div class="sub" style="margin:0">Point at a storehouse to open it.</div>`;
      hotbarGrid.innerHTML = '';
      bagGrid.innerHTML = '';
      return;
    }

    grid.innerHTML = summary.store.slots
      .map((s, i) => this.slotHtml(s, i, { attr: 'data-store-slot', empty: 'Empty shelf' }))
      .join('');
    // Equipped and bag, same split as the bag panel's own two grids — see
    // renderBag. Both tap straight into the store, same as any bag slot
    // always could; reordering equipped-vs-bag stays the bag panel's job.
    hotbarGrid.innerHTML = d.inventory.slots.slice(0, PLAYABLE_SLOTS)
      .map((s, i) => this.slotHtml(s, i, { attr: 'data-bag-slot' }))
      .join('');
    bagGrid.innerHTML = d.inventory.slots.slice(PLAYABLE_SLOTS)
      .map((s, i) => this.slotHtml(s, i + PLAYABLE_SLOTS, { attr: 'data-bag-slot' }))
      .join('');

    grid.querySelectorAll('[data-store-slot]').forEach((btn) =>
      btn.addEventListener('click', () => this.takeFromStore(Number(btn.dataset.storeSlot))));
    for (const g of [hotbarGrid, bagGrid]) {
      g.querySelectorAll('[data-bag-slot]').forEach((btn) =>
        btn.addEventListener('click', () => this.putInStore(Number(btn.dataset.bagSlot))));
    }
    this.refreshSlotTip();

    const all = this.q('#btn-store-all');
    if (all) all.hidden = !!summary.grave;
    const title = this.q('#store-title');
    if (title) title.textContent = summary.chest ? (summary.grave ? 'What you were carrying' : 'Chest') : 'Storehouse';

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
      sub.textContent = summary.grave
        ? 'Tap anything to take it back. The chest goes once it is empty.'
        : summary.items
          ? `Tap anything to move it between your bag and the ${summary.chest ? 'chest' : 'shelves'}.`
          : 'Nothing in here yet. Tap something in your bag to put it away.';
    }

    this.renderStoreRouting(summary);
  }

  /**
   * The chip row that decides what a shed's own deliveries skip.
   *
   * One chip per item any building anywhere can produce — see
   * config/structures.js's PRODUCIBLE_ITEMS — so a new building's output is
   * routable the moment it exists, with nothing to add here. Hidden when
   * nothing is produced yet, which today is never, but costs nothing to guard.
   */
  renderStoreRouting(summary) {
    const box = this.q('#store-routing');
    const chips = this.q('#store-routing-chips');
    if (!box || !chips) return;
    // A chest takes nothing from deliveries — only what you put in it.
    if (summary.chest) { box.hidden = true; return; }
    if (!PRODUCIBLE_ITEMS.length) { box.hidden = true; return; }
    box.hidden = false;

    const excludes = new Set(summary.structure.excludes ?? []);
    chips.innerHTML = PRODUCIBLE_ITEMS.map((id) => {
      const spec = ITEMS_BY_ID.get(id);
      const off = excludes.has(id);
      return `
        <button class="routing-chip ${off ? 'off' : ''}" data-route="${id}"
          aria-pressed="${off}" title="${off ? `Won't take ${itemName(id)}` : `Takes ${itemName(id)}`}">
          ${glyphSvg(spec?.glyph, { size: 15, color: spec?.color ?? 0x888888 })}
          <span>${itemName(id)}</span>
        </button>`;
    }).join('');

    chips.querySelectorAll('[data-route]').forEach((btn) => btn.addEventListener('click', () => {
      const d = this.duilt;
      if (!d || !this.store) return;
      d.structures.toggleExclude(this.store.id, btn.dataset.route);
      this.renderStore();
    }));
  }

  putInStore(i) {
    const d = this.duilt;
    const store = this.store && d?.containerFor(this.store);
    if (!store) return;
    const item = d.inventory.slots[i]?.id;
    if (!item) return;
    // The chest you fell by only gives back — it isn't a place to keep things.
    if (this.store.chest && d.chestAt(this.store.chest.x, this.store.chest.y, this.store.chest.z)?.grave) return;
    const moved = d.inventory.moveTo(store, i);
    if (!moved) {
      this.bus.emit('toast', { kind: 'xp', title: this.store.chest ? 'The chest is full' : 'No room on the shelves', body: 'Take something out first' });
      return;
    }
    this.renderStore();
  }

  takeFromStore(i) {
    const d = this.duilt;
    const store = this.store && d?.containerFor(this.store);
    if (!store?.slots[i]) return;
    const moved = store.moveTo(d.inventory, i);
    if (!moved) {
      this.bus.emit('toast', { kind: 'xp', title: 'Your bag is full', body: 'Put something away first' });
      return;
    }
    // Emptied, the chest you fell by is gone.
    const c = this.store.chest;
    if (c && d.chestAt(c.x, c.y, c.z)?.grave && d.chestEmpty(c.x, c.y, c.z)) {
      this.game.clearGrave?.(c);
      this.closePanel('panel-store');
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
    const store = this.store && d?.containerFor(this.store);
    if (!store) return;
    if (this.store.chest && d.chestAt(this.store.chest.x, this.store.chest.y, this.store.chest.z)?.grave) return;
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

  openClaim(region, onClaim, { first = null } = {}) {
    const d = this.duilt;
    if (!d || !region) return;
    const list = this.q('#claim-list');
    // A placed design that's still waiting: what it's meant to be comes
    // first, with what it's waiting for, rather than halfway down the list.
    const options = d.claimOptionsFor(region)
      .sort((a, b) => (b.id === first) - (a.id === first));
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

    // Every structure there is, in a sandbox — no age to gate them behind,
    // same as claimOptionsFor. And nothing to ever be short of: a sandbox
    // bag holds one of everything and a starter design's cost never actually
    // gets charged (see DuiltGame.starterPlacement), so the button that
    // offers to stamp one has nothing to disable.
    const offered = d.sandbox ? STRUCTURES : structuresForAge(d.age);
    this.q('#buildings-list').innerHTML = offered.map((spec) => {
      const built = d.structures.countOf(spec.id);
      const design = DESIGN_FOR_STRUCTURE.get(spec.id);
      const canStamp = design && (d.sandbox || d.inventory.hasAll(design.cost));
      const shortfall = design && !d.sandbox ? d.inventory.missing(design.cost) : {};
      // The full bill, not just what you're short — a shortfall note only ever
      // said "4 more turned soil" and never the 16 it actually takes, so the
      // only way to know the real cost was to try, fail, and do the subtraction
      // yourself.
      const costLine = design
        ? Object.entries(design.cost).map(([id, n]) => `${n} ${itemName(id).toLowerCase()}`).join(', ')
        : null;

      // The requirement ids used to get their own "Needs: trunks · canopy ·
      // soil" line here — internal names nothing else in the game ever
      // explains, on every card whether or not you were about to build by
      // hand. Building by hand still gets the real, readable version of
      // each one ("Needs 2 more dirt") the moment you try — see openClaim —
      // so this was noise repeated on every card rather than information.
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
            <span>${this.whatItGivesYou(spec)}</span>
            ${costLine ? `<span>Costs: ${costLine}</span>` : ''}
          </div>
          ${design ? `
          <div class="building-actions">
            <button class="secondary" data-stamp="${spec.id}" ${canStamp ? '' : 'disabled'}>
              Place a ${design.footprint} starter
            </button>
          </div>
          <div class="building-note">
            ${!canStamp ? this.shortfallNote(shortfall) : `
              ${design.note ? `<span>${design.note}</span>` : ''}
              <span>Aim where you want it and press Place.</span>
            `}
          </div>` : ''}
        </div>`;
    }).join('');

    this.q('#buildings-list').querySelectorAll('[data-stamp]').forEach((b) =>
      b.addEventListener('click', () => {
        this.closePanel('panel-buildings');
        this.onStampStarter?.(b.dataset.stamp);
      }));
  }

  /**
   * The one line saying why you would want this building.
   *
   * Most of them produce something on a timer and that is the answer, read
   * off its first level (see config/structures.js's producesAt/intervalAt —
   * a level beyond the first is something the catalogue card doesn't know
   * about yet). The ones that produce nothing each have their own reason,
   * and "Houses settlers, later on" — what every non-producer used to say —
   * is true of exactly one.
   */
  whatItGivesYou(spec) {
    const rate = rateText(producesAt(spec, 0), intervalAt(spec, 0));
    if (rate) return rate;
    if (spec.station === 'workshop') return 'Lets you make things here that your hands cannot';
    if (spec.station === 'foundry') return 'Lets you smelt ore into something a recipe wants';
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
