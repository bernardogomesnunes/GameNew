import { STARTER_DESIGNS } from '../config/starterDesigns.js';
import { MOBS } from '../config/mobs.js';
import { WANDERERS } from '../config/wanderers.js';
import { BIOMES } from '../config/biomes.js';
import { isFluid } from '../config/blocks.js';
import { landmarkDesigns, landmarksFor, PLACE_NAMES } from './landmarks.js';
import { kingdomFor, CITY_HALF } from './kingdom.js';
import { skyFor, FLOOR, ISLAND_R } from './skyKingdom.js';

/**
 * The showcase: a Creative world laid out for looking at
 * (docs/plan-look-and-sound.md, section 1).
 *
 * The look-and-sound revamp changes colour, texture, light and models across
 * the whole game, and a change like that can't be judged on one wall: a
 * palette that makes the castle sing can turn the starter cabin to mud. So
 * this is one place with all of it in — every building the game can put up,
 * in labelled rows on flat grass; one of every animal and every kind of
 * person, standing still and facing you; and the Stone Kingdom and the Sky
 * city a jump away — with fixed camera spots, so a picture taken before a
 * change and one taken after are of exactly the same thing.
 *
 * The world comes from one fixed seed, so it is the same land every time,
 * and it is never saved. tools/showcase-shots.mjs walks every spot by day,
 * at dusk and at night and writes the pictures out.
 *
 * Everything here is plain data and arithmetic — no THREE, no Game. Game
 * builds it (openShowcase), ShowcaseView labels it.
 *
 * Coordinates in the layout are relative to the site: x east, z south, y
 * up from the first open cell above the flattened grass. Every building's
 * front (its door: see starterDesigns' `door`, hung on the -z side) faces
 * north, towards -z, which is where its camera stands.
 */

/** The world the showcase is always built in. Changing it changes every picture. */
export const SHOWCASE_SEED = 424242;

/**
 * Times of day for the pictures — see render/DayCycle.js: 0 midnight, 0.25
 * sunrise, 0.5 noon, 0.75 sunset. Mid-morning, so the sun is up in the east
 * and the walls facing it are lit while the rest are in shade; just before
 * the sun touches the horizon, for the warm light; and deep night.
 */
export const SHOWCASE_TIMES = { day: 0.36, dusk: 0.745, night: 0.95 };

// What the pictures are taken at: a phone held upright (390 × 780) and the
// default field of view (config/controls.js), so each spot can frame its
// subject without a trial and error per building.
const FOV = 75;
const ASPECT = 390 / 780;
const TAN_V = Math.tan((FOV * Math.PI) / 360);
const TAN_H = TAN_V * ASPECT;

/** Open ground between buildings in a row. */
const GAP = 7;
/** A row is full past this width, and the next one starts behind it. */
const ROW_WIDTH = 84;
/** Clear ground between a row's back and the cameras of the row after it. */
const ROW_CLEAR = 4;
/**
 * The buildings are seen three-quarters on from the front, this far round
 * towards the east: the side the morning sun lights, and enough of the roof
 * and the depth to read the shape.
 */
const THREE_QUARTER = 0.5;
/** The figures stand in their own yard west of the rows, from here westwards, this far apart. */
const YARD_EAST = -22;
const YARD_GAP = 9;
/** How far past everything the grass is flattened, and how far it eases back into the land after that. */
const MARGIN = 10;
export const BLEND = 14;
/** How high above the new grass a column is cleared of hills and trees. */
const CLEAR_UP = 48;

const AIR = 0, GRASS = 1, DIRT = 2;
const FORESTS = new Set(['forestOak', 'forestBirch', 'forestDark', 'giantGrove']);
const NOT_HERE = new Set(['ocean', 'mountains1', 'mountains2']);
/** Places with people living at them. */
const PEOPLED = new Set(['hermit', 'camp']);
/** How far round home to look for the showcase's site, and how finely. */
const SEARCH = 640, SEARCH_STEP = 64;

