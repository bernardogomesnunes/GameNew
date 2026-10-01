import { groundAt } from './Mobs.js';
import { stepAround } from './Defenders.js';

/**
 * Your army, on the dark path (docs/plan-phase7-lore.md): the thousand
 * warriors the Stone King grants you when you swear at his dark god's altar
 * with the Black Ring on your hand.
 *
 * A thousand live soldiers would stop any phone, so the army is a count
 * (Decision 3): `total` is how many you have, and at most ON_FIELD of them
 * are out on the ground with you at once. When one falls the count drops,
 * and a fresh one marches in from the back to take the place, for as long
 * as there's anyone left to send.
 *
 * What they do is up to you, from the command wheel:
 *   follow  in ranks behind you, wherever you go
 *   hold    in ranks where you gave the order
 *   attack  go for anything hostile near you
 *   line    a line abreast across the way you're facing, ahead of you
 * Whatever the order, anything hostile that comes close is fought.
 *
 * An army eats: rations every game day, a meal for every hundred warriors,
 * from your bag and your storehouses. Short of food, some of them desert.
 *
 * Pure logic like Defenders: Game draws `field`, hands in the enemies, and
 * does what a blow does.
 */

export const ARMY_SIZE = 1000;
export const ON_FIELD = 30;
export const WARRIOR = { hp: 20, hits: 3, reach: 1.9, every: 1.2, speed: 3.6, engage: 7, hunt: 26 };
export const MODES = ['follow', 'hold', 'attack', 'line'];
export const MODE_WORDS = {
  follow: 'following you', hold: 'holding their ground', attack: 'attacking', line: 'in a line',
};
/** Food for every hundred warriors, every game day. */
export const RATIONS_PER_HUNDRED = 1;
/** The share who walk off, on a day with nothing to eat. */
export const DESERTION = 0.03;
/** Ranks: this many abreast, this far apart. */
const FILE = 6, SPACING = 1.6;
/** Too far behind, they catch up at once rather than running across the map. */
const STRAGGLE = 48;
const TALL = 2;
const ARMOUR = [0x3a3740, 0x45414d, 0x332f38], HELM = 0x6d6a73;

export class Army {
  constructor({ world, rand = Math.random }) {
    this.world = world;
    this.rand = rand;
    this.sworn = false;
    this.total = 0;
    this.lost = 0;
    this.mode = 'follow';
    this.anchor = null;   // { x, z, facing } — where 'hold' and 'line' stand
    this.fedDay = null;   // the last game day they ate
    this.field = [];
    this.nextId = 1;
  }

  get active() {
    return this.sworn && this.total > 0;
  }

  /** The oath at the dark altar: the King's thousand. Once. */
  swear(days) {
    if (this.sworn) return false;
    this.sworn = true;
    this.total = ARMY_SIZE;
    this.fedDay = Math.floor(days);
    return true;
  }

  /** An order from the command wheel, given where you stand and the way you face. */
  command(mode, player, facing = 0) {
    if (!MODES.includes(mode)) return null;
    this.mode = mode;
    this.anchor = mode === 'hold' ? { x: player.x, z: player.z, facing }
      : mode === 'line' ? { x: player.x - Math.sin(facing) * 6, z: player.z - Math.cos(facing) * 6, facing }
        : null;
    return mode;
  }

  /**
   * Where the i-th warrior stands for the current order — ranks behind you,
   * ranks at the anchor, or a line across it. `facing` is the yaw: looking
   * along (-sin, -cos).
   */
  slot(i, player, facing) {
    if (this.mode === 'line') {
      const a = this.anchor, f = a.facing;
      const rank = Math.floor(i / 15), file = (i % 15) - 7;
      // Across the facing: (cos, -sin); back a rank: (sin, cos).
      return { x: a.x + Math.cos(f) * file * SPACING + Math.sin(f) * rank * SPACING, z: a.z - Math.sin(f) * file * SPACING + Math.cos(f) * rank * SPACING };
    }
    const a = this.mode === 'hold' ? this.anchor : { x: player.x, z: player.z, facing };
    const f = a.facing;
    const rank = Math.floor(i / FILE) + (this.mode === 'hold' ? 0 : 1.5), file = (i % FILE) - (FILE - 1) / 2;
    return { x: a.x + Math.cos(f) * file * SPACING + Math.sin(f) * rank * SPACING, z: a.z - Math.sin(f) * file * SPACING + Math.cos(f) * rank * SPACING };
  }

  /**
   * @param player   where you are ({ x, y, z })
   * @param facing   your yaw
   * @param enemies  who may be fought — [{ x, y, z, dead }]
   * @param on       { strike(enemy, damage, warrior) }
   */
  tick(dt, player, facing, enemies, on = {}) {
    if (!this.active) { this.field = []; return; }
    this.muster(player, facing);
    const live = enemies.filter((e) => !e.dead && !e.done);
    this.field.forEach((w, i) => this.warrior(w, i, dt, player, facing, live, on));
    this.field = this.field.filter((w) => w.hp > 0);
  }

