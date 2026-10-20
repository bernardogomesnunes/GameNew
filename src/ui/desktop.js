/**
 * A desktop: a mouse, and room on the screen for two pop-ups side by side.
 * What gets movable pop-ups, the bag beside a storehouse, and dragging
 * things between them (asked for directly: "in desktop we could have pop ups
 * that can move inside the screen, and then I can open my inventory and
 * interact with them"). The same width the two-column store layout starts at
 * (styles.css, `.panel-split`).
 */
export const DESKTOP_QUERY = '(min-width: 900px) and (pointer: fine)';

export function isDesktop() {
  return typeof matchMedia === 'function' && matchMedia(DESKTOP_QUERY).matches;
}
