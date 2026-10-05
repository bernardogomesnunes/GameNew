/**
 * Story moments: a few lines, once per world, the first time something
 * happens. Asked for as part of the story work: "small story moments inside
 * each age, not only between ages". The ages have their pictures and the
 * messengers their news; these are the quiet beats in between — the first
 * night, the first stranger who stays, the first ruin.
 *
 * Each is told once per world, as a story card, and kept in the Lore tab
 * under "Your story" so it can be read again. Nothing waits on one: they
 * only ever follow something you've already done.
 */

export const MOMENTS = {
  first_night: {
    title: 'The first night',
    text: 'It gets darker down here than it ever did in the Sky Kingdom — there were always fireflies there. Somewhere above the clouds the island you fell from is lit like a lantern, and nobody up there is looking down.',
  },
  first_hunt: {
    title: 'A harder kind of food',
    text: 'You were raised on bread from the white god\'s fields. This is a harder kind of food, and you had to take it yourself. But it\'s yours.',
  },
  first_settler: {
    title: 'Someone stayed',
    text: 'They saw your smoke from the road and asked if there was room. There was. You are not the only one down here any more.',
  },
  first_temple: {
    title: 'An altar and a light',
    text: 'An altar, a light, and a roof over them. You find yourself praying without having decided to — though to which god, you aren\'t sure yet.',
  },
  first_fireflies: {
    title: 'Green lights in a jar',
    text: 'The hermit says the white god\'s fireflies followed you down when you fell. Holding the jar up to your face, you could almost believe it.',
  },
  first_trader: {
    title: 'A goblin with a ledger',
    text: 'His family has kept a stall at every crossroads since before the kingdoms, he says. He doesn\'t ask where you came from. That is its own kind of kindness.',
  },
  first_fall: {
    title: 'The ground let you go',
    text: 'You wake where you last slept, aching all over. You have fallen further than this before and lived. The ground let you go — this time.',
  },
  // The first time you find each kind of place (once the wall is down).
  found_ruin: {
    title: 'Older than kingdoms',
    text: 'Walls falling into the grass, older than either kingdom. Someone built here to last, and still it fell. You find yourself checking your own walls in your head.',
  },
  found_ruined_temple: {
    title: 'A forgotten altar',
    text: 'Someone prayed here once, to a god whose name has worn off the stone. The offering left on the altar is still there. Nobody came back for it.',
  },
  found_mine: {
    title: 'Picks left where they fell',
    text: 'An old working, its timbers sagging. The miners left their picks where they dropped them, as if they meant to come back after supper.',
  },
  found_monument: {
    title: 'A stone that remembers',
    text: 'A great stone raised for something nobody remembers. Whatever it was, it mattered enough to drag all this here.',
  },
  found_camp: {
    title: 'Bandit fires',
    text: 'Tents, a fire pit, and whatever they took from the road piled up beside it. They\'ve been watching your settlement from here. Now you\'re watching back.',
  },
  found_hermit: {
    title: 'Smoke from a chimney',
    text: 'A little hut with smoke from its chimney, and a garden gone half wild. The hermit who wrote to you all this time lives here.',
  },
  found_kingdom: {
    title: 'The Stone Kingdom',
    text: 'Dark walls and a red tower, and an old road running straight to its gate. From out here it looks patient — like something that has never once had to hurry.',
  },
};

/** The moment for finding a kind of place, if there is one. */
export function momentForPlace(kind) {
  return MOMENTS[`found_${kind}`] ? `found_${kind}` : null;
}
