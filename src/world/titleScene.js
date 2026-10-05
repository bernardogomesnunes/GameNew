import { BIOMES } from '../config/biomes.js';
import { landmarkDesigns, landmarksFor } from './landmarks.js';

/**
 * The title scene: what's behind the worlds screen when the game opens.
 *
 * Asked for directly: "When a player opens the game it should show a
 * beautiful generated landscape, with animals roaming around and
 * messengers, maybe one mine and a bandit hut showing." It used to be
 * whatever the spawn happened to be — usually the inside of a tree, blurred
 * under the panel.
 *
 * So: one fixed seed, and in it a meadow with water and woods in view. An
 * old mine is laid on one side of it and a bandit camp on the other, the
 * way world/landmarks.js lays them out in the wild; herds graze, bandits
 * sit round their fire, and messengers cross on their way somewhere. The
 * camera circles it slowly, high enough to see it all. It is scenery, not
 * a save — the same seed builds it again every time.
 *
 * Plain data and arithmetic, like world/showcase.js: Game builds it
 * (openTitle) and moves the camera (tickTitle).
 */

/** The world the title is always built in. */
export const TITLE_SEED = 718281;

/**
 * Where findTitleSite lands for TITLE_SEED, written down: the search reads
 * a few thousand columns of the generator, a second or two on a phone, for
 * an answer that never changes. tests/titlescene.test.mjs keeps the two in
 * step.
 */
export const TITLE_SITE = { x: 258, z: 184 };

/** The hour it is held at: mid-morning, the sun up in the east (render/DayCycle.js). */
export const TITLE_TIME = 0.34;

/**
 * How the camera circles: how far out, how high above the meadow at least,
 * how far over the tallest ground or tree on its way round (see orbitHeight),
 * and how long a lap takes.
 */
export const ORBIT = { radius: 32, height: 16, clearance: 9, lapSeconds: 240 };

/** Where the places stand, from the meadow's middle (x east, z south). */
const PLACES = [
  { kind: 'mine', dx: 17, dz: -9 },
  { kind: 'camp', dx: -16, dz: 10 },
];

/** Animals put out to graze when it opens; more wander in after, as anywhere. */
export const TITLE_HERDS = [
  { type: 'sheep', n: 4, dx: 4, dz: 6 },
  { type: 'cow', n: 3, dx: -6, dz: -6 },
  { type: 'deer', n: 2, dx: 10, dz: 8 },
  { type: 'chicken', n: 3, dx: -3, dz: 2 },
  { type: 'pig', n: 2, dx: 6, dz: -3 },
];

const OPEN = new Set(['plains']);
const WOODS = new Set(['forestOak', 'forestBirch', 'forestDark', 'giantGrove']);
const SEARCH = 640, STEP = 16;

/**
 * The meadow: open ground near the middle of the map, flat enough across
 * the middle for the places to stand on, with water and woods both within
 * sight of it, and away from the wild's own hut and camps (whose people
 * would come out to meet the camera). Returns { x, y, z } or null.
 */
export function findTitleSite(gen, { groundAt = null } = {}) {
  const home = { x: gen.biomes?.centreX ?? 0, z: gen.biomes?.centreZ ?? 0 };
  const biome = (x, z) => BIOMES[gen.biomeIndexAt(x, z)]?.id;
  const others = landmarksFor(gen);
  let best = null;
  for (let i = -SEARCH; i <= SEARCH; i += STEP) {
    for (let j = -SEARCH; j <= SEARCH; j += STEP) {
      const x = home.x + i, z = home.z + j;
      if (!OPEN.has(biome(x, z)) || gen.waterLevelAt(x, z)) continue;
      if (others.some((l) => Math.hypot(l.x - x, l.z - z) < l.half + 120)) continue;
      // Flat across the middle, where the places go.
      const hs = [];
      let wet = 0;
      for (let a = -24; a <= 24; a += 8) {
        for (let b = -24; b <= 24; b += 8) {
          hs.push(gen.heightAt(x + a, z + b));
          if (gen.waterLevelAt(x + a, z + b)) wet++;
        }
      }
      if (wet > 4) continue;
      // Grass underfoot, not a beach or the edge of the desert — read off
      // the real blocks when there's a world to read them from (`groundAt`,
      // the id of a column's top block), since sand is laid by the
      // generator's fill, not its height.
      if (groundAt) {
        let grass = 0, n = 0;
        for (let a = -20; a <= 20; a += 5) for (let b = -20; b <= 20; b += 5) { n++; if (groundAt(x + a, z + b) === 1) grass++; }
        if (grass < n * 0.6) continue;
      }
      hs.sort((p, q) => p - q);
      const rough = hs[hs.length - 3] - hs[2];
      // Water and woods round about, for something to look at past it.
      let water = 0, woods = 0;
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * Math.PI * 2;
        for (const r of [30, 45, 60]) {
          const px = Math.round(x + Math.cos(ang) * r), pz = Math.round(z + Math.sin(ang) * r);
          if (gen.waterLevelAt(px, pz)) water++;
          if (WOODS.has(biome(px, pz))) woods++;
        }
      }
      const score = rough * 3 - Math.min(water, 6) * 2 - Math.min(woods, 12) + Math.hypot(i, j) / 200
        + (water ? 0 : 20) + (woods ? 0 : 20);
      if (!best || score < best.score) best = { x, z, y: hs[hs.length >> 1], score };
    }
  }
  return best && { x: best.x, y: best.y, z: best.z };
}

