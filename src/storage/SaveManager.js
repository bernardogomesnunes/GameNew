import { World } from '../world/World.js';
import { ChunkGen } from '../world/ChunkGen.js';

/**
 * Worlds on this device: one record each, kept under the world's own id.
 *
 * This used to be a name-keyed store with one special name. There was a single
 * `__autosave__` slot holding whichever world you were in, plus any number of
 * named copies you had made with "Save a copy" — so the same world could exist
 * three times under three names, and opening a second world overwrote the first
 * one's only live record. A worlds screen built on that had to show "Where you
 * left off" and "Saved copies" as separate lists, because they were separate
 * things, and neither of them was "your worlds".
 *
 * Now the id a world is born with is the only handle it ever has. One record
 * per world, written when you leave it. Nothing here makes copies.
 *
 * On this device is also not where a world belongs once you have an account —
 * see storage/WorldSync.js. Signed out, this is the whole store; signing in
 * moves what is here up to the account, and after that this is a working copy
 * of something that lives somewhere else.
 */

/**
 * How an endless world is brought back: its seed, handed to a generator.
 *
 * One place rather than at each call site, so a world loaded from a save and
 * one loaded from an exported file are made by exactly the same recipe.
 */
const makeGen = (o) => new ChunkGen(o);

const INDEX_KEY = 'voxelgame:worlds';
const WORLD_PREFIX = 'voxelgame:world:';
const LAST_KEY = 'voxelgame:last-world';
const SAVE_VERSION = 4;

/** The name-keyed store this replaced, read once so nobody loses a world. */
const OLD_INDEX_KEY = 'voxelgame:saves';
const OLD_SAVE_PREFIX = 'voxelgame:save:';
const OLD_AUTOSAVE_NAME = '__autosave__';
const MIGRATED_KEY = 'voxelgame:worlds-migrated';

const worldKey = (id) => WORLD_PREFIX + id;

export class SaveManager {
  constructor() {
    this.migrateOldSaves();
  }

  // ---- the index -------------------------------------------------------------

  /**
   * Every world on this device, newest first.
   *
   * Read from a small index rather than by opening each world: a Duilt save is
   * tens of kilobytes and a worlds screen that parses all of them to draw a
   * list is a worlds screen that takes a second to appear.
   */
  list() {
    return this.readIndex().sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  }

  readIndex() {
    try {
      const rows = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
      return Array.isArray(rows) ? rows.filter((r) => r && r.id) : [];
    } catch {
      return [];
    }
  }

