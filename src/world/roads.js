import { hash01 } from './ChunkGen.js';
import { BIOMES } from '../config/biomes.js';
import { landmarksFor } from './landmarks.js';

/**
 * Old roads across the country (playtest, P9). Asked for directly: "have
 * old roads generating in terrain connected to the structures that we
 * already added."
 *
 * Every landmark — the hermit's hut, the camps, the ruins, temples, mines
 * and monuments — and the place you start are joined by the shortest
 * network that reaches them all (a minimum spanning tree), so there's a road
 * to everything and never two to the same place. Each road wanders a little
 * as it goes, three wide: a crown of calçada down the middle, cobble either
 * side, worn to gravel and grass in places, and planked over where it
 * crosses water. It lies on the land, rising and falling with it; a road
 * that would have to climb the mountains is never laid at all.
 *
 * Worked out from the seed once per generator, like the landmarks, so every
 * chunk agrees on where the road runs through it.
 */

/** Country no road is laid through. */
const NO_ROADS = new Set(['mountains1', 'mountains2', 'ocean']);
/** More than this share of a road in that country, and it isn't built. */
const TOO_ROUGH = 0.25;
/** A road stops this far short of the middle of your land — that's yours to pave. */
export const HOME_CLEAR = 44;

/**
 * Every road cell in this world: a Map of "x,z" to 'crown' (the middle of
 * the road) or 'verge' (either side of it).
 */
export function roadsFor(gen) {
  if (gen.roadCache) return gen.roadCache;
  const cells = new Map();
  gen.roadCache = cells;

  const home = { kind: 'home', x: gen.biomes?.centreX ?? 0, z: gen.biomes?.centreZ ?? 0, half: HOME_CLEAR - 2 };
  const nodes = [home, ...landmarksFor(gen)];
  for (const [a, b] of spanningTree(nodes)) lay(gen, cells, a, b);
  return cells;
}

/** The road at (x, z): 'crown', 'verge' or null. */
export function roadAt(gen, x, z) {
  return roadsFor(gen).get(`${x},${z}`) ?? null;
}

/** Prim's: the shortest set of roads that reaches every place. */
function spanningTree(nodes) {
  const inTree = [nodes[0]];
  const rest = nodes.slice(1);
  const edges = [];
  while (rest.length) {
    let best = null;
    for (const a of inTree) {
      for (const b of rest) {
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    edges.push([best.a, best.b]);
    inTree.push(best.b);
    rest.splice(rest.indexOf(best.b), 1);
  }
  return edges;
}

/**
 * One road from a to b, written into `cells` — from just outside one's
 * edge to just outside the other's, wandering either side of the straight
 * line by a few blocks.
 */
function lay(gen, cells, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  const ux = dx / length, uz = dz / length;   // along
  const px = -uz, pz = ux;                    // across
  const start = a.half + 3, end = length - b.half - 3;
  if (end - start < 8) return;
  const salt = Math.floor(hash01(a.x + b.x, a.z + b.z, gen.seed ^ 0x70ad) * 1000);
  const amp = 3 + hash01(salt, 1, 0x70ae) * 5, waves = 1 + Math.floor(hash01(salt, 2, 0x70af) * 3);
  // Fades the wander out at both ends, so the road meets each place square on.
  const offset = (t) => Math.sin(((t - start) / (end - start)) * Math.PI * waves) * amp * Math.sin(((t - start) / (end - start)) * Math.PI);

  const path = [];
  let rough = 0;
  for (let t = start; t <= end; t += 1) {
    const o = offset(t);
    const cx = a.x + ux * t + px * o, cz = a.z + uz * t + pz * o;
    path.push([cx, cz]);
    if (NO_ROADS.has(BIOMES[gen.biomeIndexAt(Math.round(cx), Math.round(cz))]?.id) && !gen.waterLevelAt(Math.round(cx), Math.round(cz))) rough++;
  }
  if (rough / path.length > TOO_ROUGH) return;
  for (const [cx, cz] of path) {
    for (let w = -1; w <= 1; w++) {
      const x = Math.round(cx + px * w), z = Math.round(cz + pz * w);
      const key = `${x},${z}`;
      if (w === 0 || !cells.has(key)) cells.set(key, w === 0 ? 'crown' : 'verge');
    }
  }
}

/**
 * What a road cell is laid with, worn as an old road is: mostly stone,
 * some of it gone to gravel, and here and there nothing left but grass
 * (null). Pure in (x, z).
 */
export function roadBlock(kind, x, z, seed, { calcada, cobble, gravel }) {
  const r = hash01(x * 3 + 1, z * 5 + 2, seed ^ 0x70b1);
  if (kind === 'crown') return r < 0.1 ? null : r < 0.2 ? gravel : r < 0.4 ? cobble : calcada;
  return r < 0.18 ? null : r < 0.4 ? gravel : cobble;
}
