import { CHUNK_SIZE } from '../world/World.js';

/**
 * Incremental world sync.
 *
 * The expensive thing about saving a large world is re-serialising all of it.
 * This hashes each chunk, keeps a manifest of what the server last accepted,
 * and pushes only the chunks whose contents actually changed — so save cost is
 * proportional to what you edited, not to how big the world is.
 *
 * Transport is deliberately abstract: the diffing is the engineering, and the
 * wire format underneath it (a REST API, Postgres via a function, anything)
 * can change without touching this.
 */

const MANIFEST_KEY = 'voxelgame:sync-manifest';

/** FNV-1a over the packed chunk bytes. Fast, and collisions here only cost a redundant upload. */
export function hashBytes(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Packs a chunk's run-length pairs as [uint8 blockId][uint16 runLength], matching world_chunks.rle. */
export function packRle(pairs) {
  const out = new Uint8Array((pairs.length / 2) * 3);
  const view = new DataView(out.buffer);
  let o = 0;
  for (let i = 0; i < pairs.length; i += 2) {
    out[o] = pairs[i] & 0xff;
    view.setUint16(o + 1, Math.min(pairs[i + 1], 0xffff), true);
    o += 3;
  }
  return out;
}

export function unpackRle(bytes) {
  const pairs = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let o = 0; o + 2 < bytes.length; o += 3) {
    pairs.push(bytes[o], view.getUint16(o + 1, true));
  }
  return pairs;
}

function encodeChunk(chunk) {
  const pairs = [];
  const data = chunk.data;
  let i = 0;
  while (i < data.length) {
    const value = data[i];
    let run = 1;
    while (i + run < data.length && data[i + run] === value && run < 65535) run++;
    pairs.push(value, run);
    i += run;
  }
  return packRle(pairs);
}

export class SyncEngine {
  constructor({ transport, bus } = {}) {
    this.transport = transport;
    this.bus = bus;
    this.manifests = this.loadManifests();
  }

  loadManifests() {
    try {
      return JSON.parse(localStorage.getItem(MANIFEST_KEY) || '{}');
    } catch {
      return {};
    }
  }

  saveManifests() {
    try {
      localStorage.setItem(MANIFEST_KEY, JSON.stringify(this.manifests));
    } catch { /* a full quota must not break the game loop */ }
  }

  /** Current content hash of every chunk worth uploading. */
  snapshot(world) {
    const entries = [];
    for (const chunk of world.allChunks()) {
      // An endless world can regenerate any untouched chunk from its seed —
      // that is the entire point of carrying a seed instead of a grid, and
      // it is what `keep` chunks of pure, walked-past terrain sitting in
      // memory around the player actually are. Uploading it anyway means
      // every save grows with how far someone has *walked*, not with what
      // they *built*, forever. A fixed world has no seed to regenerate
      // anything from at all — see World's own notes on why — so every one
      // of its chunks is real, unrecoverable data and still goes up.
      if (world.endless && !chunk.touched) continue;
      const bytes = encodeChunk(chunk);
      entries.push({ cx: chunk.cx, cz: chunk.cz, bytes, hash: hashBytes(bytes) });
    }
    return entries;
  }

  /** Chunks whose contents differ from what the server last confirmed. */
  diff(worldId, world) {
    const known = this.manifests[worldId] || {};
    const changed = [];
    for (const entry of this.snapshot(world)) {
      const key = `${entry.cx},${entry.cz}`;
      if (known[key] !== entry.hash) changed.push(entry);
    }
    return changed;
  }

  async push(worldId, { world, meta }) {
    if (!this.transport) throw new Error('No sync transport configured.');
    const changed = this.diff(worldId, world);
    const result = await this.transport.pushWorld({
      worldId,
      meta,
      chunks: changed.map(({ cx, cz, bytes }) => ({ cx, cz, bytes })),
    });

    // Only record hashes the server actually accepted, so a failed upload is
    // retried rather than silently skipped next time.
    const manifest = this.manifests[worldId] || (this.manifests[worldId] = {});
    for (const entry of changed) manifest[`${entry.cx},${entry.cz}`] = entry.hash;
    this.saveManifests();

    this.bus?.emit('sync:pushed', { worldId, chunks: changed.length });
    return { pushedChunks: changed.length, totalChunks: [...world.allChunks()].length, ...result };
  }

  async pull(worldId) {
    if (!this.transport) throw new Error('No sync transport configured.');
    const payload = await this.transport.pullWorld(worldId);
    if (!payload) return null;
    const manifest = {};
    for (const c of payload.chunks) manifest[`${c.cx},${c.cz}`] = hashBytes(c.bytes);
    this.manifests[worldId] = manifest;
    this.saveManifests();
    this.bus?.emit('sync:pulled', { worldId, chunks: payload.chunks.length });
    return payload;
  }

  async listWorlds() {
    return this.transport ? this.transport.listWorlds() : [];
  }

  async deleteWorld(worldId) {
    if (!this.transport) throw new Error('No sync transport configured.');
    await this.transport.deleteWorld(worldId);
    delete this.manifests[worldId];
    this.saveManifests();
  }

  /** Forgets what the server has, so the next push re-uploads everything. */
  forget(worldId) {
    delete this.manifests[worldId];
    this.saveManifests();
  }
}

/**
 * A transport that keeps everything in localStorage. Not the destination — it
 * exists so the diffing, manifests and restore path can be exercised for real
 * before a network transport is chosen.
 */
export class LocalTransport {
  constructor(prefix = 'voxelgame:cloud') {
    this.prefix = prefix;
  }

  read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(`${this.prefix}:${key}`)) ?? fallback; }
    catch { return fallback; }
  }

  write(key, value) {
    localStorage.setItem(`${this.prefix}:${key}`, JSON.stringify(value));
  }

  async listWorlds() {
    return this.read('index', []);
  }

  async pushWorld({ worldId, meta, chunks }) {
    const index = this.read('index', []);
    const existing = index.find((w) => w.id === worldId);
    const record = { id: worldId, ...meta, updatedAt: Date.now() };
    if (existing) Object.assign(existing, record);
    else index.push(record);
    this.write('index', index);

    const stored = this.read(`chunks:${worldId}`, {});
    for (const c of chunks) stored[`${c.cx},${c.cz}`] = Array.from(c.bytes);
    this.write(`chunks:${worldId}`, stored);
    return { revision: Date.now() };
  }

  async pullWorld(worldId) {
    const index = this.read('index', []);
    const meta = index.find((w) => w.id === worldId);
    if (!meta) return null;
    const stored = this.read(`chunks:${worldId}`, {});
    const chunks = Object.entries(stored).map(([key, arr]) => {
      const [cx, cz] = key.split(',').map(Number);
      return { cx, cz, bytes: Uint8Array.from(arr) };
    });
    return { meta, chunks };
  }

  async deleteWorld(worldId) {
    this.write('index', this.read('index', []).filter((w) => w.id !== worldId));
    localStorage.removeItem(`${this.prefix}:chunks:${worldId}`);
  }
}

export { CHUNK_SIZE };
