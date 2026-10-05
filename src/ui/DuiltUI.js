import { ITEMS_BY_ID, itemName, stackLimit, isTool, isFood } from '../config/items.js';
import { BOOSTS, clockOf } from '../config/drinks.js';
import { FINAL_AGE } from '../config/ages.js';
import { askConfirm } from './Confirm.js';
import { PLAYABLE_SLOTS } from '../items/Inventory.js';
import { penProduce } from '../duilt/Ranch.js';
import { FARM_SEED_SLOTS } from '../duilt/Crops.js';
import { CROPS } from '../config/crops.js';
import { STRUCTURES, STRUCTURES_BY_ID, structuresForAge, PRODUCIBLE_ITEMS, producesAt, intervalAt, PRODUCTION_PACE } from '../config/structures.js';
import { howToGet, RECIPES } from '../config/recipes.js';
import { DESIGN_FOR_STRUCTURE } from '../config/starterDesigns.js';
import { MAX_HUNGER } from '../survival/Hunger.js';
import { WEAR_SLOTS, SLOT_NAMES, ARMOUR_PER_POINT } from '../config/armour.js';
import { glyphSvg } from '../config/glyphs.js';
import { itemIcon } from '../config/cubes.js';
import { renderPanels } from './Panel.js';
import { TRADERS_BY_ID } from '../config/traders.js';
import { icon } from './icons.js';
import { pixelIcon } from './pixelIcons.js';

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
/**
 * One item and how many, as its icon and a number — a building's cost, a
 * recipe's ingredients and what it makes. Asked for directly: "can we have a
 * on click mobile and hover desktop for the recipes of buildings? Also bench
 * should have the icons for the items". The name and what you have against
 * it ride along as the same card the bag shows (wireSlotTip): hovered with a
 * mouse, tapped on a phone.
 *
 *   have   how many you hold, or null to leave it unsaid (what a recipe makes)
 */
function itemChip(id, n, { have = null, short = false } = {}) {
  const spec = ITEMS_BY_ID.get(id);
  const icon = itemIcon(spec, { size: 22 }) ?? glyphSvg(spec?.glyph, { size: 16, color: spec?.color });
  const name = itemName(id);
  const bits = [];
  if (have != null) bits.push(`You have ${have}`);
  if (short) {
    const from = howToGet(id, spec?.block != null ? name : null);
    if (from) bits.push(from);
  }
  return `<span class="cost-chip${short ? ' short' : ''}" role="button" tabindex="0" aria-label="${escapeAttr(`${n} ${name}`)}"`
    + ` data-tip="${escapeAttr(name)}" data-tip-info="${escapeAttr(bits.join('. '))}">${icon}<b>${n}</b></span>`;
}

