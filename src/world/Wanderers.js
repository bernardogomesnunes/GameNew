import { WANDERERS, WANDERER_NAMES, NEWS } from '../config/wanderers.js';
import { landmarksFor } from './landmarks.js';
import { groundAt, surfaceAt, isLoaded } from './Mobs.js';

/**
 * The people out in the world who aren't yours.
 *
 * The hermit is at the hut and the bandits are at their camps whenever
 * you're near enough to see them; explorers cross the country now and then;
 * a messenger walks to your settlement every so often, says a line of news
 * and walks off again. None of it is saved — it's what makes the world feel
 * lived in past your own border.
 *
 * The bandits are the exception that asks something of you (Phase 6b,
 * chosen directly). From Age 2 on they're hostile: walk up to a camp and
 * they come for you, and most nights a few of them walk in from the camp's
 * direction to rob a storehouse — or you, if you have none. Hit one and it
 * fights back; hurt one badly and it runs. Before Age 2 they only watch,
 * unless you start it.
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

// Fighting (Phase 6b).
const LEASH = 32;             // a camp bandit won't chase you further than this from its fire
const HURT_FLASH = 0.3;       // seconds a struck figure shows red
const RECOVER_EVERY = 6;      // a bandit that got away heals a point this often
const RAID_CHANCE = 0.7;      // most nights, not every night
const RAID_FROM = 50;         // raiders turn up this far out from your settlement
const RAID_RANGE = 600;       // and only from a camp within this distance of it
const RAID_DELAY = [8, 40];   // seconds after dark before they show
const STEAL = 12;             // the most one raider carries off

export class Wanderers {
  /**
   * @param home    () => { x, z } of your settlement, or null when there's
   *                nowhere for a messenger to go (a sandbox world).
   * @param onNews  (messenger, line) — called once when one arrives.
   * @param hostile () => whether bandits fight — Age 2 on, never in Creative.
   * @param night   () => whether it's dark enough for a raid.
   * @param stores  () => [{ structure, region }] storehouses worth robbing.
   * @param onAttack (bandit, halfHearts) — a blow lands on you.
   * @param onSteal  (bandit, structure) => { itemId: count } carried off.
   * @param onRaid   (direction, raiders) — a raid has set out.
   */
  constructor({
    world, rand = Math.random, home = null, onNews = null,
    hostile = () => false, night = () => false, stores = () => [],
    onAttack = null, onSteal = null, onRaid = null,
  }) {
    this.world = world;
    this.rand = rand;
    this.home = home;
    this.onNews = onNews;
    this.hostile = hostile;
    this.night = night;
    this.stores = stores;
    this.onAttack = onAttack;
    this.onSteal = onSteal;
    this.onRaid = onRaid;
    this.raidedTonight = false;
    this.untilRaid = null;
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
    this.list = this.list.filter((p) => !p.dead && !this.gone(p, player));
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

    this.raids(dt, home);

    for (const p of this.list) {
      if (p.hurt > 0) p.hurt = Math.max(0, p.hurt - dt);
      this.think(p, dt, player);
      this.move(p, dt);
    }
  }

  // ---- raids --------------------------------------------------------------

  /**
   * Once a night, more often than not: a few bandits from the nearest camp
   * set out for your settlement a little after dark. Daylight resets it.
   */
  raids(dt, home) {
    if (!this.night()) {
      this.raidedTonight = false;
      this.untilRaid = null;
      return;
    }
    if (this.raidedTonight || !home || !this.hostile()) return;
    if (this.untilRaid == null) {
      if (this.rand() >= RAID_CHANCE) { this.raidedTonight = true; return; }
      this.untilRaid = this.between(RAID_DELAY);
    }
    this.untilRaid -= dt;
    if (this.untilRaid > 0) return;
    if (this.sendRaid(home)) this.raidedTonight = true;
  }

  /** The nearest bandit camp to `home` that's close enough to raid from. */
  campNear(home) {
    let best = null, bestD = RAID_RANGE;
    for (const lm of this.landmarks) {
      if (lm.kind !== 'camp') continue;
      const d = Math.hypot(lm.x - home.x, lm.z - home.z);
      if (d < bestD) { best = lm; bestD = d; }
    }
    return best;
  }

  /**
   * Two or three raiders, RAID_FROM out from your settlement on the side
   * their camp is. Returns them, or null when there's no camp near enough
   * or the ground there isn't loaded yet (it tries again next frame).
   */
  sendRaid(home) {
    const camp = this.campNear(home);
    if (!camp) { this.raidedTonight = true; return null; }
    const d = Math.hypot(camp.x - home.x, camp.z - home.z) || 1;
    const from = Math.min(RAID_FROM, d);
    const ox = home.x + ((camp.x - home.x) / d) * from, oz = home.z + ((camp.z - home.z) / d) * from;
    const y = surfaceAt(this.world, Math.floor(ox), Math.floor(oz));
    if (y == null) return null;
    const n = 2 + Math.floor(this.rand() * 2);
    const raiders = [];
    for (let i = 0; i < n; i++) {
      const x = ox + (this.rand() - 0.5) * 4, z = oz + (this.rand() - 0.5) * 4;
      const p = this.person('bandit', x, surfaceAt(this.world, Math.floor(x), Math.floor(z)) ?? y, z, {
        raider: true, stage: 'coming', settlement: home, home: { x: ox, z: oz },
      });
      raiders.push(p);
      this.list.push(p);
    }
    this.onRaid?.(compass(ox - home.x, oz - home.z), raiders);
    return raiders;
  }

  // ---- fighting -----------------------------------------------------------

  /**
   * A blow from you, at (fromX, fromZ). Only a bandit can be fought; for
   * anyone else this is null and the swing goes on to whatever's behind.
   * Hitting one makes the whole camp angry, whatever the age.
   */
  hit(p, damage, fromX, fromZ) {
    const spec = WANDERERS[p.kind];
    if (!spec?.hp) return null;
    p.hp -= damage;
    p.hurt = HURT_FLASH;
    p.angry = true;
    p.detour = 0;
    if (p.landmark) for (const q of this.list) if (q.landmark === p.landmark) q.angry = true;
    if (p.hp <= 0) {
      p.dead = true;
      const drops = this.rollDrops(spec.drops);
      for (const [id, n] of Object.entries(p.loot ?? {})) drops[id] = (drops[id] ?? 0) + n;
      return { killed: true, drops };
    }
    // Knocked back half a block, if there's ground there.
    const away = Math.atan2(p.x - fromX, p.z - fromZ);
    const kx = p.x + Math.sin(away) * 0.6, kz = p.z + Math.cos(away) * 0.6;
    const ground = groundAt(this.world, kx, kz, p.y, TALL);
    if (ground != null && ground <= p.y + 1) { p.x = kx; p.z = kz; }
    p.vy = 3;
    return { killed: false, drops: {} };
  }

  rollDrops(drops = {}) {
    const out = {};
    for (const [id, [lo, hi]] of Object.entries(drops)) {
      const n = lo + Math.floor(this.rand() * (hi - lo + 1));
      if (n > 0) out[id] = n;
    }
    return out;
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
      hp: spec.hp ?? null, hurt: 0, cooldown: 0,
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
    if (p.kind === 'bandit') p.cooldown = Math.max(0, p.cooldown - dt);
    if (p.detour > 0) { p.detour -= dt; return; }
    if (p.kind === 'bandit' && this.fight(p, dt, player, spec)) return;

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

  /**
   * What a bandit does about you, when it's anything at all: run if it's
   * badly hurt, come at you if it's hostile and you're near, and on a raid,
   * make for a storehouse and then for home. Returns whether that decided
   * the bandit's move this frame; false leaves it to the camp's idling.
   */
  fight(p, dt, player, spec) {
    const dx = player.x - p.x, dz = player.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const hostile = p.angry || this.hostile();

    if (p.hp <= spec.fleeBelow) {
      if (d > spec.aggro * 2) {
        // Got away. A camp bandit licks its wounds; a raider goes home.
        if (p.raider) { p.done = true; return true; }
        p.recover = (p.recover ?? 0) + dt;
        if (p.recover >= RECOVER_EVERY) { p.recover = 0; p.hp += 1; }
        return false;
      }
      p.target = { x: p.x - (dx / d) * 6, z: p.z - (dz / d) * 6 };
      p.speed = spec.run;
      return true;
    }

    const leashed = p.landmark && Math.hypot(player.x - p.home.x, player.z - p.home.z) > LEASH;
    // Bolder in the dark: they come from further off.
    const aggro = spec.aggro * (this.night() ? 1.6 : 1);
    if (hostile && !leashed && d < aggro && Math.abs(player.y - p.y) < 4) {
      // Up to just inside striking reach, not into your face.
      const stand = spec.reach * 0.75;
      p.target = d > stand ? { x: player.x - (dx / d) * stand, z: player.z - (dz / d) * stand } : null;
      p.speed = spec.run;
      if (d <= spec.reach && Math.abs(player.y - p.y) < 2 && p.cooldown <= 0) {
        p.cooldown = spec.every;
        this.onAttack?.(p, spec.hits);
      }
      return true;
    }
    if (p.landmark && p.angry && leashed) {
      // You've gone; back to the fire, and they calm down by morning.
      if (!this.night()) p.angry = false;
    }

    if (!p.raider) return false;
    // A raid: to a storehouse (or to you, if there isn't one), then away.
    if (p.stage === 'coming') {
      const store = this.nearestStore(p);
      if (!store && !this.stores().length) {
        p.target = { x: player.x, z: player.z };
        p.speed = spec.speed;
        if (!this.night()) p.stage = 'leaving';
        return true;
      }
      if (store && store.d < 2.5) {
        p.loot = this.onSteal?.(p, store.structure) ?? {};
        p.stage = 'leaving';
      } else if (store) {
        p.target = store.at;
        p.speed = spec.speed;
      }
      if (!this.night()) p.stage = 'leaving';
      return true;
    }
    // Leaving: back the way they came, and gone once they're out there.
    p.target = p.home;
    p.speed = spec.run;
    if (Math.hypot(p.home.x - p.x, p.home.z - p.z) < 3) p.done = true;
    return true;
  }

  /** The storehouse nearest a raider: the closest point of it, and how far. */
  nearestStore(p) {
    let best = null;
    for (const { structure, region } of this.stores()) {
      const x = Math.max(region.minX, Math.min(region.maxX + 1, p.x));
      const z = Math.max(region.minZ, Math.min(region.maxZ + 1, p.z));
      const d = Math.hypot(x - p.x, z - p.z);
      if (!best || d < best.d) best = { structure, at: { x, z }, d };
    }
    return best;
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
