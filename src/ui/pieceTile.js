import { ITEMS_BY_ID, itemName } from '../config/items.js';
import { itemIcon } from '../config/cubes.js';
import { glyphSvg } from '../config/glyphs.js';
import { escapeHtml } from './html.js';

/**
 * One thing a machine can make, as a tile: the item's 3D picture (the same
 * one the bag and the recipe book use), its name, how many, and what it
 * takes. Owner, 18 November: "I don't like the buttons that we have to
 * select items. They should have the item 3d image we use everywhere."
 *
 * `attrs` is the button's data attributes, already escaped by the caller.
 */
export function pieceTile({ id, count = 1, sub = '', attrs = '', cls = '', pressed = false, disabled = false, title = '' }) {
  const spec = ITEMS_BY_ID.get(id);
  const pic = itemIcon(spec, { size: 40 }) ?? glyphSvg(spec?.glyph, { size: 30, color: spec?.color ?? 0x888888 });
  return `<button class="counter-piece piece-tile${cls ? ` ${cls}` : ''}" ${attrs}${pressed ? ' aria-pressed="true"' : ''}${disabled ? ' disabled' : ''}${title ? ` title="${escapeHtml(title)}"` : ''}>`
    + `<span class="piece-pic" aria-hidden="true">${pic ?? ''}${count > 1 ? `<b>×${count}</b>` : ''}</span>`
    + `<span class="piece-name">${escapeHtml(itemName(id))}</span>`
    + (sub ? `<small>${escapeHtml(sub)}</small>` : '')
    + '</button>';
}
