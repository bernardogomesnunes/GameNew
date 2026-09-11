import { World } from '../world/World.js';

const INDEX_KEY = 'voxelgame:saves';
const SAVE_PREFIX = 'voxelgame:save:';
const AUTOSAVE_NAME = '__autosave__';
const SAVE_VERSION = 2;

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
          return { name, timestamp: data.timestamp, isAutosave: name === AUTOSAVE_NAME };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  save(name, { world, player, gamification, economy, mode }) {
    const payload = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      mode,
      world: world.serialize(),
      player: { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch },
      gamification: gamification.toJSON(),
      economy: economy.toJSON(),
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
