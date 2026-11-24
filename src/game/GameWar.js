// War and combat: the god's wand, the bow, blows on mobs and bandits, the
// guardian, the Stone Kingdom's ten rounds and the siege, the defence
// buildings, the dark path's oath, army, expedition and sky attack, and the
// catapult. Moved out of Game.js (TECH-10); every function runs with `this`
// set to the Game, which delegates to it. Nothing here runs at import time
// (only constants and function declarations), so the file can be loaded
// lazily (TECH-7).
import { castVoxelRay } from '../interaction/VoxelRaycast.js';
import { warTrack } from '../duilt/warTracker.js';
import { GAME_DAY_SECONDS } from '../render/DayCycle.js';
import { soundOf } from '../audio/Sound.js';
import { newWorldId } from './GameLoad.js';
import { STRUCTURES_BY_ID } from '../config/structures.js';
import { LocalRivalAI } from '../duilt/LocalRivalAI.js';
import { applyPeerWorldEdits } from '../net/applyPeerWorldEdits.js';
import { buildWorldPayload, parseWorldPayload } from '../storage/WorldExport.js';
import { AIR, BLOCKS_BY_ID, turned, doorPart, doorBlock, isChest, CATAPULT, isCatapult, isFluid, CHAIN, WAR_TENT, WAR_TENT_BACK, CAMPFIRE } from '../config/blocks.js';
import { BEER_COOLDOWN, KOMBUCHA_DAMAGE } from '../config/drinks.js';
import { AvatarView } from '../render/AvatarView.js';
import { ARROW_DAMAGE, drawShot, FULL_DRAW_MS, MIN_DRAW_MS } from '../world/Arrows.js';
import { itemName, ITEMS, ITEMS_BY_ID } from '../config/items.js';
import { MOBS_BY_ID } from '../config/mobs.js';
import { rayBox } from '../world/Mobs.js';
import { knock, SWORD_KNOCK, ARROW_KNOCK } from '../world/bodies.js';
import { bestAim, predictArc, craterCells, MAX_RANGE } from '../world/Projectiles.js';
import { MODE_WORDS } from '../world/Guardian.js';
import { compass } from '../world/Wanderers.js';
import { UNITS_BY_ID, soldierCap } from '../config/soldiers.js';
import { blowOf, ORDERS } from '../world/Defenders.js';
import { FALL_DAYS } from '../duilt/Rivals.js';
import { rivalSites, RIVAL_HEX } from '../world/rivals.js';
import { skyFor, skyAt, chainAt } from '../world/skyKingdom.js';
import { CHAINS, SINK_DAYS } from '../duilt/SkyWar.js';
import { AMBUSH } from '../duilt/Suspicion.js';
import { MODE_WORDS as ARMY_WORDS, MARCH_DAYS } from '../world/Army.js';
import { ROUNDS, LAST_ROUND, ROUND_GOLD, companyWords } from '../config/war.js';
import { WANDERERS } from '../config/wanderers.js';
// Game.js imports this file and this file imports Game.js: these are only read
// inside functions, after both modules have loaded.
import { REACH, SKY_ATTACK_IN, SKY_ATTACK_OUT } from '../Game.js';

