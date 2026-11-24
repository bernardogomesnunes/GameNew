// Structures: the building panel's actions, editing and moving a building,
// claiming land (corners, wall column, waiting designs), ready-made buildings
// (stampStarter, digMineStairs) and doors and gates. Moved out of Game.js
// (TECH-10); every function runs with `this` set to the Game, which delegates
// to it. Nothing here runs at import time (constants and function
// declarations only).
import * as THREE from 'three';
import { claimRegion, blocksIn, claimHint } from '../tools/ClaimArea.js';
import { wallFootprintAt } from '../tools/PointerPick.js';
import { SELF_BLOCK_SECONDS } from '../duilt/VillagerJobs.js';
import { STRUCTURES_BY_ID, MINE_FLOOR } from '../config/structures.js';
import { starterDesign } from '../prefabs/HouseDesigns.js';
import { mineStairs } from '../duilt/mineStairs.js';
import { AIR, quarterTurned, doorPart, doorBlock, isTrapdoor, isOpenTrapdoor, swungTrapdoor, isOpenGate, swungGate } from '../config/blocks.js';

// The column claim tool — see beginClaimColumn. The height always grows up
// from the block you're pointing at, never down, so a claim never reaches
// into the ground you're standing on.
const CLAIM_COLUMN_MIN_HEIGHT = 1;
const CLAIM_COLUMN_MAX_HEIGHT = 24;
const CLAIM_COLUMN_DEFAULT_HEIGHT = 4;

/**
 * What the building panel can do to one building.
 *
 * These used to be "unlock" and "release the claim", which are words about
 * the bookkeeping rather than about the building. What you actually want to
 * do to something you put up is change it, move it, or get rid of it.
 */
export function buildingActions(structure) {
  return {
    onChange: () => {
      if (structure.locked === false) this.finishEditing();
      else this.startEditing(structure);
    },
    onMove: () => this.beginMove(structure),
    onDelete: () => this.deleteBuilding(structure),
    onOpenStore: () => this.ui.openStore(structure),
    onOpenStores: () => this.ui.openStores(),
    onEvolve: () => this.evolveBuilding(structure),
    onCube: () => this.enterCube(),
    onSow: (kind) => this.sowFarm(structure, kind, true),
    onUnsow: (kind) => this.sowFarm(structure, kind, false),
    onCompostFarm: () => this.compostFarm(structure),
    // A barracks (batch 3, #29): who to train. How many it holds is its level.
    onTrain: (unit) => this.trainSoldier(structure, unit),
    // IMP-37: what they do between fights — defend, patrol or formation.
    onSoldierOrder: (order) => this.soldierOrder(structure, order),
  };
}

/** Puts a seed into a farm, or takes one out (DuiltGame.sowFarm), saying why not when it can't. */
export function sowFarm(structure, kind, sow) {
  const r = sow ? this.duilt.sowFarm(structure, kind) : this.duilt.unsowFarm(structure, kind);
  if (!r.ok) this.ui.toast({ kind: 'xp', title: sow ? "Can't put that in" : "Can't take that out", body: r.reason });
}

/** Add compost through a farm's panel, advancing all its growing crops one stage. */
export function compostFarm(structure) {
  const result = this.duilt.compostFarm(structure);
  if (!result.ok) {
    this.ui.toast({ kind: 'xp', title: "Can't compost this farm", body: result.reason });
    return;
  }
  const changes = this.duilt.crops.grow(this.world);
  if (changes.length) this.remeshDirty();
  this.ui.toast({ kind: 'challenge', title: 'Farm composted', body: `Compost moved ${result.count} growing crop${result.count === 1 ? '' : 's'} ahead by one stage` });
  if (this.ui.isPanelOpen('panel-building')) this.ui.openBuilding(structure, this.buildingActions(structure));
}

/**
 * The button in the building panel that actually moves a leveled building
 * up its ladder — see StructureRegistry.evolve. Qualifying used to be the
 * whole story; this is what makes reaching the level something you did
 * rather than something that happened to the last block you placed. The
 * panel redraws itself off the bus (DuiltUI's structure:upgraded
 * listener), so there is nothing more to do here than ask and say why not.
 */
