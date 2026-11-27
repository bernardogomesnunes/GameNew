import { LEVELS, BUILDING_BONUS, DEFENCE } from '../config/levels.js';
import { ITEMS_BY_ID } from '../config/items.js';

/**
 * VIL-4, VIL-5, VIL-6: villager levels, stats and fighting numbers, as pure
 * rules (no world, no bus). A person carries `xp`; everything else is worked
 * out from it and from the village's buildings. Numbers: config/levels.js.
 */

const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
const TOP_XP = LEVELS.thresholds[LEVELS.max - 1];

/** The level (1 to LEVELS.max) that `xp` is. */
export function levelOf(xp) {
  const t = LEVELS.thresholds;
  let level = 1;
  for (let i = 1; i < LEVELS.max; i++) if (num(xp) >= t[i]) level = i + 1;
  return level;
}

/** xp at which `level` starts. */
export const xpFor = (level) => LEVELS.thresholds[Math.max(1, Math.min(LEVELS.max, level)) - 1];

/** { level, into, need, share }: progress through the current level; need is 0 at the top. */
export function progress(xp) {
  const level = levelOf(xp);
  if (level >= LEVELS.max) return { level, into: 0, need: 0, share: 1 };
  const from = xpFor(level), need = xpFor(level + 1) - from, into = num(xp) - from;
  return { level, into, need, share: Math.max(0, Math.min(1, into / need)) };
}

/**
 * Adds xp to `p`. `kind` is 'work' (n seconds on the job), 'item' (n items
 * made) or 'block' (n blocks placed). Returns the new level when it rose, else 0.
 */
export function gain(p, kind, n = 1) {
  const rate = { work: LEVELS.xp.perWorkSecond, item: LEVELS.xp.perItem, block: LEVELS.xp.perBlock }[kind];
  if (!rate || !(n > 0)) return 0;
  const before = levelOf(p.xp);
  p.xp = Math.min(TOP_XP, num(p.xp) + rate * n);
  const after = levelOf(p.xp);
  return after > before ? after : 0;
}

/** Fresh xp field for an arrival. */
export const newXp = () => ({ xp: 0 });
/** xp for a person loaded from a save that may predate levels: level 1. */
export const loadXp = (p) => ({ xp: Math.min(TOP_XP, num(p?.xp)) });

/** Bonus points one stat gets from the buildings in `list` ({ type, tier, valid }). */
export function bonusFrom(list, stat) {
  const table = BUILDING_BONUS[stat] ?? {};
  let total = 0;
  for (const [type, tiers] of Object.entries(table)) {
    let best = 0;
    for (const s of list) {
      if (s.type !== type || s.valid === false) continue;
      const v = tiers[Math.max(0, Math.min(tiers.length - 1, s.tier ?? 0))] ?? 0;
      if (v > best) best = v;
    }
    total += best;
  }
  return total;
}

/** { strength, intelligence } the village's buildings add. */
export const buildingBonuses = (list) => ({ strength: bonusFrom(list, 'strength'), intelligence: bonusFrom(list, 'intelligence') });

const speed = (cfg, intelligence) => Math.min(cfg.max, Math.max(0.1, 1 + cfg.perPoint * (intelligence - LEVELS.base.intelligence)));

// ---- VIL-6: fighting ------------------------------------------------------

/** Health at a strength. */
export const maxHp = (strength) => Math.max(1, Math.round(DEFENCE.hp.base + DEFENCE.hp.perStrength * (strength - LEVELS.base.strength)));

/** Bare-hand damage. */
export const punchDamage = (strength) => Math.max(0.5, DEFENCE.punch.base + DEFENCE.punch.perStrength * (strength - LEVELS.base.strength));

/** The item id if it is a real weapon, else null. */
export const weaponId = (id) => (ITEMS_BY_ID.get(id)?.weapon ? id : null);

/**
 * One blow: { damage, reach, every, range, ranged, weapon }. Without a weapon
 * they punch; a bow shoots (range); a sword closes in (reach). Damage grows
 * with strength: a weapon's own damage times (0.75 + 0.025 * strength).
 */
export function attackOf(weapon, strength) {
  const id = weaponId(weapon);
  if (!id) return { damage: punchDamage(strength), reach: DEFENCE.punch.reach, every: DEFENCE.punch.every, range: 0, ranged: false, weapon: null };
  const item = ITEMS_BY_ID.get(id);
  const factor = DEFENCE.scale.base + DEFENCE.scale.perStrength * strength;
  if (item.ranged) return { damage: DEFENCE.bow.damage * factor, reach: 0, every: DEFENCE.bow.every, range: DEFENCE.bow.range, ranged: true, weapon: id };
  return { damage: (item.damage ?? 1) * factor, reach: DEFENCE.melee.reach, every: DEFENCE.melee.every, range: 0, ranged: false, weapon: id };
}

/** Everything a villager's stats are, from their xp and the buildings' bonus ({ strength, intelligence }). */
export function statsFor(xp, bonus = {}) {
  const level = levelOf(xp);
  const strength = LEVELS.base.strength + LEVELS.perLevel.strength * (level - 1) + num(bonus.strength);
  const intelligence = LEVELS.base.intelligence + LEVELS.perLevel.intelligence * (level - 1) + num(bonus.intelligence);
  return {
    level, strength, intelligence,
    workSpeed: speed(LEVELS.speed.work, intelligence),
    buildSpeed: speed(LEVELS.speed.build, intelligence),
    maxHp: maxHp(strength),
  };
}
