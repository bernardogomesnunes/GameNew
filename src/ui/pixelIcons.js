/**
 * Pixel icons, for the pixel-art screens (asked for directly: "Let's give it
 * a pixel art kinda look and feel instead of the plain ui we have now ...
 * Delete should be a trash bin instead of a cross").
 *
 * Each is a little bitmap — `#` is ink, anything else is clear — drawn as
 * square SVG cells with crisp edges, so it stays blocky at any size and
 * takes its colour from the text round it, like the stroke icons do
 * (ui/icons.js).
 */
const BITMAPS = {
  trash: [
    '....####....',
    '.##########.',
    '............',
    '.##########.',
    '.#.#.##.#.#.',
    '.#.#.##.#.#.',
    '.#.#.##.#.#.',
    '.#.#.##.#.#.',
    '.#.#.##.#.#.',
    '.#.#.##.#.#.',
    '..########..',
    '............',
  ],
  plus: [
    '............',
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '.##########.',
    '.##########.',
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '.....##.....',
    '............',
  ],
  open: [
    '............',
    '.####.......',
    '.#..#######.',
    '.#........#.',
    '.#..########',
    '.#.#.......#',
    '.#.#......#.',
    '.##.......#.',
    '.##......#..',
    '.#########..',
    '............',
    '............',
  ],
  person: [
    '....####....',
    '...######...',
    '...######...',
    '...######...',
    '....####....',
    '............',
    '..########..',
    '.##########.',
    '.##########.',
    '.##########.',
    '.##########.',
    '............',
  ],
  gear: [
    '.....##.....',
    '..#.####.#..',
    '.##########.',
    '..###..###..',
    '.###....###.',
    '####....####',
    '####....####',
    '.###....###.',
    '..###..###..',
    '.##########.',
    '..#.####.#..',
    '.....##.....',
  ],
  back: [
    '............',
    '....#.......',
    '...##.......',
    '..###.......',
    '.##########.',
    '###########.',
    '.##########.',
    '..###.......',
    '...##.......',
    '....#.......',
    '............',
    '............',
  ],
  play: [
    '............',
    '..##........',
    '..####......',
    '..######....',
    '..########..',
    '..#########.',
    '..########..',
    '..######....',
    '..####......',
    '..##........',
    '............',
    '............',
  ],
  warn: [
    '.....##.....',
    '....####....',
    '....####....',
    '...##..##...',
    '...##..##...',
    '..###..###..',
    '..###..###..',
    '.##########.',
    '.####..####.',
    '############',
    '############',
    '............',
  ],
};

/** An icon as inline SVG markup, `size` pixels square. */
export function pixelIcon(name, size = 18) {
  const rows = BITMAPS[name];
  if (!rows) return '';
  const h = rows.length, w = rows[0].length;
  let cells = '';
  rows.forEach((row, y) => {
    // Runs of ink in a row as one rect each — fewer elements, same picture.
    let x = 0;
    while (x < w) {
      if (row[x] !== '#') { x++; continue; }
      let end = x;
      while (end < w && row[end] === '#') end++;
      cells += `<rect x="${x}" y="${y}" width="${end - x}" height="1"/>`;
      x = end;
    }
  });
  return `<svg class="px-icon" viewBox="0 0 ${w} ${h}" width="${size}" height="${size}" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${cells}</svg>`;
}

export const PIXEL_ICONS = Object.keys(BITMAPS);
