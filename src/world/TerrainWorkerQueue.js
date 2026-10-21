import { terrainConfig } from './terrainPayload.js';
export { terrainConfig, generateTerrainChunk } from './terrainPayload.js';

/** Bounded prefetch; collision/read callers retain World's synchronous API. */
export class TerrainWorkerQueue {
  constructor(world, { onChunk = () => {}, maxPending = 8, workerFactory = () => new Worker(new URL('./terrain.worker.js', import.meta.url), { type: 'module' }) } = {}) {
    this.world = world;
    this.onChunk = onChunk;
    this.maxPending = maxPending;
    this.pending = new Map();
    this.nextId = 0;
    this.available = false;
    if (!world.endless) return;
    try {
      this.worker = workerFactory();
      this.available = true;
      this.worker.onmessage = ({ data }) => this.receive(data);
      this.worker.onerror = () => this.dispose();
      this.worker.onmessageerror = () => this.dispose();
    } catch { this.dispose(); }
  }

  syncConfig() {
    const config = terrainConfig(this.world);
    const signature = JSON.stringify(config);
    if (signature !== this.signature) {
      this.signature = signature;
      this.config = config;
      // Old requests remain bounded until their replies arrive. Their results
      // will be rejected; do not append another entire queue behind them.
    }
    return signature;
  }

  request(cx, cz) {
    if (!this.available) return false;
    this.syncConfig();
    if (this.world.hasChunk(cx, cz)) return true;
    for (const job of this.pending.values()) {
      if (job.cx === cx && job.cz === cz && job.signature === this.signature) return true;
    }
    if (this.pending.size >= this.maxPending) return false;
    const id = ++this.nextId;
    const job = { id, cx, cz, signature: this.signature, config: this.config };
    this.pending.set(id, job);
    try { this.worker.postMessage(job); }
    catch { this.dispose(); return false; }
    return true;
  }

  receive(data) {
    if (!this.available) return;
    const job = this.pending.get(data.id);
    if (!job) return;
    this.pending.delete(data.id);
    if (data.error) { this.dispose(); return; }
    if (job.signature !== this.syncConfig() || data.signature !== job.signature) return;
    const chunk = this.world.acceptGeneratedChunk(data.chunk);
    if (chunk) this.onChunk(chunk);
  }

  dispose() {
    this.available = false;
    this.worker?.terminate();
    this.pending.clear();
  }
}