/**
 * The mine and the camp, as [x, y, z, id] in world coordinates, each on a
 * levelled patch the way stampLandmarks lays one: ground filled up to the
 * place's floor, the air above it cleared. `heightAt(x, z)` is the land's
 * own first empty cell.
 */
export function titlePlaceBlocks(site, heightAt) {
  const designs = new Map(landmarkDesigns().map((d) => [d.kind, d]));
  const out = [];
  const places = [];
  for (const p of PLACES) {
    const d = designs.get(p.kind);
    if (!d) continue;
    const cx = site.x + p.dx, cz = site.z + p.dz;
    // The floor: the land's middle height across the patch.
    const hs = [];
    for (let x = cx - d.half; x <= cx + d.half; x += 2) for (let z = cz - d.half; z <= cz + d.half; z += 2) hs.push(heightAt(x, z));
    hs.sort((a, b) => a - b);
    const y = hs[hs.length >> 1];
    for (let x = cx - d.half; x <= cx + d.half; x++) {
      for (let z = cz - d.half; z <= cz + d.half; z++) {
        const ground = heightAt(x, z);
        for (let gy = ground; gy < y; gy++) out.push([x, gy, z, gy === y - 1 ? 1 : 2]);
        for (let gy = y; gy < y + 14; gy++) out.push([x, gy, z, 0]);
        if (ground > y) out.push([x, y - 1, z, 1]);
      }
    }
    for (const [dx, dy, dz, id] of d.blocks) out.push([cx + dx, y + dy, cz + dz, id]);
    places.push({ kind: p.kind, x: cx, y, z: cz, half: d.half });
  }
  return { blocks: out, places };
}

/**
 * How high the camera flies: over the meadow by ORBIT.height, and over
 * anything standing on its circle — a hill, a tree — by ORBIT.clearance, so
 * it never passes through a canopy. `topAt(x, z)` is the highest solid
 * block in a column.
 */
export function orbitHeight(site, topAt) {
  let top = site.y + ORBIT.height;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    for (const r of [ORBIT.radius - 3, ORBIT.radius, ORBIT.radius + 3]) {
      top = Math.max(top, topAt(Math.round(site.x + Math.cos(a) * r), Math.round(site.z + Math.sin(a) * r)) + ORBIT.clearance);
    }
  }
  return top;
}

/**
 * Where the camera is `t` seconds in: on its circle round the meadow at
 * `eyeY` (see orbitHeight), looking in across it.
 */
export function orbitPose(site, t, eyeY = site.y + ORBIT.height) {
  const a = (t / ORBIT.lapSeconds) * Math.PI * 2;
  const eye = { x: site.x + Math.cos(a) * ORBIT.radius, y: eyeY, z: site.z + Math.sin(a) * ORBIT.radius };
  // Looking past the middle rather than down at it, so the far hills and
  // the sky are in the picture above the menu, not just the meadow.
  const look = { x: site.x - Math.cos(a) * 16, y: site.y, z: site.z - Math.sin(a) * 16 };
  const dx = look.x - eye.x, dy = look.y - eye.y, dz = look.z - eye.z;
  // The player's convention (PlayerController): yaw 0 looks along -z.
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return { eye, yaw, pitch };
}

/**
 * A messenger's walk across the view: in from one side of the circle, out
 * the far side, passing near the middle. `k` picks which way round.
 */
export function messengerPath(site, k) {
  const a = k * 2.3994;   // the golden angle, so no two come the same way
  const r = ORBIT.radius + 26;
  return {
    from: { x: site.x + Math.cos(a) * r, z: site.z + Math.sin(a) * r },
    to: { x: site.x - Math.cos(a + 0.4) * (r + 40), z: site.z - Math.sin(a + 0.4) * (r + 40) },
  };
}
