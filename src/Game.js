import * as THREE from 'three';
import { World, CHUNK_SIZE } from './world/World.js';
import { generateTerrain, generateFlat } from './world/TerrainGenerator.js';
import { ChunkMesher } from './world/ChunkMesher.js';
import { PlayerController } from './player/PlayerController.js';
import { castVoxelRay } from './interaction/VoxelRaycast.js';
import { UndoRedo } from './tools/UndoRedo.js';
import { SelectorTool, buildTemplatePlacement, rotateTemplate } from './tools/SelectorTool.js';
import { SelectionHighlight } from './tools/SelectionHighlight.js';
import { CloudAuth } from './net/CloudAuth.js';
import { CloudWorlds } from './net/CloudWorlds.js';
import { isCloudConfigured } from './net/cloudConfig.js';
import { DuiltGame } from './duilt/DuiltGame.js';
import { generateDuiltWorld } from './world/StarterWorld.js';
import { TemplateLibrary } from './prefabs/TemplateLibrary.js';
import { SymmetryTool } from './tools/SymmetryTool.js';
import { GamificationEngine } from './gamification/GamificationEngine.js';
import { SaveManager, AUTOSAVE_NAME } from './storage/SaveManager.js';
import { loadSettings, saveSettings, QualityController, DISTANCES } from './render/graphics.js';
import { isTyping } from './ui/Panels.js';
import { DESIGN_FOR_STRUCTURE } from './config/starterDesigns.js';
import { exportWorldFile, exportVoxFile, parseWorldPayload, pickFile } from './storage/WorldExport.js';
import { UIManager } from './ui/UIManager.js';
import { EventBus } from './core/EventBus.js';
import { EconomyEngine } from './economy/EconomyEngine.js';
import { AIR, BLOCKS_BY_ID, costResourceOf } from './config/blocks.js';
import { resourceName } from './config/resources.js';

