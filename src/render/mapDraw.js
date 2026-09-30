import { biomeCssColours, waterCssColour } from './biomePalette.js';

/**
 * Samples a square of the world into a grid of CSS colours, centred on a
 * point.
 *
 * Read straight from the generator rather than from any real block — the
 * same choice FarTerrain makes for country past render distance, and for
 * the same reason: asking real chunks for a wide area would generate every
 * one of them just to look at it (see ChunkMesher's own history with
 * exactly that mistake), and a biome never changes under an edit anyway
 * (ChunkGen.resurface reads it straight back off the generator too, not
 * off what got built there) — so there is nothing a block edit would show
 * here that the generator doesn't already say, close up or far out alike.
 */
export function sampleTerrainGrid(gen, centreX, centreZ, { radius, step }) {
  const colours = biomeCssColours();
  const water = waterCssColour();
  const size = Math.max(1, Math.round((radius * 2) / step));
  const cells = new Array(size * size);
  for (let gz = 0; gz < size; gz++) {
    for (let gx = 0; gx < size; gx++) {
      const wx = Math.round(centreX - radius + gx * step);
      const wz = Math.round(centreZ - radius + gz * step);
      const isWater = !!gen.waterLevelAt(wx, wz);
      cells[gz * size + gx] = isWater ? water : (colours[gen.biomeIndexAt(wx, wz)] ?? colours[0]);
    }
  }
  return { size, step, cells };
}

/** Where a world point lands on a canvas centred on (cx, cz) covering ±radius. */
export function worldToCanvas(wx, wz, cx, cz, radius, canvasW, canvasH) {
  return [
    canvasW / 2 + ((wx - cx) / (radius * 2)) * canvasW,
    canvasH / 2 + ((wz - cz) / (radius * 2)) * canvasH,
  ];
}

/**
 * The "you are here" arrowhead, drawn at the canvas centre and turned to
 * match which way the player is actually looking.
 *
 * North is -Z, up on the canvas — the same axes `worldToCanvas` uses. A
 * yaw of 0 points the camera down -Z (see PlayerController's own forward
 * vector), which is why the arrow needs no rotation there; `-yaw` after
 * that matches canvas rotation (clockwise for a growing angle) to the way
 * turning the camera left swings its forward vector towards -X, which is
 * left on this same map.
 */
export function drawHeadingArrow(ctx, cx, cy, yaw, size = 8) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-yaw);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.6, size * 0.7);
  ctx.lineTo(0, size * 0.35);
  ctx.lineTo(-size * 0.6, size * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Paints a sampled grid onto a canvas, one filled cell at a time. */
export function paintGrid(ctx, canvasW, canvasH, size, cells) {
  const cell = canvasW / size;
  ctx.clearRect(0, 0, canvasW, canvasH);
  for (let gz = 0; gz < size; gz++) {
    for (let gx = 0; gx < size; gx++) {
      ctx.fillStyle = cells[gz * size + gx];
      // The +1 overlap papers over the seams float rounding leaves between
      // adjacent cells — a hairline gap of background colour otherwise
      // shows through as a grid nobody drew on purpose.
      ctx.fillRect(gx * cell, gz * cell, cell + 1, cell + 1);
    }
  }
  return cell;
}
