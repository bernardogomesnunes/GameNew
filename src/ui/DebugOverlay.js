/**
 * A small readout of what the game is holding on to, for finding out which
 * number climbs while you play on a phone (a leak) and which stays flat.
 *
 * Off unless the address ends in `?debug`. Without it main.js never imports
 * this file, so nothing here is downloaded or run. With it, one timer reads
 * counters every 2 seconds and writes one text node. It adds no frame loop,
 * takes no input (pointer-events: none) and changes nothing in the game.
 *
 * Each row shows the value now, then the change since the first reading
 * taken 20 seconds after the world opened, so a steady climb is visible
 * without doing arithmetic. Rows that only rise over minutes of play, with
 * the chunk count flat, are the leak.
 */

const EVERY_MS = 2000;
const BASELINE_AFTER_MS = 20000;

/** Every row: a label and how to read it. A reader may return null when it does not apply. */
function readings(game) {
  const info = game.renderer?.info;
  const mem = typeof performance !== 'undefined' ? performance.memory : null;
  let objects = 0;
  game.scene?.traverse(() => { objects++; });
  return [
    ['fps', game.quality?.fps ?? null, false],
    ['js heap MB', mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, true],
    ['chunks', game.world?.chunks?.size ?? null, true],
    ['chunk meshes', game.mesher?.activeMeshes?.size ?? null, true],
    ['scene objects', objects, true],
    ['geometries', info?.memory.geometries ?? null, true],
    ['textures', info?.memory.textures ?? null, true],
    ['draw calls', info?.render.calls ?? null, false],
    ['triangles K', info ? Math.round(info.render.triangles / 1000) : null, false],
    ['to mesh', game.remeshQueue?.size ?? game.remeshQueue?.length ?? null, false],
    ['to generate', game.genQueue?.length ?? null, false],
    ['html nodes', document.querySelectorAll('*').length, true],
  ];
}

export function startDebugOverlay(game) {
  const box = document.createElement('pre');
  box.id = 'debug-overlay';
  box.style.cssText = [
    'position:fixed', 'left:calc(env(safe-area-inset-left, 0px) + 6px)',
    'bottom:calc(env(safe-area-inset-bottom, 0px) + 6px)', 'margin:0', 'padding:4px 6px',
    'font:10px/1.3 ui-monospace, Menlo, monospace', 'color:#9f9', 'background:rgba(0,0,0,.6)',
    'border-radius:4px', 'pointer-events:none', 'user-select:none', '-webkit-user-select:none',
    'z-index:2147483647', 'white-space:pre',
  ].join(';');
  document.body.appendChild(box);

  const startedAt = performance.now();
  let baseline = null;
  const peak = {};

  const update = () => {
    if (document.hidden || !game.world) return;
    const rows = readings(game);
    if (!baseline && performance.now() - startedAt > BASELINE_AFTER_MS) {
      baseline = Object.fromEntries(rows.map(([name, value]) => [name, value]));
    }
    const lines = rows.filter(([, value]) => value != null).map(([name, value, tracked]) => {
      peak[name] = Math.max(peak[name] ?? value, value);
      const delta = tracked && baseline?.[name] != null ? value - baseline[name] : null;
      const change = delta == null ? '' : ` ${delta >= 0 ? '+' : ''}${delta}`;
      return `${name.padEnd(14)}${String(value).padStart(6)}${change.padEnd(7)} max ${peak[name]}`;
    });
    box.textContent = lines.join('\n');
  };

  update();
  return setInterval(update, EVERY_MS);
}
