import { CHEST } from '../config/blocks.js';

/**
 * The god's cube (backlog batch 4, C): the main story's end. Asked for
 * directly: "No matter which one you'd choose, you need to fight the other
 * one ... after all the big wars, the user can come back to the sanctuary
 * and travel to a new dimension. This dimension is basically an unbreakable
 * cube of blocks with 100 blocks width. Inside there's the other god, and
 * lots of creatures that help him fight you. You need to kill it to leave
 * his cube basically. Or stole his stash which consists in thousands of
 * coins and a wand."
 *
 * The cube hangs far out over the world, high up, out of reach of
 * everything else: a hundred across, walls, floor and ceiling of Godstone
 * that nothing breaks. You come in at the south wall by the way out; the
 * god waits at the far end before his altar, and on the altar his stash.
 * The way out only lets you go once he's beaten — or his stash is yours.
 *
 * Pure: the blocks, where everyone stands, and where it can hang. Game
 * stamps it, peoples it and takes you there.
 */

export const GODSTONE = 252, WAY_OUT = 253;
/** A hundred across, and as tall as the world leaves room for. */
export const CUBE_SIZE = 100, CUBE_TALL = 40;
/** Where its floor is: above the highest of the world's peaks. */
export const CUBE_FLOOR = 150;
/** How far from home it hangs. */
const CUBE_AWAY = 30000;

const MARBLE = 17, SKY_MARBLE = 158, GOLD_TRIM = 159, DARK_STONE = 156, DARK_BRICK = 157, OBSIDIAN = 14,
      MARBLE_PILLAR = 166, DARK_PILLAR = 167, LANTERN = 26, FIREFLY_LANTERN = 190, GOLD = 13;

/**
 * Where the cube hangs for a world: out past everything, over ground that
 * stays under its floor. Tries a few spots east and west of home.
 */
export function cubeSite(gen, home) {
  for (let i = 0; i < 12; i++) {
    const x = Math.round(home.x + (i % 2 ? -1 : 1) * (CUBE_AWAY + Math.floor(i / 2) * 1500));
    const z = Math.round(home.z);
    let top = 0;
    for (let dx = 0; dx <= CUBE_SIZE; dx += 10) for (let dz = 0; dz <= CUBE_SIZE; dz += 10) top = Math.max(top, gen.heightAt(x + dx, z + dz));
    if (top < CUBE_FLOOR - 4) return { x, y: CUBE_FLOOR, z };
  }
  return { x: Math.round(home.x + CUBE_AWAY), y: CUBE_FLOOR, z: Math.round(home.z) };
}

/**
 * The cube, as [dx, dy, dz, id] from its corner (0 is the floor), dressed
 * for the god inside it: `god` 'dark' (obsidian, dark stone, nightstone
 * pillars) or 'white' (marble, sky marble, gold).
 *
 * Also: where you come in (`entry`), the way out (`exit`), where the god
 * stands (`throne`), the stash's chest (`stash`), and the spots his
 * creatures come from (`spawns`) — all from the corner too.
 */
export function cubeDesign(god = 'dark') {
  const S = CUBE_SIZE, T = CUBE_TALL;
  const dark = god === 'dark';
  const floor = dark ? [DARK_STONE, OBSIDIAN] : [MARBLE, SKY_MARBLE];
  const pillar = dark ? DARK_PILLAR : MARBLE_PILLAR;
  const trim = dark ? DARK_BRICK : GOLD_TRIM;
  const light = dark ? FIREFLY_LANTERN : LANTERN;
  const blocks = [];
  const put = (x, y, z, id) => blocks.push([x, y, z, id]);

  // The shell: Godstone all round, the floor laid in the god's own stone
  // on top of it (that's what you walk on; the Godstone holds it up).
  for (let x = 0; x < S; x++) {
    for (let z = 0; z < S; z++) {
      const edge = x === 0 || z === 0 || x === S - 1 || z === S - 1;
      put(x, -1, z, GODSTONE);
      put(x, T, z, GODSTONE);
      put(x, 0, z, edge ? GODSTONE : floor[(x >> 2) + (z >> 2) & 1]);
      if (edge) for (let y = 1; y < T; y++) put(x, y, z, GODSTONE);
    }
  }
  // Two rows of pillars down the hall, banded, a light on each.
  for (let z = 14; z < S - 10; z += 12) {
    for (const x of [26, S - 27]) {
      for (let y = 1; y < T; y++) put(x, y, z, y % 8 === 0 ? trim : pillar);
      put(x + 1, 6, z, light);
      put(x - 1, 6, z, light);
    }
  }
  // The altar at the far (north) end: a stepped dais, and on it the stash.
  const ax = Math.floor(S / 2), az = 8;
  for (let step = 0; step < 3; step++) {
    for (let x = ax - 6 + step; x <= ax + 6 - step; x++) for (let z = az - 4 + step; z <= az + 4 - step; z++) put(x, 1 + step, z, step === 2 ? trim : floor[0]);
  }
  put(ax, 4, az, CHEST + 2);
  for (const dx of [-3, 3]) { put(ax + dx, 4, az, GOLD); put(ax + dx, 5, az, light); }
  // The way out, set in the south wall where you come in, lit.
  const exit = { x: ax, y: 1, z: S - 1 };
  for (let y = 1; y <= 3; y++) for (const dx of [-1, 0, 1]) put(ax + dx, y, S - 1, WAY_OUT);
  return {
    blocks,
    entry: { x: ax + 0.5, y: 1, z: S - 4.5 },
    exit,
    throne: { x: ax + 0.5, y: 1, z: az + 8.5 },
    stash: { x: ax, y: 4, z: az },
    spawns: [[20, 30], [S - 20, 30], [20, 60], [S - 20, 60], [ax, 40]].map(([x, z]) => ({ x: x + 0.5, y: 1, z: z + 0.5 })),
  };
}
