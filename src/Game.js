import * as THREE from 'three';
import { World, CHUNK_SIZE } from './world/World.js';
import { ChunkMesher } from './world/ChunkMesher.js';
import { PlayerController } from './player/PlayerController.js';
import { castVoxelRay } from './interaction/VoxelRaycast.js';
import { buildTemplatePlacement, rotateTemplate, captureBlocks } from './tools/Templates.js';
import { roofPlan, roofBlocks, roofPeak, roofPick, roofTypeFor } from './tools/RoofTool.js';
import { pickBuild, wallFootprintAt } from './tools/PointerPick.js';
import { ROOFS_BY_ID, facingLabel } from './config/roofs.js';
import { clearPlan, clearCells, cellBounds } from './tools/ClearTool.js';
import { CLEARS_BY_ID } from './config/clears.js';
import { SelectionHighlight } from './tools/SelectionHighlight.js';
import { BuildGhost } from './tools/BuildGhost.js';
import { SettlerView } from './render/SettlerView.js';
import { CloudAuth } from './net/CloudAuth.js';
import { CloudWorlds } from './net/CloudWorlds.js';
import { isCloudConfigured } from './net/cloudConfig.js';
import { DuiltGame } from './duilt/DuiltGame.js';
import { generateEndlessWorld } from './world/StarterWorld.js';
import { ChunkGen, WORLD_HEIGHT } from './world/ChunkGen.js';
import { FarTerrain } from './render/FarTerrain.js';
import { SkyClouds } from './render/SkyClouds.js';
import { DayCycle, MORNING, daylightAt } from './render/DayCycle.js';
import { Sound, soundOf } from './audio/Sound.js';
import { loadControls, saveControls } from './config/controls.js';
import { LightManager } from './render/LightManager.js';
import { TemplateLibrary } from './prefabs/TemplateLibrary.js';
import { SymmetryTool } from './tools/SymmetryTool.js';
import { GamificationEngine } from './gamification/GamificationEngine.js';
import { SyncState } from './storage/WorldSync.js';
import { LocalWorlds } from './storage/LocalWorlds.js';
import { claimRegion, blocksIn, claimHint } from './tools/ClaimArea.js';

/**
 * The one world whose upload has not landed yet. Not a library — see keepSafe.
 */
const UNSENT_KEY = 'voxelgame:unsent';

const makeChunkGen = (o) => new ChunkGen(o);

/** Everything about a world that has to survive, as plain JSON. */
function serialiseWorldState({ world, mode, economy, duilt, territoryBounds }) {
  return { world: world.serialize({ keepBounds: territoryBounds }), mode, economy: economy?.toJSON?.() ?? {}, duilt: duilt ?? null };
}
import { loadSettings, saveSettings, QualityController, DISTANCES } from './render/graphics.js';
import { isTyping } from './ui/Panels.js';
import { panelForKey } from './config/panels.js';
import { STRUCTURES_BY_ID } from './config/structures.js';
import { DESIGN_FOR_STRUCTURE } from './config/starterDesigns.js';
import { exportWorldFile, exportVoxFile, parseWorldPayload, pickFile } from './storage/WorldExport.js';
import { UIManager } from './ui/UIManager.js';
import { EventBus } from './core/EventBus.js';
import { EconomyEngine } from './economy/EconomyEngine.js';
import { AIR, WATER, BLOCKS_BY_ID, materialOf, isFlowing, turns, turned, doorPart, doorBlock, mirrored, isChest, isLava, isLavaFlow, CHEST, CATAPULT, isCatapult, isFluid, isTrapdoor, swungTrapdoor, TRAPDOOR_OPEN } from './config/blocks.js';
import { LAVA_PER_SECOND, fallDamage } from './survival/Health.js';
import { TOOL_FOR, toolEffectiveness, itemName, ITEMS_BY_ID, isFood } from './config/items.js';
import { MOBS_BY_ID } from './config/mobs.js';
import { CROPS, cropOf, cropBlock } from './config/crops.js';
import { Mobs, rayBox } from './world/Mobs.js';
import { Projectiles, bestAim, predictArc, craterCells, MAX_RANGE } from './world/Projectiles.js';
import { ProjectileView } from './render/ProjectileView.js';
import { tameInto } from './duilt/Ranch.js';
import { Wanderers } from './world/Wanderers.js';
import { WaterFlow, LavaFlow } from './world/WaterFlow.js';
import { WANDERERS } from './config/wanderers.js';
import { MobView } from './render/MobView.js';

const REACH = 7;
/**
 * How far a tool can point, as opposed to how far you can reach.
 *
 * Far enough to stand back and see a whole house, which is the distance you
 * actually want to be at when deciding what its roof should look like.
 */
const TOOL_REACH = 28;
/**
 * How far the real blocks reach before the coarse distance takes over.
 *
 * This used to be the fog distance and the end of everything: past it there
 * was sky. Now it is only where one kind of ground hands over to the other,
 * so it can stay modest — meshing blocks is the expensive part and the
 * horizon no longer depends on it.
 */
const BLOCKS_TO = 210;
const BLOCKS_TO_COARSE = 160;
/**
 * Where the world finally fades into the sky.
 *
 * Far past the blocks, because the coarse terrain runs to 1400 and fog that
 * ended at 210 would have hidden all of it. The camera has to be told as
 * well — its far plane was clipping the distance clean off, which is why the
 * horizon looked like a torn edge with a pale ridge floating behind it.
 */
const HORIZON = 1500;
const HORIZON_COARSE = 950;
// Chunks are culled past the fog's far edge, never before it. Culling first is
// what makes chunks pop in and out as you walk; out here they are already the
// colour of the sky, so nothing can be seen appearing. The extra margin covers
// a chunk whose centre is beyond the line while its near corner is not.
const CULL_MARGIN = 24;
const IMMEDIATE_CHUNKS = 25;  // meshed before the first frame; the rest stream in
// How far a chunk's sealed-cave geometry is drawn (ChunkMesher.skyFill). No
// one on the surface can see it, and it was most of every chunk's triangles;
// this is enough to cover the biggest caverns once you're down in one.
const DEEP_RANGE = 80;
const EDIT_REBUILD_NOW = 4; // chunks an edit rebuilds on the spot; see remeshDirty
/**
 * How often a world writes itself down while you play.
 *
 * Five minutes rather than one. A save is no longer a megabyte of map — it is
 * the seed and the chunks you changed — but it is still a full serialise and a
 * write to the browser's storage, and doing it every minute for a world that
 * keeps its own history is twelve copies an hour of very nearly the same
 * thing. Leaving saves too, and so does putting the page away, so five minutes
 * is the most you can lose and only by a crash.
 */
const AUTOSAVE_INTERVAL_MS = 5 * 60_000;
// The corner instrument doesn't need to track every step — a couple of
// blocks of walking is never a new biome. Desktop only anyway (see
// Minimap.js's own note), so this is dead weight on a phone regardless.
const MINIMAP_INTERVAL_MS = 500;
// Holding down to keep breaking, and the same for placing. The first pause is
// longer than the rest so a normal click stays a single block — hold past it
// and it becomes a stream.
const HOLD_BREAK_DELAY_MS = 320;
const HOLD_BREAK_INTERVAL_MS = 170;
// Between blows on an animal. Held Break repeats faster than this for
// blocks; a swing at something alive shouldn't land six times a second.
const STRIKE_COOLDOWN_MS = 350;
// What a farm animal will follow you for. See Mobs.think.
const LURES = new Set(['vegetables', 'seeds', 'fruit', ...CROPS.flatMap((c) => [c.produce, `seeds_${c.kind}`])]);
const FARMLAND = 21;
/** How often planted crops are brought up to the stage their age says. */
const CROP_TICK_SECONDS = 2;
const TAME_EVERY_MS = 1000; // how often pens take in animals led into them
// A gate, shut and open: Place on one swings it to the other. See toggleGate.
const GATE_SHUT = 48, GATE_OPEN = 49;
// How often running water advances a block. See world/WaterFlow.js.
const WATER_STEP_SECONDS = 0.25;
// Lava is thicker: a block a second.
const LAVA_STEP_SECONDS = 1;
const GATE_SWING = { [GATE_SHUT]: GATE_OPEN, [GATE_OPEN]: GATE_SHUT };
/** A gate or either half of a door: something Place swings rather than builds on. */
const swings = (id) => !!GATE_SWING[id] || !!doorPart(id) || isTrapdoor(id);
/** What Place does to a door or gate — "Open" or "Close" — or null for anything else. */
export function swingLabel(id) {
  if (GATE_SWING[id]) return id === GATE_SHUT ? 'Open' : 'Close';
  if (isChest(id)) return 'Open';
  if (isCatapult(id)) return 'Man';
  if (isTrapdoor(id)) return id >= TRAPDOOR_OPEN ? 'Close' : 'Open';
  const door = doorPart(id);
  return door ? (door.open ? 'Close' : 'Open') : null;
}
// The catapult (Phase 6c) — see manCatapult.
const CATAPULT_RELOAD = 2;      // seconds between throws
const CATAPULT_REACH = 4;       // walk further than this from it and you let go
const CATAPULT_MIN_THROW = 6;   // it won't drop a stone closer than this
const CATAPULT_AMMO = ['stone', 'cobblestone'];
const STONE_HITS = 14;          // what a stone does to anyone it lands on
const HOLD_PLACE_DELAY_MS = 320;
const HOLD_PLACE_INTERVAL_MS = 170;

// The column claim tool — see beginClaimColumn. The height always grows up
// from the block you're pointing at, never down, so a claim never reaches
// into the ground you're standing on.
const CLAIM_COLUMN_MIN_HEIGHT = 1;
const CLAIM_COLUMN_MAX_HEIGHT = 24;
const CLAIM_COLUMN_DEFAULT_HEIGHT = 4;

// How long a block takes to actually come free — see breakDelayFor. Bare
// hands (or a tool with nothing to say about this material) sit at
// NORMAL_BREAK_MS; the one thing a mining tool changes is knocking a
// material it's suited to down near enough to instant, or a wrong one up to
// SLOW_BREAK_MS. Only applies in Duilt — Creative has no bag to fill and no
// reason to make you wait for anything.
const NORMAL_BREAK_MS = 260;
const SLOW_BREAK_MS = 900;

/**
 * Items that fully replace Break/Place while selected, rather than digging
 * or building — the bucket, and now food. The value is a method on Game.
 * Mining tools (axe, pickaxe, shovel) are not in here: they don't replace
 * breakBlock, they change how it behaves — see TOOL_EFFECTIVENESS.
 */
// Any food not listed eats on Break and throws on Place — see foodOverride.
const BREAK_OVERRIDE = { bucket: 'fillBucket', fruit: 'eatSelected', vegetables: 'eatSelected' };
const PLACE_OVERRIDE = { bucket_water: 'emptyBucket', fruit: 'throwSelected', vegetables: 'throwSelected', seeds: 'plantMixed' };
export const CREATIVE = 'creative';
export const DUILT = 'duilt';

