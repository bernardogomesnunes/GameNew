import * as THREE from 'three';
import { World, CHUNK_SIZE } from './world/World.js';
import { ChunkMesher, WIND } from './world/ChunkMesher.js';
import { PlayerController } from './player/PlayerController.js';
import { ROOFS_BY_ID, facingLabel } from './config/roofs.js';
import { CLEARS_BY_ID } from './config/clears.js';
import { SelectionHighlight } from './tools/SelectionHighlight.js';
import { BuildGhost } from './tools/BuildGhost.js';
import { strangersToDraw } from './render/strangersToDraw.js';
import { BuildSitesView } from './render/BuildSitesView.js';
import { loadModels } from './render/Models.js';
import { SettlerView, MAX as PEOPLE_MAX } from './render/SettlerView.js';
import { CloudAuth } from './net/CloudAuth.js';
import { CloudWorlds } from './net/CloudWorlds.js';
import { isCloudConfigured } from './net/cloudConfig.js';
import { DuiltGame } from './duilt/DuiltGame.js';
import { generateEndlessWorld } from './world/StarterWorld.js';
import { WORLD_HEIGHT } from './world/ChunkGen.js';
import { runStreamingWork } from './world/streamingWork.js';
import { FarTerrain } from './render/FarTerrain.js';
import { SkyClouds } from './render/SkyClouds.js';
import { sleepAt } from './world/sleep.js';
import { DayCycle, MORNING, daylightAt, gameDaysText } from './render/DayCycle.js';
import { Sound, soundOf } from './audio/Sound.js';
import { hear } from './audio/listen.js';
import { loadControls } from './config/controls.js';
import { LightManager } from './render/LightManager.js';
import { TemplateLibrary } from './prefabs/TemplateLibrary.js';
import { SymmetryTool } from './tools/SymmetryTool.js';
import { GamificationEngine } from './gamification/GamificationEngine.js';
import { SyncState } from './storage/WorldSync.js';
import { LocalWorlds } from './storage/LocalWorlds.js';
import { restoreWorldSnapshot } from './storage/WorldSnapshot.js';
import { CloseUp } from './render/CloseUp.js';
import { CounterMachine } from './render/CounterMachine.js';
import { CrucibleMachine } from './render/CrucibleMachine.js';
import { BenchMachine } from './render/BenchMachine.js';
import * as GameSave from './game/GameSave.js';
import * as GameLoad from './game/GameLoad.js';
import * as GameVehicles from './game/GameVehicles.js';
import * as GameBuild from './game/GameBuild.js';
import * as GameInput from './game/GameInput.js';
import * as GameWar from './game/GameWar.js';
import * as GameStructures from './game/GameStructures.js';
import { newWorldId } from './game/GameLoad.js';
export { staleAgainst, keepFailure, sendKeptFailures } from './game/GameSave.js';
export { progressionAhead } from './game/GameLoad.js';

import { loadSettings, saveSettings, QualityController, DISTANCES } from './render/graphics.js';
import { STRUCTURES_BY_ID, structureName } from './config/structures.js';
import { TerrainWorkerQueue } from './world/TerrainWorkerQueue.js';
import { exportWorldFile, exportVoxFile, parseWorldPayload, pickFile } from './storage/WorldExport.js';
import { UIManager } from './ui/UIManager.js';
import { EventBus } from './core/EventBus.js';
import { Diagnostics, describeGraphicsBackend } from './core/Diagnostics.js';
import { EconomyEngine } from './economy/EconomyEngine.js';
import { AIR, WATER, BLOCKS_BY_ID, bedPart, FACING_STEP, isFlowing, turns, doorPart, isChest, isLava, isLavaFlow, CHEST, isCatapult, isTrapdoor, isOpenTrapdoor, stationOf, isGate, isOpenGate, isPainting } from './config/blocks.js';
import { SAPLING } from './duilt/Saplings.js';
import { mushyOf } from './duilt/MushyLogs.js'; // PLAY-14..21
import { plantOf } from './config/fruitPlants.js'; // FRUIT-4
import { BOOSTS, COFFEE_SPEED } from './config/drinks.js';
import { SWIFT_SPEED } from './config/upgrades.js';
import { AvatarView } from './render/AvatarView.js';
import { GliderView, MachineView } from './render/GliderView.js';
import { TrainView } from './render/TrainView.js';
import { CartView } from './render/CartView.js';
import { FlameView } from './render/FlameView.js';
import { FireBreathView } from './render/FireBreathView.js';
import { SmokeView } from './render/SmokeView.js';
import { GrassView } from './render/GrassView.js';
import { ArrowView } from './render/ArrowView.js';
import { Arrows } from './world/Arrows.js';
import { HandView } from './render/HandView.js';
import { LAVA_PER_SECOND, fallDamage } from './survival/Health.js';
import { CrackView } from './render/CrackView.js';
import { LEAVES, leafHeld, orphanLeaves } from './world/leafDecay.js';
import { talkLine } from './config/talk.js';
import { cubeSite, cubeDesign, WAY_OUT, CUBE_SIZE } from './world/godCube.js';
import { TOOL_FOR, itemName, BARE_HANDS, FRUITS } from './config/items.js';
import { MOBS_BY_ID } from './config/mobs.js';
import { CROPS, cropOf } from './config/crops.js';
import { Mobs, rayBox, surfaceAt } from './world/Mobs.js';
import { Crowd, gatherCrowd } from './world/bodies.js';
import { landmarksFor, PLACE_NAMES } from './world/landmarks.js';
import { DRAGON_SCALE, DRAGON_CLAW, EGG_DRAGON } from './config/blocks.js';
import { LOOT } from './duilt/Loot.js';
import { Projectiles } from './world/Projectiles.js';
import { ProjectileView } from './render/ProjectileView.js';
import { Fireflies } from './world/Fireflies.js';
import { FireflyView } from './render/FireflyView.js';
import { GuardianView } from './render/GuardianView.js';
import { MODE_WORDS } from './world/Guardian.js';
import { tameInto } from './duilt/Ranch.js';
import { Wanderers, compass } from './world/Wanderers.js';
import { ArmyView, EngineView } from './render/ArmyView.js';
import { SKY_LIFT, STORAGE_CONTROLLER, STORAGE_INTERFACE, CHAIN, isTent, TIME_MACHINE, EGG_RAPTOR, EGG_TRIKE, EGG_LONGNECK, ARCHIVE, WAR_STANDARD } from './config/blocks.js';
import { inPast, pastArrival } from './world/past.js';
import { inFuture, futureArrival, FUTURE_GROUND } from './world/future.js';
import { FutureView } from './render/FutureView.js';
import { RECIPES } from './config/recipes.js';
import { Rivals } from './duilt/Rivals.js';
import { rivalSites, RIVAL_HEX } from './world/rivals.js';
import { skyFor, skyAt, liftAt, chainAt, SKY_REACH } from './world/skyKingdom.js';
import { CHAINS } from './duilt/SkyWar.js';
import { Suspicion, SUSPICION } from './duilt/Suspicion.js';
import { MarkerView } from './render/MarkerView.js';
import { SkyBeacon } from './render/SkyBeacon.js';
import { gradeRenderer, Motes } from './render/atmosphere.js';
import { SkyMist } from './render/SkyMist.js';
import { MODE_WORDS as ARMY_WORDS } from './world/Army.js';
import { INTRO } from './ui/StoryText.js';
import { SOLDIER } from './world/Defenders.js';
import { LAST_ROUND } from './config/war.js';
import { WaterFlow, LavaFlow } from './world/WaterFlow.js';
import { WANDERERS, NEWS } from './config/wanderers.js';
import { TRADERS_BY_ID } from './config/traders.js';
import { momentForPlace } from './config/moments.js';
import { MobView } from './render/MobView.js';
// The showcase (docs/history/plan-look-and-sound.md, section 1): see openShowcase.
import { ShowcaseView } from './render/ShowcaseView.js';
import { TITLE_SEED, TITLE_SITE, TITLE_TIME, TITLE_HERDS, titlePlaceBlocks, orbitPose, orbitHeight, messengerPath } from './world/titleScene.js';
import { SHOWCASE_SEED, SHOWCASE_TIMES, SHOWCASE_SPOTS_BY_ID, SHOWCASE_BUILDINGS, SHOWCASE_FIGURES, findShowcaseSite, flattenShowcase, placeBlocks, showcaseLabels, spotPose } from './world/showcase.js';
import { Defenders } from './world/Defenders.js';
import { WorldSession } from './storage/WorldSession.js';
import { buildAccountExport, downloadBlob, accountExportFilename } from './storage/AccountExport.js';
import { Army } from './world/Army.js';
import { Guardian } from './world/Guardian.js';
import { settlerName, settlerColour } from './config/settlers.js';
import { loadingAside } from './ui/loading.js';

export const REACH = 7;
/** Which dinosaur is in which egg (world/past.js). */
export const EGG_TYPE = { [EGG_RAPTOR]: 'raptor', [EGG_TRIKE]: 'trike', [EGG_LONGNECK]: 'longneck', [EGG_DRAGON]: 'dragon_egg' };
/** What a dragon egg hatches into: one of the three smaller dragons, by where it was laid. */
const HATCHLINGS = ['fire_drake', 'frost_wyvern', 'storm_dragon'];
/**
 * Your dinosaurs (Game.tickPack): how far the whistle carries; how close
 * they keep; how far from them (and you) they'll go for something; how far
 * behind one catches you up (or how long getting no nearer); how far off
 * one's lost to you; and how near it has to be to come through time.
 */
/** How near you a foe must be for your dragon to go for it. */
const PET_FIGHT = 28;
const WHISTLE_REACH = 60, PACK_HEEL = 4, PACK_FIGHT = 14, PACK_CATCH_UP = 40, PACK_STUCK = 3, PACK_LOST = 120, PACK_TRAVEL = 24;
/** Out in the world, who'll stop for a word (config/talk.js). */
const TALKERS = new Set(['explorer', 'messenger', 'tribe', 'citizen', 'city_guard', 'futurian', 'caravaner', 'mossfolk']);
/** How much land round the title scene's middle, and under its camera, is ready before the worlds screen shows. */
const TITLE_READY_REACH = 24, TITLE_EYE_REACH = 16;
/** How fast the touch stick walks at its rim, against a key's full walking pace. */
const TOUCH_WALK = 0.8;
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
/** How far past DEEP_RANGE a chunk's deep mesh is kept, so walking back and forth doesn't rebuild it. */
const DEEP_SLACK = 32;
/** Milliseconds a frame for making and drawing land while the loading screen is up. */
const BOOT_BUDGET_MS = 40;
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
// What a farm animal will follow you for. See Mobs.think.
const LURES = new Set(['vegetables', ...FRUITS, ...CROPS.flatMap((c) => [c.produce, `seeds_${c.kind}`])]);
/** How often planted crops are brought up to the stage their age says. */
const CROP_TICK_SECONDS = 2;
/** How near you come to a place, past its edge, to have found it. */
const FOUND_REACH = 24;
const TAME_EVERY_MS = 1000; // how often pens take in animals led into them
// How often running water advances a block. See world/WaterFlow.js.
const WATER_STEP_SECONDS = 0.25;
// Lava is thicker: a block a second.
const LAVA_STEP_SECONDS = 1;
/** A gate or either half of a door: something Place swings rather than builds on. */
export const swings = (id) => isGate(id) || !!doorPart(id) || isTrapdoor(id);
/** What Place does to a door or gate — "Open" or "Close" — or null for anything else. */
export function swingLabel(id) {
  if (isGate(id)) return isOpenGate(id) ? 'Close' : 'Open';
  if (isChest(id) || id === STORAGE_CONTROLLER || id === STORAGE_INTERFACE) return 'Open';
  if (stationOf(id)) return 'Use';
  if (isCatapult(id)) return 'Man';
  if (isPainting(id)) return 'Home';
  if (id === TIME_MACHINE) return 'Travel';
  if (id === ARCHIVE) return 'Read';
  if (id === WAR_STANDARD) return 'Take';
  if (id === WAY_OUT) return 'Leave';
  if (isTrapdoor(id)) return isOpenTrapdoor(id) ? 'Close' : 'Open';
  if (id === SKY_LIFT) return 'Ride';
  const door = doorPart(id);
  return door ? (door.open ? 'Close' : 'Open') : null;
}
// The Sky Kingdom's people are planned and put on the island this close to it.
const SKY_PEOPLE = 240;
// The account's worlds as last seen, kept on the device so the worlds
// screen can show them the instant it opens (Game.knownWorlds).
const WORLDS_SEEN = 'voxelgame:worlds-seen';
/** Most recently touched first. */
const sortWorlds = (rows) => rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

// Radians a pixel of finger turns you when you drag the picture on a phone.
const TOUCH_LOOK = 0.005;

// What gives a disguise away: the Stone Kingdom's armour, worn or in hand, and the Black Ring or Nightstone in hand.
const DARK_GEAR = /^(armour_stone_|ring_black$|nightstone$|banner_black$)/;
// An attack on it is on while you're this close to its middle — the
// island and its anchor towers — and over once you're this far off again.
export const SKY_ATTACK_IN = SKY_REACH + 10, SKY_ATTACK_OUT = SKY_REACH + 120;
// The rings (Phase 7c): what the White Ring adds to your step and your
// jump, and what the Black Ring's spark does to whoever hits you.
const WHITE_RING_SPEED = 1.2;
const WHITE_RING_JUMP = 1.3;

/** On horseback: this much faster than on foot (SEAT_HEIGHT, how much higher you sit, is in game/GameVehicles.js). */
const RIDE_SPEED = 1.9;
/** Leaves with no tree fall this long after it goes, spread over the next few seconds. */
const LEAF_DECAY_MIN_MS = 500, LEAF_DECAY_SPREAD_MS = 4000;
/** How long a dig's cracks stay in sight after the last swing at it. */
const CRACK_LINGER_MS = 450;

export const CREATIVE = 'creative';
export const DUILT = 'duilt';
/** A new Battle world: Duilt's rules, with rivals (see newWorld). Saved as a Duilt world. */
export const BATTLE = 'battle';

