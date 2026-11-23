import { ITEMS } from './items.js';

/**
 * What a barracks trains (backlog batch 3, #29: "Barracks train soldiers.
 * Archers, warriors, swordsmen, and a catapult crew who set one up and fire
 * it in a war. Each costs food and gear.").
 *
 * You choose who to train at the barracks, and pay for each one up front:
 * `food` pieces of any food (the plainest first), and the `gear` they're
 * sent out with. Training one takes TRAIN_DAYS (world/Defenders.js), one
 * after another, and a barracks holds as many as its level allows (SOLDIER_CAPS). One that falls is
 * gone — training another costs the same again.
 *
 *   id      what the barracks and the save know it by
 *   kind    the figure they're drawn as (config/outfits.js) — not `warrior`,
 *           which is the Stone Kingdom's own
 *   melee   { hits, reach, every }: a blow of `hits` when within `reach`, every `every` s
 *   ranged  { range, every, damage }: an arrow at whatever comes within `range`
 *   siege   { range, every, setup, packAfter }: a catapult set up in front of
 *           them — `setup` s to get it ready — that lobs stones at the enemy
 *           and is packed away `packAfter` s after the last of them is gone
 */
export const UNITS = [
  {
    id: 'warrior', kind: 'footman', name: 'Warrior', plural: 'warriors', hp: 20, speed: 3.3,
    melee: { hits: 3, reach: 1.9, every: 1.1 },
    food: 3, gear: { sword_stone: 1 },
    blurb: 'Quick and cheap: a stone sword and a cap.',
  },
  {
    id: 'swordsman', kind: 'swordsman', name: 'Swordsman', plural: 'swordsmen', hp: 32, speed: 3,
    melee: { hits: 5, reach: 1.9, every: 1 },
    food: 4, gear: { sword_iron: 1, armour_iron_body: 1 },
    blurb: 'An iron sword and a cuirass: takes more beating, hits harder.',
  },
  {
    id: 'archer', kind: 'bowman', name: 'Archer', plural: 'archers', hp: 14, speed: 3.2,
    ranged: { range: 20, every: 2, damage: 3 },
    food: 3, gear: { bow: 1, arrow: 20 },
    blurb: 'Shoots from where it stands, out to twenty blocks.',
  },
  {
    id: 'crew', kind: 'crew', name: 'Catapult crew', plural: 'catapult crews', hp: 16, speed: 2.6,
    siege: { range: 38, every: 6, setup: 4, packAfter: 20 },
    food: 5, gear: { catapult: 1, stone: 10 },
    blurb: 'Sets a catapult up in front of the barracks when the enemy comes, and lobs stones into them.',
  },
  {
    id: 'shield_guard', kind: 'shield_guard', name: 'Spear guard', plural: 'spear guards', hp: 30, speed: 3,
    melee: { hits: 4, reach: 2.2, every: 1.25 },
    food: 4, gear: { weapon_rack: 1 },
    blurb: 'A spear guard with a shield, trained by request at a Garrison. Uses one weapon rack and four food.',
  },
];
export const UNITS_BY_ID = new Map(UNITS.map((u) => [u.id, u]));

/**
 * How many soldiers a barracks or Garrison trains and holds, by its level
 * (IMP-2, IMP-3: "update the building and allow to create more, remove the
 * number of beds logic"). Level 1, 2 and 3: 10, 20 and 40. Beds are only
 * furniture now.
 */
export const SOLDIER_CAPS = [10, 20, 40];
export const soldierCap = (structure) => SOLDIER_CAPS[Math.min(Math.max(structure?.tier ?? 0, 0), SOLDIER_CAPS.length - 1)];

/** Soldiers trained before you chose who: they were swordsmen in all but name. */
export const LEGACY_UNIT = 'swordsman';

/** Every food, plainest first — what a soldier's keep is paid in. */
export const FOODS = ITEMS.filter((i) => i.kind === 'food').sort((a, b) => (a.feeds ?? 0) - (b.feeds ?? 0));

/** How much food `inventory` holds, in pieces. */
export function foodIn(inventory) {
  return FOODS.reduce((n, f) => n + inventory.countOf(f.id), 0);
}

