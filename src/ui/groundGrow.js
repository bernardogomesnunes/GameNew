/**
 * The ground that grows behind the bar while a world opens (owner, 17
 * November: "pixel art animation, like the ground growing until filling the
 * whole screen, on the back of the loading bar").
 *
 * Drawn on a small canvas, one pixel a block, stretched with
 * `image-rendering: pixelated`. Each column rises toward a height set by the
 * bar: low rolling hills at the start, the whole screen at 100 per cent.
 * Grass on top, then dirt, then stone with ore; a flower or a tuft now and then.
 */

/** Screen pixels per block. */
export const BLOCK = 10;

const GRASS = ['#5aa53a', '#4c9431'];
const DIRT = ['#8a5a32', '#7a4e2b', '#93633a'];
const STONE = ['#8b8f93', '#7d8185', '#979b9f'];
const ORES = ['#2b2b2e', '#f1c84b', '#3fb7a6', '#c9773a'];
const FLOWERS = ['#f1c84b', '#e2574c', '#f4f0ea', '#7fb9e6'];

/** A small, repeatable random number from two whole numbers. */
export function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * How tall column `x` of `cols` should be, in blocks, out of `rows`, at
 * `pct` per cent. Hills of 0 to 4 blocks ride on a level that climbs from
 * one fifth of the screen to past the top, so at 100 every column fills it.
 */
export function columnTarget(x, cols, rows, pct) {
  const p = Math.max(0, Math.min(100, pct)) / 100;
  const hills = 2 + 1.4 * Math.sin(x * 0.35) + 0.8 * Math.sin(x * 0.11 + 1.7);
  const level = rows * (0.2 + 0.9 * p);
  return Math.min(rows, Math.max(1, Math.round(level + hills - 2)));
}

/** Starts growing on `canvas`; returns { set(pct), fill(), stop() }. */
export function growGround(canvas, { reduced = false } = {}) {
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return { set() {}, fill() {}, stop() {} };
  let cols = 0;
  let rows = 0;
  let heights = [];
  let pct = 0;
  let frame = 0;
  let raf = 0;

  const size = () => {
    const c = Math.max(8, Math.ceil(canvas.clientWidth / BLOCK));
    const r = Math.max(8, Math.ceil(canvas.clientHeight / BLOCK));
    if (c === cols && r === rows) return;
    cols = c; rows = r;
    canvas.width = cols; canvas.height = rows;
    heights = Array.from({ length: cols }, (_, x) => Math.min(heights[x] ?? 0, rows));
  };

  const draw = () => {
    ctx.clearRect(0, 0, cols, rows);
    for (let x = 0; x < cols; x++) {
      const h = Math.floor(heights[x]);
      if (h <= 0) continue;
      const top = rows - h;
      for (let y = top; y < rows; y++) {
        const d = y - top;
        // Grass, a deep band of dirt, then stone with the odd ore in it, so
        // a full screen reads as a slice of the world's ground.
        const r = hash(x, y);
        const pal = d === 0 ? GRASS : d < 9 ? DIRT : r < 0.025 ? ORES : STONE;
        ctx.fillStyle = pal[Math.floor(hash(y, x) * pal.length)];
        ctx.fillRect(x, y, 1, 1);
      }
      // A flower or a tuft on some columns, once the column has some height.
      const r = hash(x, 99);
      if (top > 0 && h > 2 && r < 0.18) {
        ctx.fillStyle = r < 0.07 ? FLOWERS[Math.floor(hash(x, 7) * FLOWERS.length)] : GRASS[1];
        ctx.fillRect(x, top - 1, 1, 1);
      }
    }
  };

  let last = 0;
  let filled = null;
  const tick = (now = performance.now()) => {
    raf = 0;
    size();
    // Time-based, so a slow phone grows as fast as a quick one: each column
    // closes most of its gap in about a third of a second, a block at least.
    const dt = Math.min(0.25, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    let moving = false;
    for (let x = 0; x < cols; x++) {
      const target = columnTarget(x, cols, rows, pct);
      if (heights[x] >= target) continue;
      // Each column at its own pace, so the ground rises unevenly.
      const pace = 4 + 4 * hash(x, frame >> 4);
      const step = reduced ? target : Math.max(0.5, (target - heights[x]) * Math.min(1, dt * pace));
      heights[x] = Math.min(target, heights[x] + step);
      moving = true;
    }
    frame += 1;
    draw();
    if (moving) raf = requestAnimationFrame(tick);
    else if (filled && pct >= 100) { filled(); filled = null; }
  };

  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  size();
  kick();
  return {
    // Drawn at once as well as on the next frames: the game may hold the
    // page up for a while after this, and the browser then shows what's here.
    set(next) { if (next > pct) { pct = next; tick(); } },
    /** Grows to the top; resolves when it's there, or after `maxMs`. */
    fill(maxMs = 700) {
      pct = 100;
      return new Promise((resolve) => {
        filled = resolve;
        setTimeout(resolve, maxMs);
        tick();
      });
    },
    stop() { if (raf) cancelAnimationFrame(raf); raf = 0; },
  };
}
