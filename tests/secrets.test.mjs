import { readFileSync } from 'node:fs';
import { SECRETS } from '../src/config/secrets.js';
import { ACHIEVEMENTS, goalBands, secretGoals } from '../src/config/achievements.js';
import { QUESTS } from '../src/config/quests.js';
import { MOMENTS } from '../src/config/moments.js';
import { MOBS } from '../src/config/mobs.js';
import { TRADERS } from '../src/config/traders.js';
import { Inventory } from '../src/items/Inventory.js';

/** Asked for as part of the story work: "hidden achievements for exploring". */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

ok('a handful of secrets, each with a hint, a reveal and a reward', SECRETS.length >= 6 && SECRETS.every((s) => s.hint && s.description && s.xpReward > 0 && s.secret));
ok('they are achievements, so they unlock and pay like one', SECRETS.every((s) => ACHIEVEMENTS.some((a) => a.id === s.id)));
ok('never one of an age\'s goals, nor in its count', goalBands().every((b) => b.goals.every((g) => !g.secret)) && secretGoals().length === SECRETS.length);

// Each one, from nothing to done, on a stand-in world.
const blank = () => ({
  foundPlaces: () => [], inventory: new Inventory({ slots: 40 }), tradedWith: new Set(), huntedKinds: new Set(), quests: {}, moments: [],
});
const by = (id) => SECRETS.find((s) => s.id === id);
const d = blank();
ok('none are done in a fresh world', SECRETS.every((s) => !s.check({ duilt: d })));
ok('none without a world at all', SECRETS.every((s) => !s.check({ duilt: null })));

const places = ['ruin', 'ruined_temple', 'mine', 'monument', 'camp', 'hermit', 'kingdom'].map((kind) => ({ kind }));
ok('Cartographer: every kind of place found', by('s_cartographer').check({ duilt: { ...blank(), foundPlaces: () => places } }));
ok('Every last stone: four ruins', by('s_every_ruin').check({ duilt: { ...blank(), foundPlaces: () => [1, 2, 3, 4].map(() => ({ kind: 'ruin' })) } })
  && !by('s_every_ruin').check({ duilt: { ...blank(), foundPlaces: () => [{ kind: 'ruin' }] } }));
d.inventory.add('fireflies', 5);
ok('Keeper of lights: five jars at once', by('s_fireflies').check({ duilt: d }));
ok('Every stall: all the traders', by('s_every_stall').check({ duilt: { ...blank(), tradedWith: new Set(TRADERS.map((t) => t.id)) } }));
ok('Know the woods: every animal', by('s_woods').check({ duilt: { ...blank(), huntedKinds: new Set(MOBS.map((m) => m.id)) } }));
ok('Everyone\'s errand: every quest handed in', by('s_errands').check({ duilt: { ...blank(), quests: Object.fromEntries(QUESTS.map((q) => [q.id, { done: true }])) } }));
ok('The whole story: every moment', by('s_whole_story').check({ duilt: { ...blank(), moments: Object.keys(MOMENTS) } }));

const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
ok('a band of their own, hint until found', /secretsHtml\(done\)/.test(ui) && /A secret<\/div><div class="ach-desc">\$\{escapeHtml\(g\.hint\)\}/.test(ui));
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
ok('what they read is kept: the kinds hunted, the places found and told', /note\('hunt', mob\.type\)/.test(game) && /this\.bus\.emit\('duilt:found'/.test(game) && /this\.bus\.emit\('duilt:moment'/.test(game));
const dg = readFileSync(new URL('../src/duilt/DuiltGame.js', import.meta.url), 'utf8');
ok('and saved with the world', /huntedKinds: \[\.\.\.this\.huntedKinds\],\s*tradedWith: \[\.\.\.this\.tradedWith\],/.test(dg));

process.exit(f ? 1 : 0);
