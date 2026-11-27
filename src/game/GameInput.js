// Input: the mouse, the keyboard, pointer lock and fullscreen, the two buttons
// and a tap on a phone, the controls settings, and the aim a touch makes
// through a point on the screen. Moved out of Game.js (TECH-10); every
// function runs with `this` set to the Game, which delegates to it.
import * as THREE from 'three';
import { POTIONS } from '../config/potions.js';
import { isTyping } from '../ui/Panels.js';
import { panelForKey } from '../config/panels.js';
import { wakesOn } from '../world/sleep.js';
import { nextView, VIEW_NAMES } from '../config/avatar.js';
import { saveControls } from '../config/controls.js';
import { isFood } from '../config/items.js';
import { MOBS_BY_ID } from '../config/mobs.js';
import { BENCH_MACHINES } from '../duilt/BenchWork.js';
import { bedPart, isChest, isCatapult, isPainting, stationOf } from '../config/blocks.js';
import { NIGHTSTONE_ORE, SKY_LIFT, STORAGE_CONTROLLER, STORAGE_INTERFACE, isTent, TIME_MACHINE, ARCHIVE, WAR_STANDARD } from '../config/blocks.js';
import { WAY_OUT } from '../world/godCube.js';
// Game.js imports this file and this file imports Game.js: swings is only read
// inside functions, after both modules have loaded.
import { swings } from '../Game.js';

/**
 * Items that fully replace Break/Place while selected, rather than digging
 * or building — the bucket, and now food. The value is a method on Game.
 * Mining tools (axe, pickaxe, shovel) are not in here: they don't replace
 * breakBlock, they change how it behaves — see TOOL_EFFECTIVENESS.
 */
// Any food not listed eats on Break and throws on Place — see foodOverride.
const BREAK_OVERRIDE = { bucket: 'fillBucket', apple: 'eatSelected', vegetables: 'eatSelected', grape: 'eatSelected', raspberry: 'eatSelected', passion_fruit: 'eatSelected', holy_water: 'drinkSelected', beer: 'drinkSelected', kombucha: 'drinkSelected', coffee: 'drinkSelected', war_horn: 'blowHorn', bow: 'shootBow', god_wand: 'useWand', wizard_wand: 'castWand', ...Object.fromEntries(POTIONS.map((p) => [`potion_${p.id}`, 'drinkSelected'])), carpentry_chisel: 'chiselBlock' };
const PLACE_OVERRIDE = { bucket_water: 'emptyBucket', apple: 'throwSelected', vegetables: 'throwSelected', grape: 'throwSelected', raspberry: 'throwSelected', passion_fruit: 'throwSelected', coffee_beans: 'throwSelected', compost: 'compostSelected', locomotive: 'setDownTrain', rail_car: 'railCarHint', god_wand: 'wandPlace', helix: 'setDownMachine', flying_machine: 'wearSelected', dino_whistle: 'blowWhistle' };

