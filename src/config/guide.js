import { AGES, FINAL_AGE } from './ages.js';
import { SKILLS } from './skills.js';
import { ACHIEVEMENTS } from './achievements.js';
import { SETTLERS } from './settlers.js';

/**
 * How to play, written down.
 *
 * The old Help panel was a key table and a list of toolbar buttons, which
 * answered "which button is that" and nothing else. It never mentioned
 * claiming a building, ages, settlers, food or half of what the game had grown
 * into, because it was hand-written prose sitting a thousand lines away from
 * the features it described — so every feature shipped and left it a little
 * more wrong.
 *
 * This is the same trick the rest of the project uses: the parts that go stale
 * are not written here at all. The ages come from ages.js, the skills from
 * skills.js, the achievement count from achievements.js, the settler numbers
 * from settlers.js. Add an age and this page grows one. What is left in prose
 * is only the part a config file cannot tell you: why you would want to.
 *
 * How to read a section:
 *
 *   id      what the tab is called in the markup
 *   name    what the tab says
 *   mode    where it applies: 'any', 'duilt' (the settlement game) or 'sandbox'
 *   blocks  a function of { touch } returning what to draw, in order
 *
 * And a block is one of:
 *
 *   lead   a paragraph
 *   keys   a two-column table of what / how
 *   defs   named things with a line each, optionally with an icon
 *   steps  a numbered list
 *   note   one line set apart, for the thing people miss
 */

const s = (n, one, many) => `${n} ${n === 1 ? one : many ?? `${one}s`}`;

