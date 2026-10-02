/**
 * The story as people tell it (docs/plan-phase7-lore.md, 7j: "messengers
 * and the hermit carry the story, with lines tied to your age, your Temple
 * and your path").
 *
 * Each tale is one line, told by a messenger (now and then, instead of
 * news of a place) or by the hermit (when you speak to them: Place, the
 * same as the Stone King). The hermit fell from the Sky Kingdom too, long
 * before you did, and knows more than anyone else will tell you.
 *
 *   id     what's saved once you've heard it
 *   who    'messenger' or 'hermit'
 *   when   (s) => whether it fits where you are in the story — s is
 *          DuiltGame.storyState(): { age, temple (its level, -1 for none),
 *          ring, sworn, skyFallen, war (its stage), guardian }
 *   learn  what it teaches you, for the lore book
 *   line   what's said
 *
 * Order matters: the first fitting tale you haven't heard is the one told,
 * so the story comes in the order it's written here.
 */

const dark = (s) => s.ring === 'black';
const white = (s) => s.ring === 'white';

export const TALES = [
  // ---- the messengers: what the roads are saying ----
  { id: 'm_light', who: 'messenger', when: (s) => s.age >= 2, learn: 'sky',
    line: 'They say there\'s a light that hangs in the sky, far off where the clouds are thickest — a whole kingdom, floating.' },
  { id: 'm_stone', who: 'messenger', when: (s) => s.age >= 2, learn: 'stone',
    line: 'The Stone Kingdom\'s patrols are on the roads again. They say its army once tried to pull a kingdom down out of the sky.' },
  { id: 'm_gods', who: 'messenger', when: (s) => s.age >= 3 && s.temple < 0, learn: 'gods',
    line: 'Travellers swear there are two gods: a white one with no name, and a dark one with too many. Raise a temple and see which answers.' },
  { id: 'm_shrine', who: 'messenger', when: (s) => s.temple >= 0 && !s.ring, learn: 'gods',
    line: 'Word is you\'ve raised a shrine. The faithful will come — and when it stands high enough, a god will answer.' },
  { id: 'm_kings', who: 'messenger', when: (s) => s.age >= 4, learn: 'kings',
    line: 'At every tavern it\'s the same tale: a Stone King who wants the sky, and a Sky King who won\'t let go of it.' },
  { id: 'm_white', who: 'messenger', when: white, learn: 'white_god',
    line: 'The Stone Kingdom knows you wear the White Ring. Their forges are burning day and night.' },
  { id: 'm_war', who: 'messenger', when: (s) => s.war === 'waiting' || s.war === 'warned' || s.war === 'fighting', learn: 'stone',
    line: 'The Stone army is on the road with rams and catapults. Keep your walls whole and your archers fed.' },
  { id: 'm_won', who: 'messenger', when: (s) => s.war === 'won', learn: 'white_god',
    line: 'The roads are safe at last. They\'re calling you the one who broke the Stone army — and the fireflies have come back.' },
  { id: 'm_black', who: 'messenger', when: (s) => dark(s) && !s.sworn, learn: 'dark_god',
    line: 'The Stone King is waiting for you in his dark temple. Swear at the altar of Nightstone and they say he\'ll give you an army.' },
  { id: 'm_sworn', who: 'messenger', when: (s) => s.sworn && !s.skyFallen, learn: 'towers',
    line: 'Your army is the talk of every road. The Sky Kingdom has doubled the guard on its anchor towers.' },
  { id: 'm_guardian', who: 'messenger', when: (s) => s.guardian, learn: 'guardian',
    line: 'People talk of the beast that walks your land at night — a guardian, sent by your god to keep you.' },
  { id: 'm_fallen', who: 'messenger', when: (s) => s.skyFallen, learn: 'sky',
    line: 'The island hangs quiet now. Its people are waiting to see what kind of lord you\'ll be.' },

  // ---- the hermit: who fell before you did ----
  { id: 'h_fell', who: 'hermit', when: () => true, learn: 'sky',
    line: 'You fell too, didn\'t you? So did I, long before you. The Sky Kingdom never sends anyone down to look for us.' },
  { id: 'h_gods', who: 'hermit', when: () => true, learn: 'gods',
    line: 'Two gods watch this land. The white one has no name — the sky folk never needed one. The dark one has many, and the Stone Kingdom knows them all.' },
  { id: 'h_stone', who: 'hermit', when: (s) => s.age >= 2, learn: 'stone',
    line: 'The Stone Kingdom hauled on the island\'s chains the day I fell, too. It has wanted the sky for longer than I\'ve been alive.' },
  { id: 'h_temple', who: 'hermit', when: (s) => s.age >= 3 && !s.ring, learn: 'gods',
    line: 'Build a temple, and feed it. Sunstone for the white god, Nightstone for the dark — you\'ll find both deep down, if you dig.' },
  { id: 'h_choose', who: 'hermit', when: (s) => s.temple >= 3 && !s.ring, learn: 'gods',
    line: 'Your temple is nearly high enough. Forge one ring — only one. There is no going back from it, whatever they tell you.' },
  { id: 'h_white', who: 'hermit', when: white, learn: 'white_god',
    line: 'The White Ring, on an exile\'s hand. The sky folk would weep to see it. The Stone army will come for it — be ready.' },
  { id: 'h_black', who: 'hermit', when: dark, learn: 'dark_god',
    line: 'The Black Ring. So you do want to go home after all — with an army behind you.' },
  { id: 'h_guardian', who: 'hermit', when: (s) => s.guardian, learn: 'guardian',
    line: 'That beast of yours is the god\'s own. It will keep you as long as your Sanctuary stands.' },
  { id: 'h_chains', who: 'hermit', when: (s) => s.sworn && !s.skyFallen, learn: 'towers',
    line: 'Four chains hold the island up, each from a tower on the ground. Cut them all and even the Sky King would have to come down.' },
  { id: 'h_won', who: 'hermit', when: (s) => s.war === 'won', learn: 'white_god',
    line: 'Ten rounds, and they\'ll not come again in my lifetime. Have you seen the fireflies? He\'s pleased with you.' },
  { id: 'h_fallen', who: 'hermit', when: (s) => s.skyFallen, learn: 'sky',
    line: 'So the sky came down. I never thought I\'d live to see it. I hope it was worth what it cost.' },
];

export const TALES_BY_ID = new Map(TALES.map((t) => [t.id, t]));

/**
 * The tale `who` tells you now: the first that fits and you haven't heard.
 * When you've heard them all, a messenger has none (and brings news of a
 * place instead), while the hermit says again whichever fits, in turn.
 */
export function pickTale(who, state, heard = new Set(), again = 0) {
  const fit = TALES.filter((t) => t.who === who && t.when(state));
  const fresh = fit.find((t) => !heard.has(t.id));
  if (fresh) return fresh;
  if (who !== 'hermit' || !fit.length) return null;
  return fit[again % fit.length];
}
