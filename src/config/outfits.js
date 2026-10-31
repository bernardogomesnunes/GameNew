/**
 * What people wear, by who they are (docs/history/plan-look-and-sound.md, section 5:
 * "outfits that say who they are"). Read by render/SettlerView.js, which draws
 * everybody — settlers, wanderers, guards, kings, your soldiers and your army
 * — from the one model.
 *
 *   hat       'crown', 'helm', 'hood' or 'cap'; none shows their hair
 *   hatColour the hat's colour; without it, the person's own `helm`
 *   visor     a dark slit across a helm's face
 *   plume     a plume on top, this colour
 *   cape      a cape down the back, this colour
 *   beard     always a beard, this colour (otherwise one in four men, in their hair colour)
 *   gear      what's in the right hand: 'sword', 'spear', 'staff' or 'bow'
 *   gearColour the blade's (or bow's) colour, if not plain steel or wood
 *   ears      a goblin's ears, out to the sides
 *   nose      a goblin's long nose
 *
 * Anyone not listed (settlers) wears their hair and carries nothing.
 */

export const OUTFITS = {
  // The Stone Kingdom: dark plate, visors, and their King in iron and red.
  guard: { hat: 'helm', hatColour: 0x2c2a31, visor: true, gear: 'spear' },
  king: { hat: 'crown', hatColour: 0xb08a3a, cape: 0x6b1f24, beard: 0x2a2228, gear: 'sword' },
  warlord: { hat: 'helm', visor: true, plume: 0x9a2c2c, cape: 0x1d1a22, gear: 'sword' },
  warrior: { hat: 'helm', visor: true, gear: 'sword' },
  // The Sky Kingdom: white and gold, with plumes.
  sky_guard: { hat: 'helm', plume: 0xfafafa, gear: 'spear' },
  royal_guard: { hat: 'helm', plume: 0xc0392b, gear: 'spear', gearColour: 0xe8c04f },
  sky_king: { hat: 'crown', cape: 0x3a5aa8, beard: 0xece6d8, gear: 'sword', gearColour: 0xe8c04f },
  // Out in the world.
  bandit: { hat: 'hood', hatColour: 0x2f2925, gear: 'sword' },
  hermit: { hat: 'hood', hatColour: 0x6b6355, beard: 0xd9d4c8, gear: 'staff' },
  explorer: { hat: 'cap', hatColour: 0x7a5a3a, gear: 'staff' },
  messenger: { hat: 'cap', hatColour: 0x2f4f7a },
  // The gods in their cube, and their creatures.
  dark_god: { hat: 'crown', hatColour: 0x4a3a5a, cape: 0x1d1a22, beard: 0x2a2228, gear: 'sword', gearColour: 0x6a4a8a },
  white_god: { hat: 'crown', hatColour: 0xe8c04f, cape: 0xfafafa, beard: 0xece6d8, gear: 'staff' },
  shade: { hat: 'hood', hatColour: 0x16131a, gear: 'sword', gearColour: 0x4a3a5a },
  seraph: { hat: 'helm', plume: 0xfafafa, gear: 'spear', gearColour: 0xe8c04f },
  // A living city's people.
  citizen: { hat: 'cap' },
  // A rival's soldiers and guards, in helms (their coats are their city's colour).
  rival_soldier: { hat: 'helm', gear: 'sword', gearColour: 0xafafb7 },
  rival_guard: { hat: 'helm', gear: 'spear', gearColour: 0xafafb7 },
  // The Future's people: a pale visor.
  futurian: { hat: 'helm', hatColour: 0xe8eef4 },
  city_guard: { hat: 'helm', gear: 'spear', gearColour: 0xafafb7 },
  merchant: { hat: 'cap', beard: 0x5a3f2a },
  // The tree people: leaf-green hoods, and bows.
  tribe: { hat: 'hood', hatColour: 0x3c7a2c, gear: 'bow', gearColour: 0x6b4a2e },
  // A market's traders (config/traders.js): goblins — green, with big ears
  // and a long nose, under a cap the colour of their trade.
  trader: { hat: 'cap', ears: true, nose: true },
  // Yours.
  soldier: { hat: 'helm', gear: 'sword' },
  archer: { hat: 'hood', gear: 'bow' },
  // What a barracks trains (config/soldiers.js).
  footman: { hat: 'cap', hatColour: 0x7a5a3a, gear: 'sword', gearColour: 0xafafb7 },
  swordsman: { hat: 'helm', plume: 0x3a5aa8, gear: 'sword' },
  bowman: { hat: 'hood', hatColour: 0x3f5a34, gear: 'bow' },
  crew: { hat: 'cap', hatColour: 0x5a4030 },
};

