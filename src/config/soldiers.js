import { ITEMS } from './items.js';

/**
 * What a barracks trains (backlog batch 3, #29: "Barracks train soldiers.
 * Archers, warriors, swordsmen, and a catapult crew who set one up and fire
 * it in a war. Each costs food and gear.").
 *
 * You choose who to train at the barracks, and pay for each one up front:
 * `food` pieces of any food (the plainest first), and the `gear` they're
 * sent out with. Training one takes TRAIN_DAYS (world/Defenders.js), one
 * after another, and a barracks holds a soldier a bunk. One that falls is
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
];
export const UNITS_BY_ID = new Map(UNITS.map((u) => [u.id, u]));

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
export function unitCost(unit, inventory) {
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
export function payForUnit(unit, inventory) {
  if (inventory.endless) return;
  let left = unit.food;
  for (const f of FOODS) {
    if (!left) break;
    const take = Math.min(left, inventory.countOf(f.id));
    if (take) { inventory.remove(f.id, take); left -= take; }
  }
  for (const [id, n] of Object.entries(unit.gear)) inventory.remove(id, n);
}
