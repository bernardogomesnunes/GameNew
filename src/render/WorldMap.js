import { sampleTerrainGrid, paintGrid, drawHeadingArrow, worldToCanvas } from './mapDraw.js';

/** How far out each zoom step shows, in blocks. */
export const MAP_ZOOMS = [300, 600, 1200];

/**
 * The full map behind the Map panel — every device gets this one, unlike
 * the minimap (see Minimap.js). A snapshot centred on wherever you were
 * standing when it opened, not a live view: re-sampling a stretch of world
 * this wide is real work, and nothing about the ground moves while a panel
 * is open over it the way you do.
 */
export function drawWorldMap(canvas, gen, x, z, yaw, { radius = MAP_ZOOMS[1], step = null, home = null, territory = null, places = [], sites = [] } = {}) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  // Coarser sampling the wider the view — a 1200-block view sampled every
  // 2 blocks is 600x600 cells for a view nothing on screen can resolve
  // past a few hundred pixels of anyway.
  const cellStep = step ?? Math.max(2, Math.round(radius / 150));
  const { size, cells } = sampleTerrainGrid(gen, x, z, { radius, step: cellStep });
  paintGrid(ctx, width, height, size, cells);

  if (territory) {
    const [x0, y0] = worldToCanvas(territory.minX, territory.minZ, x, z, radius, width, height);
    const [x1, y1] = worldToCanvas(territory.maxX, territory.maxZ, x, z, radius, width, height);
    ctx.strokeStyle = 'rgba(255, 214, 110, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }

  if (home && Math.abs(home.x - x) < radius && Math.abs(home.z - z) < radius) {
    const [hx, hy] = worldToCanvas(home.x, home.z, x, z, radius, width, height);
    ctx.fillStyle = '#ffd66e';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(hx, hy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Places you've found (playtest, P4): a diamond in each kind's colour.
  for (const p of places) {
    if (Math.abs(p.x - x) >= radius || Math.abs(p.z - z) >= radius) continue;
    const [px, py] = worldToCanvas(p.x, p.z, x, z, radius, width, height);
    ctx.fillStyle = PLACE_COLOURS[p.kind] ?? '#ffffff';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py - 8); ctx.lineTo(px + 8, py); ctx.lineTo(px, py + 8); ctx.lineTo(px - 8, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // The two kingdoms: a marker and its name where it is, or — off the edge
  // of this view, as the Sky Kingdom always is — an arrow on the edge
  // pointing the way, with how far.
  for (const s of sites) drawSite(ctx, s, x, z, radius, width, height);

  drawHeadingArrow(ctx, width / 2, height / 2, yaw, 10);
}

/** The colour each kingdom is marked in. */
export const SITE_COLOURS = { kingdom: '#2a2533', sky: '#f3cf6a' };

function drawSite(ctx, s, x, z, radius, width, height) {
  const fill = SITE_COLOURS[s.kind] ?? '#ffffff';
  const inside = Math.abs(s.x - x) < radius && Math.abs(s.z - z) < radius;
  let [px, py] = worldToCanvas(s.x, s.z, x, z, radius, width, height);
  const far = Math.round(Math.hypot(s.x - x, s.z - z));
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillStyle = fill;
  if (inside) {
    // A little castle: a block with three merlons.
    ctx.beginPath();
    ctx.rect(px - 9, py - 5, 18, 12);
    for (const dx of [-9, -3, 3]) ctx.rect(px + dx, py - 10, 6, 5);
    ctx.fill(); ctx.stroke();
  } else {
    // Pulled in to the edge, an arrow pointing out at it.
    const cx = width / 2, cy = height / 2, a = Math.atan2(py - cy, px - cx);
    const reach = Math.min((cx - 22) / Math.abs(Math.cos(a) || 1e-9), (cy - 22) / Math.abs(Math.sin(a) || 1e-9));
    px = cx + Math.cos(a) * reach; py = cy + Math.sin(a) * reach;
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(a) * 12, py + Math.sin(a) * 12);
    ctx.lineTo(px + Math.cos(a + 2.4) * 10, py + Math.sin(a + 2.4) * 10);
    ctx.lineTo(px + Math.cos(a - 2.4) * 10, py + Math.sin(a - 2.4) * 10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  const label = inside ? s.name : `${s.name} · ${far.toLocaleString('en')}`;
  ctx.font = 'bold 18px system-ui, sans-serif';
  const w = ctx.measureText(label).width;
  const lx = Math.max(6, Math.min(width - w - 6, px - w / 2)), ly = py + (py > height - 40 ? -18 : 30);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.strokeText(label, lx, ly);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, lx, ly);
}

/** The colour each kind of place is marked in on the map. */
export const PLACE_COLOURS = {
  kingdom: '#1e1a24', hermit: '#9be38a', camp: '#e0574a', ruin: '#c9c2b0', ruined_temple: '#f2f0ea', mine: '#9a7350', monument: '#3a3440',
};