export class Game {
  constructor(container) {
    this.diagnostics=new Diagnostics();
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
    this.graphicsBackend = describeGraphicsBackend(this.renderer);
    this.coarse = coarse;
    this.quality = new QualityController({
      cap: Math.min(window.devicePixelRatio || 1, 2),
      onChange: (r) => { this.renderer.setPixelRatio(r); this.onResize(); },
    });
    if (this.graphics.resolution !== 'auto' || !this.graphics.smoothing) {
      this.quality.pin(this.graphics.resolution === 'auto' ? this.quality.resolution : this.graphics.resolution);
    }
    this.renderer.setPixelRatio(this.quality.resolution);
    // Tone mapping and a small saturation lift (render/atmosphere.js).
    gradeRenderer(this.renderer);
    this.canvasRoot.appendChild(this.renderer.domElement);
    // A soft violet vignette over the picture, the last touch of a shader
    // pack's grade (asked for: Complementary shaders as inspiration). Drawn
    // by the page, over the canvas, so it costs the GPU nothing.
    const vignette = document.createElement('div');
    vignette.className = 'vignette';
    this.canvasRoot.appendChild(vignette);

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
    // Effects, ambience and music, each with its own slider (audio/Sound.js).
    this.sound = new Sound(this.controls);
    // Hurt, by anything: a grunt — and lava's hiss with it.
    this.bus.on('health:change', ({ hurt, cause }) => { if (hurt) this.sound.hurt(cause); });
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
    // Sealed caves are only meshed near you — see updateDeep.
    this.mesher.deepNear = (chunk) => this.chunkDistSq(chunk) <= DEEP_RANGE * DEEP_RANGE;
    this.mesher.ao = this.graphics.ao !== false;
    this.farTerrain = new FarTerrain(this.scene);
    this.clouds = new SkyClouds(this.scene);
    // Those three lights, the sky and the clouds all follow the time of day.
    this.dayCycle = new DayCycle(this.scene, { ambient, sun, hemi, clouds: this.clouds });
    // The air: pollen in the sun, and mist and cloud round the Sky Kingdom.
    this.motes = new Motes(this.scene);
    this.skyMist = new SkyMist(this.scene);
    this.setAtmosphere(this.graphics.atmosphere !== false);
    this.lights = new LightManager(this.scene);
    this.gamification?.dispose?.();
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
    this.crackView = new CrackView(this.scene);
    this.hoverBox = this.buildWireBox(0xffffff, 1.01);
    this.hoverBox.visible = false;
    this.scene.add(this.hoverBox);
    this.selection = new SelectionHighlight(this.scene);
    // IMP-26: the outline of every building being put up.
    this.buildSites = new BuildSitesView(this.scene);
    this.ghost = new BuildGhost(this.scene);
    this.settlerView = new SettlerView(this.scene);
    this.mobView = new MobView(this.scene);
    // You (playtest, P3 and P7): your figure, seen out of first person, and
    // what's in your hand in first person.
    this.avatarView = new AvatarView(this.scene);
    this.glider = new GliderView(this.scene);
    this.cartView = new CartView(this.scene);
    this.machineView = new MachineView(this.scene);
    this.trainView = new TrainView(this.scene);
    this.flames = new FlameView(this.scene);
    this.fireBreath = new FireBreathView(this.scene);
    this.smoke = new SmokeView(this.scene);
    this.grass = new GrassView(this.scene);
    this.arrowView = new ArrowView(this.scene);
    this.handView = new HandView(this.scene, this.camera);
    // Hermit, bandits, explorers, messengers — drawn like settlers.
    this.wanderView = new SettlerView(this.scene, 'wanderers');
    this.skyBeacon = new SkyBeacon(this.scene);
    // In disguise on the island: how near you are to being seen through,
    // and the ? and ! over the guards' heads (duilt/Suspicion.js).
    this.suspicion = new Suspicion();
    this.markerView = new MarkerView(this.scene);
    this.projectileView = new ProjectileView(this.scene);
    this.fireflyView = new FireflyView(this.scene);
    this.guardianView = new GuardianView(this.scene);
    // The Stone Kingdom's rams, catapults and beast, and its arrows.
    this.armyView = new ArmyView(this.scene);
    this.engineView = new EngineView(this.scene);
    // The Future's trams and flying cars.
    this.futureView = new FutureView(this.scene);
    // Your soldiers and tower archers (the defence buildings).
    this.defenderView = new SettlerView(this.scene, 'defenders');
    // Your army, on the dark path.
    this.warriorView = new SettlerView(this.scene, 'warriors');
    // The showcase's labels and its two guardians — see openShowcase.
    this.showcaseView = new ShowcaseView(this.scene);
    this.showcase = null;
    // Every animal, person and vehicle's model (render/Models.js): the views
    // draw their boxes until these are in.
    this.modelsLoaded = loadModels();
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
    // It's the title scene's own world (openTitle), made once: this used to
    // make a world of its own first, only for openTitle to throw it away and
    // make another — a third of the wait before the game appeared.
    this.newWorld({ mode: CREATIVE, name: 'Title', silent: true, scenery: true, title: true, seed: TITLE_SEED });
    this.bootWorld = this.world;

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
    // A saved build, queued: where it would go and which way round, before it goes.
    this.templateGhost = new BuildGhost(this.scene);
    this.templateGhostKey = null;
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
    this.bus.on('places:emerged', ({places}) => {
      if(this.wanderers) this.wanderers.landmarks.push(...places);
      this.ui?.toast({kind:'challenge',title:'New travellers have settled nearby',body:'Explore beyond your settlement to find their camps.'});
    });
    this.bus.on('health:died', ({ cause }) => this.die(cause));
    // University research takes days (DuiltGame.startStudy): said when it starts and when it's done.
    this.bus.on('research:started', ({ name, days, station }) => this.ui?.toast({ kind: 'challenge', title: `Researching ${name}`, body: `Takes ${gameDaysText(days)} — see how it's going at the ${station === 'armoury' ? 'armoury' : 'university'}` }));
    this.bus.on('research:finished', ({ name, station }) => {
      this.ui?.toast({ kind: 'achievement', title: `Research done: ${name}`, body: `The ${station === 'armoury' ? 'armoury' : 'university'} is free for the next thing` });
      this.editedAt = Date.now();
    });
    // PLAY-12 (docs/design/play-12.md): a company's march, said at each step.
    this.bus.on('march:started', ({ company, rivalName, count }) => this.ui?.toast({ kind: 'challenge', title: `${company} marched on ${rivalName}`, body: `${count} soldiers. They arrive in a game day.`, duration: 6000 }));
    this.bus.on('march:fought', ({ company, rivalName, won, refused, lost, gold }) => {
      this.editedAt = Date.now();
      if (refused) return void this.ui?.toast({ kind: 'xp', title: `${company} turned back`, body: `${rivalName}'s city was already taken.` });
      this.ui?.toast(won
        ? { kind: 'achievement', title: `${company} took ${rivalName}`, body: `${gold} gold. ${lost} fell.`, duration: 8000 }
        : { kind: 'xp', title: `${company} lost at ${rivalName}`, body: `${lost} fell. The rest are walking home.`, duration: 8000 });
    });
    this.bus.on('march:home', ({ company, placed, lost }) => {
      this.editedAt = Date.now();
      this.defenceSyncedAt = 0;
      this.ui?.toast({ kind: 'xp', title: `${company} is home`, body: lost ? `${placed} back at their posts, ${lost} with nowhere to go.` : `${placed} back at their posts.` });
    });
    // Story moments (config/moments.js): the first stranger who stays, the first altar.
    this.bus.on('settler:arrived', () => this.tellMoment('first_settler'));
    // The collection book (duilt/Collection.js): a share of it collected.
    this.bus.on('collection:milestone', ({ at, coins, item, have }) => {
      this.ui?.toast(item
        ? { kind: 'achievement', title: 'The collection book is full!', body: `Every item there is — ${have} of them. +${coins} coins, and the Collector's Crown`, duration: 9000 }
        : { kind: 'achievement', title: `Collection book: ${Math.round(at * 100)}%`, body: `${have} items collected. +${coins} coins` });
    });
    // A train at a station (world/Passengers.js): who got off and paid, and who got on.
    this.bus.on('train:stop', ({ station, off, fare, on, to }) => {
      const where = station.key === 'home' ? 'Home' : station.name;
      const parts = [];
      if (off) parts.push(`${off} got off and paid ${fare} coin${fare === 1 ? '' : 's'}`);
      if (on) parts.push(`${on} got on for ${to.map((n) => (n === 'home' ? 'your settlement' : n)).join(' and ')}`);
      this.ui?.toast({ kind: 'challenge', title: `Station: ${where}`, body: parts.join(' · ') });
    });
    this.bus.on('structure:claimed', ({ structure } = {}) => { if (structure?.type === 'temple') this.tellMoment('first_temple'); });
    // What a building comes with — a town hall's storage controller.
    this.bus.on('structure:gift', ({ structure, items } = {}) => {
      const [id, n] = Object.entries(items ?? {})[0] ?? [];
      if (!id) return;
      this.ui.toast({
        kind: 'challenge',
        title: `${n} ${itemName(id).toLowerCase()} for your ${structureName(structure?.type).toLowerCase()}`,
        body: 'Put it down anywhere — Place on it to reach every storehouse.',
      });
    });
    // A purchase from a market's trader changes the bag: save it with the world.
    this.bus.on('duilt:bought', () => { this.editedAt = Date.now(); });
    this.bus.on('duilt:boostEnded', ({ boost }) => this.ui?.toast({
      kind: 'xp', title: `Your ${BOOSTS[boost].name.toLowerCase()} has worn off`, body: BOOSTS[boost].says,
    }));
    this.bus.on('guardian:summoned', ({ guardian }) => this.ui?.toast({
      kind: 'achievement',
      title: `${guardian.name}, ${guardian.spec.about}, has come to you`,
      body: guardian.ring === 'white'
        ? 'It follows you, fights for you and heals you while you\'re near. Tap it to tell it to stay or to hunt.'
        : 'It follows you and fights for you, and bandits that come near it lose their nerve. Tap it to tell it to stay or to hunt.',
    }));
    // A shield turned a blow aside (IMP-23): the clang of it, and it jerks up.
    this.bus.on('shield:blocked', () => { this.sound?.strike({ weapon: true }); this.handView?.block(); this.avatarView?.block(); });
    this.bus.on('war:declared', () => {
      const dir = this.kingdomDirection();
      this.ui?.toast({
        kind: 'achievement',
        title: 'The Stone Kingdom has declared war on you',
        body: `Your border is open — and their army is gathering${dir ? ` to the ${dir}` : ''}. Ten rounds are coming. Build walls, ready your swords, and forge your ring while you can.`,
      });
    });
    this.bus.on('war:truce', () => {
      for (const p of this.wanderers?.list ?? []) if (p.war) p.retreat = true;
      this.ui?.toast({
        kind: 'achievement',
        title: 'The Stone King calls his army home',
        body: 'The Black Ring is on your hand. You\'re his ally now — the war is over.',
      });
    });
    this.bus.on('ring:forged', ({ ring }) => this.ui?.toast({
      kind: 'achievement',
      title: ring === 'white' ? 'You forged the White Ring' : 'You forged the Black Ring',
      body: ring === 'white'
        ? 'Put it on to move faster and jump higher. The Black Ring is closed to you now.'
        : 'Put it on, and whoever strikes you feels it. The White Ring is closed to you now.',
    }));

    this.wireInput();
    this.wireSaveOnLeave();
    this.lastAutosave = performance.now();
    this.clock = new THREE.Clock();
    // What's behind the worlds screen the game opens on — see openTitle.
    this.openTitle();
    this.renderer.setAnimationLoop(() => this.safeTick());
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
  /**
   * One frame, and what happens when one fails. A frame that throws used to
   * leave the game frozen, or a phone that took the 3D canvas back left a
   * white screen (reported directly: "the game breaks and I see a white
   * screen") — with the world unsaved since the last autosave. Now three
   * failures in a row, or the canvas taken away, saves and says so.
   */
  safeTick() {
    try {
      this.tick();
      this.tickErrors = 0;
    } catch (err) {
      console.error(err);
      // Reporting is best effort: it must never suppress recovery or saving.
      try { this.diagnostics?.recordError(err, 'frame-error'); } catch { /* malformed error/report */ }
      // Boot can fail before a successful tick has initialised the counter.
      this.tickErrors ??= 0;
      if (++this.tickErrors >= 3) this.crashed(err?.message || String(err), { kind: 'frame-error', error: err });
    }
  }

  /** Small snapshots on request/failure; no world contents or account identifiers. */
  diagnosticContext() {
    const info = this.renderer?.info;
    let contextLost = null, pixelRatio = null;
    try { contextLost = this.renderer?.getContext?.().isContextLost(); } catch { /* context may be unavailable */ }
    try { pixelRatio = this.renderer?.getPixelRatio?.() ?? null; } catch { /* renderer may be unavailable */ }
    return { mode:this.mode, loadedChunks:this.world?.chunks.size??0,
      queues:{generate:this.genQueue?.length??0,remesh:this.remeshQueue?.size??0},
      graphics:{distance:this.renderDistance,pixelRatio,
        backend:this.graphicsBackend??null,contextLost},
      renderer:{calls:info?.render.calls??null,triangles:info?.render.triangles??null,
        geometries:info?.memory.geometries??null,textures:info?.memory.textures??null} };
  }

  /** The game can't go on: save what there is, and say so with a way back. */
  crashed(reason, { kind = 'game-error', error = reason } = {}) {
    if (this.crashedWith) return;
    this.crashedWith = reason;
    try { this.diagnostics?.recordCrash(error, kind, this.diagnosticContext()); } catch { /* recovery takes priority over diagnostics */ }
    this.renderer.setAnimationLoop(null);
    let saved = false;
    try { saved = this.saveNow(); } catch (err) { console.error(err); }
    const box = document.createElement('div');
    box.id = 'crash';
    box.setAttribute('role', 'alertdialog');
    box.innerHTML = `<div class="crash-card">
      <h2>The game stopped</h2>
      <p class="crash-state">${saved ? 'Saving your world…' : this.saveError ? 'Could not save your world.' : 'Nothing to save.'}</p>
      <button type="button" class="primary">Reload</button>
      <button type="button" class="secondary" data-crash-report>Download diagnostics</button>
      <p class="crash-why"></p>
    </div>`;
    box.querySelector('.crash-why').textContent = reason;
    box.querySelector('button').addEventListener('click', () => location.reload());
    box.querySelector('[data-crash-report]').addEventListener('click', (event) => {
      try { this.diagnostics?.download(this.diagnosticContext()); }
      catch { event.currentTarget.textContent = 'Diagnostics unavailable'; event.currentTarget.disabled = true; }
    });
    // Inside the game's own container: full screen, nothing outside it shows.
    (this.container ?? document.body).appendChild(box);
    if (saved) {
      const state = box.querySelector('.crash-state');
      const reload=box.querySelector('button');reload.disabled=true;
      Promise.resolve(this.saving).then(result=>{
        state.textContent = result!==false&&!this.saveError ? 'Your world is saved.'
          : this.worldIsLocal ? `Could not save your world. ${this.saveError??'Try saving again before reloading.'}`
          : 'Saved on this phone — it goes up to your account when you reload.';
      },()=>{state.textContent='Could not confirm the save. Try saving again before reloading.';})
        .finally(()=>{reload.disabled=false;});
    }
  }

  wireSaveOnLeave(...args) { return GameSave.wireSaveOnLeave.apply(this, args); }
  discardCurrentWorld(...args) { return GameSave.discardCurrentWorld.apply(this, args); }
  leaveWorld(...args) { return GameSave.leaveWorld.apply(this, args); }
  saveAndWait(...args) { return GameSave.saveAndWait.apply(this, args); }
  saveNow(...args) { return GameSave.saveNow.apply(this, args); }
  saveLocally(...args) { return GameSave.saveLocally.apply(this, args); }
  flush(...args) { return GameSave.flush.apply(this, args); }
  uploadFailed(...args) { return GameSave.uploadFailed.apply(this, args); }
  uploadLanded(...args) { return GameSave.uploadLanded.apply(this, args); }
  keepSafe(...args) { return GameSave.keepSafe.apply(this, args); }
  dropSafeCopy(...args) { return GameSave.dropSafeCopy.apply(this, args); }
  sendUnsent(...args) { return GameSave.sendUnsent.apply(this, args); }
  withLoading(...args) { return GameLoad.withLoading.apply(this, args); }
  openWorld(...args) { return GameLoad.openWorld.apply(this, args); }
  cloudList(...args) { return GameLoad.cloudList.apply(this, args); }
  saveState(...args) { return GameLoad.saveState.apply(this, args); }
  loadFromData(...args) { return GameLoad.loadFromData.apply(this, args); }
  saveToCloud(...args) { return GameLoad.saveToCloud.apply(this, args); }
  restoreFromCloud(...args) { return GameLoad.restoreFromCloud.apply(this, args); }
  restoreFromLocal(...args) { return GameLoad.restoreFromLocal.apply(this, args); }
  hasFlyingMachine(...args) { return GameVehicles.hasFlyingMachine.apply(this, args); }
  wearingPlainer(...args) { return GameVehicles.wearingPlainer.apply(this, args); }
  wearSelected(...args) { return GameVehicles.wearSelected.apply(this, args); }
  setDownMachine(...args) { return GameVehicles.setDownMachine.apply(this, args); }
  setDownTrain(...args) { return GameVehicles.setDownTrain.apply(this, args); }
  railCarHint(...args) { return GameVehicles.railCarHint.apply(this, args); }
  trainTarget(...args) { return GameVehicles.trainTarget.apply(this, args); }
  useTrain(...args) { return GameVehicles.useTrain.apply(this, args); }
  pickUpTrain(...args) { return GameVehicles.pickUpTrain.apply(this, args); }
  drive(...args) { return GameVehicles.drive.apply(this, args); }
  leaveTrain(...args) { return GameVehicles.leaveTrain.apply(this, args); }
  tickDrive(...args) { return GameVehicles.tickDrive.apply(this, args); }
  ridersText(...args) { return GameVehicles.ridersText.apply(this, args); }
  machineTarget(...args) { return GameVehicles.machineTarget.apply(this, args); }
  pickUpMachine(...args) { return GameVehicles.pickUpMachine.apply(this, args); }
  pilot(...args) { return GameVehicles.pilot.apply(this, args); }
  leaveMachine(...args) { return GameVehicles.leaveMachine.apply(this, args); }
  tickPilot(...args) { return GameVehicles.tickPilot.apply(this, args); }
  wireFlight(...args) { return GameVehicles.wireFlight.apply(this, args); }
  horseTarget(...args) { return GameVehicles.horseTarget.apply(this, args); }
  useHorse(...args) { return GameVehicles.useHorse.apply(this, args); }
  startRide(...args) { return GameVehicles.startRide.apply(this, args); }
  stopRide(...args) { return GameVehicles.stopRide.apply(this, args); }
  tickRide(...args) { return GameVehicles.tickRide.apply(this, args); }
  setBreaking(...args) { return GameBuild.setBreaking.apply(this, args); }
  tickBreaking(...args) { return GameBuild.tickBreaking.apply(this, args); }
  setPlacing(...args) { return GameBuild.setPlacing.apply(this, args); }
  tickPlacing(...args) { return GameBuild.tickPlacing.apply(this, args); }
  wandPlace(...args) { return GameBuild.wandPlace.apply(this, args); }
  saveTemplate(...args) { return GameBuild.saveTemplate.apply(this, args); }
  updateTemplatePreview(...args) { return GameBuild.updateTemplatePreview.apply(this, args); }
  stampTemplate(...args) { return GameBuild.stampTemplate.apply(this, args); }
  clearPending(...args) { return GameBuild.clearPending.apply(this, args); }
  buildUnderCrosshair(...args) { return GameBuild.buildUnderCrosshair.apply(this, args); }
  turnTemplate(...args) { return GameBuild.turnTemplate.apply(this, args); }
  turnRoof(...args) { return GameBuild.turnRoof.apply(this, args); }
  clearTarget(...args) { return GameBuild.clearTarget.apply(this, args); }
  runClear(...args) { return GameBuild.runClear.apply(this, args); }
  updateClearPreview(...args) { return GameBuild.updateClearPreview.apply(this, args); }
  roofTarget(...args) { return GameBuild.roofTarget.apply(this, args); }
  roofRelay(...args) { return GameBuild.roofRelay.apply(this, args); }
  roofEave(...args) { return GameBuild.roofEave.apply(this, args); }
  stampRoof(...args) { return GameBuild.stampRoof.apply(this, args); }
  updateRoofPreview(...args) { return GameBuild.updateRoofPreview.apply(this, args); }
  stampAnchor(...args) { return GameBuild.stampAnchor.apply(this, args); }
  clearOfPlayer(...args) { return GameBuild.clearOfPlayer.apply(this, args); }
  fitInsideLand(...args) { return GameBuild.fitInsideLand.apply(this, args); }
  raycast(...args) { return GameBuild.raycast.apply(this, args); }
  toolAim(...args) { return GameBuild.toolAim.apply(this, args); }
  pointInFront(...args) { return GameBuild.pointInFront.apply(this, args); }
  blockAvailability(...args) { return GameBuild.blockAvailability.apply(this, args); }
  computeTargets(...args) { return GameBuild.computeTargets.apply(this, args); }
  chiselBlock(...args) { return GameBuild.chiselBlock.apply(this, args); }
  breakDelayFor(...args) { return GameBuild.breakDelayFor.apply(this, args); }
  breakBlock(...args) { return GameBuild.breakBlock.apply(this, args); }
  lookFacing(...args) { return GameBuild.lookFacing.apply(this, args); }
  placedBlock(...args) { return GameBuild.placedBlock.apply(this, args); }
  placeBlock(...args) { return GameBuild.placeBlock.apply(this, args); }
  mushyHint(...args) { return GameBuild.mushyHint.apply(this, args); }
  withPlants(...args) { return GameBuild.withPlants.apply(this, args); }
  pickFruitPlant(...args) { return GameBuild.pickFruitPlant.apply(this, args); }
  fruitPlantHint(...args) { return GameBuild.fruitPlantHint.apply(this, args); }
  saplingHint(...args) { return GameBuild.saplingHint.apply(this, args); }
  withUprooted(...args) { return GameBuild.withUprooted.apply(this, args); }
  withDoorHalves(...args) { return GameBuild.withDoorHalves.apply(this, args); }
  withBedHalves(...args) { return GameBuild.withBedHalves.apply(this, args); }
  blockOverlapsPlayerAABB(...args) { return GameBuild.blockOverlapsPlayerAABB.apply(this, args); }
  applyChanges(...args) { return GameBuild.applyChanges.apply(this, args); }
  useWand(...args) { return GameWar.useWand.apply(this, args); }
  soldierOrder(...args) { return GameWar.soldierOrder.apply(this, args); }
  marchCompany(...args) { return GameWar.marchCompany.apply(this, args); }
  trainSoldier(...args) { return GameWar.trainSoldier.apply(this, args); }
  async openPeerBattle(...args) { return GameWar.openPeerBattle.apply(this, args); }
  strikeCooldown(...args) { return GameWar.strikeCooldown.apply(this, args); }
  blowDamage(...args) { return GameWar.blowDamage.apply(this, args); }
  hitMob(...args) { return GameWar.hitMob.apply(this, args); }
  mobFell(...args) { return GameWar.mobFell.apply(this, args); }
  blowKnock(...args) { return GameWar.blowKnock.apply(this, args); }
  shootBow(...args) { return GameWar.shootBow.apply(this, args); }
  bowReady(...args) { return GameWar.bowReady.apply(this, args); }
  startDraw(...args) { return GameWar.startDraw.apply(this, args); }
  drawPower(...args) { return GameWar.drawPower.apply(this, args); }
  releaseDraw(...args) { return GameWar.releaseDraw.apply(this, args); }
  setZoom(...args) { return GameWar.setZoom.apply(this, args); }
  tickBow(...args) { return GameWar.tickBow.apply(this, args); }
  arrowTarget(...args) { return GameWar.arrowTarget.apply(this, args); }
  arrowHit(...args) { return GameWar.arrowHit.apply(this, args); }
  banditTarget(...args) { return GameWar.banditTarget.apply(this, args); }
  hitBandit(...args) { return GameWar.hitBandit.apply(this, args); }
  guardianEnemy(...args) { return GameWar.guardianEnemy.apply(this, args); }
  focusGuardian(...args) { return GameWar.focusGuardian.apply(this, args); }
  banditFell(...args) { return GameWar.banditFell.apply(this, args); }
  personKilled(...args) { return GameWar.personKilled.apply(this, args); }
  collectFallen(...args) { return GameWar.collectFallen.apply(this, args); }
  guardianTarget(...args) { return GameWar.guardianTarget.apply(this, args); }
  commandGuardian(...args) { return GameWar.commandGuardian.apply(this, args); }
  tickGuardian(...args) { return GameWar.tickGuardian.apply(this, args); }
  banditHits(...args) { return GameWar.banditHits.apply(this, args); }
  banditSteals(...args) { return GameWar.banditSteals.apply(this, args); }
  settlementCentre(...args) { return GameWar.settlementCentre.apply(this, args); }
  kingdomDirection(...args) { return GameWar.kingdomDirection.apply(this, args); }
  tickWar(...args) { return GameWar.tickWar.apply(this, args); }
  warComing(...args) { return GameWar.warComing.apply(this, args); }
  warTracking(...args) { return GameWar.warTracking.apply(this, args); }
  sendRound(...args) { return GameWar.sendRound.apply(this, args); }
  watchRound(...args) { return GameWar.watchRound.apply(this, args); }
  syncRivals(...args) { return GameWar.syncRivals.apply(this, args); }
  battleWelcome(...args) { return GameWar.battleWelcome.apply(this, args); }
  tickRivals(...args) { return GameWar.tickRivals.apply(this, args); }
  sendRivals(...args) { return GameWar.sendRivals.apply(this, args); }
  watchRivals(...args) { return GameWar.watchRivals.apply(this, args); }
  takeStandard(...args) { return GameWar.takeStandard.apply(this, args); }
  siegeBreak(...args) { return GameWar.siegeBreak.apply(this, args); }
  enemyThrows(...args) { return GameWar.enemyThrows.apply(this, args); }
  shutGates(...args) { return GameWar.shutGates.apply(this, args); }
  tickDefence(...args) { return GameWar.tickDefence.apply(this, args); }
  syncDefence(...args) { return GameWar.syncDefence.apply(this, args); }
  crewThrows(...args) { return GameWar.crewThrows.apply(this, args); }
  defenderHits(...args) { return GameWar.defenderHits.apply(this, args); }
  soldierHit(...args) { return GameWar.soldierHit.apply(this, args); }
  isAltar(...args) { return GameWar.isAltar.apply(this, args); }
  swearOath(...args) { return GameWar.swearOath.apply(this, args); }
  makeCamp(...args) { return GameWar.makeCamp.apply(this, args); }
  tickSkyAttack(...args) { return GameWar.tickSkyAttack.apply(this, args); }
  skyAttackLost(...args) { return GameWar.skyAttackLost.apply(this, args); }
  skyKingDown(...args) { return GameWar.skyKingDown.apply(this, args); }
  skyFalls(...args) { return GameWar.skyFalls.apply(this, args); }
  cutChainAt(...args) { return GameWar.cutChainAt.apply(this, args); }
  tickSinking(...args) { return GameWar.tickSinking.apply(this, args); }
  expeditionState(...args) { return GameWar.expeditionState.apply(this, args); }
  expeditionCampSpot(...args) { return GameWar.expeditionCampSpot.apply(this, args); }
  sendExpedition(...args) { return GameWar.sendExpedition.apply(this, args); }
  makeExpeditionCamp(...args) { return GameWar.makeExpeditionCamp.apply(this, args); }
  joinExpedition(...args) { return GameWar.joinExpedition.apply(this, args); }
  commandArmy(...args) { return GameWar.commandArmy.apply(this, args); }
  tickArmy(...args) { return GameWar.tickArmy.apply(this, args); }
  takeRations(...args) { return GameWar.takeRations.apply(this, args); }
  blowHorn(...args) { return GameWar.blowHorn.apply(this, args); }
  manCatapult(...args) { return GameWar.manCatapult.apply(this, args); }
  letGo(...args) { return GameWar.letGo.apply(this, args); }
  cupOf(...args) { return GameWar.cupOf.apply(this, args); }
  catapultTarget(...args) { return GameWar.catapultTarget.apply(this, args); }
  tickCatapult(...args) { return GameWar.tickCatapult.apply(this, args); }
  catapultAmmo(...args) { return GameWar.catapultAmmo.apply(this, args); }
  throwStone(...args) { return GameWar.throwStone.apply(this, args); }
  stoneLands(...args) { return GameWar.stoneLands.apply(this, args); }
  /** Whether a tool is queued and waiting to be used where you are pointing. */
  get armed() { return GameBuild.armed.call(this); }

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
        // A world made before this check finished was decided as this
        // browser's (newWorld asks signedIn, and it wasn't yet) — tapping
        // Create the moment the game opens is enough. Signing in moves those
        // to the account; staying signed in never signs in again, so they'd
        // sit in the browser for good, growing until it was full. They move
        // now, the open one included.
        this.adoptLocalWorlds();
      })
      .catch(() => { this.ui?.home?.render?.(); });
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
    // Reported directly: the old saves showed first and the rest a few
    // seconds later. The screen used to ask before the account's session had
    // been picked back up, so the first answer was "signed out: only what's
    // in this browser". Wait for the session, so the first answer is whole.
    // PLAY-1: a check that could not answer is asked again before listing.
    if (this.cloud && this.cloudAuth.checkError) await this.cloudAuth.recheck();
    if (this.cloud && !this.cloudAuth.ready) await this.cloudAuth.restore();
    let localError;
    try{await this.local.refresh?.();}catch(error){localError=error;}
    const local = this.local.list();
    localError??=this.local.storageError;
    if (!this.cloud?.signedIn) {
      const lost = this.cloud ? this.lostSignIn() : null;
      if (lost) { lost.partial = local; throw lost; }
      if(localError){localError.partial=local;throw localError;}return local;
    }
    try {
      const cloud = await this.cloudList();
      this.rememberWorlds(cloud);
      if(localError){localError.partial=sortWorlds([...local,...cloud]);throw localError;}
      return sortWorlds([...local, ...cloud]);
    } catch (err) {
      err.partial ??= sortWorlds([...local, ...this.rememberedWorlds()]);
      throw err;
    }
  }

  /**
   * The worlds to show the moment the screen opens, before anyone has
   * answered: this browser's own, and the account's as they were last time
   * (kept on the device, see rememberWorlds). Then the real answer replaces
   * it — usually with the very same list, so nothing moves.
   */
  knownWorlds() {
    return sortWorlds([...this.local.list(), ...(this.cloud ? this.rememberedWorlds() : [])]);
  }

  /** Who the remembered list belongs to: the signed-in account, once known. */
  rememberedFor() {
    return this.cloudAuth?.ready ? (this.cloudAuth.user?.id ?? null) : undefined;
  }

  /** The account's list, as last seen — only what a row on the screen needs. */
  rememberWorlds(rows) {
    try {
      // Kept with the account it came from (owner, 18 November: a new
      // account showed the previous one's worlds), see rememberedWorlds.
      const user = this.cloudAuth?.user?.id ?? null;
      localStorage.setItem(WORLDS_SEEN, JSON.stringify({ user, rows: rows.map(({ id, name, mode, battle, age, updatedAt }) => ({ id, name, mode, battle, age, updatedAt })) }));
    } catch { /* a full or blocked storage just means no head start next time */ }
  }

  /**
   * The account's list as last seen, only for that account. Before the
   * session check has answered, the last account on this device is the best
   * guess (signing out forgets it); once it has, a different account, or
   * nobody, sees none of it. A list saved before it carried its account
   * shows only before that answer.
   */
  rememberedWorlds() {
    try {
      const saved = JSON.parse(localStorage.getItem(WORLDS_SEEN) ?? '[]');
      const owner = Array.isArray(saved) ? undefined : saved?.user;
      const rows = Array.isArray(saved) ? saved : saved?.rows;
      const now = this.rememberedFor();
      if (now !== undefined && (now === null || owner !== now)) return [];
      return Array.isArray(rows) ? rows.filter((r) => r && typeof r.id === 'string') : [];
    } catch {
      return [];
    }
  }

  /**
   * Why an account's worlds are missing from the list while nobody is
   * signed in, or null when that is simply the state chosen.
   *
   * Owner, 22 November: saving stopped at 00:47 and, after signing in
   * again, the list was empty. The worlds were all in the account. A session
   * check that failed, or a session that vanished, read as "signed out", and
   * an empty list said nothing about why. Signing out on purpose forgets the
   * remembered list, so a remembered list here means the sign-in was lost.
   */
  lostSignIn() {
    if (this.cloudAuth?.checkError) {
      const err = new Error('Could not check your sign-in just now. Your worlds are kept on your account; try again in a moment.');
      err.detail = this.cloudAuth.checkError.detail;
      return err;
    }
    let count = 0;
    try {
      const saved = JSON.parse(localStorage.getItem(WORLDS_SEEN) ?? '[]');
      if (!Array.isArray(saved) && saved?.user && Array.isArray(saved.rows)) count = saved.rows.length;
    } catch { /* nothing remembered */ }
    if (!count) return null;
    const err = new Error(`You were signed out. Sign in again with Account to see your ${count === 1 ? 'world' : `${count} worlds`}. Nothing is lost: they are kept on your account.`);
    err.detail = 'No session from /auth/get-session';
    err.signIn = true;
    return err;
  }

  forgetRememberedWorlds() {
    try { localStorage.removeItem(WORLDS_SEEN); } catch { /* nothing to forget */ }
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
      // A world that does not open leaves you on the worlds screen, not in the
      // title scene behind it with the screen already closed.
      onOpenWorld: async (id) => {
        const opened = await this.withLoading('Opening your world…', () => this.openWorld(id)).catch(() => false);
        if (opened === false) this.ui.openHome();
        return opened;
      },
      onDeleteWorld: async (id) => {
        if (id === this.worldId) { this.discarded = true; this.pendingSave = false; }
        // Its unsent copy goes too, or the next startup uploads it again.
        this.dropSafeCopy(id);
        this.syncState.forget(id);
        if (this.local.has(id)) {
          await this.local.delete(id);
          this.ui.home?.forgetWorlds?.();
          return true;
        }
        this.rememberWorlds(this.rememberedWorlds().filter((w) => w.id !== id));
        this.cloud?.delete(id)
          .then(() => { this.forgetCloudList(); this.ui.home?.forgetWorlds?.(); })
          .catch((err) => this.ui.toast({ kind: 'xp', title: 'Could not delete that world', body: err.message }));
        return true;
      },
      onLeaveWorld: (save) => this.leaveWorld(save),
      onSaveWorld: () => this.saveAndWait(),
      onExportWorld: (name) => {
        const payload = exportWorldFile({ ...this.saveState(), templates: this.templates.list(), name: name || 'My world' });
        this.ui.toast({ kind: 'challenge', title: 'World exported', body: `${payload.templates.length} designs included` });
      },
      onExportVox: (name) => {
        const bytes = exportVoxFile(this.world, name || 'My world');
        this.ui.toast({ kind: 'challenge', title: 'Exported .vox', body: `${(bytes / 1024).toFixed(0)} KB \u00b7 opens in MagicaVoxel and Blender` });
      },
      onImportWorld: async () => {
        try {
          const file = await pickFile('.json,application/json');
          if (!file) return;
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
      onGoHome: () => (this.title ? true : this.withLoading('Back to your worlds…', () => this.openTitle(), { world: false })),
      onNewWorld: (mode, name, options) => this.withLoading('Building the world…', () => { this.newWorld({ mode, name, localAI: options?.localAI }); this.ui.closePanel('panel-menu'); }),
      onInviteBattle: () => this.openPeerBattle(),
      onExportDiagnostics:()=>this.diagnostics.download(this.diagnosticContext()),
      onRenameWorld: (name) => { this.worldName = name; this.saveNow(); },
      lastSavedAt: () => this.syncState.agreedFor(this.worldId)?.at ?? 0,
      onResume: () => {
        this.ui.closePanel('panel-menu');
        if (document.body.classList.contains('touch')) this.ui.hideBlocker();
        else this.requestPointerLock();
      },
      onOpenMenu: () => { this.ui.refreshCloudPanel(); this.ui.openPanel('panel-menu'); document.exitPointerLock?.(); },
      onToggleFly: () => { this.player.toggleFly(); this.ui.setFlyIndicator(this.player.flying); return this.player.flying; },
      canFly: () => this.player?.canFly?.() ?? true,
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
      onRotateTemplate: () => this.turnTemplate(),
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
      onMove: (x, z, run = false) => {
        // A thumb walks a little slower than a key does: on a phone you
        // steer with the same thumb, and full pace was too fast to place
        // anything by ("we are moving really fast, only in mobile").
        const k = run ? 1 : TOUCH_WALK;
        this.player.externalMove.x = x * k;
        this.player.externalMove.z = z * k;
        // Carried on up past the stick's rim, straight ahead: run. The stick
        // decides (UIManager.bindStick) — the rim itself is full walking pace.
        // No toast about it — asked for directly: "remove the toast about
        // running". The stick's rim lights while you run (styles.css).
        this.player.stickSprint = !!run;
      },
      onLookStick: (x, y) => { this.player.lookInput.x = x; this.player.lookInput.y = y; },
      // Dragging the picture (UIManager.bindLookSurface): turns you as the
      // mouse does, a touch pixel worth a little more than a mouse one.
      onLookDrag: (dx, dy) => {
        const k = TOUCH_LOOK * (this.controls.sensitivity ?? 1);
        this.player.look(dx * k, dy * k);
      },
      onJumpOrFlyUp: (held) => {
        // Held on your feet, it keeps jumping each time you land (PlayerController's JUMP_BUFFER).
        this.player.jumpHeld = held && !this.player.flying;
        if (this.player.flying) { this.upHeld = held; this.recomputeVertical(); }
        else if (held) this.player.requestJump();
      },
      // Down: in the air or the water it takes you down; on your feet it
      // sneaks (PlayerController's sneakHeld).
      onFlyDown: (held) => {
        this.downHeld = held;
        this.player.sneakHeld = held;
        this.recomputeVertical();
      },
      // Touch goes through the same two verbs as mouse buttons, so a queued
      // tool behaves identically on a phone.
      isCloudConfigured: () => !!this.cloud,
      getCloudUser: () => this.cloudAuth.summary(),
      onCloudRestoreSession: () => this.cloudAuth.restore(),
      // The email's 6-digit code: confirms it and, on the server's say, signs
      // in. If it only confirmed, the password typed a moment ago signs in.
      onCloudVerify: async (email, code, password, creating) => {
        const user = await this.cloudAuth.verifyCode(email, code);
        if (!user) return this.ui.cb.onCloudSignIn(email, password);
        await this.sendUnsent();
        const moved = await this.migrateLocalWorlds();
        this.forgetCloudList();
        this.ui.home?.forgetWorlds?.();
        this.ui.home?.render();
        return { moved, creating };
      },
      onCloudResendCode: (email) => this.cloudAuth.resendCode(email),
      onCloudSignIn: async (email, password, captchaToken) => {
        await this.cloudAuth.signIn(email, password, captchaToken);
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
      onCloudSignUp: async (email, password, captchaToken) => {
        await this.cloudAuth.signUp(email, password, captchaToken);
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
      // ACCT-2: the reset email, and the new password from its link.
      onCloudForgot: (email) => this.cloudAuth.requestPasswordReset(email),
      onCloudReset: (token, password) => this.cloudAuth.resetPassword(token, password),
      // ACCT-10: sessions.
      onCloudSessions: () => this.cloudAuth.listSessions(),
      onCloudRevokeSession: (token) => this.cloudAuth.revokeSession(token),
      onCloudRevokeOthers: () => this.cloudAuth.revokeOtherSessions(),
      onCloudRevokeAll: async () => {
        await this.cloudAuth.revokeAllSessions();
        this.forgetRememberedWorlds();
        this.ui.toast({ kind: 'xp', title: 'Signed out everywhere', body: 'Sign in again to open your worlds' });
      },
      // ACCT-11: the chosen player name (undefined: this database has no names).
      onCloudPlayerName: () => this.cloud?.transport.getPlayerName(),
      onCloudClaimName: (name) => this.cloud.transport.claimPlayerName(name),
      // ACCT-5: download everything, and delete the account. Both are hidden by
      // the panel when the database has no delete function yet (migration 0009).
      onCloudDeletePreview: () => this.cloud?.transport.accountDeletePreview(),
      onCloudDownloadData: async (onProgress) => {
        const result = await buildAccountExport({
          transport: this.cloud.transport, user: this.cloudAuth.summary(), playerName: this.ui.playerName ?? null, onProgress,
        });
        downloadBlob(accountExportFilename(), result.blob);
        return { worlds: result.worlds, chunks: result.chunks, failed: result.failed.length };
      },
      // dataDeleted: a retry after the sign-in step asked for a password; the data is already gone.
      onCloudDeleteAccount: async ({ password = '', dataDeleted = false } = {}) => {
        if (!dataDeleted) {
          this.cloud.savesBlocked = true;
          try { await this.cloud.transport.deleteAccountData(); } catch (err) { this.cloud.savesBlocked = false; throw err; }
          this.cloudListCache = null;
        }
        let authUserDeleted = true;
        try {
          await this.cloudAuth.deleteAccount(password);
        } catch (err) {
          if (err.reason === 'needs-password' || err.reason === 'wrong-password') throw err;
          // The sign-in service will not delete the user from here. The game data is gone; sign out.
          authUserDeleted = false;
          await this.cloudAuth.signOut();
        }
        this.forgetRememberedWorlds();
        this.forgetCloudList();
        this.ui.home?.forgetWorlds?.();
        this.ui.home?.render();
        return { authUserDeleted };
      },
      onCloudSignOut: async () => {
        await this.cloudAuth.signOut();
        // Somebody else may sign in on this device next: don't show them these.
        this.forgetRememberedWorlds();
        this.ui.toast({ kind: 'xp', title: 'Signed out', body: 'Anything saved here stays right where it is' });
      },
      getCloudWorlds: () => this.listAllWorlds(),
      knownWorlds: () => this.knownWorlds(),
      // The worlds screen needs it to say which copy is which; it is the same
      // record the sync decision runs on.
      agreedFor: (id) => this.syncState.agreedFor(id),
      onCloudRestore: (id) => this.restoreFromCloud(id),
      onCloudDelete: async (id) => {
        await this.cloud.delete(id);
        this.ui.toast({ kind: 'xp', title: 'Deleted from the cloud', body: 'Your local copy is still here' });
      },

      onBreakTap: () => this.primaryAction(),
      // Whether the last Break started digging into something not yet through.
      isDigging: () => !!this.digTarget,
      onBreakHold: (held, opts) => this.setBreaking(held, opts),
      onPlaceTap: () => this.secondaryAction(),
      onPlaceHold: (held) => this.setPlacing(held),
      onTap: (at) => this.tapAction(at),
      // The bow, under a thumb: down draws it, up looses (UIManager.bindLookSurface).
      onDrawStart: () => this.startDraw(),
      onDrawEnd: () => this.releaseDraw(),

      // ---- duilt ----
      // Both modes run on DuiltGame now — Creative is that same engine with
      // sandbox: true (see DuiltGame's own note) — so isDuilt means "has the
      // building/bag UI under it" and is true for both. isSandbox is the
      // narrower question, for the handful of things that only make sense
      // with real scarcity behind them (the workbench, skill levels).
      isDuilt: () => !!this.duilt,
      isSandbox: () => !!this.duilt?.sandbox,
      getModeLabel: () => (this.mode !== DUILT ? 'Creative' : this.duilt?.battle ? 'Battle' : 'Duilt'),
      onOpenBag: () => this.ui.toggleBag(),
      onOpenClaim: () => this.openClaim(),
      onHintTap: () => (this.moving ? this.turnMove() : this.hintUses ? this.secondaryAction() : this.openClaim()),
      onFinishEditing: () => this.finishEditing(),
      onStampStarter: (id, designId, workers) => this.stampStarter(id, designId, workers),
      // The showcase (docs/history/plan-look-and-sound.md, section 1) — see openShowcase.
      onOpenShowcase: (spot) => this.openShowcase({ spot }),
      onShowcaseSpot: (id) => this.showcaseSpot(id),
      onShowcaseTime: (t) => this.showcaseTime(t),
      onOpenBuildings: () => this.ui.openPanel('panel-buildings'),
      onOpenBench: () => this.ui.openBench(),
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
    // From the last age the wall is down (config/ages.js): you walk where you like.
    // In Battle it never stood (asked: "Battle mode should have the same
    // border has duilt? I though it shouldn't") — the rivals are 5,000
    // blocks out, and you have to be able to march on them. The border
    // still marks your land: where you can build and claim, growing with
    // the ages as in Duilt.
    const t = this.duilt?.territory;
    const walled = this.duilt && !this.duilt.sandbox && !this.duilt.battle && !t.open;
    this.player.setBounds(walled ? t.bounds() : null);
  }

  /** Duilt owns scene objects (the border), so swapping worlds must clean up. */
  disposeDuilt() {
    if (!this.acceptingPeerSnapshot) {
      this.peerPanel?.dispose();this.peerPanel=null;this.peerSession=null;
      this.clearPeerAvatar();
    }
    this.localRivalAI?.dispose();
    this.localRivalAI = null;
    this.terrainWorker?.dispose();
    this.terrainWorker = null;
    if (!this.duilt) return;
    this.duilt.territory.dispose();
    this.duilt = null;
  }

  newWorld({ silent, mode = this.mode, name, scenery = false, title = false, seed, localAI = false } = {}) {
    // Battle (backlog batch 4, E) is Duilt's rules with three rivals in the
    // world (duilt/Rivals.js) — a Duilt world with `battle` on its settlement.
    const battle = mode === BATTLE;
    if (battle) mode = DUILT;
    this.mode = mode;
    this.endSleep();
    this.showcase = null;
    this.title = null;
    // Nothing is open for changes in a world you've only just entered.
    this.editingStructure = null;
    this.updateEditOutline?.();
    this.ui?.clearEditingBanner?.();
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
    this.worldName = name || (battle ? 'Battle world' : mode === DUILT ? 'My settlement' : 'Creative world');

    this.disposeDuilt();
    // No size: the land is made as you walk into it. Creative used to get a
    // separate, smaller generator — a flat 64x64 patch with none of Duilt's
    // biomes, rivers, mountains or ocean — for no reason tied to what
    // Creative actually is; it has no territory to fence in, so there was
    // nothing stopping it from being just as endless. Both modes start in
    // exactly the same generated world now; only what you're allowed to do
    // in it differs.
    // The title scene behind the worlds screen (`title`) lays out no
    // settlement and starts where it's looked at (openTitle); see
    // generateEndlessWorld. The showcase is scenery too, but builds on its
    // settlement, so it keeps one.
    const built = generateEndlessWorld({ height: WORLD_HEIGHT, settle: !title, ...(seed != null ? { seed } : {}) });
    this.world = built.world;
    let spawn = title
      ? { x: TITLE_SITE.x + 0.5, y: this.world.gen.heightAt(TITLE_SITE.x, TITLE_SITE.z) + 1, z: TITLE_SITE.z + 0.5 }
      : built.origin.spawn;
    if (this.player) this.player.dispose();
    this.player = new PlayerController(this.world, this.camera, spawn ?? this.findSafeSpawn());
    this.wireFlight();
    this.player.binds = { ...this.controls.keys };
    this.player.view = this.controls.view ?? 'first';
    this.player.autoJump = this.controls.autoJump === 'on';
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
    this.configureVillagerJobs();
    // Not for the title scene: nobody plays in it, and a kit of one of everything
    // was hundreds of bag changes at every start (reported directly: "The
    // game is taking too long to load").
    if (sandbox && !title) this.duilt.grantCreativeKit();
    if (battle) { this.duilt.battle = new Rivals(); this.duilt.battle.localAI = localAI; this.world.gen.battle = true; }
    // Saved inside the god's cube: back out where you went in.
    if (this.duilt.cube?.back) {
      const b = this.duilt.cube.back;
      this.player.position.set(b.x, b.y, b.z);
      this.duilt.cube.inside = false;
      delete this.duilt.cube.back;
    }
    else if (!title) this.duilt.grantStartingKit();
    // Every new world starts in the morning.
    if (this.dayCycle) this.dayCycle.time = MORNING;
    // After the rules exist, not before: this reads the border off `duilt`,
    // and called a line earlier it only ever saw the world that came before.
    this.applyTerritoryBounds();
    this.gamification?.dispose?.();
    this.gamification = new GamificationEngine(this.bus);
    this.gamification.setDuilt(this.duilt);
    this.economy = new EconomyEngine(this.bus);
    if (this.symmetryTool) this.symmetryTool = new SymmetryTool(this.world);
    // The title scene's land comes in nearest first, a little a frame,
    // rather than all of it before anything is drawn (see rebuildAllChunks).
    this.rebuildAllChunks({ all: !title });
    this.bus.emit('economy:change', {});
    if (!silent) {
      this.ui.refreshForMode();
      // Write it out now: a brand new world is 60 seconds from its first
      // interval autosave, and a phone that gets put away in that window used
      // to lose the whole thing.
      this.saveNow();
      const welcome = () => {
        if (battle) return this.battleWelcome();
        this.ui.toast({
          kind: 'xp',
          title: mode === DUILT ? 'Welcome to Duilt' : 'New world generated',
          body: mode === DUILT
            ? 'You have 32 blocks of land, an axe and a bucket. Chop a tree, fill your bucket with water, and make a pickaxe.'
            : 'Have fun building!',
        });
        if (!this.pointerLocked && !document.body.classList.contains('touch')) this.ui.setResumeHint(true);
      };
      // A new Duilt world opens on the story so far (docs/history/plan-phase7-lore.md, 7j).
      // Not in Battle (reported directly: "In battle mode it seems that we
      // are showing the same intro, we should not") — its rivals' welcome
      // says what that world is about instead.
      if (mode === DUILT && !battle) this.ui.story.play(INTRO, { onDone: welcome });
      else welcome();
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

  /**
   * Meshes what the player can see right away and queues the rest. Meshing a
   * large world in one go is close to a second of frozen tab; this way the
   * nearby world is solid immediately and the horizon fills in over a few frames.
   */
  rebuildAllChunks({ all = true } = {}) {
    this.mesher.clearAll();
    this.remeshQueue.clear();
    // An endless world has only the settlement in it until something asks for
    // more, so the first thing to do is ask for everything within sight.
    // Not for the title scene (`all` false): streamChunks queues it nearest first.
    if (this.world.endless && this.player && !all) this.streamedAt = null;
    else if (this.world.endless && this.player) {
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
  /**
   * How much of the land round the title scene is drawn, 0..1 — what the
   * loading screen's bar follows. Every chunk within `reach` blocks of the
   * scene's middle, made and meshed.
   */
  /**
   * How much of the title scene's land is ready, 0..1: only what the camera
   * sees at first — round the middle it looks at, and under where it flies
   * — not all 48 blocks round. The rest is made behind the worlds screen
   * as it's needed (reported directly: "The game is taking too long to
   * load"; most of the wait was land nobody was looking at yet).
   */
  titleProgress() {
    const tl = this.title;
    if (!tl) return 1;
    const eye = orbitPose(tl.site, tl.t, tl.eyeY).eye;
    return this.drawnAround([{ ...tl.site, reach: TITLE_READY_REACH }, { ...eye, reach: TITLE_EYE_REACH }]);
  }

  /**
   * How much of the land within `reach` of `site` is made and drawn, 0..1.
   * `site` can be a list of places, each with its own `reach`.
   */
  drawnAround(site, reach = 48) {
    if (!site || !this.world) return 1;
    const keys = new Set();
    for (const s of Array.isArray(site) ? site : [{ ...site, reach }]) {
      const r = s.reach ?? reach;
      const c0x = Math.floor((s.x - r) / CHUNK_SIZE), c1x = Math.floor((s.x + r) / CHUNK_SIZE);
      const c0z = Math.floor((s.z - r) / CHUNK_SIZE), c1z = Math.floor((s.z + r) / CHUNK_SIZE);
      for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) keys.add(`${cx},${cz}`);
    }
    let done = 0;
    for (const key of keys) {
      const [cx, cz] = key.split(',').map(Number);
      if (this.world.hasChunk(cx, cz) && this.world.getChunk(cx, cz).mesh) done++;
    }
    return keys.size ? done / keys.size : 1;
  }

  /** How far a chunk is from you, squared, to its nearest edge. */
  chunkDistSq(chunk) {
    const p = this.player?.position;
    if (!p) return 0;
    const minX = chunk.cx * CHUNK_SIZE, minZ = chunk.cz * CHUNK_SIZE;
    const dx = Math.max(minX - p.x, 0, p.x - (minX + CHUNK_SIZE));
    const dz = Math.max(minZ - p.z, 0, p.z - (minZ + CHUNK_SIZE));
    return dx * dx + dz * dz;
  }

  /**
   * The deep meshes follow you: built for chunks coming within DEEP_RANGE,
   * let go of once they're a couple of chunks past it. Only when you cross
   * into another chunk — between those, nothing changes.
   */
  updateDeep() {
    const p = this.player?.position;
    if (!p || !this.world) return;
    const at = `${Math.floor(p.x / CHUNK_SIZE)},${Math.floor(p.z / CHUNK_SIZE)}`;
    if (at === this.deepAt && this.world === this.deepWorld) return;
    this.deepAt = at;
    this.deepWorld = this.world;
    const near = DEEP_RANGE * DEEP_RANGE, far = (DEEP_RANGE + DEEP_SLACK) ** 2;
    for (const chunk of this.world.allChunks()) {
      const d = this.chunkDistSq(chunk);
      if (chunk.deepSkipped) { if (d <= near && chunk.mesh) this.remeshQueue.add(chunk); }
      else if (d > far && chunk.mesh) this.mesher.dropDeep(chunk);
    }
  }

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

  wireInput(...args) { return GameInput.wireInput.apply(this, args); }

  closeAllPanels() {
    this.ui.closeAllPanels();
  }

  cycleView(...args) { return GameInput.cycleView.apply(this, args); }

  /** You, and what's in your hand, brought up to date with the frame. */
  updateYou(dt, playing) {
    const held = this.selectedItemId === BARE_HANDS ? {}
      : this.selectedItemId ? { itemId: this.selectedItemId } : { blockId: this.selectedBlockId };
    const third = this.player.view !== 'first';
    this.avatarView.update(dt, this.player, { look: this.controls.look, worn: this.duilt?.worn ?? {}, held: this.sleeping ? {} : held, visible: playing && third, draw: this.drawing ? this.drawPower() : 0, lie: this.sleeping ? { x: this.sleeping.centre.x, y: this.sleeping.centre.y, z: this.sleeping.centre.z, dir: this.sleeping.dir, amount: this.sleeping.lie } : null });
    this.handView.update(dt, this.player, { look: this.controls.look, held, visible: playing && !third && !this.manning, draw: this.drawing ? this.drawPower() : 0, offhand: this.duilt?.worn?.offhand?.id ?? null });
    // The flying machine went with it: you come down on its wings.
    if (this.player.flying && !this.player.canFly()) {
      this.player.flying = false;
      this.ui?.setFlyIndicator(false);
    }
    // The Plainer's wings, while it carries you; not in a Helix, which is drawn round you.
    const wings = playing && this.wearingPlainer() && !this.piloting && (this.player.flying || this.player.gliding);
    this.glider.update(this.player, wings ? (this.player.flying ? 'fly' : 'glide') : null, dt);
    this.machineView.update(this.duilt?.machines, this.piloting, dt, this.player);
    this.trainView.update(this.duilt?.trains, dt, this.driving);
    this.cartView.update(this.duilt?.mounts);
  }

  // ---- the god's cube (world/godCube.js) ------------------------------------

  /**
   * Through your Sanctuary to the other god's cube, once the big wars are
   * won: the cube laid out far over the world, the god before his altar and
   * the first of his creatures with him, and you at its south wall.
   */
  enterCube() {
    const d = this.duilt;
    const refuse = d?.cubeRefuses();
    if (!d || refuse) return void this.ui?.toast({ kind: 'xp', title: 'The way is shut', body: refuse ?? '' });
    const home = { x: d.territory.centreX, z: d.territory.centreZ };
    const site = cubeSite(this.world.gen, home);
    const god = d.otherGod;
    const plan = cubeDesign(god);
    for (const [x, y, z, id] of plan.blocks) this.world.setBlock(site.x + x, site.y + y, site.z + z, id, { byHand: false });
    const abs = (p) => ({ x: site.x + p.x, y: site.y + p.y, z: site.z + p.z });
    // The stash, laid in once: the chest keeps what's left of it after.
    const stash = abs(plan.stash);
    if (!d.chestAt(stash.x, stash.y, stash.z, { create: false })) {
      const chest = d.chestAt(stash.x, stash.y, stash.z);
      chest.found = 'god_stash';
      if (!d.cube.stash) for (const [id, , lo] of LOOT.god_stash.items) chest.inventory.add(id, lo);
    }
    const lm = { kind: 'cube', x: site.x + CUBE_SIZE / 2, z: site.z + CUBE_SIZE / 2, y: site.y + 1, half: CUBE_SIZE / 2, leave: 400, spawns: plan.spawns.map(abs) };
    this.wanderers.list = this.wanderers.list.filter((p) => p.landmark?.kind !== 'cube');
    const throne = abs(plan.throne);
    const kind = `${god}_god`;
    const godPerson = this.wanderers.person(kind, throne.x, throne.y, throne.z, { landmark: lm, home: { x: throne.x, z: throne.z }, angry: true, name: `the ${god} god`, facing: 0 });
    this.wanderers.list.push(godPerson);
    this.cube = { lm, god: godPerson, stash, exit: abs(plan.exit) };
    const p = this.player.position;
    d.cube.back = { x: p.x, y: p.y, z: p.z };
    d.cube.inside = true;
    d.cube.entered = true;
    const at = abs(plan.entry);
    p.set(at.x, at.y, at.z);
    this.player.velocity?.set?.(0, 0, 0);
    this.player.yaw = 0;
    this.tellMoment(god === 'dark' ? 'cube_dark' : 'cube_white');
    this.ui?.toast({ kind: 'story', title: `The ${god} god's cube`, body: 'Beat him — or take his stash from the altar and get back to the way out alive.', duration: 8000 });
    this.editedAt = Date.now();
  }

  /** Out through the way out — only once the god's beaten, or his stash taken. */
  leaveCube() {
    const d = this.duilt;
    if (!d) return;
    if (!d.cube.beaten && !d.cube.stash) {
      return void this.ui?.toast({ kind: 'xp', title: 'The cube holds you', body: 'Beat the god, or take his stash — then the way out lets you go' });
    }
    this.backFromCube();
    this.ui?.toast({ kind: 'achievement', title: 'Out of the cube', body: d.cube.beaten ? 'The other god is beaten. The world is yours.' : 'With his stash. He\'ll be waiting, if you ever go back.' });
  }

  /** Home through the Sanctuary, and the cube's people gone with it. */
  backFromCube() {
    const d = this.duilt;
    const back = d?.cube.back ?? this.respawnPoint?.();
    if (back) { this.player.position.set(back.x, back.y, back.z); this.player.velocity?.set?.(0, 0, 0); }
    if (this.wanderers) this.wanderers.list = this.wanderers.list.filter((p) => p.landmark?.kind !== 'cube');
    if (d) { d.cube.inside = false; delete d.cube.back; }
    this.cube = null;
    this.editedAt = Date.now();
  }

  /** Every frame: has the god fallen? */
  cubeTick() {
    const c = this.cube, d = this.duilt;
    if (!c || !d) return;
    if (c.god.dead && !d.cube.beaten) {
      d.cube.beaten = true;
      // His creatures go with him.
      for (const q of this.wanderers.list) if (q.landmark === c.lm && !q.dead) q.done = true;
      this.wanderers.list = this.wanderers.list.filter((q) => !(q.landmark === c.lm && q !== c.god));
      this.tellMoment(c.god.kind === 'dark_god' ? 'god_dark_beaten' : 'god_white_beaten');
      this.ui?.toast({ kind: 'achievement', title: `${c.god.kind === 'dark_god' ? 'The dark god' : 'The white god'} is beaten`, body: 'His stash is on the altar, and the way out is open', duration: 9000 });
      this.editedAt = Date.now();
    }
  }

  requestPointerLock(...args) { return GameInput.requestPointerLock.apply(this, args); }

  enterFullscreen(...args) { return GameInput.enterFullscreen.apply(this, args); }

  toggleFullscreen(...args) { return GameInput.toggleFullscreen.apply(this, args); }

  primaryAction(...args) { return GameInput.primaryAction.apply(this, args); }

  tapAction(...args) { return GameInput.tapAction.apply(this, args); }

  secondaryAction(...args) { return GameInput.secondaryAction.apply(this, args); }

  /** Offers the framed region to the claim menu. */
  buildingActions(...args) { return GameStructures.buildingActions.apply(this, args); }
  sowFarm(...args) { return GameStructures.sowFarm.apply(this, args); }
  compostFarm(...args) { return GameStructures.compostFarm.apply(this, args); }
  evolveBuilding(...args) { return GameStructures.evolveBuilding.apply(this, args); }
  startEditing(...args) { return GameStructures.startEditing.apply(this, args); }
  growEditing(...args) { return GameStructures.growEditing.apply(this, args); }
  updateEditOutline(...args) { return GameStructures.updateEditOutline.apply(this, args); }
  climbEditing(...args) { return GameStructures.climbEditing.apply(this, args); }
  finishEditing(...args) { return GameStructures.finishEditing.apply(this, args); }
  deleteBuilding(...args) { return GameStructures.deleteBuilding.apply(this, args); }
  cellsOf(...args) { return GameStructures.cellsOf.apply(this, args); }
  beginMove(...args) { return GameStructures.beginMove.apply(this, args); }
  moveAnchor(...args) { return GameStructures.moveAnchor.apply(this, args); }
  moveCheck(...args) { return GameStructures.moveCheck.apply(this, args); }
  updateMove(...args) { return GameStructures.updateMove.apply(this, args); }
  dropMove(...args) { return GameStructures.dropMove.apply(this, args); }
  turnMove(...args) { return GameStructures.turnMove.apply(this, args); }
  cancelMove(...args) { return GameStructures.cancelMove.apply(this, args); }
  endMove(...args) { return GameStructures.endMove.apply(this, args); }
  openClaim(...args) { return GameStructures.openClaim.apply(this, args); }
  beginClaimSelection(...args) { return GameStructures.beginClaimSelection.apply(this, args); }
  markClaimCorner(...args) { return GameStructures.markClaimCorner.apply(this, args); }
  updateClaimPreview(...args) { return GameStructures.updateClaimPreview.apply(this, args); }
  beginClaimColumn(...args) { return GameStructures.beginClaimColumn.apply(this, args); }
  adjustClaimColumnHeight(...args) { return GameStructures.adjustClaimColumnHeight.apply(this, args); }
  updateClaimColumnPreview(...args) { return GameStructures.updateClaimColumnPreview.apply(this, args); }
  confirmClaimColumn(...args) { return GameStructures.confirmClaimColumn.apply(this, args); }
  stampStarter(...args) { return GameStructures.stampStarter.apply(this, args); }
  digMineStairs(...args) { return GameStructures.digMineStairs.apply(this, args); }
  toggleGate(...args) { return GameStructures.toggleGate.apply(this, args); }
  villagerDoor(...args) { return GameStructures.villagerDoor.apply(this, args); }
  doorPartnerCells(...args) { return GameStructures.doorPartnerCells.apply(this, args); }
  doorCells(...args) { return GameStructures.doorCells.apply(this, args); }

  /** Drops a ready-made building where you are aiming, charged and undoable as one action. */
  clearPeerAvatar() {
    this.peerPosition=null;
    if(!this.peerAvatar)return;
    const geometries=new Set(),materials=new Set();
    this.peerAvatar.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
    this.scene.remove(this.peerAvatar.group);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
    this.peerAvatar=null;this.peerPosition=null;
  }

  configureVillagerJobs() {
    const d=this.duilt;
    // IMP-16: villagers open the doors on their way and shut them behind.
    d.settlers.doors={open:(x,y,z)=>this.villagerDoor(x,y,z,true),close:(x,y,z)=>this.villagerDoor(x,y,z,false)};
    d.jobs.canPlace=c=>this.world===d.world && d.territory.contains(c.x,c.z) && !d.structures.blocking([c]) && (c.next===AIR || !this.blockOverlapsPlayerAABB(c));
    // Why a block of a design can't go where it would (owner, 8 November:
    // placing a village in Age 9 only said "would cross protected land").
    d.jobs.placeProblem=c=>{
      if(this.world!==d.world)return 'This world is not the one being built in.';
      if(!d.territory.contains(c.x,c.z))return 'Part of it is outside your land. Move it in, or grow your land first.';
      const s=d.structures.blocking([c]);
      if(s)return `It would build over your ${STRUCTURES_BY_ID.get(s.type)?.name ?? 'building'}. Move it clear of it.`;
      if(c.next!==AIR&&this.blockOverlapsPlayerAABB(c))return 'You are standing where it would be built. Step out of its outline and place it again.';
      return null;
    };
    d.jobs.placeBlock=c=>this.applyChanges([c],{chargeResources:false,gather:false});
    d.jobs.onBuildStarted=(job,p)=>this.ui?.toast({kind:'challenge',title:`${p?.name ?? 'Your builder'} started on the ${job.name}`,body:'Builders put up a block at a time; its outline shows where it goes.'});
    // Owner, 9 November: a build stopped with no word why. Say it once per reason.
    d.jobs.onBuildHeld=(job,reason)=>this.ui?.toast({kind:'xp',title:`The ${job.name} is waiting`,body:reason});
    d.jobs.onBuildComplete=job=>{
      const claim=d.claim(job.region,job.type);
      if (!claim.ok) d.waitFor(job.region,job.type,claim.reason);
      this.editedAt=Date.now();
      this.ui?.toast({kind:'challenge',title:`${job.name} built`,body:claim.reason});
    };
  }

  // ---- one open session per world (storage/WorldSession.js) ----

  /** This tab's session, made the first time a cloud world opens. */
  worldSessionFor() {
    if (!this.cloud?.transport) return null;
    return (this.worldSession ??= new WorldSession({ transport: this.cloud.transport }));
  }

  /**
   * Before a cloud world opens: if another tab or device has it open, asks
   * whether to open it here and close it there (owner, 9 November). Yes takes
   * it over; no leaves it where it is. Whether to go on opening it.
   */
  async takeWorldSession(id) {
    const s = this.worldSessionFor();
    if (!s) return true;
    if (s.worldId && s.worldId !== id) await s.release();
    const other = await s.check(id);
    if (other) {
      const ago = other.secondsAgo < 5 ? 'just now' : `${other.secondsAgo} seconds ago`;
      loadingAside(true);
      const yes = await this.ui.confirm({
        title: 'This world is open somewhere else',
        body: `It is open on ${other.device} (last active ${ago}). Open it here and close it there? Anything not yet saved there is lost.`,
        ok: 'Open it here',
      }).finally(() => loadingAside(false));
      if (yes !== true) return false;
    }
    await s.claim(id);
    this.sessionTaken = false;
    // No timer (tests/healing: nothing polls the account): the session is
    // checked at every save and whenever this tab comes back to the front,
    // and let go when the page closes.
    if (!this.sessionWatched && typeof document !== 'undefined') {
      this.sessionWatched = true;
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.checkWorldSession(); });
      globalThis.addEventListener?.('pagehide', () => { this.worldSession?.release(); });
    }
    return true;
  }

  /** Still ours, or did another tab take the world over? Whether it is still ours. */
  async checkWorldSession() {
    const s = this.worldSession;
    if (!s?.worldId || this.worldIsLocal || s.worldId !== this.worldId) return true;
    if (await s.beat() !== 'lost') return true;
    this.worldSessionTaken();
    return false;
  }

  /**
   * Another tab or device took this world over: this one stops saving at
   * once, so it cannot write over the newer session, and offers a reload.
   */
  worldSessionTaken() {
    if (this.sessionTaken) return;
    this.sessionTaken = true;
    this.discarded = true;
    this.pendingSave = false;
    if (this.worldSession) this.worldSession.worldId = null;
    this.ui?.confirm?.({
      title: 'This world was opened somewhere else',
      body: 'It was opened on another device or tab, so this one is closed. Nothing more is saved here.',
      ok: 'Reload',
    }).then(() => globalThis.location?.reload?.());
  }

  /** Lets go of the world, so the next device to open it is not asked. */
  releaseWorldSession() {
    return this.worldSession?.release();
  }

  // ---- local ----

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
  /** Every browser world into the account, the one open now too — see resumeSession. */
  async adoptLocalWorlds() {
    if (!this.cloud?.signedIn) return 0;
    if(this.worldIsLocal&&!this.discarded&&this.worldId){
      if(!this.saveLocally()||(this.saving&&await this.saving!==true))return 0;
    }
    const moved = await this.migrateLocalWorlds();
    if (moved) { this.forgetCloudList(); this.ui?.home?.forgetWorlds?.(); this.ui?.home?.refreshCloudWorlds?.({ force: true }); }
    return moved;
  }

  async migrateLocalWorlds() {
    if (!this.cloud?.signedIn) return 0;
    if(this.worldIsLocal&&this.saving)await this.saving;
    await this.local.refresh?.();
    let moved = 0;
    for (const row of this.local.list()) {
      try {
        const data = await this.local.restore(row.id);
        const world = restoreWorldSnapshot(data.world);
        const uploaded=await this.cloud.save(row.id, {
          world, name: data.name, mode: data.mode, player: data.player,
          gamification: this.gamification, economy: data.economy, duilt: data.duilt,
        });
        if(!uploaded||await this.local.delete(row.id,{ifUnchangedSince:data.updatedAt})===false)continue;
        if (this.worldId === row.id) this.worldIsLocal = false;
        moved++;
      } catch { /* stays local; retried on the next sign-in */ }
    }
    return moved;
  }

  rayThrough(...args) { return GameInput.rayThrough.apply(this, args); }

  aimedAlong(...args) { return GameInput.aimedAlong.apply(this, args); }

  recomputeVertical(...args) { return GameInput.recomputeVertical.apply(this, args); }

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
    this.sound?.bucket(true);
    // A lone block of water goes into the bucket whole; water joined to more
    // water is a pond, and a pond is never emptied a bucket at a time (asked
    // for directly: "If it's a lonely block of water a bucket should clear it
    // out. If it's more like 2 don't").
    const joined = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]
      .some(([dx, dy, dz]) => this.world.getBlock(hit.x + dx, hit.y + dy, hit.z + dz) === WATER);
    const cleared = !joined && this.applyChanges([{ x: hit.x, y: hit.y, z: hit.z, prev: WATER, next: AIR }], { chargeResources: false });
    this.ui.toast({ kind: 'xp', title: 'Bucket filled', body: cleared ? 'And the water is gone' : 'Scooped up' });
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
    this.sound?.bucket(false);
    this.ui.toast({ kind: 'xp', title: 'Bucket emptied', body: 'Poured out — watch where it runs' });
  }

  compostSelected() {
    if (!this.duilt) return;
    const hit = this.raycast();
    if (!hit || !cropOf(this.world.getBlock(hit.x, hit.y, hit.z))) {
      this.ui.toast({ kind: 'xp', title: 'Point at a growing crop', body: 'Compost moves an unripe crop ahead by one stage' });
      return;
    }
    const result = this.duilt.compostCrop(hit.x, hit.y, hit.z);
    if (!result.ok) {
      this.ui.toast({ kind: 'xp', title: result.reason });
      return;
    }
    const changes = this.duilt.crops.grow(this.world);
    if (changes.length) this.remeshDirty();
    this.ui.toast({ kind: 'challenge', title: 'Compost added', body: 'The crop has grown one stage' });
  }

  /**
   * What Break does with food selected: eat it instead of digging.
   * DuiltGame.eat() already does the real work (which slot, hunger, the
   * result) — this is only the wiring from "the hotbar slot you have
   * selected" to it, the same job fillBucket/emptyBucket do for the bucket.
   */
  /**
   * Drinks what you're holding: holy water, hearts back at once; a beer, a
   * kombucha or a coffee, better at something for three minutes.
   */
  drinkSelected() {
    if (!this.duilt) return;
    const r = this.duilt.drink(this.selectedItemId);
    if (r.ok) this.sound?.drink();
    this.ui.toast(!r.ok
      ? { kind: 'xp', title: r.reason }
      : r.boost
        ? { kind: 'challenge', title: `${BOOSTS[r.boost].name}: ${BOOSTS[r.boost].says.toLowerCase()}`, body: 'For three minutes' }
        : { kind: 'challenge', title: 'Blessed', body: `+${r.healed / 2} hearts` });
  }

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

  /** The Stone King, if he's what you're pointing at (and no block is nearer). */
  kingTarget(hit = this.raycast()) {
    if (!this.wanderers) return null;
    const eye = this.player.eyePosition(), dir = this.player.lookDirection();
    const found = this.wanderView.pickAt(this.wanderers.list.filter((p) => p.kind === 'king'), eye, dir, REACH);
    if (!found) return null;
    if (hit) {
      const blockT = rayBox(eye, dir, hit.x, hit.y, hit.z, hit.x + 1, hit.y + 1, hit.z + 1);
      if (blockT != null && blockT < found.t) return null;
    }
    return found.person;
  }

  /** The hermit under the crosshair, if nearer than the block behind them. */
  hermitTarget(hit = this.raycast()) {
    if (!this.wanderers || !this.duilt) return null;
    const eye = this.player.eyePosition(), dir = this.player.lookDirection();
    const found = this.wanderView.pickAt(this.wanderers.list.filter((p) => p.kind === 'hermit' && !p.dead && !(p.fear > 0)), eye, dir, REACH);
    if (!found) return null;
    if (hit) {
      const blockT = rayBox(eye, dir, hit.x, hit.y, hit.z, hit.x + 1, hit.y + 1, hit.z + 1);
      if (blockT != null && blockT < found.t) return null;
    }
    return found.person;
  }

  /**
   * Somebody who'll talk, under the crosshair and nearer than the block
   * behind them: a settler, an explorer, a messenger, one of your soldiers
   * or your army. Asked for directly: "When I click npcs in the game they
   * should throw a message, but conversation like".
   */
  talkTarget(hit = this.raycast()) {
    const eye = this.player.eyePosition(), dir = this.player.lookDirection();
    const d = this.duilt;
    const found = [];
    const add = (who, f) => { if (f && !f.person.dead && !f.person.foe) found.push({ who, ...f }); };
    if (d) {
      add('settler', this.settlerView.pickAt(d.settlers.people, eye, dir, REACH));
      if (d.defenders) add('soldier', this.defenderView.pickAt(d.defenders.people, eye, dir, REACH));
      if (d.army?.active) add('warrior', this.warriorView.pickAt(d.army.field, eye, dir, REACH));
    }
    if (this.wanderers) {
      const f = this.wanderView.pickAt(this.wanderers.list.filter((p) => TALKERS.has(p.kind) && !(p.fear > 0) && !p.angry && !p.dead), eye, dir, REACH);
      if (f) add(f.person.kind, f);
    }
    if (!found.length) return null;
    const best = found.sort((a, b) => a.t - b.t)[0];
    if (hit && this.inTheWay(hit, eye, dir, best.t)) return null;
    return best;
  }

  /** The next line of a conversation (config/talk.js), in a speech bubble. */
  talkTo({ who, person }) {
    const me = this.player.position;
    let title = person.name, line, gift = null;
    if (who === 'messenger') {
      // A messenger always has news — the story, or somewhere real.
      title = `${person.name}, a messenger`;
      line = this.messengerTale() ?? this.wanderers.newsFrom(person.settlement ?? me);
    } else {
      const work = who === 'settler' ? this.duilt?.structures.list().find((s) => s.id === person.workId) : null;
      line = talkLine({
        who, person, at: me, landmarks: this.wanderers?.landmarks,
        archiveRead: !!this.duilt?.time?.futureKnown,
        job: work ? structureName(work.type).toLowerCase() : null, jobId: work?.type ?? null,
      });
      if (who === 'explorer') { title = `${person.name}, an explorer`; gift = this.explorerGift(person); }
      if (who === 'tribe') title = `${person.name} of the tree people`;
      if (who === 'city_guard') title = `${person.name}, of the city guard`;
    }
    // A settler stops and turns to you while they talk, then goes back to
    // whatever they were on the way to.
    // A builder or hauler at a Work Hall only turns to you: their work goes
    // on while you talk (owner, 9 November: "if I talk with the npc it should
    // not stop the building").
    if (who === 'settler') {
      person.facing = Math.atan2(me.x - person.x, me.z - person.z);
      if (!this.duilt?.jobs?.controls?.(person)) {
        if (person.target) { person.target = null; person.atWork = !person.atWork; }
        person.wait = Math.max(person.wait ?? 0, 4);
      }
    }
    this.ui?.toast({ kind: 'talk', title, body: `“${line}”${gift ? `\n${gift}` : ''}`, duration: gift ? 8000 : 6000 });
  }

  /**
   * An explorer hands over one of the two gifts they carry (IMP-1): saplings
   * first, then something from their pack. Taken only if it fits in the bag;
   * otherwise it stays with them. Returns a line to show, or null.
   */
  explorerGift(person) {
    const next = person.gifts?.[0];
    if (!next || !this.duilt || this.duilt.sandbox) return null;
    const gained = this.duilt.collect(next.give);
    const words = Object.entries(gained).map(([id, n]) => `${n} ${itemName(id).toLowerCase()}${n > 1 && !itemName(id).toLowerCase().endsWith('s') ? 's' : ''}`);
    if (!words.length) return 'They offer you something, but your bag is full.';
    // A gift only partly taken stays partly on offer.
    for (const [id, n] of Object.entries(gained)) next.give[id] -= n;
    for (const id of Object.keys(next.give)) if (next.give[id] <= 0) delete next.give[id];
    if (!Object.keys(next.give).length) person.gifts.shift();
    const left = person.gifts.length;
    return `They give you ${words.join(' and ')}.${left ? ' They have one more thing for you.' : ''}`;
  }

  /** The goblin traders in your markets, turned to look at you when you're near. */
  tradersFacingYou() {
    const list = this.duilt?.marketTraders() ?? [];
    const me = this.player?.position;
    if (me) {
      for (const t of list) {
        const dx = me.x - t.x, dz = me.z - t.z;
        if (dx * dx + dz * dz < 64) t.facing = Math.atan2(dx, dz);
      }
    }
    return list;
  }

  /** A market's trader under the crosshair, if nearer than the block behind them. */
  traderTarget(hit = this.raycast()) {
    // Your markets' goblins, and a living city's merchants while they'll
    // still deal with you.
    const list = [...(this.duilt?.marketTraders() ?? []),
      ...(this.wanderers?.list.filter((p) => p.kind === 'merchant' && p.trader && !p.dead && !p.angry && !(p.fear > 0)) ?? [])];
    if (!list.length) return null;
    const eye = this.player.eyePosition(), dir = this.player.lookDirection();
    const found = this.wanderView.pickAt(list, eye, dir, REACH);
    if (!found) return null;
    if (hit && this.inTheWay(hit, eye, dir, found.t)) return null;
    return found.person;
  }

  /**
   * Whether the block `hit` stands between you and someone `t` along the
   * line from `eye`. Only as much of it as you'd bump into: a rug under a
   * trader's feet, vines hanging in front, or the low half a lantern or a
   * chair fills don't hide them (a tap on a trader behind their stall went
   * to the stall).
   */
  inTheWay(hit, eye, dir, t) {
    const box = this.world.collisionBoxAt(hit.x, hit.y, hit.z);
    if (!box) return false;
    const blockT = rayBox(eye, dir, hit.x, box.minY, hit.z, hit.x + 1, box.maxY, hit.z + 1);
    return blockT != null && blockT < t;
  }

  /**
   * A story moment (config/moments.js), the first time it comes up in this
   * world: a few lines on a card that stays a little longer than a toast,
   * kept in the Lore tab after. Nothing in a sandbox.
   */
  tellMoment(id) {
    const m = this.duilt?.moment(id);
    if (!m) return;
    this.ui?.toast({ kind: 'story', title: m.title, body: m.text, duration: 9000 });
    this.editedAt = Date.now();
    this.bus.emit('duilt:moment', { id });
  }

  /** The hermit's tale: who fell from the sky before you did (config/tales.js). */
  speakToHermit() {
    this.hermitTold = (this.hermitTold ?? -1) + 1;
    const t = this.duilt.tale('hermit', this.hermitTold);
    if (!t) return;
    this.ui?.toast({ kind: 'challenge', title: 'The hermit', body: t.line });
    this.editedAt = Date.now();
  }

  /** Half the time, a messenger brings the story rather than news of a place — while there's a tale you haven't heard. */
  messengerTale() {
    const d = this.duilt;
    if (!d || d.sandbox || Math.random() < 0.5) return null;
    const t = d.tale('messenger');
    if (t) this.editedAt = Date.now();
    return t?.line ?? null;
  }

  /** What the Stone King has to say to you — by the ring you bear. */
  speakToKing() {
    const ring = this.duilt?.skyFallen && this.duilt.ring === 'black' ? 'victor' : this.duilt?.army.sworn ? 'sworn' : this.duilt?.ring ?? 'none';
    const lines = NEWS.king[ring] ?? NEWS.king.none;
    this.kingLine = ((this.kingLine ?? -1) + 1) % lines.length;
    const sky = this.skyOpen() ? skyAt(this.world.gen) : null;
    const p = this.player.position;
    const body = lines[this.kingLine].replace('{dir}', sky ? compass(sky.x - p.x, sky.z - p.z) : 'east');
    this.ui?.toast({ kind: 'challenge', title: 'The Stone King', body });
  }

  /** The swarm of fireflies under the crosshair, if no block is in front of it. */
  fireflyTarget(hit = this.raycast()) {
    if (!this.fireflies) return null;
    const eye = this.player.eyePosition(), dir = this.player.lookDirection();
    const found = this.fireflies.pick(eye, dir, REACH);
    if (!found) return null;
    if (hit) {
      const blockT = rayBox(eye, dir, hit.x, hit.y, hit.z, hit.x + 1, hit.y + 1, hit.z + 1);
      if (blockT != null && blockT < found.t) return null;
    }
    return found.swarm;
  }

  /**
   * Break, aimed at a swarm of fireflies: a handful caught, into the bag —
   * what a Firefly Lantern is made with. Returns whether the press was spent
   * on them.
   */
  catchFireflies(hit) {
    const swarm = this.fireflyTarget(hit);
    if (!swarm) return false;
    const now = performance.now();
    if (now - (this.lastStrikeAt ?? 0) < this.strikeCooldown()) return true;
    this.lastStrikeAt = now;
    this.digTarget = null;
    // They go in a jar (batch: "catching fireflies should be done with a jar
    // that needs to be crafted with glass"): an empty one in, a full one out.
    const d = this.duilt;
    if (d && !d.sandbox && d.inventory.countOf('jar') < 1) {
      this.ui.toast({ kind: 'xp', title: 'You need a jar', body: 'Make a glass jar at the bench, then catch them in it.' });
      return true;
    }
    if (d && !d.sandbox) d.inventory.remove('jar', 1);
    this.fireflies.catchFrom(swarm);
    const got = d?.collect({ fireflies: 1 }) ?? {};
    if (d && !d.sandbox && !got.fireflies) d.inventory.add('jar', 1);
    this.ui.toast({ kind: 'xp', title: 'Caught some fireflies', body: got.fireflies ? '+1 jar of fireflies' : undefined });
    if (got.fireflies) this.tellMoment('first_fireflies');
    return true;
  }

  // ---- the Sky Kingdom (world/skyKingdom.js) ----

  /** Whether this world has the Sky Kingdom in it: the dark path — and Creative, to look at. */
  skyOpen() {
    const d = this.duilt;
    return !!(d && this.world?.gen && (d.sandbox || d.ring === 'black'));
  }

  /**
   * The two kingdoms, for the map: the Stone Kingdom once you've found it
   * (from the start in Creative), the Sky Kingdom once the Stone King has
   * told you of it (sworn to him — from the start in Creative).
   */
  kingdomSites() {
    const d = this.duilt, gen = this.world?.gen;
    if (!d || !gen) return [];
    const out = [];
    const stone = landmarksFor(gen).find((l) => l.kind === 'kingdom');
    if (stone && (d.sandbox || d.foundPlaces().some((p) => p.kind === 'kingdom'))) out.push({ kind: 'kingdom', name: 'Stone Kingdom', x: stone.x, z: stone.z });
    if (this.skyOpen() && (d.sandbox || d.army.sworn)) {
      const s = skyAt(gen);
      out.push({ kind: 'sky', name: 'Sky Kingdom', x: s.x, z: s.z });
    }
    // Battle: the rivals' cities, from the start — you know who you're up against.
    if (d.battle) for (const r of rivalSites(gen)) out.push({ kind: 'rival', name: r.name, x: r.x, z: r.z, colour: RIVAL_HEX[r.id] });
    return out;
  }

  /**
   * Creative only: straight to a kingdom, to look round it — the Stone
   * Kingdom from the air on the side towards home, the Sky Kingdom on its
   * avenue outside the gate nearest home. Returns whether you went.
   */
  travelTo(kind) {
    const d = this.duilt, gen = this.world?.gen;
    if (!d?.sandbox || !gen) return false;
    const home = { x: gen.biomes?.centreX ?? 0, z: gen.biomes?.centreZ ?? 0 };
    const face = (tx, tz) => { const p = this.player.position; this.player.yaw = Math.atan2(-(tx - p.x), -(tz - p.z)); this.player.pitch = -0.15; };
    if (kind === 'kingdom') {
      const k = landmarksFor(gen).find((l) => l.kind === 'kingdom');
      if (!k) return false;
      const dx = home.x - k.x, dz = home.z - k.z, len = Math.hypot(dx, dz) || 1;
      this.player.flying = true;
      this.player.teleport(k.x + (dx / len) * (k.half + 14), k.y + 22, k.z + (dz / len) * (k.half + 14));
      face(k.x, k.z);
      this.ui?.toast({ kind: 'challenge', title: 'The Stone Kingdom', body: 'Flying, outside its walls. The King is in the keep; the dark temple is west of it.' });
      return true;
    }
    if (kind === 'sky' && this.skyOpen()) {
      const s = skyFor(gen);
      const l = s.landings.reduce((best, l) => (Math.hypot(l.x - home.x, l.z - home.z) < Math.hypot(best.x - home.x, best.z - home.z) ? l : best));
      this.player.flying = false;
      this.player.teleport(l.arrive.x, l.arrive.y, l.arrive.z);
      face(s.x, s.z);
      this.ui?.toast({ kind: 'challenge', title: 'The Sky Kingdom', body: 'Outside its gate. The lift behind you goes down the chain to an anchor tower.' });
      return true;
    }
    return false;
  }

  // ---- the title scene (world/titleScene.js) ----

  /**
   * The landscape behind the worlds screen (asked for directly: "a beautiful
   * generated landscape, with animals roaming around and messengers, maybe
   * one mine and a bandit hut showing"). A meadow in a fixed world, an old
   * mine and a bandit camp laid either side of it, herds put out to graze,
   * bandits round their fire and a messenger on the road — the same people
   * and animals the game makes in play, left to get on with it while the
   * camera circles (tickTitle). Scenery: never saved, built again the same
   * every time.
   */
  openTitle() {
    if (this.title) return true;
    // The world boot made is this one, untouched: no need to make it twice.
    if (this.world !== this.bootWorld) this.newWorld({ mode: CREATIVE, name: 'Title', scenery: true, title: true, silent: true, seed: TITLE_SEED });
    this.bootWorld = null;
    const gen = this.world.gen;
    const site = { ...TITLE_SITE, y: gen.heightAt(TITLE_SITE.x, TITLE_SITE.z) };
    const { blocks, places } = titlePlaceBlocks(site, (x, z) => gen.heightAt(x, z));
    for (const [x, y, z, id] of blocks) if (this.world.getBlock(x, y, z) !== id) this.world.setBlock(x, y, z, id);
    this.syncMobs();
    // Herds out to graze, wandering as any herd does.
    for (const h of TITLE_HERDS) {
      const spec = MOBS_BY_ID.get(h.type);
      if (!spec) continue;
      for (let i = 0; i < h.n; i++) {
        const x = site.x + h.dx + (i % 2) * 2 - 1, z = site.z + h.dz + Math.floor(i / 2) * 2 - 1;
        this.mobs.list.push(this.mobs.make(spec, x + 0.5, gen.heightAt(x, z), z + 0.5));
      }
    }
    // Bandits round the camp's fire, idling the way they do at any camp.
    const camp = places.find((p) => p.kind === 'camp');
    if (camp) {
      const lm = { kind: 'camp', x: camp.x, y: camp.y, z: camp.z, half: camp.half, leave: 400 };
      this.wanderers.present.add(lm);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const x = camp.x + 0.5 + Math.cos(a) * 3, z = camp.z + 0.5 + Math.sin(a) * 3;
        this.wanderers.list.push(this.wanderers.person('bandit', x, camp.y, z, { landmark: lm, home: { x: camp.x + 0.5, z: camp.z + 0.5 } }));
      }
    }
    // Nobody comes for you here: no raids, no explorers of its own — the
    // messengers are sent by tickTitle, across the view.
    this.wanderers.untilExplorer = Infinity;
    this.mobs.cap = 14;
    // High enough on its circle to clear every treetop it passes.
    const topAt = (x, z) => {
      for (let y = this.world.height - 1; y > 0; y--) if (this.world.getBlock(x, y, z) !== AIR) return y;
      return 0;
    };
    this.title = { site, eyeY: orbitHeight(site, topAt), t: 0, sent: 0, untilMessenger: 2 };
    this.showcaseTime(TITLE_TIME);
    this.tickTitle(0);
    return true;
  }

  /**
   * One frame of the title: the camera a little further round its circle,
   * and the meadow's animals and people getting on with things — run here
   * because play is paused while the worlds screen is up.
   */
  tickTitle(dt) {
    const tl = this.title;
    if (!tl || !this.player) return;
    tl.t += dt;
    const pose = orbitPose(tl.site, tl.t, tl.eyeY);
    const eye = this.player.eyePosition().y - this.player.position.y;
    this.player.flying = true;
    this.player.position.set(pose.eye.x, pose.eye.y - eye, pose.eye.z);
    this.player.yaw = pose.yaw;
    this.player.pitch = pose.pitch;
    this.player.syncCamera();
    // The animals see the camera, high over the meadow, as nobody near.
    const far = { x: pose.eye.x, y: pose.eye.y + 40, z: pose.eye.z };
    this.mobs?.tick(dt, far);
    const middle = { x: tl.site.x, y: tl.site.y + 40, z: tl.site.z };
    // A messenger on the road every so often, two at most.
    tl.untilMessenger -= dt;
    if (this.wanderers && tl.untilMessenger <= 0 && this.wanderers.count('messenger') < 2) {
      tl.untilMessenger = 25 + (tl.sent % 3) * 10;
      const { from, to } = messengerPath(tl.site, tl.sent++);
      const y = this.world.gen.heightAt(Math.floor(from.x), Math.floor(from.z));
      this.wanderers.list.push(this.wanderers.person('messenger', from.x, y, from.z, { goal: to, stage: 'leaving' }));
    }
    this.wanderers?.tick(dt, middle);
  }

  // ---- the showcase (world/showcase.js) ----

  /**
   * Opens the showcase: a Creative world laid out for looking at
   * (docs/history/plan-look-and-sound.md, section 1) — every building in labelled
   * rows on flat grass, one of every animal and every kind of person
   * standing still, and fixed camera spots including the two kingdoms. See
   * world/showcase.js for the layout and tools/showcase-shots.mjs for the
   * pictures.
   *
   * The world you were in is saved first, as leaving it would. The
   * showcase is never saved — it's scenery: the same seed builds it again,
   * so anything done in it is forgotten.
   */
  openShowcase({ spot = 'overview', time = 'day' } = {}) {
    this.saveNow();
    this.newWorld({ mode: CREATIVE, name: 'Showcase', scenery: true, silent: true, seed: SHOWCASE_SEED });
    const gen = this.world.gen;
    const site = findShowcaseSite(gen);
    if (!site) return false;
    flattenShowcase(this.world, site);
    // The buildings through the same starterPlacement a tap on a design
    // goes through; the places the way the world lays them.
    for (const b of SHOWCASE_BUILDINGS) {
      if (!b.structure) continue;
      const plan = this.duilt.starterPlacement(b.structure, { x: site.x + b.anchor.x, y: site.y, z: site.z + b.anchor.z });
      for (const c of plan.changes ?? []) this.world.setBlock(c.x, c.y, c.z, c.next);
    }
    for (const [x, y, z, id] of placeBlocks(site)) this.world.setBlock(x, y, z, id);
    // The Sky city is laid only while this is set (Creative has it anyway — skyOpen).
    gen.sky = true;
    this.syncMobs();
    // Nobody wanders through the pictures: no herds, no explorers.
    this.mobs.cap = 0;
    this.wanderers.untilExplorer = Infinity;
    // Everyone in the same lists the game draws them from, made by the same
    // code that makes them in play, then stood still (`still`: Mobs and
    // Wanderers leave them be). Names and coats are fixed rather than rolled,
    // so a face is the same face in every picture.
    const figures = { settlers: [], defenders: [], warriors: [], guardians: [] };
    const defenders = new Defenders({ world: this.world });
    const army = new Army({ world: this.world });
    for (const g of SHOWCASE_FIGURES) {
      for (const f of g.figures) {
        const x = site.x + f.x, y = site.y, z = site.z + f.z;
        const still = { still: true, facing: f.facing, target: null, speed: 0 };
        if (f.kind === 'mob') {
          this.mobs.list.push(Object.assign(this.mobs.make(MOBS_BY_ID.get(f.type), x, y, z), still));
        } else if (f.kind === 'wanderer') {
          const make = (kind) => this.wanderers.person(kind, x, y, z, { ...still, name: f.label, colour: WANDERERS[kind].colours[0] });
          const p = make(f.type);
          this.wanderers.list.push(p);
          if (f.rider) {
            const r = make(f.rider);
            r.mount = p;
            p.rider = r;
            this.wanderers.list.push(r);
          }
        } else if (f.kind === 'settler') {
          figures.settlers.push({ id: `showcase-${f.n}`, name: settlerName(f.n), colour: settlerColour(f.n), x, y, z, ...still });
        } else if (f.kind === 'defender') {
          figures.defenders.push(Object.assign(defenders.person(f.type, { x: x - 0.5, y, z: z - 0.5 }, null), still));
        } else if (f.kind === 'warrior') {
          army.total = army.field.length + 1;
          army.muster({ x, y, z }, 0);
          figures.warriors.push(Object.assign(army.field.at(-1), { x, y, z }, still));
        } else if (f.kind === 'guardian') {
          figures.guardians.push(Object.assign(new Guardian({ world: this.world, ring: f.type, home: { x, y, z } }), still));
        }
      }
    }
    this.showcase = { site, figures, labelSpots: showcaseLabels(site), labels: true, spot: null };
    this.rebuildAllChunks();
    this.ui?.refreshForMode();
    this.showcaseTime(time);
    this.showcaseSpot(spot);
    return true;
  }

  /**
   * Stands you at one of the showcase's camera spots (SHOWCASE_SPOTS), flying,
   * looking where it looks. `settle` makes everything in sight now rather
   * than over the next few seconds of frames — what a script taking a
   * picture wants. Returns whether there was such a spot.
   */
  showcaseSpot(id, { settle = false } = {}) {
    const spot = SHOWCASE_SPOTS_BY_ID.get(id);
    if (!this.showcase || !spot) return false;
    const pose = spotPose(spot, { site: this.showcase.site, gen: this.world.gen, world: this.world });
    if (!pose) return false;
    const eye = this.player.eyePosition().y - this.player.position.y;
    this.player.flying = true;
    this.player.teleport(pose.eye.x, pose.eye.y - eye, pose.eye.z);
    this.player.yaw = pose.yaw;
    this.player.pitch = pose.pitch;
    this.showcase.spot = id;
    if (settle) this.finishLoading();
    return true;
  }

  /** The showcase's hour: 'day', 'dusk', 'night' (SHOWCASE_TIMES), or a time 0..1. It holds there. */
  showcaseTime(when) {
    const t = typeof when === 'number' ? when : SHOWCASE_TIMES[when];
    if (t == null) return false;
    this.dayCycle.time = t;
    if (this.duilt) this.duilt.dayTime = t;
    return true;
  }

  /**
   * Makes and meshes everything in sight now, instead of a few milliseconds
   * a frame: the chunks round you, their meshes, and the far ground. A
   * stall, so only for when one is wanted — a picture about to be taken.
   */
  finishLoading() {
    if (!this.world || !this.player) return;
    this.streamedAt = null;
    this.streamChunks();
    this.generateQueued(Infinity);
    for (let i = 0; i < 10_000; i++) {
      const before = this.remeshQueue.size;
      this.drainRemeshQueue(Infinity);
      if (this.remeshQueue.size === before) break;
    }
    const { x, z } = this.player.position;
    this.farTerrain?.update(this.world.gen, x, z, { budgetMs: Infinity, world: this.world });
    this.updateChunkVisibility();
  }

  /** A list the game draws, with the showcase's own people of that kind added — see openShowcase. */
  withShowcase(kind, list) {
    const extra = this.showcase?.figures[kind];
    return extra?.length ? [...list, ...extra] : list;
  }

  /** The island, planned, when you're near enough to meet its people — and it hasn't fallen. */
  skyNear() {
    if (!this.skyOpen() || this.duilt.skyFallen) return null;
    const at = skyAt(this.world.gen), p = this.player.position;
    return Math.hypot(at.x - p.x, at.z - p.z) < SKY_PEOPLE ? skyFor(this.world.gen) : null;
  }

  /**
   * An anchor tower's lift takes you up to its landing on the island; a
   * landing's takes you back down to the tower. Warriors following you come
   * too.
   */
  /**
   * A sky lift of your own (asked for directly: "Sky lift in creative does
   * not work"): it rides its chain — links straight up or down from it — to
   * the lift at the other end, and sets you down beside that one. Null
   * without a chain, or with nothing at the far end of it.
   */
  chainLift(x, y, z) {
    for (const dir of [1, -1]) {
      let at = y + dir, links = 0;
      while (links < this.world.height && this.world.getBlock(x, at, z) === CHAIN) { at += dir; links++; }
      if (links && this.world.getBlock(x, at, z) === SKY_LIFT) return { up: dir > 0, to: this.standBeside(x, at, z), links };
    }
    return null;
  }

  /** Somewhere to stand by the block at (x, y, z): ground beside it, two clear above — or on top of it. */
  standBeside(x, y, z) {
    const w = this.world;
    for (const fy of [y, y + 1, y - 1]) {
      for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const sx = x + dx, sz = z + dz;
        if (w.isSolid(sx, fy - 1, sz) && !w.isSolid(sx, fy, sz) && !w.isSolid(sx, fy + 1, sz)) return { x: sx + 0.5, y: fy, z: sz + 0.5 };
      }
    }
    return { x: x + 0.5, y: y + 1, z: z + 0.5 };
  }

  rideLift({ x, y, z }) {
    const ride = this.world.gen ? liftAt(this.world.gen, x, y, z) : null;
    if (!ride) {
      const own = this.chainLift(x, y, z);
      if (!own) return void this.ui?.toast({ kind: 'xp', title: 'It goes nowhere yet', body: 'Hang chain straight up or down from it, with another sky lift at the far end — it rides the chain between them.' });
      this.player.teleport(own.to.x, own.to.y, own.to.z);
      this.player.velocity?.set?.(0, 0, 0);
      this.sound?.lift();
      return void this.ui?.toast({ kind: 'challenge', title: own.up ? 'Up the chain' : 'Down the chain', body: `${own.links} links` });
    }
    const i = skyFor(this.world.gen).towers.indexOf(ride.tower);
    if (this.duilt && !this.duilt.sandbox && this.duilt.skyWar.chains[i]) {
      this.ui?.toast({ kind: 'xp', title: 'Its chain is cut', body: 'This lift goes nowhere now — another tower\'s still might' });
      return;
    }
    const from = { x: this.player.position.x, z: this.player.position.z };
    this.player.teleport(ride.to.x, ride.to.y, ride.to.z);
    const army = this.duilt?.army;
    if (army?.active && army.mode === 'follow') {
      for (const w of army.field) {
        if (Math.hypot(w.x - from.x, w.z - from.z) > 30) continue;
        w.x = ride.to.x + (Math.random() - 0.5) * 3; w.z = ride.to.z + (Math.random() - 0.5) * 3; w.y = ride.to.y;
      }
    }
    this.sound?.lift();
    this.ui?.toast(ride.up
      ? { kind: 'challenge', title: 'Up the chain to the Sky Kingdom', body: this.wanderers?.skyHostile() ? 'Its guards know the Black Ring. Bring down the Sky King in his palace.' : 'White marble and gold, a long way up' }
      : { kind: 'challenge', title: 'Down to the anchor tower' });
  }

  // ---- going home in disguise (duilt/Suspicion.js) ----

  /** In the full Sky armour, on the dark path, at the Sky Kingdom: disguised. */
  disguised() {
    const d = this.duilt, gen = this.world?.gen;
    if (!d || d.sandbox || d.ring !== 'black' || d.skyFallen || !gen || d.disguisedAs() !== 'sky') return false;
    const at = skyAt(gen), p = this.player.position;
    return Math.hypot(at.x - p.x, at.z - p.z) < SKY_ATTACK_IN;
  }

  /** Disguised, and not yet seen through. */
  unseen() {
    return this.disguised() && !this.suspicion.discovered;
  }

  /**
   * Each frame in disguise: what you're giving away fills the meter, and
   * when it's full you're discovered — every guard near knows you, and it's
   * open battle. Leave the island and it's forgotten.
   */
  /** IMP-31: on good terms, the Sky King's gifts, the first time you come to his kingdom. */
  checkSkyGift() {
    const d = this.duilt;
    if (d?.skyGiftDue() && this.skyOpen()) {
      const gen = this.world?.gen, at = this.player.position;
      if (gen && Math.hypot(skyAt(gen).x - at.x, skyAt(gen).z - at.z) <= SKY_ATTACK_OUT) {
        const got = d.giveSkyGift();
        if (got?.gave) {
          this.editedAt = Date.now();
          this.ui?.toast({ kind: 'achievement', title: 'Gifts from the Sky King', body: 'For breaking the Stone Kingdom\'s raids: a sky sword, a set of sky armour and 20 gold ingots.' });
        } else if (got?.full && !this.skyGiftAsked) {
          this.skyGiftAsked = true;
          this.ui?.toast({ kind: 'challenge', title: 'The Sky King has gifts for you', body: 'Make room for 5 pieces of gear and 20 gold ingots, and come back.' });
        }
      }
    }
  }

  tickDisguise(dt) {
    const d = this.duilt;
    const on = this.disguised();
    if (!on) {
      const gen = this.world?.gen, p = this.player.position;
      const away = !gen || !this.skyOpen() || Math.hypot(skyAt(gen).x - p.x, skyAt(gen).z - p.z) > SKY_ATTACK_OUT;
      if (away || d?.skyFallen) this.suspicion.reset();
      this.markerView.update([]);
      this.ui?.duiltUI?.renderSuspicion?.(null);
      return;
    }
    const p = this.player.position;
    const sky = this.wanderers.list.filter((q) => WANDERERS[q.kind]?.sky && !q.dead);
    if (!this.suspicion.discovered) {
      const palace = skyFor(this.world.gen).palace;
      const worn = Object.values(d.worn).map((w) => w?.id ?? '');
      this.suspicion.tick(dt, {
        ring: d.ringWorn() === 'black',
        running: !!this.player.running,
        darkGear: worn.some((id) => DARK_GEAR.test(id)) || DARK_GEAR.test(this.selectedItemId ?? ''),
        nearGuards: sky.filter((q) => q.kind !== 'sky_king' && Math.hypot(q.x - p.x, q.z - p.z) < SUSPICION.near && Math.abs(q.y - p.y) < 3).length,
        inThrone: p.x >= palace.minX && p.x <= palace.maxX + 1 && p.z >= palace.minZ && p.z <= palace.maxZ + 1 && Math.abs(p.y - 172) < 4,
        warriors: d.army.active ? d.army.field.filter((w) => Math.hypot(w.x - p.x, w.z - p.z) < 14).length : 0,
      });
      if (this.suspicion.discovered) this.revealDisguise();
    }
    // A ? over each guard near enough to be looking you over; a ! over those who know.
    const s = this.suspicion;
    this.markerView.update(sky.filter((q) => q.kind !== 'sky_king' || s.discovered)
      .filter((q) => Math.hypot(q.x - p.x, q.z - p.z) < (s.discovered ? 24 : 10))
      .filter(() => s.discovered || s.level > 25)
      .map((q) => ({ x: q.x, y: q.y, z: q.z, mark: s.discovered ? '!' : '?' })));
    this.ui?.duiltUI?.renderSuspicion?.({ level: s.level / SUSPICION.max, rising: s.rising, reason: s.reason, discovered: s.discovered });
  }

  /** Seen through: every guard near knows you now, and comes. */
  revealDisguise() {
    if (!this.suspicion.discovered) this.suspicion.reveal();
    const p = this.player.position;
    for (const q of this.wanderers?.list ?? []) {
      if (WANDERERS[q.kind]?.sky && Math.hypot(q.x - p.x, q.z - p.z) < 30) q.angry = true;
    }
  }

  /**
   * Anyone you can fight is solid: you can't walk through a bandit, and one
   * can't stand inside you. You're eased out of them (most of the way) and
   * they out of you (the rest), so a fight is two bodies, not two ghosts
   * — reported: "the NPCs don't look like entities".
   */
  keepApart() {
    // Everybody who takes up room, through one grid (world/bodies.js): the
    // cost goes with how many there are, not its square, and nothing is
    // allocated — it was next to many warriors that the camera froze.
    const d = this.duilt, p = this.player.position;
    const crowd = this._crowd ??= new Crowd();
    const who = this._crowdWho ??= { mobs: null, wanderers: null, settlers: null, soldiers: null, warriors: null, guardian: null, player: null };
    const self = this._crowdSelf ??= { x: 0, y: 0, z: 0, pushX: 0, pushZ: 0 };
    self.x = p.x; self.y = p.y; self.z = p.z;
    who.mobs = this.mobs?.list ?? null;
    who.wanderers = this.wanderers?.list ?? null;
    who.settlers = d?.settlers?.people ?? null;
    who.soldiers = d?.defenders?.soldiers ?? null;
    who.warriors = d?.army?.field ?? null;
    who.guardian = d?.guardian ?? null;
    // In the air, in the saddle or at the controls, you aren't in anybody's way.
    who.player = this.player.flying || this.riding || this.piloting || this.driving ? null : self;
    gatherCrowd(crowd, who).resolve(this.world);
    // You are moved through your own collision, so nobody walks you into a wall.
    if (who.player && (self.pushX || self.pushZ)) this.player.moveAndCollide(self.pushX, 0, self.pushZ);
  }

  /**
   * CRAFT3D: a crafting machine close up (render/CloseUp.js). The world
   * waits (see phase), the machine moves the camera, its bar takes the
   * controls, and presses on the picture go to the machine.
   */
  /** The Carpenter's Table's 3D view (tests and the table's own bar read it). */
  get counterView() {
    return this.counterMachine?.view ?? null;
  }

  openMachine(machine, at) {
    if (!this.closeUp) {
      this.closeUp = new CloseUp({ uiRoot: this.uiRoot, onEnd: () => { this.player?.releaseKeys?.(); this.player?.syncCamera?.(); } });
      this.bindMachinePointer();
      // A key let go ends what it held (Space on the Carpenter's Table's saw).
      window.addEventListener('keyup', (e) => { if (this.closeUp?.active) this.closeUp.machine.key?.(e.code, false, false); });
    }
    this.closeUp.open(machine, `${at.x},${at.y},${at.z}`, at);
    this.ui.hideBlocker?.();
  }

  /** CRAFT3D-1: the Carpenter's Table (block 530, station `counter`) at `at`. */
  startCounter(at) {
    if (!this.duilt) return;
    this.counterMachine ??= new CounterMachine({ scene: this.scene, camera: this.camera, uiRoot: this.uiRoot, counters: this.duilt.counters, bus: this.bus,
      age: () => (this.duilt?.sandbox ? Infinity : this.duilt?.age ?? 1), onLeave: () => this.endMachine(),
      onDone: ({ item, took }) => {
        this.ui.toast(took ? { kind: 'challenge', title: `${itemName(item)} made`, body: 'In your bag' } : { kind: 'xp', title: `${itemName(item)} is ready`, body: 'Make room in your bag; it waits on the table' });
        this.editedAt = Date.now();
      } });
    this.counterMachine.use(this.duilt.counters);
    this.openMachine(this.counterMachine, at);
  }

  /** CRAFT3D-3: the crucible at `at`, if a foundry stands round it. */
  startCrucible(at) {
    if (!this.duilt) return;
    if (!this.duilt.inFoundry(`${at.x},${at.y},${at.z}`)) {
      this.ui.toast({ kind: 'xp', title: "A crucible needs a foundry's heat", body: 'Place it inside one.' });
      return;
    }
    this.crucibleMachine ??= new CrucibleMachine({ scene: this.scene, camera: this.camera, uiRoot: this.uiRoot, crucibles: this.duilt.crucibles,
      age: () => (this.duilt?.sandbox ? Infinity : this.duilt?.age ?? 1), onLeave: () => this.endMachine(),
      onPoured: () => { this.editedAt = Date.now(); } });
    this.crucibleMachine.use(this.duilt.crucibles);
    this.openMachine(this.crucibleMachine, at);
  }

  /** CRAFT-9 part 6: the Kiln Oven at `at`, if a kiln stands round it. */
  startKilnOven(at) {
    if (!this.duilt) return;
    if (!this.duilt.inBuilding(`${at.x},${at.y},${at.z}`, 'kiln')) {
      this.ui.toast({ kind: 'xp', title: "A Kiln Oven needs a kiln's heat", body: 'Place it inside one.' });
      return;
    }
    this.kilnMachine ??= new CrucibleMachine({ scene: this.scene, camera: this.camera, uiRoot: this.uiRoot, crucibles: this.duilt.kilnOvens, kind: 'kiln',
      age: () => (this.duilt?.sandbox ? Infinity : this.duilt?.age ?? 1), onLeave: () => this.endMachine(),
      onPoured: () => { this.editedAt = Date.now(); } });
    this.kilnMachine.use(this.duilt.kilnOvens);
    this.openMachine(this.kilnMachine, at);
  }

  /** PLAY-16: the Dehydrator at `at`: no building needed, it dries on its own. */
  startDehydrator(at) {
    if (!this.duilt) return;
    this.dehydratorMachine ??= new CrucibleMachine({ scene: this.scene, camera: this.camera, uiRoot: this.uiRoot, crucibles: this.duilt.dehydrators, kind: 'dehydrator',
      age: () => (this.duilt?.sandbox ? Infinity : this.duilt?.age ?? 1), onLeave: () => this.endMachine(),
      onPoured: () => { this.editedAt = Date.now(); } });
    this.dehydratorMachine.use(this.duilt.dehydrators);
    this.openMachine(this.dehydratorMachine, at);
  }

  /** PLAY-19: the Cauldron at `at`: its own fire, so no building is needed. */
  startCauldron(at) {
    if (!this.duilt) return;
    this.cauldronMachine ??= new CrucibleMachine({ scene: this.scene, camera: this.camera, uiRoot: this.uiRoot, crucibles: this.duilt.cauldrons, kind: 'cauldron',
      age: () => (this.duilt?.sandbox ? Infinity : this.duilt?.age ?? 1), onLeave: () => this.endMachine(),
      onPoured: () => { this.editedAt = Date.now(); } });
    this.cauldronMachine.use(this.duilt.cauldrons);
    this.openMachine(this.cauldronMachine, at);
  }

  /** CRAFT3D-2, 4 to 7: a bench machine (wood mill, forge, spinning wheel...) in close-up. */
  startBench(at, station) {
    if (!this.duilt) return;
    this.benchMachine ??= new BenchMachine({ scene: this.scene, camera: this.camera, uiRoot: this.uiRoot, game: this,
      onLeave: () => this.endMachine(),
      onMany: (st, spot) => { this.endMachine(); this.ui.openBench('', st, spot); },
      onMade: () => { this.editedAt = Date.now(); } });
    this.benchMachine.use(station);
    this.openMachine(this.benchMachine, at);
  }

  endMachine() {
    this.closeUp?.close();
  }

  bindMachinePointer(...args) { return GameInput.bindMachinePointer.apply(this, args); }

  /** Opens the chest you're pointing at, on the store screen. */
  openChest(hit) {
    if (!this.duilt || !isChest(this.world.getBlock(hit.x, hit.y, hit.z))) return;
    this.unpackFound(hit.x, hit.y, hit.z);
    this.duilt.chestAt(hit.x, hit.y, hit.z);
    this.sound?.chest();
    this.ui.openStore({ chest: { x: hit.x, y: hit.y, z: hit.z } });
  }

  /**
   * A chest you found (Phase 7c): the first time it's opened or broken,
   * what's in it is rolled — a bandit's takings at a camp, the hermit's
   * things at the hut, each place to find its own (playtest, P4), and
   * anything else is an old chest in the caves.
   * Says so once, and names a ring ore if there's one in it.
   */
  unpackFound(x, y, z) {
    const near = this.world.gen ? landmarksFor(this.world.gen).find((l) => Math.abs(l.x - x) <= l.half + 1 && Math.abs(l.z - z) <= l.half + 1) : null;
    const kind = near ? (LOOT[near.kind] ? near.kind : 'camp') : 'cave';
    const loot = this.duilt.unpackFound(x, y, z, kind, this.world.gen?.seed ?? 0);
    if (!loot) return null;
    const rare = loot.sunstone ? 'Sunstone' : loot.nightstone ? 'Nightstone' : null;
    this.ui?.toast({
      kind: rare ? 'achievement' : 'challenge',
      title: rare ? `${LOOT[kind].name} — with ${rare} in it!` : LOOT[kind].name,
      body: rare ? `${rare} is what a ${rare === 'Sunstone' ? 'White' : 'Black'} Ring is forged from` : 'Somebody left this here',
    });
    return loot;
  }

  /**
   * Something taken from a chest out in the world. At a tree tribe's
   * village, that's theft, and they see it (asked for: "neutral, but hostile
   * if you steal from their chests or attack them") — the whole tribe, at
   * once. Said once, the first time.
   */
  // ---- time travel (world/past.js) ----

  /** Place on a time machine: in the Past or the Future, home again; anywhere else, the choice of when. */
  useTimeMachine() {
    const d = this.duilt, gen = this.world?.gen;
    if (!d || !gen) return;
    const x = this.player.position.x, cx = gen.biomes.centreX;
    if (inPast(x, cx) || inFuture(x, cx)) return void this.travelHome();
    this.ui.confirm({
      title: 'The time machine',
      body: 'The Past: jungle and fern plains, dinosaurs that hit hard, and eggs to bring home. The Future: a city of glass towers, trams and flying cars — and a university whose Archive knows how it was all made. Either way it sets you down by another machine, the way back.',
      ok: 'To the Past',
      alt: 'To the Future',
    }).then((go) => { if (go === 'alt') this.travelFuture(); else if (go) this.travelPast(); });
  }

  /**
   * To the Future: the plaza in the middle of its city, a machine beside you
   * for the way home, and its people about the square.
   */
  travelFuture() {
    const d = this.duilt, gen = this.world.gen, w = this.world;
    const p = this.player.position;
    d.time.back = { x: p.x, y: p.y, z: p.z };
    const at = futureArrival(gen.biomes.centreX, gen.biomes.centreZ);
    const y = FUTURE_GROUND;
    w.setBlock(at.x + 2, y, at.z, TIME_MACHINE);
    this.remeshDirty();
    this.stopRide?.();
    this.bringPack(p, { x: at.x, y, z: at.z });
    this.player.teleport?.(at.x + 0.5, y, at.z + 0.5) ?? this.player.position.set(at.x + 0.5, y, at.z + 0.5);
    this.player.velocity?.set?.(0, 0, 0);
    this.peopleTheFuture(at, y);
    const first = !d.time.futureVisited;
    d.time.futureVisited = true;
    this.editedAt = Date.now();
    this.gamification?.checkAchievements(null);
    this.sound?.lift?.();
    this.ui.toast({ kind: 'achievement', title: 'The Future', body: first ? 'Towers of glass, trams and flying cars. The university is just east of the square — find its Archive.' : 'Back in the city to come.', duration: 7000 });
  }

  /** The Future's people, about its plaza: a dozen of them, going about their day. */
  peopleTheFuture(at, y) {
    if (!this.wanderers) return;
    this.wanderers.list = this.wanderers.list.filter((q) => q.landmark?.kind !== 'future');
    const lm = { kind: 'future', x: at.x, z: at.z, y, half: 60, leave: 400 };
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, r = 5 + (k % 3) * 3;
      const x = at.x + 0.5 + Math.cos(a) * r, z = at.z + 0.5 + Math.sin(a) * r;
      this.wanderers.list.push(this.wanderers.person('futurian', x, y, z, { landmark: lm, home: { x, z } }));
    }
  }

  /**
   * The Archive (Place on it, in the Future's university): how the city was
   * made — its paving, glass and steel, neon, screens and lamps — to make at
   * an engineering centre at home (config/recipes.js `future`).
   */
  readArchive() {
    const d = this.duilt;
    if (!d) return;
    if (d.time.futureKnown) return void this.ui.toast({ kind: 'xp', title: 'The Archive', body: 'You know all it has to teach. Make it at an engineering centre, at home.' });
    d.time.futureKnown = true;
    this.editedAt = Date.now();
    this.gamification?.checkAchievements(null);
    this.sound?.lift?.();
    const names = RECIPES.filter((r) => r.future).map((r) => r.name);
    this.ui.toast({ kind: 'achievement', title: 'Knowledge of the Future', body: `${names.join(', ')} — yours to make at an engineering centre.`, duration: 9000 });
  }

  /** To the Past: set down on dry ground there, by a machine of its own for the way home. */
  travelPast() {
    const d = this.duilt, gen = this.world.gen, w = this.world;
    const p = this.player.position;
    d.time.back = { x: p.x, y: p.y, z: p.z };
    let at = pastArrival(gen.biomes.centreX, gen.biomes.centreZ);
    // Not in a river: a little further along until the ground's dry.
    for (let i = 0; i < 40 && gen.waterLevelAt(at.x, at.z); i++) at = { x: at.x, z: at.z + 8 };
    const y = gen.heightAt(at.x, at.z);
    // A clearing to land in — whatever grew there is cut back — and the
    // machine beside it, on firm ground.
    for (let dx = -1; dx <= 2; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (!w.isSolid(at.x + dx, y - 1, at.z + dz)) w.setBlock(at.x + dx, y - 1, at.z + dz, 2);
        for (let dy = 0; dy < 4; dy++) w.setBlock(at.x + dx, y + dy, at.z + dz, 0);
      }
    }
    w.setBlock(at.x + 2, y, at.z, TIME_MACHINE);
    this.remeshDirty();
    this.stopRide?.();
    this.bringPack(p, { x: at.x, y, z: at.z });
    this.player.teleport?.(at.x + 0.5, y, at.z + 0.5) ?? this.player.position.set(at.x + 0.5, y, at.z + 0.5);
    this.player.velocity?.set?.(0, 0, 0);
    const first = !d.time.pastVisited;
    d.time.pastVisited = true;
    this.editedAt = Date.now();
    this.gamification?.checkAchievements(null);
    this.sound?.lift?.();
    this.ui.toast({ kind: 'achievement', title: 'The Past', body: first ? 'Long before the kingdoms. Mind the raptors — and look for eggs in the ferns.' : 'Back among the dinosaurs.', duration: 6000 });
  }

  /** Home from the Past or the Future: back where you left. */
  travelHome() {
    const d = this.duilt, gen = this.world.gen;
    const b = d.time.back ?? { x: gen.biomes.centreX + 0.5, y: gen.heightAt(gen.biomes.centreX, gen.biomes.centreZ), z: gen.biomes.centreZ + 0.5 };
    d.time.back = null;
    if (this.wanderers) this.wanderers.list = this.wanderers.list.filter((q) => q.landmark?.kind !== 'future');
    this.stopRide?.();
    this.bringPack(this.player.position, b);
    this.player.teleport?.(b.x, b.y + 0.05, b.z) ?? this.player.position.set(b.x, b.y + 0.05, b.z);
    this.player.velocity?.set?.(0, 0, 0);
    this.editedAt = Date.now();
    this.sound?.lift?.();
    this.ui.toast({ kind: 'xp', title: 'Home again', body: 'The present, where you left it.' });
  }

  /** Your tamed dinosaurs: the ones that fight (config/mobs.js `fight`), wherever they are. */
  pack() {
    return (this.duilt?.mounts ?? []).filter((m) => !m.dead && MOBS_BY_ID.get(m.type)?.fight);
  }

  /**
   * The whistle (asked for directly: "build an army of dinosaurs", and
   * "ride it or have it fight beside you"): your dinosaurs in earshot follow
   * you, and fight what comes at you — or, blown again, stay where they are.
   */
  blowWhistle() {
    const p = this.player.position;
    const near = this.pack().filter((m) => Math.hypot(m.x - p.x, m.z - p.z) <= WHISTLE_REACH);
    if (!near.length) return void this.ui.toast({ kind: 'xp', title: 'Nothing answers', body: 'Tame a dinosaur in the Past — or hatch one — and blow it within earshot.' });
    const follow = !near.some((m) => m.follow);
    for (const m of near) { m.follow = follow; if (!follow) { m.target = null; m.speed = 0; } }
    this.editedAt = Date.now();
    this.sound?.lift?.();
    this.ui.toast(follow
      ? { kind: 'challenge', title: `${near.length} dinosaur${near.length === 1 ? '' : 's'} at your heel`, body: 'They follow you, and go for anything that comes at you. Blow again and they stay.' }
      : { kind: 'xp', title: 'Stay', body: `${near.length} dinosaur${near.length === 1 ? '' : 's'} wait where they are.` });
  }

  /**
   * Your following dinosaurs, each frame: at whatever's coming for you near
   * by — bandits, the Kingdom's soldiers, a wild raptor — or back at your
   * side. Fought off, it drops what it carried into your bag.
   */
  tickPack(dt) {
    const pack = this.pack().filter((m) => m.follow && !m.ridden);
    if (!pack.length) return;
    const p = this.player.position;
    const hostile = this.wanderers?.hostile();
    const people = (this.wanderers?.list ?? []).filter((e) => WANDERERS[e.kind].hp && !e.dead && (hostile || e.angry || e.raider || e.war || this.wanderers.hostileOf(e)));
    const beasts = (this.mobs?.list ?? []).filter((e) => !e.owned && !e.dead && !(e.dying > 0) && (e.chasing || e.angryFor > 0));
    for (const m of pack) {
      const spec = MOBS_BY_ID.get(m.type);
      m.biteIn = Math.max(0, (m.biteIn ?? 0) - dt);
      const away = Math.hypot(m.x - p.x, m.z - p.z);
      // Left a long way behind (you went through time, or somewhere it
      // can't): it waits there until you come back for it.
      if (away > PACK_LOST) { m.target = null; m.speed = 0; continue; }
      let foe = null, fd = PACK_FIGHT;
      for (const e of [...people, ...beasts]) {
        const de = Math.hypot(e.x - m.x, e.z - m.z);
        if (de < fd && Math.hypot(e.x - p.x, e.z - p.z) < PACK_FIGHT * 2) { foe = e; fd = de; }
      }
      m.grazing = false;
      if (foe) {
        m.bestAway = away; m.sinceBetter = 0;
        if (fd > spec.fight.reach * 0.8) { m.target = { x: foe.x, z: foe.z }; m.speed = spec.run; continue; }
        m.target = null; m.speed = 0; m.facing = Math.atan2(foe.x - m.x, foe.z - m.z);
        if (m.biteIn > 0) continue;
        m.biteIn = spec.fight.every;
        const res = people.includes(foe) ? this.wanderers.hit(foe, spec.fight.damage, m.x, m.z) : this.mobs.hit(foe, spec.fight.damage, m.x, m.z);
        if (res?.killed) {
          const gained = this.duilt.collect(res.drops) ?? {};
          const got = Object.entries(gained).map(([id, n]) => `+${n} ${itemName(id).toLowerCase()}`).join(', ');
          this.ui.toast({ kind: 'xp', title: `Your ${spec.name.toLowerCase()} brought down ${foe.name ?? `a ${MOBS_BY_ID.get(foe.type)?.name.toLowerCase()}`}`, body: got || undefined });
        }
        continue;
      }
      // Fallen too far behind (a cliff, a river it won't cross), or got no
      // nearer than its best for a while (a long-neck among houses it can't
      // fit between, a raptor in a thicket): it catches you up the way a pet
      // does, just behind you.
      if (away > PACK_HEEL * 3 && away > (m.bestAway ?? Infinity) - 1) m.sinceBetter = (m.sinceBetter ?? 0) + dt;
      else { m.bestAway = away; m.sinceBetter = 0; }
      if (away > PACK_CATCH_UP || m.sinceBetter > PACK_STUCK) {
        const back = this.player.yaw ?? 0;
        const tx = p.x + Math.sin(back) * 4, tz = p.z + Math.cos(back) * 4;
        const ty = this.mobs.groundAt(tx, tz, p.y + 2, spec);
        if (ty != null) { m.x = tx; m.z = tz; m.y = ty; m.vy = 0; m.target = null; m.detour = 0; m.bestAway = 4; m.sinceBetter = 0; continue; }
      }
      // Round a trunk or a wall it walked into (Mobs.move), before coming on.
      if (m.detour > 0 && m.target) { m.detour -= dt; m.speed = spec.run; continue; }
      // At your side: a few blocks off, running to catch up.
      if (away > PACK_HEEL) {
        const k = (away - PACK_HEEL + 0.5) / away;
        m.target = { x: m.x + (p.x - m.x) * k, z: m.z + (p.z - m.z) * k };
        m.speed = away > 8 ? spec.run : spec.walk * 2;
      } else { m.target = null; m.speed = 0; }
    }
  }

  /** Your dinosaurs at your heel go where you go — through time, too. */
  bringPack(from, to) {
    let i = 0;
    for (const m of this.pack()) {
      if (!m.follow || m.ridden || Math.hypot(m.x - from.x, m.z - from.z) > PACK_TRAVEL) continue;
      const a = (i++ / 6) * Math.PI * 2;
      m.x = to.x + Math.cos(a) * 3; m.z = to.z + Math.sin(a) * 3; m.y = to.y + 1; m.vy = 0;
      m.target = null;
    }
  }

  /** A dinosaur's bite: through your armour, and a jolt, as a bandit's blow is. */
  dinoBites(m, damage) {
    if (!this.duilt || this.duilt.sandbox || this.riding === m) return;
    const taken = this.duilt.hurt(damage, 'dinosaur');
    if (!taken) return;
    if (this.player.grounded) this.player.velocity.y = 4.5;
    // Thrown back by its weight: a raptor's bite a step, a triceratops's horn a few.
    this.player.nudge(this.player.position.x - m.x, this.player.position.z - m.z, Math.min(7, 2.5 + Math.sqrt(MOBS_BY_ID.get(m.type)?.mass ?? 1)));
    this.sound?.blow?.(damage >= 4, { x: m.x, z: m.z });
  }

  /** IMP-45: a dragon's fire reaching you. */
  dragonFire(m, damage) {
    if (!this.duilt || this.duilt.sandbox) return;
    const taken = this.duilt.hurt(damage, 'dragon');
    if (!taken) return;
    this.player.nudge(this.player.position.x - m.x, this.player.position.z - m.z, 3);
    this.sound?.blow?.(true, { x: m.x, z: m.z });
  }

  /**
   * Your dragons (hatched from an egg), each frame: the nearest thing coming
   * for you, a raider, a soldier, a hunting beast or a wild dragon, is
   * theirs to burn (Mobs.fly breathes at `m.foe`).
   */
  tickPetDragons() {
    const pets = (this.duilt?.mounts ?? []).filter((m) => !m.dead && m.owned && MOBS_BY_ID.get(m.type)?.flies);
    if (!pets.length) return;
    const p = this.player.position, hostile = this.wanderers?.hostile();
    const people = (this.wanderers?.list ?? []).filter((e) => WANDERERS[e.kind].hp && !e.dead && !WANDERERS[e.kind].god && (hostile || e.angry || e.raider || e.war || this.wanderers.hostileOf(e)));
    const beasts = (this.mobs?.list ?? []).filter((e) => !e.owned && !e.dead && !(e.dying > 0) && (e.chasing || e.angryFor > 0 || (MOBS_BY_ID.get(e.type)?.flies && e.breathAt)));
    for (const m of pets) {
      let foe = null, best = PET_FIGHT;
      for (const e of [...people, ...beasts]) {
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (d < best) { foe = e; best = d; }
      }
      m.foe = foe;
    }
  }

  /** A pet dragon's fire reaching its foe: burnt, and what it carried into your bag. */
  petDragonFire(m, foe, damage) {
    const spec = MOBS_BY_ID.get(m.type);
    const person = this.wanderers?.list.includes(foe);
    const res = person ? this.wanderers.hit(foe, damage, m.x, m.z) : this.mobs.hit(foe, damage, m.x, m.z);
    if (!res?.killed) return;
    const gained = this.duilt?.collect(res.drops) ?? {};
    const got = Object.entries(gained).map(([id, n]) => `+${n} ${itemName(id).toLowerCase()}`).join(', ');
    this.ui.toast({ kind: 'xp', title: `Your ${spec.name.toLowerCase()} burnt ${foe.name ?? `a ${MOBS_BY_ID.get(foe.type)?.name.toLowerCase()}`}`, body: got || undefined });
  }

  /**
   * IMP-45 (owner: "Dragons drop claws and scales randomly ... pick them by
   * click break on them"): what a dragon sheds lands on the ground near it,
   * a scale or claw on top of a block, to be broken to pick up.
   */
  shedDragon(mob, items) {
    const blocks = { dragon_scale: DRAGON_SCALE, dragon_claw: DRAGON_CLAW };
    let placed = 0;
    for (const [id, n] of Object.entries(items)) {
      for (let k = 0; k < n; k++) {
        for (let tries = 0; tries < 8; tries++) {
          const x = Math.floor(mob.x + (Math.random() - 0.5) * 6), z = Math.floor(mob.z + (Math.random() - 0.5) * 6);
          const top = surfaceAt(this.world, x, z);
          if (top == null) continue;
          const y = Math.ceil(top);
          if (this.world.getBlock(x, y, z) !== AIR) continue;
          this.world.setBlock(x, y, z, blocks[id]);
          placed++;
          break;
        }
      }
    }
    return placed;
  }

  /** Eggs whose time has come (DuiltGame.hatchDue): out comes a dinosaur, tame, and yours. */
  hatchEggs(dt) {
    this.eggClock = (this.eggClock ?? 0) + dt;
    if (this.eggClock < 1 || !this.duilt || !this.mobs) return;
    this.eggClock = 0;
    let hatched = false;
    for (const e of this.duilt.hatchDue()) {
      // Too far off to be loaded: it waits for you to come back.
      if (!this.world.hasChunk(e.x >> 4, e.z >> 4)) { this.duilt.eggs.push(e); continue; }
      // Picked up again since: nothing to hatch.
      if (EGG_TYPE[this.world.getBlock(e.x, e.y, e.z)] !== e.type) continue;
      const spec = MOBS_BY_ID.get(e.type === 'dragon_egg' ? HATCHLINGS[Math.abs(e.x * 7 + e.z * 13) % HATCHLINGS.length] : e.type);
      if (!spec) continue;
      this.world.setBlock(e.x, e.y, e.z, 0);
      this.remeshDirty();
      const m = this.mobs.make(spec, e.x + 0.5, e.y, e.z + 0.5);
      m.owned = true;
      this.mobs.list.push(m);
      this.duilt.mounts.push(m);
      this.duilt.time.hatched += 1;
      hatched = true;
      this.editedAt = Date.now();
      if (spec.flies) { m.follow = true; m.airborne = true; m.y += 2; }
      this.ui.toast({ kind: 'achievement', title: `A ${spec.name.toLowerCase()} hatched`, duration: 6000,
        body: spec.flies ? 'Yours. It flies with you and burns whatever comes for you.' : 'Tame, and yours. Place on it to ride.' });
    }
    if (hatched) this.gamification?.checkAchievements(null);
  }

  tookFromChest({ x, z }) {
    if (!this.world.gen || !this.wanderers) return false;
    // The god's stash: taken, and the way out opens.
    const stash = this.cube?.stash;
    if (stash && x === stash.x && z === stash.z && this.duilt && !this.duilt.cube.stash) {
      this.duilt.cube.stash = true;
      this.ui?.toast({ kind: 'achievement', title: 'The god\'s stash is yours', body: 'The way out will let you go now — get to it alive', duration: 7000 });
      return true;
    }
    const lm = landmarksFor(this.world.gen).find((l) => (l.kind === 'tribe' || l.kind === 'city' || l.kind === 'outpost' || l.kind === 'ruined_city' || l.kind === 'caravan' || l.kind === 'mossfolk')
      && Math.abs(l.x - x) <= l.half + 1 && Math.abs(l.z - z) <= l.half + 1);
    if (!lm) return false;
    // Taken from: Age 11 counts it (a city's treasure, a second people).
    this.duilt?.raid(lm);
    // An abandoned city has nobody left to mind.
    if (lm.kind === 'ruined_city') return false;
    const already = this.wanderers.list.some((p) => p.landmark === lm && p.angry && !p.dead);
    const saw = this.wanderers.anger(lm);
    if (saw && !already) {
      this.ui?.toast(lm.kind === 'outpost'
        ? { kind: 'xp', title: 'The armoury is guarded', body: 'The Kingdom\'s guards saw that — fight, or run' }
        : lm.kind === 'city'
        ? { kind: 'xp', title: 'Thief!', body: 'The guards are after you, and the market\'s shut to you — get out of the city' }
        : lm.kind === 'caravan'
        ? { kind: 'xp', title: 'The caravan sounds the alarm', body: 'Its guards are after you — get out of the camp' }
        : lm.kind === 'mossfolk'
        ? { kind: 'xp', title: 'The mossfolk turn hostile', body: 'They saw you take from the offering chest — leave the village' }
        : { kind: 'xp', title: 'The tree people saw that', body: 'Thief! Arrows from the decks — get out from under the trees' });
    }
    return saw > 0;
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
    // Beaten in a round of the war: it's lost, and they go home with it.
    for (const party of [this.wanderers?.warParty, this.wanderers?.rivalParty]) {
      if (!party) continue;
      party.died = true;
      for (const q of party.band) q.retreat = true;
    }
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
    // Fallen in an attack on the Sky Kingdom: driven back home, whatever
    // painting or camp you'd have woken by.
    const routed = !!this.duilt.skyWar.attack && !this.duilt.sandbox;
    const home = routed ? this.homeSpawn() : this.respawnPoint();
    this.player.teleport(home.x, home.y, home.z);
    this.duilt.health.restore();
    this.sound?.die?.();
    this.ui?.duiltUI?.flashHurt(true);
    const how = { fall: 'You fell too far', lava: 'The lava took you', bandit: 'The bandits beat you', catapult: 'Your own stone came down on you', army: 'The Stone Kingdom\'s army beat you', sky: 'The Sky Kingdom\'s guards beat you' }[cause] ?? 'You died';
    this.ui?.toast({
      kind: 'xp',
      title: `${how} — you woke ${this.duilt.spawn && !routed ? 'by your painting' : 'at home'}`,
      body: left
        ? `What you were carrying is in a chest where you fell, at ${x}, ${z}`
        : 'You had nothing with you to leave behind',
    });
    if (routed) this.skyAttackLost('fell');
    this.dying = false;
    this.tellMoment('first_fall');
  }

  /** The chest you fell by, emptied: it's gone. */
  clearGrave({ x, y, z }) {
    if (!this.duilt || !isChest(this.world.getBlock(x, y, z))) return;
    this.world.setBlock(x, y, z, AIR);
    this.duilt.removeChest(x, y, z);
    this.remeshDirty();
    this.ui?.toast({ kind: 'challenge', title: 'Got everything back', body: 'The chest is gone' });
  }

  /** Place on a painting: that's where you wake after you fall (playtest, P1). */
  /**
   * Sleep in a bed (owner, 15 November; PLAY-8, 22 November): at night, Place
   * on a bed and you lie down for SLEEP_SECONDS (world/sleep.js) while the
   * clock runs on to morning. The world's day count moves on by the hours
   * slept, so saplings and research do too. Not while a war round is on.
   * `aimed` is the bed block hit; either half will do.
   */
  sleep(aimed) {
    const d = this.duilt;
    if (!d || !this.dayCycle || this.sleeping) return false;
    if (daylightAt(this.dayCycle.time).day > 0.35) return void this.ui.toast({ kind: 'xp', title: 'You can only sleep at night' });
    if (d.war?.stage === 'fighting') return void this.ui.toast({ kind: 'xp', title: 'No sleeping through a battle' });
    const part = aimed && bedPart(aimed.block);
    if (!part) return false;
    // The bed's two halves, foot to head along its facing.
    const [dx, dz] = FACING_STEP[part.facing];
    const foot = part.head ? { x: aimed.x - dx, z: aimed.z - dz } : { x: aimed.x, z: aimed.z };
    const centre = { x: foot.x + 0.5 + dx * 0.5, y: aimed.y, z: foot.z + 0.5 + dz * 0.5 };
    // Beside the bed, on whichever long side has room to stand.
    let stand = null;
    const w = this.world;
    for (const side of [1, -1]) {
      const sx = Math.floor(centre.x - dz * side), sz = Math.floor(centre.z + dx * side);
      if (w.isCollidable(sx, aimed.y - 1, sz) && !w.isCollidable(sx, aimed.y, sz) && !w.isCollidable(sx, aimed.y + 1, sz)) { stand = { x: sx + 0.5, y: aimed.y, z: sz + 0.5 }; break; }
    }
    stand ??= this.standingNear(Math.floor(centre.x), aimed.y, Math.floor(centre.z)) ?? { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z };
    const p = this.player;
    this.sleeping = {
      t: 0, start: this.dayCycle.time, target: MORNING, centre, stand, dir: { x: dx, z: dz }, lie: 0,
      view: p.view, viewReach: p.viewReach, hp: d.health?.value ?? null, ...this.sleepOverlay(),
    };
    p.flying = false;
    p.teleport(stand.x, stand.y, stand.z);
    // Looking at the bed from beside it, over your own shoulder: the avatar
    // is drawn lying in it, so third person is the only view that shows it.
    p.view = 'behind';
    p.viewReach = 3.6;
    p.yaw = Math.atan2(-(centre.x - stand.x), -(centre.z - stand.z));
    p.pitch = -0.42;
    p.syncCamera();
    this.sleeping.veil.hidden = false;
    // The HUD steps aside while you sleep (review of PLAY-8): no hotbar,
    // crosshair, aim box or touch controls over the picture of you in bed.
    document.body.classList.add('is-sleeping');
    if (this.hoverBox) this.hoverBox.visible = false;
    this.editedAt = Date.now();
    return true;
  }

  /** The dark veil, the Zzz and the Wake up button, made once and kept. */
  sleepOverlay() {
    if (!this._sleepDom) {
      const root = document.createElement('div');
      root.id = 'sleep-overlay';
      root.hidden = true;
      root.innerHTML = '<div class="sleep-veil"></div><div class="sleep-zs"><span>Z</span><span>Z</span><span>z</span></div><button type="button" class="primary sleep-wake">Wake up</button>';
      document.body.appendChild(root);
      root.querySelector('.sleep-wake').addEventListener('click', () => this.wake());
      this._sleepDom = { veil: root, shade: root.querySelector('.sleep-veil') };
    }
    return this._sleepDom;
  }

  /** Each frame asleep: the clock, the veil, the avatar lying down; morning ends it. */
  tickSleep(dt) {
    const s = this.sleeping, p = this.player;
    s.t += dt;
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const r = sleepAt(s.t, { start: s.start, target: s.target, reduced });
    this.dayCycle.time = r.time;
    s.shade.style.opacity = String(r.dim);
    s.lie = r.lie;
    // Held still: no looking about, no drifting, the camera on the bed.
    p.yaw = Math.atan2(-(s.centre.x - s.stand.x), -(s.centre.z - s.stand.z));
    p.pitch = -0.42;
    p.velocity.set(0, 0, 0);
    p.syncCamera();
    // Hurt in your sleep: you wake.
    const hp = this.duilt?.health?.value;
    if (s.hp != null && hp != null && hp < s.hp - 0.01) return void this.wake();
    if (r.done) this.wake(true);
  }

  /** A sleep cut off by the world closing: put the HUD back, without a toast or a move. */
  endSleep() {
    const s = this.sleeping;
    if (!s) return;
    this.sleeping = null;
    this.player.view = s.view;
    this.player.viewReach = s.viewReach;
    s.shade.style.opacity = '0';
    s.veil.hidden = true;
    document.body.classList.remove('is-sleeping');
  }

  /** Up, beside the bed: at the end of the night, or early (the clock stays where it got to). */
  wake(finished = false) {
    const s = this.sleeping;
    if (!s) return;
    this.sleeping = null;
    const p = this.player;
    p.view = s.view;
    p.viewReach = s.viewReach;
    p.teleport(s.stand.x, s.stand.y, s.stand.z);
    s.shade.style.opacity = '0';
    s.veil.hidden = true;
    document.body.classList.remove('is-sleeping');
    if (finished) this.dayCycle.time = s.target;
    this.duilt.dayTime = this.dayCycle.time;
    this.editedAt = Date.now();
    this.ui.toast(finished
      ? { kind: 'challenge', title: 'Good morning', body: 'You slept the night through.' }
      : { kind: 'xp', title: 'You woke early' });
  }

  setSpawn({ x, y, z }) {
    if (!this.duilt) return;
    this.duilt.spawn = { x, y, z };
    this.ui.toast({ kind: 'challenge', title: 'You\'ll wake here', body: 'When you fall, this is where you come to — by your painting' });
  }

  isSpawnAt({ x, y, z }) {
    const s = this.duilt?.spawn;
    return !!s && s.x === x && s.y === y && s.z === z;
  }

  /**
   * Where you wake after dying: beside the painting you chose, if it still
   * hangs (playtest, P1); otherwise a safe spot near the middle of your land.
   */
  respawnPoint() {
    const s = this.duilt?.spawn;
    if (s) {
      const at = this.world.getBlock(s.x, s.y, s.z);
      if (isPainting(at) || isTent(at)) {
        const near = this.standingNear(s.x, s.y, s.z);
        if (near) return near;
      } else {
        this.duilt.spawn = null; // the painting's gone; so is the promise
      }
    }
    return this.homeSpawn();
  }

  /** A cell to stand in within a few blocks of (x, y, z): solid under it, two clear above. */
  standingNear(x, y, z) {
    const w = this.world;
    for (let r = 0; r <= 3; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          for (let dy = -2; dy <= 1; dy++) {
            const cx = x + dx, cy = y + dy, cz = z + dz;
            const under = w.getBlock(cx, cy - 1, cz);
            if (w.isCollidable(cx, cy - 1, cz) && !isLava(under) && !w.isCollidable(cx, cy, cz) && !w.isCollidable(cx, cy + 1, cz)) {
              return { x: cx + 0.5, y: cy, z: cz + 0.5 };
            }
          }
        }
      }
    }
    return null;
  }

  /** The middle of your land: where you wake with no painting. */
  homeSpawn() {
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

  /** Brings every planted crop up to the stage its time in the ground says. */
  /**
   * Places out in the world, found by walking up to them (playtest, P4):
   * the first time you come within FOUND_REACH of one, it's told and it goes
   * on your map.
   */
  lookForPlaces(dt) {
    this.placeClock = (this.placeClock ?? 0) + dt;
    if (this.placeClock < 1 || !this.duilt || !this.world.gen) return;
    this.placeClock = 0;
    const { x, z } = this.player.position;
    for (const lm of landmarksFor(this.world.gen)) {
      if (Math.hypot(lm.x - x, lm.z - z) > FOUND_REACH + lm.half) continue;
      if (!this.duilt.discover(lm)) continue;
      this.ui?.toast({ kind: 'achievement', title: `You found ${PLACE_NAMES[lm.kind].replace(/^(A|An|The) /, (a) => a.toLowerCase())}`, body: 'It\'s on your map now' });
      const m = momentForPlace(lm.kind);
      if (m) this.tellMoment(m);
      this.bus.emit('duilt:found', { kind: lm.kind });
    }
  }

  /** Where turf never spreads by itself: a claimed building's own dirt. */
  turfSkip() {
    const reg = this.duilt?.structures;
    return reg ? (x, y, z) => !!reg.at(x, y, z) : null;
  }

  growCrops(dt) {
    this.cropClock = (this.cropClock ?? 0) + dt;
    if (this.cropClock < CROP_TICK_SECONDS || !this.duilt) return;
    this.cropClock = 0;
    // A farm's own crops first, out in its soil (batch 3, #13), then everything growing.
    const tended = this.duilt.tendFarms(this.world).length;
    const ripened = this.duilt.crops.grow(this.world).length;
    if (tended || ripened) this.remeshDirty();
    // Turf creeping over bare dirt, a block at a time (duilt/TurfSpread.js).
    if (this.duilt.turf.spread(this.world, this.duilt.days, this.turfSkip()).length) this.remeshDirty();
    const grown = this.duilt.saplings.grow(this.world, this.duilt.days);
    if (grown.length) {
      this.remeshDirty();
      const trees = grown.filter((c) => c.prev === SAPLING).length;
      this.ui?.toast({ kind: 'xp', title: trees > 1 ? `${trees} saplings have grown into trees` : 'A sapling has grown into a tree', body: 'Ten days in the ground' });
    }
    // FRUIT-4: fruit plants in pots, through their looks.
    const sprouted = this.duilt.fruitPlants.grow(this.world, this.duilt.days);
    if (sprouted.length) {
      this.remeshDirty();
      if (sprouted.some((c) => plantOf(c.next)?.segment.endsWith('_ripe') && !plantOf(c.prev)?.segment.endsWith('_ripe'))) this.ui?.toast({ kind: 'xp', title: 'A fruit plant is ripe', body: 'Hit it to pick the fruit' });
    }
    // PLAY-15: Mushy Logs, through their stages.
    const flushed = this.duilt.mushyLogs.grow(this.world, this.duilt.days);
    if (flushed.length) {
      this.remeshDirty();
      if (flushed.some((c) => mushyOf(c.next)?.stage === 2)) this.ui?.toast({ kind: 'xp', title: 'Your Mushy Log is covered in mushrooms', body: 'Break it to pick them' });
    }
  }

  /**
   * Leaves left with no tree (world/leafDecay.js): each goes on its own,
   * somewhere in the next few seconds, so a crown thins out rather than
   * blinking away. Not an edit — nothing to undo, nothing to the bag.
   */
  queueLeafDecay({ x, y, z }) {
    if (this.leafDecayWorld !== this.world) { this.leafDecay = new Map(); this.leafDecayWorld = this.world; }
    const now = performance.now();
    for (const l of orphanLeaves(this.world, x, y, z)) {
      const key = `${l.x},${l.y},${l.z}`;
      if (!this.leafDecay.has(key)) this.leafDecay.set(key, { ...l, queuedAt: now, at: now + LEAF_DECAY_MIN_MS + Math.random() * LEAF_DECAY_SPREAD_MS });
    }
  }

  tickLeafDecay() {
    if (!this.leafDecay?.size) return;
    if (this.leafDecayWorld !== this.world) { this.leafDecay.clear(); return; }
    const now = performance.now();
    let fell = false;
    for (const [key, l] of this.leafDecay) {
      if (l.at > now) continue;
      this.leafDecay.delete(key);
      if (!LEAVES.has(this.world.getBlock(l.x, l.y, l.z))) continue;
      // Something may have caught it since — wood put back near it.
      if (this.woodPlacedAt > l.queuedAt && leafHeld(this.world, l.x, l.y, l.z)) continue;
      this.world.setBlock(l.x, l.y, l.z, AIR);
      fell = true;
    }
    if (fell) this.remeshDirty();
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
    if (Number.isFinite(budgetMs) && typeof Worker !== 'undefined') {
      if (this.terrainWorker?.world !== this.world) {
        this.terrainWorker?.dispose();
        const world = this.world;
        this.terrainWorker = new TerrainWorkerQueue(world, {
          onChunk: chunk => { if (this.world === world) this.remeshQueue.add(chunk); },
        });
      }
      if (this.terrainWorker.available) {
        // Keep pending entries until their transferred chunk actually arrives.
        // A full worker queue is backpressure, not a reason to block this frame.
        this.genQueue = this.genQueue.filter(({cx,cz}) => !this.world.hasChunk(cx,cz));
        for (const {cx,cz} of this.genQueue) if (!this.terrainWorker.request(cx,cz)) break;
        return;
      }
    }
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
  updateFarTerrain(budgetMs) {
    if (!this.farTerrain) return;
    if (!this.world?.endless) { this.farTerrain.setVisible(false); return; }
    this.farTerrain.setVisible(true);
    const { x, z } = this.player.position;
    this.farTerrain.update(this.world.gen, x, z, { world: this.world, budgetMs, initialBudgetMs: budgetMs });
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
    // The caller shares this allowance with generation and distant terrain.
    // A long queue must not silently increase it and stall the same frame.
    const start = performance.now();
    const w = this.world;
    let built = 0;
    // Nearest first: the queue is in the order chunks came to need drawing,
    // and land made earlier for something else (a settlement, a search) was
    // drawn before the land in front of you (reported directly: "The game
    // is taking too long to load").
    const queue = this.remeshQueue.size > 1 && this.player
      ? [...this.remeshQueue].sort((a, b) => this.chunkDistSq(a) - this.chunkDistSq(b))
      : this.remeshQueue;
    for (const chunk of queue) {
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
    this.setAtmosphere(this.graphics.atmosphere !== false);
    // Shadow where blocks meet is baked into the meshes, so it needs them rebuilt.
    const ao = this.graphics.ao !== false;
    if (ao !== this.mesher.ao) {
      this.mesher.ao = ao;
      if (this.world) this.rebuildAllChunks();
    }
    return { needsReload };
  }

  /** The graphics setting for the air: low mist, motes, the Sky Kingdom's cloud. */
  setAtmosphere(on) {
    this.dayCycle.atmosphere = on;
    this.motes.enabled = on;
    this.skyMist.enabled = on;
  }

  /** Motes round you, and the cloud round the Sky Kingdom, by the time of day. */
  updateAir(dt) {
    if (!this.player) return;
    const l = this.dayCycle.light;
    this.motes.update(dt, this.camera.position, l.day, l.dusk, this.renderer.domElement.height);
    this.skyMist.update(this.skyOpen() ? skyAt(this.world.gen) : null, this.camera.position, this.dayCycle.cloudColor);
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
    // CRAFT3D-1: at the carpentry counter the world waits, as behind a panel.
    if (this.closeUp?.active) return 'paused';
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
    const frameStarted = performance.now();
    // Always read the clock, even when nothing will use it: skipping it lets
    // the gap pile up, and the first frame after a pause would move the player
    // by however long they spent reading a menu. The cap covers the same thing
    // for a stalled tab — a single frame should never teleport anyone.
    const frameDelta=this.clock.getDelta();
    if(!document.hidden)this.diagnostics.frame(frameDelta*1000);
    const dt = Math.min(frameDelta, 0.1);
    if(this.peerSession?.ready&&this.player)this.peerSession.updatePosition({...this.player.position,yaw:this.player.yaw,pitch:this.player.pitch});
    if(this.peerAvatar&&this.peerPosition)this.peerAvatar.update(dt,{position:this.peerPosition,yaw:this.peerPosition.yaw,pitch:this.peerPosition.pitch??0},{look:this.controls.avatar,visible:!!this.peerSession?.connected});
    this.syncPhase();
    const playing = this.isPlaying;
    this.syncMobs();

    if (playing) {
      this.quality.tick(dt);
      const wasAt = { x: this.player.position.x, z: this.player.position.z };
      const wasSwimming = this.player.swimming;
      if (this.sleeping) this.player.syncCamera(); else this.player.update(dt);
      this.keepApart();
      this.tickRide(dt);
      this.tickPilot();
      this.duilt?.trains.tick(dt, { endless: this.duilt.inventory.endless });
      this.tickDrive();
      this.cubeTick();
      this.stepSounds(wasAt, wasSwimming);
      if (this.duilt) {
        if(this.peerSession?.role!=='guest')this.duilt.tick(dt, { resting: this.restingAtHome(wasAt), regen: this.selectedItemId === 'dragon_axe' });
        this.feelHurt(dt);
        // The White Ring (Phase 7c): faster on your feet, and a higher jump.
        const white = this.duilt.ringWorn() === 'white';
        this.player.speedScale = this.duilt.hunger.speedFactor * this.duilt.skills.moveSpeed() * (white ? WHITE_RING_SPEED : 1)
          * (this.duilt.boosted('speed') ? COFFEE_SPEED : 1) * (this.duilt.wearing('swift') ? SWIFT_SPEED : 1)
          * (this.riding ? RIDE_SPEED : 1);
        this.dayCycle.nightSight = this.duilt.wearing('night');
        this.ui?.duiltUI?.renderBoosts();
        this.ui?.duiltUI?.renderTraining();
        this.ui?.duiltUI?.renderWar(this.warTracking(), this.duilt.war.round, this.warComing());
        this.ui?.duiltUI?.renderArmy();
        this.player.jumpScale = white ? WHITE_RING_JUMP : 1;
      }
      this.updateHover();
      this.updateCracks();
      this.lights.update(this.world, this.player.position, { enabled: this.graphics.lights !== false, look: this.player.lookDirection(), night: 1 - (this.dayCycle?.light?.day ?? 1) });
      this.flames.update(this.world, this.player.position);
      this.fireBreath.update(this.mobs?.list);
      this.smoke.update(this.world, this.player.position);
      this.grass.update(this.world, this.player.position, performance.now(), { enabled: this.graphics.grass !== false });
      // The wind in the leaves (ChunkMesher's WIND).
      WIND.value = performance.now() / 1000;
      this.mobs.tick(dt, this.player.position, { lure: LURES.has(this.selectedItemId) });
      this.tamePens();
      if (this.world.gen) {
        this.world.gen.sky = this.skyOpen();
        // A Battle world's rival cities are laid only while this is set (world/rivals.js).
        this.world.gen.battle = !!this.duilt?.battle;
        // The chains you've cut stay cut, chunk by chunk as they're made.
        this.world.gen.skyCut = this.duilt && !this.duilt.sandbox ? this.duilt.skyWar.cut : null;
      }
      // Its light, low in the sky that way, from anywhere you can't see the island itself.
      this.skyBeacon.update(this.skyOpen() ? skyAt(this.world.gen) : null, this.player.position, 1 - daylightAt(this.dayCycle.time).day, this.dayCycle.cloudColor);
      this.wanderers.tick(dt, this.player.position);
      this.tickWar();
      this.tickRivals();
      this.tickDefence(dt);
      this.tickArmy(dt);
      this.tickSkyAttack();
      this.tickSinking();
      this.checkSkyGift();
      this.tickDisguise(dt);
      // The border, drawn again where its ground has loaded since.
      this.duilt?.territory.refreshIfStale();
      this.collectFallen();
      this.tickCatapult(dt);
      this.fireflies.tick(dt, this.player.position, 1 - daylightAt(this.dayCycle.time).day, {
        // The war won: the white god's light, across your settlement at night.
        blessed: !!(this.duilt?.war.stage === 'won' && this.duilt.territory.contains(this.player.position.x, this.player.position.z)),
      });
      this.tickGuardian(dt);
      this.runWater(dt);
      this.growCrops(dt);
      this.tickLeafDecay();
      this.lookForPlaces(dt);
      this.hatchEggs(dt);
      this.tickPack(dt);
      this.tickPetDragons();
      // The first time it gets properly dark (config/moments.js).
      if (this.duilt && !this.duilt.moments.includes('first_night') && daylightAt(this.dayCycle.time).day < 0.25) this.tellMoment('first_night');
      this.tickBreaking(performance.now());
      this.tickPlacing(performance.now());
      this.tickBow();
      this.gamification.tick(performance.now());
      if (performance.now() - this.lastAutosave > AUTOSAVE_INTERVAL_MS) this.saveNow();
    }

    if (!playing) this.player.releaseKeys();
    // A pop-up over a drawn bow lets it down.
    if (!playing && this.drawing) this.releaseDraw({ cancel: true });
    // Behind the worlds screen, the title scene keeps itself going.
    if (!playing && this.title) this.tickTitle(dt);

    // These run regardless: the world should finish drawing itself behind the
    // worlds screen rather than streaming in after you arrive.
    this.streamChunks();
    // Under the loading screen nothing needs a smooth frame, so the land is
    // made and drawn several times faster (see ui/loading.js).
    runStreamingWork(this, frameStarted, undefined, BOOT_BUDGET_MS);
    this.updateDeep();
    this.updateChunkVisibility();
    this.updateClouds(dt);
    // The clock only runs while you're playing; a menu is a pause. Except a
    // barracks or Garrison pop-up: its training bar is something you sit and
    // watch fill, so the day goes on behind it — and so does training, and
    // those who finish come out (syncDefence). Nothing
    // else moves: no hunger, no mobs, no one walks.
    const clockWas = this.dayCycle.time;
    const watchingTrainingPost = !playing && ['barracks', 'military'].includes(this.ui?.duiltUI?.building?.type) && this.ui.isPanelOpen?.('panel-building');
    // The showcase holds the hour it was set to, for its pictures.
    if (this.sleeping && playing) this.tickSleep(dt);
    else if ((playing || watchingTrainingPost) && !this.showcase && !this.title) this.dayCycle.advance(dt);
    if (watchingTrainingPost) this.syncDefence();
    // A station's work (the forge, the mills: IMP-15) and the crucible's
    // melting go on while a panel is open over them (owner, 9 November: "The
    // progress bar of the forge only loads if I close it and open it"). The
    // crucible close-up ticks its own pot (CrucibleMachine), so not twice.
    if (!playing && this.duilt && !this.duilt.sandbox && this.ui?.isAnyPanelOpen?.()) {
      this.duilt.stationWork.tick(dt);
      if (!this.closeUp?.active) { this.duilt.crucibles.tick(dt); this.duilt.kilnOvens.tick(dt); this.duilt.dehydrators.tick(dt); this.duilt.cauldrons.tick(dt); }
    }
    if (this.duilt) {
      this.duilt.dayTime = this.dayCycle.time;
      // The world's own count of days, for saplings to grow by.
      this.duilt.days += (this.dayCycle.time - clockWas + 1) % 1;
      // Research at the university finishes when its days are up.
      this.duilt.finishResearch();
      this.duilt.tickMarches();  // PLAY-12
    }
    this.dayCycle.apply(this.camera, this.horizon);
    this.updateAir(dt);
    this.updateMinimap();
    this.mobView.update(this.mobs?.list ?? []);
    if (this.player) this.updateYou(dt, playing);
    // What's heard here: the place and the hour, archers loosing, the music.
    if (this.world) hear(this, dt, playing);
    const strangers = this.wanderers?.list ?? [];
    // At most PEOPLE_MAX drawn: over that, anyone fighting you first, then the
    // nearest (IMP-22: a kingdom's guards had taken every place, and a round's
    // attackers, added last, were never drawn).
    this.wanderView.update(strangersToDraw([
      ...strangers.filter((p) => !WANDERERS[p.kind].siege && !WANDERERS[p.kind].beast),
      ...this.tradersFacingYou(),
    ], this.player?.position ?? { x: 0, z: 0 }, PEOPLE_MAX, this._strangersDrawn ??= []));
    // Villagers are redrawn while the game waits too (a panel open), as your
    // soldiers are: whoever was mid-stride finishes the step and stands
    // straight (owner, 4 November: "the villagers stop with the legs wrong").
    this.settlerView.update(this.withShowcase('settlers', this.duilt?.settlers.people ?? []));
    this.buildSites.update(this.duilt && !this.duilt.sandbox ? this.duilt.jobs.builds : []);
    const ours = this.duilt?.defenders;
    this.defenderView.update(this.withShowcase('defenders', ours?.people ?? []));
    this.warriorView.update(this.withShowcase('warriors', this.duilt?.army.field ?? []));
    this.showcaseView.update(this.showcase, dt);
    this.armyView.update(strangers, [...(this.wanderers?.arrows ?? []), ...(ours?.arrows ?? [])], dt);
    this.engineView.update(ours?.engines ?? []);
    this.projectileView.update(this.projectiles?.list ?? []);
    this.arrowView.update(this.arrows?.list ?? []);
    this.fireflyView.update(this.fireflies);
    const gen = this.world?.gen;
    this.futureView.update(gen && this.player?.position, performance.now() / 1000, gen?.biomes.centreX, gen?.biomes.centreZ);
    this.guardianView.update(this.duilt?.guardian, dt);
    this.closeUp?.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Footsteps on whatever is underfoot, a splash on going into water, and
   * a landing — a jump comes down as a heavy step, a fall as a thud.
   */
  stepSounds(wasAt, wasSwimming) {
    const p = this.player;
    if (p.swimming && !wasSwimming) this.sound.splash();
    const underfoot = () => soundOf(BLOCKS_BY_ID.get(this.world.getBlock(Math.floor(p.position.x), Math.floor(p.position.y - 0.05), Math.floor(p.position.z))));
    if (!p.grounded && !p.flying && !p.swimming) this.fallSpeed = Math.min(this.fallSpeed ?? 0, p.velocity.y);
    else if (p.grounded && this.fallSpeed < -4) this.sound.land(underfoot(), -this.fallSpeed);
    if (p.grounded || p.flying || p.swimming) this.fallSpeed = 0;
    if (p.flying || !p.grounded || p.swimming) return;
    const moved = Math.hypot(p.position.x - wasAt.x, p.position.z - wasAt.z);
    if (moved < 1e-4) return;
    this.sound.walk(moved, underfoot(), { sprint: p.running });
  }

  applyControls(...args) { return GameInput.applyControls.apply(this, args); }

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
        onBite: (m, damage) => this.dinoBites(m, damage),
        onBreath: (m, damage) => this.dragonFire(m, damage),
        onPetBreath: (m, foe, damage) => this.petDragonFire(m, foe, damage),
      });
      // IMP-45: each dragon nest keeps one dragon: the first an Elder Dragon, the rest one of the three smaller ones.
      const smaller = ['fire_drake', 'frost_wyvern', 'storm_dragon'];
      this.mobs.nests = landmarksFor(this.world.gen).filter((l) => l.kind === 'dragon_nest').map((l, i) => ({
        key: `dragon_nest@${l.x},${l.z}`, x: l.x, y: l.y, z: l.z,
        type: i === 0 ? 'elder_dragon' : smaller[Math.abs(l.x * 31 + l.z * 17) % smaller.length],
      }));
      this.mobsHerdOf = null;
    }
    if (this.fireflies?.world !== this.world) this.fireflies = new Fireflies({ world: this.world });
    if (this.arrows?.world !== this.world) {
      this.arrows = new Arrows({
        world: this.world,
        hitTest: (from, dir, length) => this.arrowTarget(from, dir, length),
        onHit: (a, hit) => this.arrowHit(a, hit),
      });
    }
    if (this.projectiles?.world !== this.world) {
      this.projectiles = new Projectiles({ world: this.world, onImpact: (s, landed) => this.stoneLands(landed, s) });
      this.manning = null;
      this.projectileView.setAim(null);
    }
    if (this.wanderers?.world !== this.world) {
      this.wanderers = new Wanderers({
        world: this.world,
        // A messenger comes to your settlement, so only where you have one.
        home: () => (this.duilt && !this.duilt.sandbox ? { x: this.world.centreX, z: this.world.centreZ } : null),
        // Now and then the story instead of a place: what the roads are saying (config/tales.js).
        onNews: (p, line) => this.ui.toast({ kind: 'challenge', title: `${p.name}, a messenger`, body: this.messengerTale() ?? line }),
        // Bandits (Phase 6b): hostile from Age 2, never in Creative.
        hostile: () => !!(this.duilt && !this.duilt.sandbox && this.duilt.age >= 3),
        // The Stone Kingdom's guards (Phase 7e): the White Ring is their enemy.
        kingdomHostile: () => !!(this.duilt && !this.duilt.sandbox && this.duilt.ring === 'white'),
        night: () => daylightAt(this.dayCycle.time).day < 0.3,
        stores: () => (this.duilt && !this.duilt.sandbox ? this.duilt.structures.stores() : [])
          .filter(({ store }) => store.heldIds().length)
          .map(({ structure }) => ({ structure, region: structure.region })),
        onAttack: (p, hits, blow) => this.banditHits(p, hits, blow),
        onSteal: (p, structure) => this.banditSteals(p, structure),
        onRaid: (dir, raiders) => this.ui.toast({
          kind: 'challenge',
          title: 'Bandits on the road',
          body: `${raiders.length} of them, coming in from the ${dir}. Guard your storehouses.`,
        }),
        // The war's siege engines (config/war.js): your buildings are what
        // they're after, and what's in the way inside your land they break.
        buildings: () => (this.duilt && !this.duilt.sandbox ? this.duilt.structures.list() : []),
        inLand: (x, z) => !!(this.duilt && !this.duilt.sandbox && this.duilt.territory.contains(x, z)),
        onBatter: (p, cells) => this.siegeBreak(cells.map((c) => ({ ...c, id: this.world.getBlock(c.x, c.y, c.z) }))),
        onThrow: (p, at) => this.enemyThrows(p, at),
        // Your soldiers stand between them and you.
        foes: () => [...(this.duilt?.defenders.soldiers ?? []), ...(this.duilt?.army.field ?? [])],
        villagers: () => (this.duilt && !this.duilt.sandbox ? this.duilt.settlers.people : []),
        onFoe: (p, soldier, hits) => this.soldierHit(p, soldier, hits),
        // The Sky Kingdom: there while it stands, on the dark path (and in
        // Creative, to look at); its people fight the Black Ring.
        sky: () => this.skyNear(),
        // In the Sky armour they take you for one of their own — until they see through it.
        skyHostile: () => !!(this.duilt && !this.duilt.sandbox && this.duilt.ring === 'black' && !this.duilt.skyFallen && !this.unseen()),
        onSkyKing: () => this.skyKingDown(),
        onRoyal: () => this.ui?.toast({ kind: 'challenge', title: 'A royal guard runs to the King\'s side', body: 'There are always two beside him while he lives — be quick, or bring your army.' }),
      });
    }
    this.syncRivals();
    // Your penned animals come back with the save, and join the wild ones.
    if (this.duilt && this.mobsHerdOf !== this.duilt) {
      this.mobs.adopt(this.duilt.herd);
      // And your horses, carts and all.
      this.mobs.adopt(this.duilt.mounts);
      this.stopRide(true);
      // A machine you were flying belonged to the world just left, and so did a train.
      if (this.piloting && this.player) { this.player.seatHeight = 0; this.player.viewReach = 0; }
      this.piloting = null;
      this.driving = null;
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

  /**
   * Cracks on the block being dug, as far along as the dig is (CrackView).
   * Only while you are still at it: a dig left alone keeps its progress, but
   * its cracks fade out of sight after CRACK_LINGER_MS.
   */
  updateCracks() {
    const d = this.digTarget;
    const now = performance.now();
    const live = d?.ms > 0 && now - d.lastHitAt < CRACK_LINGER_MS && this.world.getBlock(d.x, d.y, d.z) !== AIR;
    this.crackView.update(live ? d : null, live ? (now - d.startedAt) / d.ms : 0);
  }

  updateHover() {
    const hit = this.raycast();
    this.hoverHit = hit;
    this.hintUses = false; // set again below, if the hint names something Place uses
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

    if (this.selectedItemId === 'storage_remote' && !this.armed) {
      this.hoverBox.visible = false;
      this.hintUses = true;
      this.ui?.setAimedSwing('Open');
      this.ui?.setBuildingHint(`Storage Remote — ${this.ui?.isTouch ? 'tap' : 'right click'} to open stores`, { manage: false });
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
      this.ui?.setPersonHint(person.name, `${job ? `works the ${job}` : 'looking for work'} · ${this.ui?.isTouch ? 'tap' : 'right click'} to talk`);
      return;
    }
    // One of your army.
    const warrior = this.duilt?.army.active
      ? this.warriorView.pick(this.duilt.army.field, this.player.eyePosition(), this.player.lookDirection())
      : null;
    if (warrior) {
      const army = this.duilt.army;
      this.ui?.setPersonHint(warrior.name, warrior.foe ? `fighting ${warrior.foe.name}` : `one of ${army.total} — ${ARMY_WORDS[army.mode]}`);
      return;
    }
    // One of your soldiers or tower archers.
    const mine = this.duilt?.defenders
      ? this.defenderView.pick(this.duilt.defenders.people, this.player.eyePosition(), this.player.lookDirection())
      : null;
    if (mine) {
      this.ui?.setPersonHint(mine.name, mine.kind === 'archer'
        ? 'keeping watch from the tower'
        : mine.foe ? `fighting ${mine.foe.name}` : `on guard at the barracks — ${Math.ceil(mine.hp)} of ${SOLDIER.hp} strength`);
      return;
    }
    // Somebody from out in the world — the hermit, a bandit, a traveller.
    const stranger = this.wanderers
      ? this.wanderView.pick(this.wanderers.list, this.player.eyePosition(), this.player.lookDirection())
      : null;
    if (stranger) {
      const spec = WANDERERS[stranger.kind];
      const fights = spec.hp && !spec.flees && this.wanderers.hostileOf(stranger);
      this.ui?.setPersonHint(stranger.name, spec.flees && stranger.fear > 0 ? `${spec.noun} — running from you`
        : stranger.kind === 'merchant' && stranger.trader && !stranger.angry ? `${(TRADERS_BY_ID.get(stranger.trader)?.trade ?? 'goods').toLowerCase()} for coins — ${this.ui?.isTouch ? 'tap' : 'right click'} to trade`
        : !fights ? `${spec.about}${TALKERS.has(stranger.kind) ? ` · ${this.ui?.isTouch ? 'tap' : 'right click'} to talk` : ''}`
        : stranger.hp <= spec.fleeBelow ? `${spec.noun} — running for it`
          : stranger.hp < spec.hp ? `${spec.noun} — hurt, keep at it`
            : stranger.war ? `${spec.about} — round ${stranger.round} of ${LAST_ROUND}, hit to fight`
              : stranger.raider ? 'a bandit, raiding — hit to fight' : spec.aboutHostile);
      return;
    }
    // A goblin trader in one of your markets.
    const trader = !this.armed && this.traderTarget(hit);
    if (trader) {
      this.hoverBox.visible = false;
      const spec = TRADERS_BY_ID.get(trader.trader);
      this.ui?.setPersonHint(`${trader.name} the trader`, `${spec?.trade.toLowerCase() ?? 'goods'} for coins — ${this.ui?.isTouch ? 'tap' : 'right click'} to trade`);
      return;
    }
    // Your guardian.
    const guardian = !this.armed && this.guardianTarget(hit);
    if (guardian) {
      this.hoverBox.visible = false;
      const how = this.ui?.isTouch ? 'tap Place' : 'right click';
      this.ui?.setPersonHint(guardian.name, `${guardian.spec.about} — ${MODE_WORDS[guardian.mode]} · ${how} to change`);
      return;
    }
    // A swarm of fireflies, at night.
    if (!this.armed && this.fireflyTarget(hit)) {
      this.hoverBox.visible = false;
      this.ui?.setPersonHint('Fireflies', 'hit to catch a few');
      return;
    }
    // Same for an animal — named before you swing, and no block outline
    // behind it saying the swing will land on the ground.
    if (!this.armed && this.machineTarget(hit)) {
      this.hoverBox.visible = false;
      const m = this.machineTarget(hit);
      this.ui?.setPersonHint(m.kind === 'helix' ? 'Helix' : 'Plainer', m.kind === 'helix' ? 'Place to fly · hit to pick up' : 'hit to pick up, then wear it');
      return;
    }
    const aboard = this.armed ? null : this.trainTarget(hit);
    if (aboard) {
      const t = aboard.train, coal = this.duilt.inventory.endless ? 'coal without end' : `${t.coal} coal`;
      this.hoverBox.visible = false;
      const load = aboard.part.kind === 'car' ? t.loads[aboard.part.index - 1] : null;
      this.ui?.setPersonHint(aboard.part.kind === 'engine' ? 'Steam engine' : 'Rail car',
        this.selectedItemId === 'coal' ? `Place to fire it · ${coal} in the bunker`
          : this.selectedItemId === 'rail_car' ? `Place to couple it on · ${t.cars} of 5 cars`
            : load ? `Place to open it · ${load.slots.filter(Boolean).length} of ${load.size} slots used${this.ridersText(t, aboard.part.index - 1)} · hit to take the last car off`
              : `Place to drive · ${coal} · ${t.cars} car${t.cars === 1 ? '' : 's'} · hit to take ${t.cars ? 'the last car' : 'it'} off`);
      return;
    }
    const mob = this.armed ? null : this.mobTarget(hit);
    if (mob) {
      const spec = MOBS_BY_ID.get(mob.type);
      this.hoverBox.visible = false;
      this.ui?.setPersonHint(spec.name, mob.owned ? (mob.cart ? 'yours — Place to open the cart' : 'yours — Place to ride')
        : mob.hp < spec.hp ? 'hurt — keep at it'
        : spec.rideable && this.duilt ? (spec.tameWith?.includes('raw_meat') ? 'hold raw meat, Place to tame' : 'hold fruit or carrots, Place to tame')
        : mob.penId ? 'yours — kept in the pen'
          : spec.farm && this.duilt ? 'hold vegetables or seeds to lead it' : 'hit to hunt');
      return;
    }

    const onBuilding = hit && this.duilt
      ? this.duilt.structures.at(hit.x, hit.y, hit.z)
      : null;
    const waiting = hit && !onBuilding && this.duilt ? this.duilt.waitingAt(hit.x, hit.y, hit.z) : null;
    const gate = hit && isGate(hit.block);
    const door = hit && doorPart(hit.block);
    const chest = hit && isChest(hit.block);
    const catapult = hit && isCatapult(hit.block);
    const trapdoor = hit && isTrapdoor(hit.block);
    const painting = hit && isPainting(hit.block);
    const mill = hit && stationOf(hit.block);
    let lift = hit && hit.block === SKY_LIFT
      ? (this.world.gen && liftAt(this.world.gen, hit.x, hit.y, hit.z)) || this.chainLift(hit.x, hit.y, hit.z) || 'nowhere' : null;
    const sw = this.duilt && !this.duilt.sandbox ? this.duilt.skyWar : null;
    if (lift && lift !== 'nowhere' && sw?.chains[skyFor(this.world.gen).towers.indexOf(lift.tower)]) lift = 'cut';
    // An anchor tower's chain, on the dark path: Break cuts it.
    const chainLink = hit && hit.block === CHAIN && sw && this.duilt.ring === 'black' && !this.duilt.skyFallen && chainAt(this.world.gen, hit.x, hit.y, hit.z) >= 0;
    const sapling = hit && hit.block === SAPLING && this.duilt ? this.saplingHint(hit)
      : hit && this.duilt && mushyOf(hit.block) ? this.mushyHint(hit) // PLAY-15
      : hit && this.duilt && plantOf(hit.block) ? this.fruitPlantHint(hit) : null; // FRUIT-4
    // Says the button you'd actually press: the Open/Close thumb button, or
    // right click at a desk.
    const swing = hit && (gate || door || chest || catapult || trapdoor || painting || mill || (lift && lift !== 'nowhere' && lift !== 'cut')
      || hit.block === TIME_MACHINE || hit.block === ARCHIVE || hit.block === WAR_STANDARD || hit.block === WAY_OUT) && swingLabel(hit.block);
    const how = swing && (this.ui?.isTouch ? `tap ${swing}` : `right click to ${swing.toLowerCase()}`);
    // What tapping the hint itself does: the same thing, for a chest, a door
    // or a gate — not the claim panel (reported: tapping "Chest — tap Open"
    // on a phone opened "What is this?").
    this.hintUses = (!!swing || !!lift) && !onBuilding;
    this.ui?.setBuildingHint(gate
      ? `Gate · ${isOpenGate(hit.block) ? 'open' : 'shut'} — ${how}`
      : door
        ? `Door · ${door.open ? 'open' : 'shut'} — ${how}`
      : chest
        ? `${this.duilt?.chestAt(hit.x, hit.y, hit.z, { create: false })?.grave ? 'What you were carrying' : 'Chest'} — ${how}`
      : catapult
        ? `Catapult — ${how}`
      : trapdoor
        ? `Trapdoor · ${isOpenTrapdoor(hit.block) ? 'open' : 'shut'} — ${how}`
      : lift
        ? (lift === 'nowhere' ? 'Sky lift · hang chain from it to another lift' : lift === 'cut' ? 'Sky lift · its chain is cut, it goes nowhere now'
          : `Sky lift — ${how} ${lift.tower ? (lift.up ? 'up to the Sky Kingdom' : 'down to the ground') : (lift.up ? 'up the chain' : 'down the chain')}`)
      : chainLink
        ? `Anchor chain — break it to cut it (${sw.chainsCut} of ${CHAINS} cut)`
      : mill
        ? `${BLOCKS_BY_ID.get(hit.block).name} — ${how}`
      : painting
        ? (this.isSpawnAt(hit) ? 'Painting · you wake here after a fall' : `Painting — ${how} to wake here after a fall`)
      : sapling && !onBuilding
        ? sapling
      : onBuilding
        ? (STRUCTURES_BY_ID.get(onBuilding.type)?.name ?? 'Building')
          + (onBuilding.locked === false ? ' · unlocked' : '')
      : waiting
        ? `${STRUCTURES_BY_ID.get(waiting.type)?.name ?? 'Building'} · not working yet — ${waiting.reason}`
        : null, { manage: waiting ? 'see why' : ((!swing && !sapling && !lift) || !!onBuilding) });
    // The single block under the crosshair, except while a roof is queued —
    // there the whole building is highlighted and one more box on top of it is
    // just noise.
    if (hit && !this.pendingRoof && !this.pendingClear && !this.sleeping) {
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
      this.updateTemplatePreview(!!hit);
      this.ui.setToolReadout({ template: this.pendingTemplate.name, onBuild: !!hit, facing: `${this.templateRotation * 90}\u00b0` });
    } else {
      this.updateRoofPreview(null);
      this.updateTemplatePreview(null);
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