/**
 * What training one `unit` would cost from `inventory`, and what's short:
 * { ok, short: ['2 food', 'iron sword'] }.
 */
export function unitCost(unit, inventory, research = null) {
  unit = unitStats(unit, research);  // PLAY-12: the gear a researched unit is sent out with
  if (inventory.endless) return { ok: true, short: [] };
  const short = [];
  const food = foodIn(inventory);
  if (food < unit.food) short.push(`${unit.food - food} food`);
  for (const [id, n] of Object.entries(unit.gear)) {
    const have = inventory.countOf(id);
    if (have < n) short.push(`${n - have > 1 ? `${n - have} ` : ''}${ITEMS.find((i) => i.id === id)?.name.toLowerCase() ?? id}`);
  }
  return { ok: !short.length, short };
}

/** Takes one `unit`'s food and gear from `inventory`. Check unitCost first. */
export function payForUnit(unit, inventory, research = null) {
  unit = unitStats(unit, research);  // PLAY-12
  if (inventory.endless) return;
  let left = unit.food;
  for (const f of FOODS) {
    if (!left) break;
    const take = Math.min(left, inventory.countOf(f.id));
    if (take) { inventory.remove(f.id, take); left -= take; }
  }
  for (const [id, n] of Object.entries(unit.gear)) inventory.remove(id, n);
}

// --- PLAY-12 (docs/design/play-12.md): what research does to a soldier -------
/** A blow is half the sword's damage, rounded: stone 6 gives 3, iron 9 gives 5, sky 12 gives 6, dark 13 gives 7. */
export const blowOfSword = (damage) => Math.round(damage / 2);

/**
 * `unit` as the Armoury's research has made it: hp, blow, arrows, catapults
 * and gear adjusted. `research` is the save's `{ id: true }` map. A pure
 * function: the same unit comes back when nothing applies, never a mutation.
 * Research applies to every soldier of the unit, old and new.
 */
export function unitStats(unit, research) {
  if (!unit || !research) return unit;
  const has = (id) => research[id] === true;
  let out = unit;
  const set = (patch) => { out = { ...out, ...patch }; };
  if (unit.id === 'warrior' && has('arms_iron')) {
    set({ melee: { ...unit.melee, hits: blowOfSword(9) }, gear: { sword_iron: 1 } });
  }
  if (unit.id === 'archer' && has('fletching')) {
    set({ ranged: { ...unit.ranged, damage: unit.ranged.damage + 1, range: unit.ranged.range + 4 } });
  }
  if (unit.id === 'swordsman') {
    if (has('shield_drill')) set({ hp: unit.hp + 8 });
    // Sky and Dark Arms are the ring's: one or the other, dark if somehow both.
    const ring = has('arms_dark') ? ['dark', 13] : has('arms_sky') ? ['sky', 12] : null;
    if (ring) set({ melee: { ...unit.melee, hits: blowOfSword(ring[1]) }, gear: { [`sword_${ring[0]}`]: 1, armour_iron_body: 1 } });
  }
  if (unit.id === 'shield_guard' && has('shield_drill')) set({ hp: unit.hp + 8 });
  if (unit.id === 'crew' && has('siege_works')) set({ siege: { ...unit.siege, every: 4.5, setup: 2.5 } });
  return out;
}

/** A watchtower's archer with Fletching: the same +1 damage and +4 range an archer gets. */
export function towerArcherStats(base, research) {
  if (!research || research.fletching !== true) return base;
  return { ...base, damage: base.damage + 1, range: base.range + 4 };
}

/**
 * How strong a unit is as one number (the War Hall's power): melee is
 * hp x blow / every, ranged doubles it for the range, a catapult crew is 60.
 */
export function unitPower(unit) {
  if (!unit) return 0;
  if (unit.melee) return (unit.hp * unit.melee.hits) / unit.melee.every;
  if (unit.ranged) return (2 * unit.hp * unit.ranged.damage) / unit.ranged.every;
  if (unit.siege) return 60 * (6 / unit.siege.every);
  return 0;
}
// --- end PLAY-12 ---
