import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { RESEARCH, RESEARCH_IDS } from '../src/config/research.js';
import { RECIPES_BY_ID } from '../src/config/recipes.js';

/** PLAY-12 chunk 2: Armoury research (docs/design/play-12.md). */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const make = (age, opts = {}) => {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, age, ...opts });
  for (const id of ['planks', 'stone', 'iron_ingot', 'string', 'feather', 'leather', 'sky_marble', 'dark_stone', 'gold']) g.inventory.add(id, 60);
  return g;
};
const AT = ['armoury', 'armoury@0'];
const offered = (g, age) => g.crafting.available(age, { station: 'armoury', atStations: AT }).filter((r) => r.study).map((r) => r.study);
const learn = (g, id) => {
  const r = g.crafting.craft(`study_${id}`, 1, { atStations: AT });
  if (!r.ok) return r;
  g.days += DuiltGame.researchDays(RECIPES_BY_ID.get(`study_${id}`));
  g.finishResearch();
  return r;
};

// The list.
ok('five pieces, six rows (Sky and Dark Arms are two rows of one piece)', RESEARCH.length === 6 && RESEARCH_IDS.includes('engineering') && RESEARCH_IDS.includes('arms_iron'));
ok('days 2, 2, 3, 3, 4',
  ['arms_iron', 'fletching', 'shield_drill', 'siege_works', 'arms_sky'].map((id) => DuiltGame.researchDays(RECIPES_BY_ID.get(`study_${id}`))).join() === '2,2,3,3,4');
ok('every piece is a study recipe at the armoury', RESEARCH.every((p) => RECIPES_BY_ID.get(`study_${p.id}`)?.station === 'armoury' && RECIPES_BY_ID.get(`study_${p.id}`).study === p.id));

// Ages and what is offered.
{
  const g = make(8);
  ok('Age 8 offers Iron Arms and Fletching only', offered(g, 8).sort().join() === 'arms_iron,fletching');
  ok('Age 9 adds Shield Drill, and not Siege Works before engineering', offered(g, 9).sort().join() === 'arms_iron,fletching,shield_drill');
  g.research.engineering = true;
  ok('Siege Works follows engineering', offered(g, 9).includes('siege_works'));
  ok('Age 9 offers no ring arms', !offered(g, 9).some((id) => id.startsWith('arms_s') || id.startsWith('arms_d')));
  ok('not without standing at an armoury', !g.crafting.craft('study_arms_iron', 1, { atStations: [] }).ok);

  // Pay at start, learn after days.
  const before = g.inventory.countOf('iron_ingot');
  const r = g.crafting.craft('study_arms_iron', 1, { atStations: AT });
  ok('Iron Arms starts, and is paid now', r.ok && r.started && g.inventory.countOf('iron_ingot') === before - 8 && g.armouryStudy?.id === 'study_arms_iron' && !g.research.arms_iron);
  g.days += 1;
  ok('not learnt after one day', !g.finishResearch() && !g.research.arms_iron && g.researchProgress('armoury').ratio === 0.5);
  ok('the armoury does one thing at a time and says so',
    !g.crafting.craft('study_fletching', 1, { atStations: AT }).ok && /armoury is busy with iron arms/i.test(g.crafting.recipeStatus(g.crafting.available(9, { station: 'armoury', atStations: AT }).find((x) => x.id === 'study_fletching'), { atStations: AT }).reason));
  // The University runs at the same time.
  const u = g.crafting.craft('study_foraging_1', 1, { atStations: ['university', 'university@0'] });
  ok('the University and the Armoury run at once', u.ok && g.studying?.id === 'study_foraging_1' && g.armouryStudy?.id === 'study_arms_iron');
  g.days += 1;
  ok('learnt after two days, the slot is free, the University goes on', g.finishResearch()?.id === 'study_arms_iron' && g.research.arms_iron === true && !g.armouryStudy && g.studying);
  ok('a learnt piece is not offered again', !offered(g, 9).includes('arms_iron'));
}

// Rings.
{
  const g = make(10);
  ok('Sky and Dark Arms need a forged ring', !g.crafting.craft('study_arms_sky', 1, { atStations: AT }).ok);
  g.ring = 'white';
  const dark = g.crafting.craft('study_arms_dark', 1, { atStations: AT });
  ok('the other ring\'s arms are closed, with the existing message', !dark.ok && /Black Ring|White Ring.*closed to you/.test(dark.reason) && /closed to you/.test(dark.reason));
  ok('the White Ring\'s arms start', learn(g, 'arms_sky').ok && g.research.arms_sky === true);
  ok('and then both are hidden', !offered(g, 10).includes('arms_sky') && !offered(g, 10).includes('arms_dark'));
}

// Sandbox: at once.
{
  const g = new DuiltGame({ world: new World({ sizeX: 32, sizeZ: 32, height: 32 }), scene: new THREE.Scene(), bus: null, age: 8, sandbox: true });
  // (The sandbox's one-of-each bag cannot pay a batch of 12 planks: a limit the University has too.
  // What the Armoury must do is skip the wait, which startStudy decides.)
  g.startStudy(RECIPES_BY_ID.get('study_fletching'));
  ok('sandbox: done at once, no wait', g.research.fletching === true && !g.armouryStudy);
}

// Save round trip.
{
  const g = make(9);
  learn(g, 'arms_iron');
  g.crafting.craft('study_shield_drill', 1, { atStations: AT });
  g.days += 0.5;
  const back = new DuiltGame({ world: new World({ sizeX: 32, sizeZ: 32, height: 32 }), scene: new THREE.Scene(), bus: null });
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('research and the running study survive a save', back.research.arms_iron === true && back.armouryStudy?.id === 'study_shield_drill' && back.armouryStudy.days === 3 && back.studying === null);

  // Unknown ids dropped.
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  json.research = { engineering: true, arms_iron: true, bogus: true, fletching: 'yes', arms_dark: false };
  json.armouryStudy = { id: 'study_nonsense', name: 'x', started: 0, days: 2 };
  const odd = new DuiltGame({ world: new World({ sizeX: 32, sizeZ: 32, height: 32 }), scene: new THREE.Scene(), bus: null });
  odd.loadJSON(json);
  ok('unknown ids and non-true values are dropped', Object.keys(odd.research).sort().join() === 'arms_iron,engineering' && odd.armouryStudy === null);

  // An old save with only engineering, and no armouryStudy.
  const old = JSON.parse(JSON.stringify(g.toJSON()));
  old.research = { engineering: true };
  delete old.armouryStudy;
  const o = new DuiltGame({ world: new World({ sizeX: 32, sizeZ: 32, height: 32 }), scene: new THREE.Scene(), bus: null });
  o.loadJSON(old);
  ok('an old save with only engineering loads with defaults', o.research.engineering === true && Object.keys(o.research).length === 1 && o.armouryStudy === null);
}

process.exit(f ? 1 : 0);
