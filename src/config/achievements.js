import { AGES } from './ages.js';
import { STRUCTURES_BY_ID } from './structures.js';
import { SECRETS } from './secrets.js';

/**
 * The goals, which are also how the game teaches itself.
 *
 * There was a How to play panel: six tabs of prose nobody opens twice, sitting
 * beside a list of achievements about placing a hundred blocks. Two halves of
 * the same job done separately and neither done well — the prose told you what
 * the buttons were, and the achievements rewarded you for things the game does
 * not actually care whether you do.
 *
 * So the prose is gone and this is the teaching. The shape is the world's own
 * shape: one band per age, each naming the handful of things that age is
 * about. Read top to bottom it is what to do next, in order, for as long as
 * there is a next thing — starting with the things that actually move the
 * border: "1. Build a forest, 2. Break ground on a farm, 3. Build yourself a
 * house" is Age 1's own goals from ages.js, numbered here rather than left
 * to a toast you saw once when you arrived and never again. requiredGoals()
 * below generates those from AGES.goals instead of restating them, so a
 * building added to an age's goals shows up here counted and numbered with
 * nothing else to remember. What is NOT listed is a card for reaching the
 * next age itself — the border growing is something you watch happen, not a
 * trophy for the thing you just watched happen. That is a different claim
 * from "list what it took to get there", which is what the required ones do.
 *
 * How to read one:
 *
 *   id           what the save records as unlocked
 *   age          which band it sits in
 *   required     true for one of Age N's own goals — it already gates the
 *                border in DuiltGame.ageComplete, which tests the same
 *                goals from ages.js directly rather than through here, so
 *                the one thing that must never be wrong about them is not
 *                routed through the achievement-unlock bookkeeping at all.
 *                Every age's card is one now; only the secrets aren't.
 *   name         the goal, as an instruction where it can be
 *   description  what to actually do
 *   icon         one emoji, for the card
 *   xpReward     what it pays
 *   check        a predicate over { stats, event, duilt }; see
 *                GamificationEngine.ctx. `duilt` is the live settlement,
 *                null outside a Duilt world — which is exactly when a
 *                required goal has nothing to test and stays undone.
 *   progress     optional; a "3/6" string over the same context, or null
 *                when a goal is a single yes/no rather than a count.
 *   met          (required goals) whether it's met in this world now —
 *                what the card shows, since what's unlocked is kept across
 *                every world you play.
 */

/**
 * Age N's own goals from ages.js, as achievements — "1. Build a forest,
 * 2. Break ground on a farm, 3. Build yourself a house" is Age 1's `goals`
 * array, read off rather than written out a second time. These are the ones
 * `required` is true for, and the ones a `progress` count comes from — see
 * the file doc comment above for why DuiltGame.ageComplete does not read
 * achievement-unlock state to ask the same question.
 */
/** What a goal that isn't a building says about itself, on its card. */
const GOAL_WORDS = {
  wood: { icon: '🪓', description: 'Swing your axe at a tree trunk. The wood goes into your bag.' },
  water: { icon: '🪣', description: 'Hold your bucket and tap water to fill it.' },
  pickaxe: { icon: '⛏️', description: 'Open your bag and make a stone pickaxe — dig stone out of the ground, or knock it out of cobblestone.' },
  evolve: { icon: '⬆️', description: 'Give a building what its next level asks for — lights, a chest — and press Evolve in its pop-up.' },
  ring: { icon: '💍', description: 'Build your shrine up to its height and forge the White Ring or the Black. Which one is your choice.' },
  sanctuary: { icon: '🛕', description: 'The White Sanctuary or the Black — the one for the ring you bear. Its guardian comes to you.' },
  fifteen: { icon: '🌆', description: 'A settlement that would show up on a map.' },
  war: { icon: '⚔️', description: 'Beat the ten rounds of the Stone Kingdom — or, sworn to the dark god, bring down the Sky Kingdom.' },
  renowned: { icon: '🌟', description: 'Take any building to the top of its ladder.' },
  city_treasure: { icon: '💰', description: 'Take anything from a chest in a city\'s houses. A living city\'s guards come for you; an abandoned one has nobody left to mind.' },
  second_people: { icon: '🏹', description: 'Take from a tree tribe\'s hut, high in the giant trees, or a Stone Kingdom outpost\'s armoury.' },
  gem_armour: { icon: '💎', description: 'Diamond ore lies deep, below y 32. Diamond armour is made at the bench.' },
  book_half: { icon: '📖', description: 'Goals → Book. Every item you\'ve ever held counts.' },
  cube_open: { icon: '🌀', description: 'Your Sanctuary\'s pop-up opens the way once the war is won, or the sky has fallen.' },
  god_done: { icon: '⚡', description: 'Kill him — or take the wand from the chest on his altar and get to the Way Out alive.' },
  book_most: { icon: '📚', description: 'Goals → Book. Three quarters of everything there is.' },
  forty: { icon: '🏰', description: 'Forty buildings, claimed and working.' },
};

/**
 * Age N's goals, and nothing else: asked for directly, "be objective in
 * goals. we need 3 goals per age until age 5 and then we can go with 4".
 * The teaching cards that sat beside them ("Put it back", "Five people
 * living here", house counts again and again) are gone — an age is done when
 * every card in it is.
 *
 * A card only ticks in the age it belongs to, or once you're past it: a
 * building raised early doesn't tick a later age's card (reported directly:
 * "I have goals checked in age 4 and didn't even finish age 3").
 */
function requiredGoals() {
  return AGES.flatMap((age) => age.goals.map((g, i) => {
    const spec = g.structure ? STRUCTURES_BY_ID.get(g.structure) : null;
    const words = GOAL_WORDS[g.id] ?? {};
    const done = (d) => (g.structure ? d.structures.countOf(g.structure) >= (g.count ?? 1) : !!g.test?.(d));
    return {
      id: `req_${age.age}_${g.structure ?? g.id ?? i}`,
      age: age.age,
      required: true,
      name: g.label,
      description: spec ? spec.blurb : words.description ?? g.label,
      icon: spec?.icon ?? words.icon ?? '🚩',
      xpReward: 30 * age.age,
      check: (c) => !!c.duilt && (c.duilt.age > age.age || (c.duilt.age === age.age && done(c.duilt))),
      progress: (c) => {
        if (!c.duilt) return null;
        if (g.progress) return g.progress(c.duilt);
        if (!g.structure || (g.count ?? 1) <= 1) return null;
        return `${Math.min(c.duilt.structures.countOf(g.structure), g.count)}/${g.count}`;
      },
      /** Whether it's met, in this world, now (for the card). */
      met: (d) => !!d && (d.age > age.age || (d.age === age.age && done(d))),
    };
  }));
}

export const ACHIEVEMENTS = [
  ...requiredGoals(),
  // The secrets (config/secrets.js) last, and in no age: never one of an
  // age's goals, never in its count — a band of their own in the panel.
  ...SECRETS,
];

export const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** The goals of one age, in the order they are meant to be met. */
export function achievementsForAge(age) {
  return ACHIEVEMENTS.filter((a) => a.age === age);
}

/** Every age that has goals, with its name — what the panel draws as bands. */
/** The secrets, for their own band at the bottom of the Goals tab. */
export function secretGoals() {
  return ACHIEVEMENTS.filter((a) => a.secret);
}

export function goalBands() {
  return AGES
    .map(({ age, name }) => ({ age, name, goals: achievementsForAge(age) }))
    .filter((b) => b.goals.length);
}
