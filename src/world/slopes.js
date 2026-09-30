import { boxesFor, turn } from './propShapes.js';

/**
 * The shapes that climb: stairs, and roof tiles.
 *
 * Two things set them apart from the rest of the props. They join their
 * neighbours: requested directly, "on the stairs a small detail that would be
 * pretty nice, is to have corner stairs" — two runs meeting at a corner turn
 * it, outwards or inwards, the way a fence joins the fence beside it. And a
 * roof tile is a real slope rather than a stack of boxes, laid in rows of
 * tiles — "telhas".
 *
 * Every piece is described by a height over its cell. A straight stair or
 * roof climbs away from one edge (its facing — see blocks.js's TURNS). A
 * corner climbs away from two: at an outer corner only the corner where
 * those edges meet is high, at an inner one everything but the opposite
 * corner is. Measured as `a`, how far a point is from the first edge, and
 * `b` from the second, a straight piece's height follows `a`, an outer
 * corner's `max(a, b)` and an inner corner's `min(a, b)` — which is all a
 * corner is.
 */

/** Which kinds join up: a stair only with stairs, a roof piece only with the same pitch. */
export const SLOPE_KIND = { stair: 1, roof: 2, roof_lo: 3, roof_hi: 4 };

/** The way each facing climbs, as (dx, dz): -z, +x, +z, -x. */
export const CLIMBS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/**
 * How a slope at a cell meets its neighbours, the way Minecraft's stairs do:
 * with a slope of its own kind behind it (on its high side) turned across it,
 * it's an outer corner; with one in front turned across it, an inner one.
 * Not when the run simply carries on past — then it's a straight run that
 * happens to have a corner beside it.
 *
 * `at(dx, dz)` answers what's beside the cell: { kind, facing } or null.
 * Returns null for straight, or { type: 'outer' | 'inner', second } where
 * `second` is the other way the corner climbs.
 */
export function cornerOf(kind, facing, at) {
  const same = (n, f) => n && n.kind === kind && n.facing === f;
  const [bx, bz] = CLIMBS[facing];
  const behind = at(bx, bz);
  if (behind && behind.kind === kind && (behind.facing & 1) !== (facing & 1)) {
    const [ox, oz] = CLIMBS[(behind.facing + 2) & 3];
    if (!same(at(ox, oz), facing)) return { type: 'outer', second: behind.facing };
  }
  const front = at(-bx, -bz);
  if (front && front.kind === kind && (front.facing & 1) !== (facing & 1)) {
    const [ox, oz] = CLIMBS[front.facing];
    if (!same(at(ox, oz), facing)) return { type: 'inner', second: front.facing };
  }
  return null;
}

/** How far (x, z) in a cell is from its edge on the side a facing climbs towards. */
function from(facing, x, z) {
  return [z, 1 - x, 1 - z, x][facing];
}

/** Heights at the low and high side of each pitch. */
const PITCH = { roof: [0, 1], roof_lo: [0, 0.5], roof_hi: [0.5, 1] };

/** The tiles' own look: four rows across a block, two courses down it. */
const TILE_ROWS = 4, TILE_COURSES = 2, TILE_RISE = 0.05, TILE_GAP = 0.028, COURSE_GAP = 0.02;
/** How much darker the bed between the tiles is. */
const BED = 0.72;

const cache = new Map();

/**
 * The geometry for a slope: `{ boxes, faces }` in unit-cell space. Boxes are
 * the usual prop boxes; faces are polygons `{ pts: [[x, y, z]...], out,
 * tone }` with `out` a rough outward direction and `tone` a shade to multiply
 * the colour by.
 */
export function slopeGeometry(shape, facing = 0, corner = null) {
  const key = `${shape}|${facing}|${corner?.type ?? ''}|${corner?.second ?? ''}`;
  let g = cache.get(key);
  if (!g) {
    g = shape === 'stair' ? stairGeometry(facing, corner) : roofGeometry(shape, facing, corner);
    cache.set(key, g);
  }
  return g;
}

// ---- stairs ---------------------------------------------------------------------

/**
 * A straight stair is its three boxes turned. A corner is built as a 3×3
 * of columns, each as tall as its step — the same three steps, turned the
 * corner.
 */
function stairGeometry(facing, corner) {
  if (!corner) return { boxes: turn(boxesFor('stair'), facing), faces: [] };
  const boxes = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const x = (i + 0.5) / 3, z = (j + 0.5) / 3;
      const a = from(facing, x, z), b = from(corner.second, x, z);
      const d = corner.type === 'outer' ? Math.max(a, b) : Math.min(a, b);
      const h = 1 - Math.floor(d * 3) / 3;
      boxes.push({ minX: i / 3, maxX: (i + 1) / 3, minY: 0, maxY: h, minZ: j / 3, maxZ: (j + 1) / 3 });
    }
  }
  return { boxes, faces: [] };
}

