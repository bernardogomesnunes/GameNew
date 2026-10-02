/**
 * Going home in disguise (the dark path's third way to take the Sky
 * Kingdom — docs/plan-phase7-lore.md): "in Sky armour, with a few picked
 * warriors, you walk in as one of them ... guards grow suspicious if you
 * run, carry dark weapons, or linger, shown by a suspicion meter; if you're
 * caught, it becomes open battle."
 *
 * The meter, as pure logic: each second it climbs by what you're giving
 * away, or drains while you give away nothing. Full, you're discovered —
 * and stay discovered until you've left the island. Game feeds it what you
 * are doing; the HUD shows it (never a toast — asked for directly).
 */

export const SUSPICION = {
  max: 100,
  calm: 7,         // drains this much a second while you give nothing away
  running: 22,     // a Sky soldier walks
  ring: 30,        // the Black Ring on your hand
  darkGear: 14,    // the Stone Kingdom's: its armour worn, or its things in your hand
  nearGuard: 5,    // each guard close by, looking you over
  throne: 9,       // lingering in the throne room
  warriors: 4,     // each warrior past a few, following you in
  near: 3,         // "close by", in blocks
  throneGrace: 8,  // seconds in the throne room before it's lingering
  few: 3,          // warriors you can bring without remark
};

/** What's giving you away, in the words the meter shows. */
export const REASONS = {
  ring: 'Black Ring on show',
  running: 'running',
  darkGear: 'Stone Kingdom gear',
  nearGuard: 'too close to a guard',
  throne: 'lingering by the throne',
  warriors: 'too many warriors',
};

/** Your first blow while still unseen lands this many times as hard. */
export const AMBUSH = 3;

export class Suspicion {
  constructor() {
    this.reset();
  }

  reset() {
    this.level = 0;
    this.discovered = false;
    this.reason = null;
    this.rising = false;
    this.throneFor = 0;
  }

  /**
   * One step. `signs` is what you're doing: { ring, running, darkGear,
   * nearGuards, inThrone, warriors }. Returns this.
   */
  tick(dt, signs = {}) {
    if (this.discovered) return this;
    this.throneFor = signs.inThrone ? this.throneFor + dt : 0;
    const parts = [
      ['ring', signs.ring ? SUSPICION.ring : 0],
      ['running', signs.running ? SUSPICION.running : 0],
      ['darkGear', signs.darkGear ? SUSPICION.darkGear : 0],
      ['nearGuard', (signs.nearGuards ?? 0) * SUSPICION.nearGuard],
      ['throne', this.throneFor > SUSPICION.throneGrace ? SUSPICION.throne : 0],
      ['warriors', Math.max(0, (signs.warriors ?? 0) - SUSPICION.few) * SUSPICION.warriors],
    ].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const up = parts.reduce((a, [, v]) => a + v, 0);
    this.rising = up > 0;
    this.reason = parts.length ? REASONS[parts[0][0]] : null;
    this.level = Math.max(0, Math.min(SUSPICION.max, this.level + (up > 0 ? up : -SUSPICION.calm) * dt));
    if (this.level >= SUSPICION.max) this.reveal();
    return this;
  }

  /** Seen through: by the meter filling, or by a blow you struck. */
  reveal() {
    this.discovered = true;
    this.level = SUSPICION.max;
    this.rising = false;
    this.reason = null;
  }
}
