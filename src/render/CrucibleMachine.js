import { CrucibleView } from './CrucibleView.js';
import { CrucibleBar } from '../ui/CrucibleBar.js';

/**
 * CRAFT3D-3's Crucible as a close-up machine (render/CloseUp.js). Holding on
 * the picture pours too, the same as holding the Pour button.
 */
export class CrucibleMachine {
  constructor({ scene, camera, uiRoot, crucibles, age, onLeave, onPoured }) {
    this.view = new CrucibleView({ scene, camera, crucibles });
    this.bar = new CrucibleBar({ root: uiRoot, view: this.view, crucibles, age, onLeave, onPoured });
    this.barEl = this.bar.el;
    this.shape = '';
  }

  use(crucibles) {
    this.view.crucibles = crucibles;
    this.bar.crucibles = crucibles;
  }

  start(key, at) { this.view.start(key, at); this.bar.show(); }
  end() { this.view.end(); this.bar.hide(); }

  update(dt) {
    // The world waits while a machine is open (Game.phase), but the pot in
    // front of you keeps melting: you came to watch it.
    this.view.crucibles.tick(dt);
    this.view.update(dt);
    // The bar is drawn again when what is in the pot changes (a batch melts).
    const s = this.view.key ? this.view.crucibles.state(this.view.key) : null;
    const shape = s ? `${s.waiting}/${s.molten}/${s.out}/${s.mould}` : '';
    if (shape !== this.shape) { this.shape = shape; this.bar.render(); }
    this.bar.showLevel(this.view.level);
  }

  pointerDown() { this.bar.pour(true); }
  pointerUp() { this.bar.pour(false); }
}
