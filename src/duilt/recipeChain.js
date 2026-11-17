import { RECIPES, FURNITURE_COST } from '../config/recipes.js';
import { ITEMS_BY_ID, itemName } from '../config/items.js';
import { BLOCKS } from '../config/blocks.js';

/**
 * CRAFT-9 part 7: the chain line. The steps an item goes through, read from
 * the recipe data: "Log > Planing Bench > Planks > Wood Mill > Slab".
 *
 * Nothing is listed by hand. A new station or recipe in config/recipes.js
 * changes the line the moment it exists.
 */

/** Furniture has no recipe row (the Counter charges FURNITURE_COST), so its step is built here. */
const FURNITURE_RECIPES = [...FURNITURE_COST].map(([id, inputs]) => ({ id: `furniture_${id}`, station: 'counter', age: 1, inputs, output: { id, count: 1 } }));

const BY_OUTPUT = new Map();
for (const r of [...RECIPES, ...FURNITURE_RECIPES]) {
  if (r.study || !r.output?.id) continue;
  if (!BY_OUTPUT.has(r.output.id)) BY_OUTPUT.set(r.output.id, []);
  BY_OUTPUT.get(r.output.id).push(r);
}

const MAX_STATIONS = 3;
const GENERAL = new Set(['workbench', 'workshop']);

/** A station's display name: the block that is it, else the item of that id, else its id in words. */
export function stationLabel(station, blocks = BLOCKS, itemsById = ITEMS_BY_ID) {
  const block = blocks.find((b) => b.station === station);
  if (block?.name) return block.name;
  const item = itemsById.get(station);
  if (item?.name) return item.name;
  const words = String(station).replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The recipe that makes `id` at a station: a dedicated machine first, then the workbench or workshop, then the lowest age. */
function producer(index, id) {
  const rank = (r) => (r.station === 'hand' ? 2 : GENERAL.has(r.station) ? 1 : 0);
  const options = (index.get(id) ?? []).filter((r) => r.station !== 'hand');
  return options.sort((a, b) => rank(a) - rank(b) || (a.age ?? 0) - (b.age ?? 0))[0] ?? null;
}

/** From `id` back to its raw material: [{ item, station }] oldest step first, station = how the next item is made. */
function walk(index, id, seen) {
  const r = seen.has(id) ? null : producer(index, id);
  if (!r) return [];
  const next = new Set(seen).add(id);
  let best = [], bestN = -1, main = null;
  for (const [inId, n] of Object.entries(r.inputs ?? {})) {
    if (inId === id || seen.has(inId)) continue;
    const up = walk(index, inId, next);
    // Longest chain wins; a tie goes to the input needed most of.
    if (up.length > best.length || (up.length === best.length && n > bestN)) { best = up; bestN = n; main = inId; }
  }
  return main ? [...best, { item: main, station: r.station }] : [];
}

/**
 * The chain for an item: { steps: [{ kind: 'item'|'station', label, station? }], text }.
 * Null when the item is not made at a station (a raw block, or hand work only).
 * Two steps at one station in a row fold into one, and a long chain keeps its last 3 stations.
 *
 * @param opts.recipes  the recipe list (default: the game's, plus furniture at the Counter)
 * @param opts.itemName / opts.stationName  display names (default: the config's)
 */
export function recipeChain(itemId, opts = {}) {
  let index = BY_OUTPUT;
  if (opts.recipes) {
    index = new Map();
    for (const r of opts.recipes) {
      if (r.study || !r.output?.id) continue;
      if (!index.has(r.output.id)) index.set(r.output.id, []);
      index.get(r.output.id).push(r);
    }
  }
  const nameOf = opts.itemName ?? itemName;
  const stationOf = opts.stationName ?? stationLabel;
  const links = walk(index, itemId, new Set());
  if (!links.length) return null;
  // links[i] = { item: the input of step i, station }; the output of step i is links[i+1].item, the last one is itemId.
  const nodes = links.map((l, i) => ({ from: l.item, station: l.station, to: links[i + 1]?.item ?? itemId }));
  const folded = [];
  for (const n of nodes) {
    const last = folded[folded.length - 1];
    if (last && last.station === n.station) last.to = n.to;
    else folded.push({ ...n });
  }
  const kept = folded.slice(-MAX_STATIONS);
  const steps = [{ kind: 'item', label: nameOf(kept[0].from) }];
  for (const n of kept) steps.push({ kind: 'station', label: stationOf(n.station), station: n.station }, { kind: 'item', label: nameOf(n.to) });
  return { steps, text: steps.map((s) => s.label).join(' > ') };
}
