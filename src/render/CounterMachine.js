import { CounterView } from './CounterView.js';
import { CounterBar } from '../ui/CounterBar.js';

/** A press that moves less than this (in screen halves) is a tap, more is a drag. */
const TAP = 0.03;

/**
 * CRAFT3D-1, CRAFT-9: the Carpenter's Table as a close-up machine
 * (render/CloseUp.js): its 3D view and its bar together. A tap on a part
 * sends it to its place, a drag carries it; Saw is held on the bar or with
 * Space, and keys 1 to 4 tap a part.
 */
export class CounterMachine {
  constructor({ scene, camera, uiRoot, counters, bus, age, onDone, onLeave }) {
    this.view = new CounterView({ scene, camera, counters, bus, onDone: (e) => { onDone?.(e); this.bar.render(); } });
    this.bar = new CounterBar({ root: uiRoot, view: this.view, counters, age, onLeave, onHold: (on) => this.hold(on), onPart: (i) => this.tap(i) });
    this.barEl = this.bar.el;
    this.held = -1;
  }

  /** The world's tables (a different world brings different ones). */
  use(counters) {
    this.view.counters = counters;
    this.bar.counters = counters;
  }

  start(key, at) { this.view.start(key, at); this.bar.show(); }
  end() { this.view.end(); this.bar.hide(); this.held = -1; }
  update(dt) {
    this.view.update(dt);
    this.bar.showLevel(this.view.level);
  }

  /** Saw held (true) or let go (false): in the window the parts come off. */
  hold(on) {
    if (on) {
      const r = this.view.hold();
      if (!r.ok && r.reason) this.bar.render(r.reason);
      return;
    }
    const r = this.view.letGo();
    if (!r) return;
    this.bar.render(r.result === 'cut' ? ''
      : r.result === 'short' ? 'Not far enough: nothing spent. Hold Saw longer.'
        : r.result === 'far' ? 'Too far: the saw slipped. Nothing spent. Let go in the light band.' : r.reason ?? '');
  }

  /** A tap on part `i`: it flies to its place. */
  tap(i) {
    const ok = this.view.tapFit(i);
    this.bar.render();
    return ok;
  }

  /** Desktop keys: Space holds Saw, 1 to 4 tap a part. True when the key was the table's. */
  key(code, down, repeat = false) {
    if (code === 'Space') {
      const w = this.view.key ? this.view.counters.work(this.view.key) : null;
      if (!repeat && w && w.cut < w.fitted.length) this.hold(down);
      return true;
    }
    const n = /^(?:Digit|Numpad)([1-4])$/.exec(code)?.[1];
    if (!n) return false;
    if (down && !repeat) this.tap(Number(n) - 1);
    return true;
  }

  pointerDown(x, y) {
    this.held = this.view.partAt(x, y);
    this.downAt = [x, y];
    this.dragged = false;
  }

  pointerMove(x, y) {
    if (this.held < 0) return;
    if (!this.dragged && Math.hypot(x - this.downAt[0], y - this.downAt[1]) < TAP) return;
    this.dragged = true;
    const p = this.view.pointOnTop(x, y, this.held);
    if (p) this.view.dragTo(this.held, p);
  }

  pointerUp() {
    if (this.held < 0) return;
    if (this.dragged) this.view.drop(this.held);
    else this.view.tapFit(this.held);
    this.held = -1;
    this.bar.render();
  }
}
