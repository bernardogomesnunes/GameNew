// Saving and uploading a world: autosave on leave, local and cloud saves,
// the unsent copy and its retries. Moved out of Game.js (TECH-10); every
// function runs with `this` set to the Game, which delegates to it.
import { World } from '../world/World.js';
import { ChunkGen } from '../world/ChunkGen.js';
import { putBackup, getBackup, dropBackup } from '../storage/BackupStore.js';

/**
 * The one world whose upload has not landed yet. Not a library — see keepSafe.
 */
const UNSENT_KEY = 'voxelgame:unsent';

const makeChunkGen = (o) => new ChunkGen(o);

/** Everything about a world that has to survive, as plain JSON. */
function serialiseWorldState({ world, mode, economy, duilt, territoryBounds, player }) {
  // Where you stand rides along: the unsent copy that goes up later must not
  // overwrite the account's saved position with nothing.
  const at = player?.position;
  return { world: world.serialize({ keepBounds: territoryBounds }), mode, economy: economy?.toJSON?.() ?? {}, duilt: duilt ?? null,
    ...(at ? { player: { x: at.x, y: at.y, z: at.z, yaw: player.yaw, pitch: player.pitch } } : {}) };
}

/** The longest a manual save waits for upload confirmation before offering a retry. */
const LEAVE_SAVE_WAIT_MS = 15000;
/** After an upload fails, the first try again; each one after waits twice as long, up to the second. */
const UPLOAD_RETRY_MS = 30_000, UPLOAD_RETRY_MAX_MS = 5 * 60_000;
// SAVE-7: how long a caller waits for the unsent copy, how many failed tries
// before it stops by itself, and how long it waits while a world opens.
const UNSENT_WAIT_MS = 20_000, UNSENT_MAX_TRIES = 3, UNSENT_LATER_MS = 15_000;
const UNSENT_TRIES_KEY = 'voxelgame:unsent-tries';

/** Failed tries for this one copy (a world id and when it was put aside). */
function unsentTries(held) {
  try {
    const t = JSON.parse(localStorage.getItem(UNSENT_TRIES_KEY) || 'null');
    return t?.worldId === held.worldId && t?.at === held.at ? t.tries : 0;
  } catch { return 0; }
}
function setUnsentTries(held, tries) {
  try {
    if (tries) localStorage.setItem(UNSENT_TRIES_KEY, JSON.stringify({ worldId: held.worldId, at: held.at, tries }));
    else localStorage.removeItem(UNSENT_TRIES_KEY);
  } catch { /* private window */ }
}

/**
 * Whether the account's copy of a world (`mine`, from the world list) is newer
 * than the one this device last agreed on: somebody saved it elsewhere since.
 * Uploading then would write an older world over a newer one.
 */
export function staleAgainst(mine, agreed) {
  return !!(mine && agreed && Number(mine.revision) > Number(agreed.revision));
}

