// Stroke icons drawn on a 24x24 grid at a single weight, so the HUD reads as
// one instrument panel rather than a pile of emoji.
const PATHS = {
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  select: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  copy: 'M9 9h10v11H9zM5 15H4V4h11v1',
  paste: 'M10 4h4v3h-4zM8 5.5H5V20h14V5.5h-3',
  symmetry: 'M12 3v18M8 8 4 12l4 4M16 8l4 4-4 4',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  stats: 'M5 20v-8M12 20V4M19 20v-5M3 20h18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  mine: 'M12 3 4 7.5v9L12 21l8-4.5v-9zM9 12h6',
  place: 'M12 3 4 7.5v9L12 21l8-4.5v-9zM12 9v6M9 12h6',
  fly: 'M21.5 2.5 2.5 9.8l7.2 3 3 7.2zM9.7 12.8 21.5 2.5',
  up: 'M12 19V6M6 12l6-6 6 6',
  down: 'M12 5v13M6 12l6 6 6-6',
  // Duilt needs its own glyphs: Bag was borrowing the copy icon, which made it
  // identical to the Size button once mobile drops the labels.
  bag: 'M6 8h12l1 12H5L6 8Z M9 8V6a3 3 0 0 1 6 0v2',
  hammer: 'M14 4l6 6-2.5 2.5-6-6L14 4Z M11.5 6.5l-7 7a2 2 0 0 0 0 3l2 2a2 2 0 0 0 3 0l7-7',
  home: 'M4 11 12 4l8 7 M6.5 9.5V20h11V9.5 M10 20v-5.5h4V20',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z',
  help: 'M12 17h.01M9.2 9a2.8 2.8 0 1 1 3.8 2.6c-.7.3-1 .9-1 1.6v.3',
  // Skills: a step up, not the bar chart Stats already uses — side by side in
  // the tray the two were the same picture.
  skills: 'M12 3.5 17 10h-3v4h-4v-4H7l5-6.5ZM6 19h12',

  // Menu sections.
  person: 'M12 11.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2ZM4.8 20.2c0-3.4 3.2-5.4 7.2-5.4s7.2 2 7.2 5.4',
  file: 'M13.5 3.5H6.5v17h11V7.5l-4-4ZM13.5 3.5v4h4',
  chevron: 'M9.5 5.5 16 12l-6.5 6.5',
  sliders: 'M4 8h9M17 8h3M4 16h3M11 16h9M15 5.5v5M8 13.5v5',
};

/** Inline SVG markup for an icon name. */
export function icon(name, size = 20) {
  const d = PATHS[name];
  if (!d) return '';
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}
