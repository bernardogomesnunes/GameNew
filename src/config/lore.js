import { TALES_BY_ID } from './tales.js';

/**
 * The lore book (docs/plan-phase7-lore.md, 7j: "a lore book in the Goals
 * panel fills in as you learn: the two gods, the two kingdoms, and your
 * guardian").
 *
 * A page is known once you've learned what it's about — from a tale you
 * were told (each tale has a topic: config/tales.js), from a place you've
 * found, or from what you've done yourself: the temple you raised, the
 * ring you forged, the oath you swore, the guardian that came. Until then
 * it's a locked page with a hint of where to look.
 *
 *   id      the page
 *   title   its heading
 *   icon    a glyph beside it
 *   known   (k) => whether you know it — k is loreKnowledge(d)
 *   hint    where to look, while you don't
 *   text    (k) => what it says, which can depend on your path
 *   replay  'intro' or 'ending': a button to watch that story again
 */

/** Which ending a world has earned: 'yielded', 'dark', 'white', or null. */
export function endingFor(d) {
  if (!d) return null;
  if (d.skyFallen && d.ring === 'black') return d.skyWar?.yielded ? 'yielded' : 'dark';
  if (d.war?.stage === 'won') return 'white';
  return null;
}

/** What you know: the topics of the tales you've heard, the kinds of place you've found, where you are in the story. */
export function loreKnowledge(d) {
  const topics = new Set([...(d?.heard ?? [])].map((id) => TALES_BY_ID.get(id)?.learn).filter(Boolean));
  const found = new Set((d?.foundPlaces?.() ?? []).map((p) => p.kind));
  const state = d?.storyState?.() ?? { age: 1, temple: -1, ring: null, sworn: false, skyFallen: false, war: 'peace', guardian: false };
  const hermit = [...(d?.heard ?? [])].some((id) => TALES_BY_ID.get(id)?.who === 'hermit');
  return { topics, found, state, hermit, ending: endingFor(d) };
}

const learned = (k, topic) => k.topics.has(topic);

export const LORE = [
  {
    id: 'fall', title: 'The fall', icon: '☁', replay: 'intro',
    known: () => true,
    text: () => 'You were born in the Sky Kingdom, and you fell from it — the day the Stone army came to its chains. You woke far from anywhere, with thirty-two blocks of land, an axe and a bucket.',
  },
  {
    id: 'sky', title: 'The Sky Kingdom', icon: '✦',
    known: (k) => learned(k, 'sky') || k.state.ring === 'black',
    hint: 'Messengers talk of a light in the sky. Someone who fell from it might tell you more.',
    text: (k) => (k.state.skyFallen && k.state.ring === 'black'
      ? 'The island you fell from: white halls, gold roofs, fireflies all night. It hangs over land that answers to you now.'
      : 'A floating island of white halls and gold roofs, lit by fireflies all night and held in the sky on four great chains. Its people follow the white god. You were one of them.'),
  },
  {
    id: 'stone', title: 'The Stone Kingdom', icon: '⛰',
    known: (k) => learned(k, 'stone') || k.found.has('kingdom') || k.state.ring === 'black' || k.state.war !== 'peace',
    hint: 'Its patrols are on the roads from Age 2. Listen to the messengers, or find its walls.',
    text: (k) => (k.state.ring === 'black'
      ? 'A walled city of dark stone, and your ally now. Its King gave you an army to take the sky with.'
      : 'A walled city of dark stone that follows the dark god. Its army is why you fell — it has wanted the sky for longer than anyone remembers.'),
  },
  {
    id: 'gods', title: 'The two gods', icon: '☯',
    known: (k) => learned(k, 'gods') || k.state.temple >= 0,
    hint: 'Travellers swear there are two. Raise a temple, or ask the hermit.',
    text: () => 'Two gods watch this land. The white god has no name; the sky folk never needed one. The dark god has many. At a temple\'s height you forge one ring, and with it choose one god — for good.',
  },
  {
    id: 'white_god', title: 'The white god', icon: '○',
    known: (k) => learned(k, 'white_god') || k.state.ring === 'white',
    hint: 'Forge the White Ring to know this god — or hear of one who did.',
    text: (k) => (k.state.ring === 'white'
      ? 'Your god. The White Ring lends you speed and a higher jump; the Stone Kingdom will come for it, round after round.'
      : 'The god of the sky folk, who has no name. The White Ring is his: speed, and a higher jump.'),
  },
  {
    id: 'dark_god', title: 'The dark god', icon: '●',
    known: (k) => learned(k, 'dark_god') || k.state.ring === 'black',
    hint: 'Forge the Black Ring to know this god — or hear of one who did.',
    text: (k) => (k.state.ring === 'black'
      ? 'Your god. The Black Ring sparks at whoever strikes you, and the Stone King calls you his own.'
      : 'The Stone Kingdom\'s god, with more names than anyone can count. The Black Ring is his: a spark that hurts whoever hits you.'),
  },
  {
    id: 'kings', title: 'The two kings', icon: '♛',
    known: (k) => learned(k, 'kings') || k.found.has('kingdom'),
    hint: 'Every tavern tells their tale, from Age 4.',
    text: (k) => (k.ending === 'dark' || k.ending === 'yielded'
      ? 'The Stone King, who wanted the sky, and the Sky King, who wouldn\'t let it go. One of them got what he wanted — with your help.'
      : 'The Stone King, who wants the sky, and the Sky King, who won\'t let it go. Everything in this land turns on the two of them.'),
  },
  {
    id: 'hermit', title: 'The hermit', icon: '⌂',
    known: (k) => k.hermit,
    hint: 'Somebody lives alone in a hut, far from anywhere. Go and talk to them.',
    text: () => 'Another exile, who fell from the sky long before you did. They keep to themself, but they know more than anyone else will tell you.',
  },
  {
    id: 'guardian', title: 'Your guardian', icon: '❖',
    known: (k) => k.state.guardian || learned(k, 'guardian'),
    hint: 'Your god\'s Sanctuary calls a guardian to whoever raises it.',
    text: (k) => (k.state.guardian
      ? `The ${k.state.ring === 'black' ? 'black' : 'white'} guardian, your god's own beast. It keeps you as long as your Sanctuary stands.`
      : 'People talk of a beast that walks some lord\'s land at night — a guardian, sent by a god.'),
  },
  {
    id: 'chains', title: 'The four chains', icon: '⛓',
    known: (k) => learned(k, 'towers') || k.state.sworn,
    hint: 'Only those who mean to take the sky need to know.',
    text: () => 'Four chains hold the Sky Kingdom up, each from an anchor tower on the ground with a lift up its chain. Cut them all, and even the Sky King has to come down.',
  },
  {
    id: 'end', title: 'How it ended', icon: '✧', replay: 'ending',
    known: (k) => !!k.ending,
    hint: 'This page is written at the end of your path.',
    text: (k) => ({
      white: 'Ten times the Stone Kingdom came for you, and ten times it went home with nothing. The white god\'s fireflies drift over the land you held.',
      dark: 'You struck the Sky King down in his own throne room. The Stone King named you Lord of the Sky.',
      yielded: 'You cut the four chains, and the island sank until its King came down and gave it up. The Stone King named you Lord of the Sky.',
    })[k.ending] ?? '',
  },
];
