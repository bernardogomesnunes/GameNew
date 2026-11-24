// Opening a world: loading it from this browser or the account, putting it
// into the Game, the loading screen over it, and the state handed to a save.
// Moved out of Game.js (TECH-10); every function runs with `this` set to the
// Game, which delegates to it.
import { PlayerController } from '../player/PlayerController.js';
import { GamificationEngine } from '../gamification/GamificationEngine.js';
import { EconomyEngine } from '../economy/EconomyEngine.js';
import { SymmetryTool } from '../tools/SymmetryTool.js';
import { DuiltGame } from '../duilt/DuiltGame.js';
import { earnedLines } from '../duilt/Notices.js';
import { itemName } from '../config/items.js';
import { MORNING } from '../render/DayCycle.js';
import { restoreWorldSnapshot } from '../storage/WorldSnapshot.js';
import { loadingShow, loadingProgress, loadingDone, nextPaint, followDrawing } from '../ui/loading.js';
// Game.js imports this file and this file imports Game.js: both only use each
// other inside functions, after both modules have loaded.
import { CREATIVE, DUILT } from '../Game.js';

/** A fresh id for a world: local and cloud ids come from the same generator. */
export function newWorldId() {
  return crypto.randomUUID();
}

/**
 * Whether saved progression `a` is further along than `b`. By level first:
 * `xp` is only what's been earned towards the next level, so comparing it
 * alone called a level-1 player with 40 xp "ahead of" a level-9 one with 23,
 * and the account's goals were swapped for a beginner's.
 */
export function progressionAhead(a, b) {
  const la = a?.level ?? 1, lb = b?.level ?? 1;
  return la !== lb ? la > lb : (a?.xp ?? 0) > (b?.xp ?? 0);
}

/**
 * The loading screen over a world being made, opened or left (asked for
 * directly: "a loading on the create world like a loading as we have in
 * the beginning"). It goes up and is drawn before `work`, which holds
 * everything up while it runs; then the bar follows the land round you
 * being drawn, made faster under it as at the start (see `booting`).
 * Gone once that's done, or at once if `work` came to nothing.
 */
