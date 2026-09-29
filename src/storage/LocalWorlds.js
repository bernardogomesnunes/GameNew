/**
 * The local half of saving: a world with nowhere else to live.
 *
 * Cloud sync only ever made sense as something you turn on — the same
 * settlement following you from a phone to a desktop. It should never have
 * been the price of playing at all, but for a while it was: SaveManager was
 * deleted outright, on the reasoning that reconciling a browser's copy of a
 * world with an account's copy of the *same* world has no good answer. That
 * reasoning was correct — and it does not apply here. A world is either
 * signed-in-and-cloud or signed-out-and-local, decided once at HomeScreen's
 * naming step (see whereToLive) and never both, so there is never a second
 * copy of the same world to reconcile in the first place. Two disjoint
 * libraries need no merging, only listing together.
 *
 * Unlike CloudWorlds' SyncEngine, this keeps no incremental diff — writing
 * a whole world to localStorage is one synchronous call, not a network
 * round trip, so there is nothing to save by sending only what changed.
 */

const INDEX_KEY = 'voxelgame:local:index';
const PROGRESSION_KEY = 'voxelgame:local:progression';
const worldKey = (id) => `voxelgame:local:world:${id}`;

export class LocalWorlds {
  /** Every world this browser holds, newest first — what the worlds screen lists. */
  list() {
    return readIndex().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }

  /** Whether an id lives here at all, without paying for the full payload. */
  has(id) {
    return readIndex().some((w) => w.id === id);
  }

  /**
   * Writes the world under its id, all at once. Returns a revision the same
   * shape CloudWorlds.save does, so Game.js can treat both the same way.
   */
  save(id, { world, name, mode, player, duilt, economy, territoryBounds, revision } = {}) {
    const payload = {
      world: world.serialize({ keepBounds: territoryBounds }),
      mode,
      name: name || 'Untitled world',
      player: player
        ? { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch }
        : null,
      duilt: duilt ?? null,
      economy: economy?.toJSON?.() ?? {},
      updatedAt: Date.now(),
      revision: revision ?? Date.now(),
    };
    try {
      localStorage.setItem(worldKey(id), JSON.stringify(payload));
    } catch {
      // Almost always the quota, not a fluke — say so plainly rather than
      // leaving a save that silently didn't happen.
      throw new Error('This browser has no room left to save — free some space or export the world instead.');
    }
    const index = readIndex().filter((w) => w.id !== id);
    index.push({
      id, name: payload.name, mode: payload.mode,
      age: duilt?.territory?.age ?? null,
      updatedAt: payload.updatedAt,
    });
    writeIndex(index);
    return { revision: payload.revision };
  }

  /** The full payload back, or throws — the same contract CloudWorlds.restore keeps. */
  restore(id) {
    let payload = null;
    try { payload = JSON.parse(localStorage.getItem(worldKey(id)) ?? 'null'); } catch { payload = null; }
    if (!payload) throw new Error('That world is no longer saved in this browser.');
    return payload;
  }

  delete(id) {
    try { localStorage.removeItem(worldKey(id)); } catch { /* nothing to remove */ }
    writeIndex(readIndex().filter((w) => w.id !== id));
  }

  /**
   * Level, XP and achievements live outside any one world — CloudWorlds
   * keeps the same split, one row per account rather than one per world
   * (see its own progression()/pushProgression) — so this browser gets one
   * row too, shared by every local world rather than reset each time you
   * open a different one.
   */
  saveProgression(json) {
    try { localStorage.setItem(PROGRESSION_KEY, JSON.stringify(json)); } catch { /* not worth failing the world save over */ }
  }

  loadProgression() {
    try { return JSON.parse(localStorage.getItem(PROGRESSION_KEY) ?? 'null'); } catch { return null; }
  }
}

function readIndex() {
  try {
    const raw = JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeIndex(index) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)); } catch { /* out of room; the world itself already failed loudly */ }
}
