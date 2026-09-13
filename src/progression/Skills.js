import { SKILLS, SKILLS_BY_ID, levelForCount, nextMilestone, MAX_LEVEL } from '../config/skills.js';

/**
 * Tracks how good the player has got at each of the four skills.
 *
 * Counts go up as you play; levels are derived from those counts rather than
 * stored, so rebalancing the milestone ladder re-levels everybody correctly
 * instead of stranding old saves on numbers that no longer mean anything.
 *
 * Deliberately separate from the age progression: ages are unlocked by what
 * you've built, skills are how good you are. Two different questions.
 */
export class Skills {
  constructor(bus) {
    this.bus = bus;
    this.counts = {};
    for (const s of SKILLS) this.counts[s.id] = 0;
  }

  levelOf(id) {
    return levelForCount(this.counts[id] ?? 0);
  }

  countOf(id) {
    return this.counts[id] ?? 0;
  }

  /** Adds to a skill and announces a level-up when one crosses a milestone. */
  record(id, amount = 1) {
    if (!SKILLS_BY_ID.has(id) || amount <= 0) return null;
    const before = this.levelOf(id);
    this.counts[id] += amount;
    const after = this.levelOf(id);
    if (after > before) {
      const spec = SKILLS_BY_ID.get(id);
      this.bus?.emit('skill:levelup', { id, level: after, name: spec.name, describe: spec.describe(after) });
      return after;
    }
    return null;
  }

  /** Progress toward the next level as { count, next, ratio } for a bar. */
  progress(id) {
    const count = this.countOf(id);
    const next = nextMilestone(count);
    if (next == null) return { count, next: null, ratio: 1 };
    // Measure from the previous milestone so the bar fills across the band.
    const level = levelForCount(count);
    const prev = level === 0 ? 0 : [1, 10, 30, 75, 150, 300, 600, 1200, 2500, 5000][level - 1];
    return { count, next, ratio: Math.max(0, Math.min(1, (count - prev) / (next - prev))) };
  }

  // ---- the effects, read by the systems they modify ----

  /** Multiplier on everything gathered. */
  gatherYield() {
    return 1 + this.levelOf('foraging') * 0.12;
  }

  /** How much cheaper claiming a building is, from the Building skill. */
  claimDiscount() {
    return Math.min(0.5, this.levelOf('building') * 0.05);
  }

  /** Movement multiplier from Athletics. */
  moveSpeed() {
    return 1 + this.levelOf('athletics') * 0.04;
  }

  /** How much slower hunger drains, from Athletics. */
  hungerRelief() {
    return Math.max(0.4, 1 - this.levelOf('athletics') * 0.04);
  }

  /** Settlers the player may govern, from Politics. */
  settlerAllowance() {
    return this.levelOf('politics');
  }

  summary() {
    return SKILLS.map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      governs: s.governs,
      level: this.levelOf(s.id),
      maxLevel: MAX_LEVEL,
      effect: s.describe(this.levelOf(s.id)),
      ...this.progress(s.id),
    }));
  }

  toJSON() {
    return { counts: { ...this.counts } };
  }

  loadJSON(data) {
    if (!data?.counts) return;
    for (const s of SKILLS) {
      const n = data.counts[s.id];
      if (typeof n === 'number' && n >= 0) this.counts[s.id] = n;
    }
  }
}
