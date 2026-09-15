/**
 * The in-game menu, as a set of places rather than one long scroll.
 *
 * It had grown into a single column holding a name field, three graphics
 * controls, three file buttons and three actions, all stacked with nothing
 * between them but a label. On a phone that is a page you scroll through
 * looking for the thing you came for — and the one thing people came for most
 * often, their achievements, was not in it at all: it had its own button
 * taking up space on a screen that has very little to spare.
 *
 * So the menu is an index. Cards, one per thing you might have come to do,
 * and tapping one takes you there. Some open in place because they are small
 * (the world's name, the graphics, the files); the two that already have a
 * panel of their own open that, because one achievements screen is enough.
 *
 * How to read one:
 *
 *   id     what the section's element is called
 *   name   the card's heading
 *   icon   from ui/icons.js
 *   blurb  one line saying what is in there, so the card is a signpost
 *   opens  an existing panel id, for sections that already have somewhere
 *          to live. Without it, the section renders inside the menu.
 *   needs  'cloud' — only shown when cloud sync is configured for this build
 *   dev    a workshop tool rather than something a player came here to do.
 *          Folded away behind one switch, so the menu is the four things
 *          somebody actually opens it for and these stay one tap from hand.
 */

export const MENU = [
  {
    id: 'menu-world',
    name: 'World details',
    icon: 'home',
    blurb: 'What this world is called.',
  },
  {
    id: 'menu-graphics',
    dev: true,
    name: 'Graphics',
    icon: 'sliders',
    blurb: 'Resolution, view distance and smooth edges — turn these down if it stutters.',
  },
  {
    id: 'menu-files',
    dev: true,
    name: 'Files',
    icon: 'file',
    blurb: 'Export this world or a .vox model, or import a world from a file.',
  },
  {
    id: 'menu-achievements',
    name: 'Achievements',
    icon: 'stats',
    blurb: 'Your level, what you have unlocked, and today’s challenges.',
    opens: 'panel-stats',
  },
  {
    id: 'menu-profile',
    name: 'Profile',
    icon: 'person',
    blurb: 'Your account, and the worlds kept on it.',
    opens: 'panel-account',
    needs: 'cloud',
  },
];

export const MENU_BY_ID = new Map(MENU.map((m) => [m.id, m]));

/**
 * The sections this build offers.
 *
 * `dev` ones are out unless asked for. They are the workshop end of the menu —
 * the render settings and the file import — and they were sitting in front of
 * the things a player opens the menu to do.
 */
export function menuFor({ cloud = false, dev = false } = {}) {
  return MENU.filter((m) => (m.needs !== 'cloud' || cloud) && (!m.dev || dev));
}

/** Whether anything is hidden behind the switch at all. */
export const HAS_DEV_SECTIONS = MENU.some((m) => m.dev);

/** Sections that render inside the menu rather than opening a panel. */
export function inlineSections() {
  return MENU.filter((m) => !m.opens);
}