export function wireInput() {
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
    if (!this.pointerLocked || this.sleeping) return;
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
    // The bow is drawn while the button's down and looses as it comes
    // up (asked for directly: "pull the bow and just release the arrow
    // when I lift the click").
    if (e.button === 0 && this.startDraw()) return;
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
    target.addEventListener(event, () => {
      this.setBreaking(false); this.setPlacing(false);
      // Let go of the button: the arrow goes. Taken away from the game: it doesn't.
      this.releaseDraw({ cancel: event !== 'mouseup' });
    });
  }

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && this.closeUp?.active) this.closeUp.machine.keyUp?.();
    if (e.code === 'Space' && this.closeUp?.machine?.keyHold) this.closeUp.machine.keyHold(false);
  });
  window.addEventListener('keydown', (e) => {
    // Nothing in here is a shortcut while you are filling in a form. Typing an
    // email address used to open the workbench on "e" and the buildings panel
    // on "b", which on a phone buried the keyboard under a panel.
    if (isTyping(e)) return;
    if (this.sleeping && wakesOn(e.code, this.controls.keys)) { this.wake(); return; }

    if (e.code === 'Escape' && this.closeUp?.active) { this.endMachine(); return; }
    // CRAFT-9: at a machine its own keys come first (the Carpenter's Table: Space holds Saw, 1 to 4 tap a part).
    if (this.closeUp?.active && this.closeUp.machine.key?.(e.code, true, e.repeat)) { e.preventDefault(); return; }
    // CRAFT-9 part 6: at a machine that holds an action (the crucible, the
    // Kiln Oven), Space holds it on a desktop; its keyup below lets go.
    if (e.code === 'Space' && this.closeUp?.machine?.keyHold) { e.preventDefault(); if (!e.repeat) this.closeUp.machine.keyHold(true); return; }
    // CRAFT-9: Space works a bench machine on a desktop: held for a held one, a tap for the Mason's Bench.
    if (e.code === 'Space' && this.closeUp?.active) { e.preventDefault(); document.activeElement?.blur?.(); if (!e.repeat) this.closeUp.machine.keyDown?.(); return; }
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
    const survivalOnly = shortcut?.mode === 'survival';
    if (shortcut && (shortcut.mode !== 'duilt' || this.duilt) && !(survivalOnly && (!this.duilt || this.duilt.sandbox))) {
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
    // Change view (playtest, P3) — F5 unless rebound, and not a reload.
    if (e.code === this.controls.keys.view) { e.preventDefault(); this.cycleView(); return; }
    const turnKey = this.controls.keys.turn;
    if (e.code === turnKey && this.moving) this.turnMove();
    else if (e.code === turnKey && this.pendingRoof) this.turnRoof();
    else if (e.code === turnKey && this.pendingTemplate) this.turnTemplate();
  });
}

export function requestPointerLock() {
  // Not over the story: it's read first, then the world.
  if (this.ui.story?.open) return;
  // Nor at the carpentry counter: its parts are dragged with a free pointer.
  if (this.closeUp?.active) return;
  if (this.ui.isAnyPanelOpen()) this.closeAllPanels();
  this.renderer.domElement.requestPointerLock?.();
}

export function enterFullscreen() {
  if (!document.fullscreenEnabled || document.fullscreenElement) return;
  this.container.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else this.enterFullscreen();
  return !document.fullscreenElement;
}

