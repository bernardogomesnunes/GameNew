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
export function drawWorldMap(canvas, gen, x, z, yaw, { radius = MAP_ZOOMS[1], step = null, home = null, territory = null, places = [] } = {}) {
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

  drawHeadingArrow(ctx, width / 2, height / 2, yaw, 10);
}

/** The colour each kind of place is marked in on the map. */
export const PLACE_COLOURS = {
  hermit: '#9be38a', camp: '#e0574a', ruin: '#c9c2b0', ruined_temple: '#f2f0ea', mine: '#9a7350', monument: '#3a3440',
};
