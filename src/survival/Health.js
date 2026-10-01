/**
 * Health — ten hearts, counted in halves.
 *
 * Phase 6, the part everything with teeth needs: nothing could hurt you
 * before this, so a bandit, a fall or a lava pool was scenery. Chosen
 * directly: ten hearts; falls and lava hurt; food heals you while you're
 * fed, resting in a house heals you faster; dying sends you home and leaves
 * what you carried in a chest where you fell (see Game.die).
 *
 * The numbers are first guesses, all here, cheap to change once it's been
 * played.
 */

/** Ten hearts, in halves. */
export const MAX_HEALTH = 20;
/** A fall this many blocks or less doesn't hurt. */
export const SAFE_FALL = 3;
/** Half-hearts a second in lava — five seconds from full to nothing. */
export const LAVA_PER_SECOND = 4;
/** How often healing ticks, in seconds, and how much hunger it needs. */
const REGEN_EVERY = 4;
const REGEN_ABOVE_HUNGER = 0.6;
/** Resting in a house heals this many times faster. */
export const HOUSE_REGEN = 2;
/** After a hit, a moment when the same source can't hit again. */
const HURT_COOLDOWN = 0.5;

export class Health {
  constructor(bus) {
    this.bus = bus;
    this.value = MAX_HEALTH;
    this.regenClock = 0;
    this.cooldown = 0;
  }

  get hearts() {
    return this.value / 2;
  }

  get ratio() {
    return this.value / MAX_HEALTH;
  }

  get dead() {
    return this.value <= 0;
  }

  /**
   * Takes `amount` half-hearts off. Returns what was actually taken. A
   * `steady` source (lava, which hurts every frame) goes through the
   * cooldown so it stings in beats rather than draining silently.
   */
  hurt(amount, cause = 'hurt', { steady = false } = {}) {
    if (amount <= 0 || this.dead) return 0;
    if (steady && this.cooldown > 0) return 0;
    const before = this.value;
    this.value = Math.max(0, this.value - amount);
    this.cooldown = HURT_COOLDOWN;
    this.regenClock = 0;
    const taken = before - this.value;
    this.bus?.emit('health:change', { value: this.value, ratio: this.ratio, hurt: taken, cause });
    if (this.dead) this.bus?.emit('health:died', { cause });
    return taken;
  }

  heal(amount) {
    if (amount <= 0 || this.dead) return 0;
    const before = this.value;
    this.value = Math.min(MAX_HEALTH, this.value + amount);
    if (this.value !== before) this.bus?.emit('health:change', { value: this.value, ratio: this.ratio, healed: this.value - before });
    return this.value - before;
  }

  /**
   * Heals half a heart every few seconds while you're fed (above
   * REGEN_ABOVE_HUNGER of full), twice as often resting in a house.
   */
  tick(dt, { hungerRatio = 1, resting = false } = {}) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.dead || this.value >= MAX_HEALTH || hungerRatio < REGEN_ABOVE_HUNGER) {
      this.regenClock = 0;
      return;
    }
    this.regenClock += dt * (resting ? HOUSE_REGEN : 1);
    while (this.regenClock >= REGEN_EVERY) {
      this.regenClock -= REGEN_EVERY;
      this.heal(1);
    }
  }

  /** Back to full — a respawn. */
  restore() {
    this.value = MAX_HEALTH;
    this.regenClock = 0;
    this.cooldown = 0;
    this.bus?.emit('health:change', { value: this.value, ratio: this.ratio });
  }

  toJSON() {
    return { value: this.value };
  }

  loadJSON(data) {
    // A save from before health had any is at full; so is one that died
    // mid-save, which would otherwise load straight into death.
    const v = data?.value;
    this.value = typeof v === 'number' && v > 0 ? Math.min(MAX_HEALTH, v) : MAX_HEALTH;
  }
}

/** What a fall of `blocks` costs, in half-hearts. */
export function fallDamage(blocks) {
  return Math.max(0, Math.floor(blocks - SAFE_FALL));
}
