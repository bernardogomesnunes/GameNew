import { ASKS } from '../config/asks.js';
import { MOOD, MOOD_DAY } from '../config/mood.js';
import { ITEMS_BY_ID } from '../config/items.js';
import { bandOf } from './Mood.js';

/**
 * VIL-2: villager asks, as pure rules. A person carries `ask` ({ item, kind,
 * left } with `left` in seconds, or null) and `nextAsk` (seconds until the
 * next ask starts).
 */

const between = (rand, [lo, hi]) => (lo + rand() * (hi - lo)) * MOOD_DAY;
const KIND_OF = new Map(Object.entries(ASKS.pool).flatMap(([kind, ids]) => ids.filter((id) => ITEMS_BY_ID.has(id)).map((id) => [id, kind])));

/** What kind of thing `itemId` is as a gift, or null when nobody asks for it. */
export const kindOf = (itemId) => KIND_OF.get(itemId) ?? null;
/** Mood a gift of `itemId` is worth. */
export const giftValue = (itemId) => ASKS.gift[kindOf(itemId)] ?? 0;

/** Ask fields for a new arrival: nothing yet, the first ask a gap away. */
export function newAsks(rand = Math.random) {
  return { ask: null, nextAsk: between(rand, ASKS.gapDays) };
}

/** Ask fields for a person loaded from a save that may predate asks. */
export function loadAsks(p, rand = Math.random) {
  const a = p.ask;
  const ask = a && KIND_OF.has(a.item) && Number.isFinite(a.left) && a.left > 0
    ? { item: a.item, kind: KIND_OF.get(a.item), left: Math.min(a.left, ASKS.expireDays[1] * MOOD_DAY) }
    : null;
  const next = Number.isFinite(p.nextAsk) && p.nextAsk >= 0 ? Math.min(p.nextAsk, ASKS.gapDays[1] * MOOD_DAY) : between(rand, ASKS.gapDays);
  return { ask, nextAsk: next };
}

/** A new ask for `p`: a random kind, a random item of it, not the same as the last. */
export function pickAsk(p, rand = Math.random) {
  const kinds = Object.keys(ASKS.pool).filter((k) => ASKS.pool[k].some((id) => KIND_OF.has(id)));
  const kind = kinds[Math.floor(rand() * kinds.length) % kinds.length];
  const ids = ASKS.pool[kind].filter((id) => KIND_OF.has(id) && id !== p.lastAsk);
  const item = ids[Math.floor(rand() * ids.length) % ids.length];
  return { item, kind, left: between(rand, ASKS.expireDays) };
}

/**
 * Advances one person's asks by dt seconds. Returns 'asked' when a new ask
 * began, 'lapsed' when one ran out, or null.
 */
export function step(p, dt, rand = Math.random) {
  if (!(dt > 0)) return null;
  if (p.ask) {
    p.ask.left -= dt;
    if (p.ask.left > 0) return null;
    p.lastAsk = p.ask.item;
    p.ask = null;
    p.nextAsk = between(rand, ASKS.gapDays);
    return 'lapsed';
  }
  p.nextAsk = (p.nextAsk ?? between(rand, ASKS.gapDays)) - dt;
  if (p.nextAsk > 0) return null;
  p.ask = pickAsk(p, rand);
  return 'asked';
}

/**
 * Hands `p` what they asked for: mood goes up by the gift's worth, the ask
 * ends and the next is a gap away. Returns the mood gained, or 0 when `item`
 * is not what they want.
 */
export function receive(p, item, rand = Math.random) {
  if (!p.ask || p.ask.item !== item) return 0;
  const before = p.mood;
  p.mood = Math.min(MOOD.max, p.mood + giftValue(item));
  p.band = bandOf(p.mood, p.band);
  p.lastAsk = item;
  p.ask = null;
  p.nextAsk = between(rand, ASKS.gapDays);
  return p.mood - before;
}