  writeIndex(rows) {
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(rows));
    } catch { /* a full quota must not break the game loop */ }
  }

  /** When this device last wrote a world, by its id. */
  changedAt(worldId) {
    if (!worldId) return 0;
    return this.readIndex().find((r) => r.id === worldId)?.at ?? 0;
  }

  /**
   * When a world was last played on this device, by its id.
   *
   * The sync asks this rather than `changedAt`, because a device that opened a
   * world and closed it again has written it without having played it, and
   * telling the two apart is what stops "we both played" — a conflict nothing
   * resolves on its own — from being the answer every single time.
   */
  editedAt(worldId) {
    if (!worldId) return 0;
    const row = this.readIndex().find((r) => r.id === worldId);
    // A record written before this distinction existed has no editedAt; the
    // safe reading of an unknown is "played", which asks rather than assumes.
    return row ? (row.editedAt ?? row.at ?? 0) : 0;
  }

  has(worldId) {
    return !!worldId && !!localStorage.getItem(worldKey(worldId));
  }

  /** The world you were last in, so the front door can offer it first. */
  lastOpened() {
    try {
      const id = localStorage.getItem(LAST_KEY);
      return id && this.has(id) ? id : null;
    } catch {
      return null;
    }
  }

  markOpened(worldId) {
    try {
      if (worldId) localStorage.setItem(LAST_KEY, worldId);
    } catch { /* private window */ }
  }

  // ---- reading and writing ---------------------------------------------------

  /**
   * Writes the one record this world has.
   *
   * Every save is this: there is no "save as", so there is no way to end up
   * with two of anything. Throws only when the browser refuses the write,
   * which the caller reports rather than swallowing — a save that silently did
   * not happen is the worst outcome available.
   */
  write(state) {
    const id = state.worldId;
    if (!id) throw new Error('A world needs an id before it can be saved.');
    const at = Date.now();
    const payload = payloadOf(state, at);
    try {
      localStorage.setItem(worldKey(id), JSON.stringify(payload));
    } catch {
      throw new Error('Could not save — this browser is out of room.');
    }
    const rows = this.readIndex().filter((r) => r.id !== id);
    rows.push({
      id,
      at,
      // When it was last *played*, which is not when it was last written: see
      // Game.saveState. Leaving a world writes it whether or not you touched it.
      editedAt: state.editedAt ?? 0,
      name: state.worldName ?? 'World',
      mode: state.mode ?? 'creative',
      age: state.duilt?.territory?.age ?? null,
    });
    this.writeIndex(rows);
    this.markOpened(id);
    this.snapshot(state, at);
    return at;
  }

  read(worldId) {
    if (!worldId) return null;
    const raw = localStorage.getItem(worldKey(worldId));
    if (!raw) return null;
    try {
      return unpack(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  remove(worldId) {
    if (!worldId) return;
    localStorage.removeItem(worldKey(worldId));
    this.writeIndex(this.readIndex().filter((r) => r.id !== worldId));
    this.forgetHistory(worldId);
    try {
      if (localStorage.getItem(LAST_KEY) === worldId) localStorage.removeItem(LAST_KEY);
    } catch { /* private window */ }
  }

  // ---- earlier versions ------------------------------------------------------

  /**
   * Keeps a few earlier versions of a world, so a bad afternoon is recoverable.
   *
   * There was nowhere to go back to before: one save, overwritten every time,
   * and if you levelled the wrong hill or pulled down the wrong house that was
   * simply the world now. Endless worlds made this affordable — a save is the
   * seed plus the chunks you changed — so keeping the last few costs almost
   * nothing.
   *
   * A ring rather than a growing list. The oldest falls off the end, because a
   * history nobody prunes is the thing that fills a browser's storage and then
   * loses you the save you actually needed. These are versions of one world,
   * not worlds: they never appear as entries on the worlds screen.
   */
  snapshot(state, at = Date.now()) {
    const id = state.worldId;
    if (!id) return [];
    const key = historyKey(id);
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch { list = []; }

    // Not every save: one every few minutes is a history you can read, one
    // every minute is a wall of near-identical rows.
    const last = list[list.length - 1];
    if (last && at - last.at < SNAPSHOT_EVERY_MS) return list;

    list.push({ at, name: state.worldName ?? 'World', json: JSON.stringify(payloadOf(state, at)) });
    while (list.length > KEEP_VERSIONS) list.shift();
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      // Out of room. Drop the oldest half and try once more: losing the
      // distant past is much better than failing to keep the recent.
      list = list.slice(Math.ceil(list.length / 2));
      try { localStorage.setItem(key, JSON.stringify(list)); } catch { return []; }
    }
    return list;
  }

  /** The earlier versions of a world, newest first. */
  history(worldId) {
    if (!worldId) return [];
    try {
      const list = JSON.parse(localStorage.getItem(historyKey(worldId)) || '[]');
      return list.map(({ at, name }, i) => ({ at, name, index: i })).reverse();
    } catch {
      return [];
    }
  }

  /** One earlier version, ready to load. */
  loadSnapshot(worldId, index) {
    try {
      const list = JSON.parse(localStorage.getItem(historyKey(worldId)) || '[]');
      const entry = list[index];
      if (!entry) return null;
      return unpack(JSON.parse(entry.json), entry.name);
    } catch {
      return null;
    }
  }

  forgetHistory(worldId) {
    if (worldId) localStorage.removeItem(historyKey(worldId));
  }

  // ---- the store this replaced -----------------------------------------------

  /**
   * Brings worlds over from the name-keyed store, once.
   *
   * Anybody playing before this has an `__autosave__` and possibly some named
   * copies. Those are worlds; they do not stop being worlds because the shape
   * of the store changed. Copies of one world collapse into one record — the
   * most recent wins — which is the whole point of the new shape, and a save
   * from before worlds had ids gets one so it has a handle at all.
   */
  migrateOldSaves() {
    try {
      if (localStorage.getItem(MIGRATED_KEY)) return 0;
      const names = JSON.parse(localStorage.getItem(OLD_INDEX_KEY) || '[]');
      if (!Array.isArray(names)) { localStorage.setItem(MIGRATED_KEY, '1'); return 0; }

      const rows = this.readIndex();
      const byId = new Map(rows.map((r) => [r.id, r]));
      let moved = 0;
      for (const name of names) {
        const raw = localStorage.getItem(OLD_SAVE_PREFIX + name);
        if (!raw) continue;
        let payload;
        try { payload = JSON.parse(raw); } catch { continue; }
        const id = payload.worldId || `local-${name}-${payload.timestamp ?? 0}`;
        const at = payload.timestamp ?? 0;
        const existing = byId.get(id);
        // The same world saved twice under two names: keep the later one.
        if (existing && (existing.at ?? 0) >= at) continue;
        payload.worldId = id;
        localStorage.setItem(worldKey(id), JSON.stringify(payload));
        const row = {
          id, at,
          name: payload.worldName ?? (name === OLD_AUTOSAVE_NAME ? 'Your world' : name),
          mode: payload.mode ?? 'creative',
          age: payload.duilt?.territory?.age ?? null,
        };
        byId.set(id, row);
        if (name === OLD_AUTOSAVE_NAME) this.markOpened(id);
        moved++;
      }
      this.writeIndex([...byId.values()]);
      localStorage.setItem(MIGRATED_KEY, '1');
      // The old keys stay put. If this went wrong, the worlds are still there
      // to be looked at, and a few stale keys cost far less than a lost world.
      return moved;
    } catch {
      return 0;
    }
  }
}

/**
 * What a saved world is, in one place.
 *
 * Both the live record and the version history write this, and both readers
 * unpack it, so an earlier version can never be a different shape from the
 * current one — which is the way a restore quietly loses your bag.
 */
function payloadOf({ world, player, gamification, economy, mode, worldId, worldName, duilt, editedAt }, at) {
  return {
    version: SAVE_VERSION,
    timestamp: at,
    editedAt: editedAt ?? 0,
    mode,
    // The handle. Everything — the record, the history, the account copy — is
    // keyed on it, so one world is one world wherever you look at it from.
    worldId: worldId ?? null,
    worldName: worldName ?? 'World',
    world: world.serialize(),
    player: { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch },
    gamification: gamification.toJSON(),
    economy: economy.toJSON(),
    // The bag, the land, the buildings, hunger and skills. Left out of this
    // list once, which meant a Duilt world saved as a plain box of blocks and
    // came back with nothing in it.
    duilt: duilt ?? null,
  };
}

function unpack(payload, name) {
  return {
    world: World.deserialize(payload.world, { makeGen }),
    player: payload.player,
    gamification: payload.gamification,
    // Saves written before the economy existed are Creative worlds.
    mode: payload.mode ?? 'creative',
    economy: payload.economy ?? null,
    worldId: payload.worldId ?? null,
    worldName: payload.worldName ?? name ?? 'World',
    editedAt: payload.editedAt ?? payload.timestamp ?? 0,
    // Absent in version 2 and earlier, which is exactly what a world with no
    // Duilt state looks like, so old saves need no migration.
    duilt: payload.duilt ?? null,
    timestamp: payload.timestamp,
  };
}

function historyKey(worldId) {
  return `voxelgame:history:${worldId}`;
}

/** How many earlier versions to keep, and how far apart they have to be. */
const KEEP_VERSIONS = 8;
const SNAPSHOT_EVERY_MS = 4 * 60_000;

export { KEEP_VERSIONS, SNAPSHOT_EVERY_MS };
