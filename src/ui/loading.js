/**
 * The loading screen (asked for directly: "a loading screen in style with the
 * game showing progress"). Its markup and look are in index.html, so it's up
 * before any of this has downloaded; this moves the bar and takes it away.
 *
 * The bar moves in steps, each one a real stage of starting up: the game's
 * code arriving, the world being made, and the land around the title scene
 * being drawn — counted chunk by chunk.
 */

const el = () => document.getElementById('loading');
/** Near enough all there: the last few chunks at the edge fill in under the fade. */
const ENOUGH = 0.95;

/** Sets the bar to `pct` (0-100, never backwards) and, if given, what it's doing. */
export function loadingProgress(pct, label) {
  const root = el();
  if (!root) return;
  const fill = root.querySelector('.ld-fill');
  const now = Number(root.getAttribute('aria-valuenow')) || 0;
  const to = Math.max(now, Math.min(100, Math.round(pct)));
  if (fill) fill.style.width = `${to}%`;
  root.setAttribute('aria-valuenow', String(to));
  if (label) root.querySelector('.ld-label').textContent = label;
}

/** Fades it out and removes it. */
export function loadingDone() {
  const root = el();
  if (!root || root.classList.contains('ld-gone')) return;
  loadingProgress(100);
  root.classList.add('ld-gone');
  setTimeout(() => root.remove(), 600);
}

/** Resolves after the browser has drawn what's changed, so a label shows before a long step. */
export function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/**
 * Follows the title scene's land being drawn: `progress()` is how much of it
 * is, 0..1 (Game.titleProgress). The bar goes from `from` to 100 with it, and
 * the screen goes once it's (nearly) all there — or after `maxMs`, so a slow device is
 * never kept waiting on the last few chunks.
 */
export function followDrawing(progress, { from = 70, maxMs = 15000 } = {}) {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = () => {
      const done = Math.max(0, Math.min(1, progress()));
      loadingProgress(from + (100 - from) * done);
      if (done >= ENOUGH || performance.now() - start > maxMs) return resolve();
      requestAnimationFrame(step);
    };
    step();
  });
}
