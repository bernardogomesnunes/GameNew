import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { TALES, pickTale } from '../src/config/tales.js';
import { WANDERERS } from '../src/config/wanderers.js';

/**
 * The story as people tell it (docs/plan-phase7-lore.md, 7j): "messengers
 * and the hermit carry the story, with lines tied to your age, your Temple
 * and your path."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const base = { age: 1, temple: -1, ring: null, sworn: false, skyFallen: false, war: 'peace', guardian: false };
const at = (o) => ({ ...base, ...o });
const told = (who, s) => { const heard = new Set(); const out = []; for (let t; (t = pickTale(who, s, heard)) && !heard.has(t.id);) { heard.add(t.id); out.push(t.id); } return out; };

// --- the tales ------------------------------------------------------------------------------------

ok('every tale has an id of its own, a teller, a topic and a line', new Set(TALES.map((t) => t.id)).size === TALES.length
  && TALES.every((t) => (t.who === 'messenger' || t.who === 'hermit') && t.learn && typeof t.when === 'function' && t.line.length > 30));
ok('every line fits a phone\'s toast', TALES.every((t) => t.line.length <= 150) || console.log(TALES.filter((t) => t.line.length > 150).map((t) => t.id)));

ok('Age 1: the messengers have no story yet — just news of places', told('messenger', at({})).length === 0);
ok('Age 2: a light in the sky, and the Stone Kingdom on the roads', told('messenger', at({ age: 2 })).join() === 'm_light,m_stone');
ok('Age 3, no temple: two gods, so build one', told('messenger', at({ age: 3 })).includes('m_gods'));
ok('a shrine raised: a god will answer', told('messenger', at({ age: 3, temple: 0 })).includes('m_shrine') && !told('messenger', at({ age: 3, temple: 0 })).includes('m_gods'));
ok('Age 4: the two kings', told('messenger', at({ age: 4 })).includes('m_kings'));
const w = told('messenger', at({ age: 6, temple: 4, ring: 'white', war: 'fighting' }));
const b = told('messenger', at({ age: 6, temple: 4, ring: 'black', war: 'truce' }));
ok('the White Ring: the Stone Kingdom\'s forges, its army on the road', w.includes('m_white') && w.includes('m_war') && !w.includes('m_black'));
ok('the Black Ring: the Stone King waits at his altar', b.includes('m_black') && !b.includes('m_white') && !b.includes('m_war'));
ok('sworn: the Sky Kingdom doubles its guard; your guardian talked of', told('messenger', at({ age: 6, ring: 'black', sworn: true, guardian: true })).join().match(/m_sworn.*m_guardian/));
ok('and after: the rounds won, or the island fallen', told('messenger', at({ age: 6, ring: 'white', war: 'won' })).includes('m_won') && told('messenger', at({ age: 6, ring: 'black', sworn: true, skyFallen: true })).includes('m_fallen'));

const h1 = told('hermit', at({}));
ok('the hermit fell too, long before you — and tells of the two gods', h1[0] === 'h_fell' && h1.includes('h_gods'));
ok('at the temple\'s height, before the ring: choose one, only one', told('hermit', at({ age: 5, temple: 3 })).includes('h_choose'));
ok('the hermit on each ring', told('hermit', at({ ring: 'white' })).includes('h_white') && told('hermit', at({ ring: 'black' })).includes('h_black'));
ok('and on the chains, once you\'re sworn', told('hermit', at({ ring: 'black', sworn: true })).includes('h_chains'));
const heard = new Set(TALES.map((t) => t.id));
ok('all heard: a messenger has nothing new, so it\'s news of a place again', pickTale('messenger', at({ age: 4 }), heard) === null);
const again = [0, 1, 2, 3].map((i) => pickTale('hermit', at({ age: 2 }), heard, i).id);
ok('but the hermit tells it again, in turn', new Set(again).size >= 3);

// --- remembered ----------------------------------------------------------------------------------

{
  const g = new DuiltGame({ world: new World({ sizeX: 32, sizeZ: 32, height: 32 }), scene: new THREE.Scene() });
  ok('where you are in the story', JSON.stringify(g.storyState()) === JSON.stringify({ age: 1, temple: -1, ring: null, sworn: false, skyFallen: false, war: 'peace', guardian: false }));
  const t = g.tale('hermit');
  ok('told, and remembered', t.id === 'h_fell' && g.heard.has('h_fell') && g.tale('hermit').id === 'h_gods');
  const back = new DuiltGame({ world: new World({ sizeX: 32, sizeZ: 32, height: 32 }), scene: new THREE.Scene() });
  back.loadJSON(JSON.parse(JSON.stringify({ ...g.toJSON(), heard: [...g.toJSON().heard, 'no_such_tale'] })));
  ok('what you\'ve heard is saved (and nonsense dropped)', back.heard.has('h_fell') && back.heard.has('h_gods') && back.heard.size === 2);
}

// --- in the game ----------------------------------------------------------------------------------

ok('Place on the hermit: they talk', /if \(this\.hermitTarget\(\)\) return void this\.speakToHermit\(\);/.test(game) && /tap to speak/.test(WANDERERS.hermit.about));
ok('a messenger brings the story half the time, while there\'s more to tell', /body: this\.messengerTale\(\) \?\? line/.test(game) && /if \(!d \|\| d\.sandbox \|\| Math\.random\(\) < 0\.5\) return null;\s*const t = d\.tale\('messenger'\);/.test(game));

process.exit(f ? 1 : 0);
