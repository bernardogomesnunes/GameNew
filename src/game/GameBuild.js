// Building: breaking and placing blocks (held and tapped), what the crosshair
// is aimed at, saved builds and roofs and clears put down where you point, and
// the one place blocks change (applyChanges). Moved out of Game.js (TECH-10);
// every function runs with `this` set to the Game, which delegates to it.
import { castVoxelRay } from '../interaction/VoxelRaycast.js';
import { buildTemplatePlacement, rotateTemplate, captureBlocks } from '../tools/Templates.js';
import { roofPlan, roofBlocks, roofPeak, roofPick, roofTypeFor, roofUnder } from '../tools/RoofTool.js';
import { pickBuild } from '../tools/PointerPick.js';
import { facingLabel } from '../config/roofs.js';
import { clearPlan, clearCells, cellBounds } from '../tools/ClearTool.js';
import { HATCH_DAYS } from '../duilt/DuiltGame.js';
import { soundOf } from '../audio/Sound.js';
import { STRUCTURES_BY_ID } from '../config/structures.js';
import { AIR, WATER, BLOCKS_BY_ID, logOnFace, materialOf, isFlowing, turns, turned, doorPart, doorBlock, mirrored, isChest, isCatapult, isFluid, trapdoorOnFace, slabOnFace, slabMerge, panelOnFace, stationOf, pairPart, pairOther, isPainting, CHISELLED, STORAGE_CONTROLLER, STORAGE_INTERFACE } from '../config/blocks.js';
import { SAPLING, SAPLING_GROUND } from '../duilt/Saplings.js';
import { mushyOf } from '../duilt/MushyLogs.js';
import { LOGS } from '../world/leafDecay.js';
import { toolEffectiveness, itemName, ITEMS_BY_ID, isTool, BARE_HANDS, ITEM_FOR_BLOCK } from '../config/items.js';
import { cropOf } from '../config/crops.js';
import { inPast } from '../world/past.js';
// Game.js imports this file and this file imports Game.js: REACH, EGG_TYPE and
// swings are only read inside functions, after both modules have loaded.
import { REACH, EGG_TYPE, swings } from '../Game.js';

/**
 * How far a tool can point, as opposed to how far you can reach.
 *
 * Far enough to stand back and see a whole house, which is the distance you
 * actually want to be at when deciding what its roof should look like.
 */
const TOOL_REACH = 28;

/** Grass and dirt: an edit to either may let turf spread (duilt/TurfSpread.js). */
const TURFY = new Set([1, 2]);

// Holding down to keep breaking, and the same for placing. The first pause is
// longer than the rest so a normal click stays a single block — hold past it
// and it becomes a stream.
const HOLD_BREAK_DELAY_MS = 320;
const HOLD_BREAK_INTERVAL_MS = 170;

const FARMLAND = 21;

const HOLD_PLACE_DELAY_MS = 320;
const HOLD_PLACE_INTERVAL_MS = 170;

// How long a block takes to actually come free — see breakDelayFor. A tool
// with nothing to say about this material sits at NORMAL_BREAK_MS; one suited
// to it knocks it down near enough to instant, a wrong one up to
// SLOW_BREAK_MS. Only applies in Duilt — Creative has no bag to fill and no
// reason to make you wait for anything.
//
// Played on: "Breaking stuff generally is too fast, but with tools it's even
// faster. Reduce the speed and make sure it scales well for better tier
// tools. I'm expecting the best pickaxe to have the speed of the stone axe."
// So every block takes its time now, a tool suited to it only cuts that
// time — by how good the tool is (TOOL_TIER_SPEED) — and nothing is instant.
//
// Bare hands — nothing held, an empty slot, or a block or anything else that
// isn't a tool — by what the block is made of: soft things a little, wood
// more, stone most (still breakable — just the slow way).
const BARE_HAND_MS = { plant: 500, dirt: 1000, wood: 1500, stone: 2200 };
const NORMAL_BREAK_MS = 1000;
/** A tool with nothing to say about a material works at this share of bare hands' time; a wrong one at this. */
const TOOL_NORMAL = 0.85, TOOL_SLOW = 1.0;
/** A tool suited to the material, by its tier: stone takes 45% of bare hands' time, the best 12%. */
const TOOL_TIER_SPEED = { stone: 0.45, iron: 0.32, gold: 0.22, sky: 0.12, dark: 0.12 };

