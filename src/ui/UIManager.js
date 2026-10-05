import { PLACEABLE_BLOCKS } from '../config/blocks.js';
import { cropOf } from '../config/crops.js';
import { icon } from './icons.js';
import { renderPanels, panelDef } from './Panel.js';
import { DuiltUI } from './DuiltUI.js';
import { HomeScreen } from './HomeScreen.js';
import { Panels } from './Panels.js';
import { StoryView, INTRO, ENDINGS, endingFor } from './Story.js';
import { askConfirm } from './Confirm.js';
import { LORE, loreKnowledge } from '../config/lore.js';
import { ITEMS_BY_ID, itemName, isFood, BARE_HANDS } from '../config/items.js';
import { RECIPES } from '../config/recipes.js';
import { PLAYABLE_SLOTS } from '../items/Inventory.js';
import { glyphSvg } from '../config/glyphs.js';
import { blockIcon, itemIcon } from '../config/cubes.js';
import { goalBands } from '../config/achievements.js';
import { ageIntro } from '../config/ages.js';
import { CHALLENGES_BY_ID } from '../config/challenges.js';
import { menuFor, MENU_BY_ID, HAS_DEV_SECTIONS } from '../config/menu.js';
import { ACTIONS, DEFAULT_CONTROLS, FOV_RANGE, SENSITIVITY_RANGE, rebind, keyLabel, touchLayoutClasses, SOUND_PARTS } from '../config/controls.js';
import { VIEWS, SKINS, HAIRS, CLOTHES, DEFAULT_LOOK } from '../config/avatar.js';
import { ROOFS, roofProfileSvg } from '../config/roofs.js';
import { CLEARS, clearArtSvg } from '../config/clears.js';
import { Minimap } from '../render/Minimap.js';
import { drawWorldMap, MAP_ZOOMS } from '../render/WorldMap.js';
import { SHOWCASE_SPOTS, SHOWCASE_TIMES } from '../world/showcase.js';

/**
 * Items that act on the world directly through Break/Place while selected,
 * rather than being placed as a block or spent as a crafting ingredient —
 * and what to tell you Break/Place will do with each one selected. See
 * Game.js's BREAK_OVERRIDE/PLACE_OVERRIDE for what actually runs.
 */
const TOOL_HOTBAR_NOTES = {
  bucket: 'Break to scoop water',
  bucket_water: 'Place to pour it out',
  fruit: 'Break to eat',
  vegetables: 'Break to eat',
};

/**
 * What the two touch buttons say while one of these is selected and no tool
 * is queued — Break/Place is the default everywhere else. Guessing that
 * "Break" scoops water or "Place" throws food away is the same puzzle
 * TOOL_HOTBAR_NOTES exists to avoid; this is the same fix for the buttons
 * themselves. See Game.js's BREAK_OVERRIDE/PLACE_OVERRIDE for what each runs.
 */
/**
 * What Place does that a tap on the picture can't (Game.tapAction): turn a
 * roof, let go of a catapult, throw food to lure an animal. The Place button
 * only shows for these — asked for directly, once a tap placed: "take the
 * place button". Everything else Place did, a tap does now, and a queued
 * tool's Cancel is its own "Put it away" button.
 */
const PLACE_ONLY = new Set(['Turn', 'Let go', 'Throw']);

const TOOL_ACTION_LABELS = {
  bucket: ['Fill', 'Place'],
  bucket_water: ['Break', 'Empty'],
  fruit: ['Eat', 'Throw'],
  vegetables: ['Eat', 'Throw'],
  holy_water: ['Drink', 'Place'],
  beer: ['Drink', 'Place'],
  kombucha: ['Drink', 'Place'],
  coffee: ['Drink', 'Place'],
  coffee_beans: ['Eat', 'Throw'],
};

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * A little phone, sideways, showing where the sticks and buttons will be:
 * W for walking, A for aiming, and the button column beside whichever
 * thumb it goes with.
 */