export function evolveBuilding(structure) {
  // What it still wants that can come from your bag — its lights, its
  // chests — goes in first (DuiltGame.evolvePlan), paid for like any
  // block you place. The building is locked against stray edits, not
  // against this, so it is opened just for the one change.
  const plan = this.duilt.evolvePlan(structure);
  if (!plan.ok) return void this.ui.toast({ kind: 'xp', title: "Can't evolve it yet", body: plan.reason });
  if (plan.changes.length) {
    const wasLocked = structure.locked !== false;
    this.duilt.structures.setLocked(structure.id, false);
    // Not climbed on the way: this one press is the one level.
    this.evolvingNow = true;
    const placed = this.applyChanges(plan.changes, { chargeResources: !this.duilt.sandbox });
    this.evolvingNow = false;
    this.duilt.structures.setLocked(structure.id, wasLocked);
    if (!placed) return;
  }
  // What isn't built in is taken from the bag instead, and counted as built.
  if (Object.keys(plan.pay ?? {}).length && !this.duilt.sandbox) this.duilt.inventory.spend(plan.pay);
  this.duilt.structures.addCredit(structure.id, plan.credit);
  const r = this.duilt.structures.evolve(structure.id);
  if (r.ok) this.duilt.note('evolve');
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
export function startEditing(structure) {
  this.duilt.structures.setLocked(structure.id, false);
  this.editingStructure = structure;
  this.updateEditOutline();
  this.ui.closePanel('panel-building');
  this.ui.setEditingBanner(STRUCTURES_BY_ID.get(structure.type)?.name ?? 'Building');
  this.ui.toast({
    kind: 'xp', title: 'Open for changes',
    body: 'Build or dig in it, or right against it — the gold box is what counts, and it levels up by itself',
  });
}

/**
 * What you place or dig right against the building you're changing
 * becomes part of it — see StructureRegistry.grow. Only while it's open
 * for changes: a locked building's box stays put.
 */
export function growEditing(changes) {
  const s = this.editingStructure;
  if (!s || !this.duilt) return;
  const t = this.duilt.territory;
  if (this.duilt.structures.grow(s.id, changes, { inside: (x, z) => t?.contains?.(x, z) ?? true })) this.updateEditOutline();
}

/**
 * The edge of the building open for changes, in gold, so you can see what
 * counts as part of it — and watch it grow as you build or dig against it
 * (see StructureRegistry.grow). Hidden when nothing is open.
 */
export function updateEditOutline() {
  const s = this.editingStructure;
  if (!s) { if (this.editOutline) this.editOutline.visible = false; return; }
  if (!this.editOutline) {
    this.editOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      // No depth test: findable from inside the building and through its walls.
      new THREE.LineBasicMaterial({ color: 0xf1c84b, transparent: true, opacity: 0.95, depthTest: false }),
    );
    this.editOutline.renderOrder = 12;
    this.scene.add(this.editOutline);
  }
  const r = s.region;
  const w = r.maxX - r.minX + 1, h = r.maxY - r.minY + 1, d = r.maxZ - r.minZ + 1;
  this.editOutline.scale.set(w + 0.04, h + 0.04, d + 0.04);
  this.editOutline.position.set(r.minX + w / 2, r.minY + h / 2, r.minZ + d / 2);
  this.editOutline.visible = true;
}

/**
 * After an edit to the building open for changes: if what's in it now
 * reaches the next level, it levels up by itself — see
 * StructureRegistry.climb.
 */
export function climbEditing(changes = []) {
  if (!this.duilt || this.evolvingNow) return;
  const reg = this.duilt.structures;
  // A quarry grows as you dig it, open for changes or not.
  const t = this.duilt.territory;
  const dug = reg.growDug(changes, { inside: (x, z) => t?.contains?.(x, z) ?? true });
  const s = this.editingStructure;
  let up = 0;
  for (const q of dug) if (q !== s) up += reg.climb(q.id);
  if (s) up += reg.climb(s.id);
  if (up) this.duilt.note('evolve');
}

