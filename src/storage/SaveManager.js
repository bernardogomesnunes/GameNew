import { World } from '../world/World.js';
import { ChunkGen } from '../world/ChunkGen.js';

/**
 * How an endless world is brought back: its seed, handed to a generator.
 *
 * One place rather than at each call site, so a world loaded from a save and
 * one loaded from an exported file are made by exactly the same recipe.
 */
const makeGen = (o) => new ChunkGen(o);

const INDEX_KEY = 'voxelgame:saves';
const SAVE_PREFIX = 'voxelgame:save:';
const AUTOSAVE_NAME = '__autosave__';
const SAVE_VERSION = 3;

function saveKey(name) {
  return SAVE_PREFIX + name;
}

export class SaveManager {
  listSaves() {
    const index = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
    return index
      .map((name) => {
        try {
          const raw = localStorage.getItem(saveKey(name));
          if (!raw) return null;
          const data = JSON.parse(raw);
          // Enough for a world list to describe itself without opening each
          // save: what kind of world it is, what it was called, and how far it
          // got. Reading the whole payload here is fine — it is already parsed.
          return {
            name,
            // The id the cloud knows this world by, so the worlds screen can
            // tell which of your saves are also on your account.
            worldId: data.worldId ?? null,
            timestamp: data.timestamp,
            isAutosave: name === AUTOSAVE_NAME,
            mode: data.mode ?? 'creative',
            worldName: data.worldName ?? name,
            age: data.duilt?.territory?.age ?? null,
            blocks: data.world?.chunks?.length ?? null,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  save(name, state) {
    const payload = payloadOf(state, Date.now(), name);
    const json = JSON.stringify(payload);
    try {
      localStorage.setItem(saveKey(name), json);
    } catch (err) {
      throw new Error('Could not save — local storage may be full.');
    }
    const index = new Set(JSON.parse(localStorage.getItem(INDEX_KEY) || '[]'));
    index.add(name);
    localStorage.setItem(INDEX_KEY, JSON.stringify([...index]));
    return payload.timestamp;
  }

  autosave(state) {
    const at = this.save(AUTOSAVE_NAME, state);
    this.snapshot(state, at);
    return at;
  }

  /**
   * Keeps a few earlier versions of a world, so a bad afternoon is recoverable.
   *
   * There was nowhere to go back to before: one autosave, overwritten every
   * time, and if you levelled the wrong hill or pulled down the wrong house
   * that was simply the world now. Endless worlds made this affordable —
   * a save is the seed plus the chunks you changed, tens of kilobytes rather
   * than megabytes — so keeping the last few costs almost nothing.
   *
   * A ring rather than a growing list. The oldest falls off the end, because
   * a history nobody prunes is the thing that fills a browser's storage and
   * then loses you the save you actually needed.
   */
  snapshot(state, at = Date.now()) {
    const id = state.worldId;
    if (!id) return [];
    const key = historyKey(id);
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch { list = []; }

    // Not every autosave: one every few minutes is a history you can read,
    // one every minute is a wall of near-identical rows.
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

  load(name) {
    const raw = localStorage.getItem(saveKey(name));
    if (!raw) return null;
    return unpack(JSON.parse(raw), name);
  }

  delete(name) {
    localStorage.removeItem(saveKey(name));
    const index = new Set(JSON.parse(localStorage.getItem(INDEX_KEY) || '[]'));
    index.delete(name);
    localStorage.setItem(INDEX_KEY, JSON.stringify([...index]));
  }

  hasAutosave() {
    return !!localStorage.getItem(saveKey(AUTOSAVE_NAME));
  }
}

/**
 * What a saved world is, in one place.
 *
 * Both the live save and the version history write this, and both readers
 * unpack it, so an earlier version can never be a different shape from the
 * current one — which is the way a restore quietly loses your bag.
 */
function payloadOf({ world, player, gamification, economy, mode, worldId, worldName, duilt }, at, name) {
  return {
    version: SAVE_VERSION,
    timestamp: at,
    mode,
    // Carried so a local save and its cloud copy stay the same world.
    worldId: worldId ?? null,
    worldName: worldName ?? name,
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
    worldName: payload.worldName ?? name,
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

export { AUTOSAVE_NAME, KEEP_VERSIONS, SNAPSHOT_EVERY_MS };