/** The work behind Game.sendUnsent: one copy, one try. */
async function sendHeldCopy(game) {
  let held = null;
  try { held = JSON.parse(localStorage.getItem(UNSENT_KEY) || 'null'); } catch { held = null; }
  // Too big for localStorage, it went to the bigger store (keepSafe).
  held ??= await getBackup();
  if (!held?.worldId || !held.state) return false;
  const tries = unsentTries(held);
  if (tries >= UNSENT_MAX_TRIES) return false;
  let mine;
  try {
    const list = await game.cloudList({ maxAgeMs: 0 });
    mine = list.find((w) => w.id === held.worldId) ?? null;
  } catch {
    return false;   // no connection: not counted, it keeps until there is one
  }
  // Keep an absent world's backup without resurrecting a possible delete.
  // Check before rebuilding terrain: a blocked upload needs only metadata.
  if (!mine && game.syncState.agreedFor(held.worldId)) return false;
  // Saved on another device after this copy was put aside: the account has
  // the newer world, and this old copy must not go over it (owner, 9
  // November: logging in on the desktop wrote an Age 8 world over the Age 10
  // one played on the phone). It stays on this device, and is not sent again.
  if (staleAgainst(mine, game.syncState.agreedFor(held.worldId))) {
    setUnsentTries(held, UNSENT_MAX_TRIES);
    game.bus?.emit?.('toast', {
      kind: 'xp', title: 'An older copy was not sent',
      body: `"${held.name ?? 'A world'}" was saved on another device since. That newer save is kept. This copy stays on this device only.`,
    });
    return false;
  }
  try {
    const world = World.deserialize(held.state.world, { makeGen: makeChunkGen });
    const res = await game.cloud.save(held.worldId, {
      world,
      name: held.name,
      mode: held.state.mode,
      player: Number.isFinite(held.state.player?.y)
        ? { position: { x: held.state.player.x, y: held.state.player.y, z: held.state.player.z }, yaw: held.state.player.yaw, pitch: held.state.player.pitch }
        : null,
      gamification: null,
      economy: { toJSON: () => held.state.economy ?? {} },
      duilt: held.state.duilt,
      revision: (mine?.revision ?? 0) + 1,
    });
    game.syncState.agree(held.worldId, res.revision);
    setUnsentTries(held, 0);
    // Only this world's copy: one put aside for another world meanwhile stays.
    game.dropSafeCopy(held.worldId);
    game.forgetCloudList();
    return true;
  } catch {
    setUnsentTries(held, tries + 1);
    if (tries + 1 >= UNSENT_MAX_TRIES) {
      game.bus?.emit?.('toast', {
        kind: 'xp', title: 'An old copy could not be sent',
        body: `"${held.name ?? 'A world'}" failed ${UNSENT_MAX_TRIES} times, so it is no longer sent at start-up. It stays on this device until you save that world again.`,
      });
    }
    return false;
  }
}

const KEPT_FAILURES = 'duilt:cloud-failures';

/** Saves that failed, kept on the device: the last 20, with time and detail. */
export function keepFailure(worldId, err, store = globalThis.localStorage) {
  try {
    const list = JSON.parse(store.getItem(KEPT_FAILURES) ?? '[]');
    list.push({ at: new Date().toISOString(), worldId, status: err?.status ?? null, message: String(err?.detail ?? err?.message ?? err).slice(0, 300) });
    store.setItem(KEPT_FAILURES, JSON.stringify(list.slice(-20)));
  } catch { /* a full or blocked storage loses only the diagnosis */ }
}

/** Sends the kept failures to the account's log, then forgets them. */
export async function sendKeptFailures(cloud, store = globalThis.localStorage) {
  let list;
  try { list = JSON.parse(store.getItem(KEPT_FAILURES) ?? '[]'); store.removeItem(KEPT_FAILURES); } catch { return 0; }
  if (!cloud || !Array.isArray(list)) return 0;
  for (const f of list) {
    await cloud.reportFailure(f.worldId, { status: f.status, message: `[kept ${f.at}] ${f.message}` }).catch(() => {});
  }
  return list.length;
}

