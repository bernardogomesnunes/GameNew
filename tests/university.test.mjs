import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { World } from '../src/world/World.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { STRUCTURES_BY_ID } from '../src/config/structures.js';
import { RECIPES } from '../src/config/recipes.js';
import { PANELS } from '../src/config/panels.js';

/**
 * Backlog batch 2: "the university and your stats — bring the skills back
 * (foraging and the rest seem to have disappeared from view), university
 * research raises them, and research also unlocks the engineering centre."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const ui = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');

// --- in view again ----------------------------------------------------------------------

ok('your skills are at the top of the bag, each with its level', /<button class="bag-skills" id="bag-skills" hidden><\/button>/.test(ui) && /renderBagSkills\(\) \{/.test(ui) && /this\.renderBagSkills\(\);/.test(ui));
ok('tapping them opens the whole of each', /row\.addEventListener\('click', \(\) => this\.openPanel\('panel-skills'\)\)/.test(ui));
ok('and on a computer, K opens them', PANELS.find((p) => p.id === 'panel-skills').key === 'KeyK');

// --- the buildings ----------------------------------------------------------------------

const uni = STRUCTURES_BY_ID.get('university'), eng = STRUCTURES_BY_ID.get('engineering');
ok('a University, from Age 2, is a station: desks under a roof', uni.age === 2 && uni.station === 'university' && uni.requires.some((r) => r.id === 'desks'));
ok('an Engineering Centre, from Age 2, needs engineering studied first', eng.age === 2 && eng.station === 'engineering' && eng.research === 'engineering');

// --- studying -------------------------------------------------------------------------------

{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus: null, age: 2 });
  const atUni = ['university', 'university@0'];
  const studies = () => g.crafting.available(2, { station: null, atStations: atUni }).filter((r) => r.study);
  ok('one study a skill on offer — the next level — and engineering', studies().length === 5
    && studies().filter((r) => r.study !== 'engineering').every((r) => r.level === 1));
  ok('not without standing at a university', !g.crafting.craft('study_foraging_1', 1, { atStations: [] }).ok);

  g.inventory.add('planks', 100); g.inventory.add('stone', 100);
  const r = g.crafting.craft('study_foraging_1', 1, { atStations: atUni });
  ok('studying raises the skill a level', r.ok && r.studied === 'foraging' && g.skills.levelOf('foraging') === 1);
  ok('and takes what it costs', g.inventory.countOf('planks') === 97 && g.inventory.countOf('stone') === 98);
  ok('and gives no item', !g.inventory.slots.some((s) => s?.id == null && s));
  ok('then the next level is what is offered', studies().find((x) => x.study === 'foraging').level === 2);
  ok('the next costs more', RECIPES.find((x) => x.id === 'study_foraging_2').inputs.planks > RECIPES.find((x) => x.id === 'study_foraging_1').inputs.planks);
  ok('the higher levels want gold', RECIPES.find((x) => x.id === 'study_politics_6').inputs.gold === 2 && !RECIPES.find((x) => x.id === 'study_politics_4').inputs.gold);
  ok('one level at a time, however much you have', g.crafting.craft('study_foraging_2', 5, { atStations: atUni }).ok && g.skills.levelOf('foraging') === 2);

  // Engineering, and the centre.
  const region = { minX: 2, maxX: 8, minY: 1, maxY: 4, minZ: 2, maxZ: 8 };
  const offer = () => g.claimOptionsFor(region).find((o) => o.id === 'engineering');
  ok('before engineering, the Engineering Centre is refused, and says why', offer() && !offer().ok && /Study engineering at a university/.test(offer().reason));
  ok('researching engineering', g.crafting.craft('study_engineering', 1, { atStations: atUni }).ok && g.research.engineering === true);
  ok('is done once — then it\'s off the list', !studies().some((x) => x.study === 'engineering'));
  ok('and the centre is no longer refused for it', !/Study engineering/.test(offer().reason ?? ''));
  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('what you studied is saved', back.research.engineering === true && back.skills.levelOf('foraging') === 2);
}

ok('the bench shows what studying gives, not an item', /const result = r\.study\s*\? `<span class="recipe-result">\$\{escapeHtml\(r\.result\)\}<\/span>`/.test(ui) && /Studied: \$\{res\.name\}/.test(ui));

process.exit(f ? 1 : 0);
