import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { LORE, loreKnowledge, endingFor } from '../src/config/lore.js';
import { endingFor as storyEnding } from '../src/ui/Story.js';

/**
 * The lore book (docs/plan-phase7-lore.md, 7j): "a lore book in the Goals
 * panel fills in as you learn: the two gods, the two kingdoms, and your
 * guardian."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
const fresh = () => new DuiltGame({ world: new World({ sizeX: 32, sizeZ: 32, height: 32 }), scene: new THREE.Scene() });
const pages = (d) => { const k = loreKnowledge(d); return LORE.filter((p) => p.known(k)).map((p) => p.id); };

ok('the gods, the kingdoms, the guardian — and more', ['gods', 'white_god', 'dark_god', 'sky', 'stone', 'guardian', 'kings', 'hermit', 'chains', 'end'].every((id) => LORE.some((p) => p.id === id)));
ok('every locked page says where to look', LORE.every((p) => p.id === 'fall' || p.hint?.length > 20));

{
  const d = fresh();
  ok('a new world: only your fall', pages(d).join() === 'fall');
  d.tale('hermit');
  ok('the hermit\'s first words: the Sky Kingdom, and the hermit', pages(d).includes('sky') && pages(d).includes('hermit'));
  d.tale('hermit');
  ok('then the two gods', pages(d).includes('gods'));
  d.heard.add('m_stone');
  ok('a messenger on the Stone Kingdom\'s patrols', pages(d).includes('stone'));
  d.ring = 'black';
  ok('the Black Ring: the dark god, and you know where the Sky Kingdom is', pages(d).includes('dark_god') && !pages(d).includes('white_god'));
  const k = loreKnowledge(d);
  ok('pages read differently on the dark path', /your ally/.test(LORE.find((p) => p.id === 'stone').text(k)) && /Your god/.test(LORE.find((p) => p.id === 'dark_god').text(k)));
  d.army.swear(0);
  ok('sworn: the four chains', pages(d).includes('chains'));
  d.skyFallen = true;
  ok('the end: its page, and the Sky Kingdom\'s page knows it\'s yours', pages(d).includes('end') && /answers to you/.test(LORE.find((p) => p.id === 'sky').text(loreKnowledge(d))));
  ok('and the ending is told the same everywhere', endingFor(d) === 'dark' && storyEnding(d) === 'dark');
}
{
  const d = fresh();
  d.ring = 'white';
  d.war.stage = 'won';
  const k = loreKnowledge(d);
  ok('the white path: the white god, the Stone Kingdom (at war with you), its own ending', pages(d).includes('white_god') && pages(d).includes('stone') && /fireflies/.test(LORE.find((p) => p.id === 'end').text(k)));
}
ok('every page has words, before the end (whose page waits for it)', LORE.filter((p) => p.id !== 'end').every((p) => p.text(loreKnowledge(fresh())).length > 20));

ok('a Lore tab in the Goals panel', /data-tab="tab-lore" id="lore-tab">Lore<\/button>/.test(ui) && /id="tab-lore" hidden><div id="lore-list">/.test(ui));
ok('only in Duilt — Creative has no story', /tab\.hidden = !d \|\| d\.sandbox;/.test(ui));
ok('known pages, and locked ones with where to look', /\$\{known\.length\} of \$\{LORE\.length\} pages/.test(ui) && /escapeHtml\(page\.hint \?\? ''\)/.test(ui));
ok('the opening and the ending, to watch again', /Watch the opening again/.test(ui) && /Watch the ending again/.test(ui) && /b\.dataset\.replay === 'intro' \? INTRO : ENDINGS\[k\.ending\]/.test(ui));

process.exit(f ? 1 : 0);
