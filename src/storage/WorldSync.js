/**
 * What this device and the account last agreed about each world.
 *
 * This used to be a whole reconciliation: worlds were kept in whichever browser
 * made them *and* on the account, and something had to decide which of two
 * copies was the real one. There is no good answer to that question — one of
 * the two is always wrong and the game has to guess which — and the guessing
 * is what showed one account two different settlements on two devices.
 *
 * So there is one copy now and it is on the account. What survives is a single
 * fact per world: the revision this device last saw. It is not used to pick a
 * winner any more; it is used to notice that somebody else saved while you had
 * the world open, which is worth saying out loud even though your changes are
 * the ones that go up.
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
