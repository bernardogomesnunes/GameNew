/**
 * Sleeping in a bed (PLAY-8, owner, 22 November: "an animation of the avatar
 * sleeping in the bed for 10 sec to turn day"). Pure timing: given the seconds
 * slept, where the clock is, how dark the screen is, and whether it is over.
 * Game.js owns the camera, the avatar and the veil; this owns the numbers.
 */

/** Real seconds from lying down to morning. */
export const SLEEP_SECONDS = 10;
/** Seconds the screen takes to fade in at the start and out at the end. */
export const FADE_SECONDS = 1.5;
/** Seconds the avatar takes to lie down, and to stand up again. */
export const LIE_SECONDS = 0.8;
/** The darkest the screen gets, 0 clear to 1 black: a dim, not a blackout. */
export const DIM_MAX = 0.55;
/** How far the dim swells and ebbs while asleep. */
export const DIM_PULSE = 0.08;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

/** Fraction of a day from `start` forward to `target` (0..1, never the whole day). */
export function daySpan(start, target) {
  return (((target - start) % 1) + 1) % 1;
}

/**
 * The state `elapsed` seconds into a sleep.
 * @param {number} elapsed seconds since lying down
 * @param {{start:number, target:number, reduced?:boolean, seconds?:number}} o
 *   start and target are times of day 0..1; `reduced` drops the dim's pulsing.
 * @returns {{time:number, progress:number, advanced:number, dim:number, lie:number, done:boolean}}
 *   `time` is the clock to show (0..1), `advanced` the fraction of a day gone
 *   since `start`, `dim` the veil (0..1), `lie` how far down the avatar is.
 */
export function sleepAt(elapsed, { start, target, reduced = false, seconds = SLEEP_SECONDS }) {
  const t = Math.max(0, elapsed);
  const progress = clamp01(t / seconds);
  const span = daySpan(start, target);
  // Eased at both ends so the sky does not lurch; strictly rising between them.
  const eased = progress < 1 ? 0.15 * progress + 0.85 * smooth(progress) : 1;
  const advanced = span * eased;
  const time = progress >= 1 ? target : (start + advanced) % 1;
  const fadeIn = smooth(t / FADE_SECONDS);
  const fadeOut = smooth((seconds - t) / FADE_SECONDS);
  const pulse = reduced ? 0 : DIM_PULSE * Math.sin(t * 2.4);
  const dim = clamp01(Math.min(fadeIn, fadeOut) * (DIM_MAX + pulse * Math.min(fadeIn, fadeOut)));
  const lie = Math.min(smooth(t / LIE_SECONDS), smooth((seconds - t) / LIE_SECONDS));
  return { time, progress, advanced, dim, lie, done: progress >= 1 };
}

/** Whether a key code should wake the sleeper: any way of moving, or Escape. */
export function wakesOn(code, binds = {}) {
  if (code === 'Escape') return true;
  return [binds.forward, binds.back, binds.left, binds.right, binds.jump, binds.down].includes(code);
}