export async function withLoading(label, work, { world = true } = {}) {
  // SAVE-7: an unsent copy waits until this is done (sendUnsent).
  this.loadingWorld = (this.loadingWorld ?? 0) + 1;
  loadingShow(label, { world });
  await nextPaint();
  try {
    const ok = await work();
    if (ok === false) return ok;
    loadingProgress(50, 'Drawing the land…');
    this.booting = true;
    // Back to the worlds screen: only what its camera sees first (titleProgress).
    await followDrawing(() => (this.title ? this.titleProgress() : this.drawnAround(this.player?.position)), { from: 50 });
    return ok;
  } finally {
    this.booting = false;
    loadingDone();
    this.loadingWorld -= 1;
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
export async function openWorld(id) {
  if (!id) return false;
  // What you were in goes up (or gets written down) before you leave it,
  // or opening a second world throws away the first one's afternoon.
  if (this.worldIsLocal&&!this.discarded) {
    if(!this.saveLocally()||(this.saving&&await this.saving!==true))return false;
  } else if(!this.worldIsLocal) await this.flush();
  try{await this.local.refresh?.();}
  catch(error){
    if(!this.local.has(id)&&!this.cloud?.signedIn){this.ui.toast({kind:'xp',title:'Could not open that world',body:error.message});return false;}
  }

  if (this.local.has(id)) {
    try {
      await this.restoreFromLocal(id);
      return true;
    } catch (err) {
      this.ui.toast({ kind: 'xp', title: 'Could not open that world', body: err.message });
      return false;
    }
  }
  if (!this.cloud?.signedIn) {
    this.ui.toast({ kind: 'xp', title: 'Sign in to open this world',
      body: 'This world lives on your account, and this browser is not signed in right now.' });
    return false;
  }
  try {
    return (await this.restoreFromCloud(id)) !== false;
  } catch (err) {
    this.ui.toast({ kind: 'xp', title: 'Could not open that world', body: err.message });
    return false;
  }
}

/**
 * What the account is holding, from a moment ago if we asked a moment ago.
 *
 * The worlds screen asks on the way in, and then opening a world asks again
 * one tap later. Without this that is two round trips, and the second one is
 * in front of the player while they wait to start playing.
 */
export async function cloudList({ maxAgeMs = 15_000 } = {}) {
  if (!this.cloud?.signedIn) return [];
  const now = Date.now();
  if (this.cloudListCache && now - this.cloudListCache.at < maxAgeMs) return this.cloudListCache.rows;
  const rows = await this.cloud.list();
  this.cloudListCache = { at: now, rows };
  return rows;
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
export function saveState() {
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
    territoryBounds: this.duilt ? this.duilt.territory.keptBounds() : null,
  };
}

export function loadFromData(data, { silent } = {}) {
  this.endSleep();
  this.world = data.world;
  this.showcase = null;
  this.title = null;
  // Nothing is open for changes in a world you've only just entered.
  this.editingStructure = null;
  this.updateEditOutline?.();
  this.ui?.clearEditingBanner?.();
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
  this.wireFlight();
  this.player.binds = { ...this.controls.keys };
  this.player.view = this.controls.view ?? 'first';
  this.player.autoJump = this.controls.autoJump === 'on';
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
  this.configureVillagerJobs();
  if (data.duilt) {
    const earned = this.duilt.loadJSON(data.duilt);
    if (earned && Object.keys(earned).length && this.ui) {
      // The biggest few on the toast; every one of them in Notifications.
      const { short, full } = earnedLines(earned, itemName);
      setTimeout(() => this.ui.toast({
        kind: 'challenge', title: 'Your buildings kept working', body: short, full,
      }), 600);
    }
  }
  if (sandbox) this.duilt.grantCreativeKit();
  // CRAFT-9 part 4: an older world past Age 3 was given a Mason's Bench on load.
  if (this.duilt.gifted && this.ui) setTimeout(() => this.ui.toast({ kind: 'challenge', title: "A Mason's Bench, in your bag",
    body: 'Walls, pillars, chimneys and shaped roofs are chiselled at it now. Place it and tap the chalk marks.' }), 900);
  // The world's clock picks up where it was left.
  if (this.dayCycle) this.dayCycle.time = this.duilt.dayTime ?? MORNING;
  this.gamification.setDuilt(this.duilt);
  this.applyTerritoryBounds();
  // Saved with its age's goals all met but the age never moved on (a ring
  // forged last, before forging checked — reported directly: "ive finish
  // age seven and cant progress to 8"): it moves on as it opens.
  if (!sandbox) this.duilt.checkAgeAdvance();
  this.rebuildAllChunks();
  if (this.ui) {
    this.ui.updateXp();
    this.ui.refreshForMode();
    if (!silent) this.ui.toast({ kind: 'xp', title: 'World loaded', body: this.worldName });
  }
}

/**
 * Pushes the current world under its own id, so repeated saves overwrite the
 * same cloud world instead of littering it with copies.
 */
export async function saveToCloud(name, { quiet = false, revision } = {}) {
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
    territoryBounds: this.duilt ? this.duilt.territory.keptBounds() : null,
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

export async function restoreFromCloud(id, { silent = false } = {}) {
  if (!this.cloud) throw new Error('This build has no cloud configured.');
  if (!await this.takeWorldSession(id)) return false;
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
    if (remote && progressionAhead(remote, this.gamification.toJSON())) {
      this.gamification.loadJSON(remote);
      this.ui.updateXp();
    }
  } catch { /* the world is what matters; progression can wait for the next sign-in */ }
  if (!silent) {
    this.ui.closePanel('panel-menu');
  }
}

/** The local half of restoreFromCloud — see openWorld for how the two get told apart. */
export async function restoreFromLocal(id, { silent = false } = {}) {
  const data = await this.local.restore(id);
  const world = restoreWorldSnapshot(data.world);
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
  if (local && progressionAhead(local, this.gamification.toJSON())) {
    this.gamification.loadJSON(local);
    this.ui?.updateXp();
  }
  if (!silent) {
    this.ui.closePanel('panel-menu');
  }
}
