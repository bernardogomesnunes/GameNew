import { recipeChain } from '../duilt/recipeChain.js';
import { escapeHtml } from './html.js';

/**
 * CRAFT-9 part 7: the chain line as one small line of text, "Log > Planing
 * Bench > Planks". `here` is the station the player is at; its step is lit.
 * Empty when the item is not made at a station.
 */
export function chainLineHtml(itemId, here = null) {
  const chain = itemId ? recipeChain(itemId) : null;
  if (!chain) return '';
  const parts = chain.steps.map((s) => (s.kind === 'station'
    ? `<span class="chain-station${s.station === here ? ' here' : ''}">${escapeHtml(s.label)}</span>`
    : `<span class="chain-item">${escapeHtml(s.label)}</span>`));
  return `<p class="chain-line" aria-label="Steps: ${escapeHtml(chain.text.replace(/ > /g, ', then '))}">${parts.join('<span class="chain-sep" aria-hidden="true"> &gt; </span>')}</p>`;
}
