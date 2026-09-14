import { World } from '../world/World.js';

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

  save(name, { world, player, gamification, economy, mode, worldId, worldName, duilt }) {
    const payload = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
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
    this.save(AUTOSAVE_NAME, state);
  }

  load(name) {
    const raw = localStorage.getItem(saveKey(name));
    if (!raw) return null;
    const payload = JSON.parse(raw);
    return {
      world: World.deserialize(payload.world),
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

export { AUTOSAVE_NAME };
