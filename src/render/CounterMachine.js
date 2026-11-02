import { CounterView } from './CounterView.js';
import { CounterBar } from '../ui/CounterBar.js';

/**
 * CRAFT3D-1's Counter as a close-up machine (render/CloseUp.js): its 3D view
 * and its bar together, and dragging a part on the picture.
 */
export class CounterMachine {
  constructor({ scene, camera, uiRoot, counters, bus, age, onDone, onLeave }) {
    this.view = new CounterView({ scene, camera, counters, bus, onDone: (e) => { onDone?.(e); this.bar.render(); } });
    this.bar = new CounterBar({ root: uiRoot, view: this.view, counters, age, onLeave });
    this.barEl = this.bar.el;
    this.held = -1;
  }

  /** The world's counters (a different world brings different ones). */
  use(counters) {
    this.view.counters = counters;
    this.bar.counters = counters;
  }

  start(key, at) { this.view.start(key, at); this.bar.show(); }
  end() { this.view.end(); this.bar.hide(); this.held = -1; }
  update(dt) { this.view.update(dt); }

  pointerDown(x, y) { this.held = this.view.partAt(x, y); }
  pointerMove(x, y) {
    if (this.held < 0) return;
    const p = this.view.pointOnTop(x, y, this.held);
    if (p) this.view.dragTo(this.held, p);
  }
  pointerUp() {
    if (this.held < 0) return;
    this.view.drop(this.held);
    this.held = -1;
    this.bar.render();
  }
}