function touchLayoutPreview(c) {
  const walkLeft = c.walkSide !== 'right';
  const withWalk = c.actionSide !== 'look';
  const buttonsLeft = walkLeft === withWalk;
  const stick = (x, label) => `<circle cx="${x}" cy="44" r="11" class="pv-stick"/><text x="${x}" y="48" class="pv-label">${label}</text>`;
  const column = (x) => [14, 22, 30].map((y) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="7" rx="2" class="pv-btn"/>`).join('');
  const aimX = walkLeft ? 96 : 24, walkX = walkLeft ? 22 : 98;
  const jumpX = walkLeft ? 112 : 8;
  const breakX = withWalk ? (walkLeft ? walkX + 18 : walkX - 18) : (walkLeft ? aimX - 18 : aimX + 18);
  return `<svg viewBox="0 0 120 64" width="120" height="64">
    <rect x="1" y="1" width="118" height="62" rx="8" class="pv-phone"/>
    ${stick(walkX, 'W')}${stick(aimX, 'A')}
    <rect x="${jumpX - 4}" y="40" width="8" height="8" rx="2" class="pv-btn"/>
    <rect x="${breakX - 4}" y="40" width="8" height="8" rx="2" class="pv-btn pv-act"/>
    ${column(buttonsLeft ? 10 : 110)}
  </svg>`;
}

/** How far a touch on the picture moves, in px, before it's a look and not a tap. */
/**
 * Running on the walking stick (see bindStick): the thumb has to be carried
 * up past the knob's full reach — this many reaches straight up from the
 * middle, so a little way out beyond the base's rim — and within this much
 * of straight ahead (the tangent of 30°). The knob is then drawn this far up,
 * just over the rim, so you can see you've crossed it.
 */
// Further out than it was (1.5): "less sensitive to running".
const STICK_RUN_REACH = 1.9;
const STICK_RUN_SPREAD = 0.5;
const STICK_RUN_KNOB = 1.35;
const LOOK_SLOP = 10;
/** How long a still touch on the picture waits before it starts breaking. */
const LOOK_HOLD_MS = 300;
/**
 * The longest a tap keeps digging. A tap carries on until its block is
 * through (Game.setBreaking's `once`), and this is only the backstop — past
 * the slowest block by hand (Game's BARE_HAND_MS) plus the hold's delay.
 */
const TAP_FINISH_MS = 2600;

export class UIManager {
  constructor(root, { bus, game, callbacks }) {
    this.bus = bus;
    this.game = game;
    this.cb = callbacks;
    this.selectedBlockId = 1;
    // The bucket, food, and the mining tools — see TOOL_HOTBAR_NOTES and
    // Game.js's BREAK_OVERRIDE/PLACE_OVERRIDE. Selecting a tool and
    // selecting a block are mutually exclusive: exactly one hotbar slot is
    // ever highlighted.
    this.selectedItemId = null;
    this.selectionActive = false;

    // Before the markup, because what it decides — a phone or not — is read
    // while the rest of this constructor builds. The goal list asks it, and
    // used to be built two lines too early to get an answer.
    this.detectTouch();
    this.devOpen = false;   // the workshop end of the menu, folded away
    this.editingBanner = false;   // a building open for changes pins the crosshair strip — see setEditingBanner

    root.innerHTML = this.markup();
    this.root = root;
    this.q = (sel) => root.querySelector(sel);

    // Desktop only — see Minimap.js's own note.
    this.minimap = this.isTouch ? null : new Minimap(this.q('#minimap'));

    // Every `.overlay` with an id is a panel, including the ones the Duilt
    // layer adds later. The worlds screen is an overlay too but is not a panel:
    // Escape must not dismiss it into a world nobody chose.
    this.panels = new Panels(root, { screens: ['blocker'] });
    this.panels.onOpen((id) => this.populatePanel(id));
    this.panels.onOpen(() => this.collapseToasts());
    this.panels.onOpen(() => this.updateHudVisibility());
    this.panels.onClose((id) => this.duiltUI?.onPanelClosed(id));
    this.panels.onClose(() => this.updateHudVisibility());
    // The illustrated intro and endings: a panel of their own (ui/Story.js).
    this.story = new StoryView(root, this.panels);

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

      <!--
        Desktop only — see Minimap.js's own note on why a phone reaches for
        the Map panel instead rather than getting a second, smaller one.
      -->
      <canvas id="minimap" width="120" height="120" title="M for the full map"></canvas>

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
        <button class="icon-btn touch-moved" id="btn-stats" title="Goals (G)">${icon('stats')}<span>Goals</span></button>
        <button class="icon-btn touch-moved" id="btn-templates" title="Save a build, and stamp it anywhere">${icon('paste')}<span>Designs</span></button>
        <button class="icon-btn touch-moved" id="btn-roof" title="Pitch a roof over the building you point at">${icon('roof')}<span>Roof</span></button>
        <button class="icon-btn touch-moved" id="btn-map" title="Map (M)">${icon('map')}<span>Map</span></button>
        <button class="icon-btn duilt-only touch-moved" id="btn-bag" title="Your bag (I)" hidden>${icon('bag')}<span>Bag</span></button>
        <button class="icon-btn duilt-only touch-moved" id="btn-buildings" title="What you can build (B)" hidden>${icon('home')}<span>Build</span></button>
        <button class="icon-btn duilt-only survival-only touch-moved" id="btn-bench" title="Workbench — make things (E)" hidden>${icon('hammer')}<span>Bench</span></button>
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
            <button class="tab-btn" data-tab="tab-lore" id="lore-tab">Lore</button>
          </div>
          <div class="tab-panel" id="tab-achievements"><div id="ach-grid"></div></div>
          <div class="tab-panel" id="tab-challenges" hidden><div id="challenge-list"></div></div>
          <div class="tab-panel" id="tab-lore" hidden><div id="lore-list"></div></div>`,
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
              <label class="gfx-check">
                <input type="checkbox" id="gfx-lights" /> Dynamic lights
              </label>
              <label class="gfx-check">
                <input type="checkbox" id="gfx-ao" /> Soft shadows
              </label>
              <label class="gfx-check">
                <input type="checkbox" id="gfx-atmosphere" /> Mist and motes
              </label>
            </div>
            <div class="export-note" id="gfx-note" hidden></div>
          </div>

          <div class="menu-section" id="menu-controls" hidden>
            <button class="menu-back" data-menu-back="1">${icon('chevron', 14)}<span>Menu</span></button>
            <!-- Phones and tablets only: which side your thumbs do what. -->
            <div class="ctl-touch" id="ctl-touch">
              <div class="ctl-touch-rows">
                <div class="ctl-seg-row">
                  <span>Walking stick</span>
                  <div class="ctl-seg" data-seg="walkSide">
                    <button data-val="left">Left</button><button data-val="right">Right</button>
                  </div>
                </div>
                <div class="ctl-seg-row">
                  <span>Break, Place, Fly &amp; More</span>
                  <div class="ctl-seg" data-seg="actionSide">
                    <button data-val="walk">By walking</button><button data-val="look">By aiming</button>
                  </div>
                </div>
              </div>
              <div class="ctl-touch-preview" id="ctl-touch-preview" aria-hidden="true"></div>
            </div>
            <div class="ctl-sliders">
              <label>Field of view <b id="ctl-fov-val"></b>
                <input type="range" id="ctl-fov" min="${FOV_RANGE[0]}" max="${FOV_RANGE[1]}" step="1" />
              </label>
              <label>Mouse speed <b id="ctl-sens-val"></b>
                <input type="range" id="ctl-sens" min="${SENSITIVITY_RANGE[0]}" max="${SENSITIVITY_RANGE[1]}" step="0.05" />
              </label>
              <label>Volume <b id="ctl-vol-val"></b>
                <input type="range" id="ctl-vol" min="0" max="1" step="0.05" />
              </label>
              <!-- Each part of the sound under the master (audio/Sound.js). -->
              ${SOUND_PARTS.map((s) => `<label class="ctl-sub">${s.name} <b id="ctl-${s.id}-val"></b>
                <input type="range" id="ctl-${s.id}" data-part="${s.id}" min="0" max="1" step="0.05" />
              </label>`).join('')}
            </div>
            <!-- Playtest, P3: how you see the world, and how you look in it. -->
            <div class="ctl-look" id="ctl-look"></div>
            <div class="ctl-keys" id="ctl-keys"></div>
            <div class="field-row" style="margin-top:10px">
              <button class="secondary" id="ctl-reset">Back to the defaults</button>
            </div>
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

          <!-- The showcase (world/showcase.js): a workshop tool, behind the switch. -->
          <div class="menu-section" id="menu-showcase" hidden>
            <button class="menu-back" data-menu-back="1">${icon('chevron', 14)}<span>Menu</span></button>
            <div class="field-row" style="flex-wrap:wrap;">
              <button class="secondary" id="btn-showcase-open">Open the showcase</button>
            </div>
            <label class="menu-name"><span>Look from</span>
              <select id="showcase-spot">${SHOWCASE_SPOTS.map((sp) => `<option value="${sp.id}">${escapeHtml(sp.name)}</option>`).join('')}</select>
            </label>
            <div class="field-row" style="flex-wrap:wrap;">
              ${Object.keys(SHOWCASE_TIMES).map((t) => `<button class="secondary" data-showcase-time="${t}">${t[0].toUpperCase()}${t.slice(1)}</button>`).join('')}
            </div>
            <div class="export-note">Not saved: it is built again from the same seed every time. tools/showcase-shots.mjs takes its pictures.</div>
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
        'panel-map': `
          <div id="map-wrap">
            <canvas id="map-canvas" width="640" height="640"></canvas>
          </div>
          <div id="map-controls">
            <button class="secondary" id="map-zoom-out">Zoom out</button>
            <span id="map-scale"></span>
            <button class="secondary" id="map-zoom-in">Zoom in</button>
          </div>
          <div id="map-travel" class="building-actions"></div>
          <div class="export-note">A snapshot from where you were standing when you opened it — reopen to recentre.</div>`,
        'panel-clear': `
          <div id="clear-list"></div>
          <div class="export-note" id="clear-note"></div>`,
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
        <!--
          The picture itself is the camera (backlog batch 2, priority 0 — "the
          controls are shit for pvp"): drag anywhere to look, tap to place or
          strike, hold still to break. Under everything else, so the
          walking stick and the buttons still get their own touches.
        -->
        <div id="look-zone"></div>
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
          <button class="touch-btn duilt-only survival-only" id="t-bench" hidden>${icon('hammer')}<span>Bench</span></button>
          <button class="touch-btn duilt-only survival-only" id="t-skills" hidden>${icon('skills')}<span>Skills</span></button>
          <!-- Made, not given: these appear once you have the tool in your bag. -->
          <button class="touch-btn needs-tool" id="t-clear" data-tool="clear" hidden>${icon('clear')}<span>Clear</span></button>
          <button class="touch-btn needs-tool" id="t-symmetry" data-tool="mirror" hidden>${icon('symmetry')}<span>Mirror</span></button>
          <button class="touch-btn" id="t-designs">${icon('paste')}<span>Designs</span></button>
          <button class="touch-btn" id="t-roof">${icon('roof')}<span>Roof</span></button>
          <!-- Beside Roof, not a level down in Settings: the goals are what
               teaches the game, and Settings is where you go between builds. -->
          <button class="touch-btn" id="t-stats">${icon('stats')}<span>Goals</span></button>
          <button class="touch-btn" id="t-map">${icon('map')}<span>Map</span></button>
          <!-- Playtest, P3: your eyes, behind you, in front of you. -->
          <button class="touch-btn" id="t-view">${icon('person')}<span>View</span></button>
          <button class="touch-btn" id="t-screen">${icon('fullscreen')}<span>Screen</span></button>
        </div>

        <!--
          Break's element stays, hidden — holding the picture is Break now, and
          its label is still where the action names are written. Jump sits at
          the bottom right, under the thumb that looks (asked for directly: the
          left stick walks, the picture turns you, "jump can be on the right").

          One button on the ground, two in the air: Jump becomes Up, and Down
          appears under it. Up on top because that is the way they point. The
          pair is shifted down half a button by CSS so it straddles where the
          single one was, rather than dropping Down into the slot your thumb
          was resting on.
        -->
        <div class="stick-side" id="side-left">
          <button class="touch-btn small" id="t-break">${icon('mine')}<span>Break</span></button>
        </div>
        <div class="stick-side paired" id="side-right">
          <button class="touch-btn small" id="t-jump">${icon('up')}<span id="t-jump-label">Jump</span></button>
          <button class="touch-btn small" id="t-down">${icon('down')}<span id="t-down-label">Sneak</span></button>
        </div>

        <!-- Left edge, above the walking stick: the rest of what you press. -->
        <div class="touch-buttons" id="touch-buttons-left">
          <button class="touch-btn" id="t-more">${icon('menu')}<span>More</span></button>
          <button class="touch-btn" id="t-fly">${icon('fly')}<span>Fly</span></button>
          <button class="touch-btn" id="t-place" hidden>${icon('place')}<span>Place</span></button>
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

    // In Duilt the hotbar is the first PLAYABLE_SLOTS slots of the bag
    // itself, real inventory slots at fixed positions — not a summary
    // rebuilt from whatever the bag happened to hold. Reported directly:
    // that auto-built list meant there was nothing to press to get
    // something into the hotbar, no way to choose what sat where, and no
    // way to select a mining tool at all, since it only ever listed
    // block-shaped items plus a hardcoded handful of specials (bucket,
    // food). Getting an item into one of these slots is done by hand, from
    // the bag panel — see ui/DuiltUI.js's renderBag, which splits the same
    // slots into an "Equipped" section up top and "Bag" below.
    if (this.cb.isDuilt?.()) {
      const inv = this.game.duilt.inventory;
      const playable = inv.slots.slice(0, PLAYABLE_SLOTS);

      if (playable.every((s) => !s)) {
        hotbar.appendChild(el(`<div class="hotbar-empty">Nothing equipped — open your bag and drag something up</div>`));
        if (this.selectedItemId !== BARE_HANDS) this.selectHands(0);
        this.showHotbarLabel();
        return;
      }
      playable.forEach((s, i) => {
        if (!s) {
          // An empty slot is bare hands (backlog batch 2): selectable, and
          // what you hold when you pick it is nothing at all.
          const selected = this.selectedItemId === BARE_HANDS && this.handsSlot === i;
          hotbar.appendChild(el(`
            <div class="hotbar-slot empty ${selected ? 'selected' : ''}" data-slot="${i}" data-hands="1"
                 data-name="Bare hands" data-note="Breaks anything, slowly — builds nothing" title="Bare hands">
              <span class="key">${i + 1}</span>
            </div>
          `));
          return;
        }
        const spec = ITEMS_BY_ID.get(s.id);
        const isBlock = spec?.block != null;
        const selected = isBlock
          ? (!this.selectedItemId && spec.block === this.selectedBlockId)
          : this.selectedItemId === s.id;
        const note = isBlock ? '' : (TOOL_HOTBAR_NOTES[s.id] ?? '');
        hotbar.appendChild(el(`
          <div class="hotbar-slot ${selected ? 'selected' : ''}"
               data-slot="${i}" ${isBlock ? `data-id="${spec.block}"` : 'data-tool="1"'} data-item="${s.id}"
               data-name="${itemName(s.id)}" data-note="${note}"
               title="${itemName(s.id)}${note ? ` — ${note}` : ''} — ${s.count} here">
            <span class="key">${i + 1}</span>
            <div class="swatch swatch-cube">${itemIcon(spec, { size: 30 }) ?? glyphSvg(spec?.glyph, { size: 18, color: spec?.color })}</div>
            <span class="held">${s.count}</span>
          </div>
        `));
      });
      // What was selected can stop being true of any playable slot — spent
      // down to nothing, moved back to the bag by hand, a bucket swapped
      // for its filled counterpart — same as before, just read off real
      // slots now instead of a list rebuilt from the bag's contents.
      const stillValid = this.selectedItemId === BARE_HANDS
        ? !playable[this.handsSlot]
        : playable.some((s) => s && (this.selectedItemId
          ? s.id === this.selectedItemId
          : ITEMS_BY_ID.get(s.id)?.block === this.selectedBlockId));
      if (!stillValid) {
        const first = playable.find(Boolean);
        if (first) {
          const spec = ITEMS_BY_ID.get(first.id);
          if (spec?.block != null) this.selectBlock(spec.block); else this.selectItem(first.id);
        }
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
          <div class="swatch swatch-cube">${blockIcon(b.id, { size: 30 })}</div>
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
      listCloudWorlds: () => this.cb.getCloudWorlds(),
      knownWorlds: () => this.cb.knownWorlds?.() ?? [],
      getCloudUser: () => this.cb.getCloudUser?.() ?? null,
      isCloudConfigured: () => this.cb.isCloudConfigured?.() ?? false,

      // Entering happens inside the tap that asked for it — pointer lock is
      // only granted to a gesture — and the world arrives from the account a
      // moment later.
      onOpen: (id) => { this.enterWorld(); this.cb.onOpenWorld(id); },
      onCreate: (mode, name) => { this.cb.onNewWorld(mode, name); this.enterWorld(); },
      onRemove: async (id, label) => {
        const yes = await this.confirm({ title: `Delete "${label}"?`, body: 'Everything built in it goes with it, and this cannot be undone.', ok: 'Delete', danger: true });
        if (!yes) return false;
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
      // An empty Duilt playable slot is bare hands.
      if (slot.dataset.hands) { this.selectHands(Number(slot.dataset.slot)); return; }
      if (slot.classList.contains('empty')) return;
      if (slot.dataset.tool) { this.selectItem(slot.dataset.item); return; }
      const id = Number(slot.dataset.id);
      const availability = this.game.blockAvailability(id);
      if (!availability.ok) {
        this.toast({ kind: 'xp', title: 'Locked', body: availability.reason });
        return;
      }
      this.selectBlock(id);
    });

    // On a phone there is no C key, so the hint is what you press. While a
    // building is open for changes, the same strip and the same tap mean
    // something else — see setEditingBanner.
    this.q('#building-hint').addEventListener('click', () => {
      if (this.editingBanner) this.cb.onFinishEditing?.();
      // Pointing at a chest, a door or a gate, the strip says what Place
      // does to it — and tapping it does that, rather than opening a claim.
      else if (this.cb.onHintTap) this.cb.onHintTap();
      else this.cb.onOpenClaim();
    });

    for (const sel of ['#btn-fullscreen', '#t-screen']) {
      const fsBtn = this.q(sel);
      if (!fsBtn) continue;
      if (document.fullscreenEnabled) {
        fsBtn.addEventListener('click', () => { this.closeTray(); this.cb.onToggleFullscreen(); });
      } else fsBtn.remove();
    }

    // The only way into Goals used to be a touch-only button in the mobile
    // overlay (#t-stats) — nothing on desktop opened it at all, keyboard
    // shortcut included, until this one and panel-stats's `key` above existed.
    this.q('#btn-stats').addEventListener('click', () => this.openPanel('panel-stats'));
    this.q('#btn-map').addEventListener('click', () => this.openPanel('panel-map'));
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
      ['#t-map', () => this.openPanel('panel-map')],
      ['#t-view', () => this.game.cycleView?.()],
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
    this.wireControls();
    // Every button in the panels and menus answers with a soft, low tick —
    // not the touch controls, which are pressed far too often for it.
    this.root.addEventListener('click', (e) => { if (e.target.closest?.('[id^="panel-"] button')) this.game.sound?.click(); });
    this.renderMenuIndex();
    this.root.querySelectorAll('[data-menu-back]').forEach((btn) =>
      btn.addEventListener('click', () => this.showMenuSection(null)));
    this.q('#btn-resume').addEventListener('click', () => this.cb.onResume());
    // No "Saved" toast: saving is something you stop thinking about (backlog batch 2).
    this.q('#btn-leave').addEventListener('click', () => {
      this.cb.onLeaveWorld?.(true);
      this.closePanel('panel-menu');
      this.openHome();
    });
    this.q('#btn-leave-nosave').addEventListener('click', async () => {
      const since = this.lastSavedLabel();
      if (!await this.confirm({ title: 'Leave without saving?', body: `Everything since ${since} is lost.`, ok: 'Leave', danger: true })) return;
      this.cb.onLeaveWorld?.(false);
      this.closePanel('panel-menu');
      this.openHome();
    });
    this.q('#btn-export-world').addEventListener('click', () => this.cb.onExportWorld(this.q('#save-name').value));
    this.q('#btn-export-vox').addEventListener('click', () => this.cb.onExportVox(this.q('#save-name').value));
    this.q('#btn-import-world').addEventListener('click', () => this.cb.onImportWorld());
    // The showcase: open it, or move about it once it's open.
    this.q('#btn-showcase-open').addEventListener('click', () => { this.cb.onOpenShowcase?.(this.q('#showcase-spot').value); this.closeAllPanels(); });
    this.q('#showcase-spot').addEventListener('change', (e) => { if (this.cb.onShowcaseSpot?.(e.target.value)) this.closeAllPanels(); });
    this.root.querySelectorAll('[data-showcase-time]').forEach((b) => b.addEventListener('click', () => this.cb.onShowcaseTime?.(b.dataset.showcaseTime)));
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
    this.duiltUI.onStampStarter = (id) => this.cb.onStampStarter(id);
    this.duiltUI.onLeave = () => { this.closeAllPanels(); this.openHome(); };
    this.refreshForDuilt();
  }

  /**
   * Wires one thumbstick. The base rests at its CSS home so it's discoverable,
   * then jumps to wherever the thumb lands and tracks from there. Each stick
   * claims a single touch id, so both can be driven at once.
   */
  bindStick(zoneSel, onChange, { deadZone = 0.14, curve = 1, fixed = false } = {}) {
    const zone = this.q(zoneSel);
    const base = zone.querySelector('.stick-base');
    const knob = zone.querySelector('.stick-knob');
    // How far the knob travels: to the rim of the base, whatever size the
    // base is drawn (styles.css --stick-size), less the knob's own margin.
    let RADIUS = 42;
    const measure = () => { if (base.offsetWidth) RADIUS = Math.max(30, base.offsetWidth * 0.4); };
    let touchId = null;
    let running = false;
    let origin = { x: 0, y: 0 };
    // A fixed stick (asked for directly: "block the moving left joystick to
    // be still or else I keep picking it up with my right finger") stays
    // where it's drawn, and only a touch on it takes it — the rest of its
    // half of the screen is the picture, so a look-drag with the other thumb
    // that starts there turns you instead. See .stick-fixed in styles.css.
    const grab = fixed ? base : zone;
    if (fixed) zone.classList.add('stick-fixed');

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

    grab.addEventListener('touchstart', (e) => {
      if (touchId !== null) return;
      const t = e.changedTouches[0];
      touchId = t.identifier;
      measure();
      if (fixed) {
        // Pushed from its own middle, wherever on it the thumb came down.
        const b = base.getBoundingClientRect();
        origin = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      } else {
        origin = { x: t.clientX, y: t.clientY };
        // The base is positioned inside the zone, so offset by the zone's origin.
        const rect = zone.getBoundingClientRect();
        const half = base.offsetWidth / 2 || 52;
        base.style.left = `${t.clientX - rect.left - half}px`;
        base.style.top = `${t.clientY - rect.top - half}px`;
        base.style.right = 'auto';
        base.style.bottom = 'auto';
      }
      base.classList.add('active');
      setKnob();
      e.preventDefault();
    }, { passive: false });

    grab.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== touchId) continue;
        let dx = t.clientX - origin.x, dy = t.clientY - origin.y;
        // Running is its own place, not the end of walking: played on, "the
        // difference between walking and running needs to be more pronounced
        // or else I'll be sprinting all the time. Make sure it's only
        // sprinting when reaching max front". The rim is full walking pace;
        // only a thumb carried on up past it, straight ahead, runs — a thumb
        // that overshoots sideways or back, or only reaches the rim, walks.
        const wasRunning = running;
        running = -dy >= RADIUS * STICK_RUN_REACH && Math.abs(dx) <= -dy * STICK_RUN_SPREAD;
        if (running !== wasRunning) base.classList.toggle('running', running);
        const len = Math.hypot(dx, dy);
        if (len > RADIUS) { dx = (dx / len) * RADIUS; dy = (dy / len) * RADIUS; }
        setKnob(dx, running ? -RADIUS * STICK_RUN_KNOB : dy);
        const out = shape(dx, dy);
        onChange(out.x, -out.y, running);
      }
      e.preventDefault();
    }, { passive: false });

    const release = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== touchId) continue;
        touchId = null;
        running = false;
        base.classList.remove('active', 'running');
        if (!fixed) for (const prop of ['left', 'top', 'right', 'bottom']) base.style.removeProperty(prop);
        setKnob();
        onChange(0, 0);
      }
    };
    grab.addEventListener('touchend', release);
    grab.addEventListener('touchcancel', release);
  }

  /**
   * The screen as the camera, the way phone shooters do it (backlog batch 2,
   * priority 0). One finger anywhere that isn't a stick or a button:
   *
   *   drag        turns you, like a mouse — the picture follows the finger
   *   tap         Place's job: puts down the block you hold, opens a gate —
   *               and strikes whatever is in front of you; holding a tool or
   *               nothing, it digs as Break's tap did (Game.tapAction)
   *   hold still  breaks, and keeps breaking; drag while holding to sweep
   *               along a wall
   *
   * Played on: "place should be tap, break should be a hold".
   *
   * A touch only becomes a look once it has moved past LOOK_SLOP, so a tap
   * doesn't nudge the view; past that it's a look and never a tap.
   */
  bindLookSurface() {
    const zone = this.q('#look-zone');
    let id = null, start = null, last = null, moved = false, holding = false, timer = null, finishing = null;
    // A tap into a block finishes it: digging takes longer than a tap lasts
    // (half a second or more by hand), so the tap carries on until the
    // block is through, and stops there. Only when the tap started a dig —
    // a tap that struck somebody isn't repeated.
    const stopFinishing = () => {
      if (!finishing) return;
      clearTimeout(finishing);
      finishing = null;
      this.cb.onBreakHold?.(false);
    };
    const tap = () => {
      const did = this.cb.onTap ? this.cb.onTap() : (this.cb.onBreakTap(), 'break');
      if (did !== 'break' || !this.cb.isDigging?.()) return;
      this.cb.onBreakHold?.(true, { once: true });
      finishing = setTimeout(stopFinishing, TAP_FINISH_MS);
    };
    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (id !== null) return;
      stopFinishing();
      const t = e.changedTouches[0];
      id = t.identifier;
      start = last = { x: t.clientX, y: t.clientY };
      moved = false;
      holding = false;
      timer = setTimeout(() => {
        if (id === null || moved) return;
        holding = true;
        this.cb.onBreakTap();
        this.cb.onBreakHold?.(true);
      }, LOOK_HOLD_MS);
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        if (!moved && Math.hypot(t.clientX - start.x, t.clientY - start.y) > LOOK_SLOP) moved = true;
        if (moved) this.cb.onLookDrag?.(t.clientX - last.x, t.clientY - last.y);
        last = { x: t.clientX, y: t.clientY };
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        clearTimeout(timer);
        if (holding) this.cb.onBreakHold?.(false);
        else if (!moved && e.type === 'touchend') tap();
        id = null;
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);
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
    // A steeper curve than it was (1.1): most of the stick is a walk you can
    // steer, and only the rim is full pace — "we are moving really fast, only
    // in mobile".
    this.bindStick('#stick-left', (x, y, run) => this.cb.onMove(x, y, run), { deadZone: 0.12, curve: 1.6, fixed: true });
    // A steeper curve than the walking stick: most of a look is a small
    // correction, and a linear stick spends nearly all its travel on speeds
    // too fast to aim with. At half a thumb this now turns about a fifth of
    // full speed rather than a third.
    // No look stick any more: the picture is the camera (bindLookSurface).
    this.bindLookSurface();

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
    // Place is a hold too, the same reason Break is: one block per tap meant
    // tapping forty times to wall something in.
    {
      const btn = this.q('#t-place');
      const down = (e) => {
        e.preventDefault();
        btn.classList.add('active');
        this.cb.onPlaceTap();
        this.cb.onPlaceHold?.(true);
      };
      const up = () => { btn.classList.remove('active'); this.cb.onPlaceHold?.(false); };
      btn.addEventListener('touchstart', down, { passive: false });
      btn.addEventListener('touchend', up);
      btn.addEventListener('touchcancel', up);
    }
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
      // Tools come in as you go, the way buildings do (backlog batch 2) —
      // and say so when they do, rather than turning up unannounced at the bench.
      const fresh = newGearAt(age);
      if (fresh.length) {
        this.toast({
          kind: 'challenge',
          title: 'New at the bench',
          body: fresh.length > 4 ? `${fresh.slice(0, 4).join(', ')} and ${fresh.length - 4} more` : fresh.join(', '),
        });
      }
    });
    // The end of a path: its illustrated ending first, then what you built.
    this.bus.on('duilt:won', () => {
      const which = endingFor(this.game.duilt);
      if (!which) return void this.openPanel('panel-finish');
      this.story.play(ENDINGS[which], { last: 'Continue', onDone: () => this.openPanel('panel-finish') });
    });

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
    // Used to pop a "Session Complete" panel over the game every time two
    // minutes passed without an edit — not a milestone, just an interruption
    // while you're standing there deciding what to build next. Requested
    // directly: dropped, along with the panel it opened.
  }

  selectBlock(id) {
    this.selectedBlockId = id;
    this.selectedItemId = null;
    this.root.querySelectorAll('.hotbar-slot').forEach((s) =>
      s.classList.toggle('selected', !s.dataset.tool && Number(s.dataset.id) === id));
    this.showHotbarLabel();
    this.cb.onSelectSlot(id);
  }

  /** Selects an empty slot: bare hands (BARE_HANDS in config/items.js). */
  selectHands(i) {
    this.selectedItemId = BARE_HANDS;
    this.handsSlot = i;
    this.root.querySelectorAll('#hotbar .hotbar-slot').forEach((s) =>
      s.classList.toggle('selected', !!s.dataset.hands && Number(s.dataset.slot) === i));
    this.showHotbarLabel();
    this.cb.onSelectItem?.(BARE_HANDS);
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
      // In Duilt this is now literally slot n-1, the same classic hotbar
      // number keys always meant — nothing to look up, since the slot's
      // position in the bag *is* the number now.
      const slot = this.root.querySelectorAll('#hotbar .hotbar-slot')[n - 1];
      if (slot?.dataset.hands) return void this.selectHands(n - 1);
      if (!slot || slot.classList.contains('empty')) return;
      if (slot.dataset.tool) this.selectItem(slot.dataset.item);
      else this.selectBlock(Number(slot.dataset.id));
      return;
    }
    const b = PLACEABLE_BLOCKS[n - 1];
    if (!b) return;
    if (!this.game.blockAvailability(b.id).ok) return;
    this.selectBlock(b.id);
  }

  /**
   * Moves the selection one slot left or right — the scroll wheel, so picking
   * something isn't only the number keys or clicking a slot by hand. Reads
   * the DOM the hotbar just drew rather than a separate list, so it works the
   * same way in Duilt and Creative without knowing which one it is; a locked
   * Creative slot is skipped rather than landed on, the same as a number key
   * already refuses one — an empty Duilt playable slot the same way now.
   */
  cycleHotbarByDelta(delta) {
    const slots = [...this.root.querySelectorAll('#hotbar .hotbar-slot')]
      .filter((s) => !s.classList.contains('locked') && !s.classList.contains('empty'));
    if (!slots.length) return;
    const current = slots.findIndex((s) => s.classList.contains('selected'));
    const next = slots[(current + delta + slots.length) % slots.length];
    if (next.dataset.tool) this.selectItem(next.dataset.item);
    else this.selectBlock(Number(next.dataset.id));
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
    // A retry that keeps failing the same way — a save that cannot reach the
    // account, say — fires this exact toast again every few minutes. Piling
    // up five identical copies (reported directly: a wall of "Not saved to
    // your account yet") never told the player anything the first one
    // didn't; swap it out instead, so the stack only ever grows for actually
    // different news.
    const key = `${kind}|${title}|${body ?? ''}`;
    const dupe = [...stack.children].find((n) => n.dataset.toastKey === key);
    if (dupe) this.dismissToast(dupe);
    if (kind === 'achievement') this.game?.sound?.chime();
    const node = el(`<div class="toast ${kind}">
      <div class="title">${title}</div>
      ${body ? `<div class="body">${body}</div>` : ''}
      ${action ? `<button class="toast-action">${escapeHtml(action.label)}</button>` : ''}
    </div>`);
    node.dataset.toastKey = key;
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
    //
    // The same is true with a panel open, on any device: the stack sits above
    // panels on purpose, so a message answering something you just pressed
    // inside one is never hidden behind it — but five of them at once, each
    // alive for over three seconds, is a wall over whatever the panel actually
    // holds. Reported directly: opening the bag with a few toasts still up
    // left the slots themselves covered and impossible to work with. One at a
    // time keeps that promise without also blocking the thing the panel is for.
    if (this.isTouch || this.isAnyPanelOpen()) this.collapseToasts();

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

  /**
   * Clears whatever is already in the stack — called whenever a panel opens
   * (see the Panels.onOpen hook below) and before a new toast joins a stack
   * that was already up. A panel you just opened is the thing on screen you
   * are meant to be looking at; a pile of toasts left over from before you
   * opened it is not.
   */
  collapseToasts() {
    const stack = this.q('#toast-stack');
    if (!stack) return;
    for (const old of [...stack.children]) this.dismissToast(old);
  }

  /**
   * Hides the HUD and touch controls behind whatever overlay is on top —
   * called on every panel and screen open/close (see the Panels hooks
   * above), so it covers the Duilt layer's panels too.
   *
   * This used to be a CSS sibling selector keyed off specific panel ids
   * (`#blocker:not([hidden]) ~ #hotbar-wrap`, and separately for
   * panel-stats and panel-menu) — which only ever worked for panels that
   * happen to be direct siblings of the HUD in the DOM. The Duilt layer's
   * own panels (the bag, a storehouse, buildings, the bench…) live inside
   * `#duilt-layer`, a level deeper, so no sibling selector could ever reach
   * them: the hotbar and the touch Fill/Jump buttons sat there fully
   * visible and fully dead under the bag screen, answering no tap at all.
   * A class on the body has no DOM-depth problem to have, and one registry
   * (Panels, see Panels.js's own doc comment) means this covers every
   * panel there is without a list of ids to keep in sync by hand.
   *
   * One exception: the bag. Reported directly, twice — first that the
   * hotbar sat there fully visible and fully dead under the bag screen
   * (fixed above by hiding it), then that hiding it left nothing to
   * organize into: the bag *is* the inventory (one set of slots, see
   * DuiltUI.renderBag), and the hotbar is the one on-screen way to see
   * and change what's selected to build with while you're in there sorting
   * it. So the bag alone gets it back — see the `body.bag-open` rule in
   * styles.css, which also lifts it above the bag's own dimmed backdrop so
   * taps land on it rather than falling through to the overlay behind.
   */
  updateHudVisibility() {
    const hidden = this.panels.all().some((el) => !el.hidden);
    document.body.classList.toggle('panel-open', hidden);
    document.body.classList.toggle('bag-open', this.panels.isOpen('panel-bag'));
  }

  /** Fills a panel in just before it is shown, if it has anything to fill. */
  populatePanel(id) {
    if (id === 'panel-menu') {
      const kind = this.cb.getModeLabel?.() ?? 'Duilt';
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
    if (id === 'panel-map') this.renderMap();
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

  /** The game's own yes/no — never the browser's grey dialog (ui/Confirm.js). */
  confirm(opts) {
    return askConfirm(this.root, opts);
  }

  /**
   * Names the claimed building under the crosshair, or hides the hint.
   * Called every frame, so it only touches the DOM when something changed.
   *
   * Skipped outright while setEditingBanner has the strip: that message
   * doesn't depend on where you're looking, and the per-frame aim check
   * would otherwise overwrite or hide it the instant you looked away from
   * whatever you'd just broken or placed.
   */
  setBuildingHint(text, { manage = true } = {}) {
    if (this.editingBanner) return;
    const el = this.q('#building-hint');
    if (!el) return;
    if (!text) { if (!el.hidden) el.hidden = true; return; }
    // A door or a gate on its own isn't a building: nothing to manage.
    const verb = typeof manage === 'string' ? manage : 'manage';
    const extra = manage ? `<span>${this.isTouch ? 'Tap' : 'C'} to ${verb}</span>` : '';
    const wanted = `<b>${text}</b>${extra}`;
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
    if (this.editingBanner) return;
    const el = this.q('#building-hint');
    if (!el) return;
    if (!name) { el.hidden = true; el.classList.remove('bad'); return; }
    const how = this.isTouch ? 'Place to drop it' : 'Click to drop it, Escape to cancel';
    el.innerHTML = `<b>Moving the ${name.toLowerCase()}</b><span>${reason ?? how}</span>`;
    el.classList.toggle('bad', !!reason);
    el.hidden = false;
  }

  /**
   * Pins the crosshair strip to "editing this building" for as long as a
   * building is unlocked for changes, regardless of where you're looking —
   * that used to be the one way to finish, so the moment you looked away
   * from the last block you touched (or broke it clean off, with nothing
   * left there to aim at), the only way back was to walk to wherever a wall
   * of it still stood and aim precisely enough to reopen the claim panel.
   * A tap here does the same thing setEditingBanner made this strip into a
   * button for: finish, without needing to find that spot again.
   */
  setEditingBanner(name) {
    this.editingBanner = true;
    document.body.classList.add('editing-building');
    const el = this.q('#building-hint');
    if (!el) return;
    el.innerHTML = `<b>Editing the ${name.toLowerCase()}</b>`
      + `<span>${this.isTouch ? 'Tap' : 'Click'} here when you're done</span>`;
    el.classList.remove('bad');
    el.hidden = false;
  }

  clearEditingBanner() {
    this.editingBanner = false;
    document.body.classList.remove('editing-building');
    const el = this.q('#building-hint');
    if (el) el.hidden = true;
  }

  /**
   * Names the settler under the crosshair.
   *
   * Same strip as the building hint, because it answers the same question —
   * what is that? — and two labels fighting over the middle of the screen is
   * worse than either.
   */
  setPersonHint(name, doing) {
    if (this.editingBanner) return;
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
    // A Creative world has no goals: nothing in it counts (see
    // GamificationEngine.checkAchievements). Reported directly: "take something
    // apart goal is not working" — it was listed there, and could never tick.
    if (this.game.duilt?.sandbox) {
      this.q('#stats-sub').textContent = 'Creative · no goals here';
      this.q('#ach-grid').innerHTML = `<div class="goal-next">Creative is for building freely, so nothing here counts towards goals or levels. Open a Duilt world to work through the ages.</div>`;
      this.q('#challenge-list').innerHTML = '';
      return;
    }
    const s = this.gamification.snapshot();
    const done = s.achievementsUnlocked;
    // Only the ages you've reached. Reported directly: the whole list, every
    // age at once, read as a wall of things not done before you'd done any.
    // The next age's band appears when this one is finished, with one line
    // below saying so, so it's clear there is more without showing it.
    const bands = goalBands();
    const shown = bands.filter((band) => band.age <= s.age);
    const next = bands.find((band) => band.age > s.age);
    const shownGoals = shown.flatMap((band) => band.goals);
    const shownDone = shownGoals.filter((g) => done.has(g.id)).length;
    this.q('#stats-sub').textContent = `Age ${s.age} · ${shownDone} of ${shownGoals.length} done · level ${s.level}`;

    // Banded by age, because the bands are the order you are meant to do them
    // in — this list is the only thing teaching the game now, and a flat grid
    // of twenty cards answers "what have I done" but never "what next".
    const ctx = this.gamification.ctx();
    this.q('#ach-grid').innerHTML = shown.map((band) => {
      const met = band.goals.filter((g) => done.has(g.id)).length;
      return `
        <div class="goal-band">
          <div class="goal-band-head">
            <span>Age ${band.age} \u00b7 ${escapeHtml(band.name)}</span>
            <span class="goal-band-count">${met} / ${band.goals.length}</span>
          </div>
          <p class="goal-band-intro">${escapeHtml(ageIntro(band.age, this.game.duilt?.ring) ?? '')}</p>
          ${band.goals.map((g, i) => {
            const isDone = done.has(g.id);
            const progress = !isDone ? g.progress?.(ctx) : null;
            return `
            <div class="ach-card ${isDone ? 'done' : 'locked'} ${g.required ? 'required' : ''}">
              <div class="ach-icon">${g.icon}</div>
              <div class="ach-body">
                <div class="ach-name">
                  <span class="ach-num">${i + 1}.</span> ${escapeHtml(g.name)}
                  ${progress ? `<span class="ach-progress">${progress}</span>` : ''}
                </div>
                <div class="ach-desc">${escapeHtml(g.description)}</div>
              </div>
              ${isDone ? '<span class="ach-done" aria-label="Done">✓</span>' : ''}
            </div>`;
          }).join('')}
        </div>`;
    }).join('') + (next
      ? `<div class="goal-next">Age ${next.age} appears here once you finish Age ${s.age}.</div>`
      : '');

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
    this.renderLore();
  }

  /**
   * The lore book (config/lore.js): the pages you know, and locked ones
   * saying where to look. Only in a Duilt world — Creative has no story.
   */
  renderLore() {
    const d = this.game.duilt;
    const tab = this.q('#lore-tab'), list = this.q('#lore-list');
    if (!tab || !list) return;
    tab.hidden = !d || d.sandbox;
    if (tab.hidden) return;
    const k = loreKnowledge(d);
    const known = LORE.filter((page) => page.known(k));
    list.innerHTML = `<div class="lore-count">${known.length} of ${LORE.length} pages</div>`
      + LORE.map((page) => (page.known(k)
        ? `<div class="lore-page">
            <div class="lore-head"><span class="lore-icon">${page.icon}</span>${escapeHtml(page.title)}</div>
            <p>${escapeHtml(page.text(k))}</p>
            ${page.replay ? `<button class="secondary lore-replay" data-replay="${page.replay}">${page.replay === 'intro' ? 'Watch the opening again' : 'Watch the ending again'}</button>` : ''}
          </div>`
        : `<div class="lore-page locked">
            <div class="lore-head"><span class="lore-icon">?</span>Unknown</div>
            <p>${escapeHtml(page.hint ?? '')}</p>
          </div>`)).join('');
    for (const b of list.querySelectorAll('[data-replay]')) {
      b.addEventListener('click', () => {
        const scenes = b.dataset.replay === 'intro' ? INTRO : ENDINGS[k.ending];
        this.story.play(scenes, { last: 'Close', onDone: () => this.openPanel('panel-stats') });
      });
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
    // Two buttons on the right, always (asked for directly: "on the right we
    // should have two buttons, one with an arrow top to jump, the other arrow
    // down to sneak. This can then be used for fly"). On your feet they jump
    // and sneak; in the air the same two climb and descend.
    document.body.classList.toggle('flying', !!flying);
    const label = this.q('#t-jump-label');
    if (label) label.textContent = flying ? 'Up' : 'Jump';
    const down = this.q('#t-down-label');
    if (down) down.textContent = flying ? 'Down' : 'Sneak';
  }

  /**
   * Shows the tools you actually have — real ones in the bag, both in real
   * Duilt and in a sandbox, which starts with one of everything (see
   * DuiltGame.grantCreativeKit) rather than nothing to make them with.
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
    const lights = this.q('#gfx-lights');
    res.value = String(g.resolution ?? 'auto');
    dist.value = String(g.distance ?? 'auto');
    aa.checked = g.antialias !== false;
    lights.checked = g.lights !== false;
    const ao = this.q('#gfx-ao'), air = this.q('#gfx-atmosphere');
    ao.checked = g.ao !== false;
    air.checked = g.atmosphere !== false;

    const apply = () => {
      const resolution = res.value === 'auto' ? 'auto' : Number(res.value);
      const result = this.game.applyGraphics({
        resolution,
        distance: dist.value,
        antialias: aa.checked,
        smoothing: resolution === 'auto',
        lights: lights.checked,
        ao: ao.checked,
        atmosphere: air.checked,
      });
      const note = this.q('#gfx-note');
      note.hidden = !result?.needsReload;
      if (result?.needsReload) note.textContent = 'Smooth edges applies when you reload the page.';
    };
    res.addEventListener('change', apply);
    dist.addEventListener('change', apply);
    aa.addEventListener('change', apply);
    lights.addEventListener('change', apply);
    ao.addEventListener('change', apply);
    air.addEventListener('change', apply);

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
   * The controls settings — requested directly: "in settings we should add
   * controls to change keyboards, sound, FOV." Sliders apply as you drag;
   * a key is changed by pressing its button, then the new key.
   */
  wireControls() {
    const fov = this.q('#ctl-fov'), sens = this.q('#ctl-sens'), vol = this.q('#ctl-vol');
    if (!fov) return;
    const show = () => {
      const c = this.game.controls ?? DEFAULT_CONTROLS;
      fov.value = c.fov; sens.value = c.sensitivity; vol.value = c.volume;
      this.q('#ctl-fov-val').textContent = `${c.fov}°`;
      this.q('#ctl-sens-val').textContent = `${Number(c.sensitivity).toFixed(2)}×`;
      this.q('#ctl-vol-val').textContent = c.volume > 0 ? `${Math.round(c.volume * 100)}%` : 'Off';
      // The parts sit under the master: with the master off, so are they.
      for (const s of SOUND_PARTS) {
        const input = this.q(`#ctl-${s.id}`);
        if (!input) continue;
        const v = c[s.id] ?? DEFAULT_CONTROLS[s.id];
        input.value = v;
        input.disabled = !(c.volume > 0);
        this.q(`#ctl-${s.id}-val`).textContent = v > 0 ? `${Math.round(v * 100)}%` : 'Off';
      }
      this.q('#ctl-keys').innerHTML = ACTIONS.map((a) => `
        <div class="ctl-key">
          <span>${a.name}</span>
          <button class="secondary" data-bind="${a.id}">${this.waitingFor === a.id ? 'Press a key…' : keyLabel(c.keys[a.id])}</button>
        </div>`).join('');
      this.q('#ctl-keys').querySelectorAll('[data-bind]').forEach((btn) => btn.addEventListener('click', () => {
        this.waitingFor = btn.dataset.bind;
        show();
      }));
      for (const seg of this.root.querySelectorAll('.ctl-seg')) {
        for (const b of seg.querySelectorAll('button')) b.classList.toggle('on', c[seg.dataset.seg] === b.dataset.val);
      }
      const preview = this.q('#ctl-touch-preview');
      if (preview) preview.innerHTML = touchLayoutPreview(c);
      const lookBox = this.q('#ctl-look');
      if (lookBox) {
        const look = c.look ?? DEFAULT_LOOK;
        const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
        const swatches = (key, colours) => colours.map((col, i) => `<button class="look-swatch${(look[key] ?? 0) === i ? ' on' : ''}" data-look="${key}" data-i="${i}" style="background:${hex(col)}" aria-label="${key} ${i + 1}"></button>`).join('');
        lookBox.innerHTML = `
          <div class="ctl-seg-row"><span>View</span>
            <div class="ctl-seg" data-view-seg="1">${VIEWS.map((v) => `<button data-view="${v}" class="${(c.view ?? 'first') === v ? 'on' : ''}">${{ first: 'Eyes', behind: 'Behind', front: 'Front' }[v]}</button>`).join('')}</div>
          </div>
          <div class="look-row"><span>Skin</span><div>${swatches('skin', SKINS)}</div></div>
          <div class="look-row"><span>Hair</span><div>${swatches('hair', HAIRS)}</div></div>
          <div class="look-row"><span>Clothes</span><div>${swatches('clothes', CLOTHES.map((x) => x.shirt))}</div></div>`;
        lookBox.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => apply({ view: b.dataset.view })));
        lookBox.querySelectorAll('[data-look]').forEach((b) => b.addEventListener('click', () => apply({ look: { ...look, [b.dataset.look]: Number(b.dataset.i) } })));
      }
    };
    const apply = (next) => { this.game.applyControls?.(next); show(); };
    fov.addEventListener('input', () => apply({ fov: Number(fov.value) }));
    sens.addEventListener('input', () => apply({ sensitivity: Number(sens.value) }));
    vol.addEventListener('input', () => apply({ volume: Number(vol.value) }));
    vol.addEventListener('change', () => this.game.sound?.click());
    for (const s of SOUND_PARTS) {
      const input = this.q(`#ctl-${s.id}`);
      input?.addEventListener('input', () => apply({ [s.id]: Number(input.value) }));
    }
    // Something to hear at the level just chosen.
    this.q('#ctl-sfx')?.addEventListener('change', () => this.game.sound?.place('wood'));
    for (const seg of this.root.querySelectorAll('.ctl-seg')) {
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-val]');
        if (b) apply({ [seg.dataset.seg]: b.dataset.val });
      });
    }
    this.q('#ctl-reset').addEventListener('click', () => { this.waitingFor = null; apply(structuredClone(DEFAULT_CONTROLS)); });
    // Waiting for a key: the next one pressed is the new binding. Escape
    // cancels, and is never itself bound — it's how you get out of things.
    window.addEventListener('keydown', (e) => {
      if (!this.waitingFor) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code !== 'Escape') apply(rebind(this.game.controls ?? DEFAULT_CONTROLS, this.waitingFor, e.code));
      this.waitingFor = null;
      show();
    }, true);
    show();
  }

  /**
   * Puts the thumbsticks and buttons on the sides the controls settings say
   * — only classes on the body; styles.css moves everything.
   */
  applyTouchLayout(controls) {
    for (const [cls, on] of Object.entries(touchLayoutClasses(controls))) document.body.classList.toggle(cls, on);
  }

  /**
   * Shows the parts of the HUD that belong to a Duilt world.
   *
   * Only *systems* are hidden here — the bag, the workbench, the settlement.
   * The building tools are not: a roof, a design and a mirror are things you do
   * to blocks, and blocks work the same in every world. Tying them to a world
   * type meant a Creative player could not roof a house and a Duilt player
   * could not save a design, for no reason either of them could have guessed.
   *
   * Creative is a sandbox built on the same engine now — the bag, buildings
   * and settlers all work there too, so `.duilt-only` (which really means
   * "needs the Duilt engine under it") shows for both. `.survival-only` is
   * the narrower set that only makes sense with real scarcity behind it —
   * the workbench (there's nothing left to craft when you already hold one
   * of everything) and skill levels (there's nothing to grind XP into) —
   * so it shows only in real Duilt, never in a sandbox world.
   */
  refreshForDuilt() {
    const on = !!this.cb.isDuilt?.();
    const survival = on && !this.cb.isSandbox?.();
    this.root.querySelectorAll('.duilt-only').forEach((el) => { el.hidden = !on; });
    this.root.querySelectorAll('.survival-only').forEach((el) => { el.hidden = !survival; });
    this.duiltUI?.setActive(on);
    this.refreshTools();
  }

  toggleBag() { return this.duiltUI?.toggleBag(); }
  openClaim(region, onClaim, opts) { this.duiltUI?.openClaim(region, onClaim, opts); }
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

  /** A market's trader, and what they sell. */
  openTrader(person) {
    this.openPanel('panel-trade');
    this.duiltUI?.showTrader(person);
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
      this.setActionLabels(...this.defaultActionLabels());
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
    p.hidden = !PLACE_ONLY.has(placeLabel);
  }

  /** The two button labels for whatever is selected right now, with no tool queued. */
  defaultActionLabels() {
    const [b, p] = TOOL_ACTION_LABELS[this.selectedItemId] ?? (isFood(this.selectedItemId) ? ['Eat', 'Throw']
      : !this.selectedItemId && cropOf(this.selectedBlockId) ? ['Break', 'Plant'] : ['Break', 'Place']);
    // Pointed at a door or a gate, Place opens or closes it whatever you hold.
    return [b, this.aimedSwing ?? p];
  }

  /**
   * What Place would do to the door or gate under the crosshair — "Open" or
   * "Close" — or null when it's aimed at anything else. Only touches the
   * buttons when it changes, and never while a tool or a building is held,
   * which have labels of their own.
   */
  setAimedSwing(label) {
    if (this.aimedSwing === label) return;
    this.aimedSwing = label;
    if (this.carrying || this.armedTool) return;
    this.setActionLabels(...this.defaultActionLabels());
    this.q('#t-place')?.classList.toggle('swing', !!label);
  }

  /**
   * Carrying a building changes what the two thumb buttons mean, so they say
   * so. Guessing which of Break and Place puts down the thing in your hands is
   * not a puzzle worth having.
   */
  setCarrying(on) {
    this.carrying = on;
    const [b, p] = this.defaultActionLabels();
    this.setActionLabels(on ? 'Cancel' : b, on ? 'Drop' : p);
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
      this.confirm({ title: 'Delete this design?', ok: 'Delete', danger: true }).then((yes) => {
        if (yes) { this.cb.onDeleteTemplate(btn.dataset.drop); this.refreshTemplateList(); }
      });
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


  /**
   * The full map — every device gets this one (see Minimap.js's own note on
   * why the corner HUD instrument doesn't). A snapshot of wherever you were
   * standing when the panel opened: Zoom in/out redraw the same snapshot at
   * a different scale, but only reopening the panel recentres it on where
   * you are now, which is what the note under the canvas says outright
   * rather than leaving you to notice it drifted.
   */
  renderMap() {
    const canvas = this.q('#map-canvas');
    const gen = this.game.world?.gen;
    if (!canvas || !gen) return;
    const p = this.game.player.position;
    // Recentred every open, but the zoom level you left it at carries over —
    // picking "far out" once should not mean picking it again every time.
    const zoomIndex = this.mapView?.zoomIndex ?? 1;
    this.mapView = { x: p.x, z: p.z, yaw: this.game.player.yaw, zoomIndex };
    this.drawMap();

    const zoomOut = this.q('#map-zoom-out');
    const zoomIn = this.q('#map-zoom-in');
    if (zoomOut && !zoomOut.dataset.wired) {
      zoomOut.dataset.wired = '1';
      zoomOut.addEventListener('click', () => this.stepMapZoom(1));
      zoomIn.dataset.wired = '1';
      zoomIn.addEventListener('click', () => this.stepMapZoom(-1));
    }
  }

  stepMapZoom(delta) {
    if (!this.mapView) return;
    this.mapView.zoomIndex = Math.max(0, Math.min(MAP_ZOOMS.length - 1, this.mapView.zoomIndex + delta));
    this.drawMap();
  }

  /** Repaints the map canvas from whatever this.mapView currently holds. */
  drawMap() {
    const canvas = this.q('#map-canvas');
    const gen = this.game.world?.gen;
    if (!canvas || !gen || !this.mapView) return;
    const { x, z, yaw, zoomIndex } = this.mapView;
    const radius = MAP_ZOOMS[zoomIndex];
    const duilt = this.game.duilt;
    const territory = duilt && !duilt.sandbox ? duilt.territory.bounds() : null;
    const home = gen.biomes ? { x: gen.biomes.centreX, z: gen.biomes.centreZ } : null;
    const sites = this.game.kingdomSites?.() ?? [];
    const places = (duilt?.foundPlaces() ?? []).filter((p) => !(p.kind === 'kingdom' && sites.some((s) => s.kind === 'kingdom')));
    drawWorldMap(canvas, gen, x, z, yaw, { radius, home, territory, places, sites });
    // In Creative, a button to go and look at each kingdom. On the dark
    // path, the expedition: send the army ahead, or join it at its camp.
    const travel = this.q('#map-travel');
    if (travel) {
      const go = duilt?.sandbox ? sites : [];
      const ex = this.game.expeditionState?.();
      travel.innerHTML = go.map((s) => `<button class="primary" data-travel="${s.kind}">Travel to the ${s.name}</button>`).join('')
        + (ex?.ready ? `<button class="primary" data-expedition="send">Send the army to the Sky Kingdom</button>` : '')
        + (ex?.marching ? `<button class="secondary" disabled>Your army is on the march — at the Sky Kingdom in ${ex.left < 1 ? 'less than a day' : `${Math.ceil(ex.left)} days`}</button>` : '')
        + (ex?.camped ? `<button class="primary" data-expedition="join">Join your army at its camp</button>` : '');
      travel.hidden = !travel.innerHTML;
      for (const b of travel.querySelectorAll('[data-travel]')) {
        b.addEventListener('click', () => { if (this.game.travelTo(b.dataset.travel)) this.closePanel('panel-map'); });
      }
      for (const b of travel.querySelectorAll('[data-expedition]')) {
        b.addEventListener('click', () => {
          const done = b.dataset.expedition === 'send' ? this.game.sendExpedition() : this.game.joinExpedition();
          if (done) this.closePanel('panel-map');
        });
      }
    }
    const scale = this.q('#map-scale');
    if (scale) scale.textContent = `± ${radius} blocks`;
    const zoomOut = this.q('#map-zoom-out');
    const zoomIn = this.q('#map-zoom-in');
    if (zoomOut) zoomOut.disabled = zoomIndex === MAP_ZOOMS.length - 1;
    if (zoomIn) zoomIn.disabled = zoomIndex === 0;
  }

  /** Redrawn on a timer, not every frame — see Game.js's own throttle. Desktop only. */
  updateMinimap(gen, x, z, yaw) {
    this.minimap?.update(gen, x, z, yaw);
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

/**
 * The tools, weapons and armour that first become makeable at the bench in
 * `age` — what "New at the bench" names when you reach it.
 */
export function newGearAt(age) {
  return RECIPES
    .filter((r) => r.age === age && r.station === 'hand' && ['tool', 'armour'].includes(ITEMS_BY_ID.get(r.output.id)?.kind))
    .map((r) => r.name);
}
