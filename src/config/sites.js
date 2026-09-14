/**
 * Where generated things go, declared rather than coded.
 *
 * Each entry describes the kind of ground a feature wants and how badly it
 * wants it; `world/siteFinder.js` does the searching. Adding a ruin, an ore
 * seam, a landmark or a second kind of woodland means adding an entry here and
 * a builder in `world/features.js` — no new search loop, no new tuning pass.
 *
 * How to read one:
 *
 *   count      how many to place; a range rolls per world
 *   spacing    how far apart instances of this feature must be
 *   clearOf    other features it must not crowd, by id
 *   needs      hard requirements — fail any and the spot is rejected
 *   prefer     weights for ranking the spots that passed; lower total wins,
 *              so a negative weight means "more of this is better"
 *   facing     'openest' returns a direction to face, for anything with a front
 *   relaxSteps how many times to loosen `needs` before giving up, because a
 *              dense wood may genuinely have nowhere with a long view and
 *              placing nothing is the worse answer
 *   essential  the world is unplayable without it, so it gets placed on the
 *              best ground available even when nothing satisfies the spec
 *
 * Order matters: specs run top to bottom and `clearOf` can only refer to one
 * that has already been placed.
 */

import { SOIL_NAMES } from './blocks.js';

export const SITES = [
  {
    id: 'spawn',
    what: 'Where the player arrives',
    essential: true,   // there is no game without one
    count: 1,
    needs: {
      ground: [...SOIL_NAMES, 'sand'],
      headroom: 3,          // room to stand, and not inside a tree
      flatness: 2,          // the first few steps shouldn't be a scramble
      water: { min: 3, max: 14, ideal: 7 },
      view: 10,             // you must be able to see something on arrival
      viewAt: 2,            // measured at eye height, not ankle height
      viewRange: 16,
    },
    // Openness leads: it is what you see before you touch anything.
    prefer: { view: 3, flat: 4, water: 1 },
    facing: 'openest',
    pitch: -0.16,           // a shallow tilt down; level puts half the screen in sky
    // Well inside your own land, not on the edge of it. Landing a block and a
    // half from the border meant the first building you tried to place was
    // refused for crossing it, with nothing on screen explaining why. Six
    // leaves room to centre the largest starter design on yourself and still
    // finds a spot with a full view in every world tried.
    margin: 6,
    jitter: 6,
    relaxSteps: 3,
  },

  {
    id: 'grove',
    what: 'A stand of trees close enough together to claim as a forest',
    // Age 1 asks you to claim a forest, so a world without one is a world you
    // cannot finish. If nothing suits, the finder puts it on the best ground
    // it can find rather than skipping it.
    essential: true,
    count: 1,
    spacing: 10,
    clearOf: ['spawn'],
    clearOfDistance: 8,     // visible from where you land, not on top of you
    needs: {
      // Any ground a tree roots in. Naming grass and dirt by hand meant that
      // the moment the world grew a forest floor and a river bank, a grove
      // could not be placed on either.
      ground: SOIL_NAMES,
      headroom: 1,
      // Trees do not need a level platform — woodland on a slope is normal and
      // looks better than woodland on a table. Demanding a flat nine by nine
      // meant almost every world had to loosen the spec to place its grove at
      // all, which is the declaration describing ground the generator does not
      // make rather than the generator being at fault.
      flatness: 9,
      reach: 3,             // a grove cares about the lie of the land, not bumps
      footprint: { w: 5, d: 5 },
      footprintStep: 3,
      water: { min: 4, max: 40 },
    },
    prefer: { flat: 4 },
    // Half a grove over the line is a grove you cannot claim, and claiming one
    // is an Age 1 goal.
    margin: 6,
    jitter: 8,
    relaxSteps: 4,
  },

  {
    id: 'boulders',
    what: 'A weathered outcrop — the first stone you can reach without a mine',
    count: { min: 2, max: 4 },
    spacing: 9,
    clearOf: ['spawn', 'grove'],
    clearOfDistance: 6,
    needs: {
      ground: [...SOIL_NAMES, 'sand'],
      headroom: 1,
      // No footprint at all: an outcrop is a lump on the landscape, and asking
      // for a level pad to put it on contradicted the preference for broken
      // ground two lines below.
      flatness: 12,
    },
    // Outcrops belong on broken ground, so rough ground is preferred here —
    // the same weight as the grove uses, with the sign flipped.
    prefer: { flat: -2 },
    margin: 4,
    jitter: 10,
    relaxSteps: 4,
  },

  {
    id: 'berries',
    what: 'A thicket by the water, and a reason to walk to the river early',
    count: { min: 2, max: 3 },
    spacing: 7,
    clearOf: ['spawn'],
    clearOfDistance: 5,
    needs: {
      ground: SOIL_NAMES,
      headroom: 1,
      flatness: 3,
      water: { min: 2, max: 8, ideal: 4 },
    },
    prefer: { water: 2, flat: 1 },
    margin: 4,
    jitter: 6,
    relaxSteps: 4,
  },
];

export const SITES_BY_ID = new Map(SITES.map((s) => [s.id, s]));
