import { icon } from './icons.js';
import { PANELS_BY_ID, panelsOn } from '../config/panels.js';

/**
 * The chrome every panel wears.
 *
 * Eleven panels each wrote out their own overlay, card, heading, subtitle and
 * close button. They had already drifted: some closed with a drawn icon, some
 * with a literal ✕, and the close button on a new one was a thing you had to
 * remember to add at all. None of that is a decision any individual panel
 * should be making, so none of them make it now — they supply a body and the
 * shell comes with it.
 */

export function panelMarkup(def, body = '') {
  const title = def.titleId ? `<h2 id="${def.titleId}">${def.title}</h2>` : `<h2>${def.title}</h2>`;
  const subAttr = def.subId ? ` id="${def.subId}"` : '';
  const sub = def.sub || def.subId ? `<div class="sub"${subAttr}>${def.sub ?? ''}</div>` : '';
  return `
      <div class="overlay" id="${def.id}" hidden>
        <div class="panel${def.wide ? ' panel-wide' : ''}">
          <button class="icon-btn panel-close" data-close="${def.id}" aria-label="Close">${icon('close', 16)}</button>
          ${title}
          ${sub}
          ${body}
        </div>
      </div>`;
}

/**
 * Renders every panel belonging to one surface.
 *
 * @param layer  'main' or 'duilt'
 * @param bodies { [panelId]: markup } — what goes inside each card
 *
 * A declared panel with no body still renders, as an empty card rather than
 * nothing at all: a panel that silently fails to exist is the bug that started
 * this, and an empty card is at least visible from the outside.
 */
export function renderPanels(layer, bodies = {}) {
  return panelsOn(layer).map((def) => panelMarkup(def, bodies[def.id] ?? '')).join('\n');
}

/** The declaration, for anything that needs to ask about a panel it has an id for. */
export function panelDef(id) {
  return PANELS_BY_ID.get(id) ?? null;
}
