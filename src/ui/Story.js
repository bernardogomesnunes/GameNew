/**
 * The story, told in pictures (docs/plan-phase7-lore.md, 7j): a short
 * illustrated intro on a new world, and an illustrated ending for each path.
 *
 *   INTRO     the Sky Kingdom among its fireflies, the Stone army at its
 *             chains, the fall, and waking far from anywhere
 *   ENDINGS   white (the Ten Rounds held), dark (the Sky King struck down),
 *             yielded (the dark path by the chains)
 *
 * The pictures are painted here, in code, as pixel art — a small canvas
 * (ART_W × ART_H) scaled up blocky, so they read like the world they're
 * about. Each scene's art is a function of the context and the time, so
 * fireflies flicker and clouds rush past while you read. They only ever use
 * fillRect, fillStyle and globalAlpha.
 *
 * StoryView is the overlay that plays them: tap for the next, Skip to be
 * done. It's a panel like any other (an `.overlay` with an id), so Escape
 * closes it and the HUD steps aside while it's up.
 */

export const ART_W = 192;
export const ART_H = 144;

export const INTRO = [
  { art: 'sky', text: 'Above the clouds hangs the Sky Kingdom: white halls, gold roofs, and fireflies that light it all night long. Its people follow the white god, who has no name. You were born there.' },
  { art: 'army', text: 'Below it, the Stone Kingdom gathered. Its dark army came to the anchor towers and laid hands on the great chains that hold the island in the sky.' },
  { art: 'fall', text: 'In the fighting at the edge, you fell — through the fireflies, through the clouds, down and down.' },
  { art: 'arrival', text: 'You woke far from anywhere, with thirty-two blocks of land, an axe and a bucket. Build. Grow. And at your Temple\'s height, choose which god you\'ll follow.' },
];

export const ENDINGS = {
  white: [
    { art: 'walls', text: 'Ten times the Stone Kingdom came for you, and ten times it went home with nothing. The Warlord is beaten; the dark army is broken.' },
    { art: 'blessing', text: 'Your walls stand and your people sleep easy. Above your land at night the white god\'s fireflies drift — his blessing on the home you held.' },
    { art: 'dawn', text: 'You never went back to the sky. You built a kingdom of your own on the ground instead, and it is yours.' },
  ],
  dark: [
    { art: 'throne', text: 'The Sky King is fallen. In the white throne room you were born beneath, his crown lies on the steps.' },
    { art: 'dominion', text: 'The island you fell from hangs over land that answers to you now. Black banners fly from its halls; your warriors hold its chains.' },
    { art: 'lord', text: 'The Stone King has named you Lord of the Sky. The dark god has what he wanted — and so, for now, do you.' },
  ],
  yielded: [
    { art: 'sinking', text: 'One by one you cut its four great chains, and the Sky Kingdom began to sink — lower every day, its waterfalls running dry.' },
    { art: 'throne', text: 'Before it could fall, the Sky King came down from his throne and gave up the island. Not a blow was struck at him.' },
    { art: 'lord', text: 'The Stone King has named you Lord of the Sky. The dark god has what he wanted — and so, for now, do you.' },
  ],
};

// Which ending a world has earned lives with the lore book, which tells it too.
export { endingFor } from '../config/lore.js';

// ---- painting ----------------------------------------------------------------------------------

