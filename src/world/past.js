/**
 * The Past (backlog batch 4, D3: "a separate world of dinosaurs ... reached
 * only through the machine"). Asked for directly: "Next fix ... time
 * travel"; the plan has the Past first.
 *
 * It's land of its own, a long way east of home: PAST_AWAY blocks out, every
 * column is prehistoric — jungle and fern plains (config/biomes.js `era`),
 * dinosaurs (config/mobs.js), their nests — and nothing of the present's
 * biomes. Too far to walk; the time machine is the way there and back.
 * Laid out this way, like the god's cube, it's saved and streamed the same
 * as the rest of the world rather than as a second save beside it.
 *
 * Pure: where it is. Game sends you there (Game.travelTo).
 */

/** How far east of home the Past begins, in blocks. */
export const PAST_AWAY = 120000;
/** Where its land starts blending in, short of PAST_AWAY. */
export const PAST_EDGE = 2000;

/** Whether x (at a world whose home is at `centreX`) is in the Past. */
export function inPast(x, centreX = 0) {
  return x - centreX >= PAST_AWAY - PAST_EDGE;
}

/** Where you arrive in the Past: due east of home, PAST_AWAY out. */
export function pastArrival(centreX = 0, centreZ = 0) {
  return { x: Math.round(centreX + PAST_AWAY), z: Math.round(centreZ) };
}
