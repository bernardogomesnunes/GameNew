import { BenchView } from './BenchView.js';
import { BenchBar } from '../ui/BenchBar.js';
import { BENCH_MACHINES, benchStroke } from '../duilt/BenchWork.js';
import { itemName } from '../config/items.js';

/**
 * A bench machine as a close-up (render/CloseUp.js). `game` gives the world's
 * crafting, the stations you stand at and the age; holding on the picture
 * works too, as holding the button does.
 */
export class BenchMachine {
  constructor({ scene, camera, uiRoot, game, onLeave, onMany, onMade }) {
    this.game = game;
    this.onMade = onMade;
    this.view = new BenchView({ scene, camera });
    this.bar = new BenchBar({ root: uiRoot, onHold: (on) => this.hold(on), onPick: (id) => this.pick(id),
      onMany: () => onMany(this.station, this.at), onLeave });
    this.barEl = this.bar.el;
  }

  /** Opens on `station` (a key of BENCH_MACHINES) at the block `at`. */
  use(station) { this.station = station; }

  start(key, at) {
    this.at = at;
    this.machine = BENCH_MACHINES[this.station];
    this.view.start(at, this.machine);
    this.picked = this.picked && this.recipes().some((r) => r.id === this.picked) ? this.picked : this.recipes().find((r) => r.ok)?.id ?? null;
    this.view.show(this.recipes().find((r) => r.id === this.picked));
    this.bar.show();
    this.render();
  }

  end() { this.view.end(); this.bar.hide(); }

  ctx() {
    const d = this.game.duilt, near = { x: this.at.x + 0.5, y: this.at.y, z: this.at.z + 0.5 };
    return { near, atStations: [...d.stationsNear(near), this.station], age: d.sandbox ? Infinity : d.age };
  }

  recipes() {
    const d = this.game.duilt, c = this.ctx();
    return d.crafting.available(c.age, { station: this.station, near: c.near, atStations: c.atStations });
  }

  render(say = '') { this.bar.render({ machine: this.machine, recipes: this.recipes(), picked: this.picked, say, station: this.station }); }

  pick(id) {
    this.picked = id;
    this.view.show(this.recipes().find((r) => r.id === id));
    this.render();
  }

  hold(on) {
    if (on) { if (this.picked) this.view.holding = true; return; }
    if (!this.view.holding) return;
    this.view.holding = false;
    const r = benchStroke(this.game.duilt.crafting, this.picked, this.view.level, this.ctx());
    this.view.level = 0;
    if (r.result === 'made') { this.view.made(); this.onMade?.(r); }
    this.render(r.result === 'made' ? `Made ${r.made.count} ${itemName(r.made.id).toLowerCase()}.`
      : r.result === 'short' ? `Not far enough: nothing spent. Hold ${this.machine.verb} longer.`
        : r.result === 'spoilt' ? 'Too far: the batch was spoilt and its materials lost.' : r.reason ?? '');
  }

  update(dt) {
    this.view.update(dt);
    this.bar.showLevel(this.view.level);
  }

  pointerDown() { this.hold(true); }
  pointerUp() { this.hold(false); }
}