// ---- what goes in it ------------------------------------------------------------------

/**
 * Every design that can be put up: the starter designs (one per building
 * type — config/starterDesigns.js), then one of each place somebody else
 * built (the hermit's hut, a bandit camp, the ruins, temples, mines and
 * monuments of world/landmarks.js). Blocks as [dx, dy, dz, id].
 */
function allDesigns() {
  const plainName = (s) => s.replace(/^(an?|the) /i, '').replace(/^./, (c) => c.toUpperCase());
  return [
    ...STARTER_DESIGNS.map((d) => ({
      id: d.id, name: d.name, structure: d.structure, blocks: d.blocks.map((b) => [b.dx, b.dy, b.dz, b.type]),
    })),
    ...landmarkDesigns().map((p) => ({
      id: `place_${p.kind}`, name: plainName(PLACE_NAMES[p.kind] ?? p.kind), place: p.kind, blocks: p.blocks,
    })),
  ];
}

/** A design's own box, from the blocks it actually has. */
function boundsOf(blocks) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of blocks) {
    if (!b[3]) continue; // air a place digs out isn't part of what you see
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], b[i]); hi[i] = Math.max(hi[i], b[i]); }
  }
  return { minX: lo[0], maxX: hi[0], minY: lo[1], maxY: hi[1], minZ: lo[2], maxZ: hi[2] };
}

/**
 * Where a camera stands to frame a box w wide, d deep and h tall whose
 * middle is at (cx, cz): three-quarters on from the north-east, far enough
 * back for the whole thing to fit the upright picture, a little above it
 * looking down.
 */
function framing(cx, cz, w, d, h) {
  const across = w * Math.cos(THREE_QUARTER) + d * Math.sin(THREE_QUARTER);
  const fit = Math.max((across / 2 + 1.5) / TAN_H, (h / 2 + 2) / TAN_V, 9);
  const r = fit + d / 2;
  const lookY = h * 0.4;
  return {
    eye: [cx + Math.sin(THREE_QUARTER) * r, lookY + 2 + r * 0.22, cz - Math.cos(THREE_QUARTER) * r],
    look: [cx, lookY, cz],
  };
}

/**
 * The buildings, packed into rows: each placed so its own corner lands
 * where the row has got to, fronts all on the row's front line. Rows go
 * back southwards, each far enough behind the last that its cameras stand
 * clear of the row in front.
 */
function layBuildings() {
  const out = [];
  const rows = [];
  let row = null;
  for (const d of allDesigns()) {
    const b = boundsOf(d.blocks);
    const w = b.maxX - b.minX + 1, dep = b.maxZ - b.minZ + 1, h = Math.max(1, b.maxY + 1);
    if (!row || (row.items.length && row.width + GAP + w > ROW_WIDTH)) {
      row = { items: [], width: 0 };
      rows.push(row);
    }
    if (row.items.length) row.width += GAP;
    row.items.push({ ...d, bounds: b, w, d: dep, h, x0: row.width });
    row.width += w;
  }
  let front = 0;
  rows.forEach((r, i) => {
    // Push this row back until every one of its cameras stands behind the last row.
    const reach = Math.max(...r.items.map((it) => -framing(0, it.d / 2, it.w, it.d, it.h).eye[2]));
    if (i > 0) front = Math.ceil(Math.max(front, rows[i - 1].back + ROW_CLEAR + reach));
    r.front = front;
    r.back = front + Math.max(...r.items.map((it) => it.d));
    r.n = i + 1;
    for (const it of r.items) {
      const anchor = { x: it.x0 - it.bounds.minX, y: 0, z: front - it.bounds.minZ };
      const cx = it.x0 + it.w / 2, cz = front + it.d / 2;
      out.push({
        id: it.id, name: it.name, structure: it.structure, place: it.place, row: i + 1,
        blocks: it.blocks, anchor, w: it.w, d: it.d, h: it.h, centre: { x: cx, z: cz },
        ...framing(cx, cz, it.w, it.d, it.h),
      });
    }
  });
  return { buildings: out, rows };
}

