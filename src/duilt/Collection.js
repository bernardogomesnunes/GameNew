import { ITEMS } from '../config/items.js';

/**
 * The collection book (backlog batch 4, D2). Asked for directly: "The market
 * should be crucial for this with traders, because every item can be
 * achievable and if the player collects all of them, we should promptly give
 * him a reward."
 *
 * Every item you've ever held in this world is ticked off, by group. The
 * book is what can be had: not a ring (forging one closes the other), not
 * an upgraded piece (the plain one is in it), not the crown it pays out.
 * Every one of them has a way to be had — tests/collection.test checks.
 *
 * Rewards at milestones, paid the moment you reach them: coins, and for the
 * last item the Collector's Crown.
 */

export const BOOK_GROUPS = [
  { id: 'land', name: 'From the land', kinds: ['raw'] },
  { id: 'made', name: 'Made and built', kinds: ['refined'] },
  { id: 'food', name: 'Food and drink', kinds: ['food', 'drink'] },
  { id: 'tools', name: 'Tools and weapons', kinds: ['tool'] },
  { id: 'wear', name: 'Armour and gear', kinds: ['armour', 'gear'] },
];

/** The items the book asks for. */
export const BOOK = ITEMS.filter((i) => !i.upgrade && !i.noBook && BOOK_GROUPS.some((g) => g.kinds.includes(i.kind)));
export const BOOK_IDS = new Set(BOOK.map((i) => i.id));

/** What each share of the book pays — the last, the crown. */
export const MILESTONES = [
  { at: 0.1, coins: 50 },
  { at: 0.25, coins: 150 },
  { at: 0.5, coins: 400 },
  { at: 0.75, coins: 800 },
  { at: 1, coins: 2000, item: 'collector_crown' },
];

/** The book's items in one group. */
export function bookGroup(id) {
  const g = BOOK_GROUPS.find((x) => x.id === id);
  return g ? BOOK.filter((i) => g.kinds.includes(i.kind)) : [];
}

export class Collection {
  constructor() {
    this.have = new Set();
    /** How many milestones have been paid. */
    this.paid = 0;
  }

  /** Ticks off whatever of `ids` is in the book; returns the ones new to it. */
  note(ids) {
    const fresh = [];
    for (const id of ids) {
      if (!BOOK_IDS.has(id) || this.have.has(id)) continue;
      this.have.add(id);
      fresh.push(id);
    }
    return fresh;
  }

  /** 0..1, of the book. */
  progress() {
    return this.have.size / BOOK.length;
  }

  /** The next milestone not yet reached, or null once the book is full. */
  next() {
    return MILESTONES[this.paid] ?? null;
  }

  /** Milestones reached and not yet paid — marked paid as they're handed over. */
  due() {
    const out = [];
    while (this.paid < MILESTONES.length && this.progress() >= MILESTONES[this.paid].at - 1e-9) {
      out.push(MILESTONES[this.paid]);
      this.paid++;
    }
    return out;
  }

  toJSON() {
    return { have: [...this.have], paid: this.paid };
  }

  loadJSON(data) {
    this.have = new Set(Array.isArray(data?.have) ? data.have.filter((id) => BOOK_IDS.has(id)) : []);
    this.paid = Number.isInteger(data?.paid) ? Math.max(0, Math.min(MILESTONES.length, data.paid)) : 0;
  }
}
