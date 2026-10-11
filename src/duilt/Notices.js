/**
 * The notification centre's list: every message the game showed in this
 * world, kept with the world, so one that slid off the screen — or was cut
 * short there — can be read again. Asked for directly: "a Notification
 * Centre to show game notifications per world. Accessed via menu and is a
 * pop up with all notifications".
 *
 * Kept as plain text, never markup: a toast's title can carry a <b>, and the
 * list is drawn escaped.
 */

/** How many are kept; the oldest go first. */
export const NOTICE_LIMIT = 200;

/**
 * What isn't worth keeping: the running XP tally and the little answers to
 * a button you just pressed. They say nothing a minute later.
 */
const NOISE = [/^\+\d+ XP$/, /^World loaded$/, /^Locked$/, /^Threw away/, /^Put it away$/, /^Your bag is full$/];

export const plain = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

export class Notices {
  constructor() {
    this.list = [];
    /** When the list was last looked at — what's newer counts as unread. */
    this.seenAt = 0;
  }

  /**
   * Keeps one. The same message again straight after (a save retrying, a
   * building finishing twice) counts up on the last one instead of stacking.
   */
  add({ kind = 'xp', title, body = '', at = Date.now() }) {
    const t = plain(title), b = plain(body);
    if (!t || NOISE.some((re) => re.test(t))) return null;
    const last = this.list[this.list.length - 1];
    if (last && last.title === t && last.body === b) {
      last.n = (last.n ?? 1) + 1;
      last.at = at;
      return last;
    }
    const n = { kind, title: t, body: b, at };
    this.list.push(n);
    if (this.list.length > NOTICE_LIMIT) this.list.splice(0, this.list.length - NOTICE_LIMIT);
    return n;
  }

  unread() {
    return this.list.filter((n) => n.at > this.seenAt).length;
  }

  markSeen(now = Date.now()) {
    this.seenAt = now;
  }

  clear() {
    this.list = [];
  }

  /** Newest first, the way they're read. */
  newest() {
    return [...this.list].reverse();
  }

  toJSON() {
    return { list: this.list, seenAt: this.seenAt };
  }

  loadJSON(data) {
    this.list = (Array.isArray(data?.list) ? data.list : [])
      .filter((n) => n && typeof n.title === 'string' && Number.isFinite(n.at))
      .map((n) => ({ kind: String(n.kind ?? 'xp'), title: n.title, body: String(n.body ?? ''), at: n.at, ...(n.n > 1 ? { n: n.n } : {}) }))
      .slice(-NOTICE_LIMIT);
    this.seenAt = Number.isFinite(data?.seenAt) ? data.seenAt : 0;
  }
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function ago(at, now = Date.now()) {
  const s = Math.max(0, (now - at) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/**
 * What the buildings made while you were away, short enough for a toast on
 * a phone: the biggest few, then how many more. The whole list goes in the
 * notification centre. Reported directly: "The notification of resume of
 * what was produced is cropping the text when there's a lot of things".
 */
export function earnedLines(earned, nameOf, shown = 4) {
  const parts = Object.entries(earned ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${n} ${nameOf(id).toLowerCase()}`);
  const more = parts.length - shown;
  return {
    short: more > 0 ? `${parts.slice(0, shown).join(', ')} and ${more} more — see Notifications` : parts.join(', '),
    full: parts.join(', '),
  };
}
