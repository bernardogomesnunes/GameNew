/**
 * Which copy of a world wins, and when.
 *
 * Worlds were saved to whichever browser you were sitting at. The cloud was a
 * button you could press and a question at world creation — so signing in on a
 * phone and a desktop gave you an account with two separate piles of worlds and
 * nothing joining them up. That is the bug this exists to fix.
 *
 * The rule now is that a signed-in player's worlds live on the account, and
 * every device keeps a local copy of the ones it has opened. Which leaves one
 * genuinely hard question, and it is the only thing in here:
 *
 *   this device has a copy, the account has a copy, they are not the same —
 *   what happens?
 *
 * Picking the newest timestamp is the obvious answer and it is wrong, because
 * clocks on two devices disagree and the cost of being wrong is somebody's
 * afternoon. So the decision is made on *revisions* instead, which only the
 * server hands out, plus one fact each device knows for certain: the revision
 * it last agreed with the server about.
 *
 *   the account has moved on since we last agreed, and we have not touched
 *   ours   -> pull; somebody else played and we are behind
 *   we have touched ours, the account has not moved on
 *          -> push; we are the ones who played
 *   neither                       -> nothing to do
 *   both                          -> conflict, and we ask
 *
 * The last line is the important one. Two devices that both played offline is
 * the case where any automatic choice destroys work, so nothing is chosen: the
 * player is told which is which and picks. Nothing here ever overwrites a copy
 * it has not seen.
 */

const SYNC_KEY = 'voxelgame:sync-state';

/** What a device and the server last agreed on, per world. */
export function loadSyncState(storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage?.getItem(SYNC_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function saveSyncState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(SYNC_KEY, JSON.stringify(state));
  } catch { /* a full quota must not break saving */ }
}

export const PUSH = 'push';
export const PULL = 'pull';
export const IN_SYNC = 'in-sync';
export const CONFLICT = 'conflict';
export const LOCAL_ONLY = 'local-only';
export const CLOUD_ONLY = 'cloud-only';

/**
 * What to do about one world.
 *
 * @param local   { changedAt } or null — the copy on this device
 * @param cloud   { revision, updatedAt } or null — what the account holds
 * @param agreed  { revision, at } or null — what this device last synced
 */
export function decide({ local = null, cloud = null, agreed = null } = {}) {
  if (!local && !cloud) return { action: IN_SYNC, why: 'There is no such world.' };

  // Never been to the account: it is ours to send.
  if (local && !cloud) {
    return agreed
      // We synced it once and it is gone from the account now — deleted on
      // another device. Sending it again would resurrect what somebody binned.
      ? { action: LOCAL_ONLY, why: 'This world was removed from your account somewhere else.' }
      : { action: PUSH, why: 'This world is not on your account yet.' };
  }

  // On the account, not on this device.
  if (!local && cloud) return { action: CLOUD_ONLY, why: 'On your account, not yet on this device.' };

  const cloudMoved = !agreed || cloud.revision > agreed.revision;
  // "Touched" means edited since the last time we agreed with the server.
  // Without an agreement we have to assume we have something worth keeping.
  const localMoved = !agreed || (local.changedAt ?? 0) > (agreed.at ?? 0);

  if (cloudMoved && localMoved) {
    return {
      action: CONFLICT,
      why: 'This world was played on another device as well as this one.',
      local, cloud,
    };
  }
  if (cloudMoved) return { action: PULL, why: 'Your account has a newer copy.' };
  if (localMoved) return { action: PUSH, why: 'This device has changes your account does not.' };
  return { action: IN_SYNC, why: 'Already the same in both places.' };
}

/**
 * One row per world, however many places it lives in.
 *
 * The worlds screen used to draw the local saves and then, underneath, a
 * separate "On your account" list of the ones it could not find locally. Two
 * lists is how a world you have on both ends up looking like two worlds.
 */
export function mergeWorldList({ local = [], cloud = [], agreedFor = () => null, lastOpened = null } = {}) {
  const rows = new Map();

  // Local rows come from SaveManager.list(): one record per world, under the
  // id the world was born with. There is no second local shape to handle any
  // more — no autosave slot, no named copies.
  for (const s of local) {
    if (!s.id) continue;
    rows.set(s.id, {
      id: s.id,
      name: s.name || 'Untitled world',
      mode: s.mode,
      age: s.age,
      changedAt: s.at ?? 0,
      here: true,
      onAccount: false,
    });
  }

  for (const w of cloud) {
    const row = rows.get(w.id);
    if (row) {
      row.onAccount = true;
      row.revision = w.revision;
      row.cloudAt = w.updatedAt;
      row.name = row.name || w.name;
    } else {
      rows.set(w.id, {
        id: w.id,
        name: w.name || 'Untitled world',
        mode: w.mode,
        changedAt: 0,
        cloudAt: w.updatedAt,
        revision: w.revision,
        here: false,
        onAccount: true,
      });
    }
  }

  for (const row of rows.values()) {
    if (row.action) continue;   // a save with no id has already been settled
    row.action = decide({
      local: row.here ? { changedAt: row.changedAt } : null,
      cloud: row.onAccount ? { revision: row.revision, updatedAt: row.cloudAt } : null,
      agreed: row.id ? agreedFor(row.id) : null,
    }).action;
  }

  // Most recently touched first, wherever that happened, with the world you
  // were last in kept at the top of the pile.
  for (const row of rows.values()) row.isLast = !!lastOpened && row.id === lastOpened;
  return [...rows.values()].sort((a, b) =>
    (b.isLast ? 1 : 0) - (a.isLast ? 1 : 0)
    || Math.max(b.changedAt ?? 0, b.cloudAt ?? 0) - Math.max(a.changedAt ?? 0, a.cloudAt ?? 0));
}

/** The per-world record of what this device and the server last agreed. */
export class SyncState {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.state = loadSyncState(storage);
  }

  agreedFor(worldId) {
    return this.state[worldId] ?? null;
  }

  /** Records an agreement: we and the server both hold this revision now. */
  agree(worldId, revision, at = Date.now()) {
    this.state[worldId] = { revision: Number(revision) || 0, at };
    saveSyncState(this.state, this.storage);
  }

  forget(worldId) {
    delete this.state[worldId];
    saveSyncState(this.state, this.storage);
  }
}
