import { readFileSync } from 'node:fs';
import { AGES, RINGS, ageIntro } from '../src/config/ages.js';

/**
 * The ages get new names to fit the story (docs/plan-phase7-lore.md, 7j:
 * "for example 'Exile' … 'Reckoning'"): from being thrown down from the
 * sky to the reckoning with one of the two kingdoms. Each still says what
 * to build, and the last says it differently on the dark path, where no
 * war is coming.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const duilt = readFileSync(new URL('../src/duilt/DuiltGame.js', import.meta.url), 'utf8');

// Twelve now (asked for directly: "we need more ages to divide all this ... age 12").
// Ages 11 and 12 reworked (asked for directly: "Next fix 11 12 goals").
ok('Exile, Roots, Settle, Forge, Hearth, Town, Faith, Bastion, Walls, Reckoning, Conquest, The God',
  AGES.map((a) => a.name).join() === 'Exile,Roots,Settle,Forge,Hearth,Town,Faith,Bastion,Walls,Reckoning,Conquest,The God');
ok('the border rings carry the same names', RINGS.map((r) => r.name).join() === AGES.map((a) => a.name).join());
ok('Exile: thrown down from the sky', /Thrown down from the sky/.test(AGES[0].intro));
ok('Faith: the choice of god comes', /choose your god/.test(AGES[6].intro));
ok('Bastion: the Stone Kingdom has heard of you', /Stone Kingdom/.test(AGES[7].intro));
const keys = ['tree', 'forest', 'quarry', 'workshop', 'market', 'hall', 'shrine', 'mine', 'walls', 'village', 'peoples', 'Sanctuary'];
ok('each still says what to do', AGES.every((a, i) => new RegExp(keys[i]).test(a.intro)));
const R = AGES.find((a) => a.name === 'Reckoning');
ok('the Reckoning on the white path, or with no ring: the Stone Kingdom is coming', ageIntro(R.age, 'white') === R.intro && ageIntro(R.age, null) === R.intro && /ten rounds/.test(R.intro));
ok('on the dark path: no war — take back the sky', ageIntro(R.age, 'black') !== R.intro && /take back the sky/.test(ageIntro(R.age, 'black')) && !/ten rounds/.test(ageIntro(R.age, 'black')));
ok('the other ages read the same on either path', AGES.filter((a) => a !== R).every((a) => ageIntro(a.age, 'black') === ageIntro(a.age, 'white')));
ok('every line fits a phone\'s toast', AGES.every((a) => a.intro.length <= 145 && (a.introDark ?? '').length <= 145));
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
ok('and stays in the Goals list, under its age', /<p class="goal-band-intro">\$\{escapeHtml\(ageIntro\(band\.age, this\.game\.duilt\?\.ring\) \?\? ''\)\}<\/p>/.test(ui));
ok('a new age is announced with the line for your ring', /intro: ageIntro\(next\.age, this\.ring\)/.test(duilt));

process.exit(f ? 1 : 0);
