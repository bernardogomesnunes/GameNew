import * as THREE from 'three';
import { World } from './world/World.js';
import { generateTerrain } from './world/TerrainGenerator.js';
import { ChunkMesher } from './world/ChunkMesher.js';
import { PlayerController } from './player/PlayerController.js';
import { castVoxelRay } from './interaction/VoxelRaycast.js';
import { UndoRedo } from './tools/UndoRedo.js';
import { SelectionTool } from './tools/SelectionTool.js';
import { SymmetryTool } from './tools/SymmetryTool.js';
import { GamificationEngine } from './gamification/GamificationEngine.js';
import { SaveManager, AUTOSAVE_NAME } from './storage/SaveManager.js';
import { UIManager } from './ui/UIManager.js';
import { EventBus } from './core/EventBus.js';
import { AIR } from './config/blocks.js';

const REACH = 7;
const AUTOSAVE_INTERVAL_MS = 60_000;

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

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.canvasRoot.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd0ff);
    this.scene.fog = new THREE.Fog(0x8fd0ff, 50, 210);

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 300);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xfff3d6, 0.85);
    sun.position.set(60, 90, 30);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbfe3f0, 0x3a2f22, 0.4));

    this.mesher = new ChunkMesher(this.scene);
    this.gamification = new GamificationEngine(this.bus);
    this.undoRedo = new UndoRedo();

    this.selectedBlockId = 1;
    this.pointerLocked = false;
    this.hoverHit = null;
    this.upHeld = false;
    this.downHeld = false;
    this.joyMove = { x: 0, z: 0 };
    this.padForward = 0;
    this.padBack = 0;

    this.hoverBox = this.buildWireBox(0xffffff, 1.002);
    this.hoverBox.visible = false;
    this.scene.add(this.hoverBox);
    this.selectionBox = this.buildWireBox(0x58c4dc, 1);
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);

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
    const autosave = this.saveManager.load(AUTOSAVE_NAME);
    if (autosave) {
      this.loadFromData(autosave, { silent: true });
    } else {
      this.newWorld({ silent: true });
    }

    this.symmetryTool = new SymmetryTool(this.world);
    this.selectionTool = new SelectionTool();

    this.ui = new UIManager(this.uiRoot, {
      bus: this.bus,
      gamification: this.gamification,
      saveManager: this.saveManager,
      callbacks: this.buildCallbacks(),
    });

    this.wireInput();
    this.lastAutosave = performance.now();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.tick());
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
        this.saveManager.save(name, { world: this.world, player: this.player, gamification: this.gamification });
        this.ui.toast({ kind: 'challenge', title: 'World saved', body: name });
      },
      onLoad: (name) => {
        const data = this.saveManager.load(name);
        if (data) this.loadFromData(data);
        this.ui.closePanel('panel-menu');
      },
      onDeleteSave: (name) => this.saveManager.delete(name),
      onNewWorld: () => { this.newWorld(); this.ui.closePanel('panel-menu'); },
      onResume: () => {
        this.ui.closePanel('panel-menu');
        if (document.body.classList.contains('touch')) this.ui.hideBlocker();
        else this.requestPointerLock();
      },
      onOpenMenu: () => { this.ui.refreshSaveList(); this.ui.openPanel('panel-menu'); document.exitPointerLock?.(); },
      onToggleFly: () => { this.player.toggleFly(); this.ui.setFlyIndicator(this.player.flying); return this.player.flying; },
      onUndo: () => this.doUndo(),
      onRedo: () => this.doRedo(),
      onToggleSelection: () => this.selectionTool.toggle(),
      onCopy: () => {
        const n = this.selectionTool.copy(this.world);
        this.ui.toast({ kind: 'xp', title: n ? 'Copied' : 'Nothing selected', body: n ? `${n} blocks copied` : 'Select two points first' });
      },
      onPaste: () => this.pasteClipboard(),
      onCycleSymmetry: () => this.symmetryTool.cycle(),
      onMove: (x, z) => { this.joyMove.x = x; this.joyMove.z = z; this.applyTouchMove(); },
      onMoveForward: (held) => { this.padForward = held ? 1 : 0; this.applyTouchMove(); },
      onMoveBack: (held) => { this.padBack = held ? 1 : 0; this.applyTouchMove(); },
      onLook: (dx, dy) => this.player.look(dx, dy),
      onJumpOrFlyUp: (held) => {
        if (this.player.flying) { this.upHeld = held; this.recomputeVertical(); }
        else if (held) this.player.requestJump();
      },
      onFlyDown: (held) => {
        this.downHeld = held;
        this.recomputeVertical();
      },
      onBreakTap: () => this.breakBlock(),
      onPlaceTap: () => this.placeBlock(),
    };
  }

  newWorld({ silent } = {}) {
    this.world = new World({ sizeX: 64, sizeZ: 64, height: 64 });
    generateTerrain(this.world);
    if (this.player) this.player.dispose();
    this.player = new PlayerController(this.world, this.camera, this.findSafeSpawn());
    this.gamification = new GamificationEngine(this.bus);
    this.undoRedo = new UndoRedo();
    this.rebuildAllChunks();
    if (!silent) this.ui.toast({ kind: 'xp', title: 'New world generated', body: 'Have fun building!' });
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
    if (this.player) this.player.dispose();
    this.player = new PlayerController(this.world, this.camera, data.player);
    this.player.yaw = data.player.yaw || 0;
    this.player.pitch = data.player.pitch || 0;
    if (!this.gamification) this.gamification = new GamificationEngine(this.bus);
    this.gamification.loadJSON(data.gamification);
    this.undoRedo = new UndoRedo();
    this.rebuildAllChunks();
    if (this.ui) this.ui.updateXp();
    if (!silent && this.ui) this.ui.toast({ kind: 'xp', title: 'World loaded', body: '' });
  }

  rebuildAllChunks() {
    for (const chunk of this.world.allChunks()) this.mesher.rebuild(this.world, chunk);
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
      } else if (wasLocked && !this.ui.isAnyPanelOpen()) {
        this.ui.refreshSaveList();
        this.ui.openPanel('panel-menu');
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
      if (e.code === 'Escape') {
        if (this.pointerLocked) return; // browser handles exiting lock
        this.ui.isAnyPanelOpen() ? this.closeAllPanels() : (this.ui.refreshSaveList(), this.ui.openPanel('panel-menu'));
        return;
      }
      if (e.repeat) return;
      if (/^Digit[1-9]$/.test(e.code)) this.ui.cycleHotbarByKey(Number(e.code.slice(5)));
      if (e.code === 'KeyB') { const active = this.selectionTool.toggle(); this.ui.toast({ kind: 'xp', title: active ? 'Selection tool on' : 'Selection tool off' }); }
      if (e.code === 'KeyM') {
        const mode = this.symmetryTool.cycle();
        this.ui.toast({ kind: 'xp', title: `Symmetry: ${mode.toUpperCase()}` });
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) { e.preventDefault(); this.doUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) { e.preventDefault(); this.doRedo(); }
    });
  }

  closeAllPanels() {
    ['panel-stats', 'panel-menu', 'panel-score'].forEach((id) => this.ui.closePanel(id));
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
    if (this.selectionTool.active) this.pickSelection();
    else this.breakBlock();
  }

  secondaryAction() {
    if (this.selectionTool.active) this.pickSelection();
    else this.placeBlock();
  }

  pickSelection() {
    const hit = this.raycast();
    if (!hit) return;
    this.selectionTool.pick({ x: hit.x, y: hit.y, z: hit.z });
    if (this.selectionTool.hasSelection) this.ui.toast({ kind: 'xp', title: 'Selection set', body: 'Copy or paste from the toolbar' });
  }

  pasteClipboard() {
    if (!this.selectionTool.clipboard) {
      this.ui.toast({ kind: 'xp', title: 'Clipboard empty', body: 'Copy a selection first' });
      return;
    }
    const hit = this.raycast();
    const anchor = hit ? { x: hit.x, y: hit.y, z: hit.z } : { x: Math.floor(this.player.position.x), y: Math.floor(this.player.position.y), z: Math.floor(this.player.position.z) };
    const changes = this.selectionTool.buildPaste(this.world, anchor);
    this.applyChanges(changes, { viaSymmetry: false });
    this.ui.toast({ kind: 'xp', title: 'Pasted', body: `${changes.length} blocks` });
  }

  // ---- raycasting / block edits ----

  raycast() {
    const origin = this.player.eyePosition();
    const dir = this.player.lookDirection();
    return castVoxelRay(this.world, origin, dir, REACH);
  }

  recomputeVertical() {
    this.player.externalUp = (this.upHeld ? 1 : 0) - (this.downHeld ? 1 : 0);
  }

  /** Joystick and forward/back rocker both feed movement; combine rather than overwrite. */
  applyTouchMove() {
    this.player.externalMove.x = this.joyMove.x;
    this.player.externalMove.z = Math.max(-1, Math.min(1, this.joyMove.z + this.padForward - this.padBack));
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
    if (!this.gamification.isBlockUnlocked(type)) {
      this.ui.toast({ kind: 'xp', title: 'Locked block', body: 'Level up or complete achievements to unlock it' });
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

  applyChanges(changes, { viaSymmetry }) {
    if (!changes.length) return;
    const now = performance.now();
    for (const c of changes) this.world.setBlock(c.x, c.y, c.z, c.next);
    this.undoRedo.push(changes);
    for (const chunk of this.world.dirtyChunks()) this.mesher.rebuild(this.world, chunk);
    for (const c of changes) {
      if (c.next !== AIR) this.gamification.onBlockPlaced({ world: this.world, x: c.x, y: c.y, z: c.z, type: c.next, viaSymmetry, now });
      else this.gamification.onBlockBroken({ world: this.world, x: c.x, y: c.y, z: c.z, type: c.prev, now });
    }
  }

  doUndo() {
    const action = this.undoRedo.undo();
    if (!action) return;
    for (const c of action) this.world.setBlock(c.x, c.y, c.z, c.prev);
    for (const chunk of this.world.dirtyChunks()) this.mesher.rebuild(this.world, chunk);
  }

  doRedo() {
    const action = this.undoRedo.redo();
    if (!action) return;
    for (const c of action) this.world.setBlock(c.x, c.y, c.z, c.next);
    for (const chunk of this.world.dirtyChunks()) this.mesher.rebuild(this.world, chunk);
  }

  // ---- loop ----

  tick() {
    const dt = this.clock.getDelta();
    this.player.update(dt);
    this.updateHover();
    this.gamification.tick(performance.now());

    if (performance.now() - this.lastAutosave > AUTOSAVE_INTERVAL_MS) {
      this.lastAutosave = performance.now();
      try { this.saveManager.autosave({ world: this.world, player: this.player, gamification: this.gamification }); } catch {}
    }

    this.renderer.render(this.scene, this.camera);
  }

  updateHover() {
    const hit = this.raycast();
    this.hoverHit = hit;
    if (hit && !this.selectionTool.active) {
      this.hoverBox.visible = true;
      this.hoverBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.hoverBox.visible = false;
    }

    if (this.selectionTool.active && this.selectionTool.pointA) {
      const b = this.selectionTool.pointB || hit || this.selectionTool.pointA;
      const bounds = {
        minX: Math.min(this.selectionTool.pointA.x, b.x), maxX: Math.max(this.selectionTool.pointA.x, b.x),
        minY: Math.min(this.selectionTool.pointA.y, b.y), maxY: Math.max(this.selectionTool.pointA.y, b.y),
        minZ: Math.min(this.selectionTool.pointA.z, b.z), maxZ: Math.max(this.selectionTool.pointA.z, b.z),
      };
      const sx = bounds.maxX - bounds.minX + 1, sy = bounds.maxY - bounds.minY + 1, sz = bounds.maxZ - bounds.minZ + 1;
      this.selectionBox.scale.set(sx, sy, sz);
      this.selectionBox.position.set(bounds.minX + sx / 2, bounds.minY + sy / 2, bounds.minZ + sz / 2);
      this.selectionBox.visible = true;
    } else {
      this.selectionBox.visible = false;
    }
  }

  onResize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
