/**
 * One registry for every overlay panel.
 *
 * There were three hardcoded lists of panel ids — one to decide whether
 * anything was open, one for Escape to close, one inside the Duilt layer — and
 * they had already drifted apart. A panel added to two of them closed on
 * Escape; a panel added to none of them did not. That is the kind of bug you
 * cannot fix by being careful, only by not keeping the list twice.
 *
 * So there is no list. A panel is any `.overlay` with an id, found in the DOM
 * when asked, which means one added anywhere is registered by existing. Open
 * order is tracked so Escape closes the one you are actually looking at rather
 * than all of them at once.
 */

export class Panels {
  /**
   * @param root    the element panels live under
   * @param exclude ids that look like panels but are not — the worlds screen is
   *                an overlay too, and Escape must not dismiss it into a world
   *                the player never chose.
   */
  constructor(root, { exclude = [] } = {}) {
    this.root = root;
    this.exclude = new Set(exclude);
    this.order = [];          // ids, oldest first
    this.openHooks = [];
    this.closeHooks = [];
  }

  all() {
    return [...this.root.querySelectorAll('.overlay[id]')]
      .filter((el) => !this.exclude.has(el.id));
  }

  el(id) {
    const found = this.root.querySelector(`#${CSS.escape(id)}`);
    return found && !this.exclude.has(id) ? found : null;
  }

  isOpen(id) {
    return !!this.el(id) && !this.el(id).hidden;
  }

  /** Open panels, in the order they were opened. */
  openIds() {
    return this.all().filter((el) => !el.hidden).map((el) => el.id)
      .sort((a, b) => this.order.indexOf(a) - this.order.indexOf(b));
  }

  anyOpen() {
    return this.all().some((el) => !el.hidden);
  }

  open(id) {
    const el = this.el(id);
    if (!el) return false;
    el.hidden = false;
    this.order = this.order.filter((x) => x !== id).concat(id);
    for (const fn of this.openHooks) fn(id);
    return true;
  }

  close(id) {
    const el = this.el(id);
    if (!el || el.hidden) return false;
    el.hidden = true;
    this.order = this.order.filter((x) => x !== id);
    for (const fn of this.closeHooks) fn(id);
    return true;
  }

  /** Closes the most recently opened panel. Returns its id, or null. */
  closeTop() {
    const open = this.openIds();
    if (!open.length) return null;
    const id = open[open.length - 1];
    this.close(id);
    return id;
  }

  closeAll() {
    let n = 0;
    for (const id of this.openIds()) if (this.close(id)) n++;
    return n;
  }

  onOpen(fn) { this.openHooks.push(fn); }
  onClose(fn) { this.closeHooks.push(fn); }
}

/**
 * Whether a key event belongs to something the player is typing into.
 *
 * Without this, every shortcut in the game fires while you fill in a form: an
 * "e" opens the workbench, a space makes you jump, "f" starts you flying. It
 * was first hit typing an email address into the sign-in box on a phone, where
 * the panels it opened covered the keyboard.
 */
export function isTyping(event) {
  const el = event?.target;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}
