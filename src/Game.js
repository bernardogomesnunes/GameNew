import * as THREE from 'three';
import { World, CHUNK_SIZE } from './world/World.js';
import { generateTerrain } from './world/TerrainGenerator.js';
import { ChunkMesher } from './world/ChunkMesher.js';
import { PlayerController } from './player/PlayerController.js';
import { castVoxelRay } from './interaction/VoxelRaycast.js';
import { UndoRedo } from './tools/UndoRedo.js';
import { SelectorTool, buildTemplatePlacement, rotateTemplate } from './tools/SelectorTool.js';
import { roofPlan, roofBlocks, roofBase, roofPeak } from './tools/RoofTool.js';
import { ROOFS_BY_ID, facingLabel } from './config/roofs.js';
import { SelectionHighlight } from './tools/SelectionHighlight.js';
import { BuildGhost } from './tools/BuildGhost.js';
import { SettlerView } from './render/SettlerView.js';
import { CloudAuth } from './net/CloudAuth.js';
import { CloudWorlds } from './net/CloudWorlds.js';
import { isCloudConfigured } from './net/cloudConfig.js';
import { DuiltGame } from './duilt/DuiltGame.js';
import { generateEndlessWorld } from './world/StarterWorld.js';
import { ChunkGen } from './world/ChunkGen.js';
import { FarTerrain } from './render/FarTerrain.js';
import { TemplateLibrary } from './prefabs/TemplateLibrary.js';
import { SymmetryTool } from './tools/SymmetryTool.js';
import { GamificationEngine } from './gamification/GamificationEngine.js';
import { SaveManager, AUTOSAVE_NAME } from './storage/SaveManager.js';
import { loadSettings, saveSettings, QualityController, DISTANCES } from './render/graphics.js';
import { isTyping } from './ui/Panels.js';
import { panelForKey } from './config/panels.js';
import { STRUCTURES_BY_ID } from './config/structures.js';
import { DESIGN_FOR_STRUCTURE } from './config/starterDesigns.js';
import { exportWorldFile, exportVoxFile, parseWorldPayload, pickFile } from './storage/WorldExport.js';
import { UIManager } from './ui/UIManager.js';
import { EventBus } from './core/EventBus.js';
import { EconomyEngine } from './economy/EconomyEngine.js';
import { AIR, BLOCKS_BY_ID } from './config/blocks.js';

const REACH = 7;
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
// Holding down to keep breaking. The first pause is longer than the rest so a
// normal click stays a single block — hold past it and it becomes a stream.
const HOLD_BREAK_DELAY_MS = 320;
const HOLD_BREAK_INTERVAL_MS = 170;
export const CREATIVE = 'creative';
export const DUILT = 'duilt';