const rng = (seed) => {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
};
const lerp = (a, b, k) => a + (b - a) * k;
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a, b, k) => {
  const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b);
  const h = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(lerp(r1, r2, k))}${h(lerp(g1, g2, k))}${h(lerp(b1, b2, k))}`;
};

function rect(g, x, y, w, h, c, a = 1) {
  g.globalAlpha = a;
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  g.globalAlpha = 1;
}

/** A sky in bands, top colour to bottom, the way a low-res sky dithers. */
function sky(g, stops, band = 4) {
  for (let y = 0; y < ART_H; y += band) {
    const k = y / ART_H;
    let i = 0;
    while (i < stops.length - 2 && k > stops[i + 1][0]) i++;
    const [k0, c0] = stops[i], [k1, c1] = stops[i + 1];
    rect(g, 0, y, ART_W, band, mix(c0, c1, Math.max(0, Math.min(1, (k - k0) / (k1 - k0)))));
  }
}

function stars(g, t, n = 40, seed = 1, below = ART_H * 0.6) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * ART_W, y = r() * below, p = r() * 6.28;
    rect(g, x, y, 1, 1, '#ffffff', 0.35 + 0.35 * Math.sin(t * 1.5 + p));
  }
}

/** Fireflies round a point: a bright speck and a soft glow, each flickering on its own. */
function fireflies(g, t, cx, cy, rx, ry, n, seed = 7) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()), p = r() * 6.28, s = 0.3 + r() * 0.5;
    const x = cx + Math.cos(a + t * s * 0.15) * rx * d + Math.sin(t * s + p) * 2;
    const y = cy + Math.sin(a) * ry * d + Math.cos(t * s * 1.3 + p) * 1.5;
    const on = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2.2 * s + p));
    rect(g, x - 1, y - 1, 3, 3, '#fff3a0', 0.18 * on);
    rect(g, x, y, 1, 1, '#fff7c2', on);
  }
}

function cloud(g, x, y, w, c = '#ffffff', a = 0.9) {
  rect(g, x, y + 3, w, 4, c, a);
  rect(g, x + w * 0.15, y, w * 0.45, 3, c, a);
  rect(g, x + w * 0.5, y + 1, w * 0.3, 2, c, a);
  rect(g, x + 2, y + 7, w - 4, 1, mix(c, '#7a8a9a', 0.35), a);
}

/** A stepped roof: a pyramid of shrinking rows. */
function roof(g, x, y, w, c) {
  for (let i = 0; w - i * 2 > 0; i++) rect(g, x + i, y - i, w - i * 2, 1, c);
}

/**
 * The Sky Kingdom: a flat top of marble halls and gold roofs over a jagged
 * underside of rock, waterfalls off its edge. `s` scales it; `banners`
 * 'white' or 'black' flags its halls; `tilt` leans it as it sinks.
 */
function island(g, t, cx, cy, s = 1, { banners = 'white', falls = true, tilt = 0 } = {}) {
  const half = 46 * s, r = rng(11);
  // The underside: rows narrowing to a point, each a little ragged.
  const depth = Math.round(34 * s);
  for (let i = 0; i < depth; i++) {
    const k = i / depth, w = half * (1 - k * k * 0.95) + (r() - 0.5) * 4 * s;
    const col = i < 2 ? '#6e8f4a' : i < 4 ? '#7a6250' : mix('#6d625d', '#3a3438', k);
    rect(g, cx - w + tilt * i * 0.1, cy + i, w * 2, 1, col);
    rect(g, cx - w + tilt * i * 0.1, cy + i, 2, 1, '#2d282c', 0.6);
  }
  // Waterfalls off the edge, thinning as they go.
  if (falls) {
    for (const fx of [-0.78, 0.6]) {
      const x = cx + half * fx;
      for (let y = 0; y < 50 * s; y += 2) {
        const flick = (Math.floor(t * 8 + y) % 3 === 0) ? 0.9 : 0.6;
        rect(g, x, cy + 2 + y, Math.max(1, 2 * s), 2, '#cfe9ff', flick * (1 - y / (50 * s)));
      }
    }
  }
  // Grass and the halls on top.
  rect(g, cx - half, cy - 1, half * 2, 2, '#86b35a');
  const hall = (hx, w, h, gold = '#d9b24a') => {
    rect(g, cx + hx * s, cy - h * s, w * s, h * s, '#f2efe6');
    rect(g, cx + hx * s, cy - h * s, 1, h * s, '#c9c3b5');
    for (let wy = 2; wy < h - 1; wy += 3) for (let wx = 1; wx < w - 1; wx += 3) rect(g, cx + (hx + wx) * s, cy - (h - wy) * s, Math.max(1, s), Math.max(1, s), '#ffd36b', 0.8);
    roof(g, cx + hx * s - 1, cy - h * s - 1, w * s + 2, gold);
  };
  hall(-40, 12, 7); hall(-26, 10, 9); hall(16, 12, 8); hall(30, 10, 6);
  // The palace: a taller hall and a tower each side.
  hall(-12, 24, 14);
  rect(g, cx - 16 * s, cy - 24 * s, 4 * s, 24 * s, '#f6f3ea');
  rect(g, cx + 12 * s, cy - 24 * s, 4 * s, 24 * s, '#f6f3ea');
  roof(g, cx - 17 * s, cy - 25 * s, 6 * s, '#d9b24a');
  roof(g, cx + 11 * s, cy - 25 * s, 6 * s, '#d9b24a');
  // Its flags, white for the sky or black once it's yours.
  const flag = banners === 'black' ? '#1d1a20' : '#ffffff';
  for (const fx of [-14, 14]) {
    rect(g, cx + fx * s, cy - 32 * s, 1, 8 * s, '#8c7a5a');
    const wave = Math.sin(t * 3 + fx) > 0 ? 1 : 0;
    rect(g, cx + fx * s + 1, cy - 32 * s + wave, 5 * s, 3 * s, flag);
  }
}

/** A chain: links stepping from (x0, y0) to (x1, y1). */
function chain(g, x0, y0, x1, y1, c = '#8f8a84') {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2);
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    rect(g, lerp(x0, x1, k), lerp(y0, y1, k), i % 2 ? 1 : 2, 1, c);
  }
}

/** A person, about eight pixels tall: helm or head, body, legs, and maybe a spear. */
function person(g, x, y, { body = '#2e2a33', head = '#d9a37a', helm = null, spear = false, cape = null, h = 8 } = {}) {
  if (cape) rect(g, x - 1, y - h + 3, 5, h - 3, cape);
  rect(g, x, y - h + 3, 3, h - 5, body);
  rect(g, x, y - 2, 1, 2, body); rect(g, x + 2, y - 2, 1, 2, body);
  rect(g, x, y - h, 3, 3, helm ?? head);
  if (helm) rect(g, x + 1, y - h + 1, 2, 1, '#111014');
  if (spear) rect(g, x + 3, y - h - 3, 1, h + 2, '#9a8b74');
}

/** You, drawn big (u pixels to a block): feet at (x, y), maybe a cape. */
function hero(g, x, y, u, { body = '#e9e4d8', head = '#d9a37a', hair = '#4a3426', cape = null } = {}) {
  const legs = mix(body, '#000000', 0.3);
  if (cape) rect(g, x - u, y - 8 * u, 5 * u, 7 * u, cape);
  rect(g, x, y - 3 * u, u, 3 * u, legs);
  rect(g, x + 2 * u, y - 3 * u, u, 3 * u, legs);
  rect(g, x, y - 7 * u, 3 * u, 4 * u, body);
  rect(g, x, y - 7 * u, u, 4 * u, mix(body, '#000000', 0.15));
  rect(g, x, y - 10 * u, 3 * u, 3 * u, head);
  rect(g, x, y - 10 * u, 3 * u, u, hair);
}

/** You, falling, arms and legs flung out: two frames, turning over. */
function faller(g, x, y, u, frame) {
  const parts = frame
    ? [[0, -3, 3, 3, '#d9a37a'], [0, 0, 3, 4, '#e9e4d8'], [-3, 0, 3, 1, '#e9e4d8'], [3, 1, 3, 1, '#e9e4d8'], [0, 4, 1, 3, '#b8b0a0'], [2, 4, 1, 3, '#b8b0a0']]
    : [[0, 4, 3, 3, '#d9a37a'], [0, 0, 3, 4, '#e9e4d8'], [-3, 2, 3, 1, '#e9e4d8'], [3, 3, 3, 1, '#e9e4d8'], [-1, -3, 1, 3, '#b8b0a0'], [3, -3, 1, 3, '#b8b0a0']];
  for (const [px, py, w, h] of parts) rect(g, x + px * u - 1, y + py * u - 1, w * u + 2, h * u + 2, '#1a2030', 0.8);
  for (const [px, py, w, h, c] of parts) rect(g, x + px * u, y + py * u, w * u, h * u, c);
}

/** Stepped hills, one layer at a time. */
function hills(g, base, amp, freq, phase, c, edge) {
  for (let x = 0; x < ART_W; x += 2) {
    const h = Math.round((Math.sin(x * freq + phase) * 0.6 + Math.sin(x * freq * 2.3 + phase * 1.7) * 0.4) * amp / 2) * 2;
    rect(g, x, base - h, 2, ART_H - base + h, c);
    if (edge) rect(g, x, base - h, 2, 1, edge);
  }
}

function tree(g, x, y, s = 1) {
  rect(g, x, y - 6 * s, 2 * s, 6 * s, '#6b4a32');
  rect(g, x - 4 * s, y - 13 * s, 10 * s, 7 * s, '#3f7a3a');
  rect(g, x - 2 * s, y - 16 * s, 6 * s, 3 * s, '#4f9246');
  rect(g, x - 4 * s, y - 7 * s, 10 * s, 1, '#2f5d2c');
}

function house(g, x, y, w, h, { wall = '#d8c7a6', roofc = '#a0523a', lit = false } = {}) {
  rect(g, x, y - h, w, h, wall);
  rect(g, x, y - h, 1, h, mix(wall, '#000000', 0.25));
  roof(g, x - 1, y - h - 1, w + 2, roofc);
  rect(g, x + Math.floor(w / 2) - 1, y - 4, 3, 4, '#5a3a26');
  if (lit) {
    rect(g, x + 2, y - h + 2, 2, 2, '#ffcf6b');
    rect(g, x + w - 4, y - h + 2, 2, 2, '#ffcf6b');
    rect(g, x + 1, y - h + 1, 4, 4, '#ffcf6b', 0.2);
  }
}

function fire(g, t, x, y) {
  const f = Math.sin(t * 9 + x) > 0;
  rect(g, x - 3, y - 6, 8, 8, '#ff9a3c', 0.15);
  rect(g, x, y - 1, 3, 1, '#5a3a26');
  rect(g, x, y - 3, 3, 2, '#ff7a2a');
  rect(g, x + (f ? 1 : 0), y - 5, 1, 2, '#ffd36b');
}

function banner(g, t, x, y, c = '#1d1a20') {
  rect(g, x, y - 12, 1, 12, '#5a4a3a');
  rect(g, x + 1, y - 12 + (Math.sin(t * 3 + x) > 0 ? 1 : 0), 4, 6, c);
}

export const ART = {
  /** The Sky Kingdom glowing among its fireflies, at night. */
  sky(g, t) {
    sky(g, [[0, '#0b1030'], [0.55, '#23305e'], [1, '#41507e']]);
    stars(g, t, 50, 3);
    cloud(g, ((t * 3) % 260) - 60, 112, 50, '#9aa7c8', 0.5);
    cloud(g, ((t * 2 + 120) % 260) - 60, 124, 70, '#b7c2dd', 0.6);
    island(g, t, 96, 70, 1);
    for (const x of [62, 130]) chain(g, x, 96, x + (x < 96 ? -30 : 30), ART_H, '#bfb8aa');
    fireflies(g, t, 96, 58, 70, 30, 46);
  },

  /** The Stone army at the anchor towers, hauling on the chains. */
  army(g, t) {
    sky(g, [[0, '#2a1d2e'], [0.5, '#5a3240'], [1, '#8a4a3a']]);
    island(g, t, 96, 18, 0.55, { falls: false });
    fireflies(g, t, 96, 10, 40, 10, 16, 5);
    // Two anchor towers and their chains up to the island.
    for (const x of [34, 154]) {
      rect(g, x - 6, 66, 12, 46, '#e9e4d8');
      rect(g, x - 6, 66, 2, 46, '#c4bdae');
      rect(g, x - 6, 66, 12, 2, '#d9b24a');
      rect(g, x - 7, 64, 14, 2, '#f2efe6');
      chain(g, x, 64, 96 + (x < 96 ? -18 : 18), 34, '#a39d94');
    }
    hills(g, 112, 4, 0.05, 1, '#2b2428', '#3c3236');
    // The army: ranks of dark helms and spears, banners and fires between.
    const r = rng(9);
    for (let row = 0; row < 4; row++) {
      const y = 116 + row * 7, n = 22 + row * 4;
      for (let i = 0; i < n; i++) {
        const x = (i / n) * ART_W + r() * 4 + (row % 2) * 3;
        const sway = Math.sin(t * 2 + i + row) > 0.7 ? 1 : 0;
        person(g, x, y + sway, { body: row === 3 ? '#1a171c' : '#2e2a33', helm: '#4a4650', spear: true, h: 6 + row });
      }
      if (row === 1) for (const x of [20, 70, 120, 170]) banner(g, t, x, y - 2);
    }
    for (const x of [48, 100, 142]) fire(g, t, x, 114);
  },

  /** The fall: through the fireflies and the clouds, the island shrinking above. */
  fall(g, t) {
    sky(g, [[0, '#1a2346'], [0.5, '#4a6aa0'], [1, '#a8c4e6']]);
    island(g, t, 96, 6, 0.4, { falls: false });
    fireflies(g, t, 96, 0, 40, 8, 10, 3);
    // Clouds rushing up past you.
    const r = rng(4);
    for (let i = 0; i < 9; i++) {
      const x = r() * 220 - 30, w = 30 + r() * 50, sp = 30 + r() * 30;
      const y = ART_H + 20 - ((t * sp + r() * 200) % (ART_H + 50));
      cloud(g, x, y, w, '#ffffff', 0.55 + r() * 0.35);
    }
    // You, tumbling, and the streaks of the wind.
    const x = 90 + Math.sin(t * 1.3) * 6, y = 70 + Math.sin(t * 0.9) * 4;
    for (let i = 0; i < 7; i++) rect(g, x - 8 + i * 4, y - 26 - (i % 3) * 6, 1, 12, '#ffffff', 0.4);
    faller(g, x, y, 2, Math.floor(t * 3) % 2);
  },

  /** Waking far from anywhere: dawn over green hills, a river, a tree, and you. */
  arrival(g, t) {
    sky(g, [[0, '#6f9ed6'], [0.45, '#f2b8a0'], [0.7, '#ffd9a0'], [1, '#ffe9c4']]);
    const sun = 84 - Math.min(10, t * 1.2);
    rect(g, 132, sun, 18, 18, '#fff1c4'); rect(g, 128, sun + 4, 26, 10, '#fff1c4', 0.5);
    cloud(g, ((t * 2) % 240) - 40, 22, 40, '#ffffff', 0.8);
    cloud(g, ((t * 1.4 + 110) % 240) - 40, 40, 30, '#fff4ea', 0.7);
    hills(g, 92, 10, 0.03, 0.4, '#8fb6a0', null);
    hills(g, 104, 8, 0.045, 2.1, '#6ea66a', '#82bb7a');
    hills(g, 118, 4, 0.06, 4, '#5a9a52', '#73b468');
    // The river winding across, catching the light.
    for (let x = 0; x < ART_W; x += 2) {
      const y = 126 + Math.round(Math.sin(x * 0.05) * 3);
      rect(g, x, y, 2, 5, '#5aa6d6');
      if ((x + Math.floor(t * 6)) % 12 === 0) rect(g, x, y + 1, 2, 1, '#e6f6ff');
    }
    rect(g, 0, 131, ART_W, ART_H - 131, '#4f8a48');
    // Your thirty-two blocks: a patch of ground, a tree, you with an axe.
    rect(g, 56, 118, 52, 2, '#7a5a3a');
    tree(g, 66, 118);
    hero(g, 88, 118, 1.5);
    rect(g, 93, 104, 1, 8, '#8c6a46'); rect(g, 93, 104, 4, 3, '#b8bcc4');
    // Birds, far off.
    for (let i = 0; i < 3; i++) {
      const bx = (40 + i * 14 + t * 6) % ART_W, by = 30 + i * 4, up = Math.floor(t * 4 + i) % 2;
      rect(g, bx, by + up, 2, 1, '#3a3f4a'); rect(g, bx + 2, by + 1 - up, 2, 1, '#3a3f4a');
    }
  },

  /** The Ten Rounds held: your wall, white banners, the dark army in retreat. */
  walls(g, t) {
    sky(g, [[0, '#8fc0e8'], [0.6, '#cfe4f0'], [1, '#e6efe0']]);
    cloud(g, ((t * 2) % 240) - 40, 18, 46);
    hills(g, 70, 6, 0.04, 1, '#9ab88a', null);
    // Far off on the hills, the dark army going home in a dusty column.
    const r = rng(2);
    for (let i = 0; i < 30; i++) {
      const x = 40 + ((r() * 120 + t * 1.5) % 120), y = 70 + r() * 4;
      rect(g, x, y - 3, 1, 3, '#2e2a33');
      rect(g, x, y - 4, 1, 1, '#4a4650');
    }
    rect(g, 36, 66, 130, 4, '#d8cdb0', 0.35);
    rect(g, 0, 76, ART_W, ART_H, '#86b076');
    rect(g, 0, 76, ART_W, 1, '#9cc08a');
    // The wall, with its towers, its banners, and its archers.
    rect(g, 0, 98, ART_W, 26, '#a9a49a');
    for (let x = 0; x < ART_W; x += 8) rect(g, x, 94, 5, 4, '#a9a49a');
    for (let y = 102; y < 124; y += 5) for (let x = (y % 2) * 4; x < ART_W; x += 9) rect(g, x, y, 8, 1, '#8f8a80');
    for (const x of [30, 150]) {
      rect(g, x - 8, 82, 18, 42, '#b5b0a5');
      for (let i = 0; i < 18; i += 5) rect(g, x - 8 + i, 78, 3, 4, '#b5b0a5');
      banner(g, t, x, 78, '#ffffff');
      person(g, x - 4, 82, { body: '#3a6a8a', h: 7 });
    }
    rect(g, 82, 106, 28, 18, '#5a3a26'); rect(g, 84, 108, 24, 16, '#6b4a32');
    for (const x of [60, 124]) person(g, x, 94, { body: '#3a6a8a', h: 7 });
    rect(g, 0, 124, ART_W, ART_H - 124, '#6a9a5a');
  },

  /** The white god's blessing: your village at night, fireflies over every roof. */
  blessing(g, t) {
    sky(g, [[0, '#0d1532'], [0.6, '#22305a'], [1, '#33456e']]);
    stars(g, t, 45, 8);
    rect(g, 150, 18, 12, 12, '#f2f0e0'); rect(g, 154, 18, 8, 8, '#d8d6c4', 0.6);
    hills(g, 100, 8, 0.035, 2, '#1e2a3a', null);
    rect(g, 0, 112, ART_W, ART_H, '#24382c');
    const homes = [[14, 16, 12], [38, 14, 10], [60, 22, 16], [92, 14, 11], [114, 18, 13], [142, 16, 12], [166, 14, 10]];
    for (const [x, w, h] of homes) house(g, x, 118, w, h, { wall: '#8a7c66', roofc: '#5a2e24', lit: true });
    rect(g, 0, 118, ART_W, ART_H - 118, '#1f3326');
    fireflies(g, t, 96, 86, 100, 36, 70, 21);
  },

  /** The morning after: your kingdom, whole, in the first light. */
  dawn(g, t) {
    sky(g, [[0, '#7fb2e6'], [0.5, '#f6c8a8'], [1, '#ffe6bc']]);
    rect(g, 24, 70, 16, 16, '#fff1c4'); rect(g, 20, 74, 24, 8, '#fff1c4', 0.5);
    cloud(g, ((t * 2 + 60) % 240) - 40, 26, 44);
    hills(g, 96, 8, 0.03, 1.4, '#8fb6a0', null);
    rect(g, 0, 104, ART_W, ART_H, '#6ea66a');
    // Fields, houses, a temple, and the wall round them all.
    for (let i = 0; i < 6; i++) rect(g, 10 + i * 10, 124, 8, 10, i % 2 ? '#d8c060' : '#8fbf5a');
    house(g, 78, 118, 16, 12); house(g, 98, 118, 14, 10, { roofc: '#8a4a32' }); house(g, 116, 118, 18, 14);
    rect(g, 142, 96, 22, 22, '#f2efe6'); roof(g, 140, 95, 26, '#d9b24a'); rect(g, 151, 108, 4, 10, '#8c6a46');
    for (let x = 0; x < ART_W; x += 2) rect(g, x, 118, 2, 2, '#9a958c');
    tree(g, 70, 118, 0.8); tree(g, 172, 118, 0.9);
    for (let i = 0; i < 4; i++) person(g, 84 + i * 12 + Math.sin(t + i) * 3, 128, { body: ['#3a6a8a', '#8a4a3a', '#5a7a3a', '#7a5a8a'][i], h: 7 });
    rect(g, 0, 134, ART_W, ART_H - 134, '#5a9a52');
  },

  /** The white throne room, its King gone and his crown on the steps. */
  throne(g, t) {
    rect(g, 0, 0, ART_W, ART_H, '#d8d2c4');
    for (let y = 0; y < 100; y += 6) rect(g, 0, y, ART_W, 1, '#cbc4b4');
    // Light falling in from high windows.
    for (const x of [40, 96, 152]) {
      rect(g, x - 5, 8, 10, 18, '#9fc4ea');
      for (let y = 26; y < 120; y += 2) rect(g, x - 5 - (y - 26) * 0.15, y, 10 + (y - 26) * 0.3, 2, '#fff6d8', 0.12);
    }
    for (const x of [16, 64, 128, 176]) {
      rect(g, x - 4, 10, 8, 102, '#f6f3ea'); rect(g, x - 4, 10, 2, 102, '#e2ddd0');
      rect(g, x - 6, 8, 12, 3, '#d9b24a'); rect(g, x - 6, 108, 12, 4, '#d9b24a');
    }
    rect(g, 0, 112, ART_W, ART_H, '#bdb5a4');
    for (let x = 0; x < ART_W; x += 12) rect(g, x, 112, 1, 32, '#ada594');
    // The steps and the empty throne, a black banner hung behind it.
    for (let i = 0; i < 4; i++) rect(g, 66 + i * 4, 112 - i * 4, 60 - i * 8, 4, i % 2 ? '#e8e2d4' : '#d9d2c2');
    rect(g, 86, 66, 20, 30, '#d9b24a'); rect(g, 89, 70, 14, 26, '#8a2a3a'); rect(g, 84, 92, 24, 4, '#d9b24a');
    banner(g, t, 74, 60, '#1d1a20'); banner(g, t, 114, 60, '#1d1a20');
    // The crown, fallen, glinting.
    const glint = Math.sin(t * 3) > 0.6;
    rect(g, 116, 106, 8, 3, '#e8c24a'); rect(g, 116, 104, 1, 2, '#e8c24a'); rect(g, 119, 103, 1, 3, '#e8c24a'); rect(g, 123, 104, 1, 2, '#e8c24a');
    if (glint) rect(g, 119, 102, 1, 1, '#ffffff');
  },

  /** The island over your land, its banners black, its chains held by your warriors. */
  dominion(g, t) {
    sky(g, [[0, '#1d1430'], [0.5, '#4a2a4a'], [1, '#8a4a4a']]);
    stars(g, t, 25, 12, 50);
    island(g, t, 96, 52, 0.9, { banners: 'black' });
    for (const x of [16, 176]) {
      rect(g, x - 5, 96, 10, 30, '#d8d2c4'); rect(g, x - 6, 94, 12, 2, '#d9b24a');
      chain(g, x, 94, 96 + (x < 96 ? -30 : 30), 80, '#7a746c');
      banner(g, t, x + 6, 96);
    }
    hills(g, 120, 4, 0.05, 3, '#2b2428', '#3c3236');
    for (let i = 0; i < 40; i++) person(g, (i * 37) % ART_W, 128 + (i % 3) * 5, { body: '#1a171c', helm: '#4a4650', spear: i % 2 === 0, h: 6 });
    for (const x of [60, 132]) fire(g, t, x, 126);
  },

  /** You on the island's edge, its new lord, the land far below. */
  lord(g, t) {
    sky(g, [[0, '#2a1630'], [0.5, '#7a3a3a'], [1, '#d07a4a']]);
    rect(g, 140, 78, 20, 20, '#ffb36b', 0.8);
    // The land far below, its lights coming on.
    rect(g, 0, 100, ART_W, ART_H, '#3a2e30');
    const r = rng(6);
    for (let i = 0; i < 30; i++) rect(g, r() * ART_W, 104 + r() * 36, 1, 1, '#ffcf6b', 0.5 + 0.5 * Math.sin(t * 2 + i));
    cloud(g, ((t * 3) % 240) - 40, 92, 60, '#c88a7a', 0.5);
    // The edge of the island, in front: grass on top, rock falling away under it.
    for (let y = 104; y < ART_H; y++) {
      const w = 118 - (y - 104) * 2.2 + Math.sin(y * 1.7) * 2;
      if (w <= 0) break;
      rect(g, 0, y, w, 1, y < 107 ? '#5a7a3a' : mix('#5a4e50', '#221e22', (y - 104) / 40));
    }
    for (let x = 0; x < 118; x += 6) rect(g, x, 103, 3, 1, '#6e8f4a');
    // You, cloaked, by a black banner, looking out over it all.
    hero(g, 72, 105, 2.4, { body: '#1d1a20', cape: Math.sin(t * 2) > 0 ? '#4a1a2a' : '#3a1220' });
    rect(g, 72, 79, 7, 2, '#d9b24a');
    rect(g, 72, 77, 1, 2, '#d9b24a'); rect(g, 75, 76, 1, 3, '#d9b24a'); rect(g, 78, 77, 1, 2, '#d9b24a');
    rect(g, 98, 70, 1, 35, '#5a4a3a');
    rect(g, 99, 70 + (Math.sin(t * 3) > 0 ? 1 : 0), 9, 14, '#1d1a20');
    fireflies(g, t, 60, 60, 60, 30, 14, 2);
  },

  /** Its chains cut, the island sinking, tilting, its waterfalls thinning. */
  sinking(g, t) {
    sky(g, [[0, '#3a3a52'], [0.6, '#6a6a7a'], [1, '#8a8478']]);
    const drop = (t * 1.5) % 14;
    island(g, t, 96, 46 + drop, 0.85, { falls: Math.floor(t) % 2 === 0, tilt: 3 });
    // The cut chains hanging loose.
    for (const [x, sway] of [[52, 1], [140, -1]]) chain(g, x, 74 + drop, x + sway * (8 + Math.sin(t * 1.5) * 3), 104 + drop, '#8f8a84');
    for (const x of [20, 172]) {
      rect(g, x - 5, 100, 10, 30, '#d8d2c4');
      chain(g, x, 100, x + (x < 96 ? 6 : -6), 90, '#8f8a84');
    }
    // Dust where it sheds rock.
    for (let i = 0; i < 12; i++) {
      const x = 60 + ((i * 29) % 80), y = 80 + drop + ((t * 10 + i * 13) % 40);
      rect(g, x, y, 2, 2, '#b8aca0', 0.5);
    }
    hills(g, 124, 4, 0.05, 1, '#4a4a44', '#5a5a52');
  },
};

/** Paints one frame of a scene's art onto `g` (a 2D context at ART_W × ART_H). */
export function paint(g, art, t = 0) {
  rect(g, 0, 0, ART_W, ART_H, '#000000');
  (ART[art] ?? ART.sky)(g, t);
}

// ---- the view ----------------------------------------------------------------------------------

export class StoryView {
  /**
   * @param root    the UI root the overlay goes under
   * @param panels  the panel registry — it opens and closes like any panel
   */
  constructor(root, panels) {
    this.panels = panels;
    this.el = document.createElement('div');
    this.el.id = 'story';
    this.el.className = 'overlay story';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="story-card">
        <canvas class="story-art" width="${ART_W}" height="${ART_H}"></canvas>
        <p class="story-text"></p>
        <div class="story-foot">
          <button class="secondary story-skip">Skip</button>
          <span class="story-dots"></span>
          <button class="primary story-next">Next</button>
        </div>
      </div>`;
    root.appendChild(this.el);
    this.canvas = this.el.querySelector('.story-art');
    this.g = this.canvas.getContext('2d');
    this.text = this.el.querySelector('.story-text');
    this.dots = this.el.querySelector('.story-dots');
    this.nextBtn = this.el.querySelector('.story-next');
    this.scenes = [];
    this.at = 0;
    this.onDone = null;
    this.frame = null;

    const next = (e) => { e.stopPropagation(); this.next(); };
    this.nextBtn.addEventListener('click', next);
    this.canvas.addEventListener('click', next);
    this.text.addEventListener('click', next);
    this.el.querySelector('.story-skip').addEventListener('click', (e) => { e.stopPropagation(); this.panels.close('story'); });
    // However it closes — the last Next, Skip, or Escape — it's done once.
    panels.onClose((id) => {
      if (id !== 'story') return;
      cancelAnimationFrame(this.frame);
      this.frame = null;
      const done = this.onDone;
      this.onDone = null;
      done?.();
    });
  }

  get open() {
    return !this.el.hidden;
  }

  /** Plays `scenes` ([{ art, text }]); `onDone` runs when it's over, skipped or not. */
  play(scenes, { onDone = null, last = 'Begin' } = {}) {
    if (!scenes?.length) { onDone?.(); return; }
    this.scenes = scenes;
    this.last = last;
    this.onDone = onDone;
    this.at = 0;
    this.panels.open('story');
    this.show();
    this.started = performance.now();
    const tick = () => {
      if (!this.open) return;
      paint(this.g, this.scenes[this.at].art, (performance.now() - this.started) / 1000);
      this.frame = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(tick);
  }

  show() {
    const s = this.scenes[this.at];
    this.text.textContent = s.text;
    this.text.classList.remove('in');
    void this.text.offsetWidth; // restart the fade
    this.text.classList.add('in');
    this.dots.innerHTML = this.scenes.map((_, i) => `<i class="${i === this.at ? 'on' : ''}"></i>`).join('');
    this.nextBtn.textContent = this.at === this.scenes.length - 1 ? this.last : 'Next';
    paint(this.g, s.art, 0);
  }

  next() {
    if (this.at >= this.scenes.length - 1) return void this.panels.close('story');
    this.at++;
    this.started = performance.now();
    this.show();
  }
}
