/**
 * Ways of taking more than one block away at a time.
 *
 * Breaking is how you take a block back — that is the loop, and the block goes
 * in your bag when you do. It is also the only way, which is fine for one block
 * and ridiculous for sixty: a roof you have gone off, a hillside in the way of
 * a foundation, a stump of an old wall. Sixty taps is not a game mechanic, it
 * is a chore the game is making you do because nothing else can.
 *
 * So the same idea as the roof tool, pointed the other way. You aim at
 * something, it works out what "that" means, and it all goes in your bag in one
 * go — paid for, bounded by your border, and refused over a claimed building
 * exactly as breaking one block by hand would be.
 *
 * Two kinds, because there are two questions. "This thing I built" is a shape
 * the game can work out for itself by following the blocks. "This bit of
 * ground" has no shape at all, so it takes a size.
 *
 * How to read one:
 *
 *   id      what the panel and the queued tool are keyed on
 *   name    what it is called on screen
 *   note    one line on what it is for
 *   kind    'build' follows what somebody placed; 'cube' takes a fixed box
 *   size    for a cube, how many blocks across — always odd, so the block you
 *           are pointing at is the middle one
 */

export const CLEARS = [
  {
    id: 'build',
    name: 'This build',
    note: 'Everything joined to what you point at that somebody put there. Stops at the ground.',
    kind: 'build',
  },
  {
    id: 'cube3',
    name: '3 across',
    note: 'A small bite out of whatever you are aiming at, ground included.',
    kind: 'cube',
    size: 3,
  },
  {
    id: 'cube5',
    name: '5 across',
    note: 'A bigger one, for levelling ground or opening a way through a hill.',
    kind: 'cube',
    size: 5,
  },
  {
    id: 'cube9',
    name: '9 across',
    note: 'Most of a chunk in one go. Careful — it takes whatever is in the box.',
    kind: 'cube',
    size: 9,
  },
];

export const CLEARS_BY_ID = new Map(CLEARS.map((c) => [c.id, c]));

/**
 * A little drawing of what a shape takes, from its own numbers.
 *
 * Same reason the roof shapes draw themselves: four names in a list is four
 * guesses, and a drawing made by hand is a drawing that can end up lying about
 * what the tool does.
 */
export function clearArtSvg(spec, { cell = 7 } = {}) {
  if (!spec) return '';
  if (spec.kind === 'build') {
    // A little house rather than a grid — this one follows what you built.
    return `<svg class="clear-art" viewBox="0 0 56 42" width="56" height="42" aria-hidden="true" fill="currentColor">
      <rect x="10" y="20" width="36" height="20" rx="1"/>
      <path d="M6 20 28 6l22 14z" opacity="0.55"/>
      <rect x="24" y="30" width="8" height="10" rx="1" opacity="0.25"/>
    </svg>`;
  }
  const n = spec.size;
  const w = n * cell;
  const mid = (n - 1) / 2;
  const cells = [];
  for (let x = 0; x < n; x++) {
    for (let z = 0; z < n; z++) {
      const centre = x === mid && z === mid;
      cells.push(`<rect x="${x * cell + 0.5}" y="${z * cell + 0.5}" width="${cell - 1}" height="${cell - 1}"
        rx="1" opacity="${centre ? 1 : 0.42}"/>`);
    }
  }
  return `<svg class="clear-art" viewBox="0 0 ${w} ${w}" width="${w}" height="${w}"
    aria-hidden="true" fill="currentColor">${cells.join('')}</svg>`;
}