function rateText(produces, everySeconds) {
  if (!produces || !Object.keys(produces).length || !everySeconds) return null;
  const daily = everySeconds > 300;
  const makes = Object.entries(produces)
    // Per game day, at the pace buildings actually work (PRODUCTION_PACE).
    .map(([k, v]) => `${daily ? Math.max(1, Math.round(v * PRODUCTION_PACE * 86400 / everySeconds)) : v} ${itemName(k).toLowerCase()}`)
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
    // The game's own yes/no, never the browser's (ui/Confirm.js).
    this.confirm = (opts) => askConfirm(root, opts);
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
        <!-- Drinks going (playtest, P5): one chip each, counting down. -->
        <div class="vital vital-boosts" id="vital-boosts" hidden></div>
        <button class="vital-eat" id="btn-eat" hidden>Eat</button>
        <!--
          Population sits beside hunger because it is the same kind of fact:
          how the settlement is doing, not what you are carrying. It says beds
          as well as people, and it is a button, because "0/0" is a number and
          not an answer — the answer used to be a title attribute, which is a
          hover on a desktop and nothing whatsoever on a phone.
        -->
        <!-- Your army, on the dark path: how many, what they're doing, and
             a tap for the command wheel — follow, hold, attack, a line. -->
        <button type="button" class="vital" id="vital-army" title="Your army" hidden>
          <span class="vital-icon">⚔</span>
          <span class="vital-count" id="army-count">0</span>
          <span class="army-mode" id="army-mode"></span>
        </button>
        <!-- In disguise on the Sky Kingdom (duilt/Suspicion.js): how near you
             are to being seen through, and what's giving you away. Its own
             meter, never a toast (asked for directly). -->
        <div class="vital" id="vital-suspicion" title="Suspicion" hidden>
          <span class="vital-icon">👁</span>
          <span class="sus-bar"><span class="sus-fill" id="sus-fill"></span></span>
          <span class="sus-reason" id="sus-reason"></span>
        </div>
        <div id="army-wheel" hidden>
          <button type="button" data-army="follow">Follow</button>
          <button type="button" data-army="hold">Hold here</button>
          <button type="button" data-army="attack">Attack</button>
          <button type="button" data-army="line">Form a line</button>
        </div>
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
          <!--
            What you're wearing (Phase 7b): head, body, legs and a ring.
            The same lift-and-drop as the bag — lift a piece, tap its place
            to put it on; tap something you're wearing to take it off.
          -->
          <!--
            Your skills, always in sight (backlog batch 2: "bring the skills
            back — foraging and the rest seem to have disappeared from view").
            Tap the row for the whole of each.
          -->
          <button class="bag-skills" id="bag-skills" hidden></button>
          <div class="bag-section-head">Wearing <span class="sub" id="armour-sum"></span></div>
          <div id="bag-wear-grid" class="bag-wear-grid"></div>
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
        'panel-stores': `
          <!--
            The storage controller: every storehouse's shelves as one list,
            searched like the bench is. A tap takes a stack into the bag from
            wherever it is kept; nobody needs to know which shed.
          -->
          <div class="store-head">
            <span id="stores-where"></span>
            <button class="secondary" id="btn-stores-all">Put it all away</button>
          </div>
          <input id="stores-search" class="panel-search" type="search" placeholder="Search — planks, iron, seeds…" autocomplete="off" enterkeyhint="search">
          <div id="stores-list" class="recipe-grid"></div>`,
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
          <input id="buildings-search" class="panel-search" type="search" placeholder="Search — a farm, stone, settlers…" autocomplete="off" enterkeyhint="search">
          <div id="buildings-list"></div>`,
        'panel-bench': `
          <input id="bench-search" class="panel-search" type="search" placeholder="Search — an axe, planks, stone…" autocomplete="off" enterkeyhint="search">
          <div id="bench-list"></div>`,
        'panel-building': `
          <div id="building-body"></div>`,
        'panel-trade': `
          <div id="trade-coins" class="trade-coins"></div>
          <div id="trade-list" class="recipe-grid"></div>`,
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
    this.q('#vital-army').addEventListener('click', () => { const w = this.q('#army-wheel'); w.hidden = !w.hidden; });
    this.el.querySelectorAll('[data-army]').forEach((b) => b.addEventListener('click', () => {
      this.q('#army-wheel').hidden = true;
      this.game.commandArmy(b.dataset.army);
    }));
    this.q('#btn-claim-column').addEventListener('click', () => this.game.beginClaimColumn());
    this.q('#btn-claim-area').addEventListener('click', () => this.game.beginClaimSelection());
    this.q('#btn-store-all').addEventListener('click', () => this.storeEverything());
    this.q('#btn-stores-all').addEventListener('click', () => this.storeAllAway());
    this.q('#stores-search').addEventListener('input', () => this.renderStores());
    this.wireSlotTip();

    this.bus.on('inventory:change', () => {
      this.renderBag();
      this.renderHealth();
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
    this.bus.on('research:done', ({ name }) => {
      this.bus.emit('toast', { kind: 'achievement', title: `${name} learnt`, body: 'You can raise an Engineering Centre now' });
    });
    this.bus.on('structure:sown', ({ structure }) => {
      if (this.building?.id === structure?.id) this.showBuilding(structure, this.buildingActionsCache);
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
   * What a level still wants, the way a recipe's ingredients are shown
   * (asked for directly: "let's use the same pattern for needed items with
   * icons and the pill too"): a pill per thing, with how many. Lights and
   * chests say Evolve puts them in from your bag, and whether you hold
   * enough; what's built into the walls says to build it in with Change
   * it; anything that isn't an item at all (a bigger room) stays a line.
   */
  needsHtml(next) {
    const d = this.duilt;
    const wants = next?.wants ?? [];
    if (!wants.length) return '';
    const pills = wants.filter((w) => w.item && w.n != null);
    const fit = pills.filter((w) => w.fit), hand = pills.filter((w) => !w.fit);
    const lines = wants.filter((w) => !(w.item && w.n != null));
    const held = (w) => w.fit.reduce((n, id) => n + (d?.inventory.countOf(id) ?? 0), 0);
    return [
      fit.length ? `<p class="evolve-cost">Needs <span class="recipe-cost">${fit.map((w) => {
        const have = held(w);
        return itemChip(w.item, w.n, { have, short: !d?.sandbox && have < w.n });
      }).join('')}</span></p><p class="dim evolve-note">Taken from your bag and put in for you.</p>` : '',
      hand.length ? `<p class="evolve-cost">Build in <span class="recipe-cost">${hand.map((w) => itemChip(w.item, w.n)).join('')}</span></p>` : '',
      // Work on the building itself, not a trade (asked for directly: "If
      // it's a trade off like forest with some items, we are good. If we
      // need to build something we need to be clear").
      lines.length ? `<p class="evolve-cost evolve-build-head">${icon('hammer')} Build</p><ul class="evolve-todo">${lines.map((w) => `<li>${escapeHtml(w.say)}</li>`).join('')}</ul>` : '',
      hand.length || lines.length ? '<p class="dim evolve-note">Tap Change below, then build or dig right against it. What you add becomes part of it.</p>' : '',
    ].join('');
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

    const locked = structure.locked !== false;
    // Its name is the title; nothing under it — the popup says the rest.
    const title = this.q('#building-title');
    if (title) title.textContent = spec?.name ?? 'Building';
    if (sub) { sub.textContent = ''; sub.hidden = true; }

    // Asked for directly: "architecture of info needs improvement as today
    // we have lots of actions below in each building ... Maybe evolve won't
    // be on the footer." So the popup reads top to bottom as the building:
    // what it makes, then its level with Evolve right under what that level
    // needs, then what's made here — and the few things you can do *to* the
    // building (open, move, change, delete) as a small row of tools at the
    // very bottom. Nothing to close it but the cross.
    try {
      body.innerHTML = this.buildingBodyHtml(structure, spec, locked);
    } catch (err) {
      // A building that can't be drawn mustn't take the game down with it:
      // say so, keep the tools to move or delete it, and log what broke.
      console.error('Building panel', structure?.type, err);
      body.innerHTML = `<div class="building-state bad">This building's details couldn't be shown (${escapeHtml(err?.message ?? 'unknown error')}).</div>${this.buildingToolsHtml(structure, spec, locked, null)}`;
    }

    body.querySelector('[data-evolve]')?.addEventListener('click', () => actions.onEvolve?.());
    this.wireCraft(body, () => this.building?.id === structure.id && this.showBuilding(structure, this.buildingActionsCache));
    body.querySelectorAll('[data-sow]').forEach((b) => b.addEventListener('click', () => actions.onSow?.(b.dataset.sow)));
    body.querySelectorAll('[data-unsow]').forEach((b) => b.addEventListener('click', () => actions.onUnsow?.(b.dataset.unsow)));
    body.querySelector('[data-store]')?.addEventListener('click', () => actions.onOpenStore?.());
    body.querySelector('[data-stores]')?.addEventListener('click', () => actions.onOpenStores?.());
    body.querySelector('[data-move]')?.addEventListener('click', () => actions.onMove?.());
    body.querySelector('[data-change]')?.addEventListener('click', () => actions.onChange?.());
    body.querySelector('[data-delete]')?.addEventListener('click', () => {
      this.confirm({ title: `Delete this ${spec?.name?.toLowerCase() ?? 'building'}?`, body: 'Its blocks stay where they are.', ok: 'Delete', danger: true })
        .then((yes) => { if (yes) actions.onDelete?.(); });
    });
  }

  buildingBodyHtml(structure, spec, locked) {
    const d = this.duilt;
    const summary = d?.storeSummary(structure) ?? null;
    const level = d?.levelSummary(structure) ?? null;
    const made = this.makesOf(structure, spec, level);
    const does = this.buildingDoes(structure, spec, level, summary);
    const next = level?.next;
    // Ready means pressing it works now — including when what it still
    // wants is a lantern or a chest Evolve can put in from your bag.
    const ready = !!next && !!d?.evolvePlan(structure, { dry: true }).ok;
    const nextMade = next?.rate ? this.makesOf(structure, { ...spec, fromCrops: false, fromAnimals: false }, { rate: next.rate }) : null;
    const levelSec = !level ? '' : `
      <div class="building-sec building-level">
        <div class="building-sec-head"><h4>Level</h4><span class="level-pill">${escapeHtml(level.name)}</span></div>
        ${!next ? '<p class="dim">Top level.</p>' : `
          <p class="level-next">Next: <strong>${escapeHtml(next.name)}</strong></p>
          ${this.needsHtml(next)}
          ${next.cost ? `<p class="evolve-cost">Costs <span class="recipe-cost">${Object.entries(next.cost).map(([id, n]) => {
            const have = d?.inventory.countOf(id) ?? 0;
            return itemChip(id, n, { have, short: !d?.sandbox && have < n });
          }).join('')}</span></p>` : ''}
          ${nextMade ? this.makesHtml(nextMade, 'Then makes') : next.yield > 1 ? `<p class="dim">Then: ${next.yield}× as much.</p>` : ''}
          <button class="${ready ? 'primary' : 'secondary cannot'} building-evolve" data-evolve>Evolve to ${escapeHtml(next.name)}</button>`}
      </div>`;
    return `
      ${structure.valid ? '' : `<div class="building-state bad">Stopped: ${escapeHtml(structure.brokenReason ?? 'something it needs is missing')}</div>`}
      <div class="building-sec">
        ${this.makesHtml(made)}
        ${does.map((t) => `<p class="building-line">${escapeHtml(t)}</p>`).join('')}
        ${summary || spec?.stores ? `<div class="building-inline">
          ${summary ? `<button class="primary" data-store>Open</button>` : ''}
          ${spec?.stores ? `<button class="${summary ? 'secondary' : 'primary'}" data-stores>Every storehouse</button>` : ''}
        </div>` : ''}
      </div>
      ${spec?.fromCrops ? this.farmSeedsHtml(structure) : ''}
      ${levelSec}
      ${this.stationRecipesHtml(spec)}
      ${this.buildingToolsHtml(structure, spec, locked)}`;
  }

  /**
   * The things you do to a building rather than with it — move it, change
   * its blocks, delete it — as a small row of tools at the bottom, out of
   * the way of what the building is for.
   */
  buildingToolsHtml(structure, spec, locked) {
    return `
      <div class="building-tools">
        <button class="tool-btn" data-move>${icon('select', 16)}<span>Move</span></button>
        <button class="tool-btn" data-change>${icon('hammer', 16)}<span>${locked ? 'Change' : 'Done'}</span></button>
        <button class="tool-btn danger" data-delete aria-label="Delete">${pixelIcon('trash', 16)}<span>Delete</span></button>
      </div>`;
  }

  /**
   * A farm's crops (backlog batch 2): FARM_SEED_SLOTS slots, one seed a
   * crop. Tap a crop to take it out (its seed comes back); below, the seeds
   * in your bag that aren't in yet, tap one to put it in.
   */
  farmSeedsHtml(structure) {
    const sown = structure.seeds ?? [];
    const inv = this.duilt?.inventory;
    const seedIcon = (kind) => {
      const spec = ITEMS_BY_ID.get(`seeds_${kind}`);
      return itemIcon(spec, { size: 22 }) ?? glyphSvg('seeds', { size: 16, color: spec?.color });
    };
    const name = (kind) => CROPS.find((c) => c.kind === kind)?.name ?? kind;
    const slots = Array.from({ length: FARM_SEED_SLOTS }, (_, i) => {
      const kind = sown[i];
      return kind
        ? `<button class="farm-seed sown" data-unsow="${kind}" title="Take it out — the seed comes back">${seedIcon(kind)}<span>${name(kind)}</span><span class="x" aria-hidden="true">×</span></button>`
        : '<div class="farm-seed empty">Empty</div>';
    }).join('');
    const room = sown.length < FARM_SEED_SLOTS;
    const yours = CROPS.filter((c) => !sown.includes(c.kind) && (inv?.endless || inv?.has(`seeds_${c.kind}`, 1)));
    const pick = !room ? '<p class="dim">Four crops is a full farm — tap one to take it out.</p>'
      : yours.length
        ? `<p class="dim">Put in a seed:</p><div class="farm-seed-pick">${yours.map((c) => `<button class="farm-seed" data-sow="${c.kind}">${seedIcon(c.kind)}<span>${c.name}</span>${inv?.endless ? '' : `<span class="n">${inv.countOf(`seeds_${c.kind}`)}</span>`}</button>`).join('')}</div>`
        : '<p class="dim">No seeds in your bag that aren\'t in already — break grass, or pick a ripe crop.</p>';
    return `
      <div class="building-sec">
        <h4>Crops · ${sown.length} of ${FARM_SEED_SLOTS}</h4>
        <div class="farm-seeds">${slots}</div>
        ${pick}
      </div>`;
  }

  /**
   * What a building is for, in one or two plain lines about the game — not
   * how the game works underneath (asked for directly: "Copy should be
   * straightforward about game, not about concepts"). What it makes is
   * drawn as pills beside this (makesHtml); these are the rest.
   */
  buildingDoes(structure, spec, level, summary) {
    const out = [];
    if (spec?.fromCrops && !Object.keys(this.duilt?.producesFor(structure) ?? {}).length) out.push('Plant seeds below and it grows them.');
    if (spec?.fromAnimals && !Object.keys(penProduce(structure, this.duilt?.herd ?? [])).length) out.push('Lead sheep, cows or chickens in. They give wool, milk and eggs.');
    if (spec?.grantsCapacity) out.push(`Home for ${spec.grantsCapacity === 1 ? 'one family' : `${spec.grantsCapacity} families`}.`);
    if (spec?.station === 'university') out.push('Research skills and engineering here.');
    else if (spec?.station) {
      const made = [...new Set(RECIPES.filter((r) => r.station === spec.station && r.output?.id).map((r) => itemName(r.output.id).toLowerCase()))];
      if (made.length) out.push(`Make ${made.length > 3 ? `${made.slice(0, 3).join(', ')} and more` : made.join(' and ')} here.`);
    }
    if (summary) out.push(summary.items ? `${summary.items} things in ${summary.used} of ${summary.size} slots.` : `Empty — ${summary.size} slots.`);
    if (spec?.stores) out.push('Reach every storehouse from here.');
    const tax = this.duilt?.skyTaxRate?.() ?? 0;
    // The Sky Kingdom's share, after a lost attack on it (duilt/SkyWar.js).
    if (tax > 0 && this.makesOf(structure, spec, level)) out.push(`Taxes: the Sky Kingdom takes ${Math.round(tax * 100)}% of what it makes, until it falls.`);
    if (!out.length && !this.makesOf(structure, spec, level)) out.push('Makes nothing. It counts toward your age goals.');
    return out;
  }

  /** What a building makes a game day, as { item: n }, or null. */
  makesOf(structure, spec, level) {
    const rate = level?.rate ?? (spec && Object.keys(spec.produces ?? {}).length ? { produces: spec.produces, everySeconds: spec.everySeconds } : null);
    let produces = spec?.fromCrops ? this.duilt?.producesFor(structure)
      : spec?.fromAnimals ? penProduce(structure, this.duilt?.herd ?? []) : rate?.produces;
    const every = rate?.everySeconds ?? spec?.everySeconds;
    if (!produces || !Object.keys(produces).length || !every) return null;
    const out = {};
    // One decimal: rounded to whole numbers, two levels a few tenths apart
    // read as the same, and evolving looked like it did nothing.
    for (const [k, v] of Object.entries(produces)) out[k] = Math.max(0.1, Math.round(v * PRODUCTION_PACE * 864000 / every) / 10);
    return out;
  }

  /** "Makes [🪵 4] [🍎 1] a day", as pills. */
  makesHtml(made, label = 'Makes') {
    if (!made) return '';
    return `<p class="evolve-cost">${label} <span class="recipe-cost">${Object.entries(made).map(([id, n]) => itemChip(id, n)).join('')}</span> a day</p>`;
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
    const armour = d.armour();
    box.innerHTML = Array.from({ length: 10 }, (_, i) => heart(v >= 2 * (i + 1) ? 'full' : v === 2 * i + 1 ? 'half' : 'empty')).join('')
      // What you're wearing, beside the hearts: a shield and its points.
      + (armour ? `<span class="armour-badge"><svg viewBox="0 0 24 24"><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6Z"/></svg><b>${armour}</b></span>` : '');
    box.classList.toggle('low', v <= 6);
    box.title = `Health: ${v / 2} of 10 hearts${armour ? ` · ${armour} armour` : ''}`;
  }

  /**
   * A chip for each drink going, beside the hearts: a flask in the drink's
   * colour and the time it has left. Called every frame; only touches the
   * page when what it says has changed.
   */
  renderBoosts() {
    const box = this.q('#vital-boosts');
    const boosts = this.duilt?.boosts ?? {};
    const names = Object.keys(BOOSTS).filter((n) => boosts[n] > 0);
    const key = names.map((n) => `${n}${clockOf(boosts[n])}`).join();
    if (!box || key === this.boostKey) return;
    this.boostKey = key;
    box.hidden = !names.length;
    box.innerHTML = names.map((n) => `<span class="boost" title="${BOOSTS[n].name}: ${BOOSTS[n].says}">`
      + `<svg viewBox="0 0 24 24" style="fill:${BOOSTS[n].color}"><path d="M9 3h6v2h-1v3.2l4.6 7.6A3 3 0 0 1 16 20H8a3 3 0 0 1-2.6-4.2L10 8.2V5H9Z"/></svg>`
      + `<b>${clockOf(boosts[n])}</b></span>`).join('');
  }

  /** The army's banner: how many are left, and what they're doing. Hidden until you have one. */
  renderArmy() {
    const army = this.duilt?.army;
    const box = this.q('#vital-army');
    if (!box) return;
    const on = !!army?.active && !this.duilt.sandbox;
    const key = on ? `${army.total}:${army.mode}:${army.marching}` : '';
    if (key === this.armyKey) return;
    this.armyKey = key;
    box.hidden = !on;
    if (!on) { this.q('#army-wheel').hidden = true; return; }
    this.q('#army-count').textContent = army.total;
    this.q('#army-mode').textContent = army.marching ? 'on the march' : { follow: 'following', hold: 'holding', attack: 'attacking', line: 'in line' }[army.mode];
    this.el.querySelectorAll('[data-army]').forEach((b) => b.classList.toggle('on', b.dataset.army === army.mode));
  }

  /**
   * The suspicion meter: { level 0..1, rising, reason, discovered }, or
   * null to hide it. White while they've no reason to look at you, amber,
   * then red; it pulses while it climbs, and says what's giving you away.
   */
  renderSuspicion(s) {
    const box = this.q('#vital-suspicion');
    if (!box) return;
    const key = s ? `${Math.round(s.level * 50)}:${s.rising}:${s.reason}:${s.discovered}` : '';
    if (key === this.susKey) return;
    this.susKey = key;
    box.hidden = !s;
    if (!s) return;
    const fill = this.q('#sus-fill');
    fill.style.width = `${Math.round(s.level * 100)}%`;
    box.classList.toggle('wary', s.level >= 0.4 && s.level < 0.75);
    box.classList.toggle('high', s.level >= 0.75);
    box.classList.toggle('rising', !!s.rising && !s.discovered);
    box.classList.toggle('discovered', !!s.discovered);
    this.q('#sus-reason').textContent = s.discovered ? 'Discovered' : s.reason ?? (s.level > 0.02 ? 'easing' : 'unseen');
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
  /** How your path ended, told in a few lines: the dark path's conquest, or the white path's defence. */
  endingStory(d) {
    const story = d.skyFallen && d.ring === 'black' && d.skyWar?.yielded
      ? ['The Sky Kingdom has yielded.', 'You cut its four great chains, and it sank lower day by day, until its King came down from his throne and gave up the island you fell from.',
        'The Stone King has named you Lord of the Sky. The dark god has what he wanted — and so, for now, do you.']
      : d.skyFallen && d.ring === 'black'
      ? ['The Sky King is fallen.', 'The island you fell from now hangs over land that answers to you. Its white halls are quiet; its chains run down to towers your warriors hold.',
        'The Stone King has named you Lord of the Sky. The dark god has what he wanted — and so, for now, do you.']
      : d.war?.stage === 'won'
        ? ['The Ten Rounds are over.', 'Ten times the Stone Kingdom came for you, and ten times it went home with nothing. Your walls stand; your people sleep easy.',
          'Above your settlement at night, the white god\'s fireflies drift — his blessing on the land you held.']
        : null;
    if (!story) return '';
    const [head, ...rest] = story;
    return `<div class="finish-story"><p class="finish-line"><strong>${head}</strong></p>${rest.map((l) => `<p class="finish-line">${l}</p>`).join('')}</div>`;
  }

  renderFinish() {
    const d = this.duilt;
    if (!d) return this.noWorld('#finish-body');
    const body = this.q('#finish-body');
    const sub = this.q('#finish-sub');
    const dark = d.skyFallen && d.ring === 'black';
    if (sub) sub.textContent = dark ? 'The dark path, to its end.' : d.war?.stage === 'won' ? 'The white path, to its end.' : 'Six ages, from thirty-two blocks to the whole map.';
    // The dark path can end before the last age is done: then there's still that to do.
    const allAges = d.age >= FINAL_AGE && d.ageComplete();

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
      ${this.endingStory(d)}
      <p class="finish-line">You arrived on thirty-two blocks of land with an axe and a bucket.
         What is standing now:</p>
      <ul class="finish-list">
        ${rows.map((r) => `<li><span class="finish-icon">${r.spec.icon}</span>${r.spec.name}<span class="finish-n">${r.n}</span></li>`).join('')
          || '<li>Nothing, somehow.</li>'}
      </ul>
      <p class="finish-line dim">${allAges ? `The world stays as it is. You can keep building in it — nothing
         is taken away, there is just nothing further to unlock.` : `The world stays as it is. You can keep building in it, and the
         ages you haven't finished are still there to finish.`}</p>
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
    this.renderBagSkills();
    const slots = d.inventory.slots;
    // Nothing is thrown away from a creative bag — see Inventory's `endless`.
    const bin = d.inventory.endless ? null : 'data-discard';
    const slotHtml = (s, i) => this.slotHtml(s, i, { attr: 'data-slot', held: this.held === i, discardAttr: bin });

    this.renderWear();
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

  /** The five things you wear, each its own slot with its name under it. */
  renderWear() {
    const d = this.duilt, grid = this.q('#bag-wear-grid');
    if (!d || !grid) return;
    const heldId = this.held != null ? d.inventory.slots[this.held]?.id : null;
    const fits = ITEMS_BY_ID.get(heldId)?.wears ?? null;
    grid.innerHTML = WEAR_SLOTS.map((k) => {
      const piece = d.worn[k];
      const spec = ITEMS_BY_ID.get(piece?.id);
      const inner = spec
        ? `<span class="swatch swatch-cube">${itemIcon(spec, { size: 34 }) ?? glyphSvg(spec.glyph, { size: 20, color: spec.color })}</span>`
          + `<span class="wear"><i style="width:${Math.round((1 - piece.wear / spec.durability) * 100)}%"></i></span>`
        : `<span class="wear-ghost">${glyphSvg({ head: 'helm', body: 'cuirass', legs: 'greaves', feet: 'boots', ring: 'ring' }[k], { size: 22, color: 0x9aa0a6 })}</span>`;
      const tip = spec ? `${spec.name}${spec.armour ? ` · ${spec.armour} armour` : ''} — tap to take off` : `${SLOT_NAMES[k]} — nothing on`;
      return `<div class="wear-cell"><button class="bag-slot wear-slot${spec ? '' : ' empty'}${fits === k ? ' fits' : ''}" data-wear="${k}"
        aria-label="${escapeAttr(tip)}" data-tip="${escapeAttr(spec ? spec.name : SLOT_NAMES[k])}" data-tip-info="${escapeAttr(spec ? `${spec.armour ? `${spec.armour} armour · ` : ''}tap to take off` : k === 'ring' ? 'Forged at the Temple' : 'Lift a piece from your bag, then tap here')}">${inner}</button>
        <span class="wear-label">${SLOT_NAMES[k]}</span></div>`;
    }).join('');
    grid.querySelectorAll('[data-wear]').forEach((btn) => btn.addEventListener('click', () => this.tapWear(btn.dataset.wear)));
    const points = d.armour();
    this.q('#armour-sum').textContent = points
      ? `— ${points} armour, a blow ${Math.round(points * ARMOUR_PER_POINT * 100)}% softer`
      : '— nothing on';
  }

  /** A wear slot tapped: put on what's lifted, or take off what's there. */
  tapWear(k) {
    const d = this.duilt;
    if (!d) return;
    if (this.held != null) {
      const spec = ITEMS_BY_ID.get(d.inventory.slots[this.held]?.id);
      if (spec?.wears !== k) {
        this.bus.emit('toast', { kind: 'xp', title: spec?.wears ? `That goes on your ${SLOT_NAMES[spec.wears].toLowerCase()}` : `You can't wear ${itemName(spec?.id ?? '').toLowerCase()}` });
        return;
      }
      const r = d.wear(this.held);
      this.held = null;
      if (r.ok) this.bus.emit('toast', { kind: 'xp', title: `Wearing the ${spec.name.toLowerCase()}` });
    } else if (d.worn[k]) {
      const r = d.takeOff(k);
      this.bus.emit('toast', { kind: 'xp', title: r.ok ? `Took off the ${itemName(r.id).toLowerCase()}` : r.reason });
    } else {
      this.bus.emit('toast', { kind: 'xp', title: k === 'ring' ? 'Your ring is forged at the Temple' : `Lift a piece of armour from your bag, then tap ${SLOT_NAMES[k]}` });
    }
    this.renderBag();
    this.renderHealth();
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
    if (spec?.wears) bits.push(`${spec.armour} armour, worn on the ${spec.wears} — lift it, then tap ${SLOT_NAMES[spec.wears]}`);
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

    const TIPPED = '.bag-slot[data-tip], .cost-chip[data-tip], .recipe-icon[data-tip]';
    this.el.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      const btn = e.target.closest?.(TIPPED);
      if (btn) this.showSlotTip(btn);
    });
    this.el.addEventListener('pointerout', (e) => {
      if (e.pointerType === 'touch') return;
      const btn = e.target.closest?.(TIPPED);
      if (btn && !btn.contains(e.relatedTarget)) this.hideSlotTip();
    });
    // A chip has nothing else to do when pressed, so a tap is how a phone
    // asks what it is: tap shows the card, tap again (or anywhere) puts it away.
    this.el.addEventListener('click', (e) => {
      const chip = e.target.closest?.('.cost-chip[data-tip], .recipe-icon[data-tip]');
      if (!chip) { if (this.tipChip) this.hideSlotTip(); return; }
      if (this.tipChip === chip && !this.tip.hidden) { this.hideSlotTip(); return; }
      this.showSlotTip(chip);
      this.tipChip = chip;
    });
    this.el.addEventListener('scroll', () => this.hideSlotTip(), true);
  }

  showSlotTip(btn) {
    const attr = ['data-slot', 'data-store-slot', 'data-bag-slot', 'data-wear'].find((a) => btn.hasAttribute(a));
    // A cost chip has no slot to find again after a re-render; it just closes.
    this.tipAt = attr ? { attr, index: btn.getAttribute(attr) } : null;
    this.tipChip = null;
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
    this.tipChip = null;
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
    if (title) title.textContent = summary.chest ? (summary.grave ? 'What you were carrying' : summary.found ?? 'Chest') : 'Storehouse';

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
        // The same pills as the building's own panel. This used to say a
        // shed that qualified would settle by itself on the next change to it,
        // from before levels were evolved by a button — it never did.
        const ready = !!this.duilt?.evolvePlan(summary.structure, { dry: true }).ok;
        next.innerHTML = `<strong>Evolve it to a ${up.name.toLowerCase()} — ${up.slots} slots</strong>
          ${this.needsHtml(up)}
          <button class="${ready ? 'primary' : 'secondary cannot'}" data-store-evolve>Evolve to ${withArticle(up.name)}</button>`;
        next.querySelector('[data-store-evolve]').addEventListener('click', () => {
          this.game.evolveBuilding?.(summary.structure);
          this.renderStore();
        });
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

  // ---- the storage controller ----

  /** Every storehouse at once (a storage controller, or a town hall's panel). */
  showStores() {
    const search = this.q('#stores-search');
    if (search) search.value = '';
    this.renderStores();
  }

  /**
   * Everything on every shelf, as tiles: the item, how many in all, and in
   * how many storehouses. A tap takes a stack into the bag (see
   * DuiltGame.takeFromStores). The search matches names, the same way the
   * bench's does.
   */
  renderStores() {
    const d = this.duilt;
    const list = this.q('#stores-list');
    if (!list) return;
    if (!d) { list.innerHTML = ''; return this.noWorld('#stores-list'); }
    const sheds = d.structures.stores().length;
    const all = d.storeTotals();
    const q = (this.q('#stores-search')?.value ?? '').trim().toLowerCase();
    const rows = q ? all.filter((r) => itemName(r.id).toLowerCase().includes(q)) : all;
    const where = this.q('#stores-where');
    if (where) {
      const total = all.reduce((n, r) => n + r.count, 0);
      where.textContent = sheds
        ? `${total} thing${total === 1 ? '' : 's'} in ${sheds} storehouse${sheds === 1 ? '' : 's'}`
        : 'No storehouses yet';
    }
    if (!rows.length) {
      list.innerHTML = `<div class="sub" style="margin:0">${!sheds ? 'Build a storehouse, and whatever goes on its shelves shows up here.'
        : q ? `Nothing called "${escapeHtml(q)}" in any storehouse.` : 'Nothing on the shelves yet. Tap “Put it all away” to start.'}</div>`;
      return;
    }
    list.innerHTML = rows.map((r) => {
      const spec = ITEMS_BY_ID.get(r.id);
      const icon = itemIcon(spec, { size: 40 }) ?? glyphSvg(spec?.glyph, { size: 30, color: spec?.color ?? 0x888888 });
      return `
        <div class="recipe-tile">
          <span class="recipe-icon" role="button" tabindex="0" data-tip="${escapeAttr(itemName(r.id))}" data-tip-info="${escapeAttr(spec?.madeBy ?? '')}">${icon}<b>×${r.count}</b></span>
          <strong class="recipe-name">${escapeHtml(itemName(r.id))}</strong>
          <span class="recipe-cost dim">${r.stores === 1 ? 'In 1 storehouse' : `Across ${r.stores} storehouses`}</span>
          <div class="recipe-actions"><button class="secondary" data-take="${escapeAttr(r.id)}">Take</button></div>
        </div>`;
    }).join('');
    list.querySelectorAll('[data-take]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.take;
      const n = d.takeFromStores(id);
      this.bus.emit('toast', n
        ? { kind: 'xp', title: `Took ${n} ${itemName(id).toLowerCase()}` }
        : { kind: 'xp', title: 'Your bag is full', body: 'Put something away first' });
      this.renderStores();
    }));
  }

  /** "Put it all away": everything but your tools, onto whichever shelves have room. */
  storeAllAway() {
    const d = this.duilt;
    if (!d) return;
    if (!d.structures.stores().length) {
      this.bus.emit('toast', { kind: 'xp', title: 'No storehouses yet', body: 'Build one, and this puts things on its shelves' });
      return;
    }
    const { moved, stuck } = d.storeAllAway();
    this.renderStores();
    this.bus.emit('toast', moved
      ? { kind: 'xp', title: `Put ${moved} away`, body: stuck ? 'Every shelf filled up before the rest' : 'Your tools stayed with you' }
      : { kind: 'xp', title: 'Nothing moved', body: stuck ? 'Every shelf is full' : 'Only your tools are left' });
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
  renderBuildings() {
    const d = this.duilt;
    if (!d) return this.noWorld('#buildings-list');

    // Every structure there is, in a sandbox — no age to gate them behind,
    // same as claimOptionsFor. And nothing to ever be short of: a sandbox
    // bag holds one of everything and a starter design's cost never actually
    // gets charged (see DuiltGame.starterPlacement), so the button that
    // offers to stamp one has nothing to disable.
    const search = this.q('#buildings-search');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('input', () => this.renderBuildings());
    }
    const query = search?.value ?? '';
    const offered = (d.sandbox ? STRUCTURES : structuresForAge(d.age)).filter((spec) => matchesSearch(query, [
      spec.name, spec.blurb, this.whatItGivesYou(spec),
      ...Object.keys(DESIGN_FOR_STRUCTURE.get(spec.id)?.cost ?? {}).map(itemName),
    ]));
    if (!offered.length) {
      this.q('#buildings-list').innerHTML = `<div class="sub" style="margin:8px 0">No building matches “${escapeHtml(query.trim())}”.</div>`;
      return;
    }
    this.q('#buildings-list').innerHTML = offered.map((spec) => {
      const built = d.structures.countOf(spec.id);
      const design = DESIGN_FOR_STRUCTURE.get(spec.id);
      const canStamp = design && (d.sandbox || d.inventory.hasAll(design.cost));
      const shortfall = design && !d.sandbox ? d.inventory.missing(design.cost) : {};
      // The full bill, not just what you're short — a shortfall note only ever
      // said "4 more turned soil" and never the 16 it actually takes, so the
      // only way to know the real cost was to try, fail, and do the subtraction
      // yourself.
      //
      // Backlog batch 2: the cost as each item's icon and how many, not a line
      // of words — and one you're short of says so in its own colour, with
      // what you have against it and where more comes from (the recipe
      // list's answer, so "2 saplings" is never a dead end).
      const costLine = design
        ? Object.entries(design.cost).map(([id, n]) => itemChip(id, n, {
          have: d.sandbox ? null : d.inventory.countOf(id),
          short: shortfall[id] > 0,
        })).join('')
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
          </div>
          ${design ? `
          <div class="building-costs">${costLine}</div>
          <div class="building-actions">
            <button class="secondary" data-stamp="${spec.id}" ${canStamp ? '' : 'disabled'}>
              Place a ${design.footprint} starter
            </button>
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
    const all = d.crafting.available(d.age, { station: null, near, atStations });
    // Backlog batch 2: a search, for a list that is long by the later ages.
    // Matches what it's called, what it makes and what goes into it.
    const search = this.q('#bench-search');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('input', () => this.renderBench());
    }
    const query = search?.value ?? '';
    const recipes = all.filter((r) => matchesSearch(query, [r.name, r.blurb, r.station, itemName(r.output.id), ...Object.keys(r.inputs).map(itemName)]));
    if (!recipes.length) {
      this.q('#bench-list').innerHTML = `<div class="sub" style="margin:8px 0">Nothing you can make matches “${escapeHtml(query.trim())}”.</div>`;
      return;
    }

    const list = this.q('#bench-list');
    list.innerHTML = this.recipeGridHtml(recipes);
    this.wireCraft(list, () => this.renderBench());
  }

  /**
   * Recipes as a grid of tiles: what it makes, big, with its name, what goes
   * in, and Make. Asked for directly: "items could be something shown in a
   * grid, with the icon and name, and the make button". The bench and every
   * station's own popup (a foundry, a workshop...) draw the same tiles.
   *
   * The blurb rides on the big icon as its card — hovered with a mouse,
   * tapped on a phone — so a tile stays small enough for two to a row.
   */
  recipeGridHtml(recipes) {
    const d = this.duilt;
    return recipes.map((r) => {
      const inputs = Object.entries(r.inputs).map(([id, n]) => {
        const have = d.inventory.countOf(id);
        return itemChip(id, n, { have, short: !d.sandbox && have < n });
      }).join('');
      const spec = r.study ? null : ITEMS_BY_ID.get(r.output.id);
      const icon = r.study
        ? glyphSvg('flask', { size: 30, color: 0x7b8bb0 })
        : itemIcon(spec, { size: 40 }) ?? glyphSvg(spec?.glyph, { size: 30, color: spec?.color ?? 0x888888 });
      // Research (asked for directly): the level it reaches on the card, how
      // long it takes, Research rather than Make — and while it's going, a
      // bar and the time left instead of a button.
      const count = r.study ? `<b>Lv ${r.level}</b>` : r.output.count > 1 ? `<b>×${r.output.count}</b>` : '';
      const name = r.study ? r.result : itemName(r.output.id);
      const going = r.study ? d.researchProgress?.() : null;
      if (going && going.id === r.id) {
        return `
        <div class="recipe-tile researching">
          <span class="recipe-icon">${icon}${count}</span>
          <strong class="recipe-name">${escapeHtml(r.result)}</strong>
          <div class="research-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(going.ratio * 100)}"><i style="width:${Math.round(going.ratio * 100)}%"></i></div>
          <div class="research-left">Researching · ${escapeHtml(d.researchLeftText())} left</div>
        </div>`;
      }
      const verb = r.study ? 'Research' : 'Make';
      const takes = r.study && !d.sandbox ? `<span class="research-takes">Takes ${this.duilt.constructor.researchDays(r)} days</span>` : '';
      return `
        <div class="recipe-tile ${r.ok ? '' : 'blocked'}">
          <span class="recipe-icon" role="button" tabindex="0" data-tip="${escapeAttr(name)}" data-tip-info="${escapeAttr(r.blurb ?? '')}">${icon}${count}</span>
          <strong class="recipe-name">${r.name}</strong>
          ${r.station !== 'hand' ? `<span class="recipe-station${r.atStation ? ' at' : ''}">${r.station}</span>` : ''}
          <span class="recipe-cost">${inputs}</span>
          ${takes}
          <div class="recipe-actions">
            <!--
              Never disabled. A dead button eats the tap and says nothing, so
              pressing one you cannot afford felt like the game was broken.
              Press it and it tells you why.
            -->
            <button class="secondary${r.ok ? '' : ' cannot'}" data-craft="${r.id}" data-times="1">${verb}</button>
            ${r.batch && r.maxBatch > 1 ? `<button class="secondary" data-craft="${r.id}" data-times="${r.maxBatch}">×${r.maxBatch}</button>` : ''}
          </div>
          ${r.reason ? `<div class="recipe-why warn">${r.reason}</div>` : ''}
        </div>`;
    }).join('');
  }

  /**
   * A goblin trader's stall (config/traders.js): what they sell, for how many
   * coins, as the same tiles the bench draws — the goods, big, with how many
   * you get, the price, and Buy.
   */
  showTrader(person) {
    const d = this.duilt;
    const t = TRADERS_BY_ID.get(person?.trader);
    if (!d || !t) return;
    this.trader = person;
    const sub = this.q('#trade-sub');
    if (sub) sub.textContent = `${t.name} — ${t.trade.toLowerCase()}`;
    const coins = d.inventory.countOf('coin');
    this.q('#trade-coins').innerHTML = `${itemChip('coin', coins)} <span>${d.sandbox ? 'Free in Creative' : `You have ${coins} coin${coins === 1 ? '' : 's'}. Strike more at a foundry, or find them in chests.`}</span>`;
    const list = this.q('#trade-list');
    list.innerHTML = t.goods.map(([id, n, price], i) => {
      const spec = ITEMS_BY_ID.get(id);
      const icon = itemIcon(spec, { size: 40 }) ?? glyphSvg(spec?.glyph, { size: 30, color: spec?.color ?? 0x888888 });
      const afford = d.sandbox || coins >= price;
      return `
        <div class="recipe-tile ${afford ? '' : 'blocked'}">
          <span class="recipe-icon" role="button" tabindex="0" data-tip="${escapeAttr(itemName(id))}" data-tip-info="${escapeAttr(spec?.madeBy ?? '')}">${icon}${n > 1 ? `<b>×${n}</b>` : ''}</span>
          <strong class="recipe-name">${escapeHtml(itemName(id))}</strong>
          <span class="recipe-cost">${itemChip('coin', price, { have: coins, short: !afford })}</span>
          <div class="recipe-actions"><button class="secondary${afford ? '' : ' cannot'}" data-buy="${i}">Buy</button></div>
        </div>`;
    }).join('');
    list.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
      const res = d.buyFrom(t.id, Number(b.dataset.buy));
      this.bus.emit('toast', res.ok
        ? { kind: 'challenge', title: `Bought ${res.n} ${res.name.toLowerCase()}`, body: d.sandbox ? undefined : `${res.price} coin${res.price === 1 ? '' : 's'} to ${t.name}` }
        : { kind: 'xp', title: 'Cannot buy that', body: res.reason });
      this.showTrader(person);
    }));
  }

  /** The Make buttons in `root`: craft where you stand, say how it went, redraw. */
  wireCraft(root, rerender) {
    const d = this.duilt;
    root.querySelectorAll('[data-craft]').forEach((b) =>
      b.addEventListener('click', () => {
        const pos = this.game.player?.position;
        const res = d.crafting.craft(b.dataset.craft, Number(b.dataset.times),
          { near: pos, atStations: d.stationsNear(pos) });
        // Research starting says so itself (Game's research:started).
        if (!res.started) {
          this.bus.emit('toast', res.ok
            ? { kind: 'challenge', title: `Made ${res.made} ${res.name.toLowerCase()}` }
            : { kind: 'xp', title: 'Cannot make that', body: res.reason });
        }
        rerender();
      }));
  }

  /**
   * What a station makes, in its own popup (batch: "the pop up should have
   * the list of things that can be crafted there, let's keep the craft
   * nearby functionality cause I love it"). The bench still lists them all;
   * this is the same recipes, with the building you are standing at.
   */
  stationRecipesHtml(spec) {
    const d = this.duilt;
    if (!d || !spec?.station) return '';
    const near = this.game.player?.position;
    const recipes = d.crafting.available(d.age, { station: spec.station, near, atStations: d.stationsNear(near) });
    const body = recipes.length
      ? `<div class="recipe-grid">${this.recipeGridHtml(recipes)}</div>`
      : '<p class="dim">Nothing to make here yet. More comes next age.</p>';
    return `<div class="building-sec building-make"><h4>${spec.station === 'university' ? 'Research' : 'Make here'}</h4>${body}</div>`;
  }

  // ---- skills ----

  /** The skills row at the top of the bag: each skill's icon and level. Not in a sandbox, which has none. */
  renderBagSkills() {
    const row = this.q('#bag-skills');
    const d = this.duilt;
    if (!row) return;
    row.hidden = !d || d.sandbox;
    if (row.hidden) return;
    row.innerHTML = d.skills.summary().map((s) => `<span class="bag-skill" title="${escapeAttr(s.name)}">${s.icon}<b>${s.level}</b><em>${s.name}</em></span>`).join('');
    if (!row.dataset.bound) {
      row.dataset.bound = '1';
      row.addEventListener('click', () => this.openPanel('panel-skills'));
    }
  }

  renderSkills() {
    const d = this.duilt;
    if (!d) return this.noWorld('#skills-list');
    // Research (backlog batch 2): what a university has taught you besides the skills.
    const learnt = d.research?.engineering;
    const research = `
      <div class="skill-row research">
        <div class="skill-head"><span class="skill-icon">🎓</span><strong>Studying</strong></div>
        <div class="skill-governs">At a University you can study each skill up a level, and learn engineering.</div>
        <div class="skill-effect">${learnt ? 'Engineering learnt — you can raise an Engineering Centre' : 'Engineering not learnt yet'}</div>
      </div>`;
    this.q('#skills-list').innerHTML = research + d.skills.summary().map((s) => `
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

/**
 * Whether every word of a search turns up somewhere in `fields` — any order,
 * any case, part of a word will do ("sto ax" finds the Stone Axe). An empty
 * search matches everything.
 */
export function matchesSearch(query, fields) {
  const words = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields.filter(Boolean).join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}