export class Game {
  constructor(container) {
    this.container = container;
    this.bus = new EventBus();
    this.saveManager = new SaveManager();

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
    this.scene.background = new THREE.Color(0x8fd0ff);
    const chosen = DISTANCES[this.graphics.distance];
    const blocksTo = chosen ? chosen.fogFar : (coarse ? BLOCKS_TO_COARSE : BLOCKS_TO);
    this.horizon = coarse ? HORIZON_COARSE : HORIZON;
    // Fog starts well out and finishes at the horizon, so the coarse ground is
    // hazed rather than hidden — it is what sells the distance as distance.
    this.scene.fog = new THREE.Fog(0x8fd0ff, this.horizon * 0.35, this.horizon);
    this.renderDistance = blocksTo + CULL_MARGIN;

    // The near plane sets how much depth precision the whole scene gets, and
    // phones commonly hand out a 16-bit depth buffer. At 0.1 with a far plane
    // of 300 there was not enough precision left for distant surfaces to agree
    // on which is in front, so they traded places as the camera moved. Nothing
    // in a voxel world is ever closer than a fraction of a block, so 0.2 costs
    // nothing to look at and doubles the precision everywhere.
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.2, this.horizon + 200);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xfff3d6, 0.85);
    sun.position.set(60, 90, 30);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbfe3f0, 0x3a2f22, 0.4));

    this.mesher = new ChunkMesher(this.scene);
    this.farTerrain = new FarTerrain(this.scene);
    this.gamification = new GamificationEngine(this.bus);
    this.economy = new EconomyEngine(this.bus);
    this.undoRedo = new UndoRedo();
    // Duilt is the game. Creative is the sandbox this grew out of and is
    // still there on purpose, but arriving in it meant a
    // first-time player landed in a world with no bag, no land and no goals,
    // and the game itself was three taps deep behind a menu and a browser
    // confirm box. A save always sets its own mode, so this only decides where
    // someone with nothing saved begins.
    this.mode = DUILT;

    this.selectedBlockId = 1;
    this.pointerLocked = false;
    // Held-to-break: when it started and when it last fired. Driven from the
    // frame loop rather than a timer, so it stops on its own the moment the
    // game stops playing — a panel opening mid-swing does not leave a timer
    // chewing through your land behind it.
    this.breaking = false;
    this.breakHeldSince = 0;
    this.lastBreakAt = 0;
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
    this.moving = null;   // the building currently in the air

    this.boot();
    window.addEventListener('resize', () => this.onResize());
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
    const autosave = this.saveManager.load(AUTOSAVE_NAME);
    if (autosave) {
      this.loadFromData(autosave, { silent: true });
    } else {
      this.newWorld({ silent: true });
    }

    this.symmetryTool = new SymmetryTool(this.world);
    this.selectorTool = new SelectorTool();
    // A stable id per world, so incremental sync can tell "the world I already
    // uploaded, edited" from "a different world with the same name".
    this.worldId = this.worldId || newWorldId();
    this.worldName = this.worldName || 'My world';
    this.cloudAuth = new CloudAuth(this.bus);
    this.cloud = isCloudConfigured() ? new CloudWorlds({ auth: this.cloudAuth, bus: this.bus }) : null;
    this.templates = new TemplateLibrary(this.bus);
    this.pendingTemplate = null; // the template queued for stamping
    this.templateRotation = 0;
    this.pendingRoof = null;     // the roof shape queued, if any
    this.roofTurn = 0;
    this.roofKey = null;         // what the preview was last built for
    this.lastRoof = null;        // the roof this tool put up, while it is untouched
    this.roofGhost = new BuildGhost(this.scene);

    this.ui = new UIManager(this.uiRoot, {
      bus: this.bus,
      game: this,
      saveManager: this.saveManager,
      callbacks: this.buildCallbacks(),
    });
    this.ui.refreshForMode();

    // The land grows when an age is finished, and the wall has to grow with it.
    this.bus.on('territory:expanded', () => this.applyTerritoryBounds());

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
    const save = () => this.autosaveNow();
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
    this.saveManager.delete(AUTOSAVE_NAME);
    this.discarded = true;
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
    if (save) this.autosaveNow();
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
  restoreVersion(index) {
    const data = this.saveManager.loadSnapshot(this.worldId, index);
    if (!data) return false;
    this.loadFromData(data);
    // The state you were in when you went back is itself worth keeping, so
    // the next autosave records it rather than the version you restored.
    this.autosaveNow();
    return true;
  }

  /** Writes the autosave straight away, and resets the interval clock with it. */
  autosaveNow() {
    if (this.discarded) return false;
    try {
      this.saveManager.autosave(this.saveState());
      this.lastAutosave = performance.now();
      return true;
    } catch {
      return false;
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
      onSelectSlot: (id) => { this.selectedBlockId = id; },
      onSave: (name) => {
        this.saveManager.save(name, this.saveState());
        this.ui.toast({ kind: 'challenge', title: 'World saved', body: name });
      },
      onLoad: (name) => {
        const data = this.saveManager.load(name);
        if (data) this.loadFromData(data);
        this.ui.closePanel('panel-menu');
      },
      onDeleteSave: (name) => this.saveManager.delete(name),
      onDeleteCurrent: () => this.discardCurrentWorld(),
      onLeaveWorld: (save) => this.leaveWorld(save),
      listVersions: () => this.saveManager.history(this.worldId),
      onRestoreVersion: (index) => this.restoreVersion(index),
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
          this.loadFromData(data);
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
      onRenameWorld: (name) => { this.worldName = name; this.autosaveNow(); },
      onLoadAutosave: () => {
        const data = this.saveManager.load(AUTOSAVE_NAME);
        if (data) this.loadFromData(data, { silent: true });
      },
      onResume: () => {
        this.ui.closePanel('panel-menu');
        if (document.body.classList.contains('touch')) this.ui.hideBlocker();
        else this.requestPointerLock();
      },
      onOpenMenu: () => { this.ui.refreshSaveList(); this.ui.openPanel('panel-menu'); document.exitPointerLock?.(); },
      onToggleFly: () => { this.player.toggleFly(); this.ui.setFlyIndicator(this.player.flying); return this.player.flying; },
      onUndo: () => this.doUndo(),
      onRedo: () => this.doRedo(),
      onToggleSelection: () => {
        const active = this.selectorTool.toggle();
        if (!active) this.clearPending();
        return active;
      },
      onCycleSelectorSize: () => this.selectorTool.cycleSize(),
      onSaveTemplate: (name) => this.saveTemplate(name),
      onPickTemplate: (id) => {
        this.clearPending();
        this.pendingTemplate = this.templates.get(id);
        this.templateRotation = 0;
        if (this.pendingTemplate) {
          this.selectorTool.active = true;
          this.ui.toast({ kind: 'challenge', title: `Ready: ${this.pendingTemplate.name}`, body: 'Aim and place it' });
        }
        return !!this.pendingTemplate;
      },
      onPickRoof: (id) => {
        this.clearPending();
        this.pendingRoof = ROOFS_BY_ID.get(id) ?? null;
        this.roofTurn = 0;
        if (this.pendingRoof) {
          this.selectorTool.active = true;
          this.ui.toast({
            kind: 'challenge',
            title: `Ready: ${this.pendingRoof.name} roof`,
            body: this.pendingRoof.turns > 1
              ? 'Frame the top of your walls · R turns it'
              : 'Frame the top of your walls',
          });
        }
        return !!this.pendingRoof;
      },
      onRotateRoof: () => this.turnRoof(),
      onPlaceRoof: () => this.stampRoof(),
      onDeleteTemplate: (id) => this.templates.delete(id),
      onRotateTemplate: () => { this.templateRotation = (this.templateRotation + 1) % 4; return this.templateRotation; },
      onPlaceTemplate: () => this.stampTemplate(),
      getTemplates: () => this.templates.list(),
      getSelectorSize: () => this.selectorTool.size,
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
      // Touch goes through the same two verbs as mouse buttons, so the
      // selector behaves identically on a phone.
      isCloudConfigured: () => !!this.cloud,
      getCloudUser: () => this.cloudAuth.summary(),
      onCloudRestoreSession: () => this.cloudAuth.restore(),
      onCloudSignIn: async (email, password) => {
        await this.cloudAuth.signIn(email, password);
        this.ui.toast({ kind: 'challenge', title: 'Signed in', body: 'Your worlds can now sync' });
      },
      onCloudSignUp: async (email, password) => {
        await this.cloudAuth.signUp(email, password);
        this.ui.toast({ kind: 'challenge', title: 'Account created', body: 'Save a world to start syncing' });
      },
      onCloudSignOut: async () => {
        await this.cloudAuth.signOut();
        this.ui.toast({ kind: 'xp', title: 'Signed out', body: 'Local saves are untouched' });
      },
      getCloudWorlds: () => this.cloud.list(),
      onCloudSave: (name) => this.saveToCloud(name),
      onCloudRestore: (id) => this.restoreFromCloud(id),
      onCloudDelete: async (id) => {
        await this.cloud.delete(id);
        this.ui.toast({ kind: 'xp', title: 'Deleted from the cloud', body: 'Your local copy is still here' });
      },

      onBreakTap: () => this.primaryAction(),
      onBreakHold: (held) => this.setBreaking(held),
      onPlaceTap: () => this.secondaryAction(),

      // ---- duilt ----
      isDuilt: () => !!this.duilt,
      onOpenBag: () => this.ui.toggleBag(),
      onOpenClaim: () => this.openClaim(),
      onClaimType: (id) => this.claimAs(id),
      onStampStarter: (id) => this.stampStarter(id),
      onOpenBuildings: () => this.ui.openPanel('panel-buildings'),
      onOpenBench: () => this.ui.openPanel('panel-bench'),
    };
  }

  saveState() {
    return {
      world: this.world,
      player: this.player,
      gamification: this.gamification,
      economy: this.economy,
      mode: this.mode,
      worldId: this.worldId,
      worldName: this.worldName,
      duilt: this.duilt ? this.duilt.toJSON() : null,
    };
  }

  /**
   * Fences the player into the land they have claimed.
   *
   * Only Duilt has a border; the sandbox modes get the whole world, so the
   * bounds are cleared rather than left over from a previous world.
   */
  applyTerritoryBounds() {
    if (!this.player) return;
    this.player.setBounds(this.duilt ? this.duilt.territory.bounds() : null);
  }

  /** Duilt owns scene objects (the border), so swapping worlds must clean up. */
  disposeDuilt() {
    if (!this.duilt) return;
    this.duilt.territory.dispose();
    this.duilt = null;
  }

  newWorld({ silent, mode = this.mode, name } = {}) {
    this.mode = mode;
    // Deliberately making a world un-discards: saving is on again.
    this.discarded = false;
    this.worldId = newWorldId();
    this.worldName = name || (mode === DUILT ? 'My settlement' : 'Creative world');

    this.disposeDuilt();
    let spawn = null;
    if (mode === DUILT) {
      // No size: the land is made as you walk into it, and the settlement sits
      // at the origin. The border is what limits you, not the edge of a map.
      const built = generateEndlessWorld({ height: 64 });
      this.world = built.world;
      spawn = built.origin.spawn;
    } else {
      this.world = new World({ sizeX: 64, sizeZ: 64, height: 64 });
      generateTerrain(this.world);
    }
    if (this.player) this.player.dispose();
    this.player = new PlayerController(this.world, this.camera, spawn ?? this.findSafeSpawn());
    // Face the way the spawn picked: the open direction. Arriving on a good
    // open spot while looking at the one wall behind you is the same bad first
    // impression as arriving inside the hill.
    if (spawn?.yaw != null) this.player.yaw = spawn.yaw;
    if (spawn?.pitch != null) this.player.pitch = spawn.pitch;
    if (mode === DUILT) {
      this.duilt = new DuiltGame({ world: this.world, scene: this.scene, bus: this.bus });
      this.duilt.grantStartingKit();
    }
    // After the rules exist, not before: this reads the border off `duilt`,
    // and called a line earlier it only ever saw the world that came before.
    this.applyTerritoryBounds();
    this.gamification = new GamificationEngine(this.bus);
    this.economy = new EconomyEngine(this.bus);
    this.undoRedo = new UndoRedo();
    if (this.symmetryTool) this.symmetryTool = new SymmetryTool(this.world);
    this.rebuildAllChunks();
    this.bus.emit('economy:change', {});
    if (!silent) {
      this.ui.refreshForMode();
      // Write it out now: a brand new world is 60 seconds from its first
      // interval autosave, and a phone that gets put away in that window used
      // to lose the whole thing.
      this.autosaveNow();
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
    this.player.yaw = data.player.yaw || 0;
    this.player.pitch = data.player.pitch || 0;
    if (!this.gamification) this.gamification = new GamificationEngine(this.bus);
    this.gamification.loadJSON(data.gamification);
    this.economy = new EconomyEngine(this.bus);
    this.economy.loadJSON(data.economy);
    this.undoRedo = new UndoRedo();
    if (this.symmetryTool) this.symmetryTool = new SymmetryTool(this.world);
    if (this.mode === DUILT) {
      this.duilt = new DuiltGame({ world: this.world, scene: this.scene, bus: this.bus });
      const earned = this.duilt.loadJSON(data.duilt);
      if (earned && Object.keys(earned).length && this.ui) {
        const parts = Object.entries(earned).map(([id, n]) => `${n} ${id}`);
        setTimeout(() => this.ui.toast({
          kind: 'challenge', title: 'Your buildings kept working', body: parts.join(', '),
        }), 600);
      }
    }
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
    for (const mesh of this.mesher.activeMeshes) {
      const chunk = mesh.userData.chunk;
      if (!chunk) continue;
      const minX = chunk.cx * CHUNK_SIZE, minZ = chunk.cz * CHUNK_SIZE;
      const dx = Math.max(minX - px, 0, px - (minX + CHUNK_SIZE));
      const dz = Math.max(minZ - pz, 0, pz - (minZ + CHUNK_SIZE));
      mesh.visible = dx * dx + dz * dz <= maxSq;
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
      this.player.look(e.movementX * 0.0022, e.movementY * 0.0022);
    });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.pointerLocked) return;
      if (this.moving) {
        if (e.button === 0) this.dropMove();
        else if (e.button === 2) this.cancelMove();
        return;
      }
      if (e.button === 0) { this.primaryAction(); this.setBreaking(true); }
      else if (e.button === 2) this.secondaryAction();
    });
    // Every way the button can stop being down, including the ones that are not
    // a mouseup: releasing outside the canvas, tabbing away mid-hold, or the
    // browser taking the pointer back.
    for (const [target, event] of [[window, 'mouseup'], [window, 'blur'], [document, 'visibilitychange']]) {
      target.addEventListener(event, () => this.setBreaking(false));
    }

    window.addEventListener('keydown', (e) => {
      // Nothing in here is a shortcut while you are filling in a form. Typing an
      // email address used to open the workbench on "e" and the buildings panel
      // on "b", which on a phone buried the keyboard under a panel.
      if (isTyping(e)) return;

      if (e.code === 'Escape') {
        // Putting down what you are holding comes before putting away panels.
        if (this.moving) { this.cancelMove(); return; }
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
      const shortcut = this.phase === 'home' ? null : panelForKey(e.code);
      if (shortcut && (shortcut.mode !== 'duilt' || this.duilt)) {
        if (this.ui.isPanelOpen(shortcut.id)) this.ui.closePanel(shortcut.id);
        else if (shortcut.prepare === 'claim') this.openClaim();
        else this.ui.openPanel(shortcut.id);
        return;
      }

      // Everything below acts on the world, so it only applies while you are in
      // it. Escape, above, is the way out and always works.
      if (!this.isPlaying) return;
      if (/^Digit[1-9]$/.test(e.code)) this.ui.cycleHotbarByKey(Number(e.code.slice(5)));
      // B is the selector in a sandbox world, where there are no buildings.
      if (e.code === 'KeyB' && !this.duilt) this.ui.toggleSelector();
      // R turns whatever is queued. One key for both, because "turn the thing
      // before you put it down" is one idea however it got queued.
      if (e.code === 'KeyR' && this.pendingRoof) this.turnRoof();
      else if (e.code === 'KeyR' && this.pendingTemplate) {
        this.templateRotation = (this.templateRotation + 1) % 4;
        this.ui.toast({ kind: 'xp', title: `Rotated ${this.templateRotation * 90}\u00b0` });
      }
      if (e.code === 'KeyM') {
        const mode = this.symmetryTool.cycle();
        this.ui.toast({ kind: 'xp', title: `Symmetry: ${mode.toUpperCase()}` });
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) { e.preventDefault(); this.doUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) { e.preventDefault(); this.doRedo(); }
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
   * Only plain breaking repeats. With the selector on, the same button saves or
   * stamps a design, and holding it should not stamp forty copies.
   */
  setBreaking(on) {
    const want = on && !this.selectorTool.active && !this.moving;
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

  primaryAction() {
    if (this.moving) return void this.cancelMove();
    if (this.selectorTool.active) {
      if (this.pendingRoof) this.stampRoof();
      else if (this.pendingTemplate) this.stampTemplate();
      else this.ui.openTemplateSavePrompt();
      return;
    }
    this.breakBlock();
  }

  secondaryAction() {
    // Place puts down what you are holding, on a mouse and under a thumb
    // alike. Cancelling is Escape, or the Break button — which says "Cancel"
    // while you are carrying something, so there is nothing to guess.
    if (this.moving) return void this.dropMove();
    if (this.selectorTool.active) {
      // A roof with more than one way round takes this button, so a phone has
      // a way to turn it. See setSelectorReadout, which labels it to match.
      if (this.pendingRoof?.turns > 1) { this.turnRoof(); return; }
      this.selectorTool.cycleSize();
      this.ui.setSelectorSize(this.selectorTool.size);
      return;
    }
    this.placeBlock();
  }

  /** Captures whatever sits inside the selector box and stores it by name. */
  saveTemplate(name) {
    const captured = this.selectorTool.capture(this.world);
    if (!captured) {
      this.ui.toast({ kind: 'xp', title: 'Nothing to save', body: 'The selector is empty — aim it at your build' });
      return null;
    }
    const record = this.templates.save(name, captured);
    if (record) {
      this.gamification.onTemplateSaved(record);
      this.ui.toast({
        kind: 'challenge',
        title: `Saved "${record.name}"`,
        body: `${record.blockCount} blocks · ${record.size}x${record.size}x${record.size}`,
      });
    }
    return record;
  }

  /** Stamps the queued template at the selector, charged and undoable as one action. */
  stampTemplate() {
    if (!this.pendingTemplate) return false;
    const bounds = this.selectorTool.bounds();
    if (!bounds) return false;
    const oriented = rotateTemplate(this.pendingTemplate, this.templateRotation);
    const changes = buildTemplatePlacement(this.world, oriented, { x: bounds.minX, y: bounds.minY, z: bounds.minZ });
    if (!changes.length) {
      this.ui.toast({ kind: 'xp', title: 'Nothing to place', body: 'It already matches what is there' });
      return false;
    }
    if (!this.applyChanges(changes, { viaSymmetry: false })) return false;
    this.gamification.onTemplatePlaced(this.pendingTemplate);
    this.ui.toast({ kind: 'challenge', title: `Placed ${this.pendingTemplate.name}`, body: `${changes.length} blocks` });
    return true;
  }

  /** Nothing queued for the selector to put down. */
  clearPending() {
    this.pendingTemplate = null;
    this.pendingRoof = null;
    this.roofTurn = 0;
    this.roofGhost.hide();
    this.roofKey = null;
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
   * The roof this box already has, if the tool is the one that put it there.
   *
   * Placing a roof, seeing it face the wrong way, turning it and placing again
   * is the normal way this tool gets used, and without this it would leave two
   * roofs crossed over each other — the second sitting on the first, because
   * the first is now the highest thing in the box. So the last roof is
   * remembered, and only while every block of it is still where it was put: as
   * soon as you break into it, or undo it, or move the box, it is a different
   * question and the plain rule answers it.
   */
  roofRelay(bounds) {
    const last = this.lastRoof;
    if (!last) return null;
    if (last.minX !== bounds.minX || last.minZ !== bounds.minZ) return null;
    if (last.size !== this.selectorTool.size) return null;
    for (const c of last.cells) {
      if (this.world.getBlock(c.x, c.y, c.z) !== c.type) return null;
    }
    return last;
  }

  /** The height the eaves land on, relay included, so the preview matches. */
  roofEave(bounds) {
    return this.roofRelay(bounds)?.base ?? roofBase(this.world, bounds);
  }

  /**
   * Pitches the queued roof over the selector, out of the block you are
   * holding, as one undoable action paid for in one go.
   */
  stampRoof() {
    if (!this.pendingRoof) return false;
    const bounds = this.selectorTool.bounds();
    if (!bounds) return false;
    const type = this.selectedBlockId;
    const availability = this.blockAvailability(type);
    if (!availability.ok) {
      this.ui.toast({ kind: 'xp', title: 'Locked block', body: availability.reason });
      return false;
    }
    const relay = this.roofRelay(bounds);
    const base = relay?.base ?? roofBase(this.world, bounds);
    const shape = this.pendingRoof, turn = this.roofTurn;
    const changes = roofPlan(this.world, bounds, { shape, turn, type, base });

    const laid = roofBlocks(bounds, { shape, turn }).map((b) => ({
      x: bounds.minX + b.dx, y: base + b.dy, z: bounds.minZ + b.dz, type,
    }));
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
      this.ui.toast({ kind: 'xp', title: 'Nothing to roof', body: 'The box is empty, or that roof is already there' });
      return false;
    }
    if (!this.applyChanges(changes)) return false;
    this.lastRoof = { minX: bounds.minX, minZ: bounds.minZ, size: this.selectorTool.size, base, cells: laid };
    const made = BLOCKS_BY_ID.get(type)?.name ?? 'blocks';
    this.ui.toast({
      kind: 'challenge',
      title: `${this.pendingRoof.name} roof up`,
      body: `${changes.length} blocks of ${made.toLowerCase()}`,
    });
    return true;
  }

  /**
   * The roof you are about to place, in the air, before you place it.
   *
   * Orientation is the part a shape cannot get right on its own — the box is
   * square and gives it nothing to read the front of the building from. Seeing
   * the slope turn as you press R is the difference between that being a
   * guess and being a choice.
   *
   * Rebuilt only when it would look different, since the preview is a mesh and
   * the selector re-aims every frame.
   */
  updateRoofPreview(bounds) {
    if (!this.pendingRoof || !bounds) {
      if (this.roofKey !== null) { this.roofGhost.hide(); this.roofKey = null; }
      return;
    }
    const base = this.roofEave(bounds);
    const key = [this.pendingRoof.id, this.roofTurn, this.selectedBlockId,
      bounds.minX, bounds.minZ, base, this.selectorTool.size].join(':');
    if (key === this.roofKey) return;
    this.roofKey = key;
    const blocks = roofBlocks(bounds, { shape: this.pendingRoof, turn: this.roofTurn })
      .map((b) => ({ ...b, type: this.selectedBlockId }));
    this.roofGhost.show(blocks, {
      x: bounds.maxX - bounds.minX,
      y: roofPeak(blocks),
      z: bounds.maxZ - bounds.minZ,
    });
    this.roofGhost.moveTo({ x: bounds.minX, y: base, z: bounds.minZ });
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
        this.duilt.structures.setLocked(structure.id, structure.locked === false);
        this.ui.toast({
          kind: 'xp',
          title: structure.locked ? 'Finished changing' : 'Open for changes',
          body: structure.locked
            ? 'Protected again'
            : 'Break and place inside it — it is re-checked as you go',
        });
        // Redraw with the state it is in now, rather than the state it was in.
        this.ui.openBuilding(structure, this.buildingActions(structure));
      },
      onMove: () => this.beginMove(structure),
      onDelete: () => this.deleteBuilding(structure),
    };
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
    // not "what is this?" but "what do I want to do with it?". No selector
    // needed: you are already pointing at the whole building.
    const aimed = this.hoverHit && this.duilt.structures.at(this.hoverHit.x, this.hoverHit.y, this.hoverHit.z);
    if (aimed) {
      this.ui.openBuilding(aimed, this.buildingActions(aimed));
      return;
    }

    if (!this.selectorTool.active) {
      this.ui.toast({ kind: 'xp', title: 'Frame it first', body: 'Turn on Select and aim at what you built' });
      return;
    }
    const bounds = this.selectorTool.bounds();
    if (!bounds) return;
    const region = {
      minX: bounds.minX, maxX: bounds.maxX,
      minY: bounds.minY, maxY: bounds.maxY,
      minZ: bounds.minZ, maxZ: bounds.maxZ,
    };
    this.ui.openClaim(region, (typeId) => {
      const r = this.duilt.claim(region, typeId);
      this.ui.toast(r.ok
        ? { kind: 'challenge', title: r.reason, body: 'It will start producing shortly' }
        : { kind: 'xp', title: "That doesn't qualify yet", body: r.reason });
    });
  }

  /** Claims the framed region as a named building type. */
  claimAs(typeId) {
    if (!this.duilt || !this.selectorTool.active) {
      this.ui.toast({ kind: 'xp', title: 'Frame it first', body: 'Turn on Select and aim at what you built' });
      return;
    }
    const bounds = this.selectorTool.bounds();
    if (!bounds) return;
    const r = this.duilt.claim({ ...bounds }, typeId);
    this.ui.toast(r.ok
      ? { kind: 'challenge', title: r.reason, body: 'It will start producing shortly' }
      : { kind: 'xp', title: "That doesn't qualify yet", body: r.reason });
  }

  /**
   * Where a stamped building goes: the selector if you are using it, otherwise
   * the ground you are looking at.
   *
   * Requiring the selector was a dead end. The button in the buildings panel
   * says "place a starter", you press it, and it refuses and tells you to go
   * and turn on a different tool first — so the one-click route into the game
   * needed three clicks and some guesswork. Aiming is the normal way to put
   * something down, so that is the default now, and the selector is honoured
   * when it happens to be on.
   */
  stampAnchor(extent) {
    if (this.selectorTool.active) {
      const b = this.selectorTool.bounds();
      // The selector box is the frame you drew, so its corner is the corner.
      if (b) return { x: b.minX, y: b.minY, z: b.minZ };
    }
    const hit = this.raycast();
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
    this.ui.toast(claim.ok
      ? { kind: 'challenge', title: `${plan.design.name} placed`, body: claim.reason }
      : { kind: 'xp', title: 'Placed, but not claimed', body: claim.reason });
  }

  // ---- cloud ----

  /**
   * Pushes the current world under its own id, so repeated saves overwrite the
   * same cloud world instead of littering it with copies.
   */
  async saveToCloud(name) {
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
    });
    this.ui.toast({
      kind: 'challenge',
      title: 'Saved to the cloud',
      body: result.pushedChunks
        ? `${result.pushedChunks} of ${result.totalChunks} chunks changed`
        : 'Nothing had changed since the last save',
    });
    return result;
  }

  async restoreFromCloud(id) {
    if (!this.cloud) throw new Error('This build has no cloud configured.');
    const data = await this.cloud.restore(id);
    this.loadFromData({
      world: data.world,
      mode: data.mode,
      player: data.player,
      gamification: this.gamification.toJSON(),
      economy: data.economy,
      duilt: data.duilt,
      worldId: id,
      worldName: data.name,
    });
    // Progression belongs to the account, not the world, so it is merged in
    // separately — and only if the cloud copy is further along than this device.
    try {
      const remote = await this.cloud.progression();
      if (remote && (remote.xp ?? 0) > (this.gamification.toJSON().xp ?? 0)) {
        this.gamification.loadJSON({ ...this.gamification.toJSON(), ...remote });
        this.ui.updateXp();
      }
    } catch { /* the world is what matters; progression can wait for the next sign-in */ }
    this.ui.closePanel('panel-menu');
    this.ui.toast({ kind: 'challenge', title: `Restored "${data.name}"`, body: 'Pulled from the cloud' });
  }

  // ---- raycasting / block edits ----

  raycast() {
    const origin = this.player.eyePosition();
    const dir = this.player.lookDirection();
    return castVoxelRay(this.world, origin, dir, REACH);
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

  breakBlock() {
    const hit = this.raycast();
    if (!hit) return;
    const targets = this.computeTargets(hit.x, hit.y, hit.z);
    const changes = [];
    for (const t of targets) {
      const prev = this.world.getBlock(t.x, t.y, t.z);
      if (prev === AIR) continue;
      changes.push({ x: t.x, y: t.y, z: t.z, prev, next: AIR });
    }
    this.applyChanges(changes, { viaSymmetry: this.symmetryTool.mode !== 'off' });
  }

  placeBlock() {
    const hit = this.raycast();
    if (!hit) return;
    const type = this.selectedBlockId;
    const availability = this.blockAvailability(type);
    if (!availability.ok) {
      this.ui.toast({ kind: 'xp', title: 'Locked block', body: availability.reason });
      return;
    }
    const targets = this.computeTargets(hit.placeX, hit.placeY, hit.placeZ);
    const changes = [];
    for (const t of targets) {
      if (!this.world.inBounds(t.x, t.y, t.z)) continue;
      if (this.blockOverlapsPlayerAABB(t)) continue;
      const prev = this.world.getBlock(t.x, t.y, t.z);
      if (prev === type) continue;
      changes.push({ x: t.x, y: t.y, z: t.z, prev, next: type });
    }
    this.applyChanges(changes, { viaSymmetry: this.symmetryTool.mode !== 'off' });
  }

  blockOverlapsPlayerAABB(t) {
    const p = this.player.position;
    const withinX = Math.abs((t.x + 0.5) - p.x) < 0.8; // block half-extent + player half-width
    const withinZ = Math.abs((t.z + 0.5) - p.z) < 0.8;
    const withinY = t.y < p.y + 1.8 && t.y + 1 > p.y;
    return withinX && withinZ && withinY;
  }

  /**
   * The one place blocks change. Break, place, paste, symmetry and undo all
   * route through here, so the rules only have to hook in once: the border
   * says where you may build and the bag says whether you can afford it.
   * A batch is atomic — if you can't pay for all of it, none of it lands.
   */
  applyChanges(changes, { viaSymmetry = false, chargeResources = true } = {}) {
    changes = changes.filter((c) => !this.world.isIndestructible(c.x, c.y, c.z));
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
    this.undoRedo.push(changes);
    this.remeshDirty();

    if (this.duilt) {
      const gained = this.duilt.onBlocksBroken(changes);
      if (Object.keys(gained).length) this.bus.emit('duilt:gathered', { gained });
      this.duilt.structures.revalidateAround(changes);
      this.duilt.settlers.revalidate();
      // The border line is drawn on the blocks that touch it, so digging one
      // out moves the ground under it.
      this.duilt.territory.onBlocksChanged(changes);
      this.duilt.checkAgeAdvance();
    }
    for (const c of changes) {
      if (c.next !== AIR) this.gamification.onBlockPlaced({ world: this.world, x: c.x, y: c.y, z: c.z, type: c.next, viaSymmetry, now });
      else this.gamification.onBlockBroken({ world: this.world, x: c.x, y: c.y, z: c.z, type: c.prev, now });
    }
    return true;
  }

  /**
   * Queues dirty chunks rather than rebuilding them inline. One edit can dirty
   * several chunks at a border, and a paste can dirty many — rebuilding them
   * all in one frame is a visible hitch.
   */
  remeshDirty() {
    for (const chunk of this.world.dirtyChunks()) this.remeshQueue.add(chunk);
    this.selectionDirty = true; // blocks moved, so the selection skin is stale
  }

  /** Spends a slice of the frame on pending rebuilds, then stops. */
  /**
   * Makes the land you are walking towards, and forgets what is behind you.
   *
   * Only ever a ring's worth per frame: generating a chunk is a few
   * milliseconds and doing forty in one frame is a visible stall. The far
   * terrain covers whatever has not arrived yet, so there is nothing to see
   * while it catches up.
   */
  streamChunks() {
    if (!this.world?.endless || !this.player) return;
    const { x, z } = this.player.position;
    // Only when you have actually moved somewhere new.
    const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4;
    if (this.streamedAt && this.streamedAt.cx === cx && this.streamedAt.cz === cz) return;
    this.streamedAt = { cx, cz };

    const made = this.world.ensureAround(x, z, this.renderDistance);
    for (const chunk of made) this.remeshQueue.add(chunk);
    // A generous margin past what is drawn, so walking back and forth over a
    // boundary does not throw away chunks it is about to want again.
    const dropped = this.world.forgetBeyond(x, z, this.renderDistance * 1.6);
    for (const chunk of dropped) {
      this.remeshQueue.delete(chunk);
      this.mesher.remove(chunk);
    }
  }

  /**
   * Keeps the horizon a long way off.
   *
   * Real chunks stop at the render distance; past that this is a coarse mesh
   * of the same ground, sampled from the generator. Rebuilt only when you have
   * walked a good way, because it is thousands of samples and the difference a
   * few steps make at that distance is nothing.
   */
  updateFarTerrain() {
    if (!this.farTerrain) return;
    if (!this.world?.endless) { this.farTerrain.setVisible(false); return; }
    this.farTerrain.setVisible(true);
    const { x, z } = this.player.position;
    // Start it a little inside where the chunks end, so there is never a
    // sliver of sky between the two.
    // Start it where the *meshed* blocks reliably reach rather than where the
    // generated ones do. Chunks arrive faster than they can be meshed when you
    // are moving, and a hole in the near ground with sky behind it is exactly
    // what this exists to prevent.
    const covered = this.remeshQueue.size > 20
      ? Math.max(64, this.renderDistance * 0.45)
      : Math.max(64, this.renderDistance - 40);
    this.farTerrain.update(this.world.gen, x, z, covered);
  }

  drainRemeshQueue(budgetMs = 6) {
    if (!this.remeshQueue.size) return;
    // A long queue means you are walking into new country, and the ground
    // ahead matters more than a couple of frames of headroom.
    if (this.remeshQueue.size > 60) budgetMs = 11;
    const deadline = performance.now() + budgetMs;
    for (const chunk of this.remeshQueue) {
      this.remeshQueue.delete(chunk);
      this.mesher.rebuild(this.world, chunk);
      if (performance.now() >= deadline) break;
    }
  }

  doUndo() {
    const action = this.undoRedo.undo();
    if (!action) return;
    for (const c of action) this.world.setBlock(c.x, c.y, c.z, c.prev);
    this.remeshDirty();
  }

  doRedo() {
    const action = this.undoRedo.redo();
    if (!action) return;
    for (const c of action) this.world.setBlock(c.x, c.y, c.z, c.next);
    this.remeshDirty();
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

    if (playing) {
      this.quality.tick(dt);
      this.player.update(dt);
      if (this.duilt) {
        this.duilt.tick(dt);
        this.player.speedScale = this.duilt.hunger.speedFactor * this.duilt.skills.moveSpeed();
      }
      this.updateHover();
      this.settlerView.update(this.duilt?.settlers.people ?? []);
      this.tickBreaking(performance.now());
      this.gamification.tick(performance.now());
      if (performance.now() - this.lastAutosave > AUTOSAVE_INTERVAL_MS) this.autosaveNow();
    }

    if (!playing) this.player.releaseKeys();

    // These run regardless: the world should finish drawing itself behind the
    // worlds screen rather than streaming in after you arrive.
    this.streamChunks();
    this.drainRemeshQueue();
    this.updateChunkVisibility();
    this.updateFarTerrain();
    this.renderer.render(this.scene, this.camera);
  }

  updateHover() {
    const hit = this.raycast();
    this.hoverHit = hit;

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

    const onBuilding = hit && this.duilt
      ? this.duilt.structures.at(hit.x, hit.y, hit.z)
      : null;
    this.ui?.setBuildingHint(onBuilding
      ? (STRUCTURES_BY_ID.get(onBuilding.type)?.name ?? 'Building')
        + (onBuilding.locked === false ? ' · unlocked' : '')
      : null);
    if (hit && !this.selectorTool.active) {
      this.hoverBox.visible = true;
      this.hoverBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.hoverBox.visible = false;
    }

    if (this.selectorTool.active) {
      // Aiming past everything (common while flying over a build) would otherwise
      // leave the selector with no position at all, so fall back to a spot just
      // ahead of the player.
      this.selectorTool.aimAt(hit ? { x: hit.x, y: hit.y, z: hit.z } : this.pointInFront(6));
      const bounds = this.selectorTool.bounds();
      this.selection.update(bounds, this.selectorTool.size, this.world, { force: this.selectionDirty });
      this.selectionDirty = false;
      this.updateRoofPreview(bounds);
      this.ui.setSelectorReadout(bounds ? {
        size: this.selectorTool.size,
        blocks: this.selection.blockCount,
        template: this.pendingTemplate?.name || null,
        roof: this.pendingRoof?.name || null,
        facing: facingLabel(this.pendingRoof, this.roofTurn),
      } : null);
    } else {
      this.selection.hide();
      this.updateRoofPreview(null);
      this.ui.setSelectorReadout(null);
    }
  }

  onResize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}

function distSq(chunk, px, pz) {
  const dx = chunk.cx - px, dz = chunk.cz - pz;
  return dx * dx + dz * dz;
}

function newWorldId() {
  return crypto.randomUUID();
}