/** The other half of startEditing — locks the building back up and hands the strip back to the crosshair. */
export function finishEditing() {
  const structure = this.editingStructure;
  if (!structure) return;
  this.editingStructure = null;
  this.updateEditOutline();
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
export function deleteBuilding(structure) {
  const spec = STRUCTURES_BY_ID.get(structure.type);
  if(structure.type==='work_hall') {
    const jobs=this.duilt.jobs;
    if(jobs.hallSupplies.get(structure.id)?.slots.some(Boolean)||[...jobs.assignments.values()].some(a=>a.hallId===structure.id&&a.carrying)||jobs.builds.some(j=>j.state==='queued'||Object.keys(j.escrow).length)) {
      this.ui.toast({kind:'xp',title:'Empty the Work Hall first',body:'Return supplies and carried goods, then finish or cancel building orders and collect their remaining materials.'});return;
    }
  }
  // The building this would otherwise still be pinning the crosshair strip
  // to no longer exists to finish editing.
  if (this.editingStructure?.id === structure.id) {
    this.editingStructure = null;
    this.updateEditOutline();
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
      body: `Empty the ${spec?.name?.toLowerCase() ?? 'storehouse'} first — nothing gets thrown away here`,
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
export function cellsOf(r) {
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
export function beginMove(structure) {
  // Moving takes over the crosshair strip for its own hint (setMoveHint) —
  // an edit in progress on the same building is done, one way or another.
  if (this.editingStructure?.id === structure.id) {
    this.editingStructure = null;
    this.updateEditOutline();
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
export function moveAnchor() {
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
export function moveCheck(anchor) {
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
export function updateMove() {
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
export function dropMove() {
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

/**
 * Turns the building you're carrying a quarter-turn (asked for directly:
 * "Moving buildings should allow rotate, only when moving"): its blocks go
 * round its middle, and each one that faces a way faces the next way round.
 */
export function turnMove() {
  const m = this.moving;
  if (!m) return;
  const { x: ex, z: ez } = m.extent;
  m.blocks = m.blocks.map((b) => ({ dx: ez - b.dz, dy: b.dy, dz: b.dx, type: quarterTurned(b.type) }));
  m.extent = { x: ez, y: m.extent.y, z: ex };
  this.ghost.show(m.blocks, m.extent);
  this.updateMove();
  this.sound?.click?.();
}

/** Puts it back where it was. Nothing has changed, so there is nothing to undo. */
export function cancelMove() {
  if (!this.moving) return;
  const spec = STRUCTURES_BY_ID.get(this.moving.structure.type);
  this.endMove();
  this.ui.toast({ kind: 'xp', title: 'Left where it was', body: `The ${spec?.name?.toLowerCase() ?? 'building'} has not moved` });
}

export function endMove() {
  this.moving = null;
  this.ghost.hide();
  this.ui.setMoveHint(null);
  this.ui.setCarrying(false);
}

export function openClaim() {
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
export function beginClaimSelection() {
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
export function markClaimCorner() {
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
export function updateClaimPreview() {
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
export function beginClaimColumn() {
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
export function adjustClaimColumnHeight(delta) {
  if (!this.pendingClaimColumn) return;
  const h = this.pendingClaimColumn.height + delta;
  this.pendingClaimColumn.height = Math.max(CLAIM_COLUMN_MIN_HEIGHT, Math.min(CLAIM_COLUMN_MAX_HEIGHT, h));
  this.claimColumnKey = null;
}

/** The column being drawn, outlined in the world while you aim and scroll. */
export function updateClaimColumnPreview() {
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
export function confirmClaimColumn() {
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

export function stampStarter(typeId, designId = null, workers = false) {
  if (!this.duilt) return;
  const design = starterDesign(typeId, designId);
  if (!design) return;
  const aimed = this.clearOfPlayer(this.stampAnchor(design?.extent), design?.extent);
  const b = this.fitInsideLand(aimed, design?.extent);
  // Follow the ground where it actually landed, or a slide sideways leaves
  // the building floating off a slope.
  if (b.x !== aimed.x || b.z !== aimed.z) b.y = this.world.surfaceHeight(b.x, b.z);
  // A mine goes down to its depth under where you aimed, and gets a stair
  // up to the top (asked for directly: "I'd like to keep the placement at
  // 91 blocks deep, but it should open a stairs to the top").
  const aimedY = b.y;
  if (typeId === 'mine') b.y = Math.min(b.y, MINE_FLOOR);
  const plan = this.duilt.starterPlacement(typeId, { x: b.x, y: b.y, z: b.z }, designId);
  if (!plan.ok) {
    this.ui.toast({ kind: 'xp', title: 'Cannot place that', body: plan.reason });
    return;
  }
  if (workers || design.workers) {
    const e = design.extent;
    const region = {minX:b.x,maxX:b.x+e.x,minY:b.y,maxY:b.y+e.y,minZ:b.z,maxZ:b.z+e.z};
    const result = this.duilt.jobs.enqueueBuild({...plan,name:design.name,type:typeId,designId:design.id,region});
    this.ui.toast({kind:result.ok?'challenge':'xp',title:result.ok?`${design.name} queued for builders`:'Cannot queue this building',body:result.ok?(this.duilt.jobs.hasBuilders()?'Your builders will walk over and put it up, a block at a time.':'Assign builders at the Work Hall. Reserved materials stay with this order.'):result.reason});
    if (result.ok) this.editedAt=Date.now();
    return;
  }
  // IMP-20: placed by you in a Duilt world, it goes up block by block on
  // its own, 1.5 times as slow as with villagers, and is claimed when it
  // is done (configureVillagerJobs' onBuildComplete). Creative stays
  // instant, and so does a mine, whose stair is dug as it is placed.
  if (!this.duilt.sandbox && typeId !== 'mine') {
    const e = design.extent;
    const region = {minX:b.x,maxX:b.x+e.x,minY:b.y,maxY:b.y+e.y,minZ:b.z,maxZ:b.z+e.z};
    const result = this.duilt.jobs.enqueueBuild({...plan,name:design.name,type:typeId,designId:design.id,region},undefined,{self:true});
    const minutes = result.ok ? Math.max(1, Math.round(result.job.changes.length * SELF_BLOCK_SECONDS / 60)) : 0;
    this.ui.toast({kind:result.ok?'challenge':'xp',title:result.ok?`${design.name} is going up`:'Cannot place that',body:result.ok?`About ${minutes} min. Builders at a Work Hall are faster.`:result.reason});
    if (result.ok) this.editedAt=Date.now();
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
  const stairs = typeId === 'mine' ? this.digMineStairs(region, aimedY) : null;
  const claim = this.duilt.claim(region, typeId);
  // Refused, it's remembered rather than forgotten: it says what it's
  // waiting for when you look at it, and counts the moment it can.
  if (!claim.ok) this.duilt.waitFor(region, typeId, claim.reason);
  const way = stairs == null ? '' : stairs ? ' Stairs lead down to it.' : ' No room for stairs beside it here — dig your own way down.';
  this.ui.toast(claim.ok
    ? { kind: 'challenge', title: `${plan.design.name} placed`, body: `${claim.reason}${way}` }
    : { kind: 'xp', title: `${plan.design.name} placed — not working yet`, body: `${claim.reason}. It will start as soon as it can.${way}` });
}

/**
 * A ready-made mine's inside dug out, and its stair cut up to the surface
 * (duilt/mineStairs.js) — free, and the rock it cuts isn't handed to you:
 * it's part of the mine. Whether there was room for the stair.
 */
export function digMineStairs(region, aimedY) {
  const d = this.duilt;
  const fits = (x, z) => d.sandbox || d.territory.contains(x, z);
  const { changes, side } = mineStairs(this.world, region, { look: aimedY + 40, fits });
  // Not through somebody's building: a stair that would cut one goes nowhere.
  const ok = side != null && !d.structures.blocking(changes);
  const dig = ok ? changes : mineStairs(this.world, region, { fits: () => false }).changes;
  const dug = !dig.length || this.applyChanges(dig, { chargeResources: false, gather: false });
  return ok && dug;
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
export function toggleGate(hit) {
  // A door swings both its halves together.
  const door = doorPart(hit.block);
  const trap = isTrapdoor(hit.block);
  const cells = door ? [...this.doorCells(hit), ...this.doorPartnerCells(hit, door)] : [{ x: hit.x, y: hit.y, z: hit.z, block: hit.block }];
  const shutting = door ? door.open : trap ? isOpenTrapdoor(hit.block) : isOpenGate(hit.block);
  if (shutting && cells.some((c) => this.blockOverlapsPlayerAABB(c))) {
    this.ui.toast({ kind: 'xp', title: door ? 'Step out of the doorway first' : trap ? 'Step out from under it first' : 'Step out of the gateway first' });
    return;
  }
  this.sound?.creak(!shutting, door ? 'door' : trap ? 'trapdoor' : 'gate');
  for (const c of cells) {
    const part = doorPart(c.block);
    // A trapdoor shuts onto the floor when that's where it stands — ground
    // under it and nothing over it — and at the top of its cell otherwise.
    const low = trap && this.world.isCollidable(c.x, c.y - 1, c.z) && !this.world.isCollidable(c.x, c.y + 1, c.z);
    const next = part ? doorBlock({ ...part, open: !part.open }) : trap ? swungTrapdoor(c.block, { low }) : swungGate(c.block);
    this.world.setBlock(c.x, c.y, c.z, next);
    this.water?.touch(c.x, c.y, c.z);
    this.lava?.touch(c.x, c.y, c.z);
  }
  this.remeshDirty();
  this.editedAt = Date.now();
}

/**
 * A villager swinging a door (Settlers.passDoors): both halves, and the
 * one paired beside it, as toggleGate does for you. Quiet, and it never
 * shuts on you: false when it can't, so they try again in a moment.
 */
export function villagerDoor(x, y, z, open) {
  if (!this.world?.inBounds(x, y, z)) return false;
  const block = this.world.getBlock(x, y, z), door = doorPart(block);
  if (!door) return false;
  if (door.open === open) return true;
  const at = { x, y, z, block };
  const cells = [...this.doorCells(at), ...this.doorPartnerCells(at, door)];
  if (!open && cells.some((c) => this.blockOverlapsPlayerAABB(c))) return false;
  for (const c of cells) {
    const part = doorPart(c.block);
    this.world.setBlock(c.x, c.y, c.z, doorBlock({ ...part, open }));
  }
  this.remeshDirty();
  this.editedAt = Date.now();
  return true;
}

/**
 * The door beside this one in a pair — the same way round, beside it along
 * the doorway, shut or open alike — so a double door swings as one. Asked
 * for directly: "When 2 doors are next to each other we should have them
 * open each from their side, leaving the middle open." Each is drawn hinged
 * on its outer edge (ChunkMesher's doorMirrored).
 */
export function doorPartnerCells(at, door) {
  const steps = [[-1, 0], [0, -1], [1, 0], [0, 1]];
  const [hx, hz] = steps[door.facing & 3];
  for (const k of [1, -1]) {
    const x = at.x + hx * k, z = at.z + hz * k;
    if (!this.world.inBounds(x, at.y, z)) continue;
    const block = this.world.getBlock(x, at.y, z);
    const p = doorPart(block);
    if (p && p.facing === door.facing && p.top === door.top && p.open === door.open) return this.doorCells({ x, y: at.y, z, block });
  }
  return [];
}

/** Both halves of the door at a cell — or just the one, if its other half is missing. */
export function doorCells(at) {
  const part = doorPart(at.block ?? this.world.getBlock(at.x, at.y, at.z));
  const self = { x: at.x, y: at.y, z: at.z, block: at.block ?? this.world.getBlock(at.x, at.y, at.z) };
  const oy = part.top ? at.y - 1 : at.y + 1;
  const other = this.world.inBounds(at.x, oy, at.z) ? this.world.getBlock(at.x, oy, at.z) : AIR;
  const op = doorPart(other);
  return op && op.top !== part.top ? [self, { x: at.x, y: oy, z: at.z, block: other }] : [self];
}