/**
 * The figures, in small groups along the yard: few enough to a group that
 * each is big enough in the picture to judge a face, a coat or a snout.
 *
 * `kind` says which part of the game each is drawn by — the same views the
 * game itself uses for them (see Game.openShowcase):
 *   mob       an animal (config/mobs.js)
 *   wanderer  anyone in config/wanderers.js; `rider` sits on its back
 *   settler   one of your settlers, coat `n`
 *   defender  your soldier or your archer (world/Defenders.js)
 *   warrior   your army, on the dark path (world/Army.js)
 *   guardian  the white stag or the black beast (world/Guardian.js)
 */
function figureGroups() {
  const groups = [];
  // The animals, the farm ones first, four to a picture.
  const animals = [...MOBS].sort((a, b) => (b.farm ? 1 : 0) - (a.farm ? 1 : 0));
  for (let i = 0; i < animals.length; i += 4) {
    const slice = animals.slice(i, i + 4);
    groups.push({
      id: `animals-${groups.length + 1}`, name: slice.map((m) => m.name).join(', '),
      figures: slice.map((m) => ({ kind: 'mob', type: m.id, label: m.name, width: Math.max(m.body.l, m.body.w) + 0.6, tall: m.leg + m.body.h + m.head * 0.5 })),
    });
  }
  const person = (kind, type, label, extra = {}) => ({ kind, type, label, width: 1.35, tall: 1.9, ...extra });
  const w = (type, label, extra) => person('wanderer', type, label, extra);
  groups.push(
    { id: 'people-settlers', name: 'Your settlers', figures: [0, 1, 2, 3].map((n) => person('settler', 'settler', 'Settler', { n })) },
    { id: 'people-yours', name: 'Your soldiers and army', figures: [person('defender', 'soldier', 'Your soldier'), person('defender', 'archer', 'Your archer'), person('warrior', 'warrior', 'Your warrior')] },
    { id: 'people-wild', name: 'Out in the world', figures: [w('hermit', 'Hermit'), w('bandit', 'Bandit'), w('explorer', 'Explorer'), w('messenger', 'Messenger')] },
    { id: 'people-stone', name: 'The Stone Kingdom', figures: [w('guard', 'Stone guard'), w('king', 'Stone King'), w('soldier', 'Stone soldier'), w('archer', 'Stone archer')] },
    { id: 'people-war', name: 'The Stone army', figures: [w('warbeast', 'The Warlord', { rider: 'warlord', width: 3.6, tall: 3.4 }), w('ram', 'Battering ram', { width: 4.2, tall: 2.4 }), w('siege_catapult', 'Siege catapult', { width: 4.2, tall: 2.8 })] },
    { id: 'people-sky', name: 'The Sky Kingdom', figures: [w('sky_guard', 'Sky guard'), w('royal_guard', 'Royal guard'), w('sky_king', 'Sky King')] },
    { id: 'guardians', name: 'The guardians', figures: [person('guardian', 'white', 'Aurelion', { width: 3.2, tall: 2.9 }), person('guardian', 'black', 'Umbra', { width: 3.2, tall: 1.9 })] },
  );
  // Anyone in config/wanderers.js not placed above still gets a place: a
  // new kind of person shows up in the showcase without anyone remembering to.
  const placed = new Set(groups.flatMap((g) => g.figures.flatMap((f) => (f.kind === 'wanderer' ? [f.type, f.rider] : []))));
  const rest = Object.keys(WANDERERS).filter((k) => !placed.has(k));
  for (let i = 0; i < rest.length; i += 4) {
    groups.push({ id: `people-more-${i / 4 + 1}`, name: 'Others', figures: rest.slice(i, i + 4).map((k) => w(k, k.replace(/_/g, ' '), WANDERERS[k].siege || WANDERERS[k].beast ? { width: 4.2, tall: 2.6 } : {})) });
  }
  return groups;
}