// ---- roofs ----------------------------------------------------------------------

/**
 * A roof piece: its sloping top as one or more flat regions, each laid with
 * tiles, then walls down its sides and a floor under it, so it's solid from
 * every side.
 *
 * A region is { poly: [[x, z]...], height(x, z), down: 'x' | 'z' } — the
 * outline, the height of the plane over it, and which axis the slope runs
 * down, which is the way the tiles' rows run.
 */
function roofGeometry(shape, facing, corner) {
  const regions = [];
  let heightAt;

  if (shape === 'roof_ridge_x' || shape === 'roof_ridge_z') {
    // A cap along the ridge: two half-slopes meeting in the middle, as steep
    // as the roof they top.
    const alongX = shape === 'roof_ridge_x';
    const h = (x, z) => 0.5 - Math.abs((alongX ? z : x) - 0.5);
    heightAt = h;
    const halves = alongX
      ? [[[0, 0], [1, 0], [1, 0.5], [0, 0.5]], [[0, 0.5], [1, 0.5], [1, 1], [0, 1]]]
      : [[[0, 0], [0.5, 0], [0.5, 1], [0, 1]], [[0.5, 0], [1, 0], [1, 1], [0.5, 1]]];
    for (const poly of halves) regions.push({ poly, height: h, down: alongX ? 'z' : 'x' });
  } else if (shape === 'roof_peak') {
    // The top of a hipped roof: four little slopes up to a point.
    const h = (x, z) => 0.5 - Math.max(Math.abs(x - 0.5), Math.abs(z - 0.5));
    heightAt = h;
    const c = [0.5, 0.5];
    for (const [p, q, down] of [[[0, 0], [1, 0], 'z'], [[1, 0], [1, 1], 'x'], [[1, 1], [0, 1], 'z'], [[0, 1], [0, 0], 'x']]) {
      regions.push({ poly: [p, q, c], height: h, down });
    }
  } else {
    const [lo, hi] = PITCH[shape] ?? PITCH.roof;
    const f = facing & 3, g = corner ? corner.second : (f + 1) & 3;
    const axisOf = (dir) => (dir & 1 ? 'x' : 'z');
    const pick = corner?.type === 'outer' ? Math.max : Math.min;
    const d = corner
      ? (x, z) => pick(from(f, x, z), from(g, x, z))
      : (x, z) => from(f, x, z);
    heightAt = (x, z) => lo + (hi - lo) * (1 - d(x, z));
    if (!corner) {
      regions.push({ poly: [[0, 0], [1, 0], [1, 1], [0, 1]], height: heightAt, down: axisOf(f) });
    } else {
      // Split along the diagonal through the corner both edges share: on one
      // side the height follows one edge, on the other the other.
      const at = (a, b) => cellPoint(f, g, a, b);
      const t1 = [at(0, 0), at(1, 0), at(1, 1)]; // a ≥ b
      const t2 = [at(0, 0), at(1, 1), at(0, 1)]; // b ≥ a
      const outer = corner.type === 'outer';
      regions.push({ poly: t1, height: heightAt, down: axisOf(outer ? f : g) });
      regions.push({ poly: t2, height: heightAt, down: axisOf(outer ? g : f) });
    }
  }

  const faces = [];
  for (const r of regions) {
    // The bed the tiles sit on, darker, showing in the gaps between them.
    faces.push({ pts: r.poly.map(([x, z]) => [x, r.height(x, z), z]), out: [0, 1, 0], tone: BED });
    for (const tile of tilesIn(r)) faces.push(...prism(tile, r.height));
  }
  faces.push(...sides(heightAt));
  faces.push({ pts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], out: [0, -1, 0], tone: 1 });
  return { boxes: [], faces };
}

/** The (x, z) in a cell `a` from the edge facing f climbs to and `b` from g's. */
function cellPoint(f, g, a, b) {
  const onZ = (dir, v) => (dir === 0 ? v : 1 - v);   // facing 0 climbs to z = 0
  const onX = (dir, v) => (dir === 3 ? v : 1 - v);   // facing 3 climbs to x = 0
  if (f % 2 === 0) return [onX(g, b), onZ(f, a)];
  return [onX(f, a), onZ(g, b)];
}