/**
 * The rest after a block comes free before the next one starts, while held.
 * Played on: "I'd like to have a bigger pause between breaking each block if
 * I'm bare hands or not with the right tool for the block."
 */
const BREAK_REST_MS = { right: 140, other: 450 };

/**
 * Starts or stops breaking on repeat.
 *
 * Only plain breaking repeats. With something queued the same button puts it
 * down, and holding it should not stamp forty copies.
 */
export function setBreaking(on, { once = false } = {}) {
  if (!on) this.holdSpent = false;
  const want = on && !this.armed && !this.moving;
  if (want) this.breakOnce = once;
  if (want === this.breaking) return;
  this.breaking = want;
  if (want) {
    this.breakHeldSince = performance.now();
    this.lastBreakAt = this.breakHeldSince;
  }
}

/** One frame of a held break. Re-aims every time, so it eats what you point at. */
export function tickBreaking(now) {
  if (!this.breaking || this.holdSpent) return;
  if (now < (this.breakRestUntil ?? 0)) return;
  if (now - this.breakHeldSince < HOLD_BREAK_DELAY_MS) return;
  if (now - this.lastBreakAt < HOLD_BREAK_INTERVAL_MS) return;
  this.lastBreakAt = now;
  this.breakBlock();
}

/** Starts or stops placing on repeat — the same idea as setBreaking, for Place. */
export function setPlacing(on) {
  const want = on && !this.armed && !this.moving;
  if (this.selectedItemId === 'storage_remote') {
    this.placing = false;
    return;
  }
  if (want === this.placing) return;
  this.placing = want;
  if (want) {
    this.placeHeldSince = performance.now();
    this.lastPlaceAt = this.placeHeldSince;
  }
}

/** One frame of a held place. Re-aims every time, so it follows where you point. */
export function tickPlacing(now) {
  if (!this.placing) return;
  if (now - this.placeHeldSince < HOLD_PLACE_DELAY_MS) return;
  if (now - this.lastPlaceAt < HOLD_PLACE_INTERVAL_MS) return;
  this.lastPlaceAt = now;
  this.placeBlock();
}

/** Whether a tool is queued and waiting to be used where you are pointing. */
export function armed() {
  return !!(this.pendingRoof || this.pendingTemplate || this.pendingClear || this.pendingClaim || this.pendingClaimColumn);
}

/** Place with the wand: a copy of the picked block, for a coin, in your own land. */
export function wandPlace() {
  const d = this.duilt;
  if (!this.wandBlock) return void this.ui?.toast({ kind: 'xp', title: 'Nothing picked', body: 'Break with the wand on a block to pick it' });
  const hit = this.raycast();
  if (!hit) return;
  const t = { x: hit.placeX, y: hit.placeY, z: hit.placeZ };
  if (!this.world.inBounds(t.x, t.y, t.z) || this.blockOverlapsPlayerAABB(t)) return;
  const prev = this.world.getBlock(t.x, t.y, t.z);
  if (prev !== AIR && !isFluid(prev)) return;
  const paying = d && !d.sandbox;
  if (paying && !d.inventory.has('coin', 1)) return void this.ui?.toast({ kind: 'xp', title: 'No coins', body: 'Each copy costs a coin' });
  if (this.applyChanges([{ ...t, prev, next: this.placedBlock(this.wandBlock) }], { chargeResources: false }) && paying) d.inventory.remove('coin', 1);
}

