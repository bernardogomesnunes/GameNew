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
   * @param screens ids that are not panels but backdrops — the worlds screen is
   *                an overlay too, and it is the thing you are *on*, not a
   *                thing in front of you. Panels stack over a screen and
   *                closing one returns you to it.
   */
  constructor(root, { screens = [] } = {}) {
    this.root = root;
    this.screens = new Set(screens);
    this.order = [];          // panel ids, oldest first
    this.openHooks = [];
    this.closeHooks = [];
  }

  isScreen(id) {
    return this.screens.has(id);
  }

  /** Every overlay, screens included. */
  all() {
    return [...this.root.querySelectorAll('.overlay[id]')];
  }

  /** The panels proper — what Escape closes and what counts as "in front of me". */
  panels() {
    return this.all().filter((el) => !this.screens.has(el.id));
  }

  el(id) {
    return this.root.querySelector(`#${CSS.escape(id)}`);
  }

  isOpen(id) {
    const el = this.el(id);
    return !!el && !el.hidden;
  }

  /** Open panels, in the order they were opened. Screens are not panels. */
  openIds() {
    return this.panels().filter((el) => !el.hidden).map((el) => el.id)
      .sort((a, b) => this.order.indexOf(a) - this.order.indexOf(b));
  }

  anyOpen() {
    return this.panels().some((el) => !el.hidden);
  }

  /**
   * Opens a panel, closing whatever else was open.
   *
   * One at a time, always. A shortcut pressed with the bag already up used to
   * stack a second panel on the first, and the one underneath was then
   * unreachable without closing the top one — which nothing said you had to
   * do. Making it a property of the registry means it holds for every panel
   * that will ever exist, rather than every caller having to remember.
   *
   * A screen is the exception, because it is underneath rather than alongside:
   * opening Settings from the worlds screen used to hide the worlds screen, so
   * closing Settings dropped you into whatever world happened to be loaded —
   * one you never chose, already falling. Now the screen stays put and you come
   * back to it.
   */
  open(id) {
    const el = this.el(id);
    if (!el) return false;
    if (this.isScreen(id)) {
      // A screen coming up is a change of place: nothing that was in front of
      // the old one belongs in front of the new one.
      this.closeAll();
    } else {
      for (const other of this.openIds()) if (other !== id) this.close(other);
    }
    if (el.hidden) {
      el.hidden = false;
      if (!this.isScreen(id)) this.order = this.order.filter((x) => x !== id).concat(id);
      for (const fn of this.openHooks) fn(id);
    }
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

  /**
   * Closes the most recently opened panel. With the one-at-a-time rule above
   * there is normally only one, but the order is still what decides — nothing
   * stops a future caller from showing two deliberately. A screen is never
   * closed this way: Escape puts away what is in front of you, and the screen
   * is what you are standing on.
   */
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