export const GUIDE = [
  {
    id: 'guide-idea',
    name: 'The idea',
    mode: 'any',
    blocks: () => [
      {
        kind: 'lead',
        text: 'Duilt is a settlement you build a block at a time. You start with a small square of land, an axe and a bucket. You cut trees, break ground, put up buildings — and when the buildings are standing, the land you are allowed to hold grows, and people come and live in it.',
      },
      {
        kind: 'lead',
        text: 'Nothing chases you and nothing is on a timer you can lose. The only thing standing between you and the end of it is whether you have built the thing the next age asks for.',
      },
      {
        kind: 'defs',
        rows: [
          ['Break and place', 'Everything is made of blocks, including what you pick up. Break a tree and you are holding wood.'],
          ['Claim', 'A pile of blocks is scenery. Draw the selector around it and claim it, and it becomes a building that produces something on its own.'],
          ['Grow', `Each age asks for a few buildings. Raise them and the border moves out. There are ${AGES.length} of them, ending at Age ${FINAL_AGE}.`],
        ],
      },
      {
        kind: 'note',
        text: 'There is also a sandbox world with no rules, no cost and no border, if you would rather just build.',
      },
    ],
  },

  {
    id: 'guide-controls',
    name: 'Controls',
    mode: 'any',
    blocks: ({ touch }) => [
      {
        kind: 'keys',
        rows: [
          ['Look around', touch ? 'Left stick' : 'Move the mouse'],
          ['Move', touch ? 'Right stick' : 'W A S D'],
          ['Break a block', touch ? 'Break button' : 'Left click'],
          ['Keep breaking', touch ? 'Hold Break' : 'Hold left click'],
          ['Place a block', touch ? 'Place button' : 'Right click'],
          ['Jump', touch ? 'Jump button' : 'Space'],
          ['Fly on and off', touch ? 'Fly button' : 'F'],
          ['Up and down while flying', touch ? 'Jump and Down buttons' : 'Space / Shift'],
          ['Everything else', touch ? 'The More button' : 'The toolbar, top right'],
          ['Pick a block', touch ? 'Tap the palette' : 'Keys 1-9, or click the palette'],
          ['Undo / Redo', touch ? 'Undo and Redo buttons' : 'Ctrl+Z / Ctrl+Y'],
          ['Open the menu', touch ? 'Menu button' : 'Esc'],
        ],
      },
      {
        kind: 'note',
        text: 'Hold the break button down and it keeps going — aim at the next block and it breaks that one too, so clearing a wall is one long press rather than fifty.',
      },
      ...(touch ? [{
        kind: 'note',
        text: 'The sticks are the other way round from most games on purpose: this is a game where you stand still and mine, so the steadier hand gets the camera and the busier one gets Break and Place.',
      }] : []),
    ],
  },

  {
    id: 'guide-building',
    name: 'Building',
    mode: 'any',
    blocks: () => [
      {
        kind: 'lead',
        text: 'The selector is a box you aim at the world. Everything that works on more than one block at a time works on whatever is inside it — claiming a building, saving a design, stamping it back down.',
      },
      {
        kind: 'defs',
        rows: [
          ['Select', 'Turns the box on. It snaps to a grid, so two things built with it line up.'],
          ['Size', 'Cycles the box between 2, 4, 8 and 16 blocks a side. Sixteen is one chunk.'],
          ['Designs', 'Saves whatever is in the box under a name, then stamps it anywhere. Press R to turn it before you put it down.'],
          ['Mirror', 'Every block you place is echoed across the middle of the world. Press again for X, Z, both, off.'],
        ],
      },
      {
        kind: 'note',
        text: 'Each building has a starter design already drawn. If you do not want to work out what a kiln looks like, stamp the one that comes with it and claim that.',
      },
    ],
  },

  {
    id: 'guide-settlement',
    name: 'Your land',
    mode: 'duilt',
    blocks: () => [
      {
        kind: 'lead',
        text: 'A building is a claim over blocks you already placed. Put the selector around what you built, pick what it is meant to be, and the game checks it: a farm wants tilled soil and water nearby, a house wants walls and a roof over a room you could actually stand in. It tells you what is missing rather than just refusing.',
      },
      {
        kind: 'steps',
        rows: [
          'Build the thing out of blocks.',
          'Aim the selector at it and open Buildings.',
          'Pick what it is. Anything unmet is listed in plain words.',
          'Claim it. From then on it produces on its own and cannot be broken by accident.',
        ],
      },
      {
        kind: 'defs',
        rows: [
          ['Changing your mind', 'Point at a claimed building and you get three options: change what it is, move it, or take it down. Moving carries the whole thing with you and shows you where it will land.'],
          ['The border', 'You can only build inside your land. Every age pushes it further out, and the blocks that touch the edge are outlined so you can see where it runs.'],
          ['Ages', `${AGES.length} in all. Each one names a few buildings; raise them and the land grows.`],
        ],
      },
      {
        kind: 'defs',
        title: 'The ages',
        rows: AGES.map((a) => [
          `Age ${a.age} · ${a.name}`,
          `${a.size} × ${a.size} blocks. ${a.goals.map((g) => g.label).join(', ')}.`,
        ]),
      },
    ],
  },

  {
    id: 'guide-people',
    name: 'People',
    mode: 'duilt',
    blocks: () => [
      {
        kind: 'lead',
        text: 'Build houses and people move in. One household per house — and the first house is your own, so it is the second one that brings somebody. Lose a settler and the next one turns up to take the empty house.',
      },
      {
        kind: 'defs',
        rows: [
          ['What they do', `Each one walks to a building near their house every morning, and a building with somebody working it produces ${Math.round(SETTLERS.workBonus * 100)}% more than the same building empty.`],
          ['Where you build matters', `They will not walk further than ${SETTLERS.workRange} blocks to work. A quarry on the far side of your land is a quarry nobody staffs.`],
          ['Food', 'They eat what your farms grow, cheapest first. If the bag is empty they go hungry, stay home, and the buildings they staff drop back to what they make on their own. Nobody starves — it costs you production, not people.'],
          ['One at a time', `Somebody new arrives every ${s(SETTLERS.arriveEverySeconds, 'second')} while there is an empty house, so three new houses read as three people arriving.`],
        ],
      },
      {
        kind: 'note',
        text: 'Point at a settler to see who they are. The people count on the screen goes amber when somebody has nothing to eat.',
      },
    ],
  },

  {
    id: 'guide-progress',
    name: 'Getting on',
    mode: 'any',
    blocks: () => [
      {
        kind: 'lead',
        text: 'Skills go up by milestone, never by repetition. You are credited for your first, your tenth and your hundredth of something, and then it flattens — there is no thousand-trees grind anywhere in this.',
      },
      {
        kind: 'defs',
        title: 'The four skills',
        rows: SKILLS.map((k) => [k.name, k.governs, k.icon]),
      },
      {
        kind: 'defs',
        rows: [
          ['Achievements', `${ACHIEVEMENTS.length} of them, for the first time you do most things. They are in Stats, and they hand back experience.`],
          ['Challenges', 'A few small jobs offered each day — build this, gather that. Ignore them and nothing bad happens.'],
          ['Your worlds', 'Everything saves to this browser on its own. Sign in and it goes to the cloud as well, so a cleared browser is not the end of your settlement.'],
        ],
      },
    ],
  },
];

export const GUIDE_BY_ID = new Map(GUIDE.map((g) => [g.id, g]));

/** The sections that apply to the game you are actually in. */
export function guideFor(mode) {
  return GUIDE.filter((g) => g.mode === 'any' || g.mode === mode);
}
