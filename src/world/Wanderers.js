import { WANDERERS, WANDERER_NAMES, NEWS } from '../config/wanderers.js';
import { STUN_SECONDS, BURN_SECONDS, BURN_DAMAGE, FREEZE_SECONDS, FREEZE_SLOW } from '../config/upgrades.js';
import { landmarksFor } from './landmarks.js';
import { groundAt, surfaceAt, isLoaded, bodyFits } from './Mobs.js';

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
const LEASH = 32;
/** How long someone who doesn't fight runs from you once struck. */
const FLEE_SECONDS = 6;             // a camp bandit won't chase you further than this from its fire
const HURT_FLASH = 0.3;       // seconds a struck figure shows red
const RECOVER_EVERY = 6;      // a bandit that got away heals a point this often
const RAID_CHANCE = 0.7;      // most nights, not every night
const RAID_FROM = 50;         // raiders turn up this far out from your settlement
const RAID_RANGE = 600;       // and only from a camp within this distance of it
const RAID_DELAY = [8, 40];   // seconds after dark before they show
const STEAL = 12;             // the most one raider carries off

// The Stone Kingdom's army (the Ten Rounds — config/war.js).
const ARMY_FROM = 30;         // they gather this far past your border...
const ARMY_SPREAD = 7;        // ...spread across this much of the road
const ARROW_SPEED = 22;
const ARROW_GRAVITY = 9;
const ARROW_LIFE = 4;         // seconds an arrow flies, or stays stuck in a wall
const MOUNTED = 1.05;         // how high the Warlord sits on his beast

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
    onAttack = null, onSteal = null, onRaid = null, kingdomHostile = () => false,
    buildings = () => [], inLand = () => false, onBatter = null, onThrow = null,
    foes = () => [], onFoe = null,
  }) {
    this.world = world;
    this.rand = rand;
    this.home = home;
    this.onNews = onNews;
    this.hostile = hostile;
    // Whether the Stone Kingdom's guards fight you on sight (Phase 7e).
    this.kingdomHostile = kingdomHostile;
    this.night = night;
    this.stores = stores;
    this.onAttack = onAttack;
    this.onSteal = onSteal;
    this.onRaid = onRaid;
    // The army's siege engines (Phase 7, White path): what they aim at, and
    // what they do to it — Game breaks the blocks.
    this.buildings = buildings;
    this.inLand = inLand;
    this.onBatter = onBatter;
    this.onThrow = onThrow;
    // Your soldiers (the barracks — world/Defenders.js): whoever's nearer
    // than you is who a raider fights.
    this.foes = foes;
    this.onFoe = onFoe;
    // Archers' arrows in flight — { x, y, z, vx, vy, vz, from, age, stuck }.
    this.arrows = [];
    this.raidedTonight = false;
    this.untilRaid = null;
    this.landmarks = world.gen ? landmarksFor(world.gen) : [];
    // Burnt down by a fire sword, waiting for Game to pick up what they dropped.
    this.fallen = [];
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
      // Only the hut, the camps and the Stone Kingdom have anyone living in them.
      if (lm.kind !== 'hermit' && lm.kind !== 'camp' && lm.kind !== 'kingdom') continue;
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
      if (p.fear > 0) p.fear = Math.max(0, p.fear - dt);
      if (this.suffer(p, dt)) continue;
      // Frozen, everything it does runs slow.
      const t = p.frozen > 0 ? dt * FREEZE_SLOW : dt;
      // Stunned, it stands where it was struck: no thinking, no striking.
      if (!(p.stunned > 0)) this.think(p, t, player);
      // The Warlord rides: where his beast goes, he goes.
      if (this.riding(p)) continue;
      if (p.stunned > 0) { const was = p.speed; p.speed = 0; this.move(p, t); p.speed = was; } else this.move(p, t);
    }
    this.flyArrows(dt, player);
  }

  // ---- struck by an upgraded sword (playtest, P6) -------------------------

  /**
   * Thunder stuns, fire sets burning, ice freezes. A fresh strike starts its
   * time again; it doesn't stack.
   */
  afflict(p, element) {
    if (!WANDERERS[p.kind]?.hp || p.dead) return;
    if (element === 'thunder') p.stunned = STUN_SECONDS;
    else if (element === 'fire') { p.burning = BURN_SECONDS; p.burnTick = 1; }
    else if (element === 'ice') p.frozen = FREEZE_SECONDS;
  }

  /**
   * The afflictions running down; a burn takes BURN_DAMAGE a second. One
   * that burns to death leaves its drops in `fallen`, for Game to collect.
   * Returns whether it died.
   */
  suffer(p, dt) {
    if (p.stunned > 0) p.stunned = Math.max(0, p.stunned - dt);
    if (p.frozen > 0) p.frozen = Math.max(0, p.frozen - dt);
    if (!(p.burning > 0)) return false;
    p.burning = Math.max(0, p.burning - dt);
    p.burnTick -= dt;
    if (p.burnTick > 0) return false;
    p.burnTick += 1;
    p.hp -= BURN_DAMAGE;
    p.hurt = HURT_FLASH;
    if (p.hp > 0) return false;
    p.dead = true;
    const drops = this.rollDrops(WANDERERS[p.kind].drops);
    for (const [id, n] of Object.entries(p.loot ?? {})) drops[id] = (drops[id] ?? 0) + n;
    this.fallen.push({ p, drops });
    return true;
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

  // ---- the Stone Kingdom's army ------------------------------------------------

  /**
   * One round of the war (config/war.js): `who` is [kind, count], sent from
   * `towards` — the Stone Kingdom's side — `edge` blocks out from your
   * settlement plus a little. They gather on ground that's loaded, nearer in
   * if they must. Returns them, or null when there's nowhere loaded to stand
   * (it tries again next frame).
   */
  sendWarband(home, towards, edge, who, round) {
    const d0 = Math.hypot(towards.x - home.x, towards.z - home.z) || 1;
    const ux = (towards.x - home.x) / d0, uz = (towards.z - home.z) / d0;
    let ox = null, oz = null, y = null;
    for (let r = edge + ARMY_FROM; r >= 24; r -= 8) {
      const x = home.x + ux * r, z = home.z + uz * r;
      if (!isLoaded(this.world, x, z)) continue;
      const top = surfaceAt(this.world, Math.floor(x), Math.floor(z));
      if (top == null) continue;
      ox = x; oz = z; y = top;
      break;
    }
    if (ox == null) return null;
    const band = [];
    let beast = null;
    for (const [kind, count] of who) {
      for (let i = 0; i < count; i++) {
        // Across the road, not down it: -uz, ux is sideways.
        const side = (this.rand() - 0.5) * 2 * ARMY_SPREAD, back = this.rand() * 4;
        const x = ox - uz * side - ux * back, z = oz + ux * side - uz * back;
        const spec = WANDERERS[kind];
        const p = this.person(kind, x, surfaceAt(this.world, Math.floor(x), Math.floor(z)) ?? y, z, {
          war: true, round,
          // Who comes for your storehouses; the beast and the Warlord come for you.
          raider: !spec.siege && !spec.beast && kind !== 'warlord',
          stage: 'coming', settlement: home, home: { x: ox, z: oz },
          name: kind === 'warlord' ? 'Vorhak' : undefined,
        });
        // Engines and beasts are named for what they are, not like people.
        if (spec.siege || spec.beast) p.name = spec.one.replace(/^an? /, '').replace(/^./, (c) => c.toUpperCase());
        else if (!p.name) p.name = WANDERER_NAMES[Math.floor(this.rand() * WANDERER_NAMES.length)];
        if (spec.beast) beast = p;
        band.push(p);
      }
    }
    // The Warlord on his beast's back.
    const lord = band.find((p) => p.kind === 'warlord');
    if (lord && beast) { lord.mount = beast; beast.rider = lord; lord.x = beast.x; lord.z = beast.z; lord.y = beast.y + MOUNTED; }
    this.list.push(...band);
    return band;
  }

  /** Whether `p` is up on a beast that's still standing — then it moves with it. */
  riding(p) {
    const m = p.mount;
    if (!m) return false;
    if (m.dead) { p.mount = null; return false; }
    p.x = m.x; p.z = m.z; p.y = m.y + MOUNTED;
    p.facing = m.facing;
    return true;
  }

  /** An archer looses at you: aimed where you are, dropping a little on the way. */
  loose(p, player) {
    const from = { x: p.x, y: p.y + 1.45, z: p.z };
    const dx = player.x - from.x, dy = player.y + 1.1 - from.y, dz = player.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    const t = d / ARROW_SPEED;
    this.arrows.push({
      x: from.x, y: from.y, z: from.z,
      vx: dx / t, vz: dz / t, vy: dy / t + 0.5 * ARROW_GRAVITY * t,
      from: p, age: 0, stuck: false,
    });
  }

  /** Arrows on their way: into you, into a wall, or into the ground. */
  flyArrows(dt, player) {
    if (!this.arrows.length) return;
    const STEPS = 4, h = dt / STEPS;
    for (const a of this.arrows) {
      a.age += dt;
      if (a.stuck) continue;
      for (let i = 0; i < STEPS && !a.stuck && !a.done; i++) {
        a.vy -= ARROW_GRAVITY * h;
        a.x += a.vx * h; a.y += a.vy * h; a.z += a.vz * h;
        if (Math.hypot(a.x - player.x, a.z - player.z) < 0.55 && a.y > player.y - 0.1 && a.y < player.y + 1.9) {
          a.done = true;
          this.onAttack?.(a.from, WANDERERS[a.from.kind]?.hits ?? 2);
        } else if (a.y < 0 || this.world.collisionBoxAt(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z))) {
          a.stuck = true;
        }
      }
    }
    this.arrows = this.arrows.filter((a) => !a.done && a.age < ARROW_LIFE);
  }

  /**
   * What a siege engine goes for: the nearest point of the nearest of your
   * buildings, or the middle of your settlement when there are none.
   */
  siegeGoal(p) {
    let best = null;
    for (const { region } of this.buildings()) {
      const x = Math.max(region.minX, Math.min(region.maxX + 1, p.x));
      const z = Math.max(region.minZ, Math.min(region.maxZ + 1, p.z));
      const d = Math.hypot(x - p.x, z - p.z);
      if (!best || d < best.d) best = { x, z, d, region };
    }
    if (best) return best;
    const s = p.settlement;
    return s ? { x: s.x, z: s.z, d: Math.hypot(s.x - p.x, s.z - p.z), region: null } : null;
  }

  /**
   * A battering ram rolls for your nearest building, and whatever stands in
   * its way inside your land — a wall, a gate, the building itself — it
   * beats on until it gives.
   */
  ram(p, dt, spec) {
    p.cooldown = Math.max(0, p.cooldown - dt);
    const goal = this.siegeGoal(p);
    if (!goal) { p.target = null; p.speed = 0; return; }
    // At the building: on into the middle of it.
    const r = goal.region;
    const to = goal.d < 1.2 && r ? { x: (r.minX + r.maxX + 1) / 2, z: (r.minZ + r.maxZ + 1) / 2 } : goal;
    const dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz) || 1;
    const ax = Math.floor(p.x + (dx / d) * 0.9), az = Math.floor(p.z + (dz / d) * 0.9);
    const stuck = groundAt(this.world, ax + 0.5, az + 0.5, p.y, TALL) == null;
    if (stuck && this.inLand(ax, az)) {
      p.target = null; p.speed = 0;
      p.facing = Math.atan2(dx, dz);
      if (p.cooldown > 0) return;
      p.cooldown = spec.every;
      p.swing = 0.35;
      const y0 = Math.floor(p.y);
      const cells = [y0, y0 + 1, y0 + 2]
        .filter((y) => this.world.collisionBoxAt(ax, y, az))
        .map((y) => ({ x: ax, y, z: az }));
      if (cells.length) this.onBatter?.(p, cells);
      return;
    }
    p.target = d > 0.3 ? to : null;
    p.speed = spec.speed;
  }

  /** A siege catapult: up to throwing distance of your buildings, then a stone every few seconds. */
  catapult(p, dt, spec) {
    p.cooldown = Math.max(0, p.cooldown - dt);
    const goal = this.siegeGoal(p);
    if (!goal) { p.target = null; p.speed = 0; return; }
    if (goal.d > spec.range) {
      p.target = { x: goal.x, z: goal.z };
      p.speed = spec.speed;
      return;
    }
    p.target = null; p.speed = 0;
    p.facing = Math.atan2(goal.x - p.x, goal.z - p.z);
    if (p.cooldown > 0) return;
    p.cooldown = spec.every;
    p.swing = 0.6;
    this.onThrow?.(p, { x: goal.x, z: goal.z });
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
    // Someone who doesn't fight runs for it.
    if (spec.flees) p.fear = Math.max(p.fear ?? 0, FLEE_SECONDS);
    p.detour = 0;
    if (p.landmark) for (const q of this.list) if (q.landmark === p.landmark) q.angry = true;
    if (p.hp <= 0) {
      p.dead = true;
      const drops = this.rollDrops(spec.drops);
      for (const [id, n] of Object.entries(p.loot ?? {})) drops[id] = (drops[id] ?? 0) + n;
      return { killed: true, drops };
    }
    // Knocked back half a block, if there's ground there — not a siege
    // engine or a beast that size. Only ever along the ground or down off
    // it, never up a step: a blow used to lift a bandit you'd trapped in a
    // hole straight out over its edge (reported: "locked one in a hole and
    // when I beat them they go out of the hole").
    if (spec.siege || spec.beast) return { killed: false, drops: {} };
    const away = Math.atan2(p.x - fromX, p.z - fromZ);
    const kx = p.x + Math.sin(away) * 0.6, kz = p.z + Math.cos(away) * 0.6;
    const ground = groundAt(this.world, kx, kz, p.y, TALL);
    if (ground != null && ground <= p.y + 0.05 && this.fits(p, kx, kz, ground)) { p.x = kx; p.z = kz; }
    p.vy = 1.5;
    return { killed: false, drops: {} };
  }

  /** A bandit losing its nerve for `seconds` — it breaks and runs (Phase 7d). */
  scare(p, seconds) {
    if (!WANDERERS[p.kind]?.hp) return;
    p.fear = Math.max(p.fear ?? 0, seconds);
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
    // The army doesn't melt away because you walked off: it's at your walls.
    if (p.war) return !!p.done;
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
      ...(spec.helm != null ? { helm: spec.helm } : {}),
      ...extra,
    };
  }

  // ---- arriving -----------------------------------------------------------

  /** The hermit at their door, or three or four bandits round their fire. */
  populate(lm) {
    if (!isLoaded(this.world, lm.x, lm.z)) return;
    this.present.add(lm);
    const home = { x: lm.x + 0.5, z: lm.z + 0.5 };
    if (lm.kind === 'kingdom') {
      // The King on his throne, a guard at every post (Phase 7e). The city's
      // floor is level, so they stand on it wherever they are.
      this.list.push(this.person('king', lm.king.x, lm.y + (lm.king.dy ?? 0), lm.king.z, { landmark: lm, home: { x: lm.king.x, z: lm.king.z }, name: 'the Stone King', facing: lm.king.facing }));
      for (const post of lm.posts) {
        this.list.push(this.person('guard', post.x, lm.y, post.z, { landmark: lm, home: { x: post.x, z: post.z }, post: post.role }));
      }
      return;
    }
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
    // Called off — the round lost, or the war over: home the way they came.
    if (p.retreat) {
      p.mount = null;
      p.target = p.home;
      p.speed = spec.run ?? spec.speed;
      // Out of sight over the hills soon enough, whether they reach it or not.
      p.retreating = (p.retreating ?? 0) + dt;
      if (p.retreating > 25 || Math.hypot(p.home.x - p.x, p.home.z - p.z) < 3) p.done = true;
      return;
    }
    if (spec.siege === 'ram') return this.ram(p, dt, spec);
    if (spec.siege === 'catapult') return this.catapult(p, dt, spec);
    const fights = p.kind === 'bandit' || p.kind === 'guard' || p.war;
    if (fights) p.cooldown = Math.max(0, p.cooldown - dt);
    // Up on his beast, the Warlord only swings: the beast does the going.
    if (p.mount && !p.mount.dead) {
      const d = Math.hypot(player.x - p.x, player.z - p.z);
      if (d <= spec.reach + 0.6 && Math.abs(player.y - (p.y - MOUNTED)) < 2.5 && p.cooldown <= 0) {
        p.cooldown = spec.every;
        this.onAttack?.(p, spec.hits);
      }
      return;
    }
    if (p.detour > 0) { p.detour -= dt; return; }
    if (fights && this.fight(p, dt, player, spec)) return;
    // The King doesn't leave his throne.
    if (p.kind === 'king') { p.target = null; p.speed = 0; return; }
    // Struck, someone who doesn't fight runs from you.
    if (spec.flees && p.fear > 0) {
      const dx = p.x - player.x, dz = p.z - player.z;
      const d = Math.hypot(dx, dz) || 1;
      p.target = { x: p.x + (dx / d) * 6, z: p.z + (dz / d) * 6 };
      p.speed = spec.run;
      return;
    }

    if (p.kind === 'hermit' || p.kind === 'bandit' || p.kind === 'guard') {
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
    const hostile = p.war || p.angry || (p.kind === 'guard' ? this.kingdomHostile() : this.hostile());

    // Badly hurt, or frightened (the black guardian — scare()): it runs.
    if (p.hp <= spec.fleeBelow || p.fear > 0) {
      if (d > spec.aggro * 2) {
        // Got away. A camp bandit licks its wounds; a raider goes home —
        // with whatever it took, if it took anything.
        if (p.raider || p.war) { p.done = true; p.escaped = hasLoot(p); return true; }
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
    // An archer keeps its distance and shoots.
    if (hostile && spec.shoots && d < spec.shoots && Math.abs(player.y - p.y) < 6) {
      const keep = spec.standOff;
      p.target = d < keep - 2 ? { x: p.x - (dx / d) * 4, z: p.z - (dz / d) * 4 }
        : d > keep + 2 ? { x: player.x - (dx / d) * keep, z: player.z - (dz / d) * keep } : null;
      p.speed = spec.speed;
      if (!p.target) p.facing = Math.atan2(dx, dz);
      if (p.cooldown <= 0) { p.cooldown = spec.every; this.loose(p, player); }
      return true;
    }
    // One of your soldiers nearer than you is who it fights.
    let foe = null, fd = d;
    if (hostile && (p.war || p.raider)) {
      for (const f of this.foes()) {
        if (f.hp <= 0) continue;
        const e = Math.hypot(f.x - p.x, f.z - p.z);
        if (e < fd && Math.abs(f.y - p.y) < 4) { fd = e; foe = f; }
      }
    }
    if (foe && fd < aggro) {
      const fx = foe.x - p.x, fz = foe.z - p.z, stand = spec.reach * 0.75;
      p.target = fd > stand ? { x: foe.x - (fx / fd) * stand, z: foe.z - (fz / fd) * stand } : null;
      p.speed = spec.run;
      if (fd <= spec.reach && p.cooldown <= 0) {
        p.cooldown = spec.every;
        this.onFoe?.(p, foe, spec.hits);
      }
      return true;
    }
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

    // The beast, and the Warlord on foot: they've come for you, wherever you are.
    if (p.war && !p.raider) {
      p.target = { x: player.x, z: player.z };
      p.speed = spec.speed;
      return true;
    }
    if (!p.raider) return false;
    // A raid: to a storehouse (or to you, if there isn't one), then away.
    // The army doesn't wait for dark, or go home at dawn.
    const daylight = !this.night() && !p.war;
    if (p.stage === 'coming') {
      const store = this.nearestStore(p);
      if (!store && !this.stores().length) {
        p.target = { x: player.x, z: player.z };
        p.speed = spec.speed;
        if (daylight) p.stage = 'leaving';
        return true;
      }
      if (store && store.d < 2.5) {
        p.loot = this.onSteal?.(p, store.structure) ?? {};
        p.stage = 'leaving';
      } else if (store) {
        p.target = store.at;
        p.speed = spec.speed;
      }
      if (daylight) p.stage = 'leaving';
      return true;
    }
    // Leaving: back the way they came, and gone once they're out there.
    p.target = p.home;
    p.speed = spec.run;
    if (Math.hypot(p.home.x - p.x, p.home.z - p.z) < 3) { p.done = true; p.escaped = hasLoot(p); }
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

  /** Whether all of `p` fits standing at (x, z) on ground at footY (Mobs.bodyFits). */
  fits(p, x, z, footY) {
    // A siege engine goes by its middle, through the one-block breach its
    // own ram knocked in a wall.
    return bodyFits(this.world, x, z, footY, 1.8, WANDERERS[p.kind]?.siege ? 0.05 : undefined);
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
        // Somewhere to stand, and room for the whole of them there — not
        // just their middle — so nobody walks through the side of a wall.
        const footing = (x, z) => {
          const g = groundAt(this.world, x, z, p.y, TALL);
          return g != null && this.fits(p, x, z, g) ? g : null;
        };
        let ground = footing(nx, nz);
        if (ground == null && Math.abs(dx) > 0.05) {
          const g = footing(p.x + Math.sign(dx) * step, p.z);
          if (g != null) { nx = p.x + Math.sign(dx) * step; nz = p.z; ground = g; }
        }
        if (ground == null && Math.abs(dz) > 0.05) {
          const g = footing(p.x, p.z + Math.sign(dz) * step);
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

/** Whether a raider is carrying anything off. */
function hasLoot(p) {
  return !!p.loot && Object.values(p.loot).some((n) => n > 0);
}

/** Which way (dx, dz) points, as a word: north is -z, east is +x. */
export function compass(dx, dz) {
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const a = (Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2);
  return names[Math.round(a / (Math.PI / 4)) % 8];
}
