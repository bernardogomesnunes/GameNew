/**
 * Roof shapes, as rules about height rather than as saved buildings.
 *
 * A house you have built by hand is four walls and a hole in the sky, because
 * the one thing nobody wants to place by hand is a slope: every course is a
 * block narrower than the one below it and one higher, and getting that wrong
 * in the middle of a wall is twenty blocks of undo. So the roof is a tool. You
 * frame the top of the walls with the selector, pick a shape, and it works out
 * the courses.
 *
 * Unlike a saved design, a shape has no fixed size — it is asked for a height
 * at a spot and answers, so the same gable fits a 4-wide shed and a 16-wide
 * hall. That is the whole reason this is a shape rather than four templates.
 *
 * How to read one:
 *
 *   id      what the panel and the pending roof are keyed on
 *   name    what it is called on screen
 *   note    one line on what it is for, for the panel
 *   turns   how many orientations it has — a hip roof looks the same from
 *           every side, a gable has two, a lean-to has four
 *   run     how many blocks across it travels per block up; 1 is a steep
 *           pitch, 2 a shallow one
 *   rises   the heights above the eave to fill in one column, as an array.
 *           Usually one block — a roof is a shell — but the ends of a gable
 *           return the whole stack, because a gable with open ends is a
 *           tunnel you can see the sky through.
 *
 * Orientation is the awkward part and always will be: a shape has to guess
 * which way the building faces, and the box is square, so it cannot. It guesses
 * the same way every time and R turns it — which is the same key that turns a
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
    rises({ ix, iz, w, l, turn, run }) {
      const alongX = turn % 2 === 1;
      // Across the ridge is where the slope is; along it, nothing changes.
      const across = alongX ? iz : ix;
      const span = alongX ? l : w;
      const rise = Math.floor(Math.min(across, span - 1 - across) / run);
      const along = alongX ? ix : iz;
      const length = alongX ? w : l;
      const gableEnd = along === 0 || along === length - 1;
      return gableEnd ? upTo(rise) : [rise];
    },
  },
  {
    id: 'hip',
    name: 'Hipped',
    note: 'Slopes on all four sides. On a square box, a pyramid — good for a tower.',
    turns: 1,
    run: 1,
    rises({ ix, iz, w, l, run }) {
      return [Math.floor(Math.min(ix, w - 1 - ix, iz, l - 1 - iz) / run)];
    },
  },
  {
    id: 'lean',
    name: 'Lean-to',
    note: 'One shallow slope falling one way. For a shed, a porch, or a low wing.',
    turns: 4,
    run: 2,
    rises({ ix, iz, w, l, turn, run }) {
      const away = [ix, iz, w - 1 - ix, l - 1 - iz][turn % 4];
      const rise = Math.floor(away / run);
      // The two sides the slope does not run down are open triangles, same as
      // the ends of a gable, so they get filled in.
      const alongX = turn % 2 === 0;
      const sideways = alongX ? iz : ix;
      const sideLen = alongX ? l : w;
      const openSide = sideways === 0 || sideways === sideLen - 1;
      return openSide ? upTo(rise) : [rise];
    },
  },
  {
    id: 'flat',
    name: 'Flat top',
    note: 'A deck with a low wall round it. A tower top, or a floor to build on.',
    turns: 1,
    run: 1,
    rises({ ix, iz, w, l }) {
      const edge = ix === 0 || iz === 0 || ix === w - 1 || iz === l - 1;
      return edge ? [0, 1] : [0];
    },
  },
];

export const ROOFS_BY_ID = new Map(ROOFS.map((r) => [r.id, r]));

/**
 * A little drawing of a shape, cut two ways, from the shape's own rules.
 *
 * Four names in a list is four guesses about what you get. Drawn from `rises`
 * rather than hand-made, so a shape cannot end up illustrated as something it
 * no longer is — the same reason the guide reads the ages rather than
 * describing them.
 *
 * Two cuts rather than one because one cut cannot tell a gable from a hipped
 * roof: side-on they are the same pitch, and the whole difference is that the
 * hip falls away the other way too. So: the cut across, then the cut along.
 */
export function roofProfileSvg(shape, { span = 8, cell = 6, gap = 7 } = {}) {
  if (!shape) return '';
  const run = shape.run ?? 1;
  const mid = Math.floor(span / 2);
  const cut = (alongZ) => {
    const cols = [];
    for (let i = 0; i < span; i++) {
      const at = alongZ ? { ix: mid, iz: i } : { ix: i, iz: mid };
      cols.push(shape.rises({ ...at, w: span, l: span, turn: 0, run }));
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
