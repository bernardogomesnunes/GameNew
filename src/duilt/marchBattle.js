import { UNITS_BY_ID, unitStats, unitPower } from '../config/soldiers.js';

/**
 * PLAY-12 (docs/design/play-12.md): a company's march on a rival city, worked
 * out by numbers when it arrives. Pure: no world, no clock.
 *
 *   power     one soldier's worth, unitPower (hp x blow / every, doubled for
 *             an archer's range, 60 for a catapult crew), rounded per soldier
 *   theirs    the city's guards x GUARD_POWER (a rival soldier is 60)
 *   win       ours >= WIN_RATIO x theirs
 *   losses    on a win, ceil(roster x 0.5 x theirs / ours), at least 1;
 *             on a loss, 60% of the company. The weakest fall first.
 */
export const MARCH_DAYS = 1;
/** A rival soldier's power (world/wanderers.js: 24 x 3 / 1.2). */
export const GUARD_POWER = 60;
/** Win from this many times their power; "Close" up to CLOSE_RATIO. */
export const WIN_RATIO = 1.25, CLOSE_RATIO = 1.4;
/** What share of a company falls when it loses. */
export const LOSS_SHARE = 0.6;
/** Hungry soldiers fight at this share (world/Defenders.js HUNGRY_STRENGTH). */
const HUNGRY = 0.6;

/** One soldier's power with `research`, as a whole number. */
export function soldierPower(unitId, research = null) {
  return Math.round(unitPower(unitStats(UNITS_BY_ID.get(unitId), research)));
}

/**
 * A company's power: the sum of its soldiers'. `hungry` of them (the
 * weakest first would be a nicety; the first ones listed) count at 0.6.
 */
export function companyPower(units, research = null, hungry = 0) {
  let total = 0;
  units.forEach((u, i) => { total += soldierPower(u, research) * (i < hungry ? HUNGRY : 1); });
  return Math.round(total);
}

/** A rival city's power: its guards, 60 each. */
export const cityPower = (guards) => guards * GUARD_POWER;

/** How many fall on a win. */
export function winLosses(rosterSize, ours, theirs) {
  if (!rosterSize) return 0;
  return Math.min(rosterSize, Math.max(1, Math.ceil(rosterSize * 0.5 * theirs / Math.max(1, ours))));
}

/**
 * What a march would come to, in the words the picker shows:
 * { word: 'win' | 'close' | 'loss', ratio, falls, text }.
 * "Close" is a win by under CLOSE_RATIO: rivals grow while the company walks.
 */
export function forecast(ours, theirs, rosterSize = 0) {
  const ratio = theirs > 0 ? ours / theirs : Infinity;
  if (ratio < WIN_RATIO) return { word: 'loss', ratio, falls: Math.ceil(rosterSize * LOSS_SHARE), text: 'Loss' };
  const falls = winLosses(rosterSize, ours, theirs);
  const fall = `about ${falls} ${falls === 1 ? 'falls' : 'fall'}`;
  if (ratio < CLOSE_RATIO) return { word: 'close', ratio, falls, text: `Close, ${fall}` };
  return { word: 'win', ratio, falls, text: `Win, ${fall}` };
}

/**
 * The battle. `roster` is the company's unit ids; the result names the ones
 * who fall, the weakest first (ties keep the roster's order).
 *
 * @returns { won, ratio, lost: [unitId] }
 */
export function resolve(ours, theirs, roster, research = null) {
  const ratio = theirs > 0 ? ours / theirs : Infinity;
  const won = ratio >= WIN_RATIO;
  const n = won ? winLosses(roster.length, ours, theirs) : Math.min(roster.length, Math.ceil(roster.length * LOSS_SHARE));
  const weakest = roster.map((unit, i) => ({ unit, i, p: soldierPower(unit, research) }))
    .sort((a, b) => a.p - b.p || a.i - b.i);
  return { won, ratio, lost: weakest.slice(0, n).map((x) => x.unit) };
}

/** The units left once `lost` have fallen: one removal per fallen id. */
export function survivors(roster, lost) {
  const out = [...roster];
  for (const u of lost) { const i = out.indexOf(u); if (i >= 0) out.splice(i, 1); }
  return out;
}
