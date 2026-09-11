const STORE_KEY = 'voxelgame:templates';
const SCHEMA_VERSION = 1;

/**
 * Named building templates the player designs and re-stamps.
 *
 * Records are shaped the way the server will want them — a stable id, an owner
 * slot, timestamps, and a block manifest — so moving this to Postgres later is
 * a change of transport, not of schema. localStorage is the current transport
 * and the wrong long-term home: these are precious, user-authored data that a
 * browser cleanup would erase.
 */
export class TemplateLibrary {
  constructor(bus) {
    this.bus = bus;
    this.templates = this.load();
  }

  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.templates));
    } catch {
      this.bus?.emit('templates:error', { reason: 'Storage is full — delete a template to make room.' });
      return false;
    }
    this.bus?.emit('templates:change', {});
    return true;
  }

  list() {
    return [...this.templates].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id) {
    return this.templates.find((t) => t.id === id) || null;
  }

  /** Distinct block types used, which is what variety-based achievements read. */
  static summarize(blocks) {
    const types = new Set();
    let maxDy = 0;
    for (const b of blocks) { types.add(b.type); if (b.dy > maxDy) maxDy = b.dy; }
    return { blockCount: blocks.length, distinctTypes: types.size, height: maxDy + 1 };
  }

  save(name, captured) {
    const summary = TemplateLibrary.summarize(captured.blocks);
    const now = Date.now();
    const record = {
      id: `tpl_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      schema: SCHEMA_VERSION,
      ownerId: null, // filled in once accounts exist
      name: name.trim() || `Template ${this.templates.length + 1}`,
      size: captured.size,
      blocks: captured.blocks,
      ...summary,
      createdAt: now,
      updatedAt: now,
    };
    this.templates.push(record);
    if (!this.persist()) {
      this.templates.pop();
      return null;
    }
    this.bus?.emit('template:saved', record);
    return record;
  }

  rename(id, name) {
    const t = this.get(id);
    if (!t) return false;
    t.name = name.trim() || t.name;
    t.updatedAt = Date.now();
    return this.persist();
  }

  delete(id) {
    const i = this.templates.findIndex((t) => t.id === id);
    if (i === -1) return false;
    this.templates.splice(i, 1);
    return this.persist();
  }

  /** Portable payload for file export or upload. */
  export(id) {
    const t = this.get(id);
    if (!t) return null;
    return { format: 'voxel-template', version: SCHEMA_VERSION, name: t.name, size: t.size, blocks: t.blocks };
  }

  import(payload, fallbackName = 'Imported') {
    if (!payload || !Array.isArray(payload.blocks) || !payload.size) return null;
    return this.save(payload.name || fallbackName, { size: payload.size, blocks: payload.blocks });
  }
}
