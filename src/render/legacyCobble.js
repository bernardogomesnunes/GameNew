/**
 * The cobblestone as it first was — the 16×16 tile from before the 32px
 * textures, ported line for line from the old BlockTextures painter.
 *
 * Asked for twice: "Cobble was fine as it was ... the only one I think it got
 * worse", and then, of an imitation of it in the new painter, "not sure if you
 * can find the texture we had for cobble, because the new one looks awful".
 * So this is not a recipe tuned to look like it: it is the same stones, from
 * the same hashes and the same block id, thrown the same way. BlockTextures
 * doubles each pixel to fill a 32px layer and writes its levels straight
 * through, with none of the new painter's gamma or brightness levelling, so
 * the block shows exactly the tile it used to.
 *
 * Returns { level, tint, height } at 16×16: level is 0..1 (0.98 at its
 * lightest, as the old tiles were), tint a per-pixel colour multiplier,
 * height a 0..1 dome per stone for the shader's depth.
 */

const N = 16;
const TILE_BASE = 0.98;

function hash01(a, b, salt) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const LEGACY_COBBLE = { cobbles: 6, speck: 0.03, depth: 0.28, bump: 1 };

export function paintLegacyCobble(salt, recipe = LEGACY_COBBLE) {
  const n = N;
  const level = new Float32Array(n * n).fill(TILE_BASE);
  const darken = (x, y, amount) => {
    const i = ((y % n) + n) % n * n + (((x % n) + n) % n);
    level[i] = Math.min(level[i], TILE_BASE - amount);
  };
  const depth = recipe.depth;
  const tint = new Float32Array(n * n * 3).fill(1);
  const height = new Float32Array(n * n);

  // Cobbles: rounded stones of mixed sizes and shades bedded in dirt, big
  // ones first and small ones into the holes, wrapping round the edges.
  const wrap = (d) => (d > n / 2 ? d - n : d < -n / 2 ? d + n : d);
  const stones = [];
  let k = 0;
  for (const [tries, rlo, rhi] of [[recipe.cobbles * 40, 2.8, 4.4], [200, 1.6, 2.6], [200, 1, 1.5]]) {
    for (let t = 0; t < tries; t++, k++) {
      const st = {
        x: hash01(k, 107, salt) * n, y: hash01(k, 109, salt) * n,
        r: rlo + hash01(k, 113, salt) * (rhi - rlo),
        sx: 0.85 + hash01(k, 127, salt) * 0.3, sy: 0.85 + hash01(k, 131, salt) * 0.3,
      };
      const fits = stones.every((o) => Math.hypot(wrap(st.x - o.x), wrap(st.y - o.y)) >= st.r + o.r + 0.1);
      if (!fits) continue;
      const w = hash01(k, 101, salt);
      st.tone = 0.02 + hash01(k, 137, salt) * 0.1;
      st.tint = w < 0.1 ? [1, 0.93, 0.84] : w < 0.25 ? [0.95, 0.97, 1] : [1, 1, 1];
      stones.push(st);
    }
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let best = null, bestT = Infinity, bdy = 0;
      for (const st of stones) {
        const dx = wrap(x + 0.5 - st.x), dy = wrap(y + 0.5 - st.y);
        const t = Math.hypot(dx / st.sx, dy / st.sy) / st.r;
        if (t < bestT) { bestT = t; best = st; bdy = dy / st.sy / st.r; }
      }
      height[y * n + x] = bestT > 1 ? 0 : Math.sqrt(1 - bestT * bestT) * (0.55 + 0.45 * Math.min(1, best.r / 4));
      if (bestT > 1) {
        darken(x, y, depth * (0.8 + 0.2 * hash01(x, y, salt + 17)));
        tint.set([1, 0.95, 0.86], (y * n + x) * 3);
        continue;
      }
      let shade = best.tone;
      if (bestT > 0.5 && bdy > 0.25) shade = 0;                         // lit top
      else if (bestT > 0.5 && bdy < -0.2) shade += depth * 0.35;        // shadowed foot
      if (hash01(x, y, salt + 29) < 0.1) shade += depth * 0.15;
      darken(x, y, shade);
      tint.set(best.tint, (y * n + x) * 3);
    }
  }

  // A fine speckle over everything.
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = hash01(x, y, salt + 977);
      if (v < 0.5) darken(x, y, recipe.speck * (v * 2));
    }
  }

  for (let i = 0; i < n * n; i++) height[i] *= recipe.bump;
  return { level, tint, height, size: n };
}