const REACH = 7;
const FOG_FAR = 210;           // where the world has faded fully into the sky
const FOG_FAR_COARSE = 160;
// Chunks are culled past the fog's far edge, never before it. Culling first is
// what makes chunks pop in and out as you walk; out here they are already the
// colour of the sky, so nothing can be seen appearing. The extra margin covers
// a chunk whose centre is beyond the line while its near corner is not.
const CULL_MARGIN = 24;
const IMMEDIATE_CHUNKS = 25;  // meshed before the first frame; the rest stream in
const AUTOSAVE_INTERVAL_MS = 60_000;
export const CREATIVE = 'creative';
export const CAMPAIGN = 'campaign';
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
    const fogFar = chosen ? chosen.fogFar : (coarse ? FOG_FAR_COARSE : FOG_FAR);
    // Fog starts at a fixed fraction of the way out rather than at a fixed
    // distance. At 40 blocks on a phone the haze began almost at arm's length
    // and the whole world looked washed out; tying it to the far plane keeps
    // the same amount of clear world in view whatever the device can draw.
    this.scene.fog = new THREE.Fog(0x8fd0ff, fogFar * 0.45, fogFar);
    this.renderDistance = fogFar + CULL_MARGIN;

    // The near plane sets how much depth precision the whole scene gets, and
    // phones commonly hand out a 16-bit depth buffer. At 0.1 with a far plane
    // of 300 there was not enough precision left for distant surfaces to agree
    // on which is in front, so they traded places as the camera moved. Nothing
    // in a voxel world is ever closer than a fraction of a block, so 0.2 costs
    // nothing to look at and doubles the precision everywhere.
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.2, this.renderDistance + 20);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xfff3d6, 0.85);
    sun.position.set(60, 90, 30);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbfe3f0, 0x3a2f22, 0.4));

    this.mesher = new ChunkMesher(this.scene);
    this.gamification = new GamificationEngine(this.bus);
    this.economy = new EconomyEngine(this.bus);
    this.undoRedo = new UndoRedo();
    // Duilt is the game. Creative and Campaign are the sandbox this grew out
    // of and are still there on purpose, but arriving in one of them meant a
    // first-time player landed in a world with no bag, no land and no goals,
    // and the game itself was three taps deep behind a menu and a browser
    // confirm box. A save always sets its own mode, so this only decides where
    // someone with nothing saved begins.
    this.mode = DUILT;

    this.selectedBlockId = 1;
    this.pointerLocked = false;
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

  /** Writes the autosave straight away, and resets the interval clock with it. */
  autosaveNow() {
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
        if (!active) this.pendingTemplate = null;
        return active;
      },
      onCycleSelectorSize: () => this.selectorTool.cycleSize(),
      onSaveTemplate: (name) => this.saveTemplate(name),
      onPickTemplate: (id) => {
        this.pendingTemplate = this.templates.get(id);
        this.templateRotation = 0;
        if (this.pendingTemplate) {
          this.selectorTool.active = true;
          this.ui.toast({ kind: 'challenge', title: `Ready: ${this.pendingTemplate.name}`, body: 'Aim and place it' });
        }
        return !!this.pendingTemplate;
      },
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
      onPlaceTap: () => this.secondaryAction(),

      // ---- duilt ----
      isDuilt: () => !!this.duilt,
      onOpenBag: () => this.ui.toggleBag(),
      onOpenClaim: () => this.openClaim(),
      onClaimType: (id) => this.claimAs(id),
      onStampStarter: (id) => this.stampStarter(id),
      onOpenBuildings: () => { document.exitPointerLock?.(); this.ui.openDuiltPanel('panel-buildings'); },
      onOpenBench: () => { document.exitPointerLock?.(); this.ui.openDuiltPanel('panel-bench'); },
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
    this.worldId = newWorldId();
    this.worldName = name
      || (mode === CAMPAIGN ? 'Campaign world' : mode === DUILT ? 'My settlement' : 'Creative world');

    this.disposeDuilt();
    let spawn = null;
    if (mode === DUILT) {
      // A world big enough for the first four ages; the authored settlement
      // sits in the middle of it and the border does the rest.
      const built = generateDuiltWorld({ sizeX: 256, sizeZ: 256, height: 64 });
      this.world = built.world;
      spawn = built.origin.spawn;
    } else {
      this.world = new World({ sizeX: 64, sizeZ: 64, height: 64 });
      if (mode === CAMPAIGN) generateFlat(this.world);
      else generateTerrain(this.world);
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
        title: mode === CAMPAIGN ? 'Campaign started' : mode === DUILT ? 'Welcome to Duilt' : 'New world generated',
        body: mode === CAMPAIGN ? 'You have 120 wood. Spend it well.'
          : mode === DUILT ? 'You have 32 blocks of land, an axe and a bucket. Build a forest, a farm and a house.'
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
    // A save from before worlds had ids still loads; it just gets a fresh one.
    this.worldId = data.worldId || newWorldId();
    this.worldName = data.worldName || data.name || this.worldName || 'My world';
    // Anything unrecognised falls back to Creative, which is the mode that
    // needs nothing alongside it. Listing the modes explicitly matters: while
    // this read `=== CAMPAIGN ? CAMPAIGN : CREATIVE`, every saved Duilt world
    // came back as a sandbox and its bag, land, buildings and skills went with it.
    this.mode = data.mode === CAMPAIGN ? CAMPAIGN : data.mode === DUILT ? DUILT : CREATIVE;
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
      if (!silent) this.ui.toast({ kind: 'xp', title: 'World loaded', body: this.mode === CAMPAIGN ? 'Campaign' : 'Creative' });
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

    const px = this.player ? this.player.position.x / CHUNK_SIZE : this.world.chunksX / 2;
    const pz = this.player ? this.player.position.z / CHUNK_SIZE : this.world.chunksZ / 2;
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
      if (e.button === 0) this.primaryAction();
      else if (e.button === 2) this.secondaryAction();
    });

    window.addEventListener('keydown', (e) => {
      // Nothing in here is a shortcut while you are filling in a form. Typing an
      // email address used to open the workbench on "e" and the buildings panel
      // on "b", which on a phone buried the keyboard under a panel.
      if (isTyping(e)) return;

      if (e.code === 'Escape') {
        if (this.pointerLocked) return; // browser handles exiting lock
        // One at a time, most recent first — Escape means "put away the thing
        // in front of me", not "put away everything".
        if (this.ui.isAnyPanelOpen()) this.ui.closeTopPanel();
        else this.ui.openPanel('panel-menu');
        return;
      }
      if (e.repeat) return;
      // Everything below acts on the world, so it only applies while you are in
      // it. Escape, above, is the way out and always works.
      if (!this.isPlaying) return;
      if (/^Digit[1-9]$/.test(e.code)) this.ui.cycleHotbarByKey(Number(e.code.slice(5)));
      if (e.code === 'KeyB') {
        if (this.duilt) { document.exitPointerLock?.(); this.ui.openDuiltPanel('panel-buildings'); }
        else this.ui.toggleSelector();
      }
      if (e.code === 'KeyI' && this.duilt) { document.exitPointerLock?.(); this.ui.toggleBag(); }
      if (e.code === 'KeyC' && this.duilt) { document.exitPointerLock?.(); this.openClaim(); }
      if (e.code === 'KeyE' && this.duilt) { document.exitPointerLock?.(); this.ui.openDuiltPanel('panel-bench'); }
      if (e.code === 'KeyR' && this.pendingTemplate) {
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

  primaryAction() {
    if (this.selectorTool.active) {
      if (this.pendingTemplate) this.stampTemplate();
      else this.ui.openTemplateSavePrompt();
      return;
    }
    this.breakBlock();
  }

  secondaryAction() {
    if (this.selectorTool.active) {
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

  /** Offers the framed region to the claim menu. */
  openClaim() {
    if (!this.duilt) return;
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

  /**
   * Whether a block can be held at all. Creative gates on level/achievement,
   * Campaign gates on whether its resource tier is unlocked — affordability is
   * a separate question, answered at purchase time.
   */
  blockAvailability(id) {
    const cfg = BLOCKS_BY_ID.get(id);
    if (!cfg || cfg.system) return { ok: false, reason: 'Not placeable' };
    if (this.mode === CAMPAIGN) {
      const res = costResourceOf(id);
      if (res && !this.economy.isResourceUnlocked(res)) {
        return { ok: false, reason: `Unlocks with ${resourceName(res)}` };
      }
      return { ok: true };
    }
    if (this.gamification.isBlockUnlocked(id)) return { ok: true };
    return {
      ok: false,
      reason: cfg.unlock?.type === 'level' ? `Unlocks at level ${cfg.unlock.value}` : 'Unlocks via an achievement',
    };
  }

  canAffordBlock(id) {
    if (this.mode !== CAMPAIGN) return true;
    const cost = BLOCKS_BY_ID.get(id)?.cost;
    if (!cost) return true;
    return Object.entries(cost).every(([res, amount]) => this.economy.balanceOf(res) >= amount);
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
   * route through here, so the economy only has to hook in once.
   * A batch is atomic: if the player can't afford all of it, none of it lands.
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
      if (chargeResources) {
        const paid = this.duilt.payForPlacement(changes);
        if (!paid.ok) {
          this.ui?.toast({ kind: 'xp', title: 'Not enough', body: paid.reason });
          return false;
        }
        duiltBill = paid.bill;
      }
    } else if (chargeResources && !this.commitResources(changes)) {
      return false;
    }

    const now = performance.now();
    for (const c of changes) this.world.setBlock(c.x, c.y, c.z, c.next);
    this.undoRedo.push(changes);
    this.remeshDirty();

    if (this.duilt) {
      const gained = this.duilt.onBlocksBroken(changes);
      if (Object.keys(gained).length) this.bus.emit('duilt:gathered', { gained });
      this.duilt.structures.revalidateAround(changes);
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

  /** Charges (or refunds) a batch in Campaign. Returns false if unaffordable. */
  commitResources(changes) {
    if (this.mode !== CAMPAIGN) return true;
    const delta = this.economy.deltaForChanges(changes);
    if (!this.economy.canApply(delta)) {
      const short = this.economy.shortfall(delta);
      if (short) {
        this.ui?.toast({
          kind: 'xp',
          title: `Not enough ${resourceName(short.resource)}`,
          body: `Needs ${short.needed}, you have ${short.have}`,
        });
      }
      return false;
    }
    this.economy.apply(delta);
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
  drainRemeshQueue(budgetMs = 6) {
    if (!this.remeshQueue.size) return;
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
    // Undoing a break re-places the block, which has to be paid for again.
    const reversed = action.map((c) => ({ x: c.x, y: c.y, z: c.z, prev: c.next, next: c.prev }));
    if (!this.commitResources(reversed)) {
      this.undoRedo.redo(); // roll the pointer back, nothing was applied
      return;
    }
    for (const c of action) this.world.setBlock(c.x, c.y, c.z, c.prev);
    this.remeshDirty();
  }

  doRedo() {
    const action = this.undoRedo.redo();
    if (!action) return;
    if (!this.commitResources(action)) {
      this.undoRedo.undo();
      return;
    }
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
    const fogFar = chosen ? chosen.fogFar : (this.coarse ? FOG_FAR_COARSE : FOG_FAR);
    this.scene.fog.near = fogFar * 0.45;
    this.scene.fog.far = fogFar;
    this.renderDistance = fogFar + CULL_MARGIN;
    this.camera.far = this.renderDistance + 20;
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

  tick() {
    // Always read the clock, even when nothing will use it: skipping it lets
    // the gap pile up, and the first frame after a pause would move the player
    // by however long they spent reading a menu. The cap covers the same thing
    // for a stalled tab — a single frame should never teleport anyone.
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const playing = this.isPlaying;

    if (playing) {
      this.quality.tick(dt);
      this.player.update(dt);
      if (this.duilt) {
        this.duilt.tick(dt);
        this.player.speedScale = this.duilt.hunger.speedFactor * this.duilt.skills.moveSpeed();
      }
      this.updateHover();
      this.gamification.tick(performance.now());
      if (performance.now() - this.lastAutosave > AUTOSAVE_INTERVAL_MS) this.autosaveNow();
    }

    if (!playing) this.player.releaseKeys();

    // These run regardless: the world should finish drawing itself behind the
    // worlds screen rather than streaming in after you arrive.
    this.drainRemeshQueue();
    this.updateChunkVisibility();
    this.renderer.render(this.scene, this.camera);
  }

  updateHover() {
    const hit = this.raycast();
    this.hoverHit = hit;
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
      this.ui.setSelectorReadout(bounds ? {
        size: this.selectorTool.size,
        blocks: this.selection.blockCount,
        template: this.pendingTemplate?.name || null,
      } : null);
    } else {
      this.selection.hide();
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
