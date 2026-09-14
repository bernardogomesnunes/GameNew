import { BLOCKS, BLOCKS_BY_ID, AIR } from '../config/blocks.js';
import { World } from '../world/World.js';

export const EXPORT_FORMAT = 'voxel-sandbox-world';
export const EXPORT_VERSION = 2;

function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function safeName(name) {
  return (name || 'world').replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'world';
}

/**
 * Full-fidelity snapshot: everything needed to restore the world exactly,
 * including progression and the player's saved designs.
 */
export function buildWorldPayload({ world, player, gamification, economy, mode, templates, name, duilt }) {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    name: name || 'Untitled world',
    mode,
    world: world.serialize(),
    player: { x: player.position.x, y: player.position.y, z: player.position.z, yaw: player.yaw, pitch: player.pitch },
    gamification: gamification.toJSON(),
    economy: economy.toJSON(),
    // A Duilt world without its bag, land and buildings is just the terrain.
    duilt: duilt ?? null,
    templates: templates || [],
  };
}

export function exportWorldFile(state) {
  const payload = buildWorldPayload(state);
  download(`${safeName(payload.name)}.voxworld.json`, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  return payload;
}

export function parseWorldPayload(text) {
  const data = JSON.parse(text);
  if (data.format !== EXPORT_FORMAT) throw new Error('That file is not a Voxel Sandbox world.');
  if (!data.world?.chunks) throw new Error('That world file is missing its block data.');
  return {
    world: World.deserialize(data.world),
    player: data.player,
    gamification: data.gamification,
    economy: data.economy,
    // Campaign is gone; a file exported from one opens as a Creative world,
    // with every block it had still standing.
    mode: data.mode === 'duilt' ? 'duilt' : 'creative',
    duilt: data.duilt ?? null,
    templates: Array.isArray(data.templates) ? data.templates : [],
    name: data.name,
  };
}

// ---------------------------------------------------------------------------
// MagicaVoxel .vox — geometry only, but it opens in MagicaVoxel, Blender and
// most voxel tooling, which a private JSON never will.
// ---------------------------------------------------------------------------

const VOX_LIMIT = 256; // the format's per-axis maximum

function chunkBytes(id, content, children = new Uint8Array(0)) {
  const header = new Uint8Array(12);
  const view = new DataView(header.buffer);
  for (let i = 0; i < 4; i++) header[i] = id.charCodeAt(i);
  view.setUint32(4, content.length, true);
  view.setUint32(8, children.length, true);
  const out = new Uint8Array(header.length + content.length + children.length);
  out.set(header, 0);
  out.set(content, header.length);
  out.set(children, header.length + content.length);
  return out;
}

function concat(arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrays) { out.set(a, o); o += a.length; }
  return out;
}

/**
 * Collects solid blocks into .vox's voxel list. MagicaVoxel is Z-up while the
 * game is Y-up, so the axes are swapped on the way out.
 */
export function buildVox(world, { includeSystem = false } = {}) {
  const sx = Math.min(world.sizeX, VOX_LIMIT);
  const sy = Math.min(world.sizeZ, VOX_LIMIT);
  const sz = Math.min(world.height, VOX_LIMIT);

  const voxels = [];
  for (let x = 0; x < sx; x++) {
    for (let z = 0; z < sy; z++) {
      for (let y = 0; y < sz; y++) {
        const id = world.getBlock(x, y, z);
        if (id === AIR) continue;
        if (!includeSystem && BLOCKS_BY_ID.get(id)?.system) continue;
        voxels.push([x, z, y, id]); // game (x,y,z) -> vox (x,z,y)
      }
    }
  }

  const size = new Uint8Array(12);
  const sizeView = new DataView(size.buffer);
  sizeView.setUint32(0, sx, true);
  sizeView.setUint32(4, sy, true);
  sizeView.setUint32(8, sz, true);

  const xyzi = new Uint8Array(4 + voxels.length * 4);
  new DataView(xyzi.buffer).setUint32(0, voxels.length, true);
  voxels.forEach(([vx, vy, vz, id], i) => {
    const o = 4 + i * 4;
    xyzi[o] = vx; xyzi[o + 1] = vy; xyzi[o + 2] = vz;
    xyzi[o + 3] = id; // palette index; .vox reserves 0, and no block uses it
  });

  // Palette is 255 entries starting at index 1, so a block's id indexes it directly.
  const rgba = new Uint8Array(256 * 4);
  for (const b of BLOCKS) {
    if (b.id < 1 || b.id > 255) continue;
    const o = (b.id - 1) * 4;
    rgba[o] = (b.color >> 16) & 255;
    rgba[o + 1] = (b.color >> 8) & 255;
    rgba[o + 2] = b.color & 255;
    rgba[o + 3] = 255;
  }

  const header = new Uint8Array(8);
  const hv = new DataView(header.buffer);
  'VOX '.split('').forEach((c, i) => { header[i] = c.charCodeAt(0); });
  hv.setUint32(4, 150, true);

  const children = concat([
    chunkBytes('SIZE', size),
    chunkBytes('XYZI', xyzi),
    chunkBytes('RGBA', rgba),
  ]);
  return concat([header, chunkBytes('MAIN', new Uint8Array(0), children)]);
}

export function exportVoxFile(world, name) {
  const bytes = buildVox(world);
  download(`${safeName(name)}.vox`, new Blob([bytes], { type: 'application/octet-stream' }));
  return bytes.length;
}

export function exportTemplateFile(template) {
  const payload = { format: 'voxel-template', version: 1, name: template.name, size: template.size, blocks: template.blocks };
  download(`${safeName(template.name)}.voxtemplate.json`, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
}

/** Opens a file picker and resolves with the file's text. */
export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, text: String(reader.result) });
      reader.readAsText(file);
    };
    input.click();
  });
}
