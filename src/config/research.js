/**
 * PLAY-12 (docs/design/play-12.md): what the Armoury researches.
 *
 * Each piece is a study recipe at the `armoury` station. It is paid when it
 * starts and learnt after `1 + level` game days (DuiltGame.researchDays),
 * one at a time per building. What a learnt piece does to a soldier is in
 * config/soldiers.js `unitStats`.
 *
 *   id     what the save knows it by (`research[id] === true`)
 *   age    the Age it is first offered
 *   level  sets the days: 1 + level
 *   cost   paid at the start
 *   after  another piece of research that must be learnt first
 *   ring   'white' or 'black': needs that ring forged, and the other is closed
 *   group  pieces of one group are alternatives: learning one hides the rest
 *   effect what it does, in words
 */
export const RESEARCH = [
  {
    id: 'arms_iron', name: 'Iron Arms', age: 8, level: 1,
    cost: { iron_ingot: 8, planks: 8 },
    effect: 'Warriors train with an iron sword in place of a stone one. Warrior blow 3 to 5.',
  },
  {
    id: 'fletching', name: 'Fletching', age: 8, level: 1,
    cost: { planks: 12, string: 8, feather: 8 },
    effect: 'Archers and watchtower archers: damage 3 to 4, range 20 to 24.',
  },
  {
    id: 'shield_drill', name: 'Shield Drill', age: 9, level: 2,
    cost: { iron_ingot: 6, leather: 6, planks: 6 },
    effect: 'Swordsmen hp 32 to 40, spear guards hp 30 to 38.',
  },
  {
    id: 'siege_works', name: 'Siege Works', age: 9, level: 2,
    cost: { planks: 20, stone: 20, iron_ingot: 4 }, after: 'engineering',
    effect: 'Catapult crews: a stone every 6 s to 4.5 s, setup 4 s to 2.5 s.',
  },
  {
    id: 'arms_sky', name: 'Sky Arms', age: 10, level: 3, ring: 'white', group: 'arms_ring',
    cost: { sky_marble: 6, gold: 4 },
    effect: 'Swordsmen train with a sky sword: blow 6. Gear becomes that sword and the iron cuirass.',
  },
  {
    id: 'arms_dark', name: 'Dark Arms', age: 10, level: 3, ring: 'black', group: 'arms_ring',
    cost: { dark_stone: 6, iron_ingot: 4 },
    effect: 'Swordsmen train with a dark sword: blow 7. Gear becomes that sword and the iron cuirass.',
  },
];

export const RESEARCH_BY_ID = new Map(RESEARCH.map((r) => [r.id, r]));

/** Everything the save may keep under `research`: engineering (the University's) and the Armoury's pieces. */
export const RESEARCH_IDS = ['engineering', ...RESEARCH.map((r) => r.id)];

/** The Armoury's pieces learnt, as names, in list order. */
export function learntNames(research) {
  return RESEARCH.filter((r) => research?.[r.id]).map((r) => r.name);
}
