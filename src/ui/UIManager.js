import { PLACEABLE_BLOCKS } from '../config/blocks.js';
import { icon } from './icons.js';
import { renderPanels, panelDef } from './Panel.js';
import { DuiltUI } from './DuiltUI.js';
import { HomeScreen } from './HomeScreen.js';
import { Panels } from './Panels.js';
import { ITEMS_BY_ID, itemName } from '../config/items.js';
import { glyphSvg } from '../config/glyphs.js';
import { cubeSvg, itemIcon } from '../config/cubes.js';
import { ACHIEVEMENTS, goalBands } from '../config/achievements.js';
import { CHALLENGES_BY_ID } from '../config/challenges.js';
import { menuFor, MENU_BY_ID, HAS_DEV_SECTIONS } from '../config/menu.js';
import { ROOFS, roofProfileSvg } from '../config/roofs.js';
import { CLEARS, clearArtSvg } from '../config/clears.js';

/**
 * Items that act on the world directly through Break/Place while selected,
 * rather than being placed as a block or spent as a crafting ingredient.
 * Only the bucket does this today — see Game.js's fillBucket/emptyBucket.
 */
const TOOL_HOTBAR_IDS = ['bucket', 'bucket_water'];

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
  constructor(root, { bus, game, callbacks }) {
    this.bus = bus;
    this.game = game;
    this.cb = callbacks;
    this.selectedBlockId = 1;
    // The bucket, and nothing else yet — see TOOL_HOTBAR_IDS. Selecting a
    // tool and selecting a block are mutually exclusive: exactly one hotbar
    // slot is ever highlighted.
    this.selectedItemId = null;
    this.selectionActive = false;

    // Before the markup, because what it decides — a phone or not — is read
    // while the rest of this constructor builds. The goal list asks it, and
    // used to be built two lines too early to get an answer.
    this.detectTouch();
    this.devOpen = false;   // the workshop end of the menu, folded away

    root.innerHTML = this.markup();
    this.root = root;
    this.q = (sel) => root.querySelector(sel);

    // Every `.overlay` with an id is a panel, including the ones the Duilt
    // layer adds later. The worlds screen is an overlay too but is not a panel:
    // Escape must not dismiss it into a world nobody chose.
    this.panels = new Panels(root, { screens: ['blocker'] });
    this.panels.onOpen((id) => this.populatePanel(id));
    this.panels.onClose((id) => this.duiltUI?.onPanelClosed(id));

    this.buildHotbar();
    this.wireEvents();
    this.wireBus();
    this.updateXp();
  }

  // Read live off the game: both engines are replaced wholesale on New World,
  // so a stored reference would go stale.
  get gamification() { return this.game.gamification; }
  get economy() { return this.game.economy; }

  markup() {
    return `
      <div id="crosshair"></div>

      <div id="blocker" class="overlay"></div>

      <div id="hud-top">
        <div id="level-badge">1</div>
        <div id="xp-bar-track"><div id="xp-bar-fill"></div></div>
      </div>

      <div id="resume-hint" hidden>Click the world to look around again</div>

      <!--
        What a queued tool is about to do, by the crosshair. There is no tool
        mode any more — you pick a roof or a design and it waits to be put
        somewhere — so this is the only thing that says the game is holding
        something on your behalf.
      -->
      <div id="tool-readout" hidden>
        <div class="sel-head"><span id="tool-name"></span><span id="tool-target"></span></div>
        <div class="sel-hint" id="tool-hint"></div>
        <!--
          The way out, on the thing it gets you out of.
          Both thumb buttons are taken while a tool is queued — one places it,
          one turns it — so without this there was no way off a roof at all
          except the key a phone does not have.
        -->
        <button id="tool-cancel">Put it away</button>
      </div>

      <!--
        A claimed building under the crosshair says so before you swing at it.
        On a desktop it is a label and C manages it; on a phone there is no C,
        so the label is the button.
      -->
      <button id="building-hint" hidden></button>

      <div id="top-buttons">
        <button class="icon-btn touch-moved" id="btn-templates" title="Save a build, and stamp it anywhere">${icon('paste')}<span>Designs</span></button>
        <button class="icon-btn touch-moved" id="btn-roof" title="Pitch a roof over the building you point at">${icon('roof')}<span>Roof</span></button>
        <button class="icon-btn duilt-only touch-moved" id="btn-bag" title="Your bag (I)" hidden>${icon('bag')}<span>Bag</span></button>
        <button class="icon-btn duilt-only touch-moved" id="btn-buildings" title="What you can build (B)" hidden>${icon('home')}<span>Build</span></button>
        <button class="icon-btn duilt-only touch-moved" id="btn-bench" title="Workbench — make things (E)" hidden>${icon('hammer')}<span>Bench</span></button>
        <button class="icon-btn touch-moved" id="btn-fullscreen" title="Toggle fullscreen">${icon('fullscreen')}<span>Screen</span></button>
        <button class="icon-btn" id="btn-menu" title="Settings, saves and your account">${icon('settings')}<span>Settings</span></button>
      </div>

      <!--
        What you are holding, in words. The slots are coloured squares and the
        only thing naming them was a native title tooltip: a hover and a
        one-second wait on a desktop, and nothing whatsoever on a phone, which
        is where most of this is played. So the name is on screen instead —
        the selected block always, or whichever one you are pointing at.
      -->
      <div id="hotbar-wrap">
        <div id="hotbar-label" aria-live="polite"><span id="hotbar-name"></span><span id="hotbar-note"></span></div>
        <div id="hotbar"></div>
      </div>

      <div id="toast-stack"></div>

      ${renderPanels('main', {
        'panel-stats': `
          <div class="tab-row">
            <button class="tab-btn active" data-tab="tab-achievements">Goals</button>
            <button class="tab-btn" data-tab="tab-challenges">Today</button>
          </div>
          <div class="tab-panel" id="tab-achievements"><div id="ach-grid"></div></div>
          <div class="tab-panel" id="tab-challenges" hidden><div id="challenge-list"></div></div>`,
        'panel-menu': `
          <div id="menu-index"></div>

          <div class="menu-section" id="menu-world" hidden>
            <button class="menu-back" data-menu-back="1">${icon('chevron', 14)}<span>Menu</span></button>
            <label class="menu-name">
              <span>Name</span>
              <input type="text" id="save-name" maxlength="40" placeholder="Unnamed world" />
            </label>
            <div id="save-hint" class="export-note" hidden></div>
          </div>

          <div class="menu-section" id="menu-graphics" hidden>
            <button class="menu-back" data-menu-back="1">${icon('chevron', 14)}<span>Menu</span></button>
            <!-- The heading already says Graphics; this line is only here for
                 the frame counter, which is the one thing you want while you
                 are turning these up and down. -->
            <div class="mode-label"><span id="gfx-fps" class="gfx-fps"></span></div>
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

          <div class="menu-section" id="menu-files" hidden>
            <button class="menu-back" data-menu-back="1">${icon('chevron', 14)}<span>Menu</span></button>
            <div class="field-row" style="margin-bottom:0; flex-wrap:wrap;">
              <button class="secondary" id="btn-export-world">Export world</button>
              <button class="secondary" id="btn-export-vox">Export .vox</button>
              <button class="secondary" id="btn-import-world">Import a file</button>
            </div>
            <div class="export-note">A world file restores everything, designs included. The .vox opens in MagicaVoxel and Blender.</div>
          </div>

          <!--
            The three ways out, on every screen of the menu. They were mixed in
            with a "Save a copy" that made a second world out of the one you
            were in — which is not what anybody pressing Save in a pause menu
            means. Saving happens when you leave.
          -->
          <div class="menu-actions menu-resume">
            <button class="primary" id="btn-resume">Back to the world</button>
            <button class="secondary" id="btn-leave">Save and leave</button>
            <!--
              Leaving without saving is the undo for a whole session, so it is
              a button rather than something buried. Quiet, because it is not
              what you usually mean.
            -->
            <button class="home-link menu-quit" id="btn-leave-nosave">Leave without saving</button>
          </div>`,
        'panel-account': `

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

          <!--
            Who you are, and the way out. It used to be a world-management
            screen — "Save this world to the cloud", a Refresh, and a list of
            cloud worlds with Restore and Delete on each — which is two
            different subjects in one panel, and on the worlds screen, where
            there is no world loaded, the save button had nothing to save.
            Worlds sync on their own now and the worlds screen lists them, so
            what is left here is the account.
          -->
          <div id="cloud-signed-in" hidden>
            <div class="account-who">
              <div class="account-avatar" id="account-initial">?</div>
              <div class="account-lines">
                <strong id="account-email">Signed in</strong>
                <span id="account-holds">Your worlds are kept here.</span>
              </div>
            </div>
            <div class="field-row">
              <button class="secondary" id="btn-cloud-signout">Sign out</button>
            </div>
            <!--
              This used to promise that signing out "leaves every world on this
              device exactly where it is", which was true right up until worlds
              moved onto the account and the local copy was deleted. Saying it
              beside a Sign out button is the worst possible place to be wrong:
              it reads as "nothing happens", when what happens is you can no
              longer reach any of them.
            -->
            <div class="export-note">Your worlds stay on your account. You will not be able to open them again until you sign back in.</div>
          </div>
          <div class="export-note" id="cloud-error" hidden></div>
          <div id="cloud-status" hidden></div>
          <div id="cloud-block" hidden></div>
`,
        'panel-templates': `
          <div class="field-row">
            <input type="text" id="template-name" placeholder="Name this design" maxlength="40" />
            <button class="secondary" id="btn-save-template">Save what I'm pointing at</button>
          </div>
          <div id="template-list"></div>`,
        'panel-roof': `
          <div id="roof-list"></div>
          <div class="export-note" id="roof-note"></div>`,
        'panel-clear': `
          <div id="clear-list"></div>
          <div class="export-note" id="clear-note"></div>`,
        'panel-score': `
          <div class="score-total" id="score-total">0</div>
          <div class="score-breakdown" id="score-breakdown"></div>`,
      })}

      <!--
        Two thumbs, and as little else on the glass as the game can manage.

        Movement on the left, camera on the right — the convention, which is
        what a thumb already expects. Everything you press is a single column
        hugging the left edge: Break and Place lowest, where the thumb is, then
        Fly, then More above it. A column rather than a cluster because two
        buttons side by side is two buttons you can hit by mistake, and because
        a column takes one narrow strip of a picture you are trying to look at.

        Nothing sits over a stick. The columns start above where the bases are
        drawn, so the thing under your thumb is always the thing you meant.

        Fly earns a place on the glass rather than a slot behind More: it
        changes how every other control behaves, and a mode switch you have to
        go looking for is one you forget the game has. Jump stays on the right
        because it belongs with the hand that is looking where you are going.
      -->
      <div id="touch-controls">
        <div class="stick-zone" id="stick-left">
          <div class="stick-base"><div class="stick-knob"></div></div>
        </div>
        <div class="stick-zone" id="stick-right">
          <div class="stick-base"><div class="stick-knob"></div></div>
        </div>

        <!--
          More opens a sheet rather than stacking buttons up the edge. A stack
          ran out of screen the moment a sixth tool existed and had to fold
          into a second column, which is the thing a column was for avoiding.
          A sheet holds however many the game ends up with, labelled, and is
          not a control you can hit by accident while building.
        -->
        <div class="touch-tray" id="touch-tray" hidden>
          <button class="touch-btn duilt-only" id="t-bag" hidden>${icon('bag')}<span>Bag</span></button>
          <button class="touch-btn duilt-only" id="t-build" hidden>${icon('home')}<span>Build</span></button>
          <button class="touch-btn duilt-only" id="t-bench" hidden>${icon('hammer')}<span>Bench</span></button>
          <button class="touch-btn duilt-only" id="t-skills" hidden>${icon('skills')}<span>Skills</span></button>
          <!-- Made, not given: these appear once you have the tool in your bag. -->
          <button class="touch-btn needs-tool" id="t-clear" data-tool="clear" hidden>${icon('clear')}<span>Clear</span></button>
          <button class="touch-btn needs-tool" id="t-symmetry" data-tool="mirror" hidden>${icon('symmetry')}<span>Mirror</span></button>
          <button class="touch-btn" id="t-designs">${icon('paste')}<span>Designs</span></button>
          <button class="touch-btn" id="t-roof">${icon('roof')}<span>Roof</span></button>
          <!-- Beside Roof, not a level down in Settings: the goals are what
               teaches the game, and Settings is where you go between builds. -->
          <button class="touch-btn" id="t-stats">${icon('stats')}<span>Goals</span></button>
          <button class="touch-btn" id="t-screen">${icon('fullscreen')}<span>Screen</span></button>
        </div>

        <!--
          Break sits to the right of the stick that walks and Jump to the
          right of the one that aims — each of them a thumb-width from the
          stick it belongs to, and each on the side that side has room for.
          That asymmetry is the point: with nothing outboard of the left stick
          it can sit out at the edge, which leaves the middle of a small screen
          some air rather than four things elbowing each other.
        -->
        <div class="stick-side" id="side-left">
          <button class="touch-btn small" id="t-break">${icon('mine')}<span>Break</span></button>
        </div>
        <div class="stick-side" id="side-right">
          <!--
            One button on the ground, two in the air: Jump becomes Up, and Down
            appears under it. Up on top because that is the way they point —
            it was the other way round, which is a control that argues with its
            own arrow. The pair is shifted down half a button by CSS so it
            straddles where the single one was, rather than dropping Down into
            the slot your thumb was resting on.
          -->
          <button class="touch-btn small" id="t-jump">${icon('up')}<span id="t-jump-label">Jump</span></button>
          <button class="touch-btn small" id="t-down" hidden>${icon('down')}<span>Down</span></button>
        </div>

        <!-- Left edge, above Break: the rest of what you press. -->
        <div class="touch-buttons" id="touch-buttons-left">
          <button class="touch-btn" id="t-more">${icon('menu')}<span>More</span></button>
          <button class="touch-btn" id="t-fly">${icon('fly')}<span>Fly</span></button>
          <button class="touch-btn" id="t-place">${icon('place')}<span>Place</span></button>
        </div>
      </div>
    `;
  }

  detectTouch() {
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (this.isTouch) {
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
      // The bucket, when you're holding one — it doesn't place, so it isn't
      // in `placeable`, but it still needs a slot to be selected from. See
      // TOOL_HOTBAR_IDS and Game.js's fillBucket/emptyBucket.
      const tools = TOOL_HOTBAR_IDS
        .filter((id) => inv.countOf(id) > 0)
        .map((id) => ({ id, spec: ITEMS_BY_ID.get(id) }));

      if (!placeable.length && !tools.length) {
        hotbar.appendChild(el(`<div class="hotbar-empty">Nothing to build with yet — break something</div>`));
        this.showHotbarLabel();
        return;
      }
      placeable.forEach((e, i) => {
        const total = inv.countOf(e.id);
        hotbar.appendChild(el(`
          <div class="hotbar-slot ${!this.selectedItemId && e.spec.block === this.selectedBlockId ? 'selected' : ''}"
               data-id="${e.spec.block}" data-item="${e.id}"
               data-name="${itemName(e.id)}" data-note=""
               title="${itemName(e.id)} — ${total} in your bag">
            ${i < 9 ? `<span class="key">${i + 1}</span>` : ''}
            <div class="swatch swatch-cube">${itemIcon(e.spec, { size: 30 }) ?? glyphSvg(e.spec.glyph, { size: 18, color: e.spec.color })}</div>
            <span class="held">${total}</span>
          </div>
        `));
      });
      tools.forEach((e) => {
        const total = inv.countOf(e.id);
        const note = e.id === 'bucket' ? 'Break to scoop water' : 'Place to pour it out';
        hotbar.appendChild(el(`
          <div class="hotbar-slot ${this.selectedItemId === e.id ? 'selected' : ''}"
               data-tool="1" data-item="${e.id}"
               data-name="${itemName(e.id)}" data-note="${note}"
               title="${itemName(e.id)} — ${note}">
            <div class="swatch swatch-cube">${itemIcon(e.spec, { size: 30 }) ?? glyphSvg(e.spec.glyph, { size: 18, color: e.spec.color })}</div>
            <span class="held">${total}</span>
          </div>
        `));
      });
      // If what was selected has run out — a block spent, or the bucket you
      // had selected just swapped for its filled/emptied counterpart — fall
      // to the first thing you do have.
      const stillValid = this.selectedItemId
        ? tools.some((e) => e.id === this.selectedItemId)
        : placeable.some((e) => e.spec.block === this.selectedBlockId);
      if (!stillValid) {
        if (placeable.length) this.selectBlock(placeable[0].spec.block);
        else this.selectItem(tools[0].id);
      } else this.showHotbarLabel();
      return;
    }

    PLACEABLE_BLOCKS.forEach((b, i) => {
      const available = this.game.blockAvailability(b.id).ok;
      // Only what the slot itself cannot show. The name is already on the
      // swatch, so repeating it is noise; why a block is locked is not
      // written anywhere else.
      const note = available ? '' : this.game.blockAvailability(b.id).reason;
      const slot = el(`
        <div class="hotbar-slot ${available ? '' : 'locked'} ${b.id === this.selectedBlockId ? 'selected' : ''}"
             data-id="${b.id}" data-name="${b.name}" data-note="${note}" title="${note ? `${b.name} — ${note}` : b.name}">
          ${i < 9 ? `<span class="key">${i + 1}</span>` : ''}
          <div class="swatch swatch-cube">${cubeSvg(b.id, { size: 30 })}</div>
          ${available ? '' : `<div class="lock">${icon('lock', 15)}</div>`}
        </div>
      `);
      hotbar.appendChild(slot);
    });
    this.showHotbarLabel();
  }

  /**
   * Affordability changes on every single block placed, so update classes in
   * place — rebuilding the hotbar would reset its horizontal scroll each time.
   */
  /** Re-renders everything that differs between the sandbox and Duilt. */
  refreshForMode() {
    this.refreshForDuilt();
    this.buildHotbar();
  }

  wireEvents() {
    this.home = new HomeScreen(this.q('#blocker'), {
      // The worlds screen has nothing to draw without an account, because a
      // world without an account has nowhere to live.
      needsAccount: () => !this.cb.getCloudUser?.(),
      listCloudWorlds: () => this.cb.getCloudWorlds(),
      getCloudUser: () => this.cb.getCloudUser?.() ?? null,
      isCloudConfigured: () => this.cb.isCloudConfigured?.() ?? false,

      // Entering happens inside the tap that asked for it — pointer lock is
      // only granted to a gesture — and the world arrives from the account a
      // moment later.
      onOpen: (id) => { this.enterWorld(); this.cb.onOpenWorld(id); },
      onCreate: (mode, name) => { this.cb.onNewWorld(mode, name); this.enterWorld(); },
      onRemove: (id, label) => {
        if (!confirm(`Delete "${label}"? Everything built in it goes with it, and this cannot be undone.`)) return false;
        this.cb.onDeleteWorld(id);
        return true;
      },

      // These open *over* the worlds screen rather than replacing it. They used
      // to hide it first, so closing one left you standing in whichever world
      // was last loaded — one you never chose, already falling.
      onSettings: () => this.openPanel('panel-menu'),
      onAccount: (mode) => { if (mode) this.setAccountMode(mode); this.openPanel('panel-account'); },
    });
    // The screen is already on when the page loads, so draw it now rather than
    // waiting for something to re-open it.
    this.home.render();

    // Pointer, not mouse: a stylus or a trackpad asks the same question.
    const bar = this.q('#hotbar');
    bar.addEventListener('pointerover', (e) => {
      const slot = e.target.closest?.('.hotbar-slot');
      if (slot) this.showHotbarLabel(slot);
    });
    bar.addEventListener('pointerout', (e) => {
      if (!e.relatedTarget?.closest?.('.hotbar-slot')) this.showHotbarLabel();
    });
    this.q('#hotbar').addEventListener('click', (e) => {
      const slot = e.target.closest('.hotbar-slot');
      if (!slot) return;
      if (slot.dataset.tool) { this.selectItem(slot.dataset.item); return; }
      const id = Number(slot.dataset.id);
      const availability = this.game.blockAvailability(id);
      if (!availability.ok) {
        this.toast({ kind: 'xp', title: 'Locked', body: availability.reason });
        return;
      }
      this.selectBlock(id);
    });

    // On a phone there is no C key, so the hint is what you press.
    this.q('#building-hint').addEventListener('click', () => this.cb.onOpenClaim());

    for (const sel of ['#btn-fullscreen', '#t-screen']) {
      const fsBtn = this.q(sel);
      if (!fsBtn) continue;
      if (document.fullscreenEnabled) {
        fsBtn.addEventListener('click', () => { this.closeTray(); this.cb.onToggleFullscreen(); });
      } else fsBtn.remove();
    }

    this.q('#btn-templates').addEventListener('click', () => this.toolButton('design', 'panel-templates'));
    this.q('#btn-roof').addEventListener('click', () => this.toolButton('roof', 'panel-roof'));
    this.q('#tool-cancel').addEventListener('click', () => this.cb.onCancelTool?.());
    this.q('#tool-cancel').addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.cb.onCancelTool?.();
    }, { passive: false });
    this.q('#btn-bag').addEventListener('click', () => this.cb.onOpenBag());
    this.q('#btn-buildings').addEventListener('click', () => this.cb.onOpenBuildings());
    this.q('#btn-bench').addEventListener('click', () => this.cb.onOpenBench());
    // Touch gets its own row: a 36px unlabelled square in a corner is not a
    // control anyone can find with a thumb. Opening anything closes the tray,
    // whether the button was in it or not — you asked for the thing, not for
    // the menu to stay up behind it.
    const openers = [
      ['#t-bag', () => this.cb.onOpenBag()],
      ['#t-bench', () => this.cb.onOpenBench()],
      ['#t-build', () => this.cb.onOpenBuildings()],
      // Skills had no way in at all before this — the panel existed, was
      // drawn, and nothing anywhere opened it.
      ['#t-skills', () => this.openPanel('panel-skills')],
      ['#t-stats', () => this.openPanel('panel-stats')],
      ['#t-clear', () => this.toolButton('clear', 'panel-clear')],
      ['#t-designs', () => this.toolButton('design', 'panel-templates')],
      ['#t-roof', () => this.toolButton('roof', 'panel-roof')],
    ];
    for (const [sel, fn] of openers) {
      const btn = this.q(sel);
      if (!btn) continue;
      const fire = (e) => { e.preventDefault(); this.closeTray(); fn(); };
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

    this.wireTabs(this.q('#panel-stats'));

    this.wireGraphics();
    this.renderMenuIndex();
    this.root.querySelectorAll('[data-menu-back]').forEach((btn) =>
      btn.addEventListener('click', () => this.showMenuSection(null)));
    this.q('#btn-resume').addEventListener('click', () => this.cb.onResume());
    this.q('#btn-leave').addEventListener('click', () => {
      this.cb.onLeaveWorld?.(true);
      this.closePanel('panel-menu');
      this.openHome();
      this.toast({ kind: 'challenge', title: 'Saved', body: this.game.worldName || 'Your world' });
    });
    this.q('#btn-leave-nosave').addEventListener('click', () => {
      const since = this.lastSavedLabel();
      if (!confirm(`Leave without saving? Everything since ${since} is lost.`)) return;
      this.cb.onLeaveWorld?.(false);
      this.closePanel('panel-menu');
      this.openHome();
    });
    this.q('#btn-export-world').addEventListener('click', () => this.cb.onExportWorld(this.q('#save-name').value));
    this.q('#btn-export-vox').addEventListener('click', () => this.cb.onExportVox(this.q('#save-name').value));
    this.q('#btn-import-world').addEventListener('click', () => this.cb.onImportWorld());
    // Renaming is the field, not a button beside it: type a name, leave the
    // field, that is its name. It used to need Save pressed, and Save made a
    // copy, so renaming quietly gave you two worlds.
    this.q('#save-name').addEventListener('change', () => {
      const input = this.q('#save-name');
      const name = input.value.trim() || this.game.worldName || `World ${new Date().toLocaleDateString()}`;
      input.value = name;
      this.cb.onRenameWorld?.(name);
      const hint = this.q('#save-hint');
      hint.hidden = false;
      hint.textContent = `This world is called "${name}" now. It is kept when you leave.`;
    });

    this.wireTouchControls();
    this.wireCloud();
    this.duiltUI = new DuiltUI(this.root, { game: this.game, bus: this.bus, panels: this.panels });
    // The hotbar is a view of the bag in Duilt, so it re-renders with it.
    this.duiltUI.onBagChanged = () => { if (this.cb.isDuilt?.()) this.buildHotbar(); };
    this.duiltUI.onClaimType = (id) => this.cb.onClaimType(id);
    this.duiltUI.onStampStarter = (id) => this.cb.onStampStarter(id);
    this.duiltUI.onLeave = () => { this.closeAllPanels(); this.openHome(); };
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
    // Camera left, movement right. Backwards against every console pad, and
    // right for this game: the thumb that never leaves its stick is the one
    // aiming, and it is the steadier hand that should have it.
    //
    // The camera wants precision near centre, so it gets the steeper curve.
    // 1.8 was too steep — a half-travel push came out at a fifth of the turn
    // rate and the camera felt like it was lagging behind the thumb. 1.25
    // keeps the fine control near centre and gives back the middle of the
    // range. Movement just wants to reach full speed readily.
    this.bindStick('#stick-left', (x, y) => this.cb.onMove(x, y), { deadZone: 0.10, curve: 1.1 });
    // A steeper curve than the walking stick: most of a look is a small
    // correction, and a linear stick spends nearly all its travel on speeds
    // too fast to aim with. At half a thumb this now turns about a fifth of
    // full speed rather than a third.
    this.bindStick('#stick-right', (x, y) => this.cb.onLookStick(x, y), { deadZone: 0.09, curve: 1.7 });

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
    // Break is a hold, not a tap: one block per tap meant tapping forty times
    // to clear a wall. The first block lands on the touch, the rest follow
    // while your thumb stays down.
    {
      const btn = this.q('#t-break');
      const down = (e) => {
        e.preventDefault();
        btn.classList.add('active');
        this.cb.onBreakTap();
        this.cb.onBreakHold?.(true);
      };
      const up = () => { btn.classList.remove('active'); this.cb.onBreakHold?.(false); };
      btn.addEventListener('touchstart', down, { passive: false });
      btn.addEventListener('touchend', up);
      btn.addEventListener('touchcancel', up);
    }
    this.q('#t-symmetry').addEventListener('click', () => {
      this.closeTray();
      this.setSymmetryLabel(this.cb.onCycleSymmetry());
    });
    this.q('#t-place').addEventListener('touchstart', (e) => { e.preventDefault(); this.cb.onPlaceTap(); });
  }

  wireBus() {
    this.bus.on('inventory:change', () => this.refreshTools());
    // Anything that wants to say a line puts it on the bus. Nothing was
    // listening: six messages in DuiltUI went nowhere, and the loudest of them
    // was "somebody moved in" — so the settlement filled up in silence and the
    // game looked like it had forgotten to send anybody.
    this.bus.on('toast', (t) => this.toast(t));
    // Moving up an age had no listener at all: the border moved, the goal list
    // changed, and nothing said why or what the new age is for.
    this.bus.on('duilt:age', ({ age, name, size, intro }) => {
      this.toast({
        kind: 'challenge',
        title: `Age ${age} · ${name}`,
        body: intro ?? `Your land is ${size} × ${size} now`,
      });
    });
    this.bus.on('duilt:won', () => this.openPanel('panel-finish'));

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
      this.toast({ kind: 'challenge', title: 'New block unlocked', body: b.name });
      this.buildHotbar();
    });
    this.bus.on('streak:update', ({ count }) => {
      if (count > 1) this.toast({ kind: 'xp', title: `${count}-day streak`, body: 'Back again — nice consistency.' });
    });
    this.bus.on('session:end', ({ score }) => this.showBuildScore(score));
  }

  selectBlock(id) {
    this.selectedBlockId = id;
    this.selectedItemId = null;
    this.root.querySelectorAll('.hotbar-slot').forEach((s) =>
      s.classList.toggle('selected', !s.dataset.tool && Number(s.dataset.id) === id));
    this.showHotbarLabel();
    this.cb.onSelectSlot(id);
  }

  /** Selects a tool slot — the bucket, today — instead of a placeable block. */
  selectItem(id) {
    this.selectedItemId = id;
    this.root.querySelectorAll('.hotbar-slot').forEach((s) =>
      s.classList.toggle('selected', s.dataset.tool ? s.dataset.item === id : false));
    this.showHotbarLabel();
    this.cb.onSelectItem?.(id);
  }

  /**
   * Names the block under the pointer, or the one you have selected.
   *
   * Pointing at a slot is a question — "what is that one?" — and it should be
   * answered while you are pointing, not after you have committed to it. Let
   * go and it goes back to saying what you are actually holding, which is the
   * thing you need to know while you build.
   */
  showHotbarLabel(slot = null) {
    const target = slot
      ?? this.root.querySelector('.hotbar-slot.selected')
      ?? null;
    const name = this.q('#hotbar-name');
    const note = this.q('#hotbar-note');
    const label = this.q('#hotbar-label');
    if (!name || !note || !label) return;
    name.textContent = target?.dataset.name ?? '';
    note.textContent = target?.dataset.note ?? '';
    label.classList.toggle('preview', !!slot && !target.classList.contains('selected'));
    label.hidden = !target;
  }

  cycleHotbarByKey(n) {
    if (this.cb.isDuilt?.()) {
      const slot = this.root.querySelectorAll('#hotbar .hotbar-slot')[n - 1];
      if (!slot) return;
      if (slot.dataset.tool) this.selectItem(slot.dataset.item);
      else this.selectBlock(Number(slot.dataset.id));
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

  /**
   * A line about something that just happened, and sometimes a way to undo it.
   *
   * The way back belongs on the thing you just did. There is no Undo button in
   * the corner any more — breaking a block is how you take a block back — so
   * the one case that needs it, a tool that laid two hundred blocks in a press,
   * offers it here, where it is next to the sentence saying what it laid. It
   * leaves with the toast, and it works under a thumb, which Ctrl+Z never did.
   */
  toast({ kind, title, body, action = null }) {
    const stack = this.q('#toast-stack');
    const node = el(`<div class="toast ${kind}">
      <div class="title">${title}</div>
      ${body ? `<div class="body">${body}</div>` : ''}
      ${action ? `<button class="toast-action">${escapeHtml(action.label)}</button>` : ''}
    </div>`);
    if (action) {
      const btn = node.querySelector('.toast-action');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        action.onClick();
        node.remove();
      });
      // A toast is not a button on a phone unless it says so.
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        action.onClick();
        node.remove();
      }, { passive: false });
    }
    // On a phone there is one slot, and a new message pushes the old one off to
    // the right. A stack of five was a column of text down a screen that is
    // mostly the thing you are trying to look at, and by the third one you were
    // reading the oldest — the one you had already stopped caring about.
    if (this.isTouch) for (const old of [...stack.children]) this.dismissToast(old);

    stack.appendChild(node);
    setTimeout(() => this.dismissToast(node), action ? 7000 : 3400);
    while (stack.children.length > 5) stack.removeChild(stack.firstChild);
  }

  /** Slides a toast out and takes it off the screen once it has gone. */
  dismissToast(node) {
    if (!node || node.classList.contains('going')) return;
    node.classList.add('going');
    node.classList.add(this.isTouch ? 'push-out' : 'fade-out');
    setTimeout(() => node.remove(), this.isTouch ? 280 : 320);
  }

  /** Fills a panel in just before it is shown, if it has anything to fill. */
  populatePanel(id) {
    if (id === 'panel-menu') {
      const kind = this.cb.isDuilt?.() ? 'Duilt' : 'Creative';
      const label = this.q('#menu-world-kind');
      if (label) label.textContent = `A ${kind} world`;
      const name = this.q('#save-name');
      if (name) name.value = this.game.worldName || '';
      const hint = this.q('#save-hint');
      if (hint) hint.hidden = true;
      // Always back at the index: reopening the menu and landing in whatever
      // section you left is a small mystery every time.
      this.showMenuSection(null);
    }
    if (id === 'panel-stats') this.populateStats();
    if (id === 'panel-templates') this.refreshTemplateList();
    if (id === 'panel-roof') this.refreshRoofList();
    if (id === 'panel-clear') this.refreshClearList();
    // The Duilt panels draw their own contents.
    this.duiltUI?.populate(id);
  }

  /**
   * Draws the menu's index of cards, and shows one section at a time.
   *
   * `null` means the index itself. A section that has a panel of its own is
   * not a section here at all — the card opens that panel instead, so there
   * is one achievements screen rather than two that can drift apart.
   */
  renderMenuIndex() {
    const box = this.q('#menu-index');
    if (!box) return;
    const sections = menuFor({ cloud: !!this.cb.isCloudConfigured?.(), dev: this.devOpen });
    const card = (m) => `
      <button class="menu-card" data-menu="${m.id}">
        <span class="menu-card-icon">${icon(m.icon, 20)}</span>
        <span class="menu-card-text">
          <strong>${escapeHtml(m.name)}</strong>
          <span>${escapeHtml(m.blurb)}</span>
        </span>
        <span class="menu-card-go">${icon('chevron', 16)}</span>
      </button>`;
    // One switch at the bottom for the workshop end of the menu. Folded away
    // rather than removed: the render settings and the file import are worth
    // keeping and are not what anybody opens this menu to do.
    const toggle = HAS_DEV_SECTIONS ? `
      <button class="menu-dev-toggle ${this.devOpen ? 'open' : ''}" id="btn-menu-dev">
        ${this.devOpen ? 'Hide' : 'Show'} the workshop tools
      </button>` : '';
    box.innerHTML = sections.map(card).join('') + toggle;
    this.q('#btn-menu-dev')?.addEventListener('click', () => {
      this.devOpen = !this.devOpen;
      this.renderMenuIndex();
    });
    box.querySelectorAll('[data-menu]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const def = MENU_BY_ID.get(btn.dataset.menu);
        if (def?.opens) this.openPanel(def.opens);
        else this.showMenuSection(btn.dataset.menu);
      });
    });
  }

  showMenuSection(id) {
    const index = this.q('#menu-index');
    if (!index) return;
    if (!index.children.length) this.renderMenuIndex();
    index.hidden = !!id;
    for (const el of this.root.querySelectorAll('.menu-section')) el.hidden = el.id !== id;
    // Resume belongs to the whole menu, not to one section, and on the index
    // it is the only thing you can do that is not "go somewhere".
    const resume = this.root.querySelector('.menu-resume');
    if (resume) resume.hidden = !!id;
    // The heading follows you in and back out, so the card you tapped and the
    // page you land on say the same thing.
    const def = id ? MENU_BY_ID.get(id) : null;
    const title = this.q('#panel-menu h2');
    if (title) title.textContent = def ? def.name : (panelDef('panel-menu')?.title ?? 'Menu');
  }

  openPanel(id) {
    this.panels.open(id);
  }

  /**
   * Names the claimed building under the crosshair, or hides the hint.
   * Called every frame, so it only touches the DOM when something changed.
   */
  setBuildingHint(text) {
    const el = this.q('#building-hint');
    if (!el) return;
    if (!text) { if (!el.hidden) el.hidden = true; return; }
    const wanted = `<b>${text}</b><span>${this.isTouch ? 'Tap to manage' : 'C to manage'}</span>`;
    if (el.innerHTML !== wanted) el.innerHTML = wanted;
    el.hidden = false;
  }

  /**
   * The line shown while a building is in the air.
   *
   * It replaces the "what am I pointing at" hint, because while you are
   * holding something the only question is where it is going.
   */
  setMoveHint(name, reason) {
    const el = this.q('#building-hint');
    if (!el) return;
    if (!name) { el.hidden = true; el.classList.remove('bad'); return; }
    const how = this.isTouch ? 'Place to drop it' : 'Click to drop it, Escape to cancel';
    el.innerHTML = `<b>Moving the ${name.toLowerCase()}</b><span>${reason ?? how}</span>`;
    el.classList.toggle('bad', !!reason);
    el.hidden = false;
  }

  /**
   * Names the settler under the crosshair.
   *
   * Same strip as the building hint, because it answers the same question —
   * what is that? — and two labels fighting over the middle of the screen is
   * worse than either.
   */
  setPersonHint(name, doing) {
    const el = this.q('#building-hint');
    if (!el) return;
    el.innerHTML = `<b>${name}</b><span>${doing}</span>`;
    el.classList.remove('bad');
    el.hidden = false;
  }

  isPanelOpen(id) {
    return this.panels.isOpen(id);
  }

  /** What a keyboard shortcut does: the same key puts it away again. */
  togglePanel(id) {
    if (this.panels.isOpen(id)) { this.panels.close(id); return false; }
    this.panels.open(id);
    return true;
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
    return this.panels.isOpen('blocker');
  }

  populateStats() {
    const s = this.gamification.snapshot();
    this.q('#stats-sub').textContent = `Age ${s.age} · ${s.achievementsUnlocked.size} of ${ACHIEVEMENTS.length} done · level ${s.level}`;

    // Banded by age, because the bands are the order you are meant to do them
    // in — this list is the only thing teaching the game now, and a flat grid
    // of twenty cards answers "what have I done" but never "what next".
    const done = s.achievementsUnlocked;
    this.q('#ach-grid').innerHTML = goalBands().map((band) => {
      const met = band.goals.filter((g) => done.has(g.id)).length;
      const reached = s.age >= band.age;
      return `
        <div class="goal-band ${reached ? '' : 'ahead'}">
          <div class="goal-band-head">
            <span>Age ${band.age} \u00b7 ${escapeHtml(band.name)}</span>
            <span class="goal-band-count">${met} / ${band.goals.length}</span>
          </div>
          ${band.goals.map((g) => `
            <div class="ach-card ${done.has(g.id) ? '' : 'locked'} ${g.border ? 'is-border' : ''}">
              <div class="ach-icon">${g.icon}</div>
              <div><div class="ach-name">${escapeHtml(g.name)}</div>
                   <div class="ach-desc">${escapeHtml(g.description)}</div></div>
            </div>`).join('')}
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
    this.panels.close('blocker');
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
    this.applyAccountMode = applyAccountMode;
    applyAccountMode();
    this.q('#btn-account-switch').addEventListener('click', () => {
      this.accountMode = this.accountMode === 'create' ? 'signin' : 'create';
      applyAccountMode();
    });
    // Signing in is a way into your worlds, not a destination. Getting in used
    // to leave you on a panel still titled "Create an account", holding three
    // unexplained buttons — so it closes and puts you on the worlds list,
    // which is where you were trying to go.
    this.q('#btn-cloud-signin').addEventListener('click', (e) => busy(e.currentTarget, async () => {
      await (this.accountMode === 'create' ? this.cb.onCloudSignUp(...creds()) : this.cb.onCloudSignIn(...creds()));
      this.q('#cloud-password').value = '';
      this.closePanel('panel-account');
      // Forget what we knew: it was answered for whoever was signed in before.
      this.home.cloudWorlds = null;
      this.openHome();
      this.toast({
        kind: 'challenge',
        title: this.accountMode === 'create' ? 'Account created' : 'Signed in',
        body: 'New worlds can live on your account now.',
      });
    }));
    this.q('#btn-cloud-signout').addEventListener('click', (e) => busy(e.currentTarget, () => this.cb.onCloudSignOut()));
  }

  /** The worlds screen's two doors open the same panel on the right side of it. */
  setAccountMode(mode) {
    this.accountMode = mode === 'create' ? 'create' : 'signin';
    this.applyAccountMode?.();
  }

  /** Switches the panel between signed-out and signed-in, and hides it entirely when unconfigured. */
  refreshCloudPanel() {
    const block = this.q('#cloud-block');
    if (!block) return;
    if (!this.cb.isCloudConfigured?.()) { block.hidden = true; return; }
    block.hidden = false;

    const user = this.cb.getCloudUser();
    this.q('#cloud-status').textContent = user ? `\u00b7 ${user.email || user.name || 'signed in'}` : '';
    this.q('#cloud-signed-out').hidden = !!user;
    this.q('#cloud-signed-in').hidden = !user;
    // The panel is two different things and only one of them is "Sign in".
    // Signed in it was still headed "Sign in", under a line offering to keep
    // worlds off this device — advice for somebody who has already taken it.
    const title = this.q('#account-title');
    const sub = this.q('#account-sub');
    if (user) {
      const who = user.email || user.name || 'Signed in';
      this.q('#account-email').textContent = who;
      this.q('#account-initial').textContent = (who[0] || '?').toUpperCase();
      if (title) title.textContent = 'Your account';
      if (sub) sub.textContent = 'Your worlds are kept here, not in this browser.';
      this.refreshAccountSummary();
    } else {
      if (title) title.textContent = this.accountMode === 'create' ? 'Create an account' : 'Sign in';
      if (sub) sub.textContent = 'Keep your worlds off this device, so they survive a cleared browser.';
    }
    this.refreshAccountLabel();
  }

  /**
   * What the account is holding, in one line.
   *
   * Not a list of worlds with buttons on them: the worlds screen is where you
   * open and remove a world, and having a second list here was how a panel
   * called "Sign in" ended up offering to save something.
   */
  async refreshAccountSummary() {
    const holds = this.q('#account-holds');
    if (!holds || !this.cb.getCloudUser()) return;
    try {
      const worlds = await this.cb.getCloudWorlds();
      holds.textContent = worlds.length
        ? `${worlds.length} ${worlds.length === 1 ? 'world' : 'worlds'} on your account, on every device you sign in on.`
        : 'No worlds on your account yet. The next one you play goes up on its own.';
    } catch (err) {
      holds.textContent = err.message;
    }
  }

  /**
   * Puts the crosshair on the middle of the canvas, measured rather than assumed.
   *
   * It was `top: 50%; left: 50%` of the UI layer, which is a *sibling* of the
   * canvas — correct only while the two elements have exactly the same box.
   * They do on a desktop. On a phone browser, where the address bar and the
   * toolbar grow and shrink the page under you, they can differ by a strip the
   * height of a toolbar, and then the crosshair is drawn somewhere the camera
   * is not pointing. You aim at one block and break the one below it.
   *
   * Reading the canvas's own rectangle makes the two agree by construction, on
   * any browser, whatever it is doing with its chrome.
   */
  placeCrosshair(canvas) {
    const el = this.q('#crosshair');
    if (!el || !canvas) return;
    const c = canvas.getBoundingClientRect();
    if (!c.width || !c.height) return;
    const root = this.root.getBoundingClientRect();
    el.style.left = `${Math.round(c.left - root.left + c.width / 2)}px`;
    el.style.top = `${Math.round(c.top - root.top + c.height / 2)}px`;
  }

  /** Shown while the mouse is free, so the toolbar is usable without a panel in the way. */
  setResumeHint(on) {
    this.q('#resume-hint').hidden = !on;
  }

  showBlocker() {
    this.home?.render();
    this.panels.open('blocker');   // which also puts away anything in front of it
  }

  setFlyIndicator(flying) {
    this.q('#t-fly').classList.toggle('active', flying);
    this.q('#t-down').hidden = !flying; // descend only means anything while flying
    // Two buttons where there was one, so the pair re-centres on the slot the
    // single one had rather than shunting it up the screen.
    this.q('#side-right')?.classList.toggle('paired', !!flying);
    // The same button jumps on the ground and climbs in the air. Once Down is
    // showing beneath it, "Jump" is the odd one out of a pair.
    const label = this.q('#t-jump-label');
    if (label) label.textContent = flying ? 'Up' : 'Jump';
  }

  /**
   * Shows the tools you have actually made.
   *
   * A creative world has no bag to make anything with, so there everything is
   * simply there — the same split as the rest of it: a *system* is a kind of
   * world, a tool is not.
   */
  refreshTools() {
    const held = this.cb.heldTools?.() ?? null;
    for (const btn of this.root.querySelectorAll('.needs-tool')) {
      btn.hidden = held !== null && !held.has(btn.dataset.tool);
    }
  }

  /** Says which way the mirror is set, on the button that set it. */
  setSymmetryLabel(mode) {
    const btn = this.q('#t-symmetry');
    if (!btn) return;
    btn.querySelector('span').textContent = mode === 'off' ? 'Mirror' : `Mirror ${mode.toUpperCase()}`;
    btn.classList.toggle('active', mode !== 'off');
  }

  /**
   * A tool's button: opens its panel, or puts the tool away if it is the one
   * already queued.
   *
   * The button is lit while its tool is in hand, so pressing the lit thing to
   * put it down is the obvious move — and it was the one route that did not
   * work, because it just reopened the panel you had already chosen from.
   */
  toolButton(id, panel) {
    if (this.armedTool === id) return void this.cb.onCancelTool?.();
    this.openPanel(panel);
  }

  /** Lights the button whose tool is queued, so the HUD says what is in hand. */
  setArmedTool(id) {
    this.armedTool = id;
    const where = {
      roof: ['#btn-roof', '#t-roof'],
      design: ['#btn-templates', '#t-designs'],
    };
    for (const sels of Object.values(where)) for (const sel of sels) this.q(sel)?.classList.remove('active');
    for (const sel of where[id] ?? []) this.q(sel)?.classList.add('active');
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

  /**
   * Lights the fullscreen buttons while fullscreen is on.
   *
   * The game has called this on every fullscreen change for a while and it did
   * not exist, so going fullscreen threw — silently, in a listener, which is
   * why it survived. Both buttons do the same thing, so both show the state.
   */
  setFullscreenIndicator(on) {
    for (const sel of ['#btn-fullscreen', '#t-screen']) {
      this.q(sel)?.classList.toggle('active', !!on);
    }
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

  /**
   * Shows the parts of the HUD that belong to a Duilt world.
   *
   * Only *systems* are hidden here — the bag, the workbench, the settlement.
   * The building tools are not: a roof, a design and a mirror are things you do
   * to blocks, and blocks work the same in every world. Tying them to a world
   * type meant a Creative player could not roof a house and a Duilt player
   * could not save a design, for no reason either of them could have guessed.
   */
  refreshForDuilt() {
    const on = !!this.cb.isDuilt?.();
    this.root.querySelectorAll('.duilt-only').forEach((el) => { el.hidden = !on; });
    this.duiltUI?.setActive(on);
    this.refreshTools();
  }

  toggleBag() { return this.duiltUI?.toggleBag(); }
  openClaim(region, onClaim) { this.duiltUI?.openClaim(region, onClaim); }
  /**
   * Kept as an alias only because callers outside still use the name. Both the
   * main panels and the Duilt ones live in the same registry now, so there is
   * nothing different to do for either.
   */
  openDuiltPanel(id) { this.openPanel(id); }

  /** Shows the building under the crosshair, with what can be done to it. */
  openBuilding(structure, actions) {
    this.openPanel('panel-building');
    this.duiltUI?.showBuilding(structure, actions);
  }

  /** Opens a storehouse's shelves alongside the bag. */
  openStore(structure) {
    this.openPanel('panel-store');
    this.duiltUI?.showStore(structure);
  }

  /**
   * What the queued tool is about to do, next to the crosshair.
   *
   * A tool is not a mode you are in, it is a thing the game is holding for you,
   * so this only appears while something is held and it says the two things
   * that are actually in doubt: whether the crosshair is on something it can
   * use, and which way round it would go.
   */
  setToolReadout(state) {
    const el = this.q('#tool-readout');
    if (!el) return;
    if (!state) {
      el.hidden = true;
      this.setArmedTool(null);
      this.setActionLabels('Break', 'Place');
      return;
    }
    el.hidden = false;
    this.setArmedTool(state.roof ? 'roof' : state.clear ? 'clear' : state.claim ? 'claim' : 'design');

    const touch = document.body.classList.contains('touch');
    const n = state.blocks;
    // The claim selector says its own two lines: which corner it is waiting
    // for, and then how big the area you have drawn is. Nothing else in here
    // fits a tool that takes two presses to say one thing.
    const primary = state.claim ? state.claim
      : state.roof ? `${state.roof} roof`
      : state.clear ? `Clear: ${state.clear}`
      : `Stamp ${state.template}`;
    this.q('#tool-name').textContent = primary;
    this.q('#tool-target').textContent = state.claim ? state.target
      : state.roof
      ? (state.onBuild ? `over ${n} block${n === 1 ? '' : 's'}` : 'not on a building')
      : state.clear
      ? (state.onBuild ? `takes ${n} block${n === 1 ? '' : 's'}` : 'nothing there')
      : (state.onBuild ? 'here' : 'aim at the ground');

    if (state.claim) {
      this.q('#tool-hint').textContent = state.hint ?? '';
      this.setActionLabels('Corner', 'Cancel');
      return;
    }

    // A roof that can turn takes the second button, because a phone has no R
    // and which way the slope falls is the thing you need to change.
    const second = state.facing ? 'Turn' : 'Cancel';
    const facing = state.facing ? ` \u00b7 ${state.facing}` : '';
    const verb = state.clear ? 'clear' : 'place';
    this.q('#tool-hint').textContent = (touch
      ? `${primary} \u00b7 ${second}`
      : `Left click: ${verb} \u00b7 right click: ${second.toLowerCase()}`) + facing;
    // On touch the two action buttons are the only way to reach either, so they
    // say what they do while a tool is queued.
    this.setActionLabels(primary, second);
  }

  /** Retitles the touch Break/Place buttons, which change meaning with a queued tool. */
  setActionLabels(breakLabel, placeLabel) {
    const b = this.q('#t-break'), p = this.q('#t-place');
    if (!b || !p) return;
    b.querySelector('span').textContent = breakLabel;
    p.querySelector('span').textContent = placeLabel;
  }

  /**
   * Carrying a building changes what the two thumb buttons mean, so they say
   * so. Guessing which of Break and Place puts down the thing in your hands is
   * not a puzzle worth having.
   */
  setCarrying(on) {
    this.carrying = on;
    this.setActionLabels(on ? 'Cancel' : 'Break', on ? 'Drop' : 'Place');
    this.q('#t-place')?.classList.toggle('active', !!on);
  }

  refreshTemplateList() {
    const list = this.q('#template-list');
    const templates = this.cb.getTemplates();
    if (!templates.length) {
      list.innerHTML = `<div class="sub" style="margin:0;">No designs yet. Point at something you built and save it.</div>`;
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
      if (this.cb.onPickTemplate(btn.dataset.place)) this.closePanel('panel-templates');
    }));
    list.querySelectorAll('[data-drop]').forEach((btn) => btn.addEventListener('click', () => {
      if (confirm('Delete this design?')) { this.cb.onDeleteTemplate(btn.dataset.drop); this.refreshTemplateList(); }
    }));
  }

  /**
   * The roof shapes, each with a drawing of its own profile.
   *
   * Picking one queues it rather than placing it, exactly as picking a design
   * does, because where it goes is a thing you aim rather than a thing you
   * type. The panel gets out of the way so you can aim.
   */
  refreshRoofList() {
    const list = this.q('#roof-list');
    if (!list) return;
    list.innerHTML = ROOFS.map((r) => `
      <button class="roof-row" data-roof="${r.id}">
        <span class="roof-art">${roofProfileSvg(r)}</span>
        <span class="roof-meta">
          <span class="roof-name">${escapeHtml(r.name)}</span>
          <span class="roof-note">${escapeHtml(r.note)}</span>
        </span>
      </button>
    `).join('');
    list.querySelectorAll('[data-roof]').forEach((btn) => btn.addEventListener('click', () => {
      if (this.cb.onPickRoof(btn.dataset.roof)) this.closePanel('panel-roof');
    }));
    const note = this.q('#roof-note');
    if (note) {
      note.innerHTML = 'It sits on the highest block inside the box, and is made of whatever you are '
        + 'holding. R turns it. Place it again over the same box to change the shape, the way it '
        + 'faces or the material — it replaces the roof rather than stacking one on it.';
    }
  }

  /** The ways of taking a lot of blocks away, each with a drawing of its reach. */
  refreshClearList() {
    const list = this.q('#clear-list');
    if (!list) return;
    list.innerHTML = CLEARS.map((c) => `
      <button class="roof-row" data-clear="${c.id}">
        <span class="roof-art">${clearArtSvg(c)}</span>
        <span class="roof-meta">
          <span class="roof-name">${escapeHtml(c.name)}</span>
          <span class="roof-note">${escapeHtml(c.note)}</span>
        </span>
      </button>
    `).join('');
    list.querySelectorAll('[data-clear]').forEach((btn) => btn.addEventListener('click', () => {
      if (this.cb.onPickClear(btn.dataset.clear)) this.closePanel('panel-clear');
    }));
    const note = this.q('#clear-note');
    if (note) {
      note.textContent = 'What it would take is outlined before you take it. Your border and your '
        + 'claimed buildings refuse it exactly as breaking one block by hand would.';
    }
  }


  /** When this world last reached your account, in words. */
  lastSavedLabel() {
    const at = this.cb.lastSavedAt?.();
    return at ? timeAgo(at) : 'the world was made';
  }

  /**
   * Makes one panel's tabs work, and only that panel's.
   *
   * This used to run over every `.tab-btn` and `.tab-panel` in the document at
   * once, which was fine while Stats was the only panel with tabs — with two,
   * clicking a tab in one would have hidden every tab body in the other.
   */
  wireTabs(scope) {
    if (!scope) return;
    scope.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        scope.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        scope.querySelectorAll('.tab-panel').forEach((p) => (p.hidden = true));
        btn.classList.add('active');
        const body = scope.querySelector('#' + btn.dataset.tab);
        if (body) body.hidden = false;
      });
    });
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
