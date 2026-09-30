import { WANDERERS, WANDERER_NAMES, NEWS } from '../config/wanderers.js';
import { landmarksFor } from './landmarks.js';
import { groundAt, surfaceAt, isLoaded } from './Mobs.js';

/**
 * The people out in the world who aren't yours.
 *
 * The hermit is at the hut and the bandits are at their camps whenever
 * you're near enough to see them; explorers cross the country now and then;
 * a messenger walks to your settlement every so often, says a line of news
 * and walks off again. None of it is saved and none of it asks anything of
 * you — it's what makes the world feel lived in past your own border.
 *
 * Pure logic like Mobs: Game draws `list` with a SettlerView, the same
 * figures as your own settlers, and names whoever you point at.
 */

const TALL = 2;               // a person needs two blocks of headroom
const VISIT = 120;            // a landmark's people are about when you're this close...
const LEAVE = 160;            // ...and gone again past this
const EXPLORERS = 2;          // at most this many crossing at once
const EXPLORER_EVERY = [50, 130];
const MESSENGER_EVERY = [150, 300];
const LINGER = 6;             // seconds a messenger stays to say their piece

export class Wanderers {
  /**
   * @param home    () => { x, z } of your settlement, or null when there's
   *                nowhere for a messenger to go (a sandbox world).
   * @param onNews  (messenger, line) — called once when one arrives.
   */
  constructor({ world, rand = Math.random, home = null, onNews = null }) {
    this.world = world;
    this.rand = rand;
    this.home = home;
    this.onNews = onNews;
    this.landmarks = world.gen ? landmarksFor(world.gen) : [];
    this.list = [];
    this.present = new Set();
    this.nextId = 1;
    this.untilExplorer = this.between(EXPLORER_EVERY) * 0.3;
    this.untilMessenger = this.between(MESSENGER_EVERY) * 0.5;
  }

  between([lo, hi]) {
    return lo + this.rand() * (hi - lo);
  }

  tick(dt, player) {
    this.list = this.list.filter((p) => !this.gone(p, player));
    for (const lm of this.landmarks) {
      if (!this.present.has(lm) && Math.hypot(lm.x - player.x, lm.z - player.z) < VISIT) this.populate(lm);
    }

    this.untilExplorer -= dt;
    if (this.untilExplorer <= 0) {
      this.untilExplorer = this.between(EXPLORER_EVERY);
      if (this.count('explorer') < EXPLORERS) this.sendExplorer(player);
    }
    const home = this.home?.();
    if (home) {
      this.untilMessenger -= dt;
      if (this.untilMessenger <= 0) {
        this.untilMessenger = this.between(MESSENGER_EVERY);
        if (!this.count('messenger')) this.sendMessenger(home);
      }
    }

    for (const p of this.list) {
      this.think(p, dt, player);
      this.move(p, dt);
    }
  }

  count(kind) {
    return this.list.filter((p) => p.kind === kind).length;
  }

  gone(p, player) {
    if (p.landmark) {
      if (Math.hypot(p.landmark.x - player.x, p.landmark.z - player.z) <= LEAVE) return false;
      this.present.delete(p.landmark);
      return true;
    }
    return p.done || Math.hypot(p.x - player.x, p.z - player.z) > LEAVE + 40;
  }

  person(kind, x, y, z, extra = {}) {
    const spec = WANDERERS[kind];
    return {
      id: this.nextId++, kind, x, y, z,
      name: WANDERER_NAMES[Math.floor(this.rand() * WANDERER_NAMES.length)],
      colour: spec.colours[Math.floor(this.rand() * spec.colours.length)],
      target: null, speed: 0, timer: this.rand() * 3, detour: 0, vy: 0,
      ...extra,
    };
  }

  // ---- arriving -----------------------------------------------------------

  /** The hermit at their door, or three or four bandits round their fire. */
  populate(lm) {
    if (!isLoaded(this.world, lm.x, lm.z)) return;
    this.present.add(lm);
    const home = { x: lm.x + 0.5, z: lm.z + 0.5 };
    if (lm.kind === 'hermit') {
      this.list.push(this.person('hermit', lm.x + 0.5, lm.y, lm.z + 3.5, { landmark: lm, home }));
      return;
    }
    const n = 3 + Math.floor(this.rand() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rand() * 0.5;
      const x = lm.x + 0.5 + Math.cos(a) * 3, z = lm.z + 0.5 + Math.sin(a) * 3;
      const y = surfaceAt(this.world, Math.floor(x), Math.floor(z)) ?? lm.y;
      this.list.push(this.person('bandit', x, y, z, { landmark: lm, home }));
    }
  }

  /** Someone crossing the country, on a line that passes near you. */
  sendExplorer(player) {
    const a = this.rand() * Math.PI * 2;
    const x = player.x + Math.cos(a) * 70, z = player.z + Math.sin(a) * 70;
    const y = surfaceAt(this.world, Math.floor(x), Math.floor(z));
    if (y == null) return null;
    const on = a + Math.PI + (this.rand() - 0.5) * 0.7;
    const goal = { x: player.x + Math.cos(on) * 110, z: player.z + Math.sin(on) * 110 };
    const p = this.person('explorer', x, y, z, { goal });
    this.list.push(p);
    return p;
  }

