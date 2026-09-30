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
export function drawWorldMap(canvas, gen, x, z, yaw, { radius = MAP_ZOOMS[1], step = null, home = null, territory = null } = {}) {
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

  drawHeadingArrow(ctx, width / 2, height / 2, yaw, 10);
}
