/**
 * PLAY-4 (owner, 22 November): "When I kill mobs they disappear very quickly,
 * it's not noticeable that I hit the mob ... There should be an animation of
 * the mob disappearing."
 *
 * A hit shows red for HURT_FLASH seconds, strongest at the blow. A kill
 * plays over DYING_TIME: the animal topples onto its side in TOPPLE seconds,
 * lies there red, then shrinks into the ground from FADE_AT with a puff of
 * dust (PoofView).
 */
export const HURT_FLASH = 0.5;
export const DYING_TIME = 1.4;
export const TOPPLE = 0.35;
export const FADE_AT = 0.85;

/** How much red a hit leaves, 0 to 0.85, from the seconds of `hurt` left. */
export function hurtFlash(hurt) {
  return hurt > 0 ? Math.min(1, hurt / HURT_FLASH) * 0.85 : 0;
}

/**
 * The pose of a dying animal from the seconds of `dying` left: its roll
 * (radians), scale (1 to 0), how far it has sunk (blocks) and its red.
 * Null when it is not dying.
 */
export function deathPose(dying) {
  if (!(dying > 0)) return null;
  const t = Math.min(DYING_TIME, Math.max(0, DYING_TIME - dying));
  const tip = Math.min(1, t / TOPPLE);
  const roll = (1 - (1 - tip) * (1 - tip)) * (Math.PI / 2);
  const fade = Math.max(0, (t - FADE_AT) / (DYING_TIME - FADE_AT));
  const scale = Math.max(0, 1 - fade * fade);
  return { roll, scale, sink: fade * 0.3, flash: 0.85 - 0.45 * Math.min(1, t / FADE_AT), fading: fade > 0 };
}