export class Game {
  constructor(container) {
    this.container = container;
    this.bus = new EventBus();

    this.canvasRoot = document.createElement('div');
    this.canvasRoot.id = 'game-canvas-root';
    this.uiRoot = document.createElement('div');
    this.uiRoot.id = 'ui-root';
    container.appendChild(this.canvasRoot);
    container.appendChild(this.uiRoot);

    // Phones are fill-rate bound, and this scene is flat-shaded cubes: MSAA at
    // 2x device pixels costs roughly four times the fragments for edges you can
    // barely see at arm's length, and a halved frame rate is what "the controls
    // feel slow" actually is. Desktop keeps the nicer settings.
    const coarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.graphics = loadSettings();
    // Antialiasing on everywhere. A voxel world is nothing but hard edges, and
    // an unsmoothed edge crawls and sparkles as you walk past it — which reads
    // as the picture flickering, not as a missing feature. Phones used to get
    // this switched off and a half-resolution buffer on top, so they got the
    // worst of it; the quality controller below earns that back when a device
    // turns out to be too slow, instead of assuming every phone is.
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.graphics.antialias,
      powerPreference: 'high-performance',
    });
    this.coarse = coarse;
    this.quality = new QualityController({
      cap: Math.min(window.devicePixelRatio || 1, 2),
      onChange: (r) => { this.renderer.setPixelRatio(r); this.onResize(); },
    });
    if (this.graphics.resolution !== 'auto' || !this.graphics.smoothing) {
      this.quality.pin(this.graphics.resolution === 'auto' ? this.quality.resolution : this.graphics.resolution);
    }
    this.renderer.setPixelRatio(this.quality.resolution);
    this.canvasRoot.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // A softer, paler sky than the original saturated blue — the block
    // palette went pastel too (config/blocks.js), and a bright sky over
    // pale blocks would have fought them for whichever read as "the color".
    this.scene.background = new THREE.Color(0xadd7f5);
    const chosen = DISTANCES[this.graphics.distance];
    const blocksTo = chosen ? chosen.fogFar : (coarse ? BLOCKS_TO_COARSE : BLOCKS_TO);
    this.horizon = coarse ? HORIZON_COARSE : HORIZON;
    // Fog starts well out and finishes at the horizon, so the coarse ground is
    // hazed rather than hidden — it is what sells the distance as distance.
    this.scene.fog = new THREE.Fog(0xadd7f5, this.horizon * 0.35, this.horizon);
    this.renderDistance = blocksTo + CULL_MARGIN;

    // The near plane sets how much depth precision the whole scene gets, and
    // phones commonly hand out a 16-bit depth buffer. At 0.1 with a far plane
    // of 300 there was not enough precision left for distant surfaces to agree
    // on which is in front, so they traded places as the camera moved. Nothing
    // in a voxel world is ever closer than a fraction of a block, so 0.2 costs
    // nothing to look at and doubles the precision everywhere.
    // The player's own controls: keys, field of view, mouse speed, volume.
    this.controls = loadControls();
    this.camera = new THREE.PerspectiveCamera(this.controls.fov, 1, 0.2, this.horizon + 200);
    this.sound = new Sound({ volume: this.controls.volume });
    // Browsers only allow audio once you've clicked or pressed something.
    const unlock = () => this.sound.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff3d6, 0.85);
    sun.position.set(60, 90, 30);
    this.scene.add(sun);
    // Ground bounce-light lightened to match: 0x3a2f22 was dark enough that
    // every underside and shadowed face read muddy no matter how pale the
    // blocks above them were.
    const hemi = new THREE.HemisphereLight(0xadd7f5, 0x7f6445, 0.4);
    this.scene.add(hemi);

    this.mesher = new ChunkMesher(this.scene);
    this.farTerrain = new FarTerrain(this.scene);
    this.clouds = new SkyClouds(this.scene);
    // Those three lights, the sky and the clouds all follow the time of day.
    this.dayCycle = new DayCycle(this.scene, { ambient, sun, hemi, clouds: this.clouds });
    this.lights = new LightManager(this.scene);
    this.gamification = new GamificationEngine(this.bus);
    this.economy = new EconomyEngine(this.bus);
    // Duilt is the game. Creative is the sandbox this grew out of and is
    // still there on purpose, but arriving in it meant a
    // first-time player landed in a world with no bag, no land and no goals,
    // and the game itself was three taps deep behind a menu and a browser
    // confirm box. A save always sets its own mode, so this only decides where
    // someone with nothing saved begins.
    this.mode = DUILT;

    this.selectedBlockId = 1;
    // The hotbar slot for a held tool (the bucket, today) rather than a
    // placeable block — see UIManager.selectItem and fillBucket/emptyBucket.
    this.selectedItemId = null;
    this.pointerLocked = false;
    // Held-to-break: when it started and when it last fired. Driven from the
    // frame loop rather than a timer, so it stops on its own the moment the
    // game stops playing — a panel opening mid-swing does not leave a timer
    // chewing through your land behind it.
    this.breaking = false;
    this.breakHeldSince = 0;
    this.lastBreakAt = 0;
    // Which block is currently being dug and since when — see breakDelayFor.
    // Persists across separate taps on the same block, not just a hold, so
    // digging progress is the same whether you hold the button or tap it
    // repeatedly.
    this.digTarget = null;
    // Same idea, for Place — see setPlacing/tickPlacing.
    this.placing = false;
    this.placeHeldSince = 0;
    this.lastPlaceAt = 0;
    this.hoverHit = null;
    this.upHeld = false;
    this.downHeld = false;
    this.remeshQueue = new Set();
    this.selectionDirty = false; // set when blocks change, so the skin re-reads the world
    this.duilt = null;           // the Duilt rules, only in Duilt mode

    // 1.002 left the outline a thousandth of a block off the face it traces —
    // below what a depth buffer can tell apart, so the two fought and the
    // outline sparkled. A hundredth of a block is still visually flush.
    this.hoverBox = this.buildWireBox(0xffffff, 1.01);
    this.hoverBox.visible = false;
    this.scene.add(this.hoverBox);
    this.selection = new SelectionHighlight(this.scene);
    this.ghost = new BuildGhost(this.scene);
    this.settlerView = new SettlerView(this.scene);
    this.mobView = new MobView(this.scene);
    // Hermit, bandits, explorers, messengers — drawn like settlers.
    this.wanderView = new SettlerView(this.scene);
    this.projectileView = new ProjectileView(this.scene);
    this.moving = null;   // the building currently in the air
    this.editingStructure = null;   // the building currently unlocked for changes — see startEditing

    this.boot();
    window.addEventListener('resize', () => this.onResize());
    // A phone browser sliding its toolbars in and out resizes the page without
    // always firing `resize`. visualViewport is the event that does fire, and
    // missing it leaves the renderer sized to a viewport that no longer exists.
    for (const event of ['resize', 'scroll']) {
      window.visualViewport?.addEventListener(event, () => this.onResize());
    }
    // Safari settles its bars a moment after an orientation change or a tap on
    // the page, and the size it reports during the transition is not the one it
    // ends up at.
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 250));
    document.addEventListener('fullscreenchange', () => {
      this.onResize();
      this.ui.setFullscreenIndicator(!!document.fullscreenElement);
    });
    this.onResize();
  }

  buildWireBox(color, pad) {
    const geo = new THREE.BoxGeometry(pad, pad, pad);
    const edges = new THREE.EdgesGeometry(geo);
    return new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color }));
  }

  boot() {
    // A world is built either way so there is something behind the worlds
    // screen rather than a blank canvas, and so "Continue" has something to
    // continue. Which one is decided by the screen, not here.
    // Something behind the worlds screen rather than a blank canvas. It is
    // scenery, not a save: a world only becomes real once it is on the account.
    this.newWorld({ silent: true, scenery: true });

    this.symmetryTool = new SymmetryTool(this.world);
    // A stable id per world, so incremental sync can tell "the world I already
    // uploaded, edited" from "a different world with the same name".
    this.worldId = this.worldId || newWorldId();
    this.worldName = this.worldName || 'My world';
    this.cloudAuth = new CloudAuth(this.bus);
    this.cloud = isCloudConfigured() ? new CloudWorlds({ auth: this.cloudAuth, bus: this.bus }) : null;
    // The other half: a world signed out, or a build with no cloud
    // configured at all, lives here instead — see LocalWorlds' own note on
    // why that never re-creates the reconciliation problem the cloud-only
    // design was built to avoid. Always constructed, cloud or not: it costs
    // nothing until something is actually saved to it.
    this.local = new LocalWorlds();
    // What this device and the server last agreed about each world. It is what
    // stops a desktop that has been offline from flattening what you built on
    // your phone — see storage/WorldSync.js.
    this.syncState = new SyncState();
    // And find out whether we are signed in, now, rather than the first time
    // somebody opens the menu — see resumeSession.
    this.resumeSession();
    this.templates = new TemplateLibrary(this.bus);
    this.pendingTemplate = null; // the template queued for stamping
    this.templateRotation = 0;
    this.pendingRoof = null;     // the roof shape queued, if any
    this.pendingClear = null;    // the clear shape queued, if any
    this.pendingClaimColumn = null; // { height } — see beginClaimColumn
    this.roofTurn = 0;
    this.roofKey = null;         // what the preview was last built for
    this.lastRoof = null;        // the roof this tool put up, while it is untouched
    this.roofGhost = new BuildGhost(this.scene);
    // What the crosshair is on, worked out once a frame and shared by every
    // tool that needs to know which build you mean.
    this.pick = null;
    this.pickKey = null;

    this.ui = new UIManager(this.uiRoot, {
      bus: this.bus,
      game: this,
      callbacks: this.buildCallbacks(),
    });
    this.ui.applyTouchLayout(this.controls);
    this.ui.refreshForMode();

    // The land grows when an age is finished, and the wall has to grow with it.
    this.bus.on('territory:expanded', () => this.applyTerritoryBounds());
    this.bus.on('health:died', ({ cause }) => this.die(cause));

    this.wireInput();
    this.wireSaveOnLeave();
    this.lastAutosave = performance.now();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  /**
   * Saves the moment the page is put away, not only every minute.
   *
   * A phone suspends the animation loop as soon as you switch apps, so the
   * interval autosave simply stops running, and iOS is free to discard the tab
   * from there. Anything since the last tick was lost — up to a whole session,
   * because a brand new world had never reached its first autosave.
   *
   * `visibilitychange` is the event that actually fires on mobile;
   * `pagehide` catches the desktop close. Both are cheap and idempotent.
   */
  wireSaveOnLeave() {
    const save = () => this.saveNow();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') save();
    });
    window.addEventListener('pagehide', save);
  }

  /**
   * Throws away the world you were last in.
   *
   * The catch is that the world is still loaded in memory, and the autosave
   * fires on the way out of the page whatever the game is doing — so deleting
   * it and then closing the tab would have written the whole thing straight
   * back. The flag is what stops that: nothing autosaves again until a world
   * is deliberately made or opened.
   */
  discardCurrentWorld() {
    this.discarded = true;
    this.dropSafeCopy();
    // If it was synced, take it off the server too — a world you deleted
    // coming back on your next device is worse than not syncing at all.
    // Best effort: signed out or offline, the local delete still stands.
    if (this.worldId) this.cloud?.delete(this.worldId).catch(() => {});
    return true;
  }

  /**
   * Puts the world down and goes back to the worlds list.
   *
   * Saving is a choice because it has to be. An afternoon that went wrong —
   * a hill levelled that should not have been, a house pulled down — was
   * previously written over the only copy the moment you walked away. Leaving
   * without saving is the undo for a whole session.
   *
   * Not saving means not saving: the autosave that fires when the page is put
   * away is held off too, or closing the tab afterwards would quietly write
   * the very state you just refused.
   */
  leaveWorld(save = true) {
    if (save) this.saveNow();
    else this.discarded = true;
    return save;
  }

  /**
   * Goes back to an earlier version of this world.
   *
   * The history is a handful of snapshots taken as you played. Restoring one
   * is an ordinary load, so everything downstream — the border, the bag, the
   * settlers — comes back exactly as a load would bring it.
   */
  /**
   * Writes this world down — to the account if it lives there, or to this
   * browser if it doesn't.
   *
   * `worldIsLocal` is decided once, at creation or on the way in (see
   * newWorld/openWorld), never guessed from whether you happen to be signed
   * in right now: a local world stays local even if you sign in mid-session,
   * because a save flipping where a world lives out from under itself is
   * exactly the "which copy is real" question local and cloud were kept
   * apart to avoid — see LocalWorlds' own note.
   *
   * A local save is synchronous, so it returns whether it actually happened.
   * A cloud save is queued instead, because a save must never be something
   * the player waits for mid-build.
   */
  saveNow() {
    if (this.discarded || !this.worldId) return false;
    if (this.worldIsLocal) return this.saveLocally();
    if (!this.cloud?.signedIn) return false;
    this.pendingSave = true;
    this.keepSafe();
    this.flush().catch(() => { /* reported by flush; retried by the next save */ });
    return true;
  }

  /** The local half of saveNow — see its own note on why the two never mix. */
  saveLocally() {
    try {
      const result = this.local.save(this.worldId, {
        world: this.world,
        name: this.worldName,
        mode: this.mode,
        player: this.player,
        duilt: this.duilt ? this.duilt.toJSON() : null,
        economy: this.economy,
        territoryBounds: this.duilt ? this.duilt.territory.bounds() : null,
      });
      this.local.saveProgression(this.gamification.toJSON());
      this.saveError = null;
      this.ui?.home?.forgetWorlds?.();
      return !!result;
    } catch (err) {
      this.saveError = err?.message ?? 'Could not save in this browser.';
      this.bus.emit('toast', { kind: 'xp', title: 'Not saved', body: this.saveError });
      return false;
    }
  }

  /**
   * Sends whatever is outstanding, and can be waited on.
   *
   * One at a time: two uploads of the same world racing each other is how a
   * revision counter stops meaning anything. A second save while one is in
   * flight simply leaves the flag up, and the next pass takes the newer state.
   */
  async flush() {
    if (!this.pendingSave || this.discarded || !this.cloud?.signedIn) return false;
    if (this.saving) return this.saving;

    this.saving = (async () => {
      try {
        const list = await this.cloudList({ maxAgeMs: 0 });
        const mine = list.find((w) => w.id === this.worldId) ?? null;
        const agreed = this.syncState.agreedFor(this.worldId);
        // Somebody else saved this world since we opened it. Refusing would
        // strand the afternoon in hand, so it goes up — but it is said out
        // loud, because quietly writing over another device is the one thing
        // this must never do without telling you.
        if (mine && agreed && mine.revision > agreed.revision) {
          this.bus.emit('toast', {
            kind: 'xp',
            title: 'This world was open somewhere else',
            body: 'Your changes are the ones kept. Close it on the other device.',
          });
        }
        await this.saveToCloud(this.worldName, { quiet: true, revision: (mine?.revision ?? 0) + 1 });
        this.pendingSave = false;
        this.saveError = null;
        this.dropSafeCopy();
        this.ui?.home?.forgetWorlds?.();
        return true;
      } catch (err) {
        // Left pending on purpose: the next save tries again, and the copy put
        // aside by keepSafe outlives a closed tab.
        this.saveError = err?.message ?? 'The account did not answer.';
        // Best effort, and never awaited: a broken save_failures write must
        // never be the reason a retry gets delayed.
        this.cloud?.reportFailure(this.worldId, err).catch(() => {});
        this.bus.emit('toast', {
          kind: 'xp',
          title: 'Not saved to your account yet',
          body: `${this.saveError} Still trying — keep the tab open.`,
        });
        return false;
      } finally {
        this.saving = null;
      }
    })();
    return this.saving;
  }

  /**
   * One copy of the world that has not reached the account yet.
   *
   * Not a library and not something you can open: it is a single slot holding
   * the world whose upload is outstanding, and it is thrown away the moment
   * that upload lands. Cloud-only is the right shape, but losing an afternoon
   * to a dropped connection is not a design decision anybody made on purpose,
   * and this is the difference between "not saved yet" and "gone".
   */
  keepSafe() {
    try {
      localStorage.setItem(UNSENT_KEY, JSON.stringify({
        worldId: this.worldId,
        name: this.worldName,
        at: Date.now(),
        state: serialiseWorldState(this.saveState()),
      }));
    } catch { /* out of room; the upload is still the real save */ }
  }

  dropSafeCopy() {
    try { localStorage.removeItem(UNSENT_KEY); } catch { /* private window */ }
  }

  /** Anything that never made it up last time goes up now. */
  async sendUnsent() {
    if (!this.cloud?.signedIn) return false;
    let held = null;
    try { held = JSON.parse(localStorage.getItem(UNSENT_KEY) || 'null'); } catch { held = null; }
    if (!held?.worldId || !held.state) return false;
    try {
      const world = World.deserialize(held.state.world, { makeGen: makeChunkGen });
      const list = await this.cloudList({ maxAgeMs: 0 });
      const mine = list.find((w) => w.id === held.worldId) ?? null;
      const res = await this.cloud.save(held.worldId, {
        world,
        name: held.name,
        mode: held.state.mode,
        player: null,
        gamification: null,
        economy: { toJSON: () => held.state.economy ?? {} },
        duilt: held.state.duilt,
        revision: (mine?.revision ?? 0) + 1,
      });
      this.syncState.agree(held.worldId, res.revision);
      this.dropSafeCopy();
      this.forgetCloudList();
      this.bus.emit('toast', {
        kind: 'challenge',
        title: 'Saved to your account',
        body: `"${held.name}" made it up after all`,
      });
      return true;
    } catch {
      return false;   // still no; it keeps until there is a connection
    }
  }

  /**
   * Opens a world, from wherever it actually lives.
   *
   * A local id and a cloud id are drawn from the same generator with no way
   * to tell them apart by looking, so this asks the local library first —
   * synchronous and free — before ever reaching for the network. Signed in
   * or not doesn't decide it; where the world itself was saved does, which
   * is what lets a local world stay open-able after you sign in mid-session.
   */
  async openWorld(id) {
    if (!id) return false;
    // What you were in goes up (or gets written down) before you leave it,
    // or opening a second world throws away the first one's afternoon.
    if (this.worldIsLocal) this.saveLocally(); else await this.flush();

    if (this.local.has(id)) {
      try {
        this.restoreFromLocal(id);
        return true;
      } catch (err) {
        this.ui.toast({ kind: 'xp', title: 'Could not open that world', body: err.message });
        return false;
      }
    }
    if (!this.cloud?.signedIn) return false;
    try {
      await this.restoreFromCloud(id);
      return true;
    } catch (err) {
      this.ui.toast({ kind: 'xp', title: 'Could not open that world', body: err.message });
      return false;
    }
  }

  /**
   * Picks up the signed-in session at startup.
   *
   * It used to happen the first time somebody opened the in-game menu, and
   * nowhere else — so on the worlds screen, whose whole job is listing your
   * worlds, the game did not yet know it was signed in. Now that a world only
   * exists on an account, this is also what decides whether there is anything
   * to show at all.
   *
   * Never throws: being offline at startup is not an error, and the screen has
   * to be drawn either way.
   */
  resumeSession() {
    if (!this.cloud) return;
    this.cloudAuth.restore()
      .then((user) => {
        this.ui?.refreshCloudPanel?.();
        this.ui?.home?.render?.();
        if (!user) return;
        this.forgetCloudList();
        this.ui?.home?.forgetWorlds?.();
        this.ui?.home?.refreshCloudWorlds?.({ force: true });
        // Anything a dropped connection stranded last time goes up now.
        this.sendUnsent();
      })
      .catch(() => { this.ui?.home?.render?.(); });
  }

  /**
   * What the account is holding, from a moment ago if we asked a moment ago.
   *
   * The worlds screen asks on the way in, and then opening a world asks again
   * one tap later. Without this that is two round trips, and the second one is
   * in front of the player while they wait to start playing.
   */
  async cloudList({ maxAgeMs = 15_000 } = {}) {
    if (!this.cloud?.signedIn) return [];
    const now = Date.now();
    if (this.cloudListCache && now - this.cloudListCache.at < maxAgeMs) return this.cloudListCache.rows;
    const rows = await this.cloud.list();
    this.cloudListCache = { at: now, rows };
    return rows;
  }

  /** Anything that changes what is up there makes the cached answer a lie. */
  forgetCloudList() {
    this.cloudListCache = null;
  }

  /**
   * Every world the worlds screen has to offer — this browser's own library
   * plus whatever the account holds, if there is one to ask. Two disjoint
   * lists shown as one rather than merged into one: nothing here is ever
   * the same world twice (see LocalWorlds' own note), so there is nothing
   * to reconcile, only sort together by how recently each was touched.
   *
   * A cloud failure must never take the local list down with it — reading
   * this browser's own storage cannot fail the way a network call can, and
   * "your account is unreachable" should never also mean "and now you can't
   * even see the world sitting right here." So a cloud error still throws,
   * for the account-specific messaging HomeScreen shows, but carries the
   * local rows along on it rather than losing them.
   */
  async listAllWorlds() {
    const local = this.local.list();
    if (!this.cloud?.signedIn) return local;
    try {
      const cloud = await this.cloudList();
      return [...local, ...cloud].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    } catch (err) {
      err.partial = local;
      throw err;
    }
  }

  buildCallbacks() {
    return {
      onRequestStart: () => {
        // Pointer lock first: both requests must stay inside the same user
        // gesture, and awaiting the fullscreen transition would spend it.
        if (document.body.classList.contains('touch')) this.ui.hideBlocker();
        else this.requestPointerLock();
        this.enterFullscreen();
      },
      onToggleFullscreen: () => this.toggleFullscreen(),
      onSelectSlot: (id) => { this.selectedBlockId = id; this.selectedItemId = null; },
      onSelectItem: (id) => { this.selectedItemId = id; },
      // Opening a world by its id. There is no "open by name" any more,
      // because there is no second copy of anything to tell apart by name.
      onOpenWorld: (id) => this.openWorld(id),
      onDeleteWorld: (id) => {
        if (id === this.worldId) this.discarded = true;
        this.syncState.forget(id);
        if (this.local.has(id)) {
          this.local.delete(id);
          this.ui.home?.forgetWorlds?.();
          return true;
        }
        this.cloud?.delete(id)
          .then(() => { this.forgetCloudList(); this.ui.home?.forgetWorlds?.(); })
          .catch((err) => this.ui.toast({ kind: 'xp', title: 'Could not delete that world', body: err.message }));
        return true;
      },
      onLeaveWorld: (save) => this.leaveWorld(save),
      onExportWorld: (name) => {
        const payload = exportWorldFile({ ...this.saveState(), templates: this.templates.list(), name: name || 'My world' });
        this.ui.toast({ kind: 'challenge', title: 'World exported', body: `${payload.templates.length} designs included` });
      },
      onExportVox: (name) => {
        const bytes = exportVoxFile(this.world, name || 'My world');
        this.ui.toast({ kind: 'challenge', title: 'Exported .vox', body: `${(bytes / 1024).toFixed(0)} KB \u00b7 opens in MagicaVoxel and Blender` });
      },
      onImportWorld: async () => {
        const file = await pickFile('.json,application/json');
        if (!file) return;
        try {
          const data = parseWorldPayload(file.text);
          // An imported file is a new world, not a second copy of wherever it
          // came from: it gets a fresh id and follows the same rule any new
          // world does for where it lives — see newWorld's own note.
          this.worldIsLocal = !this.cloud?.signedIn;
          this.loadFromData({ ...data, worldId: newWorldId() });
          this.saveNow();
          for (const t of data.templates) {
            if (!this.templates.get(t.id)) this.templates.templates.push(t);
          }
          if (data.templates.length) this.templates.persist();
          this.ui.closePanel('panel-menu');
          this.ui.toast({ kind: 'challenge', title: `Imported "${data.name || 'world'}"`, body: `${data.templates.length} designs came with it` });
        } catch (err) {
          this.ui.toast({ kind: 'xp', title: 'Could not import', body: err.message });
        }
      },
      onNewWorld: (mode, name) => { this.newWorld({ mode, name }); this.ui.closePanel('panel-menu'); },
      onRenameWorld: (name) => { this.worldName = name; this.saveNow(); },
      lastSavedAt: () => this.syncState.agreedFor(this.worldId)?.at ?? 0,
      onResume: () => {
        this.ui.closePanel('panel-menu');
        if (document.body.classList.contains('touch')) this.ui.hideBlocker();
        else this.requestPointerLock();
      },
      onOpenMenu: () => { this.ui.refreshCloudPanel(); this.ui.openPanel('panel-menu'); document.exitPointerLock?.(); },
      onToggleFly: () => { this.player.toggleFly(); this.ui.setFlyIndicator(this.player.flying); return this.player.flying; },
      onSaveTemplate: (name) => this.saveTemplate(name),
      onPickTemplate: (id) => {
        this.clearPending({ quiet: true });
        this.pendingTemplate = this.templates.get(id);
        this.templateRotation = 0;
        if (this.pendingTemplate) {
          this.ui.toast({ kind: 'challenge', title: `Ready: ${this.pendingTemplate.name}`, body: 'Aim and place it' });
        }
        return !!this.pendingTemplate;
      },
      onPickRoof: (id) => {
        this.clearPending({ quiet: true });
        this.pendingRoof = ROOFS_BY_ID.get(id) ?? null;
        this.roofTurn = 0;
        if (this.pendingRoof) {
          this.ui.toast({
            kind: 'challenge',
            title: `Ready: ${this.pendingRoof.name} roof`,
            body: this.pendingRoof.turns > 1
              ? 'Point at the house · R turns it'
              : 'Point at the house',
          });
        }
        return !!this.pendingRoof;
      },
      onCancelTool: () => this.clearPending(),
      onRotateRoof: () => this.turnRoof(),
      onPlaceRoof: () => this.stampRoof(),
      onPickClear: (id) => {
        this.clearPending({ quiet: true });
        this.pendingClear = CLEARS_BY_ID.get(id) ?? null;
        if (this.pendingClear) {
          this.ui.toast({
            kind: 'challenge',
            title: `Ready: ${this.pendingClear.name}`,
            body: this.pendingClear.kind === 'build'
              ? 'Point at what you want gone'
              : 'Point at the middle of what you want gone',
          });
        }
        return !!this.pendingClear;
      },
      onDeleteTemplate: (id) => this.templates.delete(id),
      onRotateTemplate: () => { this.templateRotation = (this.templateRotation + 1) % 4; return this.templateRotation; },
      onPlaceTemplate: () => this.stampTemplate(),
      getTemplates: () => this.templates.list(),
      /** Which building tools you actually have — see UIManager.refreshTools. */
      heldTools: () => {
        if (!this.duilt) return null;
        const held = new Set();
        for (const [grants, item] of TOOL_FOR) {
          if (this.duilt.inventory.countOf(item) > 0) held.add(grants);
        }
        return held;
      },
      onCycleSymmetry: () => this.symmetryTool.cycle(),
      onMove: (x, z) => {
        this.player.externalMove.x = x;
        this.player.externalMove.z = z;
      },
      onLookStick: (x, y) => { this.player.lookInput.x = x; this.player.lookInput.y = y; },
      onJumpOrFlyUp: (held) => {
        if (this.player.flying) { this.upHeld = held; this.recomputeVertical(); }
        else if (held) this.player.requestJump();
      },
      onFlyDown: (held) => {
        this.downHeld = held;
        this.recomputeVertical();
      },
      // Touch goes through the same two verbs as mouse buttons, so a queued
      // tool behaves identically on a phone.
      isCloudConfigured: () => !!this.cloud,
      getCloudUser: () => this.cloudAuth.summary(),
      onCloudRestoreSession: () => this.cloudAuth.restore(),
      onCloudSignIn: async (email, password) => {
        await this.cloudAuth.signIn(email, password);
        await this.sendUnsent();
        const moved = await this.migrateLocalWorlds();
        this.forgetCloudList();
        this.ui.home?.forgetWorlds?.();
        this.ui.home?.render();
        this.ui.toast({
          kind: 'challenge', title: 'Signed in',
          body: moved ? 'Your worlds are here' : 'Welcome back',
        });
      },
      onCloudSignUp: async (email, password) => {
        await this.cloudAuth.signUp(email, password);
        const moved = await this.migrateLocalWorlds();
        this.forgetCloudList();
        this.ui.home?.forgetWorlds?.();
        this.ui.home?.render();
        this.ui.toast({
          kind: 'challenge',
          title: 'Account created',
          body: moved
            ? `Every world you build is kept on it${moved > 1 ? ` — including the ${moved} you already had` : ' — including the one you already had'}`
            : 'Every world you build is kept on it',
        });
      },
      onCloudSignOut: async () => {
        await this.cloudAuth.signOut();
        this.ui.toast({ kind: 'xp', title: 'Signed out', body: 'Anything saved here stays right where it is' });
      },
      getCloudWorlds: () => this.listAllWorlds(),
      // The worlds screen needs it to say which copy is which; it is the same
      // record the sync decision runs on.
      agreedFor: (id) => this.syncState.agreedFor(id),
      onCloudRestore: (id) => this.restoreFromCloud(id),
      onCloudDelete: async (id) => {
        await this.cloud.delete(id);
        this.ui.toast({ kind: 'xp', title: 'Deleted from the cloud', body: 'Your local copy is still here' });
      },

      onBreakTap: () => this.primaryAction(),
      onBreakHold: (held) => this.setBreaking(held),
      onPlaceTap: () => this.secondaryAction(),
      onPlaceHold: (held) => this.setPlacing(held),

      // ---- duilt ----
      // Both modes run on DuiltGame now — Creative is that same engine with
      // sandbox: true (see DuiltGame's own note) — so isDuilt means "has the
      // building/bag UI under it" and is true for both. isSandbox is the
      // narrower question, for the handful of things that only make sense
      // with real scarcity behind them (the workbench, skill levels).
      isDuilt: () => !!this.duilt,
      isSandbox: () => !!this.duilt?.sandbox,
      getModeLabel: () => this.mode === DUILT ? 'Duilt' : 'Creative',
      onOpenBag: () => this.ui.toggleBag(),
      onOpenClaim: () => this.openClaim(),
      onFinishEditing: () => this.finishEditing(),
      onStampStarter: (id) => this.stampStarter(id),
      onOpenBuildings: () => this.ui.openPanel('panel-buildings'),
      onOpenBench: () => this.ui.openPanel('panel-bench'),
    };
  }

  /**
   * When this world was last *played*, as opposed to last written down.
   *
   * These are not the same thing and treating them as one is what made a world
   * show a different afternoon on two devices. Leaving a world writes it, so a
   * device that only opened it and closed it again looked exactly like a device
   * that had built something — and from then on every difference with the
   * account read as "we both played", which is a conflict, which is deliberately
   * never resolved automatically. So the stale copy stayed stale forever.
   *
   * Only a block changing counts. A world producing wood while you stand in it
   * is not you playing it.
   */
  saveState() {
    return {
      editedAt: this.editedAt ?? 0,
      world: this.world,
      player: this.player,
      gamification: this.gamification,
      economy: this.economy,
      mode: this.mode,
      worldId: this.worldId,
      worldName: this.worldName,
      duilt: this.duilt ? this.duilt.toJSON() : null,
      // Claimed land is saved in full, not just the chunks you've actually
      // dug into — see World.serialize's keepBounds. this.duilt.toJSON()
      // above is already plain data by the time serialiseWorldState runs,
      // so the live bounds have to ride along separately.
      territoryBounds: this.duilt ? this.duilt.territory.bounds() : null,
    };
  }

  /**
   * Fences the player into the land they have claimed.
   *
   * Only real Duilt has a border; a sandbox world gets the whole map, so the
   * bounds are cleared rather than left over from a previous world. Territory
   * itself already answers every border *question* (contains, containsRegion)
   * with "yes, everywhere" for a sandbox — this is only what physically stops
   * the player walking somewhere, which is a separate thing Territory has no
   * say over.
   */
  applyTerritoryBounds() {
    if (!this.player) return;
    this.player.setBounds(this.duilt && !this.duilt.sandbox ? this.duilt.territory.bounds() : null);
  }

  /** Duilt owns scene objects (the border), so swapping worlds must clean up. */
  disposeDuilt() {
    if (!this.duilt) return;
    this.duilt.territory.dispose();
    this.duilt = null;
  }

  newWorld({ silent, mode = this.mode, name, scenery = false } = {}) {
    this.mode = mode;
    // Scenery is the world drawn behind the worlds screen so the canvas is not
    // blank. It is nobody's world and it is never saved; anything else you make
    // un-discards, which is to say saving is on again.
    this.discarded = !!scenery;
    this.worldId = newWorldId();
    // Signed in means the account; anyone else means this browser — see
    // HomeScreen's whereToLive, which already tells the player this before
    // they press Create. Decided once, here, not re-asked on every save.
    this.worldIsLocal = !this.cloud?.signedIn;
    // A brand new world has never been anywhere, so it counts as played: it
    // has to go up the first time, and nothing has agreed anything about it.
    this.editedAt = Date.now();
    this.worldName = name || (mode === DUILT ? 'My settlement' : 'Creative world');

    this.disposeDuilt();
    // No size: the land is made as you walk into it. Creative used to get a
    // separate, smaller generator — a flat 64x64 patch with none of Duilt's
    // biomes, rivers, mountains or ocean — for no reason tied to what
    // Creative actually is; it has no territory to fence in, so there was
    // nothing stopping it from being just as endless. Both modes start in
    // exactly the same generated world now; only what you're allowed to do
    // in it differs.
    const built = generateEndlessWorld({ height: WORLD_HEIGHT });
    this.world = built.world;
    let spawn = built.origin.spawn;
    if (this.player) this.player.dispose();
    this.player = new PlayerController(this.world, this.camera, spawn ?? this.findSafeSpawn());
    this.player.binds = { ...this.controls.keys };
    // Face the way the spawn picked: the open direction. Arriving on a good
    // open spot while looking at the one wall behind you is the same bad first
    // impression as arriving inside the hill.
    if (spawn?.yaw != null) this.player.yaw = spawn.yaw;
    if (spawn?.pitch != null) this.player.pitch = spawn.pitch;
    // Creative runs the same DuiltGame Duilt does now — reported directly:
    // "the same as Duilt without achievements progression," a free-build
    // sandbox that still lets you put up a house and have settlers move in
    // rather than a second, thinner copy of the bag/building/settler systems.
    // `sandbox: true` is what turns Duilt's rules into that — see DuiltGame's
    // own note on exactly what it switches off.
    const sandbox = mode !== DUILT;
    this.duilt = new DuiltGame({ world: this.world, scene: this.scene, bus: this.bus, sandbox });
    if (sandbox) this.duilt.grantCreativeKit();
    else this.duilt.grantStartingKit();
    // Every new world starts in the morning.
    if (this.dayCycle) this.dayCycle.time = MORNING;
    // After the rules exist, not before: this reads the border off `duilt`,
    // and called a line earlier it only ever saw the world that came before.
    this.applyTerritoryBounds();
    this.gamification = new GamificationEngine(this.bus);
    this.gamification.setDuilt(this.duilt);
    this.economy = new EconomyEngine(this.bus);
    if (this.symmetryTool) this.symmetryTool = new SymmetryTool(this.world);
    this.rebuildAllChunks();
    this.bus.emit('economy:change', {});
    if (!silent) {
      this.ui.refreshForMode();
      // Write it out now: a brand new world is 60 seconds from its first
      // interval autosave, and a phone that gets put away in that window used
      // to lose the whole thing.
      this.saveNow();
      this.ui.toast({
        kind: 'xp',
        title: mode === DUILT ? 'Welcome to Duilt' : 'New world generated',
        body: mode === DUILT
          ? 'You have 32 blocks of land, an axe and a bucket. Build a forest, a farm and a house.'
          : 'Have fun building!',
      });
    }
  }

  /**
   * Spawns on block centres, not block corners: a corner position straddles four
   * columns, so a neighbouring hill traps the player's hitbox on arrival.
   */
  findSafeSpawn() {
    const world = this.world;
    const cx = Math.floor(world.sizeX / 2), cz = Math.floor(world.sizeZ / 2);
    for (let radius = 0; radius < 16; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = cx + dx, z = cz + dz;
          if (x < 1 || z < 1 || x >= world.sizeX - 1 || z >= world.sizeZ - 1) continue;
          for (let y = world.surfaceHeight(x, z); y < world.height - 3; y++) {
            if (world.isCollidable(x, y - 1, z) && !world.isCollidable(x, y, z) && !world.isCollidable(x, y + 1, z)) {
              return { x: x + 0.5, y, z: z + 0.5 };
            }
          }
        }
      }
    }
    return { x: cx + 0.5, y: world.height - 4, z: cz + 0.5 };
  }

  loadFromData(data, { silent } = {}) {
    this.world = data.world;
    // Carried with the world, not reset to now: whether it has been played
    // since the account last saw it is a fact about the world.
    this.editedAt = data.editedAt ?? 0;
    this.disposeDuilt();
    // Deliberately opening a world un-discards: saving is on again.
    this.discarded = false;
    // A save from before worlds had ids still loads; it just gets a fresh one.
    this.worldId = data.worldId || newWorldId();
    this.worldName = data.worldName || data.name || this.worldName || 'My world';
    // Anything unrecognised falls back to Creative, which is the mode that
    // needs nothing alongside it — including worlds saved in Campaign, which
    // no longer exists. Their blocks are all still there; they simply cost
    // nothing now. Listing the modes explicitly matters: while this read
    // `=== CAMPAIGN ? CAMPAIGN : CREATIVE`, every saved Duilt world came back
    // as a sandbox and its bag, land, buildings and skills went with it.
    this.mode = data.mode === DUILT ? DUILT : CREATIVE;
    if (this.player) this.player.dispose();
    this.player = new PlayerController(this.world, this.camera, data.player);
    this.player.binds = { ...this.controls.keys };
    this.player.yaw = data.player.yaw || 0;
    this.player.pitch = data.player.pitch || 0;
    if (!this.gamification) this.gamification = new GamificationEngine(this.bus);
    this.gamification.loadJSON(data.gamification);
    this.economy = new EconomyEngine(this.bus);
    this.economy.loadJSON(data.economy);
    if (this.symmetryTool) this.symmetryTool = new SymmetryTool(this.world);
    // Both modes carry a DuiltGame now — see newWorld's own note. A save
    // from before that change never wrote one out for a Creative world, so
    // there's nothing to load back in; it gets a fresh creative kit instead,
    // same as a brand new sandbox world would.
    const sandbox = this.mode !== DUILT;
    this.duilt = new DuiltGame({ world: this.world, scene: this.scene, bus: this.bus, sandbox });
    if (data.duilt) {
      const earned = this.duilt.loadJSON(data.duilt);
      if (earned && Object.keys(earned).length && this.ui) {
        const parts = Object.entries(earned).map(([id, n]) => `${n} ${id}`);
        setTimeout(() => this.ui.toast({
          kind: 'challenge', title: 'Your buildings kept working', body: parts.join(', '),
        }), 600);
      }
    }
    if (sandbox) this.duilt.grantCreativeKit();
    // The world's clock picks up where it was left.
    if (this.dayCycle) this.dayCycle.time = this.duilt.dayTime ?? MORNING;
    this.gamification.setDuilt(this.duilt);
    this.applyTerritoryBounds();
    this.rebuildAllChunks();
    if (this.ui) {
      this.ui.updateXp();
      this.ui.refreshForMode();
      if (!silent) this.ui.toast({ kind: 'xp', title: 'World loaded', body: this.worldName });
    }
  }

  /**
   * Meshes what the player can see right away and queues the rest. Meshing a
   * large world in one go is close to a second of frozen tab; this way the
   * nearby world is solid immediately and the horizon fills in over a few frames.
   */
  rebuildAllChunks() {
    this.mesher.clearAll();
    this.remeshQueue.clear();
    // An endless world has only the settlement in it until something asks for
    // more, so the first thing to do is ask for everything within sight.
    if (this.world.endless && this.player) {
      this.world.ensureAround(this.player.position.x, this.player.position.z, this.renderDistance);
      this.streamedAt = null;
    }

    const px = this.player ? this.player.position.x / CHUNK_SIZE : this.world.centreX / CHUNK_SIZE;
    const pz = this.player ? this.player.position.z / CHUNK_SIZE : this.world.centreZ / CHUNK_SIZE;
    const chunks = [...this.world.allChunks()].sort((a, b) =>
      distSq(a, px, pz) - distSq(b, px, pz));

    for (let i = 0; i < chunks.length; i++) {
      if (i < IMMEDIATE_CHUNKS) this.mesher.rebuild(this.world, chunks[i]);
      else this.remeshQueue.add(chunks[i]);
    }
  }

  /**
   * Hides chunk meshes past the render distance. Frustum culling alone still
   * pays per-object overhead for every chunk behind you in a large world.
   */
  /**
   * Hides chunks that are past the fog, measured to the nearest corner.
   *
   * Measuring to the centre hid a whole chunk while a third of it was still
   * this side of the line, and the line itself used to sit inside the fog — so
   * columns of world blinked out in front of you as you walked. Now the test is
   * against the corner closest to the player and the line sits beyond the point
   * where everything is already sky-coloured.
   */
  updateChunkVisibility() {
    const px = this.player.position.x, pz = this.player.position.z;
    const maxSq = this.renderDistance * this.renderDistance;
    const deepSq = Math.min(DEEP_RANGE * DEEP_RANGE, maxSq);
    const drawn = new Set();
    for (const mesh of this.mesher.activeMeshes) {
      const chunk = mesh.userData.chunk;
      if (!chunk) continue;
      const minX = chunk.cx * CHUNK_SIZE, minZ = chunk.cz * CHUNK_SIZE;
      const dx = Math.max(minX - px, 0, px - (minX + CHUNK_SIZE));
      const dz = Math.max(minZ - pz, 0, pz - (minZ + CHUNK_SIZE));
      mesh.visible = dx * dx + dz * dz <= (mesh.userData.deep ? deepSq : maxSq);
      if (mesh.visible && !mesh.userData.deep) drawn.add(chunkId(chunk.cx, chunk.cz));
    }
    // Wherever a real chunk is drawn, the far terrain isn't — see FarTerrain.
    if (this.farTerrain) {
      const size = Math.ceil((this.renderDistance * 2) / CHUNK_SIZE) + 4;
      const cx0 = (Math.floor(px) >> 4) - (size >> 1), cz0 = (Math.floor(pz) >> 4) - (size >> 1);
      this.farTerrain.setChunkMask(cx0, cz0, size, (cx, cz) => drawn.has(chunkId(cx, cz)), CHUNK_SIZE);
    }
  }

  // ---- input ----

  wireInput() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('click', () => {
      if (!this.pointerLocked && !this.ui.isAnyPanelOpen()) this.requestPointerLock();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      const wasLocked = this.pointerLocked;
      this.pointerLocked = document.pointerLockElement === canvas;
      if (this.pointerLocked) {
        this.ui.hideBlocker();
        this.ui.setResumeHint(false);
      } else if (wasLocked && !this.ui.isAnyPanelOpen()) {
        // Opening the menu here used to be the only way out of pointer lock,
        // which meant the toolbar was never reachable with the world visible —
        // clicking Select appeared to do nothing. Leave the world on screen and
        // just say how to get the mouse back.
        this.ui.setResumeHint(true);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      const k = 0.0022 * (this.controls.sensitivity ?? 1);
      this.player.look(e.movementX * k, e.movementY * k);
    });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.pointerLocked) return;
      if (this.moving) {
        if (e.button === 0) this.dropMove();
        else if (e.button === 2) this.cancelMove();
        return;
      }
      if (e.button === 0) { this.primaryAction(); this.setBreaking(true); }
      else if (e.button === 2) { this.secondaryAction(); this.setPlacing(true); }
    });

    // The wheel moves the hotbar selection, so picking something is not only
    // the number keys or clicking a slot by hand.
    canvas.addEventListener('wheel', (e) => {
      if (!this.pointerLocked || this.moving) return;
      e.preventDefault();
      // While the column claim tool is armed, the wheel sets its height
      // instead — see beginClaimColumn.
      if (this.pendingClaimColumn) return void this.adjustClaimColumnHeight(-Math.sign(e.deltaY));
      this.ui.cycleHotbarByDelta(Math.sign(e.deltaY));
    }, { passive: false });
    // Every way the button can stop being down, including the ones that are not
    // a mouseup: releasing outside the canvas, tabbing away mid-hold, or the
    // browser taking the pointer back.
    for (const [target, event] of [[window, 'mouseup'], [window, 'blur'], [document, 'visibilitychange']]) {
      target.addEventListener(event, () => { this.setBreaking(false); this.setPlacing(false); });
    }

    window.addEventListener('keydown', (e) => {
      // Nothing in here is a shortcut while you are filling in a form. Typing an
      // email address used to open the workbench on "e" and the buildings panel
      // on "b", which on a phone buried the keyboard under a panel.
      if (isTyping(e)) return;

      if (e.code === 'Escape') {
        // Putting down what you are holding comes before putting away panels.
        if (this.moving) { this.cancelMove(); return; }
        // And a queued tool is something you are holding. Without this, the one
        // key that means "put this away" opened the menu instead, and a roof
        // with more than one way round could not be put away at all — the
        // second button turns it, so it never reached the cancel underneath.
        if (this.armed) { this.clearPending(); return; }
        if (this.pointerLocked) return; // browser handles exiting lock
        // One at a time, most recent first — Escape means "put away the thing
        // in front of me", not "put away everything". On the worlds screen
        // there is nothing to put away and nowhere behind it to go.
        if (this.ui.isAnyPanelOpen()) this.ui.closeTopPanel();
        else if (!this.ui.isHomeOpen()) this.ui.openPanel('panel-menu');
        return;
      }
      if (e.repeat) return;

      // Panel shortcuts come from the panel declarations rather than a chain of
      // ifs here, so a new panel brings its own key and cannot quietly claim
      // one another panel already uses. They sit above the "only while playing"
      // line below because the same key has to put the panel away again, and by
      // then you are not playing — but not on the worlds screen, where there is
      // no world for them to act on. No exitPointerLock either: opening a panel
      // changes the phase, and the phase releases the lock. See syncPhase.
      // The workbench's shortcut is the one panel key that still has to
      // check sandbox specifically: everything else marked mode: 'duilt'
      // now runs in a sandbox world too (see DuiltGame's own note on why),
      // but there's nothing to craft when the bag already holds one of
      // everything — see UIManager's matching `.survival-only` gate on the
      // button itself.
      // A key you've bound to moving (see config/controls.js) moves you;
      // it doesn't also open whichever panel had it.
      const bound = Object.values(this.controls.keys).includes(e.code);
      const shortcut = this.phase === 'home' || bound ? null : panelForKey(e.code);
      const survivalOnly = shortcut?.id === 'panel-bench';
      if (shortcut && (shortcut.mode !== 'duilt' || this.duilt) && !(survivalOnly && this.duilt?.sandbox)) {
        if (this.ui.isPanelOpen(shortcut.id)) this.ui.closePanel(shortcut.id);
        else if (shortcut.prepare === 'claim') this.openClaim();
        else this.ui.openPanel(shortcut.id);
        return;
      }

      // Everything below acts on the world, so it only applies while you are in
      // it. Escape, above, is the way out and always works.
      if (!this.isPlaying) return;
      if (/^Digit[1-9]$/.test(e.code)) this.ui.cycleHotbarByKey(Number(e.code.slice(5)));
      // R turns whatever is queued. One key for both, because "turn the thing
      // before you put it down" is one idea however it got queued.
      const turnKey = this.controls.keys.turn;
      if (e.code === turnKey && this.pendingRoof) this.turnRoof();
      else if (e.code === turnKey && this.pendingTemplate) {
        this.templateRotation = (this.templateRotation + 1) % 4;
        this.ui.toast({ kind: 'xp', title: `Rotated ${this.templateRotation * 90}\u00b0` });
      }
    });
  }

  closeAllPanels() {
    this.ui.closeAllPanels();
  }

  requestPointerLock() {
    if (this.ui.isAnyPanelOpen()) this.closeAllPanels();
    this.renderer.domElement.requestPointerLock?.();
  }

  enterFullscreen() {
    if (!document.fullscreenEnabled || document.fullscreenElement) return;
    this.container.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else this.enterFullscreen();
    return !document.fullscreenElement;
  }

  /**
   * Starts or stops breaking on repeat.
   *
   * Only plain breaking repeats. With something queued the same button puts it
   * down, and holding it should not stamp forty copies.
   */
  setBreaking(on) {
    const want = on && !this.armed && !this.moving;
    if (want === this.breaking) return;
    this.breaking = want;
    if (want) {
      this.breakHeldSince = performance.now();
      this.lastBreakAt = this.breakHeldSince;
    }
  }

  /** One frame of a held break. Re-aims every time, so it eats what you point at. */
  tickBreaking(now) {
    if (!this.breaking) return;
    if (now - this.breakHeldSince < HOLD_BREAK_DELAY_MS) return;
    if (now - this.lastBreakAt < HOLD_BREAK_INTERVAL_MS) return;
    this.lastBreakAt = now;
    this.breakBlock();
  }

  /** Starts or stops placing on repeat — the same idea as setBreaking, for Place. */
  setPlacing(on) {
    const want = on && !this.armed && !this.moving;
    if (want === this.placing) return;
    this.placing = want;
    if (want) {
      this.placeHeldSince = performance.now();
      this.lastPlaceAt = this.placeHeldSince;
    }
  }

  /** One frame of a held place. Re-aims every time, so it follows where you point. */
  tickPlacing(now) {
    if (!this.placing) return;
    if (now - this.placeHeldSince < HOLD_PLACE_DELAY_MS) return;
    if (now - this.lastPlaceAt < HOLD_PLACE_INTERVAL_MS) return;
    this.lastPlaceAt = now;
    this.placeBlock();
  }

  /** Whether a tool is queued and waiting to be used where you are pointing. */
  get armed() {
    return !!(this.pendingRoof || this.pendingTemplate || this.pendingClear || this.pendingClaim || this.pendingClaimColumn);
  }

  primaryAction() {
    if (this.moving) return void this.cancelMove();
    // Manning a catapult, Break throws.
    if (this.manning) return void this.throwStone();
    // A queued tool takes the button it needs and nothing else does. There is
    // no mode to be in any more: if nothing is queued, Break breaks.
    if (this.pendingClaim) return void this.markClaimCorner();
    if (this.pendingClaimColumn) return void this.confirmClaimColumn();
    if (this.pendingClear) return void this.runClear();
    if (this.pendingRoof) return void this.stampRoof();
    if (this.pendingTemplate) return void this.stampTemplate();
    // The selected item can take the button instead of digging — the
    // bucket, or something to eat. Nothing to dig with, or nothing to dig.
    const override = BREAK_OVERRIDE[this.selectedItemId] ?? (isFood(this.selectedItemId) ? 'eatSelected' : null);
    if (override) return void this[override]();
    this.breakBlock();
  }

  secondaryAction() {
    // Place puts down what you are holding, on a mouse and under a thumb
    // alike. Cancelling is Escape, or the Break button — which says "Cancel"
    // while you are carrying something, so there is nothing to guess.
    if (this.moving) return void this.dropMove();
    // A roof with more than one way round takes this button, so a phone has a
    // way to turn it. See setToolReadout, which labels it to match.
    if (this.pendingRoof?.turns > 1) return void this.turnRoof();
    if (this.armed) return void this.clearPending();
    if (this.manning) return void this.letGo();
    // Pointing at a gate, Place opens or shuts it — before anything you're
    // holding gets a say, the same way you'd reach for a latch.
    const aimed = this.raycast();
    if (aimed && swings(aimed.block)) return void this.toggleGate(aimed);
    // And at a chest, Place opens it.
    if (aimed && isChest(aimed.block)) return void this.openChest(aimed);
    // And at a catapult, Place takes hold of it.
    if (aimed && isCatapult(aimed.block)) return void this.manCatapult(aimed);
    // A full bucket takes the button too, instead of placing a block.
    const override = PLACE_OVERRIDE[this.selectedItemId] ?? (isFood(this.selectedItemId) ? 'throwSelected' : null);
    if (override) return void this[override]();
    this.placeBlock();
  }

  /** Captures the build you are pointing at and stores it by name. */
  saveTemplate(name) {
    const build = this.buildUnderCrosshair();
    if (!build) {
      this.ui.toast({
        kind: 'xp',
        title: 'Point at what you built',
        body: 'Look at the build you want to keep, then save it',
      });
      return null;
    }
    const captured = captureBlocks(build.blocks, build.bounds);
    if (!captured?.blocks.length) return null;
    const record = this.templates.save(name, captured);
    if (record) {
      if (!this.duilt?.sandbox) this.gamification.onTemplateSaved(record);
      this.ui.toast({
        kind: 'challenge',
        title: `Saved "${record.name}"`,
        body: `${record.blockCount} blocks`,
      });
    }
    return record;
  }

  /** Stamps the queued template where you are pointing, charged and undoable as one action. */
  stampTemplate() {
    if (!this.pendingTemplate) return false;
    const oriented = rotateTemplate(this.pendingTemplate, this.templateRotation);
    const size = this.pendingTemplate.size;
    const anchor = this.stampAnchor({ x: size - 1, y: 0, z: size - 1 });
    const changes = buildTemplatePlacement(this.world, oriented, anchor);
    if (!changes.length) {
      this.ui.toast({ kind: 'xp', title: 'Nothing to place', body: 'It already matches what is there' });
      return false;
    }
    const name = this.pendingTemplate.name;
    if (!this.applyChanges(changes, { viaSymmetry: false })) return false;
    if (!this.duilt?.sandbox) this.gamification.onTemplatePlaced(this.pendingTemplate);
    this.ui.toast({ kind: 'challenge', title: `Placed ${name}`, body: `${changes.length} blocks` });
    return true;
  }

  /**
   * Nothing queued. Back to breaking and placing.
   *
   * Quiet when one tool is making way for another: picking a roof said "Put it
   * away" and then "Ready: Gable roof" in the same breath, which reads as the
   * game arguing with itself.
   */
  clearPending({ quiet = false } = {}) {
    const had = this.armed && !quiet;
    this.pendingTemplate = null;
    this.pendingRoof = null;
    this.pendingClear = null;
    this.pendingClaim = null;
    this.pendingClaimColumn = null;
    this.roofTurn = 0;
    this.roofGhost.hide();
    this.roofKey = null;
    this.selection.hide();
    if (had) this.ui?.toast({ kind: 'xp', title: 'Put it away' });
  }

  /**
   * The build the crosshair is on, worked out once a frame and shared.
   *
   * Every tool that used to need the selector needs the same thing: which
   * building do you mean. Asking the world that is a flood fill, so it happens
   * once per aim rather than once per caller, and not at all unless something
   * is going to use the answer.
   */
  buildUnderCrosshair() {
    const hit = this.toolAim();
    if (!hit) return null;
    const key = `${hit.x},${hit.y},${hit.z}`;
    if (key !== this.pickKey) {
      this.pickKey = key;
      this.pick = pickBuild(this.world, hit);
    }
    return this.pick;
  }

  /** Next orientation of the queued roof. A hip roof has only one, and says so. */
  turnRoof() {
    if (!this.pendingRoof) return 0;
    if (this.pendingRoof.turns <= 1) {
      this.ui.toast({ kind: 'xp', title: `A ${this.pendingRoof.name.toLowerCase()} roof looks the same every way round` });
      return 0;
    }
    this.roofTurn = (this.roofTurn + 1) % this.pendingRoof.turns;
    this.ui.toast({ kind: 'xp', title: `Turned · ${facingLabel(this.pendingRoof, this.roofTurn)}` });
    return this.roofTurn;
  }

  /**
   * What the queued clear would take, worked out once per aim.
   *
   * Cached the same way the roof's pick is, because "this build" is a flood
   * fill and the crosshair moves every frame.
   */
  clearTarget() {
    if (!this.pendingClear) return null;
    const hit = this.toolAim();
    if (!hit) return null;
    const key = `clear:${this.pendingClear.id}:${hit.x},${hit.y},${hit.z}`;
    if (key !== this.clearPickKey) {
      this.clearPickKey = key;
      this.clearPickValue = clearCells(this.world, hit, this.pendingClear);
    }
    return this.clearPickValue;
  }

  /**
   * Takes the queued clear's blocks away, into your bag, as one action.
   *
   * Straight through applyChanges, so a claimed building refuses it, the border
   * refuses it, bedrock is filtered out of it, and every block that does go
   * lands in your bag exactly as if you had broken it by hand — because as far
   * as the rest of the game is concerned, that is what happened.
   */
  runClear() {
    if (!this.pendingClear) return false;
    const hit = this.toolAim();
    if (!hit) {
      this.ui.toast({ kind: 'xp', title: 'Point at something first' });
      return false;
    }
    const changes = clearPlan(this.world, hit, this.pendingClear);
    if (!changes.length) {
      this.ui.toast({
        kind: 'xp',
        title: 'Nothing there to take',
        body: this.pendingClear.kind === 'build' ? 'That is the ground, not something you built' : '',
      });
      return false;
    }
    if (!this.applyChanges(changes, { chargeResources: false })) return false;
    this.clearPickKey = null;
    this.roofPickKey = null;
    this.pickKey = null;
    this.ui.toast({
      kind: 'challenge',
      title: `${changes.length} blocks cleared`,
      body: this.duilt ? 'All of it is in your bag' : '',
    });
    return true;
  }

  /**
   * What the clear would take, outlined before you take it.
   *
   * A tool that removes sixty blocks at once and gives you no warning of which
   * sixty is a tool nobody will press twice.
   */
  updateClearPreview(cells) {
    if (!cells?.length) return this.selection.hide();
    this.selection.update(cellBounds(cells), cells, this.world, { force: this.selectionDirty });
    this.selectionDirty = false;
  }

  /** The shape of the building the crosshair is on. Null when you are aiming at scenery. */
  roofTarget() {
    const hit = this.toolAim();
    if (!hit) return null;
    const key = `roof:${hit.x},${hit.y},${hit.z}`;
    if (key !== this.roofPickKey) {
      this.roofPickKey = key;
      this.roofPickValue = roofPick(this.world, hit);
    }
    return this.roofPickValue;
  }

  /**
   * The roof this building already has, if this tool is the one that put it up.
   *
   * Placing a roof, seeing it face the wrong way, turning it and placing again
   * is the normal way this tool gets used, and without this it would leave two
   * roofs crossed over each other — the second sitting on the first, because
   * the first is now the top of the building. So the last roof is remembered,
   * and only while every block of it is still where it was put: break into it,
   * undo it, or point at a different building and it is a different question,
   * which the plain rule answers.
   */
  roofRelay(pick) {
    const last = this.lastRoof;
    if (!last || !pick) return null;
    if (last.base !== pick.y) return null;   // the old roof is now the top course
    for (const c of last.cells) {
      if (this.world.getBlock(c.x, c.y, c.z) !== c.type) return null;
    }
    return last;
  }

  /** The height the eaves land on, relay included, so the preview matches. */
  roofEave(pick) {
    return this.roofRelay(pick)?.base ?? (pick ? pick.y + 1 : 0);
  }

  /**
   * Pitches the queued roof over the building you are pointing at, out of the
   * block you are holding, as one undoable action paid for in one go.
   */
  stampRoof() {
    if (!this.pendingRoof) return false;
    const pick = this.roofTarget();
    if (!pick) {
      this.ui.toast({
        kind: 'xp',
        title: 'Point at a building',
        body: 'Look at a wall of it — that is where the eaves go',
      });
      return false;
    }
    const type = this.selectedBlockId;
    const availability = this.blockAvailability(type);
    if (!availability.ok) {
      this.ui.toast({ kind: 'xp', title: 'Locked block', body: availability.reason });
      return false;
    }
    const relay = this.roofRelay(pick);
    const base = relay?.base ?? pick.y + 1;
    const shape = this.pendingRoof, turn = this.roofTurn;
    const changes = roofPlan(this.world, pick, { shape, turn, type, base });

    const laid = roofBlocks(pick, { shape, turn })
      .map((b) => ({ x: b.x, y: base + b.dy, z: b.z, type: roofTypeFor(type, b) }));
    // Re-laying a roof has to take the old one's corners down as well as put
    // the new one up, or turning a gable leaves a cross on the roof.
    if (relay) {
      const wanted = new Set(laid.map((c) => `${c.x},${c.y},${c.z}`));
      for (const c of relay.cells) {
        if (wanted.has(`${c.x},${c.y},${c.z}`)) continue;
        if (this.world.getBlock(c.x, c.y, c.z) !== c.type) continue;
        changes.push({ x: c.x, y: c.y, z: c.z, prev: c.type, next: AIR });
      }
    }

    if (!changes.length) {
      this.ui.toast({ kind: 'xp', title: 'Nothing to roof', body: 'That roof is already there' });
      return false;
    }
    const label = `${shape.name} roof`;
    if (!this.applyChanges(changes)) return false;
    this.lastRoof = { base, cells: laid };
    // The building is a different shape now, so the next aim has to look again.
    this.roofPickKey = null;
    this.pickKey = null;
    const made = BLOCKS_BY_ID.get(type)?.name ?? 'blocks';
    this.ui.toast({
      kind: 'challenge',
      title: `${label} up`,
      body: `${changes.length} blocks of ${made.toLowerCase()}`,
    });
    return true;
  }

  /**
   * The roof you are about to place, in the air, before you place it.
   *
   * Orientation is the part a shape cannot get right on its own — nothing about
   * a building says which way it fronts. Seeing the slope turn as you press R
   * is the difference between that being a guess and being a choice.
   *
   * Rebuilt only when it would look different, since the preview is a mesh and
   * the crosshair moves every frame.
   */
  updateRoofPreview(pick) {
    if (!this.pendingRoof || !pick) {
      if (this.roofKey !== null) { this.roofGhost.hide(); this.roofKey = null; }
      return;
    }
    const base = this.roofEave(pick);
    const key = [this.pendingRoof.id, this.roofTurn, this.selectedBlockId,
      pick.bounds.minX, pick.bounds.minZ, pick.bounds.maxX, pick.bounds.maxZ, base].join(':');
    if (key === this.roofKey) return;
    this.roofKey = key;
    const cells = roofBlocks(pick, { shape: this.pendingRoof, turn: this.roofTurn });
    const blocks = cells.map((b) => ({
      dx: b.x - pick.bounds.minX, dy: b.dy, dz: b.z - pick.bounds.minZ, type: roofTypeFor(this.selectedBlockId, b),
    }));
    this.roofGhost.show(blocks, {
      x: pick.bounds.maxX - pick.bounds.minX,
      y: roofPeak(cells),
      z: pick.bounds.maxZ - pick.bounds.minZ,
    });
    this.roofGhost.moveTo({ x: pick.bounds.minX, y: base, z: pick.bounds.minZ });
  }

  /** Offers the framed region to the claim menu. */
  /**
   * What the building panel can do to one building.
   *
   * These used to be "unlock" and "release the claim", which are words about
   * the bookkeeping rather than about the building. What you actually want to
   * do to something you put up is change it, move it, or get rid of it.
   */
  buildingActions(structure) {
    return {
      onChange: () => {
        if (structure.locked === false) this.finishEditing();
        else this.startEditing(structure);
      },
      onMove: () => this.beginMove(structure),
      onDelete: () => this.deleteBuilding(structure),
      onOpenStore: () => this.ui.openStore(structure),
      onEvolve: () => this.evolveBuilding(structure),
    };
  }

  /**
   * The button in the building panel that actually moves a leveled building
   * up its ladder — see StructureRegistry.evolve. Qualifying used to be the
   * whole story; this is what makes reaching the level something you did
   * rather than something that happened to the last block you placed. The
   * panel redraws itself off the bus (DuiltUI's structure:upgraded
   * listener), so there is nothing more to do here than ask and say why not.
   */
  evolveBuilding(structure) {
    const r = this.duilt.structures.evolve(structure.id);
    if (!r.ok) this.ui.toast({ kind: 'xp', title: "Can't evolve it yet", body: r.reason });
  }

  /**
   * Unlocks a building for changes and closes the panel so there is
   * something to actually change — a claimed building's blocks are
   * unbreakable while any panel is open (see the phase check this reads
   * from), so the panel used to stay up, showing "Done changing" over a
   * world you had no way to touch.
   *
   * Reported directly: finishing meant walking back to wherever a wall of
   * it still stood and aiming precisely enough to reopen this same panel —
   * worse once you'd broken the wall you were aiming at. The crosshair
   * strip is pinned to this building instead (setEditingBanner), so
   * finishing is one tap from wherever you are, not one tap from a spot you
   * have to go back and find.
   */
  startEditing(structure) {
    this.duilt.structures.setLocked(structure.id, false);
    this.editingStructure = structure;
    this.ui.closePanel('panel-building');
    this.ui.setEditingBanner(STRUCTURES_BY_ID.get(structure.type)?.name ?? 'Building');
    this.ui.toast({
      kind: 'xp', title: 'Open for changes',
      body: 'Break and place inside it — it is re-checked as you go',
    });
  }

  /** The other half of startEditing — locks the building back up and hands the strip back to the crosshair. */
  finishEditing() {
    const structure = this.editingStructure;
    if (!structure) return;
    this.editingStructure = null;
    this.duilt.structures.setLocked(structure.id, true);
    this.ui.clearEditingBanner();
    this.ui.toast({ kind: 'xp', title: 'Finished changing', body: 'Protected again' });
    // Only actually open if it already was — reopening the panel here would
    // undo the point of finishing from wherever you happen to be standing.
    if (this.ui.isPanelOpen('panel-building')) this.ui.openBuilding(structure, this.buildingActions(structure));
  }

  /**
   * Takes a building down, blocks and all, and puts the materials back.
   *
   * Deleting goes through the same path as breaking it by hand, so the bag is
   * credited the same way and the whole thing is one undo rather than several
   * hundred.
   */
  deleteBuilding(structure) {
    const spec = STRUCTURES_BY_ID.get(structure.type);
    // The building this would otherwise still be pinning the crosshair strip
    // to no longer exists to finish editing.
    if (this.editingStructure?.id === structure.id) {
      this.editingStructure = null;
      this.ui.clearEditingBanner();
    }

    // Taking down a storehouse with things in it would take the things down
    // with it. Nothing else in the game destroys items, and this is not going
    // to be the first: empty it and then knock it down.
    const store = this.duilt.structures.storeFor(structure);
    if (store && store.slots.some(Boolean)) {
      this.ui.toast({
        kind: 'xp',
        title: 'There is still something in it',
        body: 'Empty the storehouse first — nothing gets thrown away here',
      });
      return;
    }

    const changes = this.cellsOf(structure.region)
      .map(({ x, y, z }) => ({ x, y, z, prev: this.world.getBlock(x, y, z), next: AIR }))
      .filter((c) => c.prev !== AIR && !this.world.isIndestructible(c.x, c.y, c.z));

    // Off the register first: a locked building refuses edits, including this one.
    this.duilt.structures.remove(structure.id);
    this.duilt.settlers.revalidate();
    this.ui.closePanel('panel-building');
    if (changes.length) this.applyChanges(changes, { chargeResources: false });
    this.ui.toast({
      kind: 'xp',
      title: `${spec?.name ?? 'Building'} taken down`,
      body: `${changes.length} blocks back in your bag`,
    });
  }

  /** Every cell of a region, as a flat list. */
  cellsOf(r) {
    const out = [];
    for (let x = r.minX; x <= r.maxX; x++)
      for (let y = r.minY; y <= r.maxY; y++)
        for (let z = r.minZ; z <= r.maxZ; z++) out.push({ x, y, z });
    return out;
  }

  /**
   * Lifts a building into the air so you can put it somewhere else.
   *
   * The blocks stay where they are until you drop it — so cancelling costs
   * nothing, and the move lands as one change rather than a demolition
   * followed by a rebuild you might not be able to afford.
   */
  beginMove(structure) {
    // Moving takes over the crosshair strip for its own hint (setMoveHint) —
    // an edit in progress on the same building is done, one way or another.
    if (this.editingStructure?.id === structure.id) {
      this.editingStructure = null;
      this.ui.clearEditingBanner();
    }
    const r = structure.region;
    const blocks = [];
    for (const { x, y, z } of this.cellsOf(r)) {
      const type = this.world.getBlock(x, y, z);
      if (type === AIR) continue;
      blocks.push({ dx: x - r.minX, dy: y - r.minY, dz: z - r.minZ, type });
    }
    if (!blocks.length) {
      this.ui.toast({ kind: 'xp', title: 'Nothing to move', body: 'There are no blocks left in it' });
      return;
    }
    this.moving = {
      structure,
      blocks,
      from: { ...r },
      extent: { x: r.maxX - r.minX, y: r.maxY - r.minY, z: r.maxZ - r.minZ },
      anchor: null,
      ok: false,
      reason: null,
    };
    this.ghost.show(blocks, this.moving.extent);
    this.ui.closePanel('panel-building');
    this.ui.setCarrying(true);
    this.ui.setMoveHint(STRUCTURES_BY_ID.get(structure.type)?.name ?? 'Building', null);
  }

  /** Where the held building would land, given where you are looking. */
  moveAnchor() {
    const { extent } = this.moving;
    const hit = this.hoverHit;
    const aim = hit
      ? { x: hit.placeX, y: hit.placeY, z: hit.placeZ }
      : this.pointInFront(Math.max(6, extent.x));
    // Centred on where you point, sitting on top of it.
    return {
      x: Math.round(aim.x - extent.x / 2),
      y: aim.y,
      z: Math.round(aim.z - extent.z / 2),
    };
  }

  /** Whether the held building may be put down here, and why not if not. */
  moveCheck(anchor) {
    const { extent, structure } = this.moving;
    const region = {
      minX: anchor.x, maxX: anchor.x + extent.x,
      minY: anchor.y, maxY: anchor.y + extent.y,
      minZ: anchor.z, maxZ: anchor.z + extent.z,
    };
    if (!this.world.inBounds(region.minX, region.minY, region.minZ)
      || !this.world.inBounds(region.maxX, region.maxY, region.maxZ)) {
      return { ok: false, reason: 'That is off the edge of the world', region };
    }
    if (!this.duilt.territory.containsRegion(region)) {
      return { ok: false, reason: 'That reaches outside your land', region };
    }
    if (this.duilt.structures.overlaps(region, structure.id)) {
      return { ok: false, reason: 'That overlaps another building', region };
    }
    return { ok: true, reason: null, region };
  }

  /** Called each frame while a building is in the air. */
  updateMove() {
    const anchor = this.moveAnchor();
    const check = this.moveCheck(anchor);
    this.moving.anchor = anchor;
    this.moving.ok = check.ok;
    this.moving.reason = check.reason;
    this.moving.region = check.region;
    this.ghost.moveTo(anchor);
    this.ghost.setValid(check.ok);
    this.ui.setMoveHint(
      STRUCTURES_BY_ID.get(this.moving.structure.type)?.name ?? 'Building',
      check.reason,
    );
  }

  /** Puts the held building down, if it may go here. */
  dropMove() {
    if (!this.moving) return false;
    const { structure, blocks, from, region, ok, reason, anchor } = this.moving;
    if (!ok) {
      this.ui.toast({ kind: 'xp', title: 'Not there', body: reason ?? 'That spot will not take it' });
      return false;
    }

    // Clearing the old cells and filling the new ones in one batch keeps it a
    // single undo, and means a building that overlaps its own old position
    // does not delete the blocks it is about to stand on.
    const cleared = new Map();
    for (const { x, y, z } of this.cellsOf(from)) {
      const prev = this.world.getBlock(x, y, z);
      if (prev !== AIR) cleared.set(`${x},${y},${z}`, { x, y, z, prev, next: AIR });
    }
    for (const b of blocks) {
      const x = anchor.x + b.dx, y = anchor.y + b.dy, z = anchor.z + b.dz;
      const key = `${x},${y},${z}`;
      const prev = cleared.get(key)?.prev ?? this.world.getBlock(x, y, z);
      cleared.set(key, { x, y, z, prev, next: b.type });
    }
    const changes = [...cleared.values()].filter((c) => c.prev !== c.next);

    // Off the register while the blocks move, so its own lock does not refuse.
    this.duilt.structures.remove(structure.id);
    if (!this.applyChanges(changes, { chargeResources: false })) {
      this.duilt.structures.structures.push(structure);
      this.ui.toast({ kind: 'xp', title: 'Could not move it', body: 'Nothing was changed' });
      return this.endMove(), false;
    }

    structure.region = region;
    this.duilt.structures.structures.push(structure);
    this.duilt.structures.recheck(structure);
    this.duilt.settlers.revalidate();
    this.endMove();

    const spec = STRUCTURES_BY_ID.get(structure.type);
    this.ui.toast(structure.valid
      ? { kind: 'challenge', title: `${spec?.name ?? 'Building'} moved`, body: 'It still counts' }
      : { kind: 'xp', title: `${spec?.name ?? 'Building'} moved`, body: structure.brokenReason ?? 'It no longer qualifies here' });
    return true;
  }

  /** Puts it back where it was. Nothing has changed, so there is nothing to undo. */
  cancelMove() {
    if (!this.moving) return;
    const spec = STRUCTURES_BY_ID.get(this.moving.structure.type);
    this.endMove();
    this.ui.toast({ kind: 'xp', title: 'Left where it was', body: `The ${spec?.name?.toLowerCase() ?? 'building'} has not moved` });
  }

  endMove() {
    this.moving = null;
    this.ghost.hide();
    this.ui.setMoveHint(null);
    this.ui.setCarrying(false);
  }

  openClaim() {
    if (!this.duilt) return;

    // Pointing at something you already claimed asks a different question —
    // not "what is this?" but "what do I want to do with it?".
    const aimed = this.hoverHit && this.duilt.structures.at(this.hoverHit.x, this.hoverHit.y, this.hoverHit.z);
    if (aimed) {
      this.ui.openBuilding(aimed, this.buildingActions(aimed));
      return;
    }
    // A design you placed that's still waiting: the claim panel for exactly
    // what it was placed as, which says what's missing.
    const waiting = this.hoverHit && this.duilt.waitingAt(this.hoverHit.x, this.hoverHit.y, this.hoverHit.z);
    if (waiting) {
      const region = waiting.region;
      this.ui.openClaim(region, (typeId) => {
        const r = this.duilt.claim(region, typeId);
        if (r.ok) this.duilt.waiting = this.duilt.waiting.filter((w) => w !== waiting);
        this.ui.toast(r.ok
          ? { kind: 'challenge', title: r.reason, body: 'It will start producing shortly' }
          : { kind: 'xp', title: "That doesn't qualify yet", body: r.reason });
      }, { first: waiting.type });
      return;
    }

    // Otherwise the question is "what is this thing I am pointing at?", and the
    // thing is the wall course you're on — see wallFootprintAt, and
    // beginClaimColumn for why this reads the wall rather than flood-filling
    // outward from wherever the crosshair happens to land.
    const hit = this.toolAim();
    const footprint = hit && wallFootprintAt(this.world, hit);
    if (!footprint) {
      this.ui.toast({ kind: 'xp', title: 'Point at what you built', body: 'Look at a wall of it and ask again' });
      return;
    }
    const region = { ...footprint, minY: hit.y, maxY: hit.y + CLAIM_COLUMN_DEFAULT_HEIGHT - 1 };
    this.ui.openClaim(region, (typeId) => {
      const r = this.duilt.claim(region, typeId);
      this.ui.toast(r.ok
        ? { kind: 'challenge', title: r.reason, body: 'It will start producing shortly' }
        : { kind: 'xp', title: "That doesn't qualify yet", body: r.reason });
    });
  }

  /**
   * Draws the area you want to claim, one corner at a time.
   *
   * Pointing at a build and letting the game follow the blocks is fine for a
   * house and impossible for a quarry: a quarry is a hole, and the flood fill
   * will not leave the original ground level, so "point at what you built"
   * was the only answer it could ever give for anything you dug. See
   * tools/ClaimArea.js.
   */
  beginClaimSelection() {
    if (!this.duilt) return false;
    this.clearPending({ quiet: true });
    this.pendingClaim = { a: null };
    this.ui.closePanel('panel-buildings');
    this.ui.toast({
      kind: 'challenge',
      title: 'Claim an area',
      body: 'Tap one corner of it, then the opposite corner',
    });
    return true;
  }

  /** One tap: the first corner, or the second and the claim panel. */
  markClaimCorner() {
    const hit = this.toolAim();
    if (!hit) {
      this.ui.toast({ kind: 'xp', title: 'Point at the ground', body: 'The corner goes on a block you can see' });
      return;
    }
    if (!this.pendingClaim.a) {
      this.pendingClaim.a = { x: hit.x, y: hit.y, z: hit.z };
      return;
    }
    const region = claimRegion(this.world, this.pendingClaim.a, hit);
    this.pendingClaim = null;
    this.selection.hide();
    this.ui.setToolReadout(null);
    if (!region) return;
    this.ui.openClaim(region, (typeId) => {
      const r = this.duilt.claim(region, typeId);
      this.ui.toast(r.ok
        ? { kind: 'challenge', title: r.reason, body: 'It will start producing shortly' }
        : { kind: 'xp', title: "That doesn't qualify yet", body: r.reason });
    });
  }

  /** The box being drawn, outlined in the world while you draw it. */
  updateClaimPreview() {
    const hit = this.toolAim();
    const a = this.pendingClaim.a;
    const hint = claimHint(a, hit);
    this.ui.setToolReadout({ claim: hint.name, target: hint.target, hint: hint.hint });
    if (!a || !hit) { this.selection.hide(); return; }
    const region = claimRegion(this.world, a, hit);
    const key = `claim:${a.x},${a.y},${a.z}:${hit.x},${hit.y},${hit.z}`;
    if (key === this.claimKey) return;
    this.claimKey = key;
    this.selection.update(region, blocksIn(this.world, region), this.world, { force: true });
  }

  /**
   * Draws a claim by pointing at one wall instead of tracing the whole build.
   *
   * "Claim what I framed" used to be buildUnderCrosshair's flood fill, which
   * double-checked every block against the terrain's recorded surface height
   * — a wall built starting at ground level (the only way anyone actually
   * builds one) failed that check on its own lowest course, so pointing at
   * your own house did nothing more often than it worked, with no error to
   * say why. wallFootprintAt only follows blocks connected to the one you're
   * pointing at, so it can't make that mistake. The height is no longer
   * guessed at all — you set it yourself, growing up from the block you're
   * on, because up is the direction you actually build in.
   */
  beginClaimColumn() {
    if (!this.duilt) return false;
    this.clearPending({ quiet: true });
    this.pendingClaimColumn = { height: CLAIM_COLUMN_DEFAULT_HEIGHT };
    this.claimColumnKey = null;
    this.ui.closePanel('panel-buildings');
    this.ui.toast({
      kind: 'challenge',
      title: 'Claim what I framed',
      body: 'Point at a wall — scroll to set how tall, then Break to claim',
    });
    return true;
  }

  /** Scroll while the column tool is armed changes height instead of the hotbar. */
  adjustClaimColumnHeight(delta) {
    if (!this.pendingClaimColumn) return;
    const h = this.pendingClaimColumn.height + delta;
    this.pendingClaimColumn.height = Math.max(CLAIM_COLUMN_MIN_HEIGHT, Math.min(CLAIM_COLUMN_MAX_HEIGHT, h));
    this.claimColumnKey = null;
  }

  /** The column being drawn, outlined in the world while you aim and scroll. */
  updateClaimColumnPreview() {
    const hit = this.toolAim();
    const height = this.pendingClaimColumn.height;
    if (!hit) {
      this.ui.setToolReadout({ claim: 'Claim what I framed', target: 'Point at a wall', hint: 'Scroll to set how tall' });
      this.selection.hide();
      return;
    }
    const footprint = wallFootprintAt(this.world, hit);
    if (!footprint) {
      this.ui.setToolReadout({ claim: 'Claim what I framed', target: "That's not a wall", hint: 'Point at something you built' });
      this.selection.hide();
      return;
    }
    const region = { ...footprint, minY: hit.y, maxY: hit.y + height - 1 };
    const w = footprint.maxX - footprint.minX + 1, d = footprint.maxZ - footprint.minZ + 1;
    this.ui.setToolReadout({
      claim: 'Claim what I framed',
      target: `${w} × ${d} · ${height} tall`,
      hint: 'Scroll to change height · Break to claim',
    });
    const key = `col:${hit.x},${hit.y},${hit.z}:${height}`;
    if (key === this.claimColumnKey) return;
    this.claimColumnKey = key;
    this.selection.update(region, blocksIn(this.world, region), this.world, { force: true });
  }

  /** Break, while the column tool is armed: locks the region and hands off to the type picker. */
  confirmClaimColumn() {
    const hit = this.toolAim();
    const footprint = hit && wallFootprintAt(this.world, hit);
    if (!footprint) {
      this.ui.toast({ kind: 'xp', title: "That's not a wall", body: 'Point at something you built' });
      return;
    }
    const region = { ...footprint, minY: hit.y, maxY: hit.y + this.pendingClaimColumn.height - 1 };
    this.pendingClaimColumn = null;
    this.selection.hide();
    this.ui.setToolReadout(null);
    this.ui.openClaim(region, (typeId) => {
      const r = this.duilt.claim(region, typeId);
      this.ui.toast(r.ok
        ? { kind: 'challenge', title: r.reason, body: 'It will start producing shortly' }
        : { kind: 'xp', title: "That doesn't qualify yet", body: r.reason });
    });
  }

  /**
   * Where a stamped building goes: the ground you are looking at.
   *
   * This used to prefer a selector box when one was up, which meant the same
   * button put a building in two different places depending on a mode you may
   * have forgotten was on. Aiming is the normal way to put something down, and
   * now it is the only way.
   */
  stampAnchor(extent) {
    const hit = this.raycast(TOOL_REACH);
    const spot = hit
      ? { x: hit.x, y: hit.y + 1, z: hit.z }          // on the block, not inside it
      : (() => { const a = this.pointInFront(6); return { ...a, y: this.world.surfaceHeight(a.x, a.z) }; })();

    // Centred on where you are looking. Anchoring by corner made the building
    // grow away from the crosshair, so aiming anywhere near your border put
    // most of it over the line and the only feedback was a refusal.
    return {
      x: spot.x - Math.floor((extent?.x ?? 0) / 2),
      y: spot.y,
      z: spot.z - Math.floor((extent?.z ?? 0) / 2),
    };
  }

  /**
   * Keeps a stamped building inside your land.
   *
   * Aiming near your own border used to be a refusal — you pressed Place, the
   * game said no, and you were left guessing how far in was far enough. You
   * clearly meant "about here", so it slides to the closest position that
   * fits. Only a design too big for the land at all can still fail, and that
   * says something the player can act on.
   */
  fitInsideLand(anchor, extent) {
    // A sandbox has no land to keep it inside of — see Territory's own note
    // on why bounds() still returns a real (if meaningless) box for one
    // rather than null, and why nothing that actually enforces a border
    // reads it for a sandbox world.
    if (this.duilt.sandbox) return anchor;
    const b = this.duilt.territory.bounds();
    const span = { x: extent?.x ?? 0, z: extent?.z ?? 0 };
    return {
      x: Math.max(b.minX, Math.min(anchor.x, b.maxX - span.x)),
      y: anchor.y,
      z: Math.max(b.minZ, Math.min(anchor.z, b.maxZ - span.z)),
    };
  }

  /** Drops a ready-made building where you are aiming, charged and undoable as one action. */
  stampStarter(typeId) {
    if (!this.duilt) return;
    const design = DESIGN_FOR_STRUCTURE.get(typeId);
    const aimed = this.stampAnchor(design?.extent);
    const b = this.fitInsideLand(aimed, design?.extent);
    // Follow the ground where it actually landed, or a slide sideways leaves
    // the building floating off a slope.
    if (b.x !== aimed.x || b.z !== aimed.z) b.y = this.world.surfaceHeight(b.x, b.z);
    const plan = this.duilt.starterPlacement(typeId, { x: b.x, y: b.y, z: b.z });
    if (!plan.ok) {
      this.ui.toast({ kind: 'xp', title: 'Cannot place that', body: plan.reason });
      return;
    }
    if (!this.applyChanges(plan.changes)) return;
    // It was built to pass, so claim it straight away.
    const e = plan.design.extent;
    const region = {
      minX: b.x, maxX: b.x + e.x,
      minY: b.y, maxY: b.y + e.y,
      minZ: b.z, maxZ: b.z + e.z,
    };
    const claim = this.duilt.claim(region, typeId);
    // Refused, it's remembered rather than forgotten: it says what it's
    // waiting for when you look at it, and counts the moment it can.
    if (!claim.ok) this.duilt.waitFor(region, typeId, claim.reason);
    this.ui.toast(claim.ok
      ? { kind: 'challenge', title: `${plan.design.name} placed`, body: claim.reason }
      : { kind: 'xp', title: `${plan.design.name} placed — not working yet`, body: `${claim.reason}. It will start as soon as it can.` });
  }

  // ---- cloud ----

  /**
   * Pushes the current world under its own id, so repeated saves overwrite the
   * same cloud world instead of littering it with copies.
   */
  async saveToCloud(name, { quiet = false, revision } = {}) {
    if (!this.cloud) throw new Error('This build has no cloud configured.');
    if (name) this.worldName = name;
    const result = await this.cloud.save(this.worldId, {
      world: this.world,
      name: this.worldName,
      mode: this.mode,
      player: this.player,
      gamification: this.gamification,
      economy: this.economy,
      duilt: this.duilt ? this.duilt.toJSON() : null,
      territoryBounds: this.duilt ? this.duilt.territory.bounds() : null,
      revision,
    });
    this.syncState.agree(this.worldId, result.revision);
    this.forgetCloudList();
    // Quiet when it is the autosave doing it. Saving is supposed to be the
    // thing you stop thinking about, and a toast every few minutes saying so
    // is the opposite of that.
    if (!quiet) {
      this.ui.toast({
        kind: 'challenge',
        title: 'Saved to your account',
        body: result.pushedChunks
          ? `${result.pushedChunks} of ${result.totalChunks} chunks changed`
          : 'Nothing had changed since the last save',
      });
    }
    return result;
  }

  async restoreFromCloud(id, { silent = false } = {}) {
    if (!this.cloud) throw new Error('This build has no cloud configured.');
    const data = await this.cloud.restore(id);
    this.worldIsLocal = false;
    this.loadFromData({
      world: data.world,
      mode: data.mode,
      player: data.player,
      gamification: this.gamification.toJSON(),
      economy: data.economy,
      duilt: data.duilt,
      worldId: id,
      worldName: data.name,
    }, { silent });
    // Nothing further to offer: this is the newer copy.
    this.offeredPull = null;
    // Write it back, then record the handshake — after the save, so the
    // agreement is never older than the copy it is vouching for. (This used to
    // say "write it down locally"; there has been no local copy since worlds
    // moved onto the account, and `saveNow` stopped taking options with it.)
    this.saveNow();
    this.syncState.agree(id, data.revision ?? 0);
    // Progression belongs to the account, not the world, so it is merged in
    // separately — and only if the cloud copy is further along than this
    // device. `remote` is a full GamificationEngine.toJSON() snapshot (see
    // CloudWorlds.progression()), so loadJSON takes it directly — this used
    // to spread it onto the current state instead, which silently kept
    // whatever `achievementsUnlocked` this device already had (fresh and
    // empty, on a new session) because `remote`'s field was never named
    // that. Reopening an old world lost every unlocked achievement, and
    // breaking one more block re-triggered "first break" as if it were new.
    try {
      const remote = await this.cloud.progression();
      if (remote && (remote.xp ?? 0) > (this.gamification.toJSON().xp ?? 0)) {
        this.gamification.loadJSON(remote);
        this.ui.updateXp();
      }
    } catch { /* the world is what matters; progression can wait for the next sign-in */ }
    if (!silent) {
      this.ui.closePanel('panel-menu');
      this.ui.toast({ kind: 'challenge', title: `Opened "${data.name}"`, body: 'The copy from your account' });
    }
  }

  // ---- local ----

  /** The local half of restoreFromCloud — see openWorld for how the two get told apart. */
  restoreFromLocal(id, { silent = false } = {}) {
    const data = this.local.restore(id);
    const world = World.deserialize(data.world, { makeGen: makeChunkGen });
    this.worldIsLocal = true;
    this.loadFromData({
      world,
      mode: data.mode,
      player: data.player,
      gamification: this.gamification.toJSON(),
      economy: data.economy,
      duilt: data.duilt,
      worldId: id,
      worldName: data.name,
    }, { silent });
    // Progression is shared across every local world in this browser, the
    // same split CloudWorlds keeps between an account's worlds and its one
    // progression row — so it only loads in when it is actually ahead,
    // exactly like restoreFromCloud's own merge.
    const local = this.local.loadProgression();
    if (local && (local.xp ?? 0) > (this.gamification.toJSON().xp ?? 0)) {
      this.gamification.loadJSON(local);
      this.ui?.updateXp();
    }
    if (!silent) {
      this.ui.closePanel('panel-menu');
      this.ui.toast({ kind: 'challenge', title: `Opened "${data.name}"`, body: 'The copy in this browser' });
    }
  }

  /**
   * Moves every world sitting in this browser onto the account you just
   * signed into or created.
   *
   * Where a world lives is not a choice the player makes — it is a
   * consequence of signing in. Without this, a world built before an
   * account existed would stay stuck in that one browser forever, and
   * "create an account, play anywhere" would only ever be true from that
   * point on, not for what you already built. Signing into an *existing*
   * account from a second, previously-signed-out browser goes through the
   * same path, so it folds in there too rather than sitting beside it.
   *
   * Best effort, per world: one that fails to upload (closed the tab
   * mid-migration, a dropped connection) is simply left in the local
   * library rather than lost, and picked up again on the next sign-in.
   */
  async migrateLocalWorlds() {
    if (!this.cloud?.signedIn) return 0;
    let moved = 0;
    for (const row of this.local.list()) {
      try {
        const data = this.local.restore(row.id);
        const world = World.deserialize(data.world, { makeGen: makeChunkGen });
        await this.cloud.save(row.id, {
          world, name: data.name, mode: data.mode, player: data.player,
          gamification: this.gamification, economy: data.economy, duilt: data.duilt,
        });
        this.local.delete(row.id);
        if (this.worldId === row.id) this.worldIsLocal = false;
        moved++;
      } catch { /* stays local; retried on the next sign-in */ }
    }
    return moved;
  }

  // ---- raycasting / block edits ----

  raycast(reach = REACH) {
    const origin = this.player.eyePosition();
    const dir = this.player.lookDirection();
    return castVoxelRay(this.world, origin, dir, reach);
  }

  /**
   * What a tool is pointing at, which is further than what your arm reaches.
   *
   * Seven blocks is right for breaking one: it is roughly arm's length, and it
   * is what stops you mining a hillside from the far side of a valley. It is
   * wrong for a tool that works on a whole building, because to see a whole
   * building you have to stand back from it — at arm's length you are looking
   * at one wall and cannot tell what the roof would do. So tools aim further.
   * They are not reaching in and touching a block; they are pointing at a thing.
   */
  toolAim() {
    return this.hoverHit ?? this.raycast(TOOL_REACH);
  }

  /** Block coordinate a given distance along the view direction. */
  pointInFront(distance) {
    const origin = this.player.eyePosition();
    const dir = this.player.lookDirection();
    return {
      x: Math.floor(origin.x + dir.x * distance),
      y: Math.max(0, Math.floor(origin.y + dir.y * distance)),
      z: Math.floor(origin.z + dir.z * distance),
    };
  }

  /** Whether a block can be held at all: it unlocks with a level or an achievement. */
  blockAvailability(id) {
    const cfg = BLOCKS_BY_ID.get(id);
    if (!cfg || cfg.system) return { ok: false, reason: 'Not placeable' };
    // "Basically all items available" — a sandbox has no achievement/level
    // gate on anything, the same way it has no age gate on a structure.
    if (this.duilt?.sandbox) return { ok: true };
    if (this.gamification.isBlockUnlocked(id)) return { ok: true };
    return {
      ok: false,
      reason: cfg.unlock?.type === 'level' ? `Unlocks at level ${cfg.unlock.value}` : 'Unlocks via an achievement',
    };
  }

  recomputeVertical() {
    this.player.externalUp = (this.upHeld ? 1 : 0) - (this.downHeld ? 1 : 0);
  }

  computeTargets(x, y, z) {
    if (this.symmetryTool.mode === 'off') return [{ x, y, z }];
    return this.symmetryTool.reflect(x, y, z);
  }

  /**
   * What Break does with an empty bucket selected: scoop from the water
   * you're pointing at, rather than dig it up. Water is a source, not
   * inventory — filling the bucket doesn't remove the block.
   */
  fillBucket() {
    if (!this.duilt) return;
    const hit = this.raycast();
    const atWater = hit && this.world.getBlock(hit.x, hit.y, hit.z) === WATER;
    if (!atWater) {
      this.ui.toast({ kind: 'xp', title: 'Nothing to scoop', body: 'Point at water and press Break' });
      return;
    }
    if (!this.duilt.inventory.remove('bucket', 1)) return;
    this.duilt.inventory.add('bucket_water', 1);
    this.ui.toast({ kind: 'xp', title: 'Bucket filled', body: 'Scooped up' });
  }

  /**
   * What Place does with a full bucket selected: pour it where you're
   * pointing. It lands as still water, and runs from there — down a slope,
   * off a ledge, into a hole (see world/WaterFlow.js). Break it again to be
   * rid of it and the spill dries up behind it.
   */
  emptyBucket() {
    if (!this.duilt) return;
    const hit = this.raycast();
    if (!hit) {
      this.ui.toast({ kind: 'xp', title: 'Nowhere to pour it', body: 'Point at the ground and press Place' });
      return;
    }
    const at = { x: hit.placeX, y: hit.placeY, z: hit.placeZ };
    const prev = this.world.getBlock(at.x, at.y, at.z);
    if (prev !== AIR && !isFlowing(prev)) return;
    if (!this.applyChanges([{ ...at, prev, next: WATER }], { chargeResources: false })) return;
    if (!this.duilt.inventory.remove('bucket_water', 1)) return;
    this.duilt.inventory.add('bucket', 1);
    this.ui.toast({ kind: 'xp', title: 'Bucket emptied', body: 'Poured out — watch where it runs' });
  }

  /**
   * What Break does with food selected: eat it instead of digging.
   * DuiltGame.eat() already does the real work (which slot, hunger, the
   * result) — this is only the wiring from "the hotbar slot you have
   * selected" to it, the same job fillBucket/emptyBucket do for the bucket.
   */
  eatSelected() {
    if (!this.duilt) return;
    const r = this.duilt.eat(this.selectedItemId);
    if (r.ok) this.sound?.eat();
    this.ui.toast(r.ok
      ? { kind: 'challenge', title: 'That helps', body: `+${r.restored} hunger` }
      : { kind: 'xp', title: r.reason });
  }

  /**
   * What Place does with food selected: throw one away instead of building.
   * One unit a press, the same grain as eatSelected — not the bag's discard
   * button, which clears a whole stack at once.
   */
  throwSelected() {
    if (!this.duilt) return;
    const id = this.selectedItemId;
    // A creative bag keeps everything — see Inventory's `endless`.
    if (this.duilt.inventory.endless) return;
    if (!this.duilt.inventory.remove(id, 1)) return;
    this.ui.toast({ kind: 'xp', title: `Threw away ${itemName(id)}`, body: 'One less to carry' });
  }

  /**
   * How long the block under the crosshair takes to come free, and whether
   * the selected tool refuses it outright.
   *
   * Bare hands (nothing selected, or a non-mining item) are never in the
   * effectiveness table at all, so they always land on the NORMAL/`false`
   * fallback — every material, always breakable, just not the fast way.
   * `blocked` only fires when a tool is actively wrong for the job.
   */
  breakDelayFor(blockId) {
    const tier = toolEffectiveness(this.selectedItemId, materialOf(blockId));
    if (tier === 'impossible') return { ms: 0, blocked: true, tier };
    if (tier === 'fast') return { ms: 0, blocked: false, tier };
    if (tier === 'slow') return { ms: SLOW_BREAK_MS, blocked: false, tier };
    return { ms: NORMAL_BREAK_MS, blocked: false, tier };
  }

  /**
   * The animal under the crosshair, if one is nearer than the block behind
   * it and within arm's reach. Wild animals, see world/Mobs.js.
   */
  mobTarget(hit = this.raycast()) {
    if (!this.mobs) return null;
    const eye = this.player.eyePosition(), dir = this.player.lookDirection();
    const found = this.mobs.pick(eye, dir, REACH);
    if (!found) return null;
    if (hit) {
      const blockT = rayBox(eye, dir, hit.x, hit.y, hit.z, hit.x + 1, hit.y + 1, hit.z + 1);
      if (blockT != null && blockT < found.t) return null;
    }
    return found.mob;
  }

  /**
   * Break, aimed at an animal: one blow. Hunting is the same button as
   * digging — the thing under the crosshair decides which it is, the same
   * way a settler in front of a wall is what you're looking at. A tool hits
   * harder than a fist (its `damage`, bare hands 1) and wears for it.
   * Returns whether the press was spent on an animal.
   */
  hitMob(hit) {
    const mob = this.mobTarget(hit);
    if (!mob) return false;
    const now = performance.now();
    if (now - (this.lastStrikeAt ?? 0) < STRIKE_COOLDOWN_MS) return true;
    this.lastStrikeAt = now;
    this.digTarget = null;
    const tool = ITEMS_BY_ID.get(this.selectedItemId);
    const { x, z } = this.player.position;
    const { killed, drops } = this.mobs.hit(mob, tool?.damage ?? 1, x, z);
    if (tool?.damage && this.duilt && this.duilt.inventory.useTool(tool.id) === 'worn') {
      this.ui.toast({ kind: 'xp', title: `${tool.name} broke`, body: 'Worn out — craft another' });
    }
    if (killed) {
      const spec = MOBS_BY_ID.get(mob.type);
      const gained = this.duilt?.collect(drops) ?? {};
      const got = Object.entries(gained).map(([id, n]) => `+${n} ${itemName(id).toLowerCase()}`).join(', ');
      this.ui.toast({ kind: 'xp', title: `Hunted a ${spec.name.toLowerCase()}`, body: got || undefined });
      if (mob.penId) this.duilt?.forgetAnimal(mob);
    }
    return true;
  }

  /**
   * The bandit under the crosshair, if one is nearer than the block behind
   * it and within reach. Only bandits can be fought — a messenger or the
   * hermit just stands there being named.
   */
  banditTarget(hit = this.raycast()) {
    if (!this.wanderers) return null;
    const eye = this.player.eyePosition(), dir = this.player.lookDirection();
    const found = this.wanderView.pickAt(this.wanderers.list.filter((p) => WANDERERS[p.kind].hp), eye, dir, REACH);
    if (!found) return null;
    if (hit) {
      const blockT = rayBox(eye, dir, hit.x, hit.y, hit.z, hit.x + 1, hit.y + 1, hit.z + 1);
      if (blockT != null && blockT < found.t) return null;
    }
    return found.person;
  }

  /**
   * Break, aimed at a bandit: one blow, the same button as hunting. A sword
   * hits hardest (its `damage`); any tool wears for it. Returns whether the
   * press was spent on a bandit.
   */
  hitBandit(hit) {
    const p = this.banditTarget(hit);
    if (!p) return false;
    const now = performance.now();
    if (now - (this.lastStrikeAt ?? 0) < STRIKE_COOLDOWN_MS) return true;
    this.lastStrikeAt = now;
    this.digTarget = null;
    const tool = ITEMS_BY_ID.get(this.selectedItemId);
    const { x, z } = this.player.position;
    const res = this.wanderers.hit(p, tool?.damage ?? 1, x, z);
    if (!res) return false;
    this.sound?.hit?.('wood', { gain: 0.5, pitch: 0.7 });
    if (tool?.damage && this.duilt && this.duilt.inventory.useTool(tool.id) === 'worn') {
      this.ui.toast({ kind: 'xp', title: `${tool.name} broke`, body: 'Worn out — craft another' });
    }
    if (res.killed) {
      const gained = this.duilt?.collect(res.drops) ?? {};
      const got = Object.entries(gained).map(([id, n]) => `+${n} ${itemName(id).toLowerCase()}`).join(', ');
      this.ui.toast({ kind: 'xp', title: `Beat ${p.name}, a bandit`, body: got || undefined });
    }
    return true;
  }

  /** A bandit's blow landing on you. */
  banditHits(p, hits) {
    if (!this.duilt || this.duilt.sandbox) return;
    const taken = this.duilt.hurt(hits, 'bandit');
    if (!taken) return;
    // Knocked up off your feet a little, so a blow is felt and not just seen.
    if (this.player.grounded) this.player.velocity.y = 4.5;
    this.sound?.hit?.('wood', { gain: 0.6, pitch: 0.55 });
  }

  /**
   * A raider at a storehouse: carries off up to a dozen of whatever's in it,
   * two kinds at most. Beat them before they get away and it's yours again.
   */
  banditSteals(p, structure) {
    const store = this.duilt?.structures.storeFor(structure);
    if (!store) return {};
    const kinds = store.heldIds().sort(() => Math.random() - 0.5).slice(0, 2);
    const loot = {};
    let room = 12;
    for (const id of kinds) {
      const n = Math.min(room, store.countOf(id), 2 + Math.floor(Math.random() * 8));
      if (n <= 0) continue;
      store.remove(id, n);
      loot[id] = n;
      room -= n;
    }
    const what = Object.entries(loot).map(([id, n]) => `${n} ${itemName(id).toLowerCase()}`).join(' and ');
    const name = STRUCTURES_BY_ID.get(structure.type)?.name?.toLowerCase() ?? 'storehouse';
    if (what) {
      this.ui.toast({ kind: 'xp', title: `${p.name} robbed your ${name}`, body: `Took ${what} — catch them before they get away` });
    }
    return loot;
  }

  // ---- the catapult (Phase 6c) ------------------------------------------------
  //
  // Chosen directly: "a buildable siege engine you aim and fire. Stones fly
  // on real arcs and break blocks where they land." Place takes hold of it;
  // you aim by looking where you want the stone to come down — the arc and
  // a ring show where it will — and Break throws. Place again, or walking
  // off, lets go.

  manCatapult(hit) {
    this.manning = { x: hit.x, y: hit.y, z: hit.z, reload: 0, v: null };
    this.digTarget = null;
    this.ui.setActionLabels('Throw', 'Let go');
    this.ui.toast({
      kind: 'challenge',
      title: 'Manning the catapult',
      body: this.ui.isTouch
        ? 'Look where you want the stone to land, then Throw. Let go when you\'re done.'
        : 'Look where you want the stone to land. Left click throws, right click lets go.',
    });
  }

  letGo() {
    this.manning = null;
    this.projectileView.setAim(null);
    this.ui?.setBuildingHint(null);
    this.ui?.setActionLabels(...this.ui.defaultActionLabels());
  }

  /** Where a stone leaves the catapult: its cup. */
  cupOf({ x, y, z }) {
    return { x: x + 0.5, y: y + 1.35, z: z + 0.5 };
  }

  /**
   * Where you're aiming: the first solid thing along your look, as far as
   * the catapult can throw — or, looking at open sky, its longest throw
   * that way. Never nearer than CATAPULT_MIN_THROW, so it can't be made to
   * drop a stone on your own head.
   */
  catapultTarget(from) {
    const eye = this.player.eyePosition(), dir = this.player.lookDirection();
    // Looked for from just past the catapult: you stand behind it, and
    // looking out over it shouldn't count as aiming at it.
    const skip = Math.hypot(from.x - eye.x, from.z - eye.z) + 1;
    const start = { x: eye.x + dir.x * skip, y: eye.y + dir.y * skip, z: eye.z + dir.z * skip };
    const hit = castVoxelRay(this.world, start, dir, MAX_RANGE * 1.5);
    const flat = Math.hypot(dir.x, dir.z) || 1;
    const fx = dir.x / flat, fz = dir.z / flat;
    let t = hit
      ? { x: hit.placeX + 0.5, y: hit.placeY, z: hit.placeZ + 0.5 }
      : { x: from.x + fx * MAX_RANGE, y: from.y, z: from.z + fz * MAX_RANGE };
    const d = Math.hypot(t.x - from.x, t.z - from.z);
    if (d < CATAPULT_MIN_THROW) {
      const x = from.x + fx * CATAPULT_MIN_THROW, z = from.z + fz * CATAPULT_MIN_THROW;
      t = { x, y: this.world.surfaceHeight(Math.floor(x), Math.floor(z)) + 1, z };
    }
    return t;
  }

  /** Stones in flight, and the aim while you're manning one. Every frame. */
  tickCatapult(dt) {
    this.projectiles?.tick(dt);
    const m = this.manning;
    if (!m) return;
    const p = this.player.position;
    if (!isCatapult(this.world.getBlock(m.x, m.y, m.z))
      || Math.hypot(p.x - m.x - 0.5, p.z - m.z - 0.5) > CATAPULT_REACH) {
      this.letGo();
      return;
    }
    m.reload = Math.max(0, m.reload - dt);
    const from = this.cupOf(m);
    const target = this.catapultTarget(from);
    m.v = bestAim(this.world, from, target);
    const arc = predictArc(this.world, from, m.v);
    this.projectileView.setAim({ points: arc.points, landed: arc.landed, inRange: m.v.inRange });
    const land = arc.landed ?? target;
    const dist = Math.round(Math.hypot(land.x - from.x, land.z - from.z));
    const stones = this.catapultAmmo();
    m.hint = `Catapult · ${dist} blocks${m.v.inRange ? '' : ' — as far as it throws'}`
      + (m.reload > 0 ? ' · winding back' : stones ? ` · ${stones.count} ${stones.name}` : ' · no stone');
  }

  /** What there is to throw: stone first, then cobblestone. Free in Creative. */
  catapultAmmo() {
    if (!this.duilt || this.duilt.sandbox) return { id: 'stone', count: '∞', name: 'stone' };
    for (const id of CATAPULT_AMMO) {
      const count = this.duilt.inventory.countOf(id);
      if (count > 0) return { id, count, name: itemName(id).toLowerCase() };
    }
    return null;
  }

  throwStone() {
    const m = this.manning;
    if (!m?.v || m.reload > 0) return;
    const ammo = this.catapultAmmo();
    if (!ammo) {
      this.ui.toast({ kind: 'xp', title: 'Nothing to throw', body: 'Carry stone or cobblestone in your bag' });
      return;
    }
    if (this.duilt && !this.duilt.sandbox) this.duilt.inventory.remove(ammo.id, 1);
    this.projectiles.fire(this.cupOf(m), m.v);
    m.reload = CATAPULT_RELOAD;
    // It swings round to face the throw.
    const facing = Math.abs(m.v.vx) > Math.abs(m.v.vz) ? (m.v.vx > 0 ? 1 : 3) : (m.v.vz < 0 ? 0 : 2);
    const id = turned(CATAPULT, facing);
    if (this.world.getBlock(m.x, m.y, m.z) !== id) {
      this.world.setBlock(m.x, m.y, m.z, id);
      this.remeshDirty();
    }
    this.sound?.hit?.('wood', { gain: 0.7, pitch: 0.45, length: 2 });
  }

  /**
   * A stone coming down: a crater of blocks knocked out, and a heavy blow
   * to anyone standing there. Your own claimed buildings, chests and
   * bedrock are spared — a stone thrown at a camp shouldn't cost you the
   * storehouse it happened to clip on the way.
   */
  stoneLands(landed) {
    const c = { x: landed.cell.x + 0.5, y: landed.cell.y + 0.5, z: landed.cell.z + 0.5 };
    let broke = 0;
    for (const { x, y, z, id } of craterCells(this.world, c)) {
      if (this.world.isIndestructible(x, y, z) || isChest(id) || isFluid(id)) continue;
      if (this.duilt?.structures.at(x, y, z)) continue;
      this.world.setBlock(x, y, z, AIR);
      broke++;
    }
    if (broke) this.remeshDirty();
    this.sound?.break?.('stone');

    const near = (o, r) => Math.hypot(o.x - c.x, o.z - c.z) < r && Math.abs(o.y - c.y) < 3;
    for (const p of this.wanderers?.list ?? []) {
      if (!WANDERERS[p.kind].hp || !near(p, 2.5)) continue;
      const res = this.wanderers.hit(p, STONE_HITS, c.x, c.z);
      if (res?.killed) {
        const gained = this.duilt?.collect(res.drops) ?? {};
        const got = Object.entries(gained).map(([id, n]) => `+${n} ${itemName(id).toLowerCase()}`).join(', ');
        this.ui.toast({ kind: 'xp', title: `The stone got ${p.name}, a bandit`, body: got || undefined });
      }
    }
    for (const mob of this.mobs?.list ?? []) {
      if (mob.dying || !near(mob, 2.5)) continue;
      const res = this.mobs.hit(mob, STONE_HITS, c.x, c.z);
      if (res.killed) this.duilt?.collect(res.drops);
    }
    if (near(this.player.position, 2)) this.duilt?.hurt(8, 'catapult');
  }

  breakBlock() {
    if (this.manning) return;
    const hit = this.raycast();
    if (this.hitBandit(hit)) return;
    if (this.hitMob(hit)) return;
    if (!hit) { this.digTarget = null; return; }

    let wornBy = null;
    if (this.duilt) {
      const key = `${hit.x},${hit.y},${hit.z}`;
      const isNewTarget = !this.digTarget || this.digTarget.key !== key;
      const { ms, blocked, tier } = this.breakDelayFor(this.world.getBlock(hit.x, hit.y, hit.z));
      if (blocked) {
        if (isNewTarget) {
          this.digTarget = { key, startedAt: performance.now() };
          this.ui.toast({
            kind: 'xp',
            title: "Can't break that",
            body: `${itemName(this.selectedItemId)} won't touch it — try bare hands`,
          });
        }
        return;
      }
      if (isNewTarget) this.digTarget = { key, startedAt: performance.now() };
      if (ms > 0 && performance.now() - this.digTarget.startedAt < ms) return;
      this.digTarget = null;
      // A tool only wears doing the job it's actually suited for — the speed
      // bonus has a cost, digging around with the wrong tool (or bare hands,
      // which was never in the effectiveness table to begin with) does not.
      if (tier === 'fast') wornBy = this.selectedItemId;
    }

    const targets = this.computeTargets(hit.x, hit.y, hit.z);
    const changes = [];
    for (const t of targets) {
      const prev = this.world.getBlock(t.x, t.y, t.z);
      if (prev === AIR) continue;
      changes.push({ x: t.x, y: t.y, z: t.z, prev, next: AIR });
    }
    const broke = this.applyChanges(changes, { viaSymmetry: this.symmetryTool.mode !== 'off' });
    if (broke && wornBy) {
      const result = this.duilt.inventory.useTool(wornBy);
      if (result === 'worn') {
        this.ui.toast({ kind: 'xp', title: `${itemName(wornBy)} broke`, body: 'Worn out — craft another' });
      }
    }
  }

  /**
   * Swings a gate open or shut. Reported directly: a gate that looked shut
   * but let animals through, with no way to lock the sheep in. Shut, it's
   * fence to everyone; open, anyone walks through — you included.
   *
   * Not an edit through applyChanges: nothing is spent or gathered, it
   * isn't something to undo, and a claimed pen's gate has to open without
   * unlocking the pen first.
   */
  toggleGate(hit) {
    // A door swings both its halves together.
    const door = doorPart(hit.block);
    const trap = isTrapdoor(hit.block);
    const cells = door ? this.doorCells(hit) : [{ x: hit.x, y: hit.y, z: hit.z, block: hit.block }];
    const shutting = door ? door.open : trap ? hit.block >= TRAPDOOR_OPEN : GATE_SWING[hit.block] === GATE_SHUT;
    if (shutting && cells.some((c) => this.blockOverlapsPlayerAABB(c))) {
      this.ui.toast({ kind: 'xp', title: door ? 'Step out of the doorway first' : trap ? 'Step out from under it first' : 'Step out of the gateway first' });
      return;
    }
    this.sound?.creak(!shutting);
    for (const c of cells) {
      const part = doorPart(c.block);
      const next = part ? doorBlock({ ...part, open: !part.open }) : trap ? swungTrapdoor(c.block) : GATE_SWING[c.block];
      this.world.setBlock(c.x, c.y, c.z, next);
      this.water?.touch(c.x, c.y, c.z);
      this.lava?.touch(c.x, c.y, c.z);
    }
    this.remeshDirty();
    this.editedAt = Date.now();
  }

  /** Both halves of the door at a cell — or just the one, if its other half is missing. */
  doorCells(at) {
    const part = doorPart(at.block ?? this.world.getBlock(at.x, at.y, at.z));
    const self = { x: at.x, y: at.y, z: at.z, block: at.block ?? this.world.getBlock(at.x, at.y, at.z) };
    const oy = part.top ? at.y - 1 : at.y + 1;
    const other = this.world.inBounds(at.x, oy, at.z) ? this.world.getBlock(at.x, oy, at.z) : AIR;
    const op = doorPart(other);
    return op && op.top !== part.top ? [self, { x: at.x, y: oy, z: at.z, block: other }] : [self];
  }

  /**
   * Which way you're facing, as quarter-turns from looking along -z: 0
   * north (-z), 1 east (+x), 2 south (+z), 3 west (-x). What a stair,
   * chair or door is put down at — see blocks.js's TURNS.
   */
  lookFacing() {
    const yaw = this.player.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 1 : 3;
    return fz < 0 ? 0 : 2;
  }

  /**
   * The block to actually put down for what's held: turned to face the
   * right way. A stair climbs away from you; a chair and a door face you.
   */
  placedBlock(type) {
    if (!turns(type)) return type;
    const look = this.lookFacing();
    const shape = BLOCKS_BY_ID.get(type)?.shape;
    // A chair and a chest face you; a stair climbs away from you.
    return turned(type, shape === 'chair' || shape === 'chest' ? look + 2 : look);
  }

  /** Opens the chest you're pointing at, on the store screen. */
  openChest(hit) {
    if (!this.duilt || !isChest(this.world.getBlock(hit.x, hit.y, hit.z))) return;
    this.duilt.chestAt(hit.x, hit.y, hit.z);
    this.ui.openStore({ chest: { x: hit.x, y: hit.y, z: hit.z } });
  }

  /**
   * Whether you're resting at home: standing still inside a claimed house
   * (or townhouse), which heals twice as fast — see survival/Health.js.
   */
  restingAtHome(wasAt) {
    const p = this.player.position;
    if (Math.hypot(p.x - wasAt.x, p.z - wasAt.z) > 1e-3) return false;
    const x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z);
    return this.duilt.structures.list().some((s) => (s.type === 'house' || s.type === 'townhouse') && s.valid !== false
      && x >= s.region.minX && x <= s.region.maxX && z >= s.region.minZ && z <= s.region.maxZ
      && y >= s.region.minY && y <= s.region.maxY + 1);
  }

  /**
   * What hurts this frame: a fall just landed, and lava you're standing in.
   * Phase 6 — chosen directly: falls past three blocks and lava hurt. Lava
   * stings in beats (Health's cooldown) rather than draining silently.
   */
  feelHurt() {
    const fall = this.player.takeLanding();
    if (fall > 0) this.duilt.hurt(fallDamage(fall), 'fall');
    const p = this.player.position;
    const x = Math.floor(p.x), z = Math.floor(p.z);
    for (const y of [Math.floor(p.y + 0.1), Math.floor(p.y + 1.2)]) {
      const id = this.world.getBlock(x, y, z);
      if (isLava(id) || isLavaFlow(id)) {
        this.duilt.hurt(LAVA_PER_SECOND / 2, 'lava', { steady: true });
        break;
      }
    }
  }

  /**
   * Dying. Chosen directly: you wake back at your settlement, and what you
   * were carrying waits in a chest where you fell — "when we die the chest
   * appears in place with my items". What's equipped stays with you.
   */
  die(cause) {
    if (!this.duilt || this.dying) return;
    this.dying = true;
    const p = this.player.position;
    const x = Math.floor(p.x), z = Math.floor(p.z);
    // The first open cell at or above your feet. Written straight into the
    // world rather than through applyChanges: it goes where you fell,
    // border or no border, and nothing pays for it.
    let y = Math.max(1, Math.floor(p.y));
    for (let up = 0; up < 6; up++, y++) {
      const id = this.world.getBlock(x, y, z);
      if (id === AIR || isFlowing(id) || id === WATER || isLava(id) || isLavaFlow(id)) break;
    }
    const left = this.duilt.leaveGrave(x, y, z);
    if (left) {
      this.world.setBlock(x, y, z, CHEST);
      this.remeshDirty();
    }
    const home = this.respawnPoint();
    this.player.teleport(home.x, home.y, home.z);
    this.duilt.health.restore();
    this.sound?.break?.('wood');
    this.ui?.duiltUI?.flashHurt(true);
    const how = { fall: 'You fell too far', lava: 'The lava took you', bandit: 'The bandits beat you', catapult: 'Your own stone came down on you' }[cause] ?? 'You died';
    this.ui?.toast({
      kind: 'xp',
      title: `${how} — you woke at home`,
      body: left
        ? `What you were carrying is in a chest where you fell, at ${x}, ${z}`
        : 'You had nothing with you to leave behind',
    });
    this.dying = false;
  }

  /** The chest you fell by, emptied: it's gone. */
  clearGrave({ x, y, z }) {
    if (!this.duilt || !isChest(this.world.getBlock(x, y, z))) return;
    this.world.setBlock(x, y, z, AIR);
    this.duilt.removeChest(x, y, z);
    this.remeshDirty();
    this.ui?.toast({ kind: 'challenge', title: 'Got everything back', body: 'The chest is gone' });
  }

  /** Where you wake after dying: a safe spot near the middle of your land. */
  respawnPoint() {
    const b = this.duilt?.territory.bounds?.();
    const cx = b ? Math.floor((b.minX + b.maxX + 1) / 2) : Math.floor(this.player.position.x);
    const cz = b ? Math.floor((b.minZ + b.maxZ + 1) / 2) : Math.floor(this.player.position.z);
    const world = this.world;
    for (let r = 0; r < 24; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = cx + dx, z = cz + dz;
          for (let y = Math.max(1, world.surfaceHeight(x, z) - 2); y < world.surfaceHeight(x, z) + 12 && y < world.height - 3; y++) {
            const under = world.getBlock(x, y - 1, z);
            if (world.isCollidable(x, y - 1, z) && !isLava(under) && !world.isCollidable(x, y, z) && !world.isCollidable(x, y + 1, z)) {
              return { x: x + 0.5, y, z: z + 0.5 };
            }
          }
        }
      }
    }
    return { x: cx + 0.5, y: world.surfaceHeight(cx, cz) + 1, z: cz + 0.5 };
  }

  placeBlock() {
    const hit = this.raycast();
    if (!hit) return;
    // Place on a gate swings it (secondaryAction); a held Place repeating
    // shouldn't go on to build against it.
    if (swings(hit.block) || isChest(hit.block) || isCatapult(hit.block)) return;
    const type = this.selectedBlockId;
    const availability = this.blockAvailability(type);
    if (!availability.ok) {
      this.ui.toast({ kind: 'xp', title: 'Locked block', body: availability.reason });
      return;
    }
    const held = this.placedBlock(type);
    const door = doorPart(held);
    const crop = cropOf(held);
    const targets = this.computeTargets(hit.placeX, hit.placeY, hit.placeZ);
    const changes = [];
    for (const t of targets) {
      // A mirrored copy is turned to match, so a stair on the far side
      // climbs the mirrored way too.
      const next = mirrored(held, t);
      if (!this.world.inBounds(t.x, t.y, t.z)) continue;
      // A seed goes in farmland and nowhere else.
      if (crop && this.world.getBlock(t.x, t.y - 1, t.z) !== FARMLAND) continue;
      if (this.blockOverlapsPlayerAABB(t) && !crop) continue;
      const prev = this.world.getBlock(t.x, t.y, t.z);
      if (prev === next) continue;
      if (door) {
        // A door needs the cell above it clear for its top half.
        const up = { x: t.x, y: t.y + 1, z: t.z };
        if (!this.world.inBounds(up.x, up.y, up.z) || this.blockOverlapsPlayerAABB(up)) continue;
        const above = this.world.getBlock(up.x, up.y, up.z);
        if (above !== AIR && !isFlowing(above)) continue;
        changes.push({ ...up, prev: above, next: doorBlock({ ...doorPart(next), top: true }) });
      }
      changes.push({ x: t.x, y: t.y, z: t.z, prev, next });
    }
    if (door && !changes.length) {
      this.ui.toast({ kind: 'xp', title: 'No room for a door', body: 'It needs two blocks of clear space' });
      return;
    }
    if (crop && !changes.length) {
      this.ui.toast({ kind: 'xp', title: 'Seeds go in farmland', body: 'Put down farmland and plant on top of it' });
      return;
    }
    this.applyChanges(changes, { viaSymmetry: this.symmetryTool.mode !== 'off' });
  }

  /**
   * Place with a handful of mixed seeds: whatever comes up. Which crop is
   * picked by where it lands, so the same patch doesn't reroll if you plant
   * it twice — and a row comes up as a mix.
   */
  plantMixed() {
    const hit = this.raycast();
    if (!hit) return;
    const { placeX: x, placeY: y, placeZ: z } = hit;
    if (this.world.getBlock(x, y - 1, z) !== FARMLAND || this.world.getBlock(x, y, z) !== AIR) {
      this.ui.toast({ kind: 'xp', title: 'Seeds go in farmland', body: 'Put down farmland and plant on top of it' });
      return;
    }
    const inv = this.duilt?.inventory;
    if (inv && !inv.endless && !inv.has('seeds', 1)) return;
    const h = Math.abs((x * 73856093) ^ (z * 19349663) ^ (y * 83492791));
    const next = cropBlock(CROPS[h % CROPS.length].kind, 0);
    if (!this.applyChanges([{ x, y, z, prev: AIR, next }], { chargeResources: false })) return;
    if (inv && !inv.endless) inv.remove('seeds', 1);
  }

  /** Brings every planted crop up to the stage its time in the ground says. */
  growCrops(dt) {
    this.cropClock = (this.cropClock ?? 0) + dt;
    if (this.cropClock < CROP_TICK_SECONDS || !this.duilt) return;
    this.cropClock = 0;
    if (this.duilt.crops.grow(this.world).length) this.remeshDirty();
  }

  /**
   * A crop stands on its farmland: take the soil out from under one and
   * the plant comes up with it (and goes in your bag, like any harvest).
   */
  withUprooted(changes) {
    let out = changes;
    for (const c of changes) {
      if (c.prev !== FARMLAND || c.next === FARMLAND) continue;
      const above = this.world.getBlock(c.x, c.y + 1, c.z);
      if (!cropOf(above)) continue;
      if (out.some((o) => o.x === c.x && o.y === c.y + 1 && o.z === c.z)) continue;
      if (out === changes) out = [...changes];
      out.push({ x: c.x, y: c.y + 1, z: c.z, prev: above, next: AIR });
    }
    return out;
  }

  /**
   * A door is one thing in two blocks: whatever takes away one half takes
   * the other with it, so there's never half a door left standing.
   */
  withDoorHalves(changes) {
    let out = changes;
    for (const c of changes) {
      if (!doorPart(c.prev) || doorPart(c.next)) continue;
      for (const other of this.doorCells({ x: c.x, y: c.y, z: c.z, block: c.prev })) {
        if (other.y === c.y) continue;
        if (out.some((o) => o.x === other.x && o.y === other.y && o.z === other.z)) continue;
        if (out === changes) out = [...changes];
        out.push({ x: other.x, y: other.y, z: other.z, prev: other.block, next: AIR });
      }
    }
    return out;
  }

  blockOverlapsPlayerAABB(t) {
    const p = this.player.position;
    const withinX = Math.abs((t.x + 0.5) - p.x) < 0.8; // block half-extent + player half-width
    const withinZ = Math.abs((t.z + 0.5) - p.z) < 0.8;
    const withinY = t.y < p.y + 1.8 && t.y + 1 > p.y;
    return withinX && withinZ && withinY;
  }

  /**
   * The one place blocks change. Break, place, stamp and symmetry all route
   * through here, so the rules only have to hook in once: the border says where
   * you may build and the bag says whether you can afford it. A batch is atomic
   * — if you can't pay for all of it, none of it lands.
   *
   * Nothing is remembered for undoing. Breaking a block is how you take a block
   * back — it goes in your bag when you do — and a tool that lays a lot at once
   * has a tool that takes a lot away again.
   */
  applyChanges(changes, { viaSymmetry = false, chargeResources = true } = {}) {
    changes = this.withUprooted(this.withDoorHalves(changes.filter((c) => !this.world.isIndestructible(c.x, c.y, c.z))));
    if (!changes.length) return false;

    // Duilt has its own economy: the border says where, the bag says whether.
    let duiltBill = null;
    if (this.duilt) {
      const outside = changes.find((c) => !this.duilt.territory.contains(c.x, c.z));
      if (outside) {
        this.ui?.toast({
          kind: 'xp',
          title: 'Outside your land',
          body: 'Finish this age to push the border out',
        });
        return false;
      }
      // A claimed building is not loose blocks any more. Holding the break
      // button past the edge of your own house should not quietly take a wall
      // out of it — you unlock it first, on purpose.
      const guarded = this.duilt.structures.blocking(changes);
      if (guarded) {
        const spec = STRUCTURES_BY_ID.get(guarded.type);
        this.ui?.toast({
          kind: 'xp',
          title: `${spec?.name ?? 'That building'} is locked`,
          body: 'Point at it and press C to unlock or remove it',
        });
        return false;
      }
      // A chest with things in it stays put — empty it first, the same as a
      // storehouse. Nothing in it is ever thrown away by a stray swing.
      const full = changes.find((c) => isChest(c.prev) && !isChest(c.next) && !this.duilt.chestEmpty(c.x, c.y, c.z));
      if (full) {
        this.ui?.toast({ kind: 'xp', title: 'Empty the chest first', body: 'Take everything out, then break it' });
        return false;
      }
      if (chargeResources) {
        const paid = this.duilt.payForPlacement(changes);
        if (!paid.ok) {
          this.ui?.toast({ kind: 'xp', title: 'Not enough', body: paid.reason });
          return false;
        }
        duiltBill = paid.bill;
      }
    }

    const now = performance.now();
    for (const c of changes) this.world.setBlock(c.x, c.y, c.z, c.next);
    // What's planted is kept track of, so it can grow while you're away.
    // And a chest gets its slots when it's put down, and loses them when
    // it's taken away (only ever empty — see above).
    if (this.duilt) {
      for (const c of changes) {
        if (isChest(c.next) && !isChest(c.prev)) this.duilt.chestAt(c.x, c.y, c.z);
        else if (isChest(c.prev) && !isChest(c.next)) this.duilt.removeChest(c.x, c.y, c.z);
        const was = cropOf(c.prev), is = cropOf(c.next);
        if (is && is.stage === 0 && !(was && was.kind === is.kind)) this.duilt.crops.plant(c.x, c.y, c.z, is.kind);
        else if (was && !is) this.duilt.crops.remove(c.x, c.y, c.z);
      }
    }
    // One sound for the edit, however many blocks it was: what it was made of.
    const first = changes[0];
    if (first.next !== AIR) this.sound?.place(soundOf(BLOCKS_BY_ID.get(first.next)));
    else this.sound?.break(soundOf(BLOCKS_BY_ID.get(first.prev)));
    // Anything that opens a way for water, or blocks one, sets it running.
    for (const c of changes) { this.water?.touch(c.x, c.y, c.z); this.lava?.touch(c.x, c.y, c.z); }
    this.remeshDirty();

    if (this.duilt) {
      const gained = this.duilt.onBlocksBroken(changes);
      if (Object.keys(gained).length) this.bus.emit('duilt:gathered', { gained });
      this.duilt.structures.revalidateAround(changes);
      // A design that was waiting for something — fields, a neighbour — may
      // have just got it.
      for (const w of this.duilt.retryWaiting(changes)) {
        const name = STRUCTURES_BY_ID.get(w.type)?.name ?? 'Building';
        this.ui?.toast({ kind: 'challenge', title: `${name} is working now`, body: w.reason });
      }
      this.duilt.settlers.revalidate();
      // The border line is drawn on the blocks that touch it, so digging one
      // out moves the ground under it.
      this.duilt.territory.onBlocksChanged(changes);
      this.duilt.checkAgeAdvance();
    }
    // No XP, no achievements, no level-ups in a sandbox — see DuiltGame's own
    // note on what "sandbox" turns off. GamificationEngine's checkAchievements
    // already refuses to unlock anything for one on its own, but there's no
    // reason to spend the bookkeeping (session tracking, build-score, spatial
    // heuristics) feeding it events nothing downstream will ever act on.
    if (!this.duilt?.sandbox) {
      for (const c of changes) {
        if (c.next !== AIR) this.gamification.onBlockPlaced({ world: this.world, x: c.x, y: c.y, z: c.z, type: c.next, viaSymmetry, now });
        else this.gamification.onBlockBroken({ world: this.world, x: c.x, y: c.y, z: c.z, type: c.prev, now });
      }
    }
    // This is the one place blocks change, so it is the one place that decides
    // the world has been played. See editedAt.
    this.editedAt = Date.now();
    return true;
  }

  /**
   * Rebuilds the chunks an edit just changed, nearest first, and queues the
   * rest.
   *
   * Everything used to be queued, and the queue is first come first served
   * — behind however many chunks were streaming in at the time. So a block
   * you broke stayed drawn as solid for a while after it was gone. Digging
   * straight down, you fell into that stale block and saw out through the
   * back of it: every cave below, which is exactly how it was reported. A
   * single edit touches at most three chunks and a rebuild is a few ms, so
   * those go now; a paste that touches more puts the rest at the front of
   * the queue rather than the back.
   */
  remeshDirty() {
    const edited = [];
    for (const chunk of this.world.dirtyChunks()) {
      // A chunk with no mesh yet is newly generated, not edited.
      if (chunk.mesh) edited.push(chunk);
      else this.remeshQueue.add(chunk);
    }
    if (edited.length) {
      const px = (this.player?.position.x ?? 0) / CHUNK_SIZE;
      const pz = (this.player?.position.z ?? 0) / CHUNK_SIZE;
      edited.sort((a, b) => distSq(a, px, pz) - distSq(b, px, pz));
      for (const chunk of edited.slice(0, EDIT_REBUILD_NOW)) {
        this.remeshQueue.delete(chunk);
        this.mesher.rebuild(this.world, chunk);
      }
      const later = edited.slice(EDIT_REBUILD_NOW);
      if (later.length) this.remeshQueue = new Set([...later, ...this.remeshQueue]);
    }
    this.selectionDirty = true; // blocks moved, so the selection skin is stale
  }

  /**
   * Works out the land you are walking towards, and forgets what is behind
   * you.
   *
   * Only the list, not the land itself. This used to generate every missing
   * chunk in the ring you'd just stepped into, in one frame — thirty-odd at a
   * few milliseconds each, a stall every time you crossed a chunk line, and
   * flying crosses one about every second. Reported directly as terrain that
   * felt like it was loading all the time. The list is worked through a few
   * milliseconds a frame instead (generateQueued), nearest first, and the far
   * terrain stands in for anything not made yet.
   *
   * One ring further than is drawn, so the chunks at the edge of what you see
   * have their neighbours to mesh against — see drainRemeshQueue.
   */
  streamChunks() {
    if (!this.world?.endless || !this.player) return;
    const { x, z } = this.player.position;
    // Only when you have actually moved somewhere new.
    const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4;
    if (this.streamedAt && this.streamedAt.cx === cx && this.streamedAt.cz === cz) return;
    this.streamedAt = { cx, cz };

    const c = Math.ceil(this.renderDistance / CHUNK_SIZE) + 1;
    const wanted = [];
    for (let dx = -c; dx <= c; dx++) {
      for (let dz = -c; dz <= c; dz++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > c * c || this.world.hasChunk(cx + dx, cz + dz)) continue;
        wanted.push({ cx: cx + dx, cz: cz + dz, d2 });
      }
    }
    this.genQueue = wanted.sort((a, b) => a.d2 - b.d2);
    // A chunk can also come into being as a side effect of something else
    // reaching into it (the world.getBlock a raycast or a settler does
    // generates whatever chunk it lands in). That chunk is real from the
    // moment it exists but was never queued for its own mesh, and sat there
    // invisible until an unrelated edit swept every dirty chunk. Sweeping
    // dirty chunks here as well means it gets a mesh as soon as possible.
    for (const chunk of this.world.dirtyChunks()) this.remeshQueue.add(chunk);
    // A generous margin past what is drawn, so walking back and forth over a
    // boundary does not throw away chunks it is about to want again.
    const dropped = this.world.forgetBeyond(x, z, this.renderDistance * 1.6);
    for (const chunk of dropped) {
      this.remeshQueue.delete(chunk);
      this.mesher.remove(chunk);
    }
  }

  /** Makes queued chunks, nearest first, for a few milliseconds a frame. */
  generateQueued(budgetMs = 4) {
    if (!this.genQueue?.length || !this.world?.endless) return;
    const start = performance.now();
    let i = 0, made = 0;
    while (i < this.genQueue.length) {
      // Only start one that should finish inside the budget — always at
      // least one a frame, so the queue can't stall.
      if (made && performance.now() - start + (this.genCostMs ?? 3) > budgetMs) break;
      const { cx, cz } = this.genQueue[i++];
      if (this.world.hasChunk(cx, cz)) continue;
      const t = performance.now();
      this.remeshQueue.add(this.world.getChunk(cx, cz));
      this.genCostMs = ease(this.genCostMs, performance.now() - t);
      made++;
    }
    this.genQueue.splice(0, i);
  }

  /**
   * Keeps the horizon a long way off.
   *
   * Real chunks stop at the render distance; past that stands FarTerrain, a
   * coarse terraced copy of the same ground sampled from the generator. It's
   * world-fixed tiles made a few at a time as you travel, and it only draws
   * where no real chunk is drawn (see updateChunkVisibility, which hands it
   * the mask) — so the two never overlap and nothing jumps as you move.
   */
  updateFarTerrain() {
    if (!this.farTerrain) return;
    if (!this.world?.endless) { this.farTerrain.setVisible(false); return; }
    this.farTerrain.setVisible(true);
    const { x, z } = this.player.position;
    this.farTerrain.update(this.world.gen, x, z);
  }

  /**
   * Spends a slice of the frame on pending rebuilds, then stops.
   *
   * In an endless world a chunk waits until its four neighbours exist:
   * meshing reads across its edges, and a missing neighbour would be
   * generated on the spot, inside the mesh budget, as a stall nobody
   * scheduled. generateQueued always makes one ring past what is drawn, so
   * the wait is a frame or two.
   */
  drainRemeshQueue(budgetMs = 6) {
    if (!this.remeshQueue.size) return;
    // A long queue means you are walking into new country, and the ground
    // ahead matters more than a couple of frames of headroom.
    if (this.remeshQueue.size > 60) budgetMs = 9;
    const start = performance.now();
    const w = this.world;
    let built = 0;
    for (const chunk of this.remeshQueue) {
      // Stop before one that would run past the budget, not after it has:
      // a rebuild is several milliseconds, and starting one at 5.9 of 6 is a
      // dropped frame. Always at least one a frame, so the queue can't stall.
      if (built && performance.now() - start + (this.meshCostMs ?? 6) > budgetMs) break;
      if (w.endless && !(w.hasChunk(chunk.cx - 1, chunk.cz) && w.hasChunk(chunk.cx + 1, chunk.cz)
        && w.hasChunk(chunk.cx, chunk.cz - 1) && w.hasChunk(chunk.cx, chunk.cz + 1))) continue;
      this.remeshQueue.delete(chunk);
      const t = performance.now();
      this.mesher.rebuild(w, chunk);
      this.meshCostMs = ease(this.meshCostMs, performance.now() - t);
      built++;
    }
  }

  // ---- loop ----

  /**
   * Applies a change from the graphics menu without restarting the world.
   *
   * Antialiasing is fixed when the WebGL context is created, so that one alone
   * needs a reload — the menu says so rather than appearing to do nothing.
   */
  applyGraphics(next) {
    const needsReload = next.antialias !== this.graphics.antialias;
    this.graphics = { ...this.graphics, ...next };
    saveSettings(this.graphics);

    const pinned = this.graphics.smoothing && this.graphics.resolution === 'auto'
      ? null
      : (this.graphics.resolution === 'auto' ? this.quality.resolution : this.graphics.resolution);
    this.renderer.setPixelRatio(this.quality.pin(pinned));

    const chosen = DISTANCES[this.graphics.distance];
    const blocksTo = chosen ? chosen.fogFar : (this.coarse ? BLOCKS_TO_COARSE : BLOCKS_TO);
    this.horizon = this.coarse ? HORIZON_COARSE : HORIZON;
    this.scene.fog.near = this.horizon * 0.35;
    this.scene.fog.far = this.horizon;
    this.renderDistance = blocksTo + CULL_MARGIN;
    // Far enough to contain the coarse ground, not just the blocks.
    this.camera.far = this.horizon + 200;
    this.onResize();
    return { needsReload };
  }

  /**
   * What the game is doing right now.
   *
   *   home     the worlds screen is up; there is a world behind it but nobody
   *            has said they want to be in it yet
   *   paused   a panel is open over the world
   *   playing  you are in it
   *
   * One question with one answer, asked by everything that should only happen
   * while you are actually playing. Without it the world simply ran: the player
   * fell off whatever they were standing on while you read the worlds list, and
   * hunger drained behind an open menu.
   */
  get phase() {
    if (!this.ui) return 'home';
    if (this.ui.isHomeOpen()) return 'home';
    if (this.ui.isAnyPanelOpen()) return 'paused';
    return 'playing';
  }

  get isPlaying() {
    return this.phase === 'playing';
  }

  /**
   * Applies what the phase means, once, whenever it changes.
   *
   * Pointer lock used to be released by hand at each place that opened
   * something — four keyboard shortcuts remembered to, everything else did
   * not. So a panel opened from the toolbar left the mouse still captured by
   * the world: moving it turned the camera behind the panel, and Escape went
   * to the browser to release the lock instead of closing the panel, which is
   * why some panels closed on Escape and some did not.
   *
   * Reading the phase off the UI every frame means no opener has to remember
   * anything. Whoever puts something in front of you, by whatever route,
   * the lock goes.
   */
  syncPhase() {
    const phase = this.phase;
    if (phase === this.lastPhase) return;
    this.lastPhase = phase;
    if (phase !== 'playing') {
      document.exitPointerLock?.();
      this.player.releaseKeys();
      this.setBreaking(false);
      this.setPlacing(false);
      this.digTarget = null;
      this.ui?.setBuildingHint(null);
      if (this.moving) this.endMove();
    }
    this.bus?.emit('game:phase', { phase });
  }

  tick() {
    // Always read the clock, even when nothing will use it: skipping it lets
    // the gap pile up, and the first frame after a pause would move the player
    // by however long they spent reading a menu. The cap covers the same thing
    // for a stalled tab — a single frame should never teleport anyone.
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.syncPhase();
    const playing = this.isPlaying;
    this.syncMobs();

    if (playing) {
      this.quality.tick(dt);
      const wasAt = { x: this.player.position.x, z: this.player.position.z };
      const wasSwimming = this.player.swimming;
      this.player.update(dt);
      this.stepSounds(wasAt, wasSwimming);
      if (this.duilt) {
        this.duilt.tick(dt, { resting: this.restingAtHome(wasAt) });
        this.feelHurt(dt);
        this.player.speedScale = this.duilt.hunger.speedFactor * this.duilt.skills.moveSpeed();
      }
      this.updateHover();
      this.lights.update(this.world, this.player.position, { enabled: this.graphics.lights !== false });
      this.settlerView.update(this.duilt?.settlers.people ?? []);
      this.mobs.tick(dt, this.player.position, { lure: LURES.has(this.selectedItemId) });
      this.tamePens();
      this.wanderers.tick(dt, this.player.position);
      this.tickCatapult(dt);
      this.runWater(dt);
      this.growCrops(dt);
      this.tickBreaking(performance.now());
      this.tickPlacing(performance.now());
      this.gamification.tick(performance.now());
      if (performance.now() - this.lastAutosave > AUTOSAVE_INTERVAL_MS) this.saveNow();
    }

    if (!playing) this.player.releaseKeys();

    // These run regardless: the world should finish drawing itself behind the
    // worlds screen rather than streaming in after you arrive.
    this.streamChunks();
    this.generateQueued();
    this.drainRemeshQueue();
    this.updateChunkVisibility();
    this.updateFarTerrain();
    this.updateClouds(dt);
    // The clock only runs while you're playing; a menu is a pause.
    if (playing) this.dayCycle.advance(dt);
    if (this.duilt) this.duilt.dayTime = this.dayCycle.time;
    this.dayCycle.apply(this.camera, this.horizon);
    this.updateMinimap();
    this.mobView.update(this.mobs?.list ?? []);
    this.wanderView.update(this.wanderers?.list ?? []);
    this.projectileView.update(this.projectiles?.list ?? []);
    this.renderer.render(this.scene, this.camera);
  }

  /** Footsteps on whatever is underfoot, and a splash on going into water. */
  stepSounds(wasAt, wasSwimming) {
    const p = this.player;
    if (p.swimming && !wasSwimming) this.sound.splash();
    if (p.flying || !p.grounded || p.swimming) return;
    const moved = Math.hypot(p.position.x - wasAt.x, p.position.z - wasAt.z);
    if (moved < 1e-4) return;
    const under = this.world.getBlock(Math.floor(p.position.x), Math.floor(p.position.y - 0.05), Math.floor(p.position.z));
    this.sound.walk(moved, soundOf(BLOCKS_BY_ID.get(under)));
  }

  /**
   * Applies a change from the controls settings: keys, field of view, mouse
   * speed and volume, remembered in this browser (config/controls.js).
   */
  applyControls(next) {
    this.controls = { ...this.controls, ...next };
    saveControls(this.controls);
    if (this.player) this.player.binds = { ...this.controls.keys };
    this.camera.fov = this.controls.fov;
    this.camera.updateProjectionMatrix();
    this.sound.setVolume(this.controls.volume);
    this.ui?.applyTouchLayout(this.controls);
    return this.controls;
  }

  /**
   * The wild animals belong to whichever world is loaded, and start over with
   * each new one — they aren't saved (see world/Mobs.js). None spawn inside
   * your own land in Duilt, so a herd never appears in the middle of the
   * settlement; they're free to wander in on their own.
   */
  /** Advances running water a step at a time, and redraws what it reached. */
  runWater(dt) {
    let changed = false;
    for (const [flow, clock, every] of [[this.water, 'waterClock', WATER_STEP_SECONDS], [this.lava, 'lavaClock', LAVA_STEP_SECONDS]]) {
      if (!flow?.busy) continue;
      this[clock] = (this[clock] ?? 0) + dt;
      if (this[clock] < every) continue;
      this[clock] = 0;
      if (flow.step()) changed = true;
    }
    if (changed) {
      this.remeshDirty();
      this.editedAt = Date.now();
    }
  }

  syncMobs() {
    if (!this.world) return;
    if (this.water?.world !== this.world) {
      this.water = new WaterFlow(this.world);
      this.lava = new LavaFlow(this.world);
      // Each wakes the other where it changes, so running lava meeting
      // water sets hard whichever of them arrived second.
      this.water.onChange = (x, y, z) => this.lava.touch(x, y, z);
      this.lava.onChange = (x, y, z) => this.water.touch(x, y, z);
    }
    if (this.mobs?.world !== this.world) {
      this.mobs = new Mobs({
        world: this.world,
        avoid: (x, z) => !!(this.duilt && !this.duilt.sandbox && this.duilt.territory.contains(x, z)),
      });
      this.mobsHerdOf = null;
    }
    if (this.projectiles?.world !== this.world) {
      this.projectiles = new Projectiles({ world: this.world, onImpact: (s, landed) => this.stoneLands(landed) });
      this.manning = null;
      this.projectileView.setAim(null);
    }
    if (this.wanderers?.world !== this.world) {
      this.wanderers = new Wanderers({
        world: this.world,
        // A messenger comes to your settlement, so only where you have one.
        home: () => (this.duilt && !this.duilt.sandbox ? { x: this.world.centreX, z: this.world.centreZ } : null),
        onNews: (p, line) => this.ui.toast({ kind: 'challenge', title: `${p.name}, a messenger`, body: line }),
        // Bandits (Phase 6b): hostile from Age 2, never in Creative.
        hostile: () => !!(this.duilt && !this.duilt.sandbox && this.duilt.age >= 2),
        night: () => daylightAt(this.dayCycle.time).day < 0.3,
        stores: () => (this.duilt && !this.duilt.sandbox ? this.duilt.structures.stores() : [])
          .filter(({ store }) => store.heldIds().length)
          .map(({ structure }) => ({ structure, region: structure.region })),
        onAttack: (p, hits) => this.banditHits(p, hits),
        onSteal: (p, structure) => this.banditSteals(p, structure),
        onRaid: (dir, raiders) => this.ui.toast({
          kind: 'challenge',
          title: 'Bandits on the road',
          body: `${raiders.length} of them, coming in from the ${dir}. Guard your storehouses.`,
        }),
      });
    }
    // Your penned animals come back with the save, and join the wild ones.
    if (this.duilt && this.mobsHerdOf !== this.duilt) {
      this.mobs.adopt(this.duilt.herd);
      this.mobsHerdOf = this.duilt;
    }
  }

  /**
   * Any farm animal standing inside a claimed pen becomes yours — whether
   * you led it in or it was there when you claimed the fence round it.
   */
  tamePens() {
    if (!this.duilt || !this.mobs) return;
    const now = performance.now();
    if (now - (this.lastTameAt ?? 0) < TAME_EVERY_MS) return;
    this.lastTameAt = now;
    const pens = this.duilt.structures.list().filter((s) => s.type === 'pen' && s.valid);
    if (!pens.length) return;
    const taken = tameInto(pens, this.mobs.list, this.duilt.herd);
    if (!taken.length) return;
    const kinds = [...new Set(taken.map((m) => MOBS_BY_ID.get(m.type).name.toLowerCase()))];
    this.ui.toast({
      kind: 'challenge',
      title: taken.length === 1 ? `The ${kinds[0]} is yours now` : `${taken.length} animals are yours now`,
      body: 'Kept in the pen — it makes something for every one of them',
    });
    this.editedAt = Date.now();
  }

  updateClouds(dt) {
    if (!this.clouds || !this.player) return;
    const { x, z } = this.player.position;
    this.clouds.update(dt, x, z);
  }

  updateMinimap() {
    if (!this.ui?.minimap || !this.world?.gen) return;
    const now = performance.now();
    if (this.lastMinimapAt && now - this.lastMinimapAt < MINIMAP_INTERVAL_MS) return;
    this.lastMinimapAt = now;
    this.ui.updateMinimap(this.world.gen, this.player.position.x, this.player.position.z, this.player.yaw);
  }

  updateHover() {
    const hit = this.raycast();
    this.hoverHit = hit;
    // Requested directly: "when looking at the door the controls should
    // adapt so place should be open or close depending on the door stage."
    // Pointed at a door or a gate with nothing queued, Place says which it
    // will do.
    // Manning a catapult the crosshair is for aiming, and the line under it
    // says how the throw is set — see tickCatapult.
    if (this.manning) {
      this.hoverBox.visible = false;
      this.ui?.setBuildingHint(this.manning.hint ?? 'Catapult', { manage: false });
      return;
    }
    this.ui?.setAimedSwing(!this.armed && !this.moving && hit ? swingLabel(hit.block) : null);

    // A building in the air follows where you look. Done here rather than on
    // a timer so it tracks the camera exactly, with no lag behind the view.
    // updateMove owns the crosshair hint while you are carrying something —
    // clearing it here as well hid the line the same frame it was written.
    // The block outline goes: you are choosing where a building lands, not
    // which block to hit, and a stale white box left over from before you
    // picked it up is just noise on top of the ghost.
    if (this.moving) {
      this.hoverBox.visible = false;
      this.updateMove();
      return;
    }

    // Say what you are pointing at before you swing at it, not after it has
    // refused. A settler takes precedence over the ground behind them: if
    // somebody is standing between you and a wall, they are what you are
    // looking at.
    const person = this.duilt
      ? this.settlerView.pick(this.duilt.settlers.people, this.player.eyePosition(), this.player.lookDirection())
      : null;
    if (person) {
      const work = this.duilt.structures.list().find((s) => s.id === person.workId);
      const job = work ? STRUCTURES_BY_ID.get(work.type)?.name?.toLowerCase() : null;
      this.ui?.setPersonHint(person.name, job ? `works the ${job}` : 'looking for work');
      return;
    }
    // Somebody from out in the world — the hermit, a bandit, a traveller.
    const stranger = this.wanderers
      ? this.wanderView.pick(this.wanderers.list, this.player.eyePosition(), this.player.lookDirection())
      : null;
    if (stranger) {
      const spec = WANDERERS[stranger.kind];
      const fights = spec.hp && (stranger.angry || this.wanderers.hostile());
      this.ui?.setPersonHint(stranger.name, !fights ? spec.about
        : stranger.hp <= spec.fleeBelow ? 'a bandit — running for it'
          : stranger.hp < spec.hp ? 'a bandit — hurt, keep at it'
            : stranger.raider ? 'a bandit, raiding — hit to fight' : spec.aboutHostile);
      return;
    }
    // Same for an animal — named before you swing, and no block outline
    // behind it saying the swing will land on the ground.
    const mob = this.armed ? null : this.mobTarget(hit);
    if (mob) {
      const spec = MOBS_BY_ID.get(mob.type);
      this.hoverBox.visible = false;
      this.ui?.setPersonHint(spec.name, mob.hp < spec.hp ? 'hurt — keep at it'
        : mob.penId ? 'yours — kept in the pen'
          : spec.farm && this.duilt ? 'hold vegetables or seeds to lead it' : 'hit to hunt');
      return;
    }

    const onBuilding = hit && this.duilt
      ? this.duilt.structures.at(hit.x, hit.y, hit.z)
      : null;
    const waiting = hit && !onBuilding && this.duilt ? this.duilt.waitingAt(hit.x, hit.y, hit.z) : null;
    const gate = hit && GATE_SWING[hit.block];
    const door = hit && doorPart(hit.block);
    const chest = hit && isChest(hit.block);
    const catapult = hit && isCatapult(hit.block);
    const trapdoor = hit && isTrapdoor(hit.block);
    // Says the button you'd actually press: the Open/Close thumb button, or
    // right click at a desk.
    const swing = (gate || door || chest || catapult || trapdoor) && swingLabel(hit.block);
    const how = swing && (this.ui?.isTouch ? `tap ${swing}` : `right click to ${swing.toLowerCase()}`);
    this.ui?.setBuildingHint(gate
      ? `Gate · ${hit.block === GATE_SHUT ? 'shut' : 'open'} — ${how}`
      : door
        ? `Door · ${door.open ? 'open' : 'shut'} — ${how}`
      : chest
        ? `${this.duilt?.chestAt(hit.x, hit.y, hit.z, { create: false })?.grave ? 'What you were carrying' : 'Chest'} — ${how}`
      : catapult
        ? `Catapult — ${how}`
      : trapdoor
        ? `Trapdoor · ${hit.block >= TRAPDOOR_OPEN ? 'open' : 'shut'} — ${how}`
      : onBuilding
        ? (STRUCTURES_BY_ID.get(onBuilding.type)?.name ?? 'Building')
          + (onBuilding.locked === false ? ' · unlocked' : '')
      : waiting
        ? `${STRUCTURES_BY_ID.get(waiting.type)?.name ?? 'Building'} · not working yet — ${waiting.reason}`
        : null, { manage: waiting ? 'see why' : (!swing || !!onBuilding) });
    // The single block under the crosshair, except while a roof is queued —
    // there the whole building is highlighted and one more box on top of it is
    // just noise.
    if (hit && !this.pendingRoof && !this.pendingClear) {
      this.hoverBox.visible = true;
      this.hoverBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.hoverBox.visible = false;
    }

    // Working out which build you mean is a flood fill, so it only happens when
    // something is going to use the answer.
    if (this.pendingClaim) {
      this.updateClaimPreview();
      return;
    }
    if (this.pendingClaimColumn) {
      this.updateClaimColumnPreview();
      return;
    }
    if (this.pendingClear) {
      const cells = this.clearTarget();
      this.updateRoofPreview(null);
      this.updateClearPreview(cells);
      this.ui.setToolReadout({
        clear: this.pendingClear.name,
        onBuild: !!cells?.length,
        blocks: cells?.length ?? 0,
      });
    } else if (this.pendingRoof) {
      const pick = this.roofTarget();
      this.updateRoofPreview(pick);
      // The ghost shows the roof; this shows the building it decided on, which
      // is the other half of the question — did it find the whole house, or
      // just the wing you happened to be pointing at?
      if (pick) {
        const course = [...pick.walls].map((k) => {
          const c = k.indexOf(',');
          return { x: Number(k.slice(0, c)), y: pick.y, z: Number(k.slice(c + 1)) };
        });
        this.selection.update(
          { ...pick.bounds, minY: pick.y, maxY: pick.y },
          course, this.world, { force: this.selectionDirty },
        );
        this.selectionDirty = false;
      } else this.selection.hide();
      this.ui.setToolReadout({
        roof: this.pendingRoof.name,
        facing: facingLabel(this.pendingRoof, this.roofTurn),
        onBuild: !!pick,
        blocks: pick ? pick.foot.size : 0,
      });
    } else if (this.pendingTemplate) {
      this.updateRoofPreview(null);
      this.selection.hide();
      this.ui.setToolReadout({ template: this.pendingTemplate.name, onBuild: !!hit });
    } else {
      this.updateRoofPreview(null);
      this.selection.hide();
      this.ui.setToolReadout(null);
    }
  }

  onResize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    // And move the crosshair to wherever the canvas's middle now is. It used
    // to sit at 50% of a sibling element and simply assume the two boxes were
    // the same; on a phone browser whose toolbars grow and shrink the page
    // under you, that assumption is how you end up aiming at one block and
    // hitting the one below it.
    this.ui?.placeCrosshair(this.renderer.domElement);
  }
}

/** A running average of how long something takes, leaning on the recent. */
function ease(avg, sample) {
  return avg == null ? sample : avg * 0.8 + sample * 0.2;
}

/** A chunk's coordinates as one number, for a Set. */
function chunkId(cx, cz) {
  return (cx + 32768) * 65536 + (cz + 32768);
}

function distSq(chunk, px, pz) {
  const dx = chunk.cx - px, dz = chunk.cz - pz;
  return dx * dx + dz * dz;
}

function newWorldId() {
  return crypto.randomUUID();
}
