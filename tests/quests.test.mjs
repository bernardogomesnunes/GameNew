import { readFileSync } from 'node:fs';
import { QUESTS, GIVERS } from '../src/config/quests.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { STRUCTURES, STRUCTURES_BY_ID } from '../src/config/structures.js';
import { MOBS } from '../src/config/mobs.js';
import { FINAL_AGE } from '../src/config/ages.js';
import { Inventory } from '../src/items/Inventory.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

/**
 * Asked for directly: "I'd like to build guided quest. But we need to have
 * attention to details here, and avoid soft blocking the game with this ...
 * make sure no dependence's exist between new advancements."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- every quest can be done at the age it opens -------------------------------------------------

/** The first age an item can be had: made, produced, hunted, or caught. */
const earliest = new Map();
const seen = (id, age) => earliest.set(id, Math.min(earliest.get(id) ?? 99, age));
for (const r of RECIPES) if (r.output?.id) seen(r.output.id, r.age);
for (const s of STRUCTURES) {
  for (const id of Object.keys(s.produces ?? {})) seen(id, s.age);
  for (const t of s.tiers ?? []) for (const id of Object.keys(t.produces ?? {})) seen(id, s.age);
}
for (const m of MOBS) for (const id of Object.keys(m.drops ?? {})) seen(id, 1);
seen('fruit', 1);
seen('fireflies', earliest.get('jar'));                    // caught at night, in a jar
const KEYS = new Set(['id', 'age', 'from', 'title', 'ask', 'needs', 'reward', 'thanks']);

for (const q of QUESTS) {
  const n = q.needs;
  const kinds = Object.keys(n);
  ok(`${q.id}: one thing asked, a giver, words, a reward`, kinds.length === 1 && GIVERS[q.from] && q.ask && q.thanks && q.reward && (q.reward.xp > 0));
  ok(`${q.id}: nothing about another quest — no chains`, Object.keys(q).every((k) => KEYS.has(k)));
  if (n.deliver) {
    for (const [id, c] of Object.entries(n.deliver)) {
      ok(`${q.id}: ${id} is real and can be had by Age ${q.age}`, ITEMS_BY_ID.has(id) && (earliest.get(id) ?? 99) <= q.age && c > 0);
    }
  }
  if (n.claim) ok(`${q.id}: a ${n.claim} can be built by Age ${q.age}`, (STRUCTURES_BY_ID.get(n.claim)?.age ?? 99) <= q.age);
  if (n.find) ok(`${q.id}: only once the wall is down — nothing before then is out of reach`, q.age === FINAL_AGE);
  if (n.trade) ok(`${q.id}: a market can be built by then`, STRUCTURES_BY_ID.get('market').age <= q.age);
  for (const id of Object.keys(q.reward.items ?? {})) ok(`${q.id}: rewards ${id}, a real item`, ITEMS_BY_ID.has(id));
}
ok('a few for every age', [1, 2, 3, 4, 5, 6].every((a) => QUESTS.filter((q) => q.age === a).length >= 2));

// --- nothing waits on a quest ------------------------------------------------------------------
for (const file of ['config/ages.js', 'config/structures.js', 'config/recipes.js', 'config/achievements.js', 'duilt/Crafting.js', 'structures/validate.js']) {
  const src = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  ok(`${file} never asks about a quest`, !/\bquests?\b|QUESTS|questBoard/i.test(src));
}

// --- the board, and handing in -----------------------------------------------------------------
const world = (over = {}) => {
  const d = Object.create(DuiltGame.prototype);
  Object.assign(d, {
    sandbox: false, quests: {}, tally: { hunt: 0, trade: 0, evolve: 0 },
    inventory: new Inventory({ slots: 40 }), structures: { list: () => [] }, found: new Set(), bus: null,
  });
  Object.defineProperty(d, 'age', { value: over.age ?? 1, writable: true });
  return Object.assign(d, over.extra ?? {});
};
const d = world();
const row = (id) => d.questBoard().find((r) => r.quest.id === id);
ok('Age 1 shows Age 1 quests and no later ones', d.questBoard().every((r) => r.quest.age === 1) && d.questBoard().length >= 2);
ok('not ready with nothing done', !row('q_fruit').ready && row('q_fruit').progress[0].have === 0);
let r = d.handInQuest('q_fruit');
ok('and refuses to be handed in early, saying why', !r.ok && /not done/i.test(r.reason));
d.inventory.add('fruit', 6);
ok('ready once the fruit is in the bag', row('q_fruit').ready);
r = d.handInQuest('q_fruit');
ok('handed in: the fruit goes, the seeds come', r.ok && d.inventory.countOf('fruit') === 0 && d.inventory.countOf('seeds_lettuce') === 2 && d.inventory.countOf('seeds_cabbage') === 2);
ok('done, and can\'t be handed in twice', row('q_fruit').done && !d.handInQuest('q_fruit').ok);

// A full bag keeps what it had.
const full = world();
for (let i = 0; i < 40; i++) full.inventory.slots[i] = { id: 'dirt', count: 999 };
full.inventory.slots[0] = { id: 'fruit', count: 7 };  // one left over, so its slot stays full
r = full.handInQuest('q_fruit');
ok('a bag too full for the reward: nothing taken, and it says why', !r.ok && /full/i.test(r.reason) && full.inventory.countOf('fruit') === 7);

// Counts run from when a quest opened.
const later = world({ age: 2 });
later.tally.hunt = 7;
ok('Age 1\'s hunt counts from the start of the world', row.call(null, 'q_hunt') && later.questBoard().find((x) => x.quest.id === 'q_hunt').ready);
const a4 = world({ age: 3 });
a4.tally.trade = 5;
a4.questBoard();
a4.age = 4;
ok('a later age\'s count starts when it opens: earlier trades don\'t count', !a4.questBoard().find((x) => x.quest.id === 'q_trade').ready);
a4.note('trade');
ok('and one more does', a4.questBoard().find((x) => x.quest.id === 'q_trade').ready);

const sand = world({ extra: { sandbox: true } });
ok('no quests in Creative', sand.questBoard().length === 0);

// --- wired in ------------------------------------------------------------------------------------
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('hunting, evolving and trading are counted', /this\.duilt\?\.note\('hunt'\)/.test(game) && /if \(r\.ok\) this\.duilt\.note\('evolve'\)/.test(game)
  && /this\.tally\.trade \+= 1;/.test(readFileSync(new URL('../src/duilt/DuiltGame.js', import.meta.url), 'utf8')));
const eng = readFileSync(new URL('../src/gamification/GamificationEngine.js', import.meta.url), 'utf8');
ok('a quest handed in pays its experience', /this\.bus\.on\('duilt:quest'[\s\S]{0,200}this\.addXp\(quest\.reward\?\.xp/.test(eng));
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
ok('a Quests tab, handed in from there', /data-tab="tab-quests"/.test(ui) && /d\.handInQuest\(b\.dataset\.quest\)/.test(ui));
const dg = readFileSync(new URL('../src/duilt/DuiltGame.js', import.meta.url), 'utf8');
ok('kept with the world', /quests: this\.quests,\s*tally: this\.tally,/.test(dg));

process.exit(f ? 1 : 0);
