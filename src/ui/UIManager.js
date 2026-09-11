import { PLACEABLE_BLOCKS } from '../config/blocks.js';
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
            <p>Left stick: push up/down to walk, left/right to turn &middot; drag anywhere to look around</p>
            <p>⛏ breaks &middot; 🧱 places &middot; ✈ toggles fly &middot; ⤴⤵ rise and descend while flying</p>
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
        <button class="icon-btn" id="btn-undo" title="Undo">↺</button>
        <button class="icon-btn" id="btn-redo" title="Redo">↻</button>
        <button class="icon-btn" id="btn-select" title="Selection tool">▦</button>
        <button class="icon-btn" id="btn-copy" title="Copy selection">⧉</button>
        <button class="icon-btn" id="btn-paste" title="Paste">📋</button>
        <button class="icon-btn" id="btn-symmetry" title="Cycle symmetry mode">⇄</button>
        <button class="icon-btn" id="btn-fullscreen" title="Toggle fullscreen">⛶</button>
        <button class="icon-btn" id="btn-stats" title="Stats & Achievements">📊</button>
        <button class="icon-btn" id="btn-menu" title="Menu">☰</button>
      </div>

      <div id="hotbar-wrap"><div id="hotbar"></div></div>

      <div id="toast-stack"></div>

      <div class="overlay" id="panel-stats" hidden>
        <div class="panel">
          <button class="icon-btn panel-close" data-close="panel-stats">✕</button>
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
          <button class="icon-btn panel-close" data-close="panel-menu">✕</button>
          <h2>Menu</h2>
          <div class="sub">Fly mode, saving, and loading worlds.</div>
          <div class="field-row">
            <input type="text" id="save-name" placeholder="Save name" maxlength="40" />
            <button class="secondary" id="btn-save">Save</button>
          </div>
          <div id="save-list"></div>
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

      <div class="overlay" id="panel-score" hidden>
        <div class="panel">
          <button class="icon-btn panel-close" data-close="panel-score">✕</button>
          <h2>Session Complete</h2>
          <div class="sub">A lightweight read on how this build session went — just for you.</div>
          <div class="score-total" id="score-total">0</div>
          <div class="score-breakdown" id="score-breakdown"></div>
        </div>
      </div>

      <div id="touch-controls">
        <div id="look-zone"></div>
        <div id="joystick-zone">
          <div id="joystick-base"><div id="joystick-knob"></div></div>
        </div>
        <div id="touch-buttons">
          <div class="row">
            <button class="touch-btn wide" id="t-symmetry">Sym</button>
            <button class="touch-btn" id="t-fly">✈</button>
          </div>
          <div class="row">
            <button class="touch-btn" id="t-break">⛏</button>
            <button class="touch-btn" id="t-place">🧱</button>
          </div>
          <div class="row">
            <button class="touch-btn" id="t-down" hidden>⤵</button>
            <button class="touch-btn" id="t-jump">⤴</button>
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
          ${available ? '' : `<div class="lock">🔒</div>`}
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
    this.q('#btn-select').addEventListener('click', () => {
      this.selectionActive = this.cb.onToggleSelection();
      this.q('#btn-select').classList.toggle('active', this.selectionActive);
    });
    this.q('#btn-copy').addEventListener('click', () => this.cb.onCopy());
    this.q('#btn-paste').addEventListener('click', () => this.cb.onPaste());
    this.q('#btn-symmetry').addEventListener('click', () => {
      this.symmetryMode = this.cb.onCycleSymmetry();
      this.q('#btn-symmetry').textContent = this.symmetryMode === 'off' ? '⇄' : `⇄ ${this.symmetryMode.toUpperCase()}`;
    });

    const fsBtn = this.q('#btn-fullscreen');
    if (document.fullscreenEnabled) fsBtn.addEventListener('click', () => this.cb.onToggleFullscreen());
    else fsBtn.remove();

    this.q('#btn-stats').addEventListener('click', () => this.openPanel('panel-stats'));
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

  wireTouchControls() {
    const joyZone = this.q('#joystick-zone');
    const joyBase = this.q('#joystick-base');
    const joyKnob = this.q('#joystick-knob');
    let joyId = null, joyOrigin = { x: 0, y: 0 };
    const radius = 42;
    const KNOB_HOME = 29;

    const centerKnob = (dx = 0, dy = 0) => {
      joyKnob.style.left = `${KNOB_HOME + dx}px`;
      joyKnob.style.top = `${KNOB_HOME + dy}px`;
    };

    joyZone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      joyId = t.identifier;
      joyOrigin = { x: t.clientX, y: t.clientY };
      // The base is positioned within the zone, so offset by the zone's origin.
      const rect = joyZone.getBoundingClientRect();
      joyBase.style.left = `${t.clientX - rect.left - 52}px`;
      joyBase.style.top = `${t.clientY - rect.top - 52}px`;
      joyBase.style.bottom = 'auto';
      joyBase.classList.add('active');
      centerKnob();
      e.preventDefault();
    }, { passive: false });

    joyZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        let dx = t.clientX - joyOrigin.x, dy = t.clientY - joyOrigin.y;
        const len = Math.hypot(dx, dy);
        if (len > radius) { dx = (dx / len) * radius; dy = (dy / len) * radius; }
        centerKnob(dx, dy);
        this.cb.onMove(dx / radius, -dy / radius);
      }
      e.preventDefault();
    }, { passive: false });

    const endJoy = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        joyId = null;
        joyBase.classList.remove('active');
        joyBase.style.removeProperty('left');
        joyBase.style.removeProperty('top');
        joyBase.style.removeProperty('bottom');
        centerKnob();
        this.cb.onMove(0, 0);
      }
    };
    joyZone.addEventListener('touchend', endJoy);
    joyZone.addEventListener('touchcancel', endJoy);

    const lookZone = this.q('#look-zone');
    let lookId = null, lastX = 0, lastY = 0;
    lookZone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      lookId = t.identifier;
      lastX = t.clientX; lastY = t.clientY;
    });
    lookZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        const dx = t.clientX - lastX, dy = t.clientY - lastY;
        lastX = t.clientX; lastY = t.clientY;
        this.cb.onLook(dx * 0.0028, dy * 0.0028);
      }
    });
    const endLook = (e) => { for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null; };
    lookZone.addEventListener('touchend', endLook);
    lookZone.addEventListener('touchcancel', endLook);

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
      this.q('#t-symmetry').textContent = this.symmetryMode === 'off' ? 'Sym' : this.symmetryMode.toUpperCase();
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
    this.q('#' + id).hidden = false;
  }

  closePanel(id) {
    this.q('#' + id).hidden = true;
  }

  isAnyPanelOpen() {
    return ['panel-stats', 'panel-menu', 'panel-score'].some((id) => !this.q('#' + id).hidden);
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

  setFullscreenIndicator(isFullscreen) {
    const btn = this.q('#btn-fullscreen');
    if (!btn) return;
    btn.classList.toggle('active', isFullscreen);
    btn.title = isFullscreen ? 'Exit fullscreen' : 'Toggle fullscreen';
  }
}
