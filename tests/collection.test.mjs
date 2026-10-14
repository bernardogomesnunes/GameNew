import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { BOOK, BOOK_GROUPS, MILESTONES, Collection, bookGroup } from '../src/duilt/Collection.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { BLOCKS } from '../src/config/blocks.js';
import { TRADERS, CITY_TRADERS } from '../src/config/traders.js';
import { LOOT } from '../src/duilt/Loot.js';
import { STRUCTURES } from '../src/config/structures.js';
import { WANDERERS } from '../src/config/wanderers.js';
import { MOBS } from '../src/config/mobs.js';
import { CROPS } from '../src/config/crops.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { World } from '../src/world/World.js';

/**
 * Asked for directly: "every item can be achievable and if the player
 * collects all of them, we should promptly give him a reward."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');

// --- every item can be had -------------------------------------------------------------------------

const source = new Set(['fireflies']); // caught in a jar at night (Game.catchFireflies)
for (const r of RECIPES) if (r.output?.id) source.add(r.output.id);
for (const b of BLOCKS) { if (b.drops) source.add(b.drops); const it = ITEM_FOR_BLOCK.get(b.id); if (it) source.add(it); }
for (const t of [...TRADERS, ...CITY_TRADERS]) for (const [id] of t.goods) source.add(id);
for (const l of Object.values(LOOT)) for (const [id] of l.items) source.add(id);
for (const s of STRUCTURES) { for (const id of Object.keys(s.produces ?? {})) source.add(id); for (const t of s.tiers ?? []) for (const id of Object.keys(t.produces ?? {})) source.add(id); }
for (const w of Object.values(WANDERERS)) for (const id of Object.keys(w.drops ?? {})) source.add(id);
for (const m of Object.values(MOBS ?? {})) for (const id of Object.keys(m.drops ?? {})) source.add(id);
for (const c of CROPS) { source.add(c.produce); source.add(`seeds_${c.kind}`); }
const orphans = BOOK.filter((i) => !source.has(i.id)).map((i) => i.id);
ok(`every one of the ${BOOK.length} items in the book can be had (${orphans.join(', ') || 'none missing'})`, !orphans.length);
ok('no ring (one closes the other), no upgraded piece, no crown in it', !BOOK.some((i) => i.kind === 'ring' || i.upgrade || i.id === 'collector_crown'));
ok('in groups, every item in one', BOOK_GROUPS.reduce((n, g) => n + bookGroup(g.id).length, 0) === BOOK.length);

// --- ticking it off, and the rewards ---------------------------------------------------------------

{
  const c = new Collection();
  ok('new ones are ticked off once', c.note(['wood', 'wood', 'stone', 'ring_white']).join() === 'wood,stone' && c.note(['wood']).length === 0);
  ok('nothing due at the start', c.due().length === 0);
  const tenth = BOOK.slice(0, Math.ceil(BOOK.length * 0.1)).map((i) => i.id);
  c.note(tenth);
  const due = c.due();
  ok(`a tenth of the book pays ${due[0]?.coins} coins`, due.length === 1 && due[0].coins === MILESTONES[0].coins && c.due().length === 0);
  c.note(BOOK.map((i) => i.id));
  const rest = c.due();
  ok('all of it pays every milestone left, the crown last', rest.length === MILESTONES.length - 1 && rest.at(-1).item === 'collector_crown');
  const back = new Collection();
  back.loadJSON(JSON.parse(JSON.stringify(c.toJSON())));
  ok('kept with the world', back.have.size === BOOK.length && back.paid === MILESTONES.length && back.next() === null);
}

{
  const g = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus: null });
  g.inventory.slots.fill(null);
  g.inventory.grow(400);
  for (const i of BOOK) g.inventory.add(i.id, 1);
  const coins = g.inventory.countOf('coin');
  const res = g.noteCollection();
  const owed = MILESTONES.reduce((n, m) => n + m.coins, 0);
  ok(`everything in the bag: the book fills and pays ${owed} coins at once`, g.collection.progress() === 1 && g.inventory.countOf('coin') - coins >= owed - 1 && res.paid.length === MILESTONES.length);
  ok('and the Collector\'s Crown, worn on the head, as good as a diamond helm, never wearing out', g.inventory.countOf('collector_crown') === 1
    && ITEMS_BY_ID.get('collector_crown').wears === 'head' && ITEMS_BY_ID.get('collector_crown').armour >= 4 && ITEMS_BY_ID.get('collector_crown').durability === Infinity);
  ok('paid once, not again', g.noteCollection().paid.length === 0);
  const sand = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus: null, sandbox: true });
  ok('not in Creative, whose bag holds everything already', sand.noteCollection() === null);
}

ok('a Book tab in the Goals panel, with how far along and what the next share pays', /data-tab="tab-book" id="book-tab">Book</.test(ui) && /renderBook\(\)/.test(ui) && /At \$\{Math\.round\(next\.at \* 100\)\}%: \+\$\{next\.coins\} coins/.test(ui));
ok('tap an item to see what it is and who sells it', /Sold by \$\{escapeHtml\(sold\.join/.test(ui));

process.exit(f ? 1 : 0);
