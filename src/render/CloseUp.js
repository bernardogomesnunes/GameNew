/**
 * CRAFT3D: the close-up every crafting machine shares (the Counter, the
 * Crucible, and the ones after). One machine at a time is open: the camera
 * is the machine's (its update sets it), the world waits (Game.phase), the
 * HUD is hidden (`at-machine` on the UI root) and pointer lock is off.
 *
 * A machine is { start(key, at), end(), update(dt), pointerDown?(x, y),
 * pointerMove?(x, y), pointerUp?(), barEl }, with x and y in normalised
 * device coordinates; presses on its bar are left to the bar.
 */
export class CloseUp {
  constructor({ uiRoot, onEnd = () => {} }) {
    this.uiRoot = uiRoot;
    this.onEnd = onEnd;
    this.machine = null;
  }

  get active() {
    return this.machine != null;
  }

  /** Opens `machine` over the block at `at`, closing whichever was open. */
  open(machine, key, at) {
    if (this.machine) this.close();
    this.machine = machine;
    this.uiRoot.classList.add('at-machine');
    machine.start(key, at);
  }

  close() {
    const m = this.machine;
    if (!m) return;
    this.machine = null;
    m.end();
    this.uiRoot.classList.remove('at-machine');
    this.onEnd();
  }

  update(dt) {
    this.machine?.update(dt);
  }
}