  /** Someone walking in to your settlement with news. */
  sendMessenger(home) {
    const a = this.rand() * Math.PI * 2;
    const x = home.x + Math.cos(a) * 60, z = home.z + Math.sin(a) * 60;
    const y = surfaceAt(this.world, Math.floor(x), Math.floor(z));
    if (y == null) return null;
    const p = this.person('messenger', x, y, z, { goal: { x: home.x, z: home.z }, stage: 'coming', settlement: home });
    this.list.push(p);
    return p;
  }

  /** One line of news, pointing the way to somewhere real when there is one. */
  newsFrom(home) {
    const lm = this.landmarks.length && this.rand() < 0.75
      ? this.landmarks[Math.floor(this.rand() * this.landmarks.length)]
      : null;
    const lines = lm ? NEWS[lm.kind] : NEWS.quiet;
    const line = lines[Math.floor(this.rand() * lines.length)];
    return lm ? line.replace('{dir}', compass(lm.x - home.x, lm.z - home.z)) : line;
  }

  // ---- behaving -----------------------------------------------------------

  think(p, dt, player) {
    const spec = WANDERERS[p.kind];
    if (p.detour > 0) { p.detour -= dt; return; }

    if (p.kind === 'hermit' || p.kind === 'bandit') {
      const dx = p.x - player.x, dz = p.z - player.z;
      const d = Math.hypot(dx, dz) || 1;
      // Bandits don't come to you — not yet. They back off and watch.
      if (spec.wary && d < spec.wary) {
        p.target = this.withinRoam(p, p.x + (dx / d) * 3, p.z + (dz / d) * 3);
        p.speed = spec.speed;
        return;
      }
      p.timer -= dt;
      if (p.timer > 0) return;
      p.timer = 3 + this.rand() * 5;
      if (this.rand() < 0.5) { p.target = null; p.speed = 0; return; }
      const a = this.rand() * Math.PI * 2, r = this.rand() * spec.roam;
      p.target = { x: p.home.x + Math.cos(a) * r, z: p.home.z + Math.sin(a) * r };
      p.speed = spec.speed * 0.7;
      return;
    }

    if (p.kind === 'messenger' && p.stage === 'lingering') {
      p.linger -= dt;
      if (p.linger > 0) return;
      const a = this.rand() * Math.PI * 2;
      p.goal = { x: p.x + Math.cos(a) * 150, z: p.z + Math.sin(a) * 150 };
      p.stage = 'leaving';
    }

    p.target = p.goal;
    p.speed = spec.speed;
    if (Math.hypot(p.goal.x - p.x, p.goal.z - p.z) > 3) return;
    if (p.kind === 'messenger' && p.stage === 'coming') {
      p.stage = 'lingering';
      p.linger = LINGER;
      p.target = null;
      p.speed = 0;
      this.onNews?.(p, this.newsFrom(p.settlement));
      return;
    }
    p.done = true;
  }

  /** A point pulled back inside a landmark's roaming circle. */
  withinRoam(p, x, z) {
    const r = WANDERERS[p.kind].roam;
    const dx = x - p.home.x, dz = z - p.home.z, d = Math.hypot(dx, dz);
    return d <= r ? { x, z } : { x: p.home.x + (dx / d) * r, z: p.home.z + (dz / d) * r };
  }

  move(p, dt) {
    if (p.target && p.speed > 0) {
      const dx = p.target.x - p.x, dz = p.target.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.2) {
        if (p.detour <= 0 && !p.goal) { p.target = null; p.speed = 0; }
      } else {
        const step = Math.min(dist, p.speed * dt);
        let nx = p.x + (dx / dist) * step, nz = p.z + (dz / dist) * step;
        let ground = groundAt(this.world, nx, nz, p.y, TALL);
        if (ground == null && Math.abs(dx) > 0.05) {
          const g = groundAt(this.world, p.x + Math.sign(dx) * step, p.z, p.y, TALL);
          if (g != null) { nx = p.x + Math.sign(dx) * step; nz = p.z; ground = g; }
        }
        if (ground == null && Math.abs(dz) > 0.05) {
          const g = groundAt(this.world, p.x, p.z + Math.sign(dz) * step, p.y, TALL);
          if (g != null) { nx = p.x; nz = p.z + Math.sign(dz) * step; ground = g; }
        }
        if (ground == null) {
          // Something in the way: step off at an angle for a moment and try again.
          const a = Math.atan2(dx, dz) + (this.rand() < 0.5 ? 1 : -1) * (Math.PI / 3 + this.rand() * 0.6);
          p.target = { x: p.x + Math.sin(a) * 5, z: p.z + Math.cos(a) * 5 };
          p.detour = 2;
          if (!p.goal) p.timer = 0;
        } else {
          p.x = nx;
          p.z = nz;
          if (ground > p.y) { p.y = ground; p.vy = 0; }
        }
      }
    }
    const ground = groundAt(this.world, p.x, p.z, p.y, TALL);
    if (ground == null) return;
    if (p.y <= ground) { p.y = ground; p.vy = 0; return; }
    p.vy -= 22 * dt;
    p.y = Math.max(ground, p.y + p.vy * dt);
  }
}

/** Which way (dx, dz) points, as a word: north is -z, east is +x. */
export function compass(dx, dz) {
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const a = (Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2);
  return names[Math.round(a / (Math.PI / 4)) % 8];
}