/**
 * The groups set out side by side along the yard, going west, each in a
 * line facing north with its camera in front of it, everyone turned to
 * face that camera. Side by side rather than one behind another, so no
 * picture has the next group standing in the back of it. The animals turn
 * a little further round — a cow seen dead on is a face and two horns;
 * three-quarters on, it's a cow.
 */
function layFigures(z) {
  const out = [];
  let east = YARD_EAST;
  for (const g of figureGroups()) {
    const width = g.figures.reduce((s, f) => s + f.width, 0);
    const tall = Math.max(...g.figures.map((f) => f.tall));
    const fit = Math.max((width / 2 + 0.6) / TAN_H, (tall / 2 + 1) / TAN_V, 4);
    const cx = east - width / 2;
    east -= width + YARD_GAP;
    const lookY = tall * 0.42;
    const eye = [cx + fit * 0.2, lookY + 0.6 + fit * 0.14, z - fit];
    let x = cx - width / 2;
    const figures = g.figures.map((f) => {
      const fx = x + f.width / 2;
      x += f.width;
      const fourLegs = f.kind === 'mob' || f.kind === 'guardian' || WANDERERS[f.type]?.beast;
      const facing = Math.atan2(eye[0] - fx, eye[2] - z) + (fourLegs ? 0.7 : 0);
      return { ...f, x: fx, z, facing };
    });
    out.push({ id: g.id, name: g.name, figures, eye, look: [cx, lookY, z] });
  }
  return out;
}

const LAID = layBuildings();
/** Every building in the showcase, laid out: id, name, blocks, anchor, size, camera. */
export const SHOWCASE_BUILDINGS = LAID.buildings;
/** The figure groups, laid out: each { id, name, figures: [{ kind, type, x, z, facing, label }], eye, look }. */
export const SHOWCASE_FIGURES = layFigures(LAID.rows[0].front + 4);

/** The flattened ground, relative to the site: the box round everything, plus a margin. */
export const SHOWCASE_BOUNDS = (() => {
  const xs = [], zs = [];
  for (const b of SHOWCASE_BUILDINGS) {
    xs.push(b.centre.x - b.w / 2, b.centre.x + b.w / 2, b.eye[0]);
    zs.push(b.centre.z - b.d / 2, b.centre.z + b.d / 2, b.eye[2]);
  }
  for (const g of SHOWCASE_FIGURES) {
    xs.push(g.eye[0]); zs.push(g.eye[2]);
    for (const f of g.figures) { xs.push(f.x - f.width, f.x + f.width); zs.push(f.z + 3); }
  }
  return {
    minX: Math.floor(Math.min(...xs)) - MARGIN, maxX: Math.ceil(Math.max(...xs)) + MARGIN,
    minZ: Math.floor(Math.min(...zs)) - MARGIN, maxZ: Math.ceil(Math.max(...zs)) + MARGIN,
  };
})();

// ---- the camera spots -----------------------------------------------------------------

const at = (site, [x, y, z]) => ({ x: site.x + x, y: site.y + y, z: site.z + z });

/**
 * The fixed places a picture is taken from, by id. Each resolves, for a
 * given showcase (`{ site, gen }`), to an eye and a point it looks at;
 * Game.showcaseSpot stands you there.
 *
 *   group  'main'       the set worth taking every time: an overview, each
 *                       row, each group of figures, the two kingdoms and a
 *                       forest
 *          'buildings'  one close picture per building, for when the
 *                       buildings themselves are what changed
 *   where  what it's relative to: the showcase, the Stone Kingdom, the Sky
 *          city, or the nearest forest
 */
