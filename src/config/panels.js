/**
 * Every panel in the game, declared once.
 *
 * A panel used to be spread over five places: the markup, the switch that
 * fills it in, the keyboard shortcut, the button that opens it, and whatever
 * list decided it counted as open. Adding one meant remembering all five, and
 * the parts that were forgotten were exactly the bugs — a panel that would not
 * close on Escape, a shortcut that fired while typing, one that opened a second
 * panel on top of the first.
 *
 * So a panel is an entry here, and the rest is derived. The same shape the
 * blocks, items, recipes and sites already use, for the same reason: the thing
 * you add is smaller than the thing you would have had to get right.
 *
 * How to read one:
 *
 *   id       the element id, which is also what open/close take
 *   title    the heading; titleId when something rewrites it at runtime
 *   sub      the line under it; subId when something rewrites it at runtime
 *   wide     for panels showing a grid rather than a column
 *   layer    which surface draws its body — 'main' or the Duilt overlay
 *   mode     where it exists: 'any', 'duilt', or 'sandbox'
 *   key      the keyboard shortcut, as a KeyboardEvent.code
 *   label    what to call it on a button
 */

export const PANELS = [
  {
    id: 'panel-stats',
    title: 'Progress',
    subId: 'stats-sub',
    layer: 'main',
    mode: 'any',
    label: 'Stats',
  },
  {
    id: 'panel-menu',
    title: 'Menu',
    subId: 'menu-world-kind',
    layer: 'main',
    mode: 'any',
    label: 'Menu',
  },
  {
    id: 'panel-account',
    title: 'Sign in',
    titleId: 'account-title',
    sub: 'Keep your worlds off this device, so they survive a cleared browser.',
    subId: 'account-sub',
    layer: 'main',
    mode: 'any',
    label: 'Account',
  },
  {
    id: 'panel-templates',
    title: 'Designs',
    sub: 'Aim the selector at a build, save it, then stamp it anywhere.',
    layer: 'main',
    mode: 'sandbox',
    label: 'Designs',
  },
  {
    id: 'panel-roof',
    title: 'Roofs',
    sub: 'Frame the top of your walls with the selector, pick a shape, and place it.',
    layer: 'main',
    // Not sandbox-only like Designs: a Duilt house with a hole in the sky is
    // the exact thing this is for, and the blocks come out of your bag.
    mode: 'any',
    label: 'Roof',
  },
  {
    id: 'panel-guide',
    title: 'How to play',
    sub: 'What the game is, what the buttons do, and what to build next.',
    layer: 'main',
    mode: 'any',
    label: 'Guide',
  },
  {
    id: 'panel-score',
    title: 'Session Complete',
    sub: 'A lightweight read on how this build session went — just for you.',
    layer: 'main',
    mode: 'any',
    label: 'Score',
  },

  // ---- Duilt ----

  {
    id: 'panel-bag',
    title: 'Bag',
    sub: 'Tap an item to lift it, tap a slot to put it down. Hold to split a stack.',
    subId: 'bag-sub',
    wide: true,
    layer: 'duilt',
    mode: 'duilt',
    key: 'KeyI',
    label: 'Bag',
  },
  {
    id: 'panel-claim',
    title: 'What is this?',
    sub: "The game will check what you've built and tell you if anything's missing.",
    layer: 'duilt',
    mode: 'duilt',
    key: 'KeyC',
    label: 'Claim',
    // Claiming needs to know what you are aiming at before the panel can say
    // anything, so the shortcut runs the game's own opener rather than just
    // showing the panel.
    prepare: 'claim',
  },
  {
    id: 'panel-buildings',
    title: 'Buildings',
    sub: 'Two ways in: build it yourself and have it checked, or drop a ready-made one.',
    wide: true,
    layer: 'duilt',
    mode: 'duilt',
    key: 'KeyB',
    label: 'Build',
  },
  {
    id: 'panel-bench',
    title: 'Workbench',
    sub: 'Small work you can do anywhere. Bigger work will need a workshop.',
    subId: 'bench-sub',
    wide: true,
    layer: 'duilt',
    mode: 'duilt',
    key: 'KeyE',
    label: 'Bench',
  },
  {
    id: 'panel-building',
    title: 'This building',
    subId: 'building-sub',
    layer: 'duilt',
    mode: 'duilt',
    label: 'Building',
    // No key of its own: pointing at a building and asking "what is this?" is
    // the same question C already answers, so C answers it here too.
  },
  {
    id: 'panel-finish',
    title: 'Finished',
    subId: 'finish-sub',
    layer: 'duilt',
    mode: 'duilt',
    label: 'Finished',
  },
  {
    id: 'panel-skills',
    title: 'Skills',
    sub: 'You get better by doing — and credit lands on milestones, not repetition.',
    layer: 'duilt',
    mode: 'duilt',
    label: 'Skills',
  },
];

export const PANELS_BY_ID = new Map(PANELS.map((p) => [p.id, p]));

/** The panels one surface is responsible for drawing. */
export function panelsOn(layer) {
  return PANELS.filter((p) => p.layer === layer);
}

/** The panel a key opens, if any. One table, so no two can claim the same key. */
export function panelForKey(code) {
  return PANELS.find((p) => p.key === code) ?? null;
}