export function wireSaveOnLeave() {
  // Context loss has several possible causes; it is not an out-of-memory measurement.
  this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    this.crashed('The graphics connection was lost. Reload to reconnect.', { kind: 'webgl-context-lost', error: e.statusMessage || 'Graphics context lost' });
  });
  const save = () => {
    const queued=this.saveNow();
    if(this.worldIsLocal&&!this.discarded&&this.worldId&&this.local.saveEmergency){
      try{this.local.saveEmergency(this.worldId,{...this.saveState(),name:this.worldName});}
      catch{/* The last committed IndexedDB world and pending write remain intact. */}
    }
    return queued;
  };
  // Put away, the buildings stop working until it's back (DuiltGame.pauseClock).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { this.duilt?.pauseClock(); save(); }
    else this.duilt?.resumeClock();
  });
  window.addEventListener('pagehide', () => { this.duilt?.pauseClock(); save(); });
  // Back online: what's waiting goes up now, not at the next try.
  window.addEventListener('online', () => { this.flush().catch(() => {}); });
  // Run is on Ctrl (asked for directly), and Ctrl+W closes a browser tab —
  // a page can't stop that, but it can ask first. Only while you're
  // playing with the mouse taken (a keyboard); the world is saved either way.
  window.addEventListener('beforeunload', (e) => {
    save();
    const localPending=this.worldIsLocal&&this.saving&&!this.discarded;
    if (!localPending&&(!this.isPlaying || !this.pointerLocked)) return;
    e.preventDefault();
    e.returnValue = '';
  });
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
export function discardCurrentWorld() {
  this.discarded = true;
  this.pendingSave = false;
  clearTimeout(this.retryTimer);
  this.uploadTrouble = false;
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
/**
 * Saves (or not) on the way out. A cloud save is waited for — up to
 * LEAVE_SAVE_WAIT_MS, so a bad connection offers a retry — so Save
 * and leave can show it saving (asked for directly: "when saving the button
 * should have a loading indication"). Whatever hasn't gone up by then is
 * kept aside (keepSafe) and sent the next time.
 */
export async function leaveWorld(save = true) {
  if (!save) { this.discarded = true; this.releaseWorldSession?.(); return false; }
  // The showcase is never saved (openShowcase), so there's nothing to wait
  // for: Save and leave used to call that a failed save and keep you in it.
  if (this.showcase) return true;
  const saved = await this.saveAndWait();
  if (saved) this.releaseWorldSession?.();
  return saved;
}

/**
 * Saves, waiting for a cloud save as leaving does, and stays (reported
 * directly: "Saving loads the button and then shows the loading of the
 * beginning of the game" — the only Save was Save and leave). Whether it
 * got saved.
 */
export async function saveAndWait() {
  if (this.showcase) {
    this.saveError = 'The showcase is never saved: it is built the same again every time it opens.';
    return false;
  }
  // The Save button says how it went itself: see uploadFailed.
  this.savingByHand = true;
  const ok = this.saveNow();
  if (!ok) { this.savingByHand = false; return false; }
  if (!this.saving) { this.savingByHand = false; return !this.saveError; }
  let timer;
  try {
    const saved = await Promise.race([
      Promise.resolve(this.saving).catch(() => false),
      new Promise((resolve) => { timer = setTimeout(() => resolve(false), LEAVE_SAVE_WAIT_MS); }),
    ]);
    return saved === true && !this.saveError;
  } finally {
    clearTimeout(timer);
    this.savingByHand = false;
  }
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
 * Returns whether work was accepted; this.saving confirms queued local or
 * cloud persistence. Save and leave and crash recovery await that result.
 */
export function saveNow() {
  // The autosave's clock starts again from any save. It was set once, at
  // startup, and never again — so five minutes in, every frame saved: a
  // copy of the whole world into the browser and another upload, sixty
  // times a second (found looking into a pickaxe's wear coming back new,
  // and very likely behind the phone running out of memory as well).
  this.lastAutosave = performance.now();
  if (this.discarded || !this.worldId) return false;
  if (this.worldIsLocal) return this.saveLocally();
  if (!this.cloud?.signedIn) return false;
  this.pendingSave = true;
  this.keepSafe();
  this.flush().catch(() => { /* reported by flush; retried by the next save */ });
  return true;
}

/** The local half of saveNow — see its own note on why the two never mix. */
export function saveLocally() {
  const id=this.worldId,world=this.world;
  const failed=err=>{
    if(this.worldId!==id||this.world!==world)return false;
    this.saveError=err?.message??'Could not save in this browser.';
    if(!this.toldSaveError){
      this.toldSaveError=true;
      this.bus.emit('toast',{kind:'xp',title:'Not saved',body:this.saveError});
    }
    return false;
  };
  try {
    const result = this.local.save(this.worldId, {
      world: this.world,
      name: this.worldName,
      mode: this.mode,
      player: this.player,
      duilt: this.duilt ? this.duilt.toJSON() : null,
      economy: this.economy,
      territoryBounds: this.duilt ? this.duilt.territory.keptBounds() : null,
    });
    if(result&&typeof result.then==='function'){
      const progression=this.gamification.toJSON();
      const saving=Promise.resolve(result).then(committed=>{
        if(!committed)throw new Error('The local save did not complete.');
        if(this.worldId===id&&this.world===world){
          this.local.saveProgression(progression);this.saveError=null;
          this.ui?.home?.forgetWorlds?.();
        }
        return true;
      }).catch(failed);
      this.saving=saving;
      saving.then(()=>{if(this.saving===saving)this.saving=null;});
      return true;
    }
    this.local.saveProgression(this.gamification.toJSON());
    this.saveError = null;
    this.ui?.home?.forgetWorlds?.();
    return !!result;
  } catch (err) {
    // A failed background transaction retains the previous local save and
    // identity. Sign-in migration removes it only after a confirmed upload.
    if(this.local.store&&!this.local.storageError)return failed(err);
    // Signed in, a full browser is no reason to lose the world: it goes up
    // to the account instead, where it should have been anyway (reported
    // directly: "this browser does not have more memory").
    if (this.cloud?.signedIn) {
      this.worldIsLocal = false;
      this.local.delete(this.worldId);
      this.bus.emit('toast', { kind: 'challenge', title: 'Moved to your account', body: 'This browser was full, so the world is kept in your account now.' });
      return this.saveNow();
    }
    this.saveError = err?.message ?? 'Could not save in this browser.';
    // Once a session: a browser that's out of room says so, but not on every autosave.
    if (!this.toldSaveError) {
      this.toldSaveError = true;
      this.bus.emit('toast', { kind: 'xp', title: 'Not saved', body: this.saveError });
    }
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
export async function flush() {
  if (!this.pendingSave || this.discarded || !this.cloud?.signedIn) return false;
  if (this.saving) return this.saving;

  const id = this.worldId;
  this.saving = (async () => {
    try {
      const list = await this.cloudList({ maxAgeMs: 0 });
      // Left while the list was on its way: Leave puts the title scene up
      // at once, so what's loaded now is another world — and uploading it
      // is how the title scene once landed in an account as a world called
      // "Title", in place of the world just left. That one went aside whole
      // at saveNow (keepSafe); it's that copy that goes up.
      if (this.worldId !== id) return await this.sendUnsent();
      const mine = list.find((w) => w.id === this.worldId) ?? null;
      const agreed = this.syncState.agreedFor(this.worldId);
      // Absence is not proof of deletion (the account/list may have changed).
      // Don't recreate a previously saved world, but keep its backup and
      // allow the next ordinary save to check again. Explicit deletion is
      // handled separately by onDeleteWorld.
      if (!mine && agreed) {
        this.saveError = 'This world was not found in the current account. It has not been recreated and your pending backup has not been removed. Check that you are in the right account and try saving again. Your changes stay on this device.';
        // Not tried again by itself: it's the account to check, not the connection.
        this.uploadFailed({ retry: false });
        return false;
      }
      // Somebody else saved this world since we opened it. It used to go
      // up anyway, and an old session on one device wrote an Age 8 world
      // over the Age 10 one played on another (owner, 9 November). The
      // newer save is kept now: nothing goes up, and the copy put aside by
      // keepSafe stays on this device.
      if (staleAgainst(mine, agreed)) {
        this.saveError = 'This world was saved on another device after you opened it here. That newer save is kept. Reload to play it; changes made here stay on this device only.';
        this.uploadFailed({ retry: false });
        return false;
      }
      // Taken over by another tab or device since the last heartbeat: not
      // a word more goes up from here.
      if (!await this.checkWorldSession()) return false;
      await this.saveToCloud(this.worldName, { quiet: true, revision: (mine?.revision ?? 0) + 1 });
      this.pendingSave = false;
      this.saveError = null;
      this.dropSafeCopy();
      this.ui?.home?.forgetWorlds?.();
      this.uploadLanded();
      sendKeptFailures(this.cloud);
      return true;
    } catch (err) {
      // Left pending on purpose: the next save tries again, and the copy put
      // aside by keepSafe outlives a closed tab.
      this.saveError = err?.message ?? 'The account did not answer.';
      // Best effort, and never awaited: a broken save_failures write must
      // never be the reason a retry gets delayed.
      this.cloud?.reportFailure(this.worldId, err).catch(() => {});
      // That report needs a working sign-in, which is the thing most often
      // missing (PLAY-1: nothing was logged on 22 November). Kept here too,
      // and sent once an upload lands.
      keepFailure(this.worldId, err);
      // Nothing is lost meanwhile: the copy keepSafe put aside survives a closed tab,
      // and sendUnsent sends it the next time the game starts.
      this.uploadFailed();
      return false;
    } finally {
      this.saving = null;
    }
  })();
  return this.saving;
}

/**
 * An upload didn't land (SAVE-4: "failed uploads retry without telling
 * you"). Said once, not on every try: a "not saved" every few minutes was
 * noise (backlog batch 2). And tried again soon, not at the next autosave
 * five minutes on — half a minute, then twice as long each time, up to
 * five — unless it's not the connection (`retry` false).
 */
export function uploadFailed({ retry = true } = {}) {
  if (!this.uploadTrouble) {
    this.uploadTrouble = true;
    if (!this.savingByHand) {
      this.bus.emit('toast', {
        kind: 'xp', title: 'Not saved to your account yet',
        body: retry ? `${this.saveError} Your world is kept on this device, and it tries again by itself.` : this.saveError,
      });
    }
  }
  clearTimeout(this.retryTimer);
  if (!retry) return;
  const tries = this.uploadTries ?? 0;
  this.uploadTries = tries + 1;
  this.retryTimer = setTimeout(() => { this.flush().catch(() => {}); }, Math.min(UPLOAD_RETRY_MAX_MS, UPLOAD_RETRY_MS * 2 ** tries));
}

/** An upload landed: no more tries, and if it had been failing, say it's up now. */
export function uploadLanded() {
  clearTimeout(this.retryTimer);
  this.uploadTries = 0;
  if (!this.uploadTrouble) return;
  this.uploadTrouble = false;
  if (!this.savingByHand) this.bus.emit('toast', { kind: 'xp', title: 'Saved to your account', body: 'The changes that were waiting went up.' });
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
export function keepSafe() {
  const record = { worldId: this.worldId, name: this.worldName, at: Date.now(), state: serialiseWorldState(this.saveState()) };
  try {
    localStorage.setItem(UNSENT_KEY, JSON.stringify(record));
    // One that went to the bigger store before is older than this now.
    dropBackup();
    return;
  } catch { /* out of room: below */ }
  // Too big for this browser's small store (SAVE-5). An older, smaller copy
  // left there would be sent in place of this one, so it goes, and this one
  // goes to the bigger store (storage/BackupStore.js).
  try { localStorage.removeItem(UNSENT_KEY); } catch { /* private window */ }
  putBackup(record).then((kept) => {
    if (kept || this.toldNoBackup) return;
    this.toldNoBackup = true;
    this.bus.emit('toast', {
      kind: 'xp', title: 'No backup on this device',
      body: 'This world is too big to keep a copy here. Stay connected until it says it\'s saved.',
    });
  });
}

/** Throws the unsent copy away — only if it is world `id`'s, when one is given. */
export function dropSafeCopy(id = null) {
  dropBackup(id);
  try {
    if (id && JSON.parse(localStorage.getItem(UNSENT_KEY) || 'null')?.worldId !== id) return;
    localStorage.removeItem(UNSENT_KEY);
  } catch { /* private window */ }
}

/**
 * Anything that never made it up last time goes up now.
 *
 * SAVE-7: this must never stall the game. Rebuilding the copy is a whole
 * world's worth of work on the main thread, so it waits while a world is
 * being opened, runs once at a time (sign-in and startup both ask), and a
 * caller waits at most UNSENT_WAIT_MS for it. A copy that fails
 * UNSENT_MAX_TRIES times with the account answering is not tried again by
 * itself; it stays on the device until a newer copy replaces it.
 */
export function sendUnsent() {
  if (!this.cloud?.signedIn) return Promise.resolve(false);
  if (this.loadingWorld) {
    clearTimeout(this.unsentTimer);
    this.unsentTimer = setTimeout(() => { this.sendUnsent().catch(() => {}); }, UNSENT_LATER_MS);
    return Promise.resolve(false);
  }
  if (!this.sendingUnsent) {
    this.sendingUnsent = sendHeldCopy(this).finally(() => { this.sendingUnsent = null; });
  }
  let timer;
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve(false), UNSENT_WAIT_MS); });
  return Promise.race([this.sendingUnsent, late]).finally(() => clearTimeout(timer));
}