/** IMP-45: what one blow of the Dragon Axe does: more than any creature but a god has. */
const DRAGON_AXE_BLOW = 100000;
/** The god's wand's beam (useWand): how often, how fast, how hard. */
const WAND_EVERY_MS = 350, WAND_BEAM_SPEED = 70, WAND_BEAM_DAMAGE = 12;
/** The war only comes on while you're this near home — it's your settlement they want. */
const WAR_HOME_RANGE = 220;
/** Blows a block of a claimed wall, gatehouse or watchtower takes before it breaks. */
const REINFORCED = 3;
/** How often the defence buildings' posts are brought in line with what's standing. */
const DEFENCE_SYNC_MS = 1000;
// Between blows on an animal. Held Break repeats faster than this for
// blocks; a swing at something alive shouldn't land six times a second.
const STRIKE_COOLDOWN_MS = 350;
/** A blow with nothing in your hand: a heart (two half-hearts). */
const FIST_DAMAGE = 2;
// The catapult (Phase 6c) — see manCatapult.
const CATAPULT_RELOAD = 2;      // seconds between throws
// The bow: how long a draw takes between one arrow and the next.
const BOW_DRAW_MS = 550;
/** Drawn all the way, the view closes in this much, as you'd squint down the arrow. */
const BOW_ZOOM = 0.12;
const CATAPULT_REACH = 4;       // walk further than this from it and you let go
const CATAPULT_MIN_THROW = 6;   // it won't drop a stone closer than this
const CATAPULT_AMMO = ['stone', 'cobblestone'];
const STONE_HITS = 14;
// What the Stone King sends you when the Sky Kingdom falls.
const SKY_TRIBUTE = 64;
// The expedition's camp: this far out beyond the anchor tower, clear of its guards.
const EXPEDITION_OUT = 24;
// The ground it clears for its tents, and for you to arrive on.
const CAMP_CLEAR = 10;
const BLACK_BANNER = 186;
const BLACK_RING_SPARK = 4;          // what a stone does to anyone it lands on
/** A rival's colour as a number, for their people's coats. */
function rivalColour(id) {
  return parseInt(RIVAL_HEX[id].slice(1), 16);
}
/** An army in a sentence: "5 rival soldiers, 2 archers and a battering ram". */
function rivalWords(who) {
  const parts = who.map(([kind, n]) => (n === 1 ? WANDERERS[kind].one : `${n} ${WANDERERS[kind].many}`));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

/**
 * Break with the wand: a block in reach is picked to copy; anything else —
 * somebody, or open air — gets a beam (a fast bolt that strikes hard).
 */
export function useWand() {
  const hit = this.raycast();
  if (hit && !this.banditTarget(hit) && !this.mobTarget?.(hit) && !this.world.isIndestructible(hit.x, hit.y, hit.z)) {
    this.wandBlock = hit.block;
    return void this.ui?.toast({ kind: 'xp', title: `Wand: ${BLOCKS_BY_ID.get(hit.block)?.name ?? 'that'}`, body: 'Place puts down a copy — a coin each' });
  }
  const now = performance.now();
  if (now - (this.lastShotAt ?? 0) < WAND_EVERY_MS) return;
  this.lastShotAt = now;
  const eye = this.player.eyePosition(), dir = this.player.lookDirection();
  this.arrows?.shoot({ x: eye.x + dir.x * 0.4, y: eye.y + dir.y * 0.4 - 0.08, z: eye.z + dir.z * 0.4 }, dir, WAND_BEAM_SPEED, WAND_BEAM_DAMAGE);
  this.sound?.strike({ weapon: true });
}

/** Gives a barracks's or Garrison's soldiers a standing order (Defenders ORDERS); they move on the next sync. */
export function soldierOrder(structure, order) {
  if (!this.duilt?.defenders.setOrder(structure.id, order)) return;
  this.defenceSyncedAt = 0;
  this.syncDefence();
  const o = ORDERS.find((x) => x.id === order);
  this.ui.toast({ kind: 'xp', title: `Order: ${o.name}`, body: o.blurb });
  // PLAY-12: from a War Hall's list the pop-up on screen is the hall's, not the company's.
  const shown = this.ui.duiltUI?.building ?? structure;
  if (this.ui.isPanelOpen('panel-building')) this.ui.openBuilding(shown, this.buildingActions(shown));
}

/** PLAY-12: sends a company on the march (DuiltGame.marchCompany), saying why not when it cannot go. */
export function marchCompany(structure, rivalId) {
  const r = this.duilt.marchCompany(structure, rivalId);
  if (!r.ok) return void this.ui.toast({ kind: 'xp', title: "Can't march", body: r.reason });
  this.editedAt = Date.now();
  this.defenceSyncedAt = 0;
  this.syncDefence();
  const shown = this.ui.duiltUI?.building ?? structure;
  if (this.ui.isPanelOpen('panel-building')) this.ui.openBuilding(shown, this.buildingActions(shown));
}

/** Trains a soldier at a barracks (DuiltGame.trainSoldier), saying why not when it can't. */
export function trainSoldier(structure, unit) {
  const r = this.duilt.trainSoldier(structure, unit);
  if (!r.ok) return void this.ui.toast({ kind: 'xp', title: "Can't train that yet", body: r.reason });
  const who = r.unit.name.toLowerCase();
  const postName = structure.type === 'military' ? 'Garrison' : 'barracks';
  this.ui.toast({ kind: 'xp', title: `Training ${/^[aeiou]/.test(who) ? 'an' : 'a'} ${who}`, body: `They join the defenders outside the ${postName} when they are ready` });
  // The pop-up shows them in its line straight away, whatever else redraws it.
  if (this.ui.isPanelOpen('panel-building')) this.ui.openBuilding(structure, this.buildingActions(structure));
}

export async function openPeerBattle() {
  if(!this.duilt?.battle){this.ui.toast({kind:'xp',title:'Open a Battle world first'});return;}
  const world=this.world;
  const {PeerBattlePanel}=await import('../ui/PeerBattlePanel.js');
  if(this.world!==world)return;
  this.peerPanel ??= new PeerBattlePanel({
    isBattle:()=>!!this.duilt?.battle,
    getSnapshot:()=>buildWorldPayload({...this.saveState(),name:this.worldName}),
    onPeer:peer=>{this.peerSession=peer;if(!peer)this.clearPeerAvatar();},
    onPosition:position=>{this.peerPosition=position;this.peerAvatar??=new AvatarView(this.scene);},
    onSnapshot:payload=>{
      const data=parseWorldPayload(JSON.stringify(payload));
      this.acceptingPeerSnapshot=true;
      try{this.loadFromData({...data,worldId:newWorldId()});this.worldIsLocal=true;}
      finally{this.acceptingPeerSnapshot=false;}
      return true;
    },
    onEditRequest:cells=>{
      if(!this.peerPosition||cells.some(c=>Math.hypot(c.x-this.peerPosition.x,c.y-this.peerPosition.y,c.z-this.peerPosition.z)>12||this.world.getBlock(c.x,c.y,c.z)!==c.prev))return {ok:false,reason:'Stay close to an unchanged building site.'};
      this.applyingPeer=true;
      try{const ok=this.applyChanges(cells);return {ok,changes:ok?this.lastCommittedChanges:[],reason:ok?null:'The host cannot pay for or approve those changes.'};}
      finally{this.applyingPeer=false;}
    },
    onEdits:cells=>{
      return applyPeerWorldEdits(this,cells);
    },
    onStatus:status=>{if(status.state==='closed'||status.state==='failed'){this.clearPeerAvatar();this.peerSession=null;}},
  });
  this.ui.closePanel('panel-menu');this.peerPanel.open();
}

/** Between blows, in ms: a beer makes it shorter. */
export function strikeCooldown() {
  return STRIKE_COOLDOWN_MS * (this.duilt?.boosted('haste') ? BEER_COOLDOWN : 1);
}

/** How hard a blow lands: the tool's damage (a fist 1), plus kombucha's. */
export function blowDamage(tool, target = null) {
  // IMP-45: the Dragon Axe fells anything in one blow, but not a god.
  if (tool?.id === 'dragon_axe' && target && !target.god) return DRAGON_AXE_BLOW;
  // Bare hands take a whole heart — asked for directly: "without weapons
  // 1 heart should go".
  return (tool?.damage ?? FIST_DAMAGE) + (this.duilt?.boosted('strength') ? KOMBUCHA_DAMAGE : 0);
}

/**
 * Break, aimed at an animal: one blow. Hunting is the same button as
 * digging — the thing under the crosshair decides which it is, the same
 * way a settler in front of a wall is what you're looking at. A tool hits
 * harder than a fist (its `damage`, bare hands 1) and wears for it.
 * Returns whether the press was spent on an animal.
 */
export function hitMob(hit) {
  // A flying machine or a train standing there takes it: back in your bag.
  if (this.pickUpMachine(hit) || this.pickUpTrain(hit)) return true;
  const mob = this.mobTarget(hit);
  if (!mob) return false;
  // Your own horse, and whatever its cart carries, is never hunted.
  if (mob.owned) return true;
  const now = performance.now();
  if (now - (this.lastStrikeAt ?? 0) < this.strikeCooldown()) return true;
  this.lastStrikeAt = now;
  this.digTarget = null;
  const tool = ITEMS_BY_ID.get(this.selectedItemId);
  const { x, z } = this.player.position;
  const { killed, drops } = this.mobs.hit(mob, this.blowDamage(tool, { god: false }), x, z, this.blowKnock(tool));
  this.sound?.strike({ weapon: !!tool?.weapon });
  // A dragon struck now and then sheds a scale (IMP-45).
  if (MOBS_BY_ID.get(mob.type)?.sheds && !killed && Math.random() < 0.15) this.shedDragon(mob, { dragon_scale: 1 });
  if (tool?.damage && this.duilt && this.duilt.inventory.useTool(tool.id) === 'worn') {
    this.ui.toast({ kind: 'xp', title: `${tool.name} broke`, body: 'Worn out — craft another' });
  }
  if (killed) this.mobFell(mob, drops);
  return true;
}

/** An animal brought down, by a blow or an arrow: experience, what it left, and saying so. */
export function mobFell(mob, drops) {
  const spec = MOBS_BY_ID.get(mob.type);
  if (spec.sheds) {
    const shed = {};
    for (const [id, [lo, hi]] of Object.entries(spec.sheds)) shed[id] = lo + Math.floor(Math.random() * (hi - lo + 1));
    this.shedDragon(mob, shed);
  }
  // Experience for a hunt — not for one of your own penned animals.
  if (!mob.penId) {
    this.gamification.onKill({ kind: 'mob', hp: spec.hp, name: `a ${spec.name.toLowerCase()}` });
    this.duilt?.note('hunt', mob.type);
    this.tellMoment('first_hunt');
  }
  const gained = this.duilt?.collect(drops) ?? {};
  const got = Object.entries(gained).map(([id, n]) => `+${n} ${itemName(id).toLowerCase()}`).join(', ');
  this.ui.toast({ kind: 'xp', title: `Hunted a ${spec.name.toLowerCase()}`, body: got || undefined });
  if (mob.penId) this.duilt?.forgetAnimal(mob);
}

/** How far a blow with this in your hand throws what it lands on: a sword further than a fist. */
export function blowKnock(tool) {
  return tool?.weapon && !tool.ranged ? SWORD_KNOCK : 1;
}

/**
 * Break, with the bow in hand: an arrow, from your eye the way you look
 * (asked for directly: "we don't have bow and arrows"). It flies on its
 * own — see world/Arrows.js — and whatever it meets takes the hit
 * (arrowHit). A short draw between shots; each one spends an arrow and
 * wears the bow a little.
 */
export function shootBow(shot = drawShot(FULL_DRAW_MS)) {
  const now = performance.now();
  if (now - (this.lastShotAt ?? 0) < (this.drawing || shot.power < 1 ? 150 : BOW_DRAW_MS)) return;
  const d = this.duilt;
  const paying = d && !d.sandbox;
  if (paying && !d.inventory.has('arrow', 1)) {
    this.ui.toast({ kind: 'xp', title: 'No arrows', body: 'Make them at the bench from planks and string' });
    return;
  }
  this.lastShotAt = now;
  if (paying) {
    d.inventory.remove('arrow', 1);
    if (d.inventory.useTool('bow') === 'worn') this.ui.toast({ kind: 'xp', title: 'Bow broke', body: 'Worn out — craft another' });
  }
  const eye = this.player.eyePosition(), dir = this.player.lookDirection();
  this.arrows?.shoot({ x: eye.x + dir.x * 0.4, y: eye.y + dir.y * 0.4 - 0.08, z: eye.z + dir.z * 0.4 }, dir, shot.speed, shot.damage);
  this.sound?.strike({ weapon: true });
}

/** Whether the bow is what's in your hand, with nothing else taking the button. */
export function bowReady() {
  return this.selectedItemId === 'bow' && this.isPlaying && !this.armed && !this.moving && !this.manning;
}

/**
 * Starts drawing the bow — the button (or finger) is down. Returns true
 * when the press was the bow's, so nothing else acts on it. With no arrow
 * to nock it says so and draws nothing.
 */
export function startDraw() {
  if (!this.bowReady()) return false;
  const d = this.duilt;
  if (d && !d.sandbox && !d.inventory.has('arrow', 1)) {
    this.ui.toast({ kind: 'xp', title: 'No arrows', body: 'Make them at the bench from planks and string' });
    return true;
  }
  this.drawing = { since: performance.now() };
  return true;
}

/** How far the bow is drawn, 0..1, or 0 when it isn't. */
export function drawPower(now = performance.now()) {
  return this.drawing ? drawShot(now - this.drawing.since).power : 0;
}

/**
 * The button (or finger) comes up: the arrow goes, as hard as it was
 * drawn. Too short a pull, or `cancel` (the window lost the pointer),
 * lets it down without shooting.
 */
export function releaseDraw({ cancel = false } = {}) {
  if (!this.drawing) return false;
  const held = performance.now() - this.drawing.since;
  this.drawing = null;
  this.setZoom(1);
  if (cancel || held < MIN_DRAW_MS || this.selectedItemId !== 'bow') return false;
  this.shootBow(drawShot(held));
  this.handView?.strike();
  return true;
}

/** The view's field of view, closed in by `k` of itself (1 is as set). */
export function setZoom(k) {
  const fov = (this.controls?.fov ?? 75) * k;
  if (Math.abs(this.camera.fov - fov) < 0.01) return;
  this.camera.fov = fov;
  this.camera.updateProjectionMatrix();
}

/**
 * Every frame: the drawn bow's pull — the meter, the zoom, the hand —
 * let down if it's been put away, and any arrow you walk over picked up.
 */
export function tickBow() {
  if (this.drawing && this.selectedItemId !== 'bow') this.releaseDraw({ cancel: true });
  const p = this.drawPower();
  if (this.drawing) this.setZoom(1 - BOW_ZOOM * p);
  this.ui?.setDrawMeter?.(this.drawing ? p : null);
  // Arrows stuck in the world come back when you walk over them.
  if (!this.arrows || !this.player) return;
  const at = this.player.position;
  const n = this.arrows.collect({ x: at.x, y: at.y + 0.9, z: at.z });
  if (n && this.duilt && !this.duilt.sandbox) {
    const left = this.duilt.inventory.add('arrow', n);
    if (n - left > 0) this.ui.toast({ kind: 'xp', title: `Picked up ${n - left === 1 ? 'an arrow' : `${n - left} arrows`}` });
  }
}

/** What's alive on an arrow's next stretch of flight: an animal or a bandit, whichever's nearer. */
export function arrowTarget(from, dir, length) {
  const mob = this.mobs?.pick(from, dir, length);
  const wild = mob && !mob.mob.owned ? { kind: 'mob', mob: mob.mob, t: mob.t } : null;
  const people = this.wanderers ? this.wanderers.list.filter((p) => WANDERERS[p.kind].hp) : [];
  const found = people.length ? this.wanderView.pickAt(people, from, dir, length) : null;
  const bandit = found ? { kind: 'bandit', person: found.person, t: found.t } : null;
  if (wild && bandit) return wild.t <= bandit.t ? wild : bandit;
  return wild ?? bandit;
}

/** An arrow found its mark. */
export function arrowHit(arrow, hit) {
  const damage = arrow.damage ?? ARROW_DAMAGE;
  if (hit.kind === 'mob') {
    const { killed, drops } = this.mobs.hit(hit.mob, damage, arrow.x - arrow.vx, arrow.z - arrow.vz, ARROW_KNOCK);
    this.sound?.strike({ weapon: true });
    if (killed) this.mobFell(hit.mob, drops);
    return;
  }
  const p = hit.person;
  const res = this.wanderers.hit(p, damage, arrow.x - arrow.vx, arrow.z - arrow.vz, ARROW_KNOCK);
  if (!res) return;
  this.sound?.strike({ weapon: true });
  this.focusGuardian(p, res);
  if (res.killed) this.banditFell(p, res);
}

/**
 * The bandit under the crosshair, if one is nearer than the block behind
 * it and within reach. Only bandits can be fought — a messenger just
 * stands there being named, and the hermit talks (speakToHermit).
 */
export function banditTarget(hit = this.raycast()) {
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
export function hitBandit(hit) {
  const p = this.banditTarget(hit);
  if (!p) return false;
  const now = performance.now();
  if (now - (this.lastStrikeAt ?? 0) < this.strikeCooldown()) return true;
  this.lastStrikeAt = now;
  this.digTarget = null;
  const tool = ITEMS_BY_ID.get(this.selectedItemId);
  const { x, z } = this.player.position;
  // Struck in disguise: the first blow lands unseen, and hard — and then they know.
  const ambush = WANDERERS[p.kind]?.sky && this.unseen();
  const res = this.wanderers.hit(p, this.blowDamage(tool, { god: !!WANDERERS[p.kind]?.god }) * (ambush ? AMBUSH : 1), x, z, this.blowKnock(tool));
  if (ambush) this.revealDisguise();
  if (!res) return false;
  // An upgraded sword (playtest, P6): stuns, burns or freezes as it lands.
  if (tool?.element && !res.killed) this.wanderers.afflict(p, tool.element);
  this.sound?.strike({ weapon: !!tool?.weapon });
  if (tool?.damage && this.duilt && this.duilt.inventory.useTool(tool.id) === 'worn') {
    this.ui.toast({ kind: 'xp', title: `${tool.name} broke`, body: 'Worn out — craft another' });
  }
  this.focusGuardian(p, res);
  if (res.killed) this.banditFell(p, res);
  return true;
}

/** Combatants on the opposing side, never farm animals or fleeing travellers. */
export function guardianEnemy(p, includeDead = false) {
  const spec = WANDERERS[p?.kind];
  return !!(spec?.hp && (spec.hits || spec.siege) && !spec.flees
    && (includeDead || !p.dead) && (p.raider || this.wanderers?.hostileOf(p)));
}

/** Only successful player hits change priority; a lethal latest hit clears it. */
export function focusGuardian(p, result) {
  if (result && this.wanderers?.list.includes(p) && this.guardianEnemy(p, true)) {
    this.duilt?.guardian?.focus(result.killed ? null : p);
  }
}

/** A bandit beaten, by a blow or an arrow: experience, what they had, and saying so. */
export function banditFell(p, res) {
  this.personKilled(p);
  const gained = this.duilt?.collect(res.drops) ?? {};
  const got = Object.entries(gained).map(([id, n]) => `+${n} ${itemName(id).toLowerCase()}`).join(', ');
  this.ui.toast({ kind: 'xp', title: `Beat ${p.name === WANDERERS[p.kind].noun ? p.name : `${p.name}, ${WANDERERS[p.kind].noun ?? 'a bandit'}`}`, body: got || undefined });
}

/** Experience for a person you brought down yourself — as much as they took to beat. */
export function personKilled(p) {
  this.gamification.onKill({ kind: 'person', hp: WANDERERS[p.kind]?.hp ?? 0, name: p.name });
}

/** Whatever a bandit burnt down by a fire sword dropped, into the bag. */
export function collectFallen() {
  for (const { p, drops } of this.wanderers.fallen.splice(0)) {
    this.personKilled(p);
    const gained = this.duilt?.collect(drops) ?? {};
    const got = Object.entries(gained).map(([id, n]) => `+${n} ${itemName(id).toLowerCase()}`).join(', ');
    this.ui?.toast({ kind: 'xp', title: `${p.name} burnt down`, body: got || undefined });
  }
}

/** Your guardian, if the crosshair is on it and no block is in front of it. */
export function guardianTarget(hit = this.raycast()) {
  const g = this.duilt?.guardian;
  if (!g) return null;
  const eye = this.player.eyePosition(), dir = this.player.lookDirection();
  const t = g.pick(eye, dir, REACH + 4);
  if (t == null) return null;
  if (hit) {
    const blockT = rayBox(eye, dir, hit.x, hit.y, hit.z, hit.x + 1, hit.y + 1, hit.z + 1);
    if (blockT != null && blockT < t) return null;
  }
  return g;
}

/** Tapped: follow → stay → hunt. Stands in for the soldiers' command wheel until there is one. */
export function commandGuardian() {
  const g = this.duilt.guardian;
  const mode = g.command();
  this.ui.toast({ kind: 'challenge', title: `${g.name} — ${MODE_WORDS[mode]}` });
}

/** What the guardian does this frame, and what that does to the world. */
export function tickGuardian(dt) {
  const g = this.duilt?.guardian;
  if (!g) return;
  const enemies = (this.wanderers?.list ?? []).filter((p) => this.guardianEnemy(p));
  g.tick(dt, this.player.position, enemies, {
    strike: (e, damage) => {
      const res = this.wanderers.hit(e, damage, g.x, g.z);
      if (res?.killed) {
        const gained = this.duilt.collect(res.drops) ?? {};
        const got = Object.entries(gained).map(([id, n]) => `+${n} ${itemName(id).toLowerCase()}`).join(', ');
        this.ui.toast({ kind: 'xp', title: `${g.name} brought down ${e.name}`, body: got || undefined });
      }
    },
    heal: () => this.duilt.health.heal(1),
    scare: (e, seconds) => this.wanderers.scare(e, seconds),
    downed: () => this.ui.toast({ kind: 'xp', title: `${g.name} is down`, body: 'It has gone back to its Sanctuary — it will return after a day' }),
    back: () => this.ui.toast({ kind: 'challenge', title: `${g.name} is back`, body: 'Waiting at its Sanctuary' }),
  });
}

/** A bandit's blow landing on you — a heavy one throws you back. */
export function banditHits(p, hits, blow = {}) {
  if (!this.duilt || this.duilt.sandbox) return;
  const taken = this.duilt.hurt(hits, p.war ? 'army' : WANDERERS[p.kind]?.sky ? 'sky' : 'bandit');
  if (!taken) return;
  // The Black Ring (Phase 7c): a dark spark back at whoever struck you.
  if (this.duilt.ringWorn() === 'black' && this.wanderers) {
    const res = this.wanderers.hit(p, BLACK_RING_SPARK, this.player.position.x, this.player.position.z);
    if (res?.killed) {
      this.personKilled(p);
      const gained = this.duilt.collect(res.drops) ?? {};
      const got = Object.entries(gained).map(([id, n]) => `+${n} ${itemName(id).toLowerCase()}`).join(', ');
      this.ui.toast({ kind: 'xp', title: `The ring's spark felled ${p.name}`, body: got || undefined });
    }
  }
  // Knocked up off your feet a little, so a blow is felt and not just seen;
  // a heavy one throws you back, away from whoever struck it.
  if (blow.heavy) this.player.knockBack(this.player.position.x - p.x, this.player.position.z - p.z);
  else {
    // Any blow moves you back a step (IMP-28), as yours move them.
    if (this.player.grounded) this.player.velocity.y = 4.5;
    this.player.nudge(this.player.position.x - p.x, this.player.position.z - p.z);
  }
  // Their swing, and its weight; the hurt itself is heard from Health.
  this.sound?.swing();
  this.sound?.blow(!!blow.heavy, { x: p.x, z: p.z });
}

/**
 * A raider at a storehouse: carries off up to a dozen of whatever's in it,
 * two kinds at most. Beat them before they get away and it's yours again.
 */
export function banditSteals(p, structure) {
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

/** The middle of your settlement — where the war is aimed. */
export function settlementCentre() {
  const t = this.duilt.territory;
  return { x: t.centreX, z: t.centreZ };
}

/** Where the Stone Kingdom lies from home, as a word — or null if it's nowhere. */
export function kingdomDirection() {
  const k = this.wanderers?.landmarks.find((l) => l.kind === 'kingdom');
  if (!k || !this.duilt) return null;
  const home = this.settlementCentre();
  return compass(k.x - home.x, k.z - home.z);
}

/**
 * Each frame: announce a round, send it, or watch the one at your walls
 * and settle it when the last of them is down or gone. A round only comes
 * on while you're near home — it's your settlement they want, and you
 * they want to find there.
 */
export function tickWar() {
  const d = this.duilt;
  if (!d || d.sandbox || !this.wanderers) return;
  const war = d.war;
  if (war.stage === 'fighting') {
    if (this.wanderers.warParty) this.watchRound();
    else this.sendRound();
    return;
  }
  if (!war.atWar) return;
  const home = this.settlementCentre(), p = this.player.position;
  if (Math.hypot(p.x - home.x, p.z - home.z) > WAR_HOME_RANGE) return;
  const what = war.tick(d.days);
  if (what === 'warn') {
    const shut = this.shutGates();
    if (shut) this.ui?.toast({ kind: 'challenge', title: 'The gates are shut', body: `${shut === 1 ? 'Your gatehouse has' : `${shut} gatehouses have`} closed for the round` });
    const dir = this.kingdomDirection() ?? 'north';
    this.sound?.horn();
    this.ui?.toast({
      kind: 'challenge',
      title: `War horns to the ${dir}`,
      body: `Round ${war.round} of ${LAST_ROUND}: ${companyWords(war.round, WANDERERS)}. They'll be at your border in about a minute.`,
    });
  } else if (what === 'start') {
    this.sendRound();
  }
}

/** Between rounds: { seconds, away } until the next one sets out, or null. */
export function warComing() {
  const d = this.duilt, war = d?.war;
  if (!war || d.sandbox || war.stage === 'fighting') return null;
  const left = war.daysToNext(d.days);
  if (left == null) return null;
  const home = this.settlementCentre(), p = this.player?.position;
  const away = !!p && Math.hypot(p.x - home.x, p.z - home.z) > WAR_HOME_RANGE;
  return { seconds: left * GAME_DAY_SECONDS, away };
}

/** IMP-22: the round's attackers from where you are, for the HUD; null when no round is on. */
export function warTracking() {
  const band = this.duilt?.war.stage === 'fighting' ? this.wanderers?.warParty?.band : null;
  if (!band || !this.player) return null;
  // Flat look direction from the yaw (lookDirection() makes a new vector each call).
  const yaw = this.player.yaw;
  this._warLook ??= { x: 0, z: 0 };
  this._warLook.x = -Math.sin(yaw); this._warLook.z = -Math.cos(yaw);
  return warTrack(band, this.player.position, this._warLook);
}

/** The round that's due, at the edge of your land on the Stone Kingdom's side. */
export function sendRound() {
  const war = this.duilt.war;
  const home = this.settlementCentre();
  const k = this.wanderers.landmarks.find((l) => l.kind === 'kingdom');
  const towards = k ? { x: k.x, z: k.z } : { x: home.x, z: home.z - 1000 };
  const band = this.wanderers.sendWarband(home, towards, this.duilt.territory.size / 2, ROUNDS[war.round - 1].who, war.round);
  if (!band) return; // nowhere loaded to gather yet — next frame
  this.wanderers.warParty = { round: war.round, band, died: false };
  const dir = compass(band[0].x - home.x, band[0].z - home.z);
  this.ui?.toast({
    kind: 'challenge',
    title: `Round ${war.round} of ${LAST_ROUND} — they're here`,
    body: `${companyWords(war.round, WANDERERS)}, coming in from the ${dir}. Beat them back.`,
  });
}

/** Whether the round at your walls is over yet, and how it went. */
export function watchRound() {
  const party = this.wanderers.warParty;
  if (party.band.some((p) => !p.dead && !p.done)) return;
  this.wanderers.warParty = null;
  const d = this.duilt, war = d.war, n = party.round;
  const won = !party.died && !party.band.some((p) => p.escaped);
  const res = war.resolve(won, d.days);
  if (res === 'lost') {
    this.ui?.toast({
      kind: 'xp',
      title: `Round ${n} lost`,
      body: party.died ? 'They beat you, and went home with what they came for. They\'ll be back.'
        : 'Some of them got away with what they took. They\'ll be back — the round comes again.',
    });
    return;
  }
  const gold = ROUND_GOLD(n);
  d.collect({ gold });
  if (res === 'victory') {
    this.ui?.toast({
      kind: 'achievement',
      title: 'The dark army is broken',
      body: `All ten rounds beaten, the Warlord with them. The raids are over for good — the white god's light is on your land. +${gold} gold`,
    });
    d.endWhitePath();
    d.checkAgeAdvance();
    this.editedAt = Date.now();
    return;
  }
  this.ui?.toast({
    kind: 'achievement',
    title: `Round ${n} of ${LAST_ROUND} won`,
    body: `+${gold} gold. Round ${war.round} comes in a day or so — or sound a war horn when you're ready.`,
  });
  this.editedAt = Date.now();
}

/** The rivals' cities as places people live, and what their guards need to know. */
export function syncRivals() {
  const w = this.wanderers, gen = this.world?.gen;
  if (!w || !gen) return;
  w.rivalState = (lm) => {
    const b = this.duilt?.battle, r = b?.list[lm?.rival];
    if (!r) return null;
    return { garrison: b.garrison(r), fallen: b.fallen(r, this.duilt.days), colour: rivalColour(r.id) };
  };
  const has = w.landmarks.some((l) => l.kind === 'rival');
  if (!!this.duilt?.battle === has) return;
  w.landmarks = has ? w.landmarks.filter((l) => l.kind !== 'rival')
    : [...w.landmarks, ...rivalSites(gen).map((s) => ({ kind: 'rival', rival: s.id, name: s.name, x: s.x, z: s.z, y: s.y, half: s.half, people: s.people }))];
}

/** Who you're up against, said once as the world opens. */
export function battleWelcome() {
  const home = this.settlementCentre();
  const names = rivalSites(this.world.gen).map((r) => `${r.name} to the ${compass(r.x - home.x, r.z - home.z)}`);
  this.ui.toast({
    kind: 'challenge', title: 'Battle: three rivals',
    body: `${names.join(', ')} — about 5,000 blocks out, on your map. Build up: once you've a barracks, their armies come. Take a city's standard to break its strength.`,
    duration: 10000,
  });
}

/**
 * Each frame, in a Battle world: the rivals grow; your first barracks
 * starts them coming; an army's announced, sent, watched and settled — one
 * at a time, and only while you're home, as the Stone Kingdom's rounds are.
 */
export function tickRivals() {
  const d = this.duilt, b = d?.battle;
  if (!b || d.sandbox || !this.wanderers || this.peerSession?.role==='guest') return;
  if (b.localAI && import.meta.env?.DEV) {
    this.localRivalAI ??= new LocalRivalAI({onStatus:status=>{
      if (this.localAIStatus === status) return;
      this.localAIStatus = status;
      this.ui?.toast({kind:'challenge',title:status==='connected'?'LM Studio rivals connected':'LM Studio unavailable',body:status==='connected'?'Your model is choosing rival strategies.':'Normal rival strategies continue; the model will be tried again.'});
    }});
    void this.localRivalAI.tick(b);
  }
  b.grow(d.days);
  if (!b.armed && d.structures.countOf('barracks') > 0 && b.arm(d.days)) {
    this.editedAt = Date.now();
    this.ui?.toast({ kind: 'challenge', title: 'Your barracks is up — and the rivals have seen it', body: 'Their armies will come for you now, one city at a time. Raise soldiers, build walls.', duration: 8000 });
  }
  const party = this.wanderers.rivalParty;
  if (party) return void this.watchRivals(party);
  const fighting = b.fighting();
  if (fighting) return void this.sendRivals(fighting);
  if (this.wanderers.warParty) return; // the Stone Kingdom's round first
  const home = this.settlementCentre(), p = this.player.position;
  if (Math.hypot(p.x - home.x, p.z - home.z) > WAR_HOME_RANGE) return;
  const due = b.tick(d.days);
  if (!due) return;
  const site = rivalSites(this.world.gen)[due.rival.id];
  if (due.what === 'warn') {
    this.sound?.horn();
    this.ui?.toast({
      kind: 'challenge',
      title: `${site.name} marches on you`,
      body: `${rivalWords(b.company(due.rival))}, from the ${compass(site.x - home.x, site.z - home.z)}. They'll be at your border in about a minute.`,
    });
  } else this.sendRivals(due.rival);
}

/** A rival's army, at the edge of your land on their side, in their colour. */
export function sendRivals(r) {
  const home = this.settlementCentre();
  const site = rivalSites(this.world.gen)[r.id];
  const band = this.wanderers.sendWarband(home, site, this.duilt.territory.size / 2, this.duilt.battle.company(r), 0);
  if (!band) return; // nowhere loaded to gather yet — next frame
  for (const q of band) { q.rival = r.id; if (!WANDERERS[q.kind].siege) q.colour = rivalColour(r.id); }
  this.wanderers.rivalParty = { rival: r.id, band, died: false };
  this.ui?.toast({ kind: 'challenge', title: `${site.name}'s army is here`, body: `Coming in from the ${compass(band[0].x - home.x, band[0].z - home.z)}. Beat them back.` });
}

/** Whether a rival's army is done with, and how it went. */
export function watchRivals(party) {
  if (party.band.some((q) => !q.dead && !q.done)) return;
  this.wanderers.rivalParty = null;
  const d = this.duilt, b = d.battle, r = b.list[party.rival];
  const site = rivalSites(this.world.gen)[r.id];
  const won = !party.died && !party.band.some((q) => q.escaped);
  b.resolve(r, won, d.days);
  this.editedAt = Date.now();
  if (!won) return void this.ui?.toast({ kind: 'xp', title: `${site.name} got the better of you`, body: 'They went home with what they came for — and a little stronger for it.' });
  const gold = 2 + Math.round(r.strength);
  d.collect({ gold });
  this.ui?.toast({ kind: 'achievement', title: `${site.name}'s army is beaten`, body: `+${gold} gold. They're weaker for it — for now.` });
}

/**
 * Place on a rival's standard: with its garrison beaten, the city's
 * yours until they've rebuilt — their strength halved, and tribute paid.
 */
export function takeStandard(aimed) {
  const d = this.duilt, b = d?.battle;
  if (!b) return;
  const site = rivalSites(this.world.gen).find((s) => Math.abs(s.x - aimed.x) <= s.half && Math.abs(s.z - aimed.z) <= s.half);
  if (!site) return;
  const r = b.list[site.id];
  if (b.fallen(r, d.days)) {
    const left = Math.max(1, Math.ceil(r.fallenUntil - d.days));
    return void this.ui.toast({ kind: 'xp', title: `${site.name} is yours`, body: `For now: they'll have rebuilt in ${left === 1 ? 'a day' : `${left} days`}.` });
  }
  const guards = (this.wanderers?.list ?? []).filter((q) => q.landmark?.rival === site.id && q.kind === 'rival_guard' && !q.dead).length;
  if (guards) return void this.ui.toast({ kind: 'challenge', title: 'The garrison holds the standard', body: `${guards} of them still stand. Beat them first.` });
  const gold = b.conquer(r, d.days);
  d.collect({ gold });
  this.editedAt = Date.now();
  this.sound?.lift?.();
  this.ui.toast({ kind: 'achievement', title: `You took ${site.name}`, body: `+${gold} gold in tribute. Their strength is broken in half, and no army comes from them while they rebuild — about ${FALL_DAYS} days.`, duration: 8000 });
}

/**
 * A ram's blow or a siege stone: blocks out of your walls and buildings,
 * claimed or not — that's what a siege is. Never a chest, a fluid, or the
 * bottom of the world, and nothing comes to you for it. A claimed
 * building that loses a block is broken until you put it back.
 */
export function siegeBreak(cells) {
  if (!this.duilt) return 0;
  const changes = [];
  this.siegeDamage ??= new Map();
  for (const { x, y, z, id = this.world.getBlock(x, y, z) } of cells) {
    if (id === AIR || this.world.isIndestructible(x, y, z) || isChest(id) || isFluid(id)) continue;
    // A claimed wall, gatehouse or watchtower is built to take it: a block
    // of one stands REINFORCED blows before it goes.
    const s = this.duilt.structures.at(x, y, z);
    if (s?.valid && STRUCTURES_BY_ID.get(s.type)?.defence) {
      const key = `${x},${y},${z}`;
      const blows = (this.siegeDamage.get(key) ?? 0) + 1;
      if (blows < REINFORCED) { this.siegeDamage.set(key, blows); continue; }
      this.siegeDamage.delete(key);
    }
    changes.push({ x, y, z, prev: id, next: AIR });
  }
  if (!changes.length) return 0;
  for (const c of changes) {
    this.world.setBlock(c.x, c.y, c.z, AIR);
    this.farTerrain?.invalidateAt(c.x, c.z);
    this.water?.touch(c.x, c.y, c.z);
    this.lava?.touch(c.x, c.y, c.z);
  }
  this.remeshDirty();
  this.sound?.break?.(soundOf(BLOCKS_BY_ID.get(changes[0].prev)), { x: changes[0].x, z: changes[0].z });
  this.growEditing(changes);
  this.duilt.structures.revalidateAround(changes);
  this.climbEditing(changes);
  this.duilt.settlers.revalidate();
  this.duilt.territory.onBlocksChanged(changes);
  this.editedAt = Date.now();
  return changes.length;
}

/** A siege catapult's stone, lobbed at the top of whatever it's aiming at. */
export function enemyThrows(p, at) {
  if (!this.projectiles) return;
  const x = Math.floor(at.x), z = Math.floor(at.z);
  let y = Math.min(this.world.height - 1, Math.floor(p.y) + 40);
  while (y > 0 && !this.world.collisionBoxAt(x, y, z)) y--;
  const from = { x: p.x, y: p.y + 2.2, z: p.z };
  const stone = this.projectiles.fire(from, bestAim(this.world, from, { x: x + 0.5, y: y + 1, z: z + 0.5 }));
  stone.enemy = true;
  this.sound?.catapult({ x: p.x, z: p.z });
}

/** Every open door in a claimed gatehouse, shut. Returns how many gatehouses had any. */
export function shutGates() {
  let gatehouses = 0;
  for (const s of this.duilt?.structures.list() ?? []) {
    if (s.type !== 'gatehouse' || !s.valid) continue;
    const r = s.region;
    let any = false;
    for (let x = r.minX; x <= r.maxX; x++) for (let y = r.minY; y <= r.maxY; y++) for (let z = r.minZ; z <= r.maxZ; z++) {
      const part = doorPart(this.world.getBlock(x, y, z));
      if (!part?.open) continue;
      this.world.setBlock(x, y, z, doorBlock({ ...part, open: false }));
      any = true;
    }
    if (any) gatehouses++;
  }
  if (gatehouses) this.remeshDirty();
  return gatehouses;
}

/**
 * Your soldiers and tower archers (the defence buildings — world/
 * Defenders.js): their posts brought in line with what's standing every
 * second, and each frame, anything of the enemy's in your land fought.
 */
export function tickDefence(dt) {
  const d = this.duilt;
  if (!d || d.sandbox || !this.wanderers) return;
  this.syncDefence();
  const enemies = this.wanderers.list.filter((p) => WANDERERS[p.kind].hp && !p.dead && !p.done && (p.war || p.raider || p.angry));
  // Soldiers who went without their meal fight weaker (Defenders.tick).
  d.defenders.hungry = Math.min(d.settlers.soldiersHungry ?? 0, d.settlers.soldiers ?? 0);
  d.defenders.tick(dt, enemies, {
    strike: (e, damage, by) => this.defenderHits(e, damage, by),
    shot: (e, damage, by) => this.defenderHits(e, damage, by),
    lob: (engine, target, crew) => this.crewThrows(engine, target, crew),
  });
}

/**
 * Your barracks and towers brought in line with what's standing, once a
 * second: soldiers out of training, archers posted.
 */
export function syncDefence() {
  const d = this.duilt;
  if (!d || d.sandbox || !this.wanderers) return;
  const now = performance.now();
  if (now - (this.defenceSyncedAt ?? 0) > DEFENCE_SYNC_MS) {
    this.defenceSyncedAt = now;
    const posts = d.structures.list()
      .filter((s) => s.type === 'barracks' || s.type === 'military' || s.type === 'watchtower')
      .map((s) => ({ id: s.id, type: s.type, region: s.region, valid: s.valid, cap: s.type === 'barracks' || s.type === 'military' ? soldierCap(s) : 0 }));
    // Each one out of training says so (asked for directly: "show the progress").
    // The patrol's loop goes round all your buildings (IMP-37).
    let village = null;
    for (const s of d.structures.list()) {
      if (!s.valid || !s.region) continue;
      const r = s.region;
      village = village ? { minX: Math.min(village.minX, r.minX), maxX: Math.max(village.maxX, r.maxX), minZ: Math.min(village.minZ, r.minZ), maxZ: Math.max(village.maxZ, r.maxZ) } : { minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ };
    }
    for (const j of d.defenders.sync(posts, d.days, village, d.research)) {
      const u = UNITS_BY_ID.get(j.unit);
      const post = d.structures.list().find((s) => String(s.id) === String(j.of));
      const postName = post?.type === 'military' ? 'Garrison' : 'barracks';
      this.ui?.toast({ kind: 'xp', title: `Your ${u?.name.toLowerCase() ?? 'soldier'} is ready`, body: j.left ? `${j.left} more in training at the ${postName}` : `Outside the ${postName}` });
    }
  }
}

/**
 * A catapult crew's stone (batch 3, #29), lobbed at the ground under the
 * enemy it's aimed at. It lands among them and hurts them, and only them:
 * it breaks no blocks and hurts none of yours (see stoneLands).
 */
export function crewThrows(engine, target, crew) {
  if (!this.projectiles) return;
  const x = Math.floor(target.x), z = Math.floor(target.z);
  let y = Math.min(this.world.height - 1, Math.floor(target.y) + 6);
  while (y > 0 && !this.world.collisionBoxAt(x, y, z)) y--;
  const from = { x: engine.x, y: engine.y + 2.2, z: engine.z };
  const stone = this.projectiles.fire(from, bestAim(this.world, from, { x: target.x, y: y + 1, z: target.z }));
  stone.crew = crew;
  this.sound?.catapult({ x: engine.x, z: engine.z });
}

/** One of your soldiers' blows, or an archer's arrow, landing. */
export function defenderHits(e, damage, by) {
  const res = this.wanderers.hit(e, damage, by.x, by.z);
  if (!res?.killed) return;
  const gained = this.duilt.collect(res.drops) ?? {};
  const got = Object.entries(gained).map(([id, n]) => `+${n} ${itemName(id).toLowerCase()}`).join(', ');
  const who = by.kind === 'archer' || by.kind === 'bowman' ? 'archers' : by.kind === 'crew' ? 'catapult crew' : 'soldiers';
  this.ui?.toast({ kind: 'xp', title: `Your ${who} brought down ${e.name}`, body: got || undefined });
}

/** A raider's blow on one of your soldiers — or one of your army. */
export function soldierHit(p, soldier, hits) {
  // Knocked back along the blow (IMP-28); a villager without the hop.
  if (p && soldier) knock(soldier, p.x, p.z, 1, 1, !this.duilt?.settlers.people.includes(soldier));
  // A villager (owner, 8 November: the raid "starts killing everyone").
  if (this.duilt?.settlers.people.includes(soldier)) {
    if (this.duilt.settlers.hurt(soldier, hits)) {
      this.ui?.toast({ kind: 'xp', title: `${soldier.name ?? 'A villager'} was killed by the raiders`, body: 'Their bed is free for the next to come.' });
    }
    return;
  }
  if (soldier.kind === 'warrior') {
    if (this.duilt.army.hurt(soldier, hits)) this.ui?.duiltUI?.renderArmy?.();
    return;
  }
  if (!this.duilt.defenders.hurt(soldier, hits)) return;
  this.ui?.toast({ kind: 'xp', title: 'One of your soldiers has fallen', body: `${soldier.name ?? 'Your soldier'} is gone — train another at the barracks` });
}

/** Whether (x, y, z) is the heart of the dark god's altar in the Stone Kingdom. */
export function isAltar({ x, y, z }) {
  const k = this.wanderers?.landmarks.find((l) => l.kind === 'kingdom');
  return !!k?.altar && k.altar.x === x && k.altar.y === y && k.altar.z === z;
}

/** At the altar, with the Black Ring on your hand: the King's thousand are yours. */
export function swearOath() {
  const d = this.duilt;
  if (!d || d.sandbox) return;
  if (d.army.sworn) return void this.ui?.toast({ kind: 'xp', title: 'You are sworn already', body: `${d.army.total} warriors answer to you` });
  if (d.ringWorn() !== 'black') {
    return void this.ui?.toast({
      kind: 'xp', title: 'The altar is cold',
      body: d.ring === 'white' ? 'The dark god turns from the White Ring' : d.ring === 'black' ? 'Put the Black Ring on, and kneel again' : 'Only the bearer of the Black Ring can swear here',
    });
  }
  d.army.swear(d.days);
  this.sound?.gong();
  this.ui?.toast({
    kind: 'achievement',
    title: 'You swore to the dark god',
    body: `The Stone King keeps his word: ${d.army.total} warriors march with you. Order them from the ⚔ banner — follow, hold, attack, or form a line.`,
  });
  this.ui?.duiltUI?.renderArmy?.();
  this.editedAt = Date.now();
}

/** At a war tent: camp here. You wake here, and the army holds round it. */
export function makeCamp({ x, y, z }) {
  const d = this.duilt;
  if (!d) return;
  d.spawn = { x, y, z };
  if (d.army.active) d.army.command('hold', { x: x + 0.5, z: z + 2.5 }, this.player.yaw);
  this.ui?.toast({
    kind: 'challenge', title: 'You made camp',
    body: d.army.active ? 'You\'ll wake here, and the army holds round it. Order them on from the ⚔ banner.' : 'You\'ll wake here when you fall.',
  });
  this.ui?.duiltUI?.renderArmy?.();
}

/**
 * The dark path's attack on the Sky Kingdom (duilt/SkyWar.js): it begins
 * when you reach the island or its towers with the Black Ring, is over if
 * you leave again, and is lost if your army is wiped out there (falling
 * there is seen to in die()).
 */
export function tickSkyAttack() {
  const d = this.duilt, gen = this.world?.gen;
  if (!d || d.sandbox || d.ring !== 'black' || d.skyFallen || !gen) return;
  const at = skyAt(gen), p = this.player.position;
  const far = Math.hypot(at.x - p.x, at.z - p.z);
  const war = d.skyWar;
  if (!war.attack) {
    if (far > SKY_ATTACK_IN) return;
    war.begin(d.days, d.army.active ? d.army.total : 0);
    this.ui?.toast({
      kind: 'challenge', title: 'The attack on the Sky Kingdom has begun',
      body: this.disguised()
        ? 'In the Sky armour they take you for one of their own. Walk, keep your distance, don\'t linger — and keep the Black Ring out of sight. Watch the 👁 meter.'
        : 'Bring down the Sky King in his palace. Fall here, or lose your army, and you\'re driven back home — and the Sky Kingdom will tax you for it.',
    });
    return;
  }
  if (far > SKY_ATTACK_OUT) { war.withdraw(); return; }
  if (war.attack.army > 0 && d.army.total === 0) this.skyAttackLost('army');
}

/**
 * The attack is lost: you're driven back home (from a fall, you wake
 * there — see die()), the tax goes up, and the Stone King makes up some
 * of your losses.
 */
export function skyAttackLost(how) {
  const d = this.duilt;
  const r = d.loseSkyAttack();
  if (!r) return;
  if (how === 'army') {
    const home = this.homeSpawn();
    this.player.teleport(home.x, home.y, home.z);
  }
  const pct = Math.round(r.rate * 100);
  this.ui?.toast({
    kind: 'xp',
    title: 'The attack on the Sky Kingdom failed',
    body: `${how === 'army' ? 'Your army was wiped out' : 'You fell'}, and you were driven back home. `
      + `The Sky Kingdom now takes ${pct}% of what your buildings make, until it falls. `
      + (d.army.sworn ? (r.replaced ? `The Stone King sends ${r.replaced} warriors to make up your losses.` : r.lost ? 'The Stone King sends no more warriors.' : '') : ''),
  });
  this.ui?.duiltUI?.renderArmy?.();
  this.editedAt = Date.now();
}

/** The Sky King is down: the Sky Kingdom falls. */
export function skyKingDown() {
  this.skyFalls(false);
}

/**
 * The Sky Kingdom falls: its King brought down, or (`yielded`) its chains
 * all cut and its island sunk until it had to give in.
 */
export function skyFalls(yielded) {
  const d = this.duilt;
  const taxed = d?.skyWar.failures > 0;
  if (d && yielded) d.skyWar.yielded = true;
  if (!d || !d.bringDownSky()) return;
  // Its guards lay down their arms: nobody on the island fights you now.
  for (const p of this.wanderers?.list ?? []) {
    if (!WANDERERS[p.kind]?.sky) continue;
    p.angry = false; p.target = null; p.speed = 0;
  }
  this.sound?.rumble();
  this.ui?.toast({
    kind: 'achievement',
    title: yielded ? 'The Sky Kingdom yields' : 'The Sky Kingdom has fallen',
    body: d.sandbox ? 'Its King is down.' : `${yielded ? 'Sunk low on its cut chains, it can hold out no longer: its King comes down from his throne' : 'Its King is down'}, and its guards lay down their arms.${taxed ? ' Its taxes end.' : ''} The island is your land now: build on it as you would at home.`,
  });
  if (d.sandbox) return;
  // The Stone King keeps his word: honour, and gold from his treasury.
  const gained = d.collect({ gold: SKY_TRIBUTE }) ?? {};
  this.ui?.toast({
    kind: 'achievement',
    title: 'The Stone King honours you',
    body: `He names you Lord of the Sky, above every lord he has${gained.gold ? `, and sends ${gained.gold} gold from his treasury` : ''}. Speak to him in his keep.`,
  });
  this.editedAt = Date.now();
}

/**
 * Break, at a link of an anchor tower's chain, on the dark path: the
 * whole chain is cut and falls away — outside your land, where no other
 * block can be broken. Cut all four and the island sinks (tickSinking).
 * Returns whether the press was spent on a chain.
 */
export function cutChainAt(hit) {
  const d = this.duilt, gen = this.world?.gen;
  if (!d || d.sandbox || d.ring !== 'black' || d.skyFallen || !gen || !hit) return false;
  if (this.world.getBlock(hit.x, hit.y, hit.z) !== CHAIN) return false;
  const i = chainAt(gen, hit.x, hit.y, hit.z);
  if (i < 0) return false;
  const r = d.skyWar.cutChain(i, d.days);
  if (!r) return false;
  // Every link of it, gone.
  for (const [x, y, z] of skyFor(gen).towers[i].chain) {
    if (this.world.getBlock(x, y, z) === CHAIN) this.world.setBlock(x, y, z, AIR);
  }
  this.remeshDirty();
  this.sound?.chain?.();
  this.ui?.toast(r.sinking
    ? { kind: 'achievement', title: 'The last chain is cut', body: `Nothing holds the Sky Kingdom up now. It will sink lower day by day — in ${SINK_DAYS} days it must yield.` }
    : { kind: 'challenge', title: `An anchor chain is cut — ${CHAINS - r.left} of ${CHAINS}`, body: `Its lift goes nowhere now. Cut the other ${r.left} and the island will sink until it yields.` });
  this.editedAt = Date.now();
  return true;
}

/** Its chains all cut, the island sinks: a word each day, and in SINK_DAYS it yields. */
export function tickSinking() {
  const d = this.duilt;
  if (!d || d.sandbox || d.ring !== 'black' || d.skyFallen) return;
  const s = d.skyWar.sinking(d.days);
  if (!s) return;
  if (s.left <= 0) return void this.skyFalls(true);
  if (s.day > d.skyWar.toldDay) {
    d.skyWar.toldDay = s.day;
    this.ui?.toast({ kind: 'challenge', title: 'The Sky Kingdom sinks lower', body: `Its waterfalls run thin and its towers lean. ${Math.ceil(s.left)} more day${Math.ceil(s.left) === 1 ? '' : 's'} and it must yield.` });
  }
}

/** Whether the map offers the expedition: sworn, the Sky Kingdom standing, the army here and not already there. */
export function expeditionState() {
  const d = this.duilt;
  if (!d || d.sandbox || !d.army.active || !this.skyOpen() || d.skyFallen) return null;
  const a = d.army;
  if (a.marching) return { marching: true, left: Math.max(0, a.march.arrives - d.days) };
  if (a.camp) return { camped: true };
  return { ready: true };
}

/**
 * Where the army camps: on the ground out beyond the anchor tower
 * nearest home, out of the tower guards' sight, facing the island.
 */
export function expeditionCampSpot() {
  const gen = this.world.gen, s = skyFor(gen);
  const home = { x: gen.biomes?.centreX ?? 0, z: gen.biomes?.centreZ ?? 0 };
  const t = s.towers.reduce((best, t) => (Math.hypot(t.x - home.x, t.z - home.z) < Math.hypot(best.x - home.x, best.z - home.z) ? t : best));
  const { ux, uz } = t.landing;
  // Dry and level ground (seen: a camp pitched in a lake): try further
  // out and to either side until the tents, fire and banners all fit.
  const camp = (x, z) => {
    const y = gen.heightAt(x, z);
    for (let dx = -6; dx <= 6; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        if (gen.waterLevelAt?.(x + dx, z + dz) || Math.abs(gen.heightAt(x + dx, z + dz) - y) > 1) return null;
      }
    }
    return { x, y, z, facing: Math.atan2(ux, uz) };
  };
  for (let out = EXPEDITION_OUT; out <= EXPEDITION_OUT + 60; out += 6) {
    for (const side of [0, 8, -8, 16, -16, 24, -24]) {
      const at = camp(Math.round(t.x + ux * out + uz * side), Math.round(t.z + uz * out - ux * side));
      if (at) return at;
    }
  }
  const x = Math.round(t.x + ux * EXPEDITION_OUT), z = Math.round(t.z + uz * EXPEDITION_OUT);
  return { x, y: Math.max(gen.heightAt(x, z), gen.waterLevelAt?.(x, z) ?? 0), z, facing: Math.atan2(ux, uz) };
}

/** From the map: the army marches for the Sky Kingdom, and you go on with your day. */
export function sendExpedition() {
  const d = this.duilt, st = this.expeditionState();
  if (!st?.ready) return false;
  d.army.sendTo(this.expeditionCampSpot(), d.days, MARCH_DAYS);
  this.ui?.toast({
    kind: 'challenge', title: 'Your army marches for the Sky Kingdom',
    body: `It will make camp below the island in ${MARCH_DAYS} days. They still eat every day on the road — keep your storehouses stocked.`,
  });
  this.ui?.duiltUI?.renderArmy?.();
  this.editedAt = Date.now();
  return true;
}

/** The march is over: tents and a fire on the ground below the Sky Kingdom, and that's where you wake now. */
export function makeExpeditionCamp() {
  const d = this.duilt, c = d.army.camp;
  if (!c) return;
  const { x, z } = c;
  const gen = this.world.gen;
  // The ground cleared first (seen: a camp pitched in the canopy of a
  // forest, and you joining it inside a tree): everything standing on it,
  // round the fire and out to where you'll arrive, is cut down.
  for (let dx = -CAMP_CLEAR; dx <= CAMP_CLEAR; dx++) {
    for (let dz = -CAMP_CLEAR; dz <= CAMP_CLEAR; dz++) {
      if (dx * dx + dz * dz > CAMP_CLEAR * CAMP_CLEAR) continue;
      const g = gen.heightAt(x + dx, z + dz);
      if (gen.waterLevelAt?.(x + dx, z + dz)) continue;
      for (let by = g; by < g + 18; by++) {
        if (this.world.getBlock(x + dx, by, z + dz) !== AIR) this.world.setBlock(x + dx, by, z + dz, AIR);
      }
    }
  }
  // Each piece on its own column's ground, however the land slopes.
  const put = (bx, bz, id) => {
    const by = gen.heightAt(bx, bz);
    this.world.setBlock(bx, by, bz, id);
    return { x: bx, y: by, z: bz };
  };
  // Three tents in a row, a fire in front of them, a black banner each end.
  const tents = [-3, 0, 3].map((dx) => {
    put(x + dx, z + 3, WAR_TENT_BACK); // two blocks long: the back behind the flap
    return put(x + dx, z + 2, turned(WAR_TENT, 0));
  });
  put(x, z - 1, CAMPFIRE);
  put(x - 5, z + 2, BLACK_BANNER); put(x + 5, z + 2, BLACK_BANNER);
  d.spawn = tents[1];
  this.remeshDirty();
  this.ui?.toast({ kind: 'challenge', title: 'Your army has made camp below the Sky Kingdom', body: 'Join it from the map. You\'ll wake at its tents now, too.' });
  this.ui?.duiltUI?.renderArmy?.();
  this.editedAt = Date.now();
}

/** From the map: to the army's camp, below the Sky Kingdom. */
export function joinExpedition() {
  const c = this.duilt?.army.camp;
  if (!c || !this.expeditionState()?.camped) return false;
  this.player.flying = false;
  // In front of the camp, on the island's side, clear of the ranks round the fire.
  const f = this.duilt.army.anchor?.facing ?? 0;
  const jx = Math.floor(c.x - Math.sin(f) * 8), jz = Math.floor(c.z - Math.cos(f) * 8);
  this.player.teleport(jx + 0.5, this.world.gen.heightAt(jx, jz) + 0.5, jz + 0.5);
  const at = skyAt(this.world.gen), p = this.player.position;
  this.player.yaw = Math.atan2(-(at.x - p.x), -(at.z - p.z));
  this.player.pitch = 0.35;
  this.ui?.toast({ kind: 'challenge', title: 'You join your army at its camp', body: `${this.duilt.army.total} warriors, holding. Order them on from the ⚔ banner.` });
  return true;
}

/** An order from the command wheel. */
export function commandArmy(mode) {
  const army = this.duilt?.army;
  if (!army?.active) return;
  if (army.marching) return void this.ui?.toast({ kind: 'xp', title: 'Your army is on the march', body: 'It can\'t hear you from here — join it at its camp when it arrives' });
  if (army.camp && army.away(this.player.position)) return void this.ui?.toast({ kind: 'xp', title: 'Your army is at its camp', body: 'It can\'t hear you from here — join it from the map' });
  army.command(mode, this.player.position, this.player.yaw);
  this.ui?.toast({ kind: 'challenge', title: `Your army — ${ARMY_WORDS[mode]}`, body: `${army.total} warriors` });
  this.ui?.duiltUI?.renderArmy?.();
}

/** The army each frame: marching, fighting, and once a day, eating. */
export function tickArmy(dt) {
  const d = this.duilt;
  if (!d || d.sandbox || !d.army.active || !this.wanderers) { if (d?.army) d.army.field = d.army.active ? d.army.field : []; return; }
  const p = this.player.position;
  const hostile = this.wanderers.hostile();
  const enemies = this.wanderers.list.filter((e) => WANDERERS[e.kind].hp && !e.dead && !e.done
    && (e.war || e.raider || e.angry || (hostile && e.kind === 'bandit') || (WANDERERS[e.kind].sky && this.wanderers.skyHostile()))
    && Math.hypot(e.x - p.x, e.z - p.z) < 60);
  const before = d.army.total;
  d.army.tick(dt, p, this.player.yaw, enemies, {
    strike: (e, damage, w) => {
      const res = this.wanderers.hit(e, damage, w.x, w.z);
      if (res?.killed) d.collect(res.drops);
    },
  });
  // The expedition: the day it reaches the Sky Kingdom, it makes camp.
  if (d.army.update(d.days) === 'arrived') this.makeExpeditionCamp();
  const meal = d.army.eat(d.days, (n) => this.takeRations(n));
  if (meal?.deserted) {
    this.ui?.toast({ kind: 'xp', title: `${meal.deserted} of your warriors deserted`, body: `There wasn't enough to eat — ${meal.got} of ${meal.need} rations. Keep food in your bag or storehouses.` });
  }
  if (d.army.total !== before || meal) this.ui?.duiltUI?.renderArmy?.();
  if (!d.army.total && before) this.ui?.toast({ kind: 'xp', title: 'Your army is gone', body: 'Every last warrior has fallen or walked away' });
}

/** Up to n food for the army, cheapest first: from your bag, then your storehouses. */
export function takeRations(n) {
  const d = this.duilt;
  const foods = ITEMS.filter((i) => i.kind === 'food').sort((a, b) => (a.feeds ?? 0) - (b.feeds ?? 0));
  let got = 0;
  for (const inv of [d.inventory, ...d.structures.stores().map((s) => s.store)]) {
    for (const f of foods) {
      if (got >= n) return got;
      const take = Math.min(n - got, inv.countOf(f.id));
      if (take > 0) { inv.remove(f.id, take); got += take; }
    }
  }
  return got;
}

/** The war horn: call the next round now, when you're ready for it. */
export function blowHorn() {
  const d = this.duilt;
  if (!d || d.sandbox) return;
  this.sound?.horn();
  const war = d.war;
  if (!war.atWar) {
    this.ui?.toast({ kind: 'xp', title: 'Your horn sounds over the hills', body: war.stage === 'won' ? 'Nobody answers. The war is over.' : 'Nobody answers — the Stone Kingdom isn\'t at war with you.' });
    return;
  }
  if (war.stage === 'fighting') {
    this.ui?.toast({ kind: 'xp', title: 'They\'re already here', body: `Round ${war.round} is at your walls` });
    return;
  }
  if (war.horn(d.days)) {
    this.ui?.toast({ kind: 'challenge', title: 'You sounded the war horn', body: `Round ${war.round} of ${LAST_ROUND} answers. They'll come in about a minute.` });
  } else {
    this.ui?.toast({ kind: 'xp', title: 'They\'re already coming', body: `Round ${war.round} is on its way` });
  }
}

// ---- the catapult (Phase 6c) ------------------------------------------------
//
// Chosen directly: "a buildable siege engine you aim and fire. Stones fly
// on real arcs and break blocks where they land." Place takes hold of it;
// you aim by looking where you want the stone to come down — the arc and
// a ring show where it will — and Break throws. Place again, or walking
// off, lets go.

export function manCatapult(hit) {
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

export function letGo() {
  this.manning = null;
  this.projectileView.setAim(null);
  this.ui?.setBuildingHint(null);
  this.ui?.setActionLabels(...this.ui.defaultActionLabels());
}

/** Where a stone leaves the catapult: its cup. */
export function cupOf({ x, y, z }) {
  return { x: x + 0.5, y: y + 1.35, z: z + 0.5 };
}

/**
 * Where you're aiming: the first solid thing along your look, as far as
 * the catapult can throw — or, looking at open sky, its longest throw
 * that way. Never nearer than CATAPULT_MIN_THROW, so it can't be made to
 * drop a stone on your own head.
 */
export function catapultTarget(from) {
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
export function tickCatapult(dt) {
  this.projectiles?.tick(dt);
  this.arrows?.tick(dt);
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
export function catapultAmmo() {
  if (!this.duilt || this.duilt.sandbox) return { id: 'stone', count: '∞', name: 'stone' };
  for (const id of CATAPULT_AMMO) {
    const count = this.duilt.inventory.countOf(id);
    if (count > 0) return { id, count, name: itemName(id).toLowerCase() };
  }
  return null;
}

export function throwStone() {
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
  this.sound?.catapult();
}

/**
 * A stone coming down: a crater of blocks knocked out, and a heavy blow
 * to anyone standing there. Your own claimed buildings, chests and
 * bedrock are spared — a stone thrown at a camp shouldn't cost you the
 * storehouse it happened to clip on the way.
 */
export function stoneLands(landed, stone = {}) {
  const c = { x: landed.cell.x + 0.5, y: landed.cell.y + 0.5, z: landed.cell.z + 0.5 };
  // Your crew's stones hurt the enemy where they land, and nothing else.
  if (stone.crew) {
    this.sound?.boom?.({ x: c.x, z: c.z });
    for (const p of this.wanderers?.list ?? []) {
      if (!WANDERERS[p.kind].hp || p.dead || !(p.war || p.raider || p.angry)) continue;
      if (Math.hypot(p.x - c.x, p.z - c.z) < 2.5 && Math.abs(p.y - c.y) < 3) this.defenderHits(p, blowOf(stone.crew, STONE_HITS), stone.crew);
    }
    return;
  }
  // The enemy's stones are thrown at your buildings, and break them.
  if (stone.enemy) {
    this.siegeBreak(craterCells(this.world, c));
    if (Math.hypot(this.player.position.x - c.x, this.player.position.z - c.z) < 2.2
      && Math.abs(this.player.position.y - c.y) < 3) this.duilt?.hurt(6, 'army');
    return;
  }
  let broke = 0;
  for (const { x, y, z, id } of craterCells(this.world, c)) {
    if (this.world.isIndestructible(x, y, z) || isChest(id) || isFluid(id)) continue;
    if (this.duilt?.structures.at(x, y, z)) continue;
    this.world.setBlock(x, y, z, AIR);
    broke++;
  }
  if (broke) this.remeshDirty();
  this.sound?.boom?.({ x: c.x, z: c.z });

  const near = (o, r) => Math.hypot(o.x - c.x, o.z - c.z) < r && Math.abs(o.y - c.y) < 3;
  for (const p of this.wanderers?.list ?? []) {
    if (!WANDERERS[p.kind].hp || !near(p, 2.5)) continue;
    const res = this.wanderers.hit(p, STONE_HITS, c.x, c.z);
    if (res?.killed) {
      this.personKilled(p);
      const gained = this.duilt?.collect(res.drops) ?? {};
      const got = Object.entries(gained).map(([id, n]) => `+${n} ${itemName(id).toLowerCase()}`).join(', ');
      this.ui.toast({ kind: 'xp', title: `The stone got ${p.name}, a bandit`, body: got || undefined });
    }
  }
  for (const mob of this.mobs?.list ?? []) {
    if (mob.dying || !near(mob, 2.5)) continue;
    const res = this.mobs.hit(mob, STONE_HITS, c.x, c.z);
    if (res.killed) {
      if (!mob.penId) {
        this.gamification.onKill({ kind: 'mob', hp: MOBS_BY_ID.get(mob.type)?.hp ?? 0 });
        this.duilt?.note('hunt', mob.type);
      }
      this.duilt?.collect(res.drops);
    }
  }
  if (near(this.player.position, 2)) this.duilt?.hurt(8, 'catapult');
}