/** The tiles over one region: a grid of little rectangles, cut to its outline. */
function tilesIn(r) {
  const out = [];
  const across = r.down === 'z' ? 0 : 1; // which of (x, z) runs across the slope
  for (let i = 0; i < TILE_ROWS; i++) {
    for (let j = 0; j < TILE_COURSES; j++) {
      const c0 = i / TILE_ROWS + TILE_GAP / 2, c1 = (i + 1) / TILE_ROWS - TILE_GAP / 2;
      const s0 = j / TILE_COURSES + COURSE_GAP / 2, s1 = (j + 1) / TILE_COURSES - COURSE_GAP / 2;
      const rect = [[c0, s0], [c1, s0], [c1, s1], [c0, s1]].map(([c, s]) => (across === 0 ? [c, s] : [s, c]));
      const cut = clip(rect, r.poly);
      if (cut.length >= 3 && area(cut) > 1e-4) out.push(cut);
    }
  }
  return out;
}

/** A tile: its outline raised off the slope, with little walls round it. */
function prism(poly, height) {
  const faces = [{ pts: poly.map(([x, z]) => [x, height(x, z) + TILE_RISE, z]), out: [0, 1, 0], tone: 1 }];
  const [cx, cz] = centroid(poly);
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % poly.length];
    const mx = (x0 + x1) / 2 - cx, mz = (z0 + z1) / 2 - cz;
    faces.push({
      pts: [[x0, height(x0, z0), z0], [x1, height(x1, z1), z1], [x1, height(x1, z1) + TILE_RISE, z1], [x0, height(x0, z0) + TILE_RISE, z0]],
      out: [mx, 0, mz], tone: 1,
    });
  }
  return faces;
}

/** The four walls down a piece's sides, each as tall as the roof along it. */
function sides(heightAt) {
  const faces = [];
  const edges = [[[0, 0], [1, 0], [0, -1]], [[1, 0], [1, 1], [1, 0]], [[1, 1], [0, 1], [0, 1]], [[0, 1], [0, 0], [-1, 0]]];
  for (const [[x0, z0], [x1, z1], [ox, oz]] of edges) {
    const xm = (x0 + x1) / 2, zm = (z0 + z1) / 2;
    const h0 = heightAt(x0, z0), h1 = heightAt(x1, z1), hm = heightAt(xm, zm);
    if (h0 < 1e-6 && h1 < 1e-6 && hm < 1e-6) continue;
    // A corner that comes down to nothing is the bottom corner already.
    const pts = [[x0, 0, z0], [x1, 0, z1]];
    if (h1 > 1e-6) pts.push([x1, h1, z1]);
    if (Math.abs(hm - (h0 + h1) / 2) > 1e-6) pts.push([xm, hm, zm]);
    if (h0 > 1e-6) pts.push([x0, h0, z0]);
    if (pts.length >= 3) faces.push({ pts, out: [ox, 0, oz], tone: 1 });
  }
  return faces;
}

// ---- small geometry -------------------------------------------------------------

/** A convex polygon cut to another convex polygon (Sutherland–Hodgman). */
function clip(subject, by) {
  let out = subject;
  const sign = area(by) >= 0 ? 1 : -1;
  for (let i = 0; i < by.length && out.length; i++) {
    const [ax, az] = by[i], [bx, bz] = by[(i + 1) % by.length];
    const inside = ([x, z]) => sign * ((bx - ax) * (z - az) - (bz - az) * (x - ax)) >= -1e-9;
    const next = [];
    for (let j = 0; j < out.length; j++) {
      const p = out[j], q = out[(j + 1) % out.length];
      const pin = inside(p), qin = inside(q);
      if (pin) next.push(p);
      if (pin !== qin) {
        const dx = q[0] - p[0], dz = q[1] - p[1];
        const den = (bx - ax) * dz - (bz - az) * dx;
        const t = den === 0 ? 0 : ((bz - az) * (p[0] - ax) - (bx - ax) * (p[1] - az)) / den;
        next.push([p[0] + dx * t, p[1] + dz * t]);
      }
    }
    out = next;
  }
  return out;
}

function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % poly.length];
    s += x0 * z1 - x1 * z0;
  }
  return s / 2;
}

function centroid(poly) {
  let x = 0, z = 0;
  for (const p of poly) { x += p[0]; z += p[1]; }
  return [x / poly.length, z / poly.length];
}

/**
 * A face's points in the order that faces `out` — counter-clockwise seen
 * from outside — with its normal. Newell's method, so a polygon of any
 * number of points gets the right one.
 */
export function orient(pts, out) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[(i + 1) % pts.length];
    nx += (y0 - y1) * (z0 + z1);
    ny += (z0 - z1) * (x0 + x1);
    nz += (x0 - x1) * (y0 + y1);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len; ny /= len; nz /= len;
  if (nx * out[0] + ny * out[1] + nz * out[2] < 0) return { pts: [...pts].reverse(), n: [-nx, -ny, -nz] };
  return { pts, n: [nx, ny, nz] };
}
