import { PLACEABLE_BLOCKS } from '../config/blocks.js';
import { icon } from './icons.js';
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

      <div id="blocker" class="overlay">
        <div class="card">
          <h1>Voxel Sandbox</h1>
          <div class="desktop-only">
            <p>Move: <span class="hint-key">WASD</span> &nbsp; Jump: <span class="hint-key">Space</span> &nbsp; Fly: <span class="hint-key">F</span></p>
            <p>Break: <span class="hint-key">Left Click</span> &nbsp; Place: <span class="hint-key">Right Click</span> &nbsp; Hotbar: <span class="hint-key">1-9</span></p>
            <p>Undo/Redo: <span class="hint-key">Ctrl+Z</span> / <span class="hint-key">Ctrl+Y</span> &nbsp; Menu: <span class="hint-key">Esc</span></p>
          </div>
          <div class="touch-only" hidden>
            <p>Left stick moves &middot; right stick looks around</p>
            <p>Buttons on each side break, place, fly and jump &middot; tap Help any time</p>
          </div>
          <button class="primary" id="btn-play">Play</button>
        </div>
      </div>

      <div id="hud-top">
        <div id="level-badge">1</div>
        <div id="xp-bar-track"><div id="xp-bar-fill"></div></div>
      </div>

      <div id="resource-bar" hidden></div>

      <div id="top-buttons">
        <button class="icon-btn" id="btn-undo" title="Undo the last change">${icon('undo')}<span>Undo</span></button>
        <button class="icon-btn" id="btn-redo" title="Redo the change you undid">${icon('redo')}<span>Redo</span></button>
        <button class="icon-btn" id="btn-select" title="Selector: aim a grid-snapped box at your build">${icon('select')}<span>Select</span></button>
        <button class="icon-btn" id="btn-size" title="Change the selector size">${icon('copy')}<span id="size-label">8&sup3;</span></button>
        <button class="icon-btn" id="btn-templates" title="Your saved building templates">${icon('paste')}<span>Designs</span></button>
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
          <h2>Menu</h2>
          <div class="sub">Fly mode, saving, and loading worlds.</div>
          <div class="field-row">
            <input type="text" id="save-name" placeholder="Save name" maxlength="40" />
            <button class="secondary" id="btn-save">Save</button>
          </div>
          <div id="save-list"></div>
          <div class="mode-block">
            <div class="mode-label">Export and import</div>
            <div class="field-row" style="margin-bottom:0; flex-wrap:wrap;">
              <button class="secondary" id="btn-export-world">Export world</button>
              <button class="secondary" id="btn-export-vox">Export .vox</button>
              <button class="secondary" id="btn-import-world">Import a file</button>
            </div>
            <div class="export-note">A world file restores everything, designs included. The .vox opens in MagicaVoxel and Blender.</div>
          </div>
          <div class="mode-block">
            <div class="mode-label">New world</div>
            <div class="field-row" style="margin-bottom:0;">
              <button class="secondary mode-btn" data-mode="campaign">
                <strong>Campaign</strong><span>Empty ground, blocks cost resources</span>
              </button>
              <button class="secondary mode-btn" data-mode="creative">
                <strong>Creative</strong><span>Generated terrain, build freely</span>
              </button>
            </div>
          </div>
          <div class="field-row" style="margin-top:14px;">
            <button class="secondary" id="btn-resume">Resume</button>
          </div>
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
        <div class="touch-buttons" id="touch-buttons-left">
          <div class="row">
            <button class="touch-btn" id="t-symmetry">${icon('symmetry')}<span>Mirror</span></button>
            <button class="touch-btn" id="t-fly">${icon('fly')}<span>Fly</span></button>
          </div>
        </div>
        <div class="touch-buttons" id="touch-buttons-right">
          <div class="row">
            <button class="touch-btn" id="t-break">${icon('mine')}<span>Break</span></button>
            <button class="touch-btn" id="t-place">${icon('place')}<span>Place</span></button>
          </div>
          <div class="row">
            <button class="touch-btn" id="t-down" hidden>${icon('down')}<span>Down</span></button>
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
      this.q('.desktop-only').hidden = true;
      this.q('.touch-only').hidden = false;
      this.q('#btn-play').textContent = 'Tap to Play';
    }
  }

  buildHotbar() {
    const hotbar = this.q('#hotbar');
    hotbar.innerHTML = '';
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
    this.q('#btn-play').addEventListener('click', () => this.cb.onRequestStart());

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

    this.q('#btn-resume').addEventListener('click', () => this.cb.onResume());
    this.q('#btn-export-world').addEventListener('click', () => this.cb.onExportWorld(this.q('#save-name').value));
    this.q('#btn-export-vox').addEventListener('click', () => this.cb.onExportVox(this.q('#save-name').value));
    this.q('#btn-import-world').addEventListener('click', () => this.cb.onImportWorld());
    this.root.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        const label = mode === 'campaign' ? 'Campaign' : 'Creative';
        if (confirm(`Start a new ${label} world? Unsaved changes will be lost.`)) this.cb.onNewWorld(mode);
      });
    });
    this.q('#btn-save').addEventListener('click', () => {
      const input = this.q('#save-name');
      const name = input.value.trim() || `World ${new Date().toLocaleDateString()}`;
      this.cb.onSave(name);
      input.value = '';
      this.refreshSaveList();
    });

    this.wireTouchControls();
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
    const KNOB_HOME = 29;
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

    const setKnob = (dx = 0, dy = 0) => {
      knob.style.left = `${KNOB_HOME + dx}px`;
      knob.style.top = `${KNOB_HOME + dy}px`;
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
    this.bindStick('#stick-left', (x, y) => this.cb.onMove(x, y), { deadZone: 0.12, curve: 1.15 });
    this.bindStick('#stick-right', (x, y) => this.cb.onLookStick(x, y), { deadZone: 0.14, curve: 1.8 });

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

  openPanel(id) {
    if (id === 'panel-stats') this.populateStats();
    if (id === 'panel-help') this.populateHelp();
    if (id === 'panel-templates') this.refreshTemplateList();
    this.q('#' + id).hidden = false;
  }

  closePanel(id) {
    this.q('#' + id).hidden = true;
  }

  isAnyPanelOpen() {
    return ['panel-stats', 'panel-menu', 'panel-score', 'panel-help', 'panel-templates'].some((id) => !this.q('#' + id).hidden);
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

  hideBlocker() {
    this.q('#blocker').hidden = true;
  }

  showBlocker() {
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

  setSelectorSize(size) {
    this.q('#size-label').innerHTML = `${size}&sup3;`;
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
