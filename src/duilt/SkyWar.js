/**
 * The dark path's war on the Sky Kingdom: your attacks on it, and what a
 * lost one costs (docs/plan-phase7-lore.md, Decision 2: "you're driven back
 * to your castle. The Sky Kingdom takes a quarter of what your buildings
 * make as taxes until you conquer it. Each failed attempt raises the tax a
 * step").
 *
 *   an attack   begins when you reach the island (or its anchor towers)
 *               bearing the Black Ring; it's over when you leave again,
 *               bring the Sky King down, or lose it
 *   losing      you fall there, or your whole army does: you're driven back
 *               home, the tax goes up a step, and the Stone King makes up
 *               fewer of the warriors you lost each time
 *
 * Pure logic like War.js; Game decides when an attack begins or is lost,
 * DuiltGame saves it and charges the tax on what your buildings make.
 */

/** The tax by how many attacks you've lost: none until the first. */
export const TAX_RATES = [0, 0.25, 0.35, 0.45, 0.5];
/** The share of the warriors lost in an attack the Stone King replaces, after the first, second, third and every later loss. */
export const REPLACED = [0.75, 0.5, 0.25, 0];

export class SkyWar {
  constructor() {
    this.failures = 0;
    this.attack = null;   // { since: days, army: warriors when it began }
    this.taxed = 0;       // everything the Sky Kingdom has taken, all told
  }

  /** What the Sky Kingdom takes of what your buildings make — nothing once it has fallen. */
  taxRate(fallen = false) {
    if (fallen) return 0;
    return TAX_RATES[Math.min(this.failures, TAX_RATES.length - 1)];
  }

  /** An attack begins (once until it's over). Returns whether it began now. */
  begin(days, army = 0) {
    if (this.attack) return false;
    this.attack = { since: days, army };
    return true;
  }

  /** You've left the island alive: the attack is over, nothing lost. */
  withdraw() {
    this.attack = null;
  }

  /**
   * The attack is lost. Returns { failures, rate, lost, replaced } — the
   * tax now, the warriors lost in it and how many the Stone King sends to
   * make up for them — or null if there was no attack to lose.
   */
  lose(armyNow = 0) {
    if (!this.attack) return null;
    const lost = Math.max(0, this.attack.army - armyNow);
    this.failures++;
    const share = REPLACED[Math.min(this.failures - 1, REPLACED.length - 1)];
    this.attack = null;
    return { failures: this.failures, rate: this.taxRate(), lost, replaced: Math.round(lost * share) };
  }

  toJSON() {
    return { failures: this.failures, attack: this.attack, taxed: this.taxed };
  }

  loadJSON(data) {
    this.failures = Number.isInteger(data?.failures) && data.failures > 0 ? data.failures : 0;
    const a = data?.attack;
    this.attack = a && Number.isFinite(a.since) && Number.isFinite(a.army) ? { since: a.since, army: a.army } : null;
    this.taxed = Number.isFinite(data?.taxed) ? data.taxed : 0;
  }
}
