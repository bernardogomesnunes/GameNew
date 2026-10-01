/**
 * The Stone Kingdom's war on you — the Ten Rounds (White path, chosen
 * directly in docs/plan-phase7-lore.md, then moved by the playtest:
 * "when we hit [the last border] we get attacked, even if we didn't craft
 * the ring — it will be harder to beat because you need to craft it while
 * you are being attacked").
 *
 * So the war is declared the moment you reach the last age, whatever ring
 * you bear or don't. Forge the Black Ring and the Stone King calls it off —
 * you're his now. Otherwise it's ten rounds at your walls, each one bigger,
 * and the tenth brings the Warlord.
 *
 * Times are in game days (DuiltGame.days: one turn of the clock, ~20
 * minutes of play). Each round is announced first — how many, and from
 * where — and a war horn calls the next one early when you're ready.
 */

/** From the war being declared to the first round, and between rounds. */
export const FIRST_ROUND_DAYS = 0.5;
export const ROUND_GAP_DAYS = 1.5;
/** How long before a round you hear it coming: about a minute of play. */
export const WARN_DAYS = 0.05;
/** A round lost comes again, this soon. */
export const RETRY_DAYS = 1;
/** What a round won is worth, in gold — more for the later ones. */
export const ROUND_GOLD = (n) => 4 + n * 2;

/**
 * Who comes, round by round. `who` is [kind, count] — kinds from
 * config/wanderers.js; the siege engines and the Warlord's beast are kinds
 * there too.
 *
 *   1–3   bandits the King has paid
 *   4–6   archers, and a battering ram for your gate
 *   7–9   Stone soldiers in armour, and catapults for your walls
 *   10    the Warlord, riding a black beast of his own
 */
export const ROUNDS = [
  { who: [['bandit', 3]] },
  { who: [['bandit', 4]] },
  { who: [['bandit', 5]] },
  { who: [['bandit', 3], ['archer', 2], ['ram', 1]] },
  { who: [['bandit', 3], ['archer', 3], ['ram', 1]] },
  { who: [['bandit', 2], ['soldier', 1], ['archer', 4], ['ram', 1]] },
  { who: [['soldier', 4], ['archer', 3], ['siege_catapult', 1]] },
  { who: [['soldier', 4], ['archer', 3], ['siege_catapult', 1], ['ram', 1]] },
  { who: [['soldier', 5], ['archer', 3], ['siege_catapult', 2]] },
  { who: [['warlord', 1], ['warbeast', 1], ['soldier', 4], ['archer', 3], ['siege_catapult', 1]] },
];

export const LAST_ROUND = ROUNDS.length;

/** How a round's company reads in a sentence: "3 bandits, 2 archers and a battering ram". */
export function companyWords(n, names) {
  const parts = ROUNDS[n - 1].who
    .filter(([kind]) => kind !== 'warbeast')
    .map(([kind, count]) => {
      const { one, many } = names[kind];
      return count === 1 ? one : `${count} ${many}`;
    });
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}
