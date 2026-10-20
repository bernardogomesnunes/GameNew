import { isDesktop } from './desktop.js';

/**
 * Pop-ups as windows on a desktop (asked for directly: "in desktop we could
 * have pop ups that can move inside the screen, and then I can open my
 * inventory and interact with them").
 *
 * - Dragged by the title bar, kept inside the screen. Where you put one is
 *   where it opens next time, this session.
 * - Two open together (Panels' companions — the bag beside a storehouse)
 *   start side by side when there's room, the newer on the right; a click
 *   on either brings it to the front. Close one and the other goes back to
 *   the middle, unless you'd moved it yourself.
 *
 * Nothing changes on a phone: a pop-up there is the screen.
 */

const MARGIN = 8, GAP = 16;

export function bindPanelWindows(root, panels) {
  // id → { x, y, auto } — `auto` when it was put there, not dragged there.
  const offsets = new Map();
  const panelOf = (id) => panels.el(id)?.querySelector(':scope > .panel') ?? null;

  const set = (id, off) => {
    const p = panelOf(id);
    if (!p) return;
    if (!off) { p.style.translate = ''; offsets.delete(id); return; }
    p.style.translate = `${Math.round(off.x)}px ${Math.round(off.y)}px`;
    offsets.set(id, off);
  };

  /** Where it sits with no offset: what an offset is measured from. */
  const homeRect = (id) => {
    const p = panelOf(id);
    const was = p.style.translate;
    p.style.translate = '';
    const r = p.getBoundingClientRect();
    p.style.translate = was;
    return r;
  };

  const inside = (id, off) => {
    const r = homeRect(id);
    const x = Math.max(MARGIN - r.left, Math.min(innerWidth - MARGIN - r.right, off.x));
    const y = Math.max(MARGIN - r.top, Math.min(innerHeight - MARGIN - r.bottom, off.y));
    return { ...off, x, y };
  };

  panels.onOpen((id) => {
    if (panels.isScreen(id)) return;
    if (!isDesktop()) { set(id, null); return; }
    const open = panels.openIds();
    const other = open.find((x) => x !== id);
    const mine = offsets.get(id);
    if (other && !(mine && !mine.auto)) {
      // Side by side, when the two fit across the screen.
      const a = homeRect(other).width, b = homeRect(id).width;
      if (a + b + GAP <= innerWidth - 2 * MARGIN) {
        const theirs = offsets.get(other);
        set(other, inside(other, { x: -(b + GAP) / 2, y: theirs?.auto === false ? theirs.y : 0, auto: true }));
        set(id, inside(id, { x: (a + GAP) / 2, y: 0, auto: true }));
        return;
      }
    }
    if (mine) set(id, inside(id, mine));
  });

  panels.onClose((id) => {
    if (offsets.get(id)?.auto) set(id, null);
    // The one left goes back to the middle, if it was only moved aside.
    for (const other of panels.openIds()) if (offsets.get(other)?.auto) set(other, null);
  });

  root.addEventListener('pointerdown', (e) => {
    const overlay = e.target.closest?.('.overlay[id]');
    if (!overlay || panels.isScreen(overlay.id)) return;
    // A click on either of two brings it to the front.
    if (overlay.classList.contains('paired') && e.target.closest('.panel')) panels.toFront(overlay.id);
    if (e.button !== 0 || e.pointerType !== 'mouse' || !isDesktop()) return;
    const head = e.target.closest('.panel-head');
    if (!head || e.target.closest('button, input, select, textarea, a, [role="button"]')) return;
    e.preventDefault();
    const id = overlay.id;
    const from = { x: e.clientX, y: e.clientY };
    const base = offsets.get(id) ?? { x: 0, y: 0 };
    const move = (ev) => set(id, inside(id, { x: base.x + ev.clientX - from.x, y: base.y + ev.clientY - from.y, auto: false }));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('panel-dragging');
    };
    document.body.classList.add('panel-dragging');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  // A smaller window keeps what's open inside it.
  window.addEventListener('resize', () => {
    for (const id of panels.openIds()) {
      const off = offsets.get(id);
      if (off) set(id, inside(id, off));
    }
  });

  return { offsets };
}