export const SHOWCASE_SPOTS = [
  {
    id: 'overview', name: 'Over the whole showcase', group: 'main', where: 'showcase',
    resolve: ({ site }) => {
      const b = SHOWCASE_BOUNDS, mx = (b.minX + b.maxX) / 2;
      return { eye: at(site, [mx, 90, b.minZ - 40]), look: at(site, [mx, 0, (b.minZ + b.maxZ) / 2]) };
    },
  },
  ...LAID.rows.map((r) => ({
    id: `row-${r.n}`, name: `Row ${r.n}: ${r.items.map((it) => it.name).join(', ')}`, group: 'main', where: 'showcase',
    // Down the row from its west end, in front: the whole row going away
    // from you, so a palette can be judged across all of it at once.
    resolve: ({ site }) => ({
      eye: at(site, [-14, 12, r.front - 12]),
      look: at(site, [Math.min(r.width, 60) * 0.5, 1, r.front + (r.back - r.front) / 2]),
    }),
  })),
  ...SHOWCASE_FIGURES.map((g) => ({
    id: g.id, name: g.name, group: 'main', where: 'showcase',
    resolve: ({ site }) => ({ eye: at(site, g.eye), look: at(site, g.look) }),
  })),
  // The Stone Kingdom (world/kingdom.js): its gate is on its south side
  // (+z), the keep at the north end of the main street.
  ...[
    ['kingdom-gate', 'The Stone Kingdom: the gate', [4, 22, CITY_HALF + 20], [0, 6, CITY_HALF - 4]],
    ['kingdom-street', 'The Stone Kingdom: up the main street', [2, 3.2, CITY_HALF - 8], [0, 6, -14]],
    ['kingdom-keep', 'The Stone Kingdom: the keep, over the roofs', [0, 22, 16], [0, 10, -24]],
    ['kingdom-air', 'The Stone Kingdom from the air', [60, 48, 82], [0, 4, 0]],
  ].map(([id, name, eye, look]) => ({
    id, name, group: 'main', where: 'kingdom', clearSight: true,
    resolve: ({ gen }) => {
      const k = kingdomFor(gen);
      if (!k) return null;
      const e = { x: k.x + eye[0] + 0.5, y: k.y + eye[1], z: k.z + eye[2] + 0.5 };
      // Outside the walls the land is its own height, not the city's floor.
      if (Math.max(Math.abs(eye[0]), Math.abs(eye[2])) > CITY_HALF) e.y = Math.max(e.y, gen.heightAt(Math.floor(e.x), Math.floor(e.z)) + 3);
      return { eye: e, look: { x: k.x + look[0] + 0.5, y: k.y + look[1], z: k.z + look[2] + 0.5 } };
    },
  })),
  // The Sky city (world/skyKingdom.js), from the side of it towards home —
  // the gate you'd come up to from the lift.
  ...[
    ['sky-gate', 'The Sky city: a gate, from the air', (s, l) => ({ eye: [l.ux * (l.wall + 34), FLOOR + 8, l.uz * (l.wall + 34)], look: [l.ux * l.wall, FLOOR + 6, l.uz * l.wall] })],
    ['sky-palace', 'The Sky city: the palace', (s, l) => ({ eye: [l.ux * 46 + l.uz * 6, FLOOR + 7, l.uz * 46 - l.ux * 6], look: [0, FLOOR + 9, 0] })],
    ['sky-below', 'The Sky city: the island from below', (s, l) => ({ eye: [l.ux * (ISLAND_R + 60), FLOOR - 34, l.uz * (ISLAND_R + 60)], look: [0, FLOOR - 16, 0] })],
    // Backlog batch 2: the hole in the ground it was torn out of, from its rim.
    ['sky-scar', 'The Sky city: the scar it left in the ground', (s, l, ground) => ({ eye: [l.ux * (ISLAND_R + 10), ground + 48, l.uz * (ISLAND_R + 10)], look: [0, ground - 16, 0] })],
  ].map(([id, name, pose]) => ({
    id, name, group: 'main', where: 'sky',
    resolve: ({ gen }) => {
      const s = skyFor(gen);
      const home = { x: gen.biomes?.centreX ?? 0, z: gen.biomes?.centreZ ?? 0 };
      const l = s.landings.reduce((best, c) => (Math.hypot(c.x - home.x, c.z - home.z) < Math.hypot(best.x - home.x, best.z - home.z) ? c : best));
      const p = pose(s, l, gen.heightAt(s.x, s.z));
      return { eye: { x: s.x + p.eye[0] + 0.5, y: p.eye[1], z: s.z + p.eye[2] + 0.5 }, look: { x: s.x + p.look[0] + 0.5, y: p.look[1], z: s.z + p.look[2] + 0.5 } };
    },
  })),
  {
    id: 'forest', name: 'The nearest forest', group: 'main', where: 'forest', clearSight: true,
    resolve: ({ site, gen }) => {
      const f = forestNear(gen, site);
      if (!f) return null;
      return {
        // From over the treetops at its edge, looking in across them.
        eye: { x: f.eye.x + 0.5, y: gen.heightAt(f.eye.x, f.eye.z) + 34, z: f.eye.z + 0.5 },
        look: { x: f.x + 0.5, y: gen.heightAt(f.x, f.z) + 6, z: f.z + 0.5 },
      };
    },
  },
  ...SHOWCASE_BUILDINGS.map((b) => ({
    id: `b-${b.id}`, name: b.name, group: 'buildings', where: 'showcase',
    resolve: ({ site }) => ({ eye: at(site, b.eye), look: at(site, b.look) }),
  })),
];

