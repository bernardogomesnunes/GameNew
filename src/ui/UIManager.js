import { PLACEABLE_BLOCKS } from '../config/blocks.js';
import { icon } from './icons.js';
import { DuiltUI } from './DuiltUI.js';
import { HomeScreen } from './HomeScreen.js';
import { Panels } from './Panels.js';
import { ITEMS_BY_ID, itemName } from '../config/items.js';
import { RESOURCES_BY_ID } from '../config/resources.js';
import { ACHIEVEMENTS } from '../config/achievements.js';
import { CHALLENGES_BY_ID } from '../config/challenges.js';

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export class UIManager {
  constructor(root, { bus, game, saveManager, callbacks }) {
    this.bus = bus;
    this.game = game;
    this.saveManager = saveManager;
    this.cb = callbacks;
    this.selectedBlockId = 1;
    this.symmetryMode = 'off';
    this.selectionActive = false;

    root.innerHTML = this.markup();
    this.root = root;
    this.q = (sel) => root.querySelector(sel);

    // Every `.overlay` with an id is a panel, including the ones the Duilt
    // layer adds later. The worlds screen is an overlay too but is not a panel:
    // Escape must not dismiss it into a world nobody chose.
    this.panels = new Panels(root, { exclude: ['blocker'] });
    this.panels.onOpen((id) => this.populatePanel(id));
    this.panels.onClose((id) => this.duiltUI?.onPanelClosed(id));

    this.buildHotbar();
    this.wireEvents();
    this.wireBus();
    this.updateXp();
    this.detectTouch();
  }

  // Read live off the game: both engines are replaced wholesale on New World,
  // so a stored reference would go stale.
  get gamification() { return this.game.gamification; }
  get economy() { return this.game.economy; }
  get isCampaign() { return this.game.mode === 'campaign'; }

  markup() {
    return `
      <div id="crosshair"></div>

      <div id="blocker" class="overlay"></div>

      <div id="hud-top">
        <div id="level-badge">1</div>
        <div id="xp-bar-track"><div id="xp-bar-fill"></div></div>
      </div>

      <div id="resource-bar" hidden></div>

      <div id="resume-hint" hidden>Click the world to look around again</div>

      <div id="selector-readout" hidden>
        <div class="sel-head"><span id="sel-dims">8&sup3;</span><span id="sel-count">0 blocks</span></div>
        <div class="sel-hint" id="sel-hint"></div>
      </div>

      <div id="top-buttons">
        <button class="icon-btn" id="btn-undo" title="Undo the last change">${icon('undo')}<span>Undo</span></button>
        <button class="icon-btn" id="btn-redo" title="Redo the change you undid">${icon('redo')}<span>Redo</span></button>
        <button class="icon-btn" id="btn-select" title="Selector: aim a grid-snapped box at your build">${icon('select')}<span>Select</span></button>
        <button class="icon-btn" id="btn-size" title="Change the selector size">${icon('copy')}<span id="size-label">8&sup3;</span></button>
        <button class="icon-btn sandbox-only" id="btn-templates" title="Your saved building templates">${icon('paste')}<span>Designs</span></button>
        <button class="icon-btn duilt-only duilt-top" id="btn-bag" title="Your bag (I)" hidden>${icon('bag')}<span>Bag</span></button>
        <button class="icon-btn duilt-only duilt-top" id="btn-buildings" title="What you can build (B)" hidden>${icon('home')}<span>Build</span></button>
        <button class="icon-btn duilt-only duilt-top" id="btn-bench" title="Workbench — make things (E)" hidden>${icon('hammer')}<span>Bench</span></button>
        <button class="icon-btn" id="btn-symmetry" title="Mirror your building across the world's centre">${icon('symmetry')}<span>Mirror</span></button>
        <button class="icon-btn" id="btn-fullscreen" title="Toggle fullscreen">${icon('fullscreen')}<span>Screen</span></button>
        <button class="icon-btn" id="btn-stats" title="Progress, achievements and challenges">${icon('stats')}<span>Stats</span></button>
        <button class="icon-btn" id="btn-help" title="Show all controls">${icon('help')}<span>Help</span></button>
        <button class="icon-btn" id="btn-menu" title="Save, load and world settings">${icon('menu')}<span>Menu</span></button>
      </div>

      <div id="hotbar-wrap"><div id="hotbar"></div></div>

      <div id="toast-stack"></div>

      <div class="overlay" id="panel-stats" hidden>
        <div class="panel">
          <button class="icon-btn panel-close" data-close="panel-stats">${icon('close', 16)}</button>
          <h2>Progress</h2>
          <div class="sub" id="stats-sub"></div>
          <div class="tab-row">
            <button class="tab-btn active" data-tab="tab-overview">Overview</button>
            <button class="tab-btn" data-tab="tab-achievements">Achievements</button>
            <button class="tab-btn" data-tab="tab-challenges">Challenges</button>
          </div>
          <div class="tab-panel" id="tab-overview"></div>
          <div class="tab-panel" id="tab-achievements" hidden><div class="ach-grid" id="ach-grid"></div></div>
          <div class="tab-panel" id="tab-challenges" hidden><div id="challenge-list"></div></div>
        </div>
      </div>

      <div class="overlay" id="panel-menu" hidden>
        <div class="panel">
          <button class="icon-btn panel-close" data-close="panel-menu">${icon('close', 16)}</button>
          <h2>This world</h2>
          <div class="sub" id="menu-world-kind"></div>

          <label class="menu-name">
            <span>Name</span>
            <input type="text" id="save-name" maxlength="40" placeholder="Unnamed world" />
          </label>
          <div id="save-hint" class="export-note" hidden></div>

          <div class="mode-block">
            <div class="mode-label">Graphics <span id="gfx-fps" class="gfx-fps"></span></div>
            <div class="gfx-grid">
              <label>Resolution
                <select id="gfx-resolution">
                  <option value="auto">Auto</option>
                  <option value="1">Low (1&times;)</option>
                  <option value="1.5">Medium (1.5&times;)</option>
                  <option value="2">High (2&times;)</option>
                </select>
              </label>
              <label>View distance
                <select id="gfx-distance">
                  <option value="auto">Auto</option>
                  <option value="near">Near</option>
                  <option value="far">Far</option>
                </select>
              </label>
              <label class="gfx-check">
                <input type="checkbox" id="gfx-antialias" /> Smooth edges
              </label>
            </div>
            <div class="export-note" id="gfx-note" hidden></div>
          </div>

          <div class="mode-block">
            <div class="mode-label">Files</div>
            <div class="field-row" style="margin-bottom:0; flex-wrap:wrap;">
              <button class="secondary" id="btn-export-world">Export world</button>
              <button class="secondary" id="btn-export-vox">Export .vox</button>
              <button class="secondary" id="btn-import-world">Import a file</button>
            </div>
            <div class="export-note">A world file restores everything, designs included. The .vox opens in MagicaVoxel and Blender.</div>
          </div>

          <div class="menu-actions">
            <button class="primary" id="btn-resume">Resume</button>
            <button class="secondary" id="btn-save">Save</button>
            <button class="secondary" id="btn-leave">Leave to worlds</button>
          </div>
        </div>
      </div>

      <div class="overlay" id="panel-account" hidden>
        <div class="panel">
          <button class="icon-btn panel-close" data-close="panel-account">${icon('close', 16)}</button>
          <h2 id="account-title">Sign in</h2>
          <div class="sub" id="account-sub">Keep your worlds off this device, so they survive a cleared browser.</div>

          <div id="cloud-signed-out">
            <div class="field-row">
              <input type="email" id="cloud-email" placeholder="Email" autocomplete="email" />
            </div>
            <div class="field-row">
              <input type="password" id="cloud-password" placeholder="Password" autocomplete="current-password" />
            </div>
            <div class="field-row">
              <button class="primary" id="btn-cloud-signin">Sign in</button>
            </div>
            <div class="export-note">
              New here? <button class="home-link" id="btn-account-switch">Create an account instead</button>
            </div>
          </div>

          <div id="cloud-signed-in" hidden>
            <div class="field-row" style="flex-wrap:wrap;">
              <button class="secondary" id="btn-cloud-save">Save this world to the cloud</button>
              <button class="secondary" id="btn-cloud-refresh">Refresh</button>
              <button class="secondary" id="btn-cloud-signout">Sign out</button>
            </div>
            <div id="cloud-list"></div>
          </div>
          <div class="export-note" id="cloud-error" hidden></div>
          <div id="cloud-status" hidden></div>
          <div id="cloud-block" hidden></div>
          <div id="save-list" hidden></div>
        </div>
      </div>

      <div class="overlay" id="panel-templates" hidden>
        <div class="panel">
          <button class="icon-btn panel-close" data-close="panel-templates">${icon('close', 16)}</button>
          <h2>Designs</h2>
          <div class="sub">Aim the selector at a build, save it, then stamp it anywhere.</div>
          <div class="field-row">
            <input type="text" id="template-name" placeholder="Name this design" maxlength="40" />
            <button class="secondary" id="btn-save-template">Save selection</button>
          </div>
          <div id="template-list"></div>
        </div>
      </div>

      <div class="overlay" id="panel-help" hidden>
        <div class="panel">
          <button class="icon-btn panel-close" data-close="panel-help">${icon('close', 16)}</button>
          <h2>Controls</h2>
          <div class="sub">Everything the toolbar and sticks do.</div>
          <div id="help-body"></div>
        </div>
      </div>

      <div class="overlay" id="panel-score" hidden>
        <div class="panel">
          <button class="icon-btn panel-close" data-close="panel-score">${icon('close', 16)}</button>
          <h2>Session Complete</h2>
          <div class="sub">A lightweight read on how this build session went — just for you.</div>
          <div class="score-total" id="score-total">0</div>
          <div class="score-breakdown" id="score-breakdown"></div>
        </div>
      </div>

      <div id="touch-controls">
        <div class="stick-zone" id="stick-left">
          <div class="stick-base"><div class="stick-knob"></div></div>
        </div>
        <div class="stick-zone" id="stick-right">
          <div class="stick-base"><div class="stick-knob"></div></div>
        </div>
        <!--
          Break and Place sit over the movement stick, on the left. The right
          thumb is steering the camera the whole time it is playing, so hanging
          the two things you do most often off it meant interrupting the look
          to act. The left thumb only holds a direction, and can leave it for a
          moment. Everything that opens a panel is one button away instead of
          five across the bottom of the screen.
        -->
        <div class="touch-buttons" id="touch-buttons-left">
          <div class="row">
            <button class="touch-btn" id="t-break">${icon('mine')}<span>Break</span></button>
            <button class="touch-btn" id="t-place">${icon('place')}<span>Place</span></button>
          </div>
        </div>
        <div class="touch-buttons" id="touch-buttons-right">
          <div class="row touch-tray" id="touch-tray" hidden>
            <button class="touch-btn duilt-only" id="t-bag" hidden>${icon('bag')}<span>Bag</span></button>
            <button class="touch-btn duilt-only" id="t-build" hidden>${icon('home')}<span>Build</span></button>
            <button class="touch-btn duilt-only" id="t-bench" hidden>${icon('hammer')}<span>Bench</span></button>
            <button class="touch-btn sandbox-only" id="t-symmetry">${icon('symmetry')}<span>Mirror</span></button>
            <button class="touch-btn" id="t-fly">${icon('fly')}<span>Fly</span></button>
            <button class="touch-btn" id="t-down" hidden>${icon('down')}<span>Down</span></button>
          </div>
          <div class="row">
            <button class="touch-btn" id="t-more">${icon('menu')}<span>More</span></button>
            <button class="touch-btn" id="t-jump">${icon('up')}<span>Jump</span></button>
          </div>
        </div>
      </div>
    `;
  }

  detectTouch() {
    const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (isTouch) {
      document.body.classList.add('touch');
    }
  }

  buildHotbar() {
    const hotbar = this.q('#hotbar');
    hotbar.innerHTML = '';

    // In Duilt the hotbar is your bag: one slot per kind of thing you actually
    // hold, carrying the total across every stack of it. A wall of blocks you
    // don't own is a menu, not a hand.
    if (this.cb.isDuilt?.()) {
      const inv = this.game.duilt.inventory;
      const placeable = inv.heldIds()
        .map((id) => ({ id, spec: ITEMS_BY_ID.get(id) }))
        .filter((e) => e.spec?.block != null);

      if (!placeable.length) {
        hotbar.appendChild(el(`<div class="hotbar-empty">Nothing to build with yet — break something</div>`));
        return;
      }
      placeable.forEach((e, i) => {
        const total = inv.countOf(e.id);
        hotbar.appendChild(el(`
          <div class="hotbar-slot ${e.spec.block === this.selectedBlockId ? 'selected' : ''}"
               data-id="${e.spec.block}" data-item="${e.id}" title="${itemName(e.id)} — ${total}">
            ${i < 9 ? `<span class="key">${i + 1}</span>` : ''}
            <div class="swatch" style="background:#${e.spec.color.toString(16).padStart(6, '0')}"></div>
            <span class="held">${total}</span>
          </div>
        `));
      });
      // If what was selected has run out, fall to the first thing you do have.
      if (!placeable.some((e) => e.spec.block === this.selectedBlockId)) {
        this.selectBlock(placeable[0].spec.block);
      }
      return;
    }

    PLACEABLE_BLOCKS.forEach((b, i) => {
      const available = this.game.blockAvailability(b.id).ok;
      const affordable = !available || this.game.canAffordBlock(b.id);
      const costLabel = this.isCampaign && b.cost
        ? Object.entries(b.cost).map(([, amount]) => amount).join('')
        : '';
      const slot = el(`
        <div class="hotbar-slot ${available ? '' : 'locked'} ${available && !affordable ? 'unaffordable' : ''} ${b.id === this.selectedBlockId ? 'selected' : ''}"
             data-id="${b.id}" title="${b.name}">
          ${i < 9 ? `<span class="key">${i + 1}</span>` : ''}
          <div class="swatch" style="background:#${b.color.toString(16).padStart(6, '0')}"></div>
          ${available ? '' : `<div class="lock">${icon('lock', 15)}</div>`}
          ${costLabel ? `<span class="cost" style="--cost-dot:#${(RESOURCES_BY_ID.get(Object.keys(b.cost)[0])?.color ?? 0x999999).toString(16).padStart(6, '0')}">${costLabel}</span>` : ''}
        </div>
      `);
      hotbar.appendChild(slot);
    });
  }

  /**
   * Affordability changes on every single block placed, so update classes in
   * place — rebuilding the hotbar would reset its horizontal scroll each time.
   */
  refreshHotbarAffordability() {
    this.root.querySelectorAll('.hotbar-slot').forEach((slot) => {
      const id = Number(slot.dataset.id);
      if (slot.classList.contains('locked')) return;
      slot.classList.toggle('unaffordable', !this.game.canAffordBlock(id));
    });
  }

  /** Re-renders everything that differs between Creative and Campaign. */
  refreshForMode() {
    this.refreshForDuilt();
    document.body.classList.toggle('campaign', this.isCampaign);
    this.buildHotbar();
    this.updateResourceBar();
  }

  updateResourceBar() {
    const bar = this.q('#resource-bar');
    if (!this.isCampaign) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    bar.innerHTML = this.economy.unlockedResources().map((r) => `
      <div class="resource" title="${r.name}">
        <span class="dot" style="background:#${r.color.toString(16).padStart(6, '0')}"></span>
        <span class="amount">${Math.floor(this.economy.balanceOf(r.id))}</span>
        <span class="cap">/ ${r.baseCap}</span>
      </div>
    `).join('');
  }

  wireEvents() {
    this.home = new HomeScreen(this.q('#blocker'), {
      listWorlds: () => this.saveManager.listSaves(),
      onContinue: () => { this.cb.onLoadAutosave(); this.enterWorld(); },
      onOpen: (name) => { this.cb.onLoad(name); this.enterWorld(); },
      onRemove: (name) => {
        if (!confirm('Delete this world? This cannot be undone.')) return false;
        this.cb.onDeleteSave(name);
        return true;
      },
      // Creating and entering happen in the same gesture: pointer lock has to
      // be claimed inside the tap that asked for it.
      onCreate: (mode, name) => { this.cb.onNewWorld(mode, name); this.enterWorld(); },
      onSettings: () => { this.hideBlocker(); this.openPanel('panel-menu'); },
      onHelp: () => { this.hideBlocker(); this.openPanel('panel-help'); },
      onAccount: () => { this.hideBlocker(); this.openPanel('panel-account'); },
    });
    // The screen is already on when the page loads, so draw it now rather than
    // waiting for something to re-open it.
    this.home.render();

    this.q('#hotbar').addEventListener('click', (e) => {
      const slot = e.target.closest('.hotbar-slot');
      if (!slot) return;
      const id = Number(slot.dataset.id);
      const availability = this.game.blockAvailability(id);
      if (!availability.ok) {
        this.toast({ kind: 'xp', title: 'Locked', body: availability.reason });
        return;
      }
      this.selectBlock(id);
    });

    this.q('#btn-undo').addEventListener('click', () => this.cb.onUndo());
    this.q('#btn-redo').addEventListener('click', () => this.cb.onRedo());
    this.q('#btn-select').addEventListener('click', () => this.toggleSelector());
    this.q('#btn-symmetry').addEventListener('click', () => {
      this.symmetryMode = this.cb.onCycleSymmetry();
      this.setSymmetryLabel();
    });

    const fsBtn = this.q('#btn-fullscreen');
    if (document.fullscreenEnabled) fsBtn.addEventListener('click', () => this.cb.onToggleFullscreen());
    else fsBtn.remove();

    this.q('#btn-stats').addEventListener('click', () => this.openPanel('panel-stats'));
    this.q('#btn-help').addEventListener('click', () => this.openPanel('panel-help'));
    this.q('#btn-size').addEventListener('click', () => this.setSelectorSize(this.cb.onCycleSelectorSize()));
    this.q('#btn-templates').addEventListener('click', () => this.openPanel('panel-templates'));
    this.q('#btn-bag').addEventListener('click', () => this.cb.onOpenBag());
    this.q('#btn-buildings').addEventListener('click', () => this.cb.onOpenBuildings());
    this.q('#btn-bench').addEventListener('click', () => this.cb.onOpenBench());
    // Touch gets its own row: a 36px unlabelled square in a corner is not a
    // control anyone can find with a thumb.
    for (const [sel, fn] of [['#t-bag', 'onOpenBag'], ['#t-build', 'onOpenBuildings'], ['#t-bench', 'onOpenBench']]) {
      const btn = this.q(sel);
      const fire = (e) => { e.preventDefault(); this.closeTray(); this.cb[fn](); };
      btn.addEventListener('click', fire);
      btn.addEventListener('touchstart', fire, { passive: false });
    }

    // The tray: everything that opens something, behind one button.
    const more = this.q('#t-more');
    const toggle = (e) => { e.preventDefault(); this.toggleTray(); };
    more.addEventListener('click', toggle);
    more.addEventListener('touchstart', toggle, { passive: false });
    this.q('#btn-save-template').addEventListener('click', () => {
      const input = this.q('#template-name');
      if (this.cb.onSaveTemplate(input.value)) { input.value = ''; this.refreshTemplateList(); }
    });
    this.q('#btn-menu').addEventListener('click', () => this.cb.onOpenMenu());

    this.root.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => this.closePanel(btn.dataset.close));
    });

    this.root.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.root.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        this.root.querySelectorAll('.tab-panel').forEach((p) => (p.hidden = true));
        btn.classList.add('active');
        this.q('#' + btn.dataset.tab).hidden = false;
      });
    });

    this.wireGraphics();
    this.q('#btn-resume').addEventListener('click', () => this.cb.onResume());
    this.q('#btn-leave').addEventListener('click', () => {
      this.closePanel('panel-menu');
      this.openHome();
    });
    this.q('#btn-export-world').addEventListener('click', () => this.cb.onExportWorld(this.q('#save-name').value));
    this.q('#btn-export-vox').addEventListener('click', () => this.cb.onExportVox(this.q('#save-name').value));
    this.q('#btn-import-world').addEventListener('click', () => this.cb.onImportWorld());
    this.q('#btn-save').addEventListener('click', () => {
      // The field holds the world's name, not a separate "save as" box, so
      // saving and renaming are the same gesture — which is what you mean when
      // you edit the name and press Save.
      const input = this.q('#save-name');
      const name = input.value.trim() || this.game.worldName || `World ${new Date().toLocaleDateString()}`;
      input.value = name;
      this.cb.onRenameWorld?.(name);
      this.cb.onSave(name);
      const hint = this.q('#save-hint');
      hint.hidden = false;
      hint.textContent = `Saved. You will find "${name}" on the worlds screen.`;
    });

    this.wireTouchControls();
    this.wireCloud();
    this.duiltUI = new DuiltUI(this.root, { game: this.game, bus: this.bus, panels: this.panels });
    // The hotbar is a view of the bag in Duilt, so it re-renders with it.
    this.duiltUI.onBagChanged = () => { if (this.cb.isDuilt?.()) this.buildHotbar(); };
    this.duiltUI.onClaimType = (id) => this.cb.onClaimType(id);
    this.duiltUI.onStampStarter = (id) => this.cb.onStampStarter(id);
    this.refreshForDuilt();
  }

  /**
   * Wires one thumbstick. The base rests at its CSS home so it's discoverable,
   * then jumps to wherever the thumb lands and tracks from there. Each stick
   * claims a single touch id, so both can be driven at once.
   */
  bindStick(zoneSel, onChange, { deadZone = 0.14, curve = 1 } = {}) {
    const zone = this.q(zoneSel);
    const base = zone.querySelector('.stick-base');
    const knob = zone.querySelector('.stick-knob');
    const RADIUS = 42;
    let touchId = null;
    let origin = { x: 0, y: 0 };

    // A resting thumb never sits exactly at centre, so anything inside the dead
    // zone reads as zero. Past it the response is re-normalised from 0 so there
    // is no jump, then curved to give fine control near centre.
    const shape = (dx, dy) => {
      const mag = Math.min(1, Math.hypot(dx, dy) / RADIUS);
      if (mag < deadZone) return { x: 0, y: 0 };
      const scaled = Math.pow((mag - deadZone) / (1 - deadZone), curve) / mag;
      return { x: (dx / RADIUS) * scaled, y: (dy / RADIUS) * scaled };
    };

    // Transform, not left/top: this runs on every touchmove, and moving the
    // knob by layout forces a reflow of the whole HUD each time.
    const setKnob = (dx = 0, dy = 0) => {
      knob.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    };

    zone.addEventListener('touchstart', (e) => {
      if (touchId !== null) return;
      const t = e.changedTouches[0];
      touchId = t.identifier;
      origin = { x: t.clientX, y: t.clientY };
      // The base is positioned inside the zone, so offset by the zone's origin.
      const rect = zone.getBoundingClientRect();
      base.style.left = `${t.clientX - rect.left - 52}px`;
      base.style.top = `${t.clientY - rect.top - 52}px`;
      base.style.right = 'auto';
      base.style.bottom = 'auto';
      base.classList.add('active');
      setKnob();
      e.preventDefault();
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== touchId) continue;
        let dx = t.clientX - origin.x, dy = t.clientY - origin.y;
        const len = Math.hypot(dx, dy);
        if (len > RADIUS) { dx = (dx / len) * RADIUS; dy = (dy / len) * RADIUS; }
        setKnob(dx, dy);
        const out = shape(dx, dy);
        onChange(out.x, -out.y);
      }
      e.preventDefault();
    }, { passive: false });

    const release = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== touchId) continue;
        touchId = null;
        base.classList.remove('active');
        for (const prop of ['left', 'top', 'right', 'bottom']) base.style.removeProperty(prop);
        setKnob();
        onChange(0, 0);
      }
    };
    zone.addEventListener('touchend', release);
    zone.addEventListener('touchcancel', release);
  }

  wireTouchControls() {
    // Movement wants to reach full speed readily; the camera wants precision
    // near centre, so it gets a steeper curve.
    this.bindStick('#stick-left', (x, y) => this.cb.onMove(x, y), { deadZone: 0.10, curve: 1.1 });
    // 1.8 was too steep: a half-travel push came out at a fifth of the turn
    // rate, so the camera felt like it was lagging behind the thumb. 1.25 keeps
    // the fine control near centre and gives back the middle of the range.
    this.bindStick('#stick-right', (x, y) => this.cb.onLookStick(x, y), { deadZone: 0.09, curve: 1.25 });

    const bindHold = (sel, onChange) => {
      const el = this.q(sel);
      const set = (held) => (e) => {
        e.preventDefault();
        el.classList.toggle('active', held);
        onChange(held);
      };
      el.addEventListener('touchstart', set(true), { passive: false });
      el.addEventListener('touchend', set(false));
      el.addEventListener('touchcancel', set(false));
    };

    bindHold('#t-jump', (held) => this.cb.onJumpOrFlyUp(held));
    bindHold('#t-down', (held) => this.cb.onFlyDown(held));

    this.q('#t-fly').addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.setFlyIndicator(this.cb.onToggleFly());
    });
    this.q('#t-break').addEventListener('touchstart', (e) => { e.preventDefault(); this.cb.onBreakTap(); });
    this.q('#t-place').addEventListener('touchstart', (e) => { e.preventDefault(); this.cb.onPlaceTap(); });
    this.q('#t-symmetry').addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.symmetryMode = this.cb.onCycleSymmetry();
      this.setSymmetryLabel();
    });
  }

  wireBus() {
    this.bus.on('xp:gain', ({ amount, reason }) => {
      this.updateXp();
      if (reason) this.toast({ kind: 'xp', title: `+${amount} XP`, body: reason });
    });
    this.bus.on('level:up', ({ level }) => {
      this.updateXp();
      this.toast({ kind: 'level', title: `Level ${level}!`, body: 'Keep building to unlock more.' });
      this.buildHotbar();
    });
    this.bus.on('achievement:unlock', (a) => {
      this.toast({ kind: 'achievement', title: `${a.icon} Achievement: ${a.name}`, body: a.description });
    });
    this.bus.on('challenge:complete', (c) => {
      this.toast({ kind: 'challenge', title: 'Challenge complete!', body: c.description });
    });
    this.bus.on('block:unlock', (b) => {
      // Campaign gates blocks by resource tier, so a level-based unlock
      // announcement there would be telling the player something untrue.
      if (!this.isCampaign) this.toast({ kind: 'challenge', title: 'New block unlocked', body: b.name });
      this.buildHotbar();
    });
    this.bus.on('streak:update', ({ count }) => {
      if (count > 1) this.toast({ kind: 'xp', title: `${count}-day streak`, body: 'Back again — nice consistency.' });
    });
    this.bus.on('session:end', ({ score }) => this.showBuildScore(score));
    this.bus.on('economy:change', () => {
      this.updateResourceBar();
      if (this.isCampaign) this.refreshHotbarAffordability();
    });
    this.bus.on('economy:tier', ({ tier }) => {
      this.buildHotbar();
      this.toast({ kind: 'challenge', title: 'New tier unlocked', body: `Tier ${tier} materials are now available` });
    });
  }

  selectBlock(id) {
    this.selectedBlockId = id;
    this.root.querySelectorAll('.hotbar-slot').forEach((s) => s.classList.toggle('selected', Number(s.dataset.id) === id));
    this.cb.onSelectSlot(id);
  }

  cycleHotbarByKey(n) {
    if (this.cb.isDuilt?.()) {
      const slot = this.root.querySelectorAll('#hotbar .hotbar-slot')[n - 1];
      if (slot) this.selectBlock(Number(slot.dataset.id));
      return;
    }
    const b = PLACEABLE_BLOCKS[n - 1];
    if (!b) return;
    if (!this.game.blockAvailability(b.id).ok) return;
    this.selectBlock(b.id);
  }

  updateXp() {
    const { level, xp, required, pct } = this.gamification.xpProgress();
    this.q('#level-badge').textContent = level;
    this.q('#xp-bar-fill').style.width = `${Math.round(pct * 100)}%`;
    this.q('#xp-bar-track').title = `${xp} / ${required} XP`;
  }

  toast({ kind, title, body }) {
    const stack = this.q('#toast-stack');
    const node = el(`<div class="toast ${kind}"><div class="title">${title}</div>${body ? `<div class="body">${body}</div>` : ''}</div>`);
    stack.appendChild(node);
    setTimeout(() => {
      node.classList.add('fade-out');
      setTimeout(() => node.remove(), 320);
    }, 3400);
    while (stack.children.length > 5) stack.removeChild(stack.firstChild);
  }

  /** Fills a panel in just before it is shown, if it has anything to fill. */
  populatePanel(id) {
    if (id === 'panel-menu') {
      const kind = this.cb.isDuilt?.() ? 'Duilt' : (this.isCampaign ? 'Campaign' : 'Creative');
      const label = this.q('#menu-world-kind');
      if (label) label.textContent = `A ${kind} world`;
      const name = this.q('#save-name');
      if (name) name.value = this.game.worldName || '';
      const hint = this.q('#save-hint');
      if (hint) hint.hidden = true;
    }
    if (id === 'panel-stats') this.populateStats();
    if (id === 'panel-help') this.populateHelp();
    if (id === 'panel-templates') this.refreshTemplateList();
    // The Duilt panels draw their own contents.
    this.duiltUI?.populate(id);
  }

  openPanel(id) {
    this.panels.open(id);
  }

  closePanel(id) {
    this.panels.close(id);
  }

  /** Escape, and anything else that means "put away whatever is in front of me". */
  closeTopPanel() {
    return this.panels.closeTop();
  }

  closeAllPanels() {
    return this.panels.closeAll();
  }

  isAnyPanelOpen() {
    return this.panels.anyOpen();
  }

  /** Whether the worlds screen is up, i.e. nobody has entered a world yet. */
  isHomeOpen() {
    return !this.q('#blocker').hidden;
  }

  populateStats() {
    const s = this.gamification.snapshot();
    this.q('#stats-sub').textContent = `Level ${s.level} · ${s.totalBlocksPlaced} blocks placed · ${s.streakCount}-day streak`;

    this.q('#tab-overview').innerHTML = `
      <div class="stat-row"><span>Total blocks placed</span><span>${s.totalBlocksPlaced}</span></div>
      <div class="stat-row"><span>Total blocks broken</span><span>${s.totalBlocksBroken}</span></div>
      <div class="stat-row"><span>Block types discovered</span><span>${s.distinctTypesPlacedEver.size} / ${PLACEABLE_BLOCKS.length}</span></div>
      <div class="stat-row"><span>Highest placement</span><span>y = ${s.maxHeightPlaced}</span></div>
      <div class="stat-row"><span>Current streak</span><span>${s.streakCount} day${s.streakCount === 1 ? '' : 's'}</span></div>
      <div class="stat-row"><span>Challenges completed</span><span>${s.challengesCompletedTotal}</span></div>
      <div class="stat-row"><span>Achievements unlocked</span><span>${s.achievementsUnlocked.size} / ${ACHIEVEMENTS.length}</span></div>
    `;

    const achGrid = this.q('#ach-grid');
    achGrid.innerHTML = ACHIEVEMENTS.map((a) => {
      const unlocked = s.achievementsUnlocked.has(a.id);
      return `<div class="ach-card ${unlocked ? '' : 'locked'}">
        <div class="ach-icon">${a.icon}</div>
        <div><div class="ach-name">${a.name}</div><div class="ach-desc">${a.description}</div></div>
      </div>`;
    }).join('');

    const dc = s.dailyChallenge;
    const list = this.q('#challenge-list');
    list.innerHTML = dc.ids.map((id) => {
      const c = CHALLENGES_BY_ID.get(id);
      if (!c) return '';
      const done = dc.completed.includes(id);
      return `<div class="challenge-card ${done ? 'done' : ''}">
        <div>${done ? '✅' : '🎯'} ${c.description}</div>
        <div class="reward">${done ? 'Completed' : `Reward: +${c.xpReward} XP${c.unlockBlock ? ' + early block unlock' : ''}`}</div>
      </div>`;
    }).join('');
  }

  refreshSaveList() {
    this.refreshCloudPanel();
    const saves = this.saveManager.listSaves().filter((s) => !s.isAutosave);
    const list = this.q('#save-list');
    if (!saves.length) {
      list.innerHTML = `<div class="sub">No saves yet.</div>`;
      return;
    }
    list.innerHTML = saves.map((s) => `
      <div class="save-row" data-name="${s.name}">
        <div><div>${s.name}</div><div class="meta">${fmtTime(s.timestamp)}</div></div>
        <div class="actions">
          <button class="secondary" data-load="${s.name}">Load</button>
          <button class="danger secondary" data-delete="${s.name}">Delete</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('[data-load]').forEach((btn) => btn.addEventListener('click', () => this.cb.onLoad(btn.dataset.load)));
    list.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', () => {
      if (confirm('Delete this save?')) { this.cb.onDeleteSave(btn.dataset.delete); this.refreshSaveList(); }
    }));
  }

  showBuildScore(score) {
    if (!score) return;
    this.q('#score-total').textContent = score.totalScore;
    this.q('#score-breakdown').innerHTML = `
      ${row('Size', score.sizeScore)}
      ${row('Variety', score.varietyScore)}
      ${row('Height', score.heightScore)}
      <div class="sub" style="margin-top:6px;">${score.blocksPlaced} blocks · ${score.distinctTypes} types · ${score.heightRange} block height range</div>
    `;
    this.openPanel('panel-score');
    function row(label, value) {
      return `<div class="score-bar-row"><span style="width:56px;">${label}</span><div class="score-bar-track"><div class="score-bar-fill" style="width:${value}%"></div></div><span>${value}</span></div>`;
    }
  }

  /**
   * The start screen, told what world it is actually starting.
   *
   * Someone who played before this mode existed comes back to whatever they
   * had saved, which may be a plain sandbox — and then the bag, the buildings
   * and the goals are all missing with nothing on screen to say why. So when
   * the restored world is not a Duilt one, the way into Duilt is offered right
   * here instead of three taps down a menu.
   */
  /** Leaves the worlds screen and takes control of the world behind it. */
  enterWorld() {
    this.hideBlocker();
    this.cb.onRequestStart();
  }

  /** Brings up the worlds screen, always at the top of the journey. */
  openHome() {
    this.home?.reset();
    this.showBlocker();
  }

  /** Label on the worlds screen, so you can see whether you are signed in. */
  refreshAccountLabel() {
    const user = this.cb.getCloudUser?.();
    this.home?.setAccount(user ? (user.email || user.name || 'Account') : 'Sign in');
  }

  hideBlocker() {
    this.q('#blocker').hidden = true;
  }

  // ---- cloud ----

  wireCloud() {
    if (!this.cb.isCloudConfigured?.()) return;
    const busy = async (btn, fn) => {
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Working\u2026';
      this.q('#cloud-error').hidden = true;
      try {
        await fn();
      } catch (err) {
        const box = this.q('#cloud-error');
        box.textContent = err.message;
        box.hidden = false;
      } finally {
        btn.disabled = false;
        btn.textContent = label;
        this.refreshCloudPanel();
      }
    };
    const creds = () => [this.q('#cloud-email').value.trim(), this.q('#cloud-password').value];

    // One or the other, never both at once. Two equally weighted buttons under
    // one password field is a guess about which one you meant, and getting it
    // wrong means either "that account exists" or "no such account" when you
    // did nothing wrong.
    this.accountMode = 'signin';
    const applyAccountMode = () => {
      const creating = this.accountMode === 'create';
      this.q('#account-title').textContent = creating ? 'Create an account' : 'Sign in';
      this.q('#account-sub').textContent = creating
        ? 'Your worlds follow the account, so a cleared browser or a new phone keeps them.'
        : 'Keep your worlds off this device, so they survive a cleared browser.';
      this.q('#btn-cloud-signin').textContent = creating ? 'Create account' : 'Sign in';
      this.q('#btn-account-switch').textContent = creating
        ? 'I already have an account' : 'Create an account instead';
      this.q('#cloud-password').setAttribute('autocomplete', creating ? 'new-password' : 'current-password');
    };
    applyAccountMode();
    this.q('#btn-account-switch').addEventListener('click', () => {
      this.accountMode = this.accountMode === 'create' ? 'signin' : 'create';
      applyAccountMode();
    });
    this.q('#btn-cloud-signin').addEventListener('click', (e) => busy(e.currentTarget, () =>
      this.accountMode === 'create' ? this.cb.onCloudSignUp(...creds()) : this.cb.onCloudSignIn(...creds())));
    this.q('#btn-cloud-signout').addEventListener('click', (e) => busy(e.currentTarget, () => this.cb.onCloudSignOut()));
    this.q('#btn-cloud-refresh').addEventListener('click', (e) => busy(e.currentTarget, () => this.refreshCloudList()));
    this.q('#btn-cloud-save').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      await this.cb.onCloudSave(this.q('#save-name').value.trim() || undefined);
      await this.refreshCloudList();
    }));
  }

  /** Switches the panel between signed-out and signed-in, and hides it entirely when unconfigured. */
  refreshCloudPanel() {
    const block = this.q('#cloud-block');
    if (!block) return;
    if (!this.cb.isCloudConfigured?.()) { block.hidden = true; return; }
    block.hidden = false;

    // First time the panel is seen, go and look for an existing session. Until
    // that resolves the signed-out form is the honest thing to show.
    if (!this.cloudRestoreStarted) {
      this.cloudRestoreStarted = true;
      this.cb.onCloudRestoreSession?.().then(() => this.refreshCloudPanel());
    }

    const user = this.cb.getCloudUser();
    this.q('#cloud-status').textContent = user ? `\u00b7 ${user.email || user.name || 'signed in'}` : '';
    this.q('#cloud-signed-out').hidden = !!user;
    this.q('#cloud-signed-in').hidden = !user;
    if (user) this.refreshCloudList();
    this.refreshAccountLabel();
  }

  async refreshCloudList() {
    const list = this.q('#cloud-list');
    if (!list || !this.cb.getCloudUser()) return;
    let worlds = [];
    try {
      worlds = await this.cb.getCloudWorlds();
    } catch (err) {
      list.innerHTML = `<div class="sub" style="margin:0;">${err.message}</div>`;
      return;
    }
    if (!worlds.length) {
      list.innerHTML = `<div class="sub" style="margin:0;">Nothing up there yet. Save this world to put it in the cloud.</div>`;
      return;
    }
    list.innerHTML = worlds.map((w) => `
      <div class="template-row">
        <div class="template-meta">
          <div class="template-name">${escapeHtml(w.name)}</div>
          <div class="template-dims">${w.mode} &middot; ${w.blockCount.toLocaleString()} blocks &middot; ${timeAgo(w.updatedAt)}</div>
        </div>
        <div class="actions">
          <button class="secondary" data-restore="${w.id}">Restore</button>
          <button class="danger secondary" data-cloud-drop="${w.id}">Delete</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('[data-restore]').forEach((btn) => btn.addEventListener('click', async () => {
      btn.disabled = true;
      try { await this.cb.onCloudRestore(btn.dataset.restore); }
      catch (err) { const box = this.q('#cloud-error'); box.textContent = err.message; box.hidden = false; }
      finally { btn.disabled = false; }
    }));
    list.querySelectorAll('[data-cloud-drop]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Delete this world from the cloud? Your local copy stays.')) return;
      btn.disabled = true;
      try { await this.cb.onCloudDelete(btn.dataset.cloudDrop); await this.refreshCloudList(); }
      catch (err) { const box = this.q('#cloud-error'); box.textContent = err.message; box.hidden = false; }
      finally { btn.disabled = false; }
    }));
  }

  /** Shown while the mouse is free, so the toolbar is usable without a panel in the way. */
  setResumeHint(on) {
    this.q('#resume-hint').hidden = !on;
  }

  showBlocker() {
    this.home?.render();
    this.q('#blocker').hidden = false;
  }

  setFlyIndicator(flying) {
    this.q('#t-fly').classList.toggle('active', flying);
    this.q('#t-down').hidden = !flying; // descend only means anything while flying
  }

  /** Turns the selector on and opens the designs panel — the whole flow in one place. */
  toggleSelector() {
    const active = this.cb.onToggleSelection();
    this.q('#btn-select').classList.toggle('active', active);
    this.toast({
      kind: 'xp',
      title: active ? 'Selector on' : 'Selector off',
      body: active ? 'Aim it, then use Designs to save or stamp' : '',
    });
    return active;
  }

  /**
   * The tray of panel buttons on touch.
   *
   * Five buttons across the bottom of a phone is most of the bottom of the
   * phone. They open panels, which is not something you do mid-swing, so they
   * live behind one button and the screen goes back to being the game.
   */
  toggleTray() {
    const tray = this.q('#touch-tray');
    if (!tray) return;
    tray.hidden = !tray.hidden;
    this.q('#t-more')?.classList.toggle('active', !tray.hidden);
  }

  closeTray() {
    const tray = this.q('#touch-tray');
    if (!tray || tray.hidden) return;
    tray.hidden = true;
    this.q('#t-more')?.classList.remove('active');
  }

  /** Shows or hides everything that only exists in Duilt. */
  /**
   * The graphics controls.
   *
   * These exist because the artifacts that matter most — edges that crawl,
   * distant surfaces that trade places — depend on the machine drawing them,
   * and cannot be found from here. Someone seeing one can change a single
   * setting and know immediately whether that was it.
   */
  wireGraphics() {
    const g = this.game.graphics ?? {};
    const res = this.q('#gfx-resolution'), dist = this.q('#gfx-distance'), aa = this.q('#gfx-antialias');
    res.value = String(g.resolution ?? 'auto');
    dist.value = String(g.distance ?? 'auto');
    aa.checked = g.antialias !== false;

    const apply = () => {
      const resolution = res.value === 'auto' ? 'auto' : Number(res.value);
      const result = this.game.applyGraphics({
        resolution,
        distance: dist.value,
        antialias: aa.checked,
        smoothing: resolution === 'auto',
      });
      const note = this.q('#gfx-note');
      note.hidden = !result?.needsReload;
      if (result?.needsReload) note.textContent = 'Smooth edges applies when you reload the page.';
    };
    res.addEventListener('change', apply);
    dist.addEventListener('change', apply);
    aa.addEventListener('change', apply);

    // A live frame rate, so a change can be judged on more than a feeling.
    setInterval(() => {
      const el = this.q('#gfx-fps');
      if (!el || this.q('#panel-menu').hidden) return;
      const fps = this.game.quality?.fps;
      const at = this.game.quality?.resolution;
      el.textContent = fps ? `${fps} fps at ${at}\u00d7` : '';
    }, 500);
  }

  refreshForDuilt() {
    const on = !!this.cb.isDuilt?.();
    this.root.querySelectorAll('.duilt-only').forEach((el) => { el.hidden = !on; });
    this.root.querySelectorAll('.sandbox-only').forEach((el) => { el.hidden = on; });
    this.duiltUI?.setActive(on);
  }

  toggleBag() { return this.duiltUI?.toggleBag(); }
  openClaim(region, onClaim) { this.duiltUI?.openClaim(region, onClaim); }
  openDuiltPanel(id) { this.duiltUI?.openPanel(id); }

  setSelectorSize(size) {
    this.q('#size-label').innerHTML = `${size}&sup3;`;
  }

  /**
   * Live state of the selector, next to the crosshair. Without it the selector
   * gives no feedback at all until you open a panel.
   */
  setSelectorReadout(state) {
    const el = this.q('#selector-readout');
    if (!state) { el.hidden = true; this.setActionLabels('Break', 'Place'); return; }
    el.hidden = false;
    this.q('#sel-dims').innerHTML = `${state.size}&sup3;`;
    this.q('#sel-count').textContent = `${state.blocks} block${state.blocks === 1 ? '' : 's'} inside`;
    const touch = document.body.classList.contains('touch');
    const primary = state.template ? `Stamp ${state.template}` : 'Save design';
    this.q('#sel-hint').textContent = touch
      ? `${primary} \u00b7 Size`
      : `Left click: ${primary.toLowerCase()} \u00b7 right click: change size`;
    // On touch the two action buttons are the only way to reach either, so they
    // say what they do while the selector is on.
    this.setActionLabels(primary, 'Size');
  }

  /** Retitles the touch Break/Place buttons, which change meaning with the selector. */
  setActionLabels(breakLabel, placeLabel) {
    const b = this.q('#t-break'), p = this.q('#t-place');
    if (!b || !p) return;
    b.querySelector('span').textContent = breakLabel;
    p.querySelector('span').textContent = placeLabel;
  }

  openTemplateSavePrompt() {
    this.openPanel('panel-templates');
    this.q('#template-name').focus();
  }

  refreshTemplateList() {
    const list = this.q('#template-list');
    const templates = this.cb.getTemplates();
    if (!templates.length) {
      list.innerHTML = `<div class="sub" style="margin:0;">No designs yet. Turn on the selector, frame part of your build, then save it.</div>`;
      return;
    }
    list.innerHTML = templates.map((t) => `
      <div class="template-row">
        <div class="template-meta">
          <div class="template-name">${t.name}</div>
          <div class="template-dims">${t.size}&sup3; &middot; ${t.blockCount} blocks &middot; ${t.distinctTypes} types</div>
        </div>
        <div class="actions">
          <button class="secondary" data-place="${t.id}">Stamp</button>
          <button class="danger secondary" data-drop="${t.id}">Delete</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('[data-place]').forEach((btn) => btn.addEventListener('click', () => {
      if (this.cb.onPickTemplate(btn.dataset.place)) {
        this.q('#btn-select').classList.add('active');
        this.closePanel('panel-templates');
      }
    }));
    list.querySelectorAll('[data-drop]').forEach((btn) => btn.addEventListener('click', () => {
      if (confirm('Delete this design?')) { this.cb.onDeleteTemplate(btn.dataset.drop); this.refreshTemplateList(); }
    }));
  }

  setSymmetryLabel() {
    const label = this.symmetryMode === 'off' ? 'Mirror' : `Mirror ${this.symmetryMode.toUpperCase()}`;
    const on = this.symmetryMode !== 'off';
    for (const sel of ['#btn-symmetry', '#t-symmetry']) {
      const btn = this.q(sel);
      if (!btn) continue;
      btn.querySelector('span').textContent = label;
      btn.classList.toggle('active', on);
    }
  }

  populateHelp() {
    const touch = document.body.classList.contains('touch');
    const rows = [
      ['Move', touch ? 'Left stick' : 'W A S D'],
      ['Look around', touch ? 'Right stick' : 'Move the mouse'],
      ['Break a block', touch ? 'Break button' : 'Left click'],
      ['Place a block', touch ? 'Place button' : 'Right click'],
      ['Jump', touch ? 'Jump button' : 'Space'],
      ['Fly on and off', touch ? 'Fly button' : 'F'],
      ['Rise / descend while flying', touch ? 'Jump and Down buttons' : 'Space / Shift'],
      ['Pick a block', touch ? 'Tap the palette' : 'Keys 1-9, or click the palette'],
      ['Undo / Redo', touch ? 'Undo and Redo buttons' : 'Ctrl+Z / Ctrl+Y'],
      ['Open the menu', touch ? 'Menu button' : 'Esc'],
    ];
    const tools = [
      ['Select', 'Turns the selector box on. Aim it at your build \u2014 it snaps to a grid so designs line up.'],
      ['Size', 'Cycles the selector between 2\u00b3, 4\u00b3, 8\u00b3 and 16\u00b3 (one chunk wide).'],
      ['Designs', 'Save whatever is inside the selector as a named design, then stamp it anywhere. Press R to rotate before placing.'],
      ['Mirror', 'Every block you place is echoed across the world\u2019s centre line. Press again to cycle X, Z, both, off.'],
      ['Screen', 'Enters or leaves fullscreen.'],
      ['Stats', 'Your level, achievements and today\u2019s challenges.'],
      ['Menu', 'Saving and loading, export and import, new worlds, and cloud sync if you sign in.'],
    ];
    this.q('#help-body').innerHTML = `
      <div class="help-group">
        <div class="help-title">Playing</div>
        ${rows.map(([what, how]) => `<div class="help-row"><span>${what}</span><span class="help-key">${how}</span></div>`).join('')}
      </div>
      <div class="help-group">
        <div class="help-title">Toolbar</div>
        ${tools.map(([name, desc]) => `<div class="help-tool"><strong>${name}</strong><span>${desc}</span></div>`).join('')}
      </div>`;
  }

  setFullscreenIndicator(isFullscreen) {
    const btn = this.q('#btn-fullscreen');
    if (!btn) return;
    btn.classList.toggle('active', isFullscreen);
    btn.title = isFullscreen ? 'Exit fullscreen' : 'Toggle fullscreen';
  }
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function timeAgo(ms) {
  if (!ms) return 'just now';
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
