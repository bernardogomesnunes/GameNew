import { isDesktop } from './desktop.js';

/**
 * Dragging a stack from one pop-up to another with the mouse, on a desktop:
 * out of the bag onto a storehouse's shelves or the storage controller, or
 * back the other way (asked for directly: "then I can open my inventory and
 * interact with them"). A click still does what it always did; only a press
 * that moves becomes a drag.
 *
 * Done with pointer events rather than the browser's own drag and drop,
 * which won't drag a <button> everywhere — and every slot is one.
 *
 * @param root     where the pop-ups are
 * @param sourceOf (element pressed) → { kind, ref, el } or null
 * @param zoneOf   (element under the mouse) → { kind, el } or null
 * @param drop     (source, zone kind) — called only across kinds
 */

/** How far a press moves before it's a drag rather than a click. */
const START = 6;

export function bindSlotDrag(root, { sourceOf, zoneOf, drop }) {
  let press = null, ghost = null, over = null;

  const target = (e) => zoneOf(document.elementFromPoint(e.clientX, e.clientY));
  const mark = (zone) => {
    if (zone?.el === over?.el) return;
    over?.el.classList.remove('drop-ready');
    over = zone;
    over?.el.classList.add('drop-ready');
  };

  const move = (e) => {
    if (!press) return;
    if (!press.dragging) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < START) return;
      press.dragging = true;
      // The bag's own press-and-hold (it splits a stack) mustn't go off mid-drag.
      press.src.el.dispatchEvent(new Event('pointercancel'));
      ghost = document.createElement('div');
      ghost.className = 'slot-ghost';
      ghost.appendChild(press.src.el.cloneNode(true));
      document.body.appendChild(ghost);
      press.src.el.classList.add('drag-source');
    }
    ghost.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 28}px)`;
    const zone = target(e);
    mark(zone && zone.kind !== press.src.kind ? zone : null);
  };

  const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };

  const up = (e) => {
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', up, true);
    const p = press;
    press = null;
    if (!p?.dragging) return;
    // Not a tap as well: the slot's own pointerup and the click after it.
    e.stopPropagation();
    window.addEventListener('click', swallow, true);
    setTimeout(() => window.removeEventListener('click', swallow, true), 0);
    ghost?.remove();
    ghost = null;
    p.src.el.classList.remove('drag-source');
    mark(null);
    const zone = target(e);
    if (zone && zone.kind !== p.src.kind) drop(p.src, zone.kind);
  };

  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType !== 'mouse' || !isDesktop()) return;
    const src = sourceOf(e.target);
    if (!src) return;
    press = { src, x: e.clientX, y: e.clientY, dragging: false };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
  });
}
