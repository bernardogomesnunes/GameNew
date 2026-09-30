import { sampleTerrainGrid, paintGrid, drawHeadingArrow } from './mapDraw.js';

/**
 * The always-on corner instrument — desktop only. A phone gets the same
 * information from the Map panel instead (see UIManager/panels.js): a HUD
 * element eating a corner of the screen costs nothing on a monitor and
 * costs a thumb's worth of touch-control room on a phone, for a view small
 * enough that it was never going to show much a full map wouldn't anyway.
 *
 * Redrawn on a timer rather than every frame — see Game.js's own throttle —
 * because walking a couple of blocks does not change which biome you are
 * standing in.
 */
export class Minimap {
  constructor(canvas, { radius = 64, step = 2 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.radius = radius;
    this.step = step;
  }

  update(gen, x, z, yaw) {
    if (!gen) return;
    const { size, cells } = sampleTerrainGrid(gen, x, z, { radius: this.radius, step: this.step });
    const { width, height } = this.canvas;
    paintGrid(this.ctx, width, height, size, cells);
    drawHeadingArrow(this.ctx, width / 2, height / 2, yaw, 7);
  }
}
