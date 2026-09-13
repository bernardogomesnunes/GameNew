import { World, CHUNK_SIZE } from '../world/World.js';
import { SyncEngine, unpackRle } from '../storage/SyncEngine.js';
import { NeonTransport } from './NeonTransport.js';
import { AIR } from '../config/blocks.js';

/**
 * The cloud half of saving: what the menu panel actually calls.
 *
 * Keeps SyncEngine's incremental diffing (only changed chunks go up) and adds
 * the round trip the game needs — turning a pile of stored chunks back into a
 * playable World, and listing and deleting what is up there.
 *
 * Local saving does not depend on any of this. A player who never signs in
 * loses nothing except sync; that is the deliberate trade for not inventing an
 * identity the database cannot verify.
 */
export class CloudWorlds {
  constructor({ auth, bus }) {
    this.auth = auth;
    this.bus = bus;
    this.transport = new NeonTransport(auth);
    this.sync = new SyncEngine({ transport: this.transport, bus });
  }

  get signedIn() {
    return Boolean(this.auth.user);
  }

  async list() {
    return this.transport.listWorlds();
  }

  /**
   * Uploads the world and its progression. Returns how much actually moved, so
   * the UI can say "3 of 16 chunks" rather than a meaningless spinner.
   */
  async save(worldId, { world, name, mode, player, gamification, economy, duilt }) {
    const meta = {
      name: name || 'Untitled world',
      mode,
      sizeX: world.sizeX,
      sizeZ: world.sizeZ,
      height: world.height,
      spawn: player ? { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch } : null,
      economy: economy?.toJSON?.() ?? {},
      // Small enough to ride along in the metadata, and useless apart from it:
      // restoring a Duilt world without its bag and buildings is a blank map.
      duilt: duilt ?? null,
      blockCount: countBlocks(world),
      revision: Date.now(),
    };
    const result = await this.sync.push(worldId, { world, meta });

    if (gamification) {
      const g = gamification.toJSON();
      // Best effort: a world that uploaded is the thing worth keeping, and a
      // failed progression write should not read as a failed save.
      try {
        await this.transport.pushProgression({
          xp: g.xp, level: g.level, streak: g.streak ?? g.streakCount,
          lastPlayDate: g.lastPlayDate ?? null,
          achievements: g.achievements ?? [], stats: g.stats ?? {},
        });
      } catch { /* reported by the next save */ }
    }
    return result;
  }

  /** Pulls a world back into the shape loadFromData expects. */
  async restore(worldId) {
    const payload = await this.sync.pull(worldId);
    if (!payload) throw new Error('That world is no longer in the cloud.');
    const { meta, chunks } = payload;

    const world = new World({ sizeX: meta.sizeX, sizeZ: meta.sizeZ, height: meta.height });
    for (const c of chunks) {
      const chunk = world.getChunk(c.cx, c.cz);
      if (!chunk) continue; // a chunk outside this world's bounds is not ours to place
      writeRle(chunk.data, unpackRle(c.bytes));
    }

    const spawn = meta.spawn || { x: meta.sizeX / 2, y: meta.height - 4, z: meta.sizeZ / 2 };
    return {
      world,
      mode: meta.mode,
      name: meta.name,
      player: spawn,
      economy: meta.economy || {},
      duilt: meta.duilt ?? null,
      gamification: null, // progression is per account, fetched separately
    };
  }

  async progression() {
    const row = await this.transport.pullProgression();
    if (!row) return null;
    return {
      xp: row.xp, level: row.level, streak: row.streak_count,
      lastPlayDate: row.last_play_date, achievements: row.achievements, stats: row.stats,
    };
  }

  async delete(worldId) {
    await this.sync.deleteWorld(worldId);
  }

  /** After a delete-and-recreate elsewhere, forget what we think the server has. */
  forget(worldId) {
    this.sync.forget(worldId);
  }
}

function writeRle(data, pairs) {
  let o = 0;
  for (let i = 0; i < pairs.length; i += 2) {
    const value = pairs[i];
    const run = pairs[i + 1];
    data.fill(value, o, Math.min(o + run, data.length));
    o += run;
    if (o >= data.length) break;
  }
}

function countBlocks(world) {
  let n = 0;
  for (const chunk of world.allChunks()) {
    for (let i = 0; i < chunk.data.length; i++) if (chunk.data[i] !== AIR) n++;
  }
  return n;
}

export { CHUNK_SIZE };
