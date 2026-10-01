/**
 * You, as others would see you (playtest, P3). Asked for directly: "user
 * needs an avatar that can be seen in 3rd person, which can be changed in
 * settings, especially for mobile; in desktop there should be a key."
 *
 * Three ways to look at the world, in turn: your own eyes, from behind your
 * shoulder, and from in front looking back at you. And three things to
 * choose about how you look — skin, hair, clothes — kept with the controls
 * (config/controls.js), so they follow you from world to world.
 */

export const VIEWS = ['first', 'behind', 'front'];
export const VIEW_NAMES = { first: 'Your own eyes', behind: 'From behind', front: 'From the front' };

/** How far the camera stands off from your eyes, out of first person. */
export const VIEW_DISTANCE = 4;

export const SKINS = [0xf2d3b8, 0xe0b48e, 0xb98660, 0x8a5a3c, 0x5e3b26];
export const HAIRS = [0x3a2a20, 0x6b4428, 0xc9a25a, 0xa84a2a, 0xd8d4cc, 0x1e1e24];
export const CLOTHES = [
  { shirt: 0x4a7ab8, trousers: 0x3a3f4a },
  { shirt: 0xb84a3e, trousers: 0x4a3a2c },
  { shirt: 0x5f9a4c, trousers: 0x5a4a38 },
  { shirt: 0xe2c26a, trousers: 0x3a3f4a },
  { shirt: 0x8a5ab8, trousers: 0x2c2a34 },
  { shirt: 0xeeeae0, trousers: 0x6b5a48 },
];

export const DEFAULT_LOOK = { skin: 1, hair: 0, clothes: 0 };

/** The colours a look comes to, whatever indices it holds. */
export function lookColours(look = DEFAULT_LOOK) {
  const pick = (list, i) => list[Math.min(list.length - 1, Math.max(0, i | 0))];
  const clothes = pick(CLOTHES, look.clothes);
  return { skin: pick(SKINS, look.skin), hair: pick(HAIRS, look.hair), shirt: clothes.shirt, trousers: clothes.trousers };
}

/** The view after `view`, round the three. */
export function nextView(view) {
  return VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length];
}