const GROUP_OUTFITS = {
  caravan_guard: { hat: 'helm', hatColour: 0xc9a46c, gear: 'spear' },
  caravaner: { hat: 'cap', hatColour: 0x9a6847 },
  moss_guard: { hat: 'helm', hatColour: 0x829c60, gear: 'spear' },
  mossfolk: { hat: 'hood', hatColour: 0x748c56 },
};

/** What someone wears — their kind's outfit, or nothing special. */
export function outfitOf(person) {
  if (person?.unit === 'shield_guard') return { hat: 'helm', visor: true, gear: 'spear', shield: true };
  return OUTFITS[person?.kind] ?? GROUP_OUTFITS[person?.kind] ?? null;
}

/**
 * Work clothes (owner, 31 October: villagers "remain as they are and have a
 * change of style and avatar when they get a job", "the job should match").
 * A villager keeps their own model and face; at work they wear a vest in the
 * job's colour, the job's hat and its tool in the right hand (see
 * SettlerView.workClothes). Back to their own look when the job ends.
 *
 *   name   what the job is called
 *   vest   the work vest's colour
 *   hat    'cap', 'straw' (a wide brim), 'helm' (a hard hat) or 'hood'
 *   hatColour
 *   tool   'axe', 'hoe', 'pick', 'hammer', 'sack', 'tongs', 'staff', 'ledger' or 'mug'
 */
export const JOB_OUTFITS = {
  woodcutter: { name: 'Woodcutter', vest: 0x4f6b3a, hat: 'cap', hatColour: 0x3a4a2a, tool: 'axe' },
  farmer: { name: 'Farmer', vest: 0x8a6a3a, hat: 'straw', hatColour: 0xd9b860, tool: 'hoe' },
  miner: { name: 'Miner', vest: 0x5a5a62, hat: 'helm', hatColour: 0xc9a227, tool: 'pick' },
  kiln_worker: { name: 'Kiln worker', vest: 0x8a3f2a, hat: 'cap', hatColour: 0x5a2a1a, tool: 'tongs' },
  trader: { name: 'Market trader', vest: 0x2f5a8a, hat: 'cap', hatColour: 0x1f3a5a, tool: 'sack' },
  clerk: { name: 'Clerk', vest: 0x2a2a3a, hat: 'cap', hatColour: 0x1a1a24, tool: 'ledger' },
  innkeeper: { name: 'Innkeeper', vest: 0xece6d8, hat: 'cap', hatColour: 0x7a5a3a, tool: 'mug' },
  acolyte: { name: 'Acolyte', vest: 0xf2ead2, hat: 'hood', hatColour: 0xd9c27a, tool: 'staff' },
  builder: { name: 'Builder', vest: 0xd9822b, hat: 'helm', hatColour: 0xe8c04f, tool: 'hammer' },
  hauler: { name: 'Carrier', vest: 0x7a5a3a, hat: 'cap', hatColour: 0x5a4030, tool: 'sack' },
};

/** The job a building gives the villager working it (config/structures.js ids). */
export const JOB_FOR_BUILDING = {
  forest: 'woodcutter', farm: 'farmer', village: 'farmer', quarry: 'miner', mine: 'miner',
  kiln: 'kiln_worker', market: 'trader', townhall: 'clerk', tavern: 'innkeeper', temple: 'acolyte',
};