export function primaryAction() {
  if (this.sleeping) return;
  this.avatarView?.strike();
  this.handView?.strike();
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

/**
 * A tap on the picture, on a phone. Played on: "place should be tap, break
 * should be a hold" — holding the picture breaks (UIManager.bindLookSurface),
 * and a tap does Place's job: puts down the block you hold, opens a gate or
 * a chest, speaks to the King. It hands back to Break for what only Break
 * does: striking whatever is in front of you (a tap to hit is what a fight
 * wants), a queued tool's corner or stamp, a catapult's throw — and for
 * whatever you hold that has nothing to put down: a tool, bare hands, food
 * to eat, a bucket to fill. Returns 'place' or 'break'.
 */
export function tapAction(at = null) {
  if (this.sleeping) return;
  if (this.moving) { this.secondaryAction(); return 'place'; }
  const breaks = () => { this.primaryAction(); return 'break'; };
  const places = () => { this.secondaryAction(); return 'place'; };
  if (this.manning || this.pendingClaim || this.pendingClaimColumn || this.pendingClear
    || this.pendingRoof || this.pendingTemplate) return breaks();
  if (this.selectedItemId === 'storage_remote') return places();
  // A finger on someone who'll talk or trade means them, wherever the
  // crosshair is (reported directly: "Clicking on a market man does not
  // open the menu to trade" — the tap went to the floor under the
  // crosshair, not the trader under the finger).
  if (at && !this.armed) {
    const ray = this.rayThrough(at.x, at.y);
    const someone = ray && this.aimedAlong(ray, () => {
      const hit = this.raycast();
      return this.kingTarget(hit) || this.hermitTarget(hit) || this.traderTarget(hit) || this.talkTarget(hit);
    });
    if (someone) return this.aimedAlong(ray, places);
  }
  const aimed = this.raycast();
  // Someone who'll talk gets a word, not a blow: a tap is Place. Holding
  // still strikes them, the way it breaks a block.
  if (this.talkTarget(aimed) || this.traderTarget(aimed)) return places();
  // A horse or a dinosaur: yours, a tap gets on; wild, a tap with what it
  // eats in your hand tames it. Without, a tap hunts it as any animal.
  // (Taming used to be Place only, and a tap always struck it.)
  const mount = this.horseTarget(aimed);
  if (mount && (mount.owned || MOBS_BY_ID.get(mount.type)?.tameWith?.includes(this.selectedItemId))) return places();
  if (this.banditTarget(aimed) || this.mobTarget(aimed) || this.fireflyTarget(aimed)) return breaks();
  if (this.kingTarget(aimed) || this.hermitTarget(aimed) || this.traderTarget(aimed) || this.guardianTarget(aimed)) return places();
  // A train or a flying machine: a tap is Place — coal into the bunker, a
  // car coupled on, a car opened, the cab or the seat. Holding takes it
  // apart (asked for directly: "train should be broke with pressing and
  // adding coal with click"); with coal in hand a tap used to be Break,
  // and took the train to bits instead of firing it.
  if (this.trainTarget(aimed) || this.machineTarget(aimed)) return places();
  if (aimed && (swings(aimed.block) || isChest(aimed.block) || isPainting(aimed.block) || bedPart(aimed.block) || isTent(aimed.block)
    || aimed.block === STORAGE_CONTROLLER || aimed.block === STORAGE_INTERFACE || stationOf(aimed.block)
    || aimed.block === SKY_LIFT || aimed.block === WAY_OUT || aimed.block === TIME_MACHINE || aimed.block === ARCHIVE || aimed.block === WAR_STANDARD || isCatapult(aimed.block)
    || (aimed.block === NIGHTSTONE_ORE && this.isAltar(aimed)))) return places();
  const item = this.selectedItemId;
  // The wand: a tap puts down a copy once a block's picked; a hold (Break)
  // picks one, or looses a beam.
  if (item === 'god_wand') return this.wandBlock && aimed ? places() : breaks();
  if (PLACE_OVERRIDE[item] && !BREAK_OVERRIDE[item]) return places();
  if (item) return breaks();
  return places();
}

export function secondaryAction() {
  if (this.sleeping) return;
  this.avatarView?.strike();
  this.handView?.strike();
  // The held remote uses this world's existing shelves, wherever you aim.
  if (this.selectedItemId === 'storage_remote' && !this.armed && !this.moving && !this.manning) {
    return void this.ui.openStores(true);
  }
  // Pointed at the Stone King, Place speaks to him (Phase 7e) — and the hermit, too (7j).
  if (this.kingTarget()) return void this.speakToKing();
  if (this.hermitTarget()) return void this.speakToHermit();
  // And at a market's trader, Place opens their stall.
  const trader = this.traderTarget();
  if (trader) {
    this.ui.openTrader(trader);
    this.tellMoment('first_trader');
    return;
  }
  // Anyone else who'll talk: a settler, an explorer, a messenger, a soldier.
  const talker = this.talkTarget();
  if (talker) return void this.talkTo(talker);
  // Place puts down what you are holding, on a mouse and under a thumb
  // alike. Cancelling is Escape, or the Break button — which says "Cancel"
  // while you are carrying something, so there is nothing to guess.
  if (this.moving) return void this.dropMove();
  // A roof with more than one way round takes this button, so a phone has a
  // way to turn it. See setToolReadout, which labels it to match.
  if (this.pendingRoof?.turns > 1) return void this.turnRoof();
  // So does a saved build: on a phone there's no R (asked for directly:
  // "on creative buildings do not rotate when moving").
  if (this.pendingTemplate) return void this.turnTemplate();
  if (this.armed) return void this.clearPending();
  if (this.manning) return void this.letGo();
  // Pointing at a gate, Place opens or shuts it — before anything you're
  // holding gets a say, the same way you'd reach for a latch.
  const aimed = this.raycast();
  // At a horse: tame it, put a cart on it, open the cart, or ride it.
  const horse = this.horseTarget(aimed);
  if (horse) return void this.useHorse(horse);
  // At a Helix you set down, Place climbs in.
  const machine = this.machineTarget(aimed);
  if (machine) return void this.pilot(machine);
  // At a train: coal fires it, a car couples on, and anything else climbs in to drive.
  const train = this.trainTarget(aimed);
  if (train) return void this.useTrain(train.train, train.part);
  // At your guardian, Place gives it its next order.
  if (this.guardianTarget(aimed)) return void this.commandGuardian();
  if (aimed && swings(aimed.block)) return void this.toggleGate(aimed);
  // And at a chest, Place opens it.
  if (aimed && isChest(aimed.block)) return void this.openChest(aimed);
  // And at a storage controller, every storehouse at once.
  if (aimed?.block === STORAGE_INTERFACE) {
    if (this.world.getBlock(aimed.x, aimed.y - 1, aimed.z) !== STORAGE_CONTROLLER) {
      this.ui.toast({kind:'xp',title:'Place this above a storage controller'});
      return;
    }
    return void this.ui.openStores(true);
  }
  if (aimed && aimed.block === STORAGE_CONTROLLER && this.selectedBlockId !== STORAGE_INTERFACE) return void this.ui.openStores();
  // At a wood mill (#32), the bench, showing what's made there.
  if (aimed && stationOf(aimed.block) === 'counter') return void this.startCounter(aimed);
  if (aimed && stationOf(aimed.block) === 'crucible') return void this.startCrucible(aimed);
  if (aimed && stationOf(aimed.block) === 'kiln_oven') return void this.startKilnOven(aimed);
  if (aimed && stationOf(aimed.block) === 'dehydrator') return void this.startDehydrator(aimed); // PLAY-16
  if (aimed && stationOf(aimed.block) === 'cauldron') return void this.startCauldron(aimed); // PLAY-19
  if (aimed && BENCH_MACHINES[stationOf(aimed.block)]) return void this.startBench(aimed, stationOf(aimed.block));
  if (aimed && stationOf(aimed.block)) return void this.ui.openBench('', stationOf(aimed.block), aimed);
  // And at a painting, Place makes it where you wake (playtest, P1).
  if (aimed && isPainting(aimed.block)) return void this.setSpawn(aimed);
  // At a bed, Place sleeps the night through (owner, 15 November).
  if (aimed && bedPart(aimed.block)) return void this.sleep(aimed);
  // At a war tent, Place makes camp there; at the dark god's altar, the oath.
  if (aimed && isTent(aimed.block)) return void this.makeCamp(aimed);
  if (aimed && aimed.block === NIGHTSTONE_ORE && this.isAltar(aimed)) return void this.swearOath();
  // At an anchor tower's lift (or one on the island), up or down it goes.
  if (aimed && aimed.block === SKY_LIFT) return void this.rideLift(aimed);
  // The way out of the god's cube.
  if (aimed && aimed.block === WAY_OUT) return void this.leaveCube();
  // A time machine: to the Past, or home from it.
  if (aimed && aimed.block === TIME_MACHINE) return void this.useTimeMachine();
  // The Archive, in the Future's university: its knowledge, to take home.
  if (aimed && aimed.block === ARCHIVE) return void this.readArchive();
  // A rival city's standard (Battle): take it, once its garrison's beaten.
  if (aimed && aimed.block === WAR_STANDARD) return void this.takeStandard(aimed);
  // And at a catapult, Place takes hold of it.
  if (aimed && isCatapult(aimed.block)) return void this.manCatapult(aimed);
  // A full bucket takes the button too, instead of placing a block.
  const override = PLACE_OVERRIDE[this.selectedItemId] ?? (isFood(this.selectedItemId) ? 'throwSelected' : null);
  if (override) return void this[override]();
  this.placeBlock();
}

/**
 * The line through a point on the screen, as an eye and a direction to aim
 * along instead of the crosshair's. Out of first person it starts level
 * with your head rather than back at the camera, so it reaches as far.
 */
export function rayThrough(clientX, clientY) {
  const rect = this.renderer?.domElement.getBoundingClientRect();
  if (!rect?.width || !rect.height) return null;
  const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  const caster = new THREE.Raycaster();
  caster.setFromCamera(ndc, this.camera);
  const { origin, direction } = caster.ray;
  const along = Math.max(0, this.player.eyePosition().sub(origin).dot(direction));
  return { eye: origin.clone().addScaledVector(direction, along), dir: direction.clone() };
}

/** Runs `fn` with you looking along `ray` — every aim it makes reads it. */
export function aimedAlong(ray, fn) {
  const p = this.player;
  const had = { eyePosition: Object.hasOwn(p, 'eyePosition') && p.eyePosition, lookDirection: Object.hasOwn(p, 'lookDirection') && p.lookDirection };
  p.eyePosition = () => ray.eye.clone();
  p.lookDirection = () => ray.dir.clone();
  try { return fn(); } finally {
    for (const [k, v] of Object.entries(had)) { if (v) p[k] = v; else delete p[k]; }
  }
}

export function recomputeVertical() {
  this.player.externalUp = (this.upHeld ? 1 : 0) - (this.downHeld ? 1 : 0);
}

/**
 * Applies a change from the controls settings: keys, field of view, mouse
 * speed and volume, remembered in this browser (config/controls.js).
 */
export function applyControls(next) {
  this.controls = { ...this.controls, ...next };
  saveControls(this.controls);
  if (this.player) this.player.binds = { ...this.controls.keys };
  if (this.player && next.view) this.player.view = next.view;
  this.camera.fov = this.controls.fov;
  this.camera.updateProjectionMatrix();
  this.sound.setLevels(this.controls);
  this.ui?.applyTouchLayout(this.controls);
  if (this.player) this.player.autoJump = this.controls.autoJump === 'on';
  return this.controls;
}

/**
 * Presses on the picture while a machine is open go to it. On the window,
 * first: the touch look surface lies over the canvas, and would take a
 * drag for turning the camera. Presses on the machine's own bar are its own.
 */
export function bindMachinePointer() {
  const el = this.renderer.domElement;
  const ndc = (e) => { const r = el.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1]; };
  const on = (e) => this.closeUp?.active && !(this.closeUp.machine.barEl && this.closeUp.machine.barEl.contains(e.target));
  let down = false;
  window.addEventListener('pointerdown', (e) => {
    if (!on(e)) return;
    down = true;
    this.closeUp.machine.pointerDown?.(...ndc(e));
    e.preventDefault(); e.stopPropagation();
  }, true);
  window.addEventListener('pointermove', (e) => {
    if (!down || !this.closeUp?.active) return;
    this.closeUp.machine.pointerMove?.(...ndc(e));
    e.stopPropagation();
  }, true);
  const up = (e) => {
    if (!down) return;
    down = false;
    if (this.closeUp?.active) this.closeUp.machine.pointerUp?.();
    e.stopPropagation();
  };
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', up, true);
}

/** Your eyes → from behind → from in front → your eyes, remembered. */
export function cycleView() {
  if (!this.player) return;
  const view = nextView(this.player.view);
  this.player.view = view;
  this.applyControls({ view });
  this.ui?.toast({ kind: 'xp', title: VIEW_NAMES[view] });
}