/** Captures the build you are pointing at and stores it by name. */
export function saveTemplate(name) {
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

/**
 * The queued saved build, drawn where it would land and the way it's
 * turned — pass null to put the preview away. It follows the crosshair
 * the way stampTemplate anchors it.
 */
export function updateTemplatePreview(onBuild) {
  if (onBuild == null || !this.pendingTemplate) {
    if (this.templateGhostKey !== null) { this.templateGhost.hide(); this.templateGhostKey = null; }
    return;
  }
  const t = this.pendingTemplate, size = t.size;
  const key = `${t.id ?? t.name}:${this.templateRotation}`;
  if (key !== this.templateGhostKey) {
    const oriented = rotateTemplate(t, this.templateRotation);
    const top = Math.max(0, ...oriented.blocks.map((b) => b.dy));
    this.templateGhost.show(oriented.blocks, { x: size - 1, y: top, z: size - 1 });
    this.templateGhostKey = key;
  }
  this.templateGhost.moveTo(this.stampAnchor({ x: size - 1, y: 0, z: size - 1 }));
  this.templateGhost.setValid(!!onBuild);
}

/** Stamps the queued template where you are pointing, charged and undoable as one action. */
export function stampTemplate() {
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
export function clearPending({ quiet = false } = {}) {
  const had = this.armed && !quiet;
  this.pendingTemplate = null;
  this.pendingRoof = null;
  this.pendingClear = null;
  this.pendingClaim = null;
  this.pendingClaimColumn = null;
  this.roofTurn = 0;
  this.roofGhost.hide();
  this.roofKey = null;
  this.templateGhost.hide();
  this.templateGhostKey = null;
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
export function buildUnderCrosshair() {
  const hit = this.toolAim();
  if (!hit) return null;
  const key = `${hit.x},${hit.y},${hit.z}`;
  if (key !== this.pickKey) {
    this.pickKey = key;
    this.pick = pickBuild(this.world, hit);
  }
  return this.pick;
}

/** Turns the queued saved build a quarter-turn — the preview turns with it. */
export function turnTemplate() {
  if (!this.pendingTemplate) return 0;
  this.templateRotation = (this.templateRotation + 1) % 4;
  this.ui.toast({ kind: 'xp', title: `Turned ${this.templateRotation * 90}\u00b0` });
  this.sound?.click?.();
  return this.templateRotation;
}

/** Next orientation of the queued roof. A hip roof has only one, and says so. */
export function turnRoof() {
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
export function clearTarget() {
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
export function runClear() {
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
export function updateClearPreview(cells) {
  if (!cells?.length) return this.selection.hide();
  this.selection.update(cellBounds(cells), cells, this.world, { force: this.selectionDirty });
  this.selectionDirty = false;
}

/** The shape of the building the crosshair is on. Null when you are aiming at scenery. */
export function roofTarget() {
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
export function roofRelay(pick) {
  const last = this.lastRoof;
  if (!last || !pick) return null;
  if (last.base !== pick.y) return null;   // the old roof is now the top course
  for (const c of last.cells) {
    if (this.world.getBlock(c.x, c.y, c.z) !== c.type) return null;
  }
  return last;
}

/** The height the eaves land on, relay included, so the preview matches. */
export function roofEave(pick) {
  return this.roofRelay(pick)?.base ?? (pick ? pick.y + 1 : 0);
}

/**
 * Pitches the queued roof over the building you are pointing at, out of the
 * block you are holding, as one undoable action paid for in one go.
 */
export function stampRoof() {
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
    .map((b) => ({ x: b.x, y: base + b.dy, z: b.z, type: roofTypeFor(type, b, roofUnder(this.world, b.x, base, b.z)) }));
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
export function updateRoofPreview(pick) {
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
    dx: b.x - pick.bounds.minX, dy: b.dy, dz: b.z - pick.bounds.minZ, type: roofTypeFor(this.selectedBlockId, b, roofUnder(this.world, b.x, base, b.z)),
  }));
  this.roofGhost.show(blocks, {
    x: pick.bounds.maxX - pick.bounds.minX,
    y: roofPeak(cells),
    z: pick.bounds.maxZ - pick.bounds.minZ,
  });
  this.roofGhost.moveTo({ x: pick.bounds.minX, y: base, z: pick.bounds.minZ });
}

/**
 * Where a stamped building goes: the ground you are looking at.
 *
 * This used to prefer a selector box when one was up, which meant the same
 * button put a building in two different places depending on a mode you may
 * have forgotten was on. Aiming is the normal way to put something down, and
 * now it is the only way.
 */
export function stampAnchor(extent) {
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
 * Slides a stamped building away from you until you are out of its
 * outline. Owner, 8 and 9 November: placing a village in Age 9 kept
 * failing. The village is 26 blocks wide and centred where you aim, so
 * aiming at ground under 10 blocks away put you inside it, and a block
 * may not be built where you stand. It moves along the way you face, so
 * it still lands in front of you.
 */
export function clearOfPlayer(anchor, extent) {
  if (!extent) return anchor;
  const p = this.player.position, gap = 1;
  const inside = (a) => p.x > a.x - gap && p.x < a.x + extent.x + 1 + gap && p.z > a.z - gap && p.z < a.z + extent.z + 1 + gap;
  if (!inside(anchor)) return anchor;
  const { x: fx, z: fz } = this.player.lookDirection();
  const out = { ...anchor };
  if (Math.abs(fx) >= Math.abs(fz)) out.x = fx > 0 ? Math.ceil(p.x + gap) : Math.floor(p.x - gap) - extent.x - 1;
  else out.z = fz > 0 ? Math.ceil(p.z + gap) : Math.floor(p.z - gap) - extent.z - 1;
  out.y = this.world.surfaceHeight(out.x, out.z);
  return out;
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
export function fitInsideLand(anchor, extent) {
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

export function raycast(reach = REACH) {
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
export function toolAim() {
  return this.hoverHit ?? this.raycast(TOOL_REACH);
}

/** Block coordinate a given distance along the view direction. */
export function pointInFront(distance) {
  const origin = this.player.eyePosition();
  const dir = this.player.lookDirection();
  return {
    x: Math.floor(origin.x + dir.x * distance),
    y: Math.max(0, Math.floor(origin.y + dir.y * distance)),
    z: Math.floor(origin.z + dir.z * distance),
  };
}

/** Whether a block can be held at all: it unlocks with a level or an achievement. */
export function blockAvailability(id) {
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

export function computeTargets(x, y, z) {
  if (this.symmetryTool.mode === 'off') return [{ x, y, z }];
  return this.symmetryTool.reflect(x, y, z);
}

/** Place compost on a growing crop to advance it one stage. */
/**
 * IMP-10 step 4: Break with the chisel held turns the block you point at
 * into its decorative form (CHISELLED): stone to stone brick, brick to a
 * pillar. The usual land, lock and peer rules apply (applyChanges); nothing
 * is spent or gathered.
 */
export function chiselBlock() {
  const hit = this.raycast();
  if (this.hitBandit(hit) || this.hitMob(hit)) return;
  if (!hit) return;
  const prev = this.world.getBlock(hit.x, hit.y, hit.z);
  const next = CHISELLED.get(prev);
  if (!next) {
    this.ui.toast({ kind: 'xp', title: 'The chisel does not shape that', body: 'It carves stone, cobblestone, sandstone, marble and dark stone into bricks and pillars' });
    return;
  }
  const done = this.applyChanges([{ x: hit.x, y: hit.y, z: hit.z, prev, next }], { chargeResources: false, gather: false });
  if (done) this.sound?.dig(soundOf(BLOCKS_BY_ID.get(prev)));
}

/**
 * How long the block under the crosshair takes to come free, and whether
 * the selected tool refuses it outright.
 *
 * Bare hands (nothing selected, or a non-mining item) are never in the
 * effectiveness table at all, so every material is always breakable by
 * hand — at BARE_HAND_MS, slower than any tool that isn't wrong for it.
 * `blocked` only fires when a tool is actively wrong for the job.
 */
export function breakDelayFor(blockId) {
  const material = materialOf(blockId);
  const bare = BARE_HAND_MS[material] ?? NORMAL_BREAK_MS;
  if (!isTool(this.selectedItemId)) return { ms: bare, blocked: false, tier: 'hands' };
  const tier = toolEffectiveness(this.selectedItemId, material);
  if (tier === 'impossible') return { ms: 0, blocked: true, tier };
  if (tier === 'fast') {
    const grade = ITEMS_BY_ID.get(this.selectedItemId)?.tier ?? 'stone';
    return { ms: Math.round(bare * (TOOL_TIER_SPEED[grade] ?? TOOL_TIER_SPEED.stone)), blocked: false, tier };
  }
  if (tier === 'slow') return { ms: Math.round(bare * TOOL_SLOW), blocked: false, tier };
  return { ms: Math.round(bare * TOOL_NORMAL), blocked: false, tier };
}

// Water and lava aren't broken (asked for directly: "water blocks should
// not be breakable") — the ray still stops at a lake's surface, for the
// bucket and for building against it, but Break does nothing there.
export function breakBlock() {
  if (this.manning) return;
  const hit = this.raycast();
  if (this.hitBandit(hit)) return;
  if (this.catchFireflies(hit)) return;
  if (this.hitMob(hit)) return;
  if (!hit || isFluid(hit.block)) { this.digTarget = null; return; }

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
    if (isNewTarget) this.digTarget = { key, x: hit.x, y: hit.y, z: hit.z, ms, startedAt: performance.now() };
    this.digTarget.lastHitAt = performance.now();
    if (ms > 0 && performance.now() - this.digTarget.startedAt < ms) {
      // Not through yet: the pick going in, in whatever it is.
      this.sound?.dig(soundOf(BLOCKS_BY_ID.get(this.world.getBlock(hit.x, hit.y, hit.z))));
      return;
    }
    this.digTarget = null;
    // A breath before the next one, longer without the right tool.
    this.breakRestUntil = performance.now() + (tier === 'fast' ? BREAK_REST_MS.right : BREAK_REST_MS.other);
    // A tap that carries on digging (UIManager's bindLookSurface) stops
    // here, once its block is through — not on into the one behind it.
    if (this.breakOnce) this.setBreaking(false);
    // A tool only wears doing the job it's actually suited for — the speed
    // bonus has a cost, digging around with the wrong tool (or bare hands,
    // which was never in the effectiveness table to begin with) does not.
    if (tier === 'fast') wornBy = this.selectedItemId;
  }

  // An anchor tower's chain: cut, outside your land or not (the dark path).
  if (this.cutChainAt(hit)) return;
  const targets = this.computeTargets(hit.x, hit.y, hit.z);
  const changes = [];
  for (const t of targets) {
    const prev = this.world.getBlock(t.x, t.y, t.z);
    // A mirrored copy that lands in water leaves the water be, too.
    if (prev === AIR || isFluid(prev)) continue;
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
 * Which way you're facing, as quarter-turns from looking along -z: 0
 * north (-z), 1 east (+x), 2 south (+z), 3 west (-x). What a stair,
 * chair or door is put down at — see blocks.js's TURNS.
 */
export function lookFacing() {
  const yaw = this.player.yaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 1 : 3;
  return fz < 0 ? 0 : 2;
}

/**
 * The block to actually put down for what's held: turned to face the
 * right way. A stair climbs away from you; a chair and a door face you.
 */
export function placedBlock(type) {
  if (!turns(type)) return type;
  const look = this.lookFacing();
  const shape = BLOCKS_BY_ID.get(type)?.shape;
  // A chair and a chest face you; a stair climbs away from you.
  return turned(type, shape === 'chair' || shape === 'chest' || BLOCKS_BY_ID.get(type)?.facesYou ? look + 2 : look);
}

export function placeBlock() {
  // Empty-handed, there is nothing to put down.
  if (this.selectedItemId === BARE_HANDS) return;
  if (this.selectedItemId === 'storage_remote') return;
  const hit = this.raycast();
  if (!hit) return;
  // Place on a gate swings it (secondaryAction); a held Place repeating
  // shouldn't go on to build against it.
  if (swings(hit.block) || isChest(hit.block) || isCatapult(hit.block) || isPainting(hit.block) || hit.block === STORAGE_INTERFACE || (hit.block === STORAGE_CONTROLLER && this.selectedBlockId !== STORAGE_INTERFACE) || stationOf(hit.block)) return;
  const type = this.selectedBlockId;
  const availability = this.blockAvailability(type);
  if (!availability.ok) {
    this.ui.toast({ kind: 'xp', title: 'Locked block', body: availability.reason });
    return;
  }
  // How far up the face you pointed: a slab goes in that half of the block.
  const upFace = hit.point ? hit.point.y - hit.y : 0;
  // A slab on the open half of one of its own kind makes the whole block,
  // for the one slab (blocks.js slabMerge).
  const whole = slabMerge(this.placedBlock(type), hit.block, hit.normal, upFace);
  if (whole) {
    const item = ITEM_FOR_BLOCK.get(type);
    const changes = this.computeTargets(hit.x, hit.y, hit.z)
      .filter((t) => this.world.getBlock(t.x, t.y, t.z) === hit.block && !this.blockOverlapsPlayerAABB(t))
      .map((t) => ({ x: t.x, y: t.y, z: t.z, prev: hit.block, next: whole, item }));
    if (changes.length) this.applyChanges(changes, { viaSymmetry: this.symmetryTool.mode !== 'off' });
    return;
  }
  // A log lies along the face it's put against, a trapdoor sits on it, a
  // slab goes in the half you pointed at (blocks.js logOnFace,
  // trapdoorOnFace, slabOnFace).
  const held = panelOnFace(slabOnFace(trapdoorOnFace(logOnFace(this.placedBlock(type), hit.normal), hit.normal), hit.normal, upFace), hit.normal);
  const door = doorPart(held);
  // A bed or a tent: one thing in two blocks (blocks.js PAIRS).
  const pair = pairPart(held);
  const crop = cropOf(held);
  // Pointing at water, the block goes into it rather than on top of it:
  // that's how a pond is filled in, a block at a time (asked for directly:
  // "Should be able to place blocks on water, and remove it this way").
  const into = hit.block === WATER || isFlowing(hit.block);
  const targets = into ? this.computeTargets(hit.x, hit.y, hit.z) : this.computeTargets(hit.placeX, hit.placeY, hit.placeZ);
  const changes = [];
  for (const t of targets) {
    // A mirrored copy is turned to match, so a stair on the far side
    // climbs the mirrored way too.
    const next = mirrored(held, t);
    if (!this.world.inBounds(t.x, t.y, t.z)) continue;
    if (held === STORAGE_INTERFACE && this.world.getBlock(t.x, t.y - 1, t.z) !== STORAGE_CONTROLLER) continue;
    // A seed goes in farmland and nowhere else; a sapling in the ground.
    if (crop && this.world.getBlock(t.x, t.y - 1, t.z) !== FARMLAND) continue;
    if (held === SAPLING && !SAPLING_GROUND.has(this.world.getBlock(t.x, t.y - 1, t.z))) continue;
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
    if (pair) {
      // The second half goes in the next cell along: a bed's head ahead of
      // its foot, a tent's back behind its flap.
      const part = pairPart(next);
      const at = pairOther(part, t.x, t.z);
      const second = { x: at.x, y: t.y, z: at.z };
      if (!this.world.inBounds(second.x, second.y, second.z) || this.blockOverlapsPlayerAABB(second)) continue;
      const there = this.world.getBlock(second.x, second.y, second.z);
      if (there !== AIR && !isFlowing(there)) continue;
      changes.push({ ...second, prev: there, next: part.pair.second + part.facing });
    }
    changes.push({ x: t.x, y: t.y, z: t.z, prev, next });
  }
  if (pair && !changes.length) {
    this.ui.toast({ kind: 'xp', title: `No room for a ${pair.pair.name}`, body: 'It needs two blocks of clear floor, the way you face' });
    return;
  }
  if (door && !changes.length) {
    this.ui.toast({ kind: 'xp', title: 'No room for a door', body: 'It needs two blocks of clear space' });
    return;
  }
  if (held === SAPLING && !changes.length) {
    this.ui.toast({ kind: 'xp', title: 'Saplings go in the ground', body: 'Plant it on grass or dirt' });
    return;
  }
  if (crop && !changes.length) {
    this.ui.toast({ kind: 'xp', title: 'Seeds go in farmland', body: 'Put down farmland and plant on top of it' });
    return;
  }
  if (!this.applyChanges(changes, { viaSymmetry: this.symmetryTool.mode !== 'off' })) return;
  // A dinosaur's egg set down: it hatches in a couple of days (hatchEggs).
  for (const c of changes) {
    if (!EGG_TYPE[c.next] || !this.duilt) continue;
    this.duilt.layEgg(c.x, c.y, c.z, EGG_TYPE[c.next]);
    this.ui.toast({ kind: 'challenge', title: 'An egg, set down', body: `It hatches in ${HATCH_DAYS} days — tame, and yours.` });
  }
}

/** What a Mushy Log under the crosshair says: how long until it is covered (PLAY-15). */
export function mushyHint(hit) {
  const m = mushyOf(hit.block);
  const name = BLOCKS_BY_ID.get(hit.block)?.name ?? 'Mushy Log';
  if (m.stage === 2) return `${name} · ready: break it to pick them`;
  const left = this.duilt.mushyLogs.daysLeft(hit.x, hit.y, hit.z, this.duilt.days);
  if (left == null) return `${name} · break it to take it back`;
  return left > 1 ? `${name} · mushrooms in ${left} days` : `${name} · mushrooms by tomorrow`;
}

/** What a sapling under the crosshair says: how long until it's a tree. */
export function saplingHint(hit) {
  const s = this.duilt.saplings.get(hit.x, hit.y, hit.z);
  if (!s) return 'Sapling · wild — break it and plant it again to grow it';
  if (s.blocked) return 'Sapling · ready, but it needs room to grow';
  const left = this.duilt.saplings.daysLeft(hit.x, hit.y, hit.z, this.duilt.days);
  return left > 1 ? `Sapling · a tree in ${left} days` : 'Sapling · a tree by tomorrow';
}

/**
 * A crop stands on its farmland: take the soil out from under one and
 * the plant comes up with it (and goes in your bag, like any harvest).
 */
export function withUprooted(changes) {
  let out = changes;
  for (const c of changes) {
    if (c.next === c.prev || c.next === FARMLAND) continue;
    const above = this.world.getBlock(c.x, c.y + 1, c.z);
    // A crop off its farmland, or a sapling off its ground (asked for
    // directly: "saplings should drop if we break the bottom dirt") — it
    // comes away into your bag with the block under it. Grass turning to
    // dirt under one leaves it be; anything else takes it.
    if (!(c.prev === FARMLAND && cropOf(above)) && !(above === SAPLING && !SAPLING_GROUND.has(c.next))) continue;
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
export function withDoorHalves(changes) {
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

/**
 * A bed is one thing in two blocks, the same as a door: whatever takes
 * one half away takes the other with it (playtest, P1).
 */
export function withBedHalves(changes) {
  let out = changes;
  for (const c of changes) {
    // A bed or a tent (blocks.js PAIRS): either half taken takes the other.
    const part = pairPart(c.prev);
    if (!part || pairPart(c.next)) continue;
    const { x: ox, z: oz } = pairOther(part, c.x, c.z);
    const other = this.world.getBlock(ox, c.y, oz);
    const op = pairPart(other);
    if (!op || op.pair !== part.pair || op.second === part.second || op.facing !== part.facing) continue;
    if (out.some((o) => o.x === ox && o.y === c.y && o.z === oz)) continue;
    if (out === changes) out = [...changes];
    out.push({ x: ox, y: c.y, z: oz, prev: other, next: AIR });
  }
  return out;
}

export function blockOverlapsPlayerAABB(t) {
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
export function applyChanges(changes, { viaSymmetry = false, chargeResources = true, gather = true } = {}) {
  if(this.peerSession?.role==='guest'&&!this.applyingPeer){
    if(changes.length>32){this.ui.toast({kind:'xp',title:'Build in small steps while visiting',body:'The host can place large designs.'});return false;}
    try{void this.peerSession.sendEditRequest(changes).then(result=>{if(!result.ok)this.ui.toast({kind:'xp',title:'Host declined the edit',body:result.reason});}).catch(()=>this.ui.toast({kind:'xp',title:'Wait for the host connection'}));}
    catch{this.ui.toast({kind:'xp',title:'Wait for the host world to finish loading'});}
    return false;
  }
  changes = this.withUprooted(this.withBedHalves(this.withDoorHalves(changes.filter((c) => !this.world.isIndestructible(c.x, c.y, c.z)))));
  if (!changes.length) return false;

  // Duilt has its own economy: the border says where, the bag says whether.
  let duiltBill = null;
  if (this.duilt) {
    // The Past (world/past.js) is nobody's land: dig there, take its eggs, build.
    const centreX = this.world.gen?.biomes.centreX ?? 0;
    const outside = changes.find((c) => !this.duilt.territory.contains(c.x, c.z) && !inPast(c.x, centreX));
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
    // A chest you found and never opened is full of whatever it holds.
    for (const c of changes) if (isChest(c.prev) && !isChest(c.next)) this.unpackFound(c.x, c.y, c.z);
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
  // The far-off view of these chunks is remade, so walking away you still
  // see what you built there (#130).
  const remade = new Set();
  for (const c of changes) {
    const key = `${c.x >> 4},${c.z >> 4}`;
    if (remade.has(key)) continue;
    remade.add(key);
    this.farTerrain?.invalidateAt(c.x, c.z);
  }
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
      // A sapling counts its ten days from the day it went in.
      // Dirt opened to the sky beside turf, or turf put down beside dirt:
      // the turf will creep over it in time.
      if (TURFY.has(c.prev) || TURFY.has(c.next) || c.next === AIR) this.duilt.turf.consider(this.world, c.x, c.y, c.z, this.duilt.days, this.turfSkip());
      if (c.next === SAPLING && c.prev !== SAPLING) this.duilt.saplings.plant(c.x, c.y, c.z, this.duilt.days);
      else if (c.prev === SAPLING && c.next !== SAPLING) this.duilt.saplings.remove(c.x, c.y, c.z);
      // PLAY-15: a Mushy Log counts its ten days from the day it went in.
      // Removal is done by onBlocksBroken's take, so the harvest still has the record.
      if (mushyOf(c.next)?.stage === 0 && !mushyOf(c.prev)) this.duilt.mushyLogs.plant(c.x, c.y, c.z, this.duilt.days, mushyOf(c.next).kind);
    }
  }
  // One sound for the edit, however many blocks it was: what it was made of.
  const first = changes[0];
  if (first.next !== AIR) this.sound?.place(soundOf(BLOCKS_BY_ID.get(first.next)));
  else this.sound?.break(soundOf(BLOCKS_BY_ID.get(first.prev)));
  // Anything that opens a way for water, or blocks one, sets it running.
  for (const c of changes) { this.water?.touch(c.x, c.y, c.z); this.lava?.touch(c.x, c.y, c.z); }
  // A trunk cut away can leave its leaves with nothing to hold.
  for (const c of changes) {
    if (LOGS.has(c.prev) && !LOGS.has(c.next)) this.queueLeafDecay(c);
    else if (LOGS.has(c.next)) this.woodPlacedAt = performance.now();
  }
  this.remeshDirty();

  if (this.duilt) {
    const gained = gather ? this.duilt.onBlocksBroken(changes) : {};
    if (Object.keys(gained).length) this.bus.emit('duilt:gathered', { gained });
    this.growEditing(changes);
    this.duilt.structures.revalidateAround(changes);
    this.climbEditing(changes);
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
  // Nor for what the game digs for you (`gather` off — a mine's stair):
  // it isn't you placing a few hundred blocks.
  if (!this.duilt?.sandbox && gather) {
    for (const c of changes) {
      if (c.next !== AIR) this.gamification.onBlockPlaced({ world: this.world, x: c.x, y: c.y, z: c.z, type: c.next, viaSymmetry, now });
      else this.gamification.onBlockBroken({ world: this.world, x: c.x, y: c.y, z: c.z, type: c.prev, now });
    }
  }
  // This is the one place blocks change, so it is the one place that decides
  // the world has been played. See editedAt.
  this.editedAt = Date.now();
  this.lastCommittedChanges=changes;
  if(this.peerSession?.role==='host'&&!this.applyingPeer)void this.peerSession.broadcastEdits(changes).catch(()=>this.ui?.toast({kind:'xp',title:'Your guest needs a fresh world copy',body:'Use Send current host world in the invitation panel.'}));
  return true;
}
