// PLAY-11: every item that can be made more than one way.
//
//   node tools/recipe-duplicates.mjs
//
// Prints three Markdown tables from src/config/recipes.js and
// src/config/structures.js:
//   1. every output item made by more than one recipe,
//   2. items made both by hand (hand or workbench) and at a station,
//   3. buildings whose output is also crafted.
// Recipes with no output item (University studies) are counted and left out.
// Reads config only; changes nothing.

import { RECIPES } from '../src/config/recipes.js';
import { STRUCTURES } from '../src/config/structures.js';
import { CROPS } from '../src/config/crops.js';

const HAND = new Set(['hand', 'workbench']);
const DAY = 86400;
const inputs = (r) => Object.entries(r.inputs ?? {}).map(([id, n]) => `${id} ${n}`).join(', ');
const row = (cells) => `| ${cells.join(' | ')} |`;

const byOutput = new Map();
let noOutput = 0;
for (const r of RECIPES) {
  const id = r.output?.id;
  if (!id) { noOutput++; continue; }
  if (!byOutput.has(id)) byOutput.set(id, []);
  byOutput.get(id).push(r);
}
const dupes = [...byOutput].filter(([, rs]) => rs.length > 1);

console.log(`Recipes: ${RECIPES.length}. Output items: ${byOutput.size}. Recipes with no output item (studies): ${noOutput}.`);
console.log(`Items made by more than one recipe: ${dupes.length}.\n`);

console.log('### 1. Items made by more than one recipe\n');
console.log(row(['#', 'item', 'recipe', 'station', 'age', 'inputs', 'out']));
console.log(row(['---', '---', '---', '---', '---', '---', '---']));
dupes.forEach(([id, rs], i) => {
  rs.forEach((r, j) => console.log(row([j ? '' : String(i + 1), j ? '' : `\`${id}\``, `\`${r.id}\``, r.station, String(r.age), inputs(r), String(r.output.count)])));
});

console.log('\n### 2. Items made both by hand (hand or workbench) and at a station\n');
console.log(row(['item', 'by hand', 'at a station']));
console.log(row(['---', '---', '---']));
let both = 0;
for (const [id, rs] of dupes) {
  const hand = rs.filter((r) => HAND.has(r.station));
  const station = rs.filter((r) => !HAND.has(r.station));
  if (!hand.length || !station.length) continue;
  both++;
  const say = (r) => `\`${r.id}\` (${r.station}, age ${r.age}: ${inputs(r)} > ${r.output.count})`;
  console.log(row([`\`${id}\``, hand.map(say).join('; '), station.map(say).join('; ')]));
}
console.log(`\nItems made both ways: ${both}.`);

console.log('\n### 3. Buildings whose output is also crafted\n');
console.log('One row per building and item: the first level, and the top level of its ladder.\n');
console.log(row(['item', 'building', 'first level a day', 'top level', 'top level a day', 'recipes that make it']));
console.log(row(['---', '---', '---', '---', '---', '---']));
let overlaps = 0;
const perDay = (per, every) => (every ? Math.round((per * DAY) / every * 10) / 10 : 0);
for (const s of STRUCTURES) {
  const levels = [{ id: 'first', produces: s.produces ?? {}, everySeconds: s.everySeconds }, ...(s.tiers ?? []).map((t) => ({ id: t.id, produces: t.produces ?? s.produces ?? {}, everySeconds: t.everySeconds ?? s.everySeconds }))];
  const top = levels[levels.length - 1];
  let items = Object.keys(s.produces ?? {});
  if (s.fromCrops) items = CROPS.flatMap((c) => [c.produce, `seeds_${c.kind}`]);
  for (const item of items) {
    const rs = byOutput.get(item);
    if (!rs) continue;
    overlaps++;
    const first = s.fromCrops ? 1 : levels[0].produces[item] ?? 0;
    const last = s.fromCrops ? 1 : top.produces[item] ?? 0;
    console.log(row([`\`${item}\``, s.id, String(perDay(first, levels[0].everySeconds)), levels.length > 1 ? top.id : '(none)', levels.length > 1 ? String(perDay(last, top.everySeconds)) : '', rs.map((r) => `\`${r.id}\` (${r.station})`).join(', ')]));
  }
}
console.log(`\nBuilding outputs that are also crafted: ${overlaps}.`);
