import { FIRST_ROUND_DAYS, ROUND_GAP_DAYS, WARN_DAYS, RETRY_DAYS, LAST_ROUND } from '../config/war.js';

/**
 * Where the war with the Stone Kingdom stands — config/war.js has the why.
 *
 * Pure bookkeeping on the game's own count of days, saved with the world.
 * It never spawns anyone: Game asks it what's due each frame, sends the
 * round out through Wanderers, and tells it how the round went.
 *
 *   peace     no war yet (before the last age)
 *   waiting   a round is coming, on `due`
 *   warned    it's been announced; it sets out at `due`
 *   fighting  round `round` is at your walls
 *   won       all ten beaten — the war is over, for good
 *   truce     you forged the Black Ring; the King called his army home
 */
export class War {
  constructor() {
    this.stage = 'peace';
    this.round = 1;     // the round coming next, or being fought
    this.due = 0;       // the day it sets out
    this.lost = 0;      // rounds lost, all told
  }

  get atWar() {
    return this.stage === 'waiting' || this.stage === 'warned' || this.stage === 'fighting';
  }

  /** The last age reached: war, unless the Black Ring has already made you his. */
  declare(days, { ring = null } = {}) {
    if (this.stage !== 'peace') return false;
    if (ring === 'black') { this.stage = 'truce'; return false; }
    this.stage = 'waiting';
    this.round = 1;
    this.due = days + FIRST_ROUND_DAYS;
    return true;
  }

  /**
   * What happens now, if anything: 'warn' when a round is a minute off,
   * 'start' when it sets out. Game does the announcing and the sending.
   */
  tick(days) {
    if (this.stage === 'waiting' && days >= this.due - WARN_DAYS) {
      this.stage = 'warned';
      // Always a minute's warning — even for a round that came due while
      // you were away from home, or before a save was loaded.
      this.due = Math.max(this.due, days + WARN_DAYS);
      return 'warn';
    }
    if (this.stage === 'warned' && days >= this.due) {
      this.stage = 'fighting';
      return 'start';
    }
    return null;
  }

  /** Days until the next round sets out, or null when none is coming. */
  daysToNext(days) {
    return this.stage === 'waiting' || this.stage === 'warned' ? Math.max(0, this.due - days) : null;
  }

  /** The war horn: the next round, now — a minute's warning and it comes. */
  horn(days) {
    if (this.stage !== 'waiting' && this.stage !== 'warned') return false;
    if (this.due - days <= WARN_DAYS + 1e-9) return false;
    this.due = days + WARN_DAYS;
    this.stage = 'waiting';
    return true;
  }

  /** The round's over, one way or the other. Returns 'victory' after the tenth. */
  resolve(won, days) {
    if (this.stage !== 'fighting') return null;
    if (!won) {
      this.lost++;
      this.stage = 'waiting';
      this.due = days + RETRY_DAYS;
      return 'lost';
    }
    if (this.round >= LAST_ROUND) {
      this.stage = 'won';
      return 'victory';
    }
    this.round++;
    this.stage = 'waiting';
    this.due = days + ROUND_GAP_DAYS;
    return 'won';
  }

  /** The Black Ring forged: the King calls his army home. */
  truce() {
    if (this.stage === 'won' || this.stage === 'truce') return false;
    const was = this.atWar;
    this.stage = 'truce';
    return was;
  }

  toJSON() {
    return { stage: this.stage, round: this.round, due: this.due, lost: this.lost };
  }

  loadJSON(data) {
    const stages = ['peace', 'waiting', 'warned', 'fighting', 'won', 'truce'];
    this.stage = stages.includes(data?.stage) ? data.stage : 'peace';
    this.round = Number.isInteger(data?.round) ? Math.min(Math.max(data.round, 1), LAST_ROUND) : 1;
    this.due = Number.isFinite(data?.due) ? data.due : 0;
    this.lost = Number.isInteger(data?.lost) ? data.lost : 0;
    // Nobody who was at your walls is saved, so a round you left mid-fight
    // comes again — announced, and soon.
    if (this.stage === 'fighting' || this.stage === 'warned') this.stage = 'waiting';
  }
}