  /** Fresh warriors march in from behind you, up to ON_FIELD, while there are any to send. */
  muster(player, facing) {
    const want = Math.min(ON_FIELD, this.total);
    while (this.field.length < want) {
      const i = this.field.length;
      const back = 10 + this.rand() * 4, side = (this.rand() - 0.5) * 8;
      const x = player.x + Math.sin(facing) * back + Math.cos(facing) * side;
      const z = player.z + Math.cos(facing) * back - Math.sin(facing) * side;
      const y = groundAt(this.world, x, z, player.y + 4, TALL) ?? player.y;
      this.field.push({
        id: `w${this.nextId++}`, kind: 'warrior', x, y, z, hp: WARRIOR.hp, cooldown: this.rand(), hurt: 0,
        colour: ARMOUR[i % ARMOUR.length], helm: HELM, name: 'Your warrior', target: null, speed: 0,
      });
    }
    if (this.field.length > want) this.field.length = want;
  }

  warrior(w, i, dt, player, facing, enemies, on) {
    w.cooldown = Math.max(0, w.cooldown - dt);
    w.hurt = Math.max(0, w.hurt - dt);
    // Who to fight: anything close to them; in attack, anything near you.
    let foe = null, best = WARRIOR.engage;
    for (const e of enemies) {
      const d = Math.hypot(e.x - w.x, e.z - w.z);
      if (d < best) { best = d; foe = e; }
    }
    if (!foe && this.mode === 'attack') {
      best = WARRIOR.hunt;
      for (const e of enemies) {
        const d = Math.hypot(e.x - player.x, e.z - player.z);
        if (d < best) { best = d; foe = e; }
      }
    }
    w.foe = foe;
    if (foe) {
      const d = Math.hypot(foe.x - w.x, foe.z - w.z);
      w.target = { x: foe.x, z: foe.z };
      if (d > WARRIOR.reach * 0.8) stepAround(this.world, w, foe.x, foe.z, dt, WARRIOR.speed);
      else w.speed = 0;
      if (d <= WARRIOR.reach && w.cooldown <= 0) {
        w.cooldown = WARRIOR.every;
        on.strike?.(foe, WARRIOR.hits, w);
      }
      return;
    }
    // To their place in the ranks.
    const s = this.slot(i, player, facing);
    if (this.mode !== 'hold' && this.mode !== 'line' && Math.hypot(w.x - player.x, w.z - player.z) > STRAGGLE) {
      w.x = s.x; w.z = s.z;
      w.y = groundAt(this.world, s.x, s.z, player.y + 4, TALL) ?? player.y;
    }
    const d = Math.hypot(s.x - w.x, s.z - w.z);
    if (d > 0.4) {
      w.target = s;
      stepAround(this.world, w, s.x, s.z, dt, WARRIOR.speed * (d > 6 ? 1.3 : 0.9));
    } else {
      w.target = null; w.speed = 0;
      // Standing in the ranks, they face the way the ranks face.
      w.facing = (this.anchor?.facing ?? facing) + Math.PI;
      w.hp = Math.min(WARRIOR.hp, w.hp + dt * 0.3);
    }
  }

  /** A blow on one of them. Returns whether it fell — and the army is one fewer. */
  hurt(w, damage) {
    w.hp -= damage;
    w.hurt = 0.3;
    if (w.hp > 0) return false;
    this.total = Math.max(0, this.total - 1);
    this.lost++;
    return true;
  }

  /**
   * A new day's rations, for every day since they last ate. `take(n)`
   * takes up to n food and says how much it found. Returns what happened,
   * or null when it isn't time.
   */
  eat(days, take) {
    if (!this.active) return null;
    const today = Math.floor(days);
    if (this.fedDay == null) { this.fedDay = today; return null; }
    if (today <= this.fedDay) return null;
    let need = 0, got = 0, deserted = 0;
    for (let d = this.fedDay + 1; d <= today && this.total > 0; d++) {
      const want = Math.ceil((this.total / 100) * RATIONS_PER_HUNDRED);
      const had = take(want);
      need += want; got += had;
      const short = 1 - had / want;
      const gone = Math.floor(this.total * DESERTION * short);
      this.total -= gone; deserted += gone;
    }
    this.fedDay = today;
    return { need, got, deserted };
  }

  toJSON() {
    return {
      sworn: this.sworn, total: this.total, lost: this.lost, mode: this.mode, anchor: this.anchor, fedDay: this.fedDay,
    };
  }

  loadJSON(data) {
    this.sworn = !!data?.sworn;
    this.total = Number.isInteger(data?.total) ? Math.max(0, Math.min(ARMY_SIZE, data.total)) : 0;
    this.lost = Number.isInteger(data?.lost) ? data.lost : 0;
    this.mode = MODES.includes(data?.mode) ? data.mode : 'follow';
    const a = data?.anchor;
    this.anchor = a && Number.isFinite(a.x) && Number.isFinite(a.z) ? { x: a.x, z: a.z, facing: Number(a.facing) || 0 } : null;
    if ((this.mode === 'hold' || this.mode === 'line') && !this.anchor) this.mode = 'follow';
    this.fedDay = Number.isFinite(data?.fedDay) ? data.fedDay : null;
    this.field = [];
  }
}
