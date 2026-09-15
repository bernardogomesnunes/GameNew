/**
 * Roof shapes, as rules about height rather than as saved buildings.
 *
 * A house you have built by hand is four walls and a hole in the sky, because
 * the one thing nobody wants to place by hand is a slope: every course is a
 * block narrower than the one below it and one higher, and getting that wrong
 * in the middle of a wall is twenty blocks of undo. So the roof is a tool. You
 * point at the house and it works out the courses.
 *
 * A shape is asked, for one column of the building, how far it is to the edge
 * the four ways out — west, east, north, south — and answers with the heights
 * to fill. Distances rather than "you are 3 along a box 8 wide" is what lets
 * the same gable fit a 4-wide shed, a 17-wide hall and an L-shaped cottage: it
 * never learns the shape of the building, only where the edges are from here.
 *
 * How to read one:
 *
 *   id      what the panel and the pending roof are keyed on
 *   name    what it is called on screen
 *   note    one line on what it is for, for the panel
 *   turns   how many orientations it has — a hipped roof looks the same from
 *           every side, a gable has two, a lean-to has four
 *   run     how many blocks across it travels per block up; 1 is a steep
 *           pitch, 2 a shallow one
 *   rises   the heights above the eave to fill in this column, as an array.
 *           Usually one block — a roof is a shell — but the ends of a gable
 *           return the whole stack, because a gable with open ends is a
 *           tunnel you can see the sky through.
 *
 * The distances handed to `rises` count the column itself, so a column on the
 * edge is 1 away from it, and a shape works in `d - 1` steps of slope.
 *
 * Orientation stays the awkward part: nothing about a building says which way
 * it fronts, so a shape guesses, and R turns it — the same key that turns a
 * design before stamping it, so there is one thing to remember rather than two.
 */

/** Every height from 0 up to and including `top`. The filled end of a gable. */
function upTo(top) {
  const out = [];
  for (let i = 0; i <= top; i++) out.push(i);
  return out;
}

export const ROOFS = [
  {
    id: 'gable',
    name: 'Gable',
    note: 'A ridge down the middle and two slopes. The roof a house has.',
    turns: 2,
    run: 1,
    rises({ xm, xp, zm, zp, turn, run }) {
      const alongX = turn % 2 === 1;                       // which way the ridge runs
      const across = alongX ? Math.min(zm, zp) : Math.min(xm, xp);
      const rise = Math.floor((across - 1) / run);
      // The ends the ridge points at are open triangles until they are filled.
      const end = alongX ? (xm === 1 || xp === 1) : (zm === 1 || zp === 1);
      return end ? upTo(rise) : [rise];
    },
  },
  {
    id: 'hip',
    name: 'Hipped',
    note: 'Slopes on all four sides. Over a square building, a pyramid — good for a tower.',
    turns: 1,
    run: 1,
    rises({ xm, xp, zm, zp, run }) {
      return [Math.floor((Math.min(xm, xp, zm, zp) - 1) / run)];
    },
  },
  {
    id: 'lean',
    name: 'Lean-to',
    note: 'One shallow slope falling one way. For a shed, a porch, or a low wing.',
    turns: 4,
    run: 2,
    rises({ xm, xp, zm, zp, turn, run }) {
      const away = [xm, zm, xp, zp][turn % 4];
      const rise = Math.floor((away - 1) / run);
      // The two sides the slope does not run down are open, same as a gable end.
      const alongX = turn % 2 === 0;
      const open = alongX ? (zm === 1 || zp === 1) : (xm === 1 || xp === 1);
      return open ? upTo(rise) : [rise];
    },
  },
  {
    id: 'flat',
    name: 'Flat top',
    note: 'A deck with a low wall round it. A tower top, or a floor to build on.',
    turns: 1,
    run: 1,
    rises({ xm, xp, zm, zp }) {
      return Math.min(xm, xp, zm, zp) === 1 ? [0, 1] : [0];
    },
  },
];

export const ROOFS_BY_ID = new Map(ROOFS.map((r) => [r.id, r]));

/**
 * A little drawing of a shape, cut two ways, from the shape's own rules.
 *
 * Four names in a list is four guesses about what you get. Drawn by asking the
 * shape about a square building rather than hand-made, so a shape cannot end up
 * illustrated as something it no longer is — the same reason the guide reads
 * the ages rather than describing them.
 *
 * Two cuts because one cannot tell a gable from a hipped roof: side-on they are
 * the same pitch, and the whole difference is that the hip falls away the other
 * way too. So: the cut across, then the cut along.
 */
export function roofProfileSvg(shape, { span = 8, cell = 6, gap = 7 } = {}) {
  if (!shape) return '';
  const run = shape.run ?? 1;
  const mid = Math.ceil(span / 2);
  // A square building, described the way a real pick describes one.
  const spanAt = (i, j) => ({ xm: i + 1, xp: span - i, zm: j + 1, zp: span - j });
  const cut = (alongZ) => {
    const cols = [];
    for (let i = 0; i < span; i++) {
      const d = alongZ ? spanAt(mid - 1, i) : spanAt(i, mid - 1);
      cols.push(shape.rises({ ...d, turn: 0, run }));
    }
    return cols;
  };
  const cuts = [cut(false), cut(true)];
  const peak = Math.max(...cuts.flat(2));
  const w = span * cell * 2 + gap, h = (peak + 2) * cell;
  const parts = cuts.map((cols, c) => {
    const ox = c * (span * cell + gap);
    // A stub of wall under each, so the drawing reads as a roof on something.
    const wall = `<rect x="${ox}" y="${h - cell / 2}" width="${span * cell}" height="${cell / 2}" opacity="0.28"/>`;
    const squares = cols.flatMap((rises, i) => rises.map((r) => {
      const y = h - cell - (r + 0.5) * cell;
      return `<rect x="${ox + i * cell}" y="${y}" width="${cell}" height="${cell}" rx="1"/>`;
    })).join('');
    return wall + squares;
  }).join('');
  return `<svg class="roof-profile" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
    aria-hidden="true" fill="currentColor">${parts}</svg>`;
}

/** What to call the way a shape is turned, for the readout. */
export function facingLabel(shape, turn) {
  if (!shape || shape.turns <= 1) return '';
  if (shape.turns === 2) return turn % 2 ? 'ridge east-west' : 'ridge north-south';
  return ['falls west', 'falls north', 'falls east', 'falls south'][turn % 4];
}
