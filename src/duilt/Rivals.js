/**
 * Battle's rivals (backlog batch 4, E — world/rivals.js has where they are):
 * three computer players, each a city that gathers, builds and raises an
 * army, and sends it at you. Asked for directly: three of them, "It's not a
 * win situation, you can conquer cities and weak them", and that they
 * start coming for you "since the barrack is on" — once you've a barracks.
 *
 * So nobody wins. Each rival has a strength that grows by the day; it's
 * what decides how many they send and how many guard their city. Beat an
 * army of theirs and they're a little weaker; lose to one and a little
 * stronger. Take their standard and they're much weaker — half what they
 * were — and their city is yours for FALL_DAYS while they rebuild: no
 * garrison, and no armies from them. Then it all starts again.
 *
 * Pure bookkeeping on the game's own count of days (DuiltGame.days), saved
 * with the world. It never spawns anyone: Game asks it what's due, sends
 * the army through Wanderers, and tells it how it went.
 *
 * Each rival: { id, strength, falls, fallenUntil, stage, due }
 *   stage   'waiting' (an army's coming on `due`), 'warned' (it's been
 *           announced), 'fighting' (it's at your walls)
 */

/** Where a rival starts, how fast it grows a day, and as strong as it gets. */
export const START_STRENGTH = 2, GROWTH = 0.6, MAX_STRENGTH = 12;
/** From your first barracks to the first army, and one rival to the next. */
export const FIRST_DAYS = 0.5, STAGGER_DAYS = 0.6;
/** Between one rival's armies. */
export const ATTACK_GAP = 2;
/** About a minute's warning. */
export const WARN_DAYS = 0.05;
/** How long a conquered city is yours while they rebuild. */
export const FALL_DAYS = 3;
/** Beating an army costs them this much; losing to one gains them this. */
export const BEATEN = 1, WON = 0.5;

export class Rivals {
  constructor() {
    this.armed = false;
    this.grownTo = null;
    this.list = [0, 1, 2].map((id) => ({ id, strength: START_STRENGTH, falls: 0, fallenUntil: 0, stage: 'waiting', due: null }));
  }

  /** Whether a rival's city is yours just now, while they rebuild. */
  fallen(r, days) {
    return days < r.fallenUntil;
  }

  /** Their strength grows with the days — slower while they're rebuilding. */
  grow(days) {
    if (this.grownTo == null) { this.grownTo = days; return; }
    const dt = Math.max(0, days - this.grownTo);
    this.grownTo = days;
    for (const r of this.list) {
      r.strength = Math.min(MAX_STRENGTH, r.strength + dt * GROWTH * (this.fallen(r, days) ? 0.5 : 1));
    }
  }

  /** Your first barracks: from now on they come. Returns true the first time. */
  arm(days) {
    if (this.armed) return false;
    this.armed = true;
    for (const r of this.list) { r.stage = 'waiting'; r.due = days + FIRST_DAYS + r.id * STAGGER_DAYS; }
    return true;
  }

  /** The rival whose army is at your walls, if any. */
  fighting() {
    return this.list.find((r) => r.stage === 'fighting') ?? null;
  }

  /**
   * What happens now: { what: 'warn' | 'start', rival }, or null. One army
   * at a time — the others wait their turn.
   */
  tick(days) {
    if (!this.armed || this.fighting()) return null;
    for (const r of this.list) {
      if (r.due == null || this.fallen(r, days)) continue;
      if (r.stage === 'waiting' && days >= r.due - WARN_DAYS) {
        r.stage = 'warned';
        r.due = Math.max(r.due, days + WARN_DAYS);
        return { what: 'warn', rival: r };
      }
      if (r.stage === 'warned' && days >= r.due) {
        r.stage = 'fighting';
        return { what: 'start', rival: r };
      }
    }
    return null;
  }

  /**
   * Who they send, by how strong they are: [kind, count] in the kinds of
   * config/wanderers.js. Soldiers always; archers as they grow; a ram for
   * your gate from 4, a catapult for your walls from 8.
   */
  company(r) {
    const s = Math.floor(r.strength);
    const who = [['rival_soldier', 2 + Math.floor(s * 0.8)]];
    if (s >= 2) who.push(['archer', Math.floor(s / 2)]);
    if (s >= 4) who.push(['ram', 1]);
    if (s >= 8) who.push(['siege_catapult', 1]);
    return who;
  }

  /** How many guard their city: more as they grow. */
  garrison(r) {
    return 2 + Math.round(r.strength);
  }

  /** Their army's beaten (won) or got the better of you; the next one comes ATTACK_GAP on. */
  resolve(r, won, days) {
    if (r.stage !== 'fighting') return;
    r.stage = 'waiting';
    r.due = days + ATTACK_GAP;
    r.strength = won ? Math.max(1, r.strength - BEATEN) : Math.min(MAX_STRENGTH, r.strength + WON);
  }

  /**
   * Their standard taken: half as strong, and the city yours for
   * FALL_DAYS. Returns what they pay you, in gold — more the stronger they
   * were when you took it.
   */
  conquer(r, days) {
    const tribute = 6 + Math.round(r.strength * 2);
    r.falls++;
    r.strength = Math.max(1, r.strength / 2);
    r.fallenUntil = days + FALL_DAYS;
    if (r.stage !== 'fighting') {
      r.stage = 'waiting';
      if (r.due != null) r.due = Math.max(r.due, r.fallenUntil + ATTACK_GAP / 2);
    }
    return tribute;
  }

  toJSON() {
    return { armed: this.armed, grownTo: this.grownTo, list: this.list.map((r) => ({ ...r })) };
  }

  static fromJSON(data) {
    const out = new Rivals();
    if (!data || typeof data !== 'object') return out;
    out.armed = data.armed === true;
    out.grownTo = Number.isFinite(data.grownTo) ? data.grownTo : null;
    for (const r of out.list) {
      const s = (data.list ?? []).find((x) => x?.id === r.id);
      if (!s) continue;
      if (Number.isFinite(s.strength)) r.strength = Math.max(1, Math.min(MAX_STRENGTH, s.strength));
      if (Number.isInteger(s.falls)) r.falls = s.falls;
      if (Number.isFinite(s.fallenUntil)) r.fallenUntil = s.fallenUntil;
      if (Number.isFinite(s.due)) r.due = s.due;
      // An army that was at your walls when the world was saved is gone
      // with the people; it comes again shortly.
      r.stage = 'waiting';
    }
    return out;
  }
}
