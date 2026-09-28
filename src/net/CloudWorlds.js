import { World, CHUNK_SIZE } from '../world/World.js';
import { ChunkGen } from '../world/ChunkGen.js';
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
 * This is the only place worlds are kept. There is no local copy to fall back
 * on — that went when worlds moved onto the account — which is why everything
 * here fails loudly rather than quietly, and why the transport underneath it
 * asks twice before deciding the account cannot be reached.
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
  async save(worldId, { world, name, mode, player, gamification, economy, duilt, revision, territoryBounds }) {
    const meta = {
      name: name || 'Untitled world',
      mode,
      sizeX: world.sizeX,
      sizeZ: world.sizeZ,
      height: world.height,
      // An endless world has no size to save — it has a seed, and the
      // handful of chunks somebody actually reshaped. Everything else is
      // remade from this on the way back in; see restore() and
      // World.serialize(), which the local save path already does the same
      // thing for.
      worldGen: world.endless
        ? { seed: world.gen.seed, homeX: world.gen.biomes.centreX, homeZ: world.gen.biomes.centreZ }
        : null,
      spawn: player ? { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch } : null,
      economy: economy?.toJSON?.() ?? {},
      // Small enough to ride along in the metadata, and useless apart from it:
      // restoring a Duilt world without its bag and buildings is a blank map.
      duilt: duilt ?? null,
      blockCount: countBlocks(world),
      // A counter, not a clock. It used to be Date.now(), which makes the
      // "whose copy is newer" question depend on two devices' clocks agreeing —
      // and when they do not, the answer is somebody's afternoon. The caller
      // passes one past whatever the account currently holds.
      revision: revision ?? Date.now(),
    };
    // Claimed land goes up in full, touched or not — see SyncEngine.snapshot
    // and World.serialize's matching note — so the one part of an endless
    // world somebody has a stake in can never shift under them because the
    // generator changed between sessions.
    const result = await this.sync.push(worldId, { world, meta, keepBounds: territoryBounds });

    if (gamification) {
      // Best effort: a world that uploaded is the thing worth keeping, and a
      // failed progression write should not read as a failed save.
      //
      // The whole snapshot goes up, not a hand-picked subset of it — that
      // subset used to read fields (`g.achievements`, `g.stats`) that
      // GamificationEngine.toJSON() has never produced (the real names are
      // `achievementsUnlocked` and no `stats` field exists at all), so every
      // push silently wrote an empty achievements array regardless of what
      // was actually unlocked. See NeonTransport.pushProgression.
      try {
        await this.transport.pushProgression(gamification.toJSON());
      } catch { /* reported by the next save */ }
    }
    return { ...result, revision: meta.revision };
  }

  /** Pulls a world back into the shape loadFromData expects. */
  async restore(worldId) {
    const payload = await this.sync.pull(worldId);
    if (!payload) throw new Error('That world is no longer in the cloud.');
    const { meta, chunks } = payload;

    // A world with a seed is remade from it, not laid out on a grid — the
    // same distinction save() draws, in reverse. Getting this wrong is not
    // loud: `new World({ sizeX: null, ... })` still builds a small, empty,
    // technically-valid 64×64 world, so a Duilt world restored the fixed
    // way looks fine for a second and then drops almost everything outside
    // that box, silently, which is worse than the error this replaces.
    const world = meta.worldGen
      ? new World({
        height: meta.height,
        gen: new ChunkGen({
          seed: meta.worldGen.seed, height: meta.height,
          homeX: meta.worldGen.homeX, homeZ: meta.worldGen.homeZ,
        }),
      })
      : new World({ sizeX: meta.sizeX, sizeZ: meta.sizeZ, height: meta.height });

    for (const c of chunks) {
      const chunk = world.getChunk(c.cx, c.cz);
      if (!chunk) continue; // a chunk outside this world's bounds is not ours to place
      writeRle(chunk.data, unpackRle(c.bytes));
      if (world.endless) {
        chunk.touched = true;
        chunk.dirty = true;
        // What went up is blocks only, not the ground-height array — see
        // SyncEngine's encodeChunk — so a reshaped chunk works its surface
        // out again from what actually got placed, the same fallback a
        // local save from before heights rode along already uses.
        world.gen.resurface(chunk);
      }
    }

    const spawn = meta.spawn || (meta.worldGen
      ? { x: meta.worldGen.homeX, y: meta.height - 4, z: meta.worldGen.homeZ }
      : { x: meta.sizeX / 2, y: meta.height - 4, z: meta.sizeZ / 2 });
    return {
      world,
      mode: meta.mode,
      name: meta.name,
      player: spawn,
      economy: meta.economy || {},
      duilt: meta.duilt ?? null,
      revision: meta.revision,
      gamification: null, // progression is per account, fetched separately
    };
  }

  async progression() {
    const row = await this.transport.pullProgression();
    if (!row) return null;
    // `stats` carries the full GamificationEngine snapshot pushProgression
    // wrote — see there — so this is a real toJSON()-shaped object that
    // Game.js can hand straight to gamification.loadJSON(). The individual
    // columns are read only as a fallback, for a row a pre-fix build wrote,
    // where `stats` is still the table's empty default.
    if (row.stats && Object.keys(row.stats).length) return row.stats;
    return {
      xp: row.xp, level: row.level, streakCount: row.streak_count,
      lastPlayDate: row.last_play_date, achievementsUnlocked: row.achievements ?? [],
    };
  }

  async delete(worldId) {
    await this.sync.deleteWorld(worldId);
  }

  /** After a delete-and-recreate elsewhere, forget what we think the server has. */
  forget(worldId) {
    this.sync.forget(worldId);
  }

  /**
   * Records that a save gave up, after retries — best effort, never thrown
   * from. The alternative to calling this is a broken save staying invisible
   * until somebody notices their world is gone and sends a screenshot; this
   * makes it a query instead.
   */
  async reportFailure(worldId, err) {
    try {
      await this.transport.logSaveFailure({
        worldId,
        code: err?.status ?? null,
        message: err?.message ?? String(err),
      });
    } catch { /* the failure that mattered already happened; this is a courtesy */ }
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
