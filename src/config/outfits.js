/**
 * What people wear, by who they are (docs/plan-look-and-sound.md, section 5:
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

/** What someone wears — their kind's outfit, or nothing special. */
export function outfitOf(person) {
  return OUTFITS[person?.kind] ?? null;
}