export const SHOWCASE_SPOTS_BY_ID = new Map(SHOWCASE_SPOTS.map((s) => [s.id, s]));

/**
 * Where to stand and which way to look for a spot: the eye, and the yaw and
 * pitch PlayerController reads (yaw 0 looks north, -z; pitch up is positive).
 * Null for a spot whose place this world hasn't got.
 */
export function spotPose(spot, ctx) {
  const r = spot?.resolve(ctx);
  if (!r) return null;
  if (spot.clearSight && ctx.world) r.eye = clearSight(ctx.world, r.eye, r.look);
  const dx = r.look.x - r.eye.x, dy = r.look.y - r.eye.y, dz = r.look.z - r.eye.z;
  return { eye: r.eye, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

/**
 * How a spot out in the wild keeps clear of trees: how high it may rise,
 * how much of the way to what it looks at it may step in, and how much of
 * the view must then be clear — or, failing that anywhere, how many blocks
 * in front of the eye at least.
 */
const RISE = 36, STEP_IN = 0.6, CLEAR_TO = 0.8, CLEAR_NEAR = 10;

/**
 * Out in the wild a spot can land in a tree, or behind one. The eye rises
 * and, only if it must, steps in towards what it's looking at, until
 * nothing solid stands between them — up to the last
 * stretch, where what it's looking at may well be a wall or a canopy. If
 * no place is clear all the way, the first one with open air in front of
 * it will do.
 */
export function clearSight(world, eye, look) {
  const solid = (p) => world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) !== AIR;
  for (const enough of [(d) => d * CLEAR_TO, () => CLEAR_NEAR]) {
    // Rising first, then stepping in: a picture over the trees beats one
    // squeezed between them.
    const d0 = Math.hypot(look.x - eye.x, look.y - eye.y, look.z - eye.z);
    for (let s = 0; s <= d0 * STEP_IN; s += 1) {
      for (let rise = 0; rise <= RISE; rise += 3) {
        const from0 = { x: eye.x, y: eye.y + rise, z: eye.z };
        const d = Math.hypot(look.x - from0.x, look.y - from0.y, look.z - from0.z);
        const u = { x: (look.x - from0.x) / d, y: (look.y - from0.y) / d, z: (look.z - from0.z) / d };
        const from = { x: from0.x + u.x * s, y: from0.y + u.y * s, z: from0.z + u.z * s };
        const reach = Math.min(enough(d - s), d - s);
        let clear = true;
        for (let t = 0; t <= reach && clear; t += 0.5) {
          if (solid({ x: from.x + u.x * t, y: from.y + u.y * t, z: from.z + u.z * t })) clear = false;
        }
        if (clear) return from;
      }
    }
  }
  return eye;
}

// ---- where it goes --------------------------------------------------------------------

/**
 * The flattest dry stretch of ordinary country near home big enough for
 * the whole showcase, clear of home's own plot and of every place out in
 * the world. Tried on a grid of places round home; scored by how much the
 * ground under it varies, and how much of it is water. Its floor is the middle of the heights
 * it sampled, so as little as possible is cut away or built up.
 *
 * Returns the site: { x, y, z } — the layout's origin in the world, y the
 * first open cell over the new grass — or null if nowhere would do.
 */
export function findShowcaseSite(gen) {
  const b = SHOWCASE_BOUNDS;
  const home = { x: gen.biomes?.centreX ?? 0, z: gen.biomes?.centreZ ?? 0 };
  const places = landmarksFor(gen).filter((l) => l.kind !== 'kingdom');
  let best = null;
  for (let i = -SEARCH; i <= SEARCH; i += SEARCH_STEP) {
    for (let j = -SEARCH; j <= SEARCH; j += SEARCH_STEP) {
      // The middle of the layout lands on the candidate point.
      const ox = home.x + i - Math.round((b.minX + b.maxX) / 2), oz = home.z + j - Math.round((b.minZ + b.maxZ) / 2);
      const box = { minX: ox + b.minX - BLEND, maxX: ox + b.maxX + BLEND, minZ: oz + b.minZ - BLEND, maxZ: oz + b.maxZ + BLEND };
      // Home's plot and anything somebody else built stay as they are.
      if (distToBox(home.x, home.z, box) < 40) continue;
      // The hut and the camps further still: their people come out to meet
      // you from VISIT (world/Wanderers.js) away, and would walk into the pictures.
      if (places.some((l) => distToBox(l.x, l.z, box) < l.half + (PEOPLED.has(l.kind) ? 140 : 12))) continue;
      const heights = [];
      let bad = 0;
      for (let x = box.minX; x <= box.maxX; x += 16) {
        for (let z = box.minZ; z <= box.maxZ; z += 16) {
          if (gen.waterLevelAt(x, z) || NOT_HERE.has(BIOMES[gen.biomeIndexAt(x, z)]?.id)) bad++;
          heights.push(gen.heightAt(x, z));
        }
      }
      heights.sort((p, q) => p - q);
      const tenth = Math.floor(heights.length / 10);
      // Rough ground and water both count against it (water is filled in,
      // but a river cut off at the edge is a poor background); being near
      // home only breaks ties.
      const score = heights[heights.length - 1 - tenth] - heights[tenth] + bad * 2 + Math.hypot(i, j) / 400;
      if (!best || score < best.score) best = { x: ox, z: oz, y: heights[heights.length >> 1], score };
    }
  }
  return best && { x: best.x, y: best.y, z: best.z, score: best.score };
}

function distToBox(x, z, box) {
  return Math.hypot(Math.max(box.minX - x, 0, x - box.maxX), Math.max(box.minZ - z, 0, z - box.maxZ));
}

/** The showcase's flattened rectangle, in world coordinates. */
export function showcaseRegion(site) {
  const b = SHOWCASE_BOUNDS;
  return { minX: site.x + b.minX, maxX: site.x + b.maxX, minZ: site.z + b.minZ, maxZ: site.z + b.maxZ };
}

/**
 * Lays the grass: every column over the showcase cut or filled to the
 * site's floor, grass on top, open sky above it; and round its edge, a
 * band where the ground eases back to the land's own height, so the
 * pictures have country behind them rather than a cliff. Goes through
 * world.setBlock, so the chunks it changes are marked as changed — which
 * also keeps them from being forgotten while you're off at the kingdoms.
 */
export function flattenShowcase(world, site) {
  const r = showcaseRegion(site);
  const gen = world.gen;
  for (let x = r.minX - BLEND; x <= r.maxX + BLEND; x++) {
    for (let z = r.minZ - BLEND; z <= r.maxZ + BLEND; z++) {
      const out = Math.max(r.minX - x, 0, x - r.maxX, r.minZ - z, 0, z - r.maxZ);
      const natural = gen ? gen.heightAt(x, z) : world.surfaceHeight(x, z);
      const top = out === 0 ? site.y : Math.round(site.y + (natural - site.y) * (out / BLEND));
      for (let y = top; y < Math.min(world.height, top + CLEAR_UP); y++) {
        if (world.getBlock(x, y, z) !== AIR) world.setBlock(x, y, z, AIR);
      }
      if (world.getBlock(x, top - 1, z) !== GRASS) world.setBlock(x, top - 1, z, GRASS);
      // Down to solid ground: a hollow or a river under it is filled in.
      for (let y = top - 2; y >= 0; y--) {
        const id = world.getBlock(x, y, z);
        if (id !== AIR && !isFluid(id)) break;
        world.setBlock(x, y, z, DIRT);
      }
      world.setSurfaceHeight(x, z, top);
    }
  }
}

/**
 * Every block of the places, in world coordinates, as [x, y, z, id] —
 * written the way stampLandmarks writes them (world/landmarks.js), on the
 * showcase's floor instead of a levelled patch of wild country. The
 * starter designs aren't in here: Game stamps those through the same
 * starterPlacement a player's tap goes through.
 */
export function placeBlocks(site) {
  const out = [];
  for (const b of SHOWCASE_BUILDINGS) {
    if (!b.place) continue;
    for (const [dx, dy, dz, id] of b.blocks) out.push([site.x + b.anchor.x + dx, site.y + dy, site.z + b.anchor.z + dz, id]);
  }
  return out;
}

/**
 * What the labels say and where they stand, in world coordinates: one in
 * front of every building, one at the feet of every figure.
 */
export function showcaseLabels(site) {
  const out = [];
  for (const b of SHOWCASE_BUILDINGS) {
    out.push({ text: b.name, x: site.x + b.centre.x, y: site.y + 0.45, z: site.z + b.centre.z - b.d / 2 - 1.6, size: 0.55 });
  }
  for (const g of SHOWCASE_FIGURES) {
    for (const f of g.figures) out.push({ text: f.label, x: site.x + f.x, y: site.y + 0.05, z: site.z + f.z - 1.5, size: 0.24 });
  }
  return out;
}

/**
 * A forest near the showcase, for a picture of a biome rather than a
 * building: the first column out in rings from the site that is forest
 * with forest all round it and no water, and a place to stand looking at
 * it from the showcase's side.
 */
export function forestNear(gen, site) {
  if (gen.showcaseForest !== undefined) return gen.showcaseForest;
  const isForest = (x, z) => FORESTS.has(BIOMES[gen.biomeIndexAt(x, z)]?.id) && !gen.waterLevelAt(x, z);
  const r0 = showcaseRegion(site);
  const mx = (r0.minX + r0.maxX) / 2, mz = (r0.minZ + r0.maxZ) / 2;
  gen.showcaseForest = null;
  for (let r = 60; r <= 900 && !gen.showcaseForest; r += 20) {
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      const x = Math.round(mx + Math.cos(a) * r), z = Math.round(mz + Math.sin(a) * r);
      if (distToBox(x, z, r0) < BLEND + 30) continue;
      if (![[0, 0], [10, 0], [-10, 0], [0, 10], [0, -10]].every(([i, j]) => isForest(x + i, z + j))) continue;
      const back = 50;
      gen.showcaseForest = { x, z, eye: { x: Math.round(x - Math.cos(a) * back), z: Math.round(z - Math.sin(a) * back) } };
      break;
    }
  }
  return gen.showcaseForest;
}

