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

ok('Exile, Roots, Forge, Hearth, Bastion, Reckoning', AGES.map((a) => a.name).join() === 'Exile,Roots,Forge,Hearth,Bastion,Reckoning');
ok('the border rings carry the same names', RINGS.map((r) => r.name).join() === AGES.map((a) => a.name).join());
ok('Exile: thrown down from the sky', /Thrown down from the sky/.test(AGES[0].intro));
ok('Bastion: the Stone Kingdom has heard of you, and the choice of god comes', /Stone Kingdom/.test(AGES[4].intro) && /choose your god/.test(AGES[4].intro));
const keys = ['forest', 'quarry', 'workshop', 'market', 'mine', 'village'];
ok('each still says what to build', AGES.every((a, i) => new RegExp(keys[i]).test(a.intro)));
ok('the Reckoning on the white path, or with no ring: the Stone Kingdom is coming', ageIntro(6, 'white') === AGES[5].intro && ageIntro(6, null) === AGES[5].intro && /ten rounds/.test(AGES[5].intro));
ok('on the dark path: no war — take back the sky', ageIntro(6, 'black') !== AGES[5].intro && /take back the sky/.test(ageIntro(6, 'black')) && !/ten rounds/.test(ageIntro(6, 'black')));
ok('the other ages read the same on either path', [1, 2, 3, 4, 5].every((n) => ageIntro(n, 'black') === ageIntro(n, 'white')));
ok('every line fits a phone\'s toast', AGES.every((a) => a.intro.length <= 145 && (a.introDark ?? '').length <= 145));
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
ok('and stays in the Goals list, under its age', /<p class="goal-band-intro">\$\{escapeHtml\(ageIntro\(band\.age, this\.game\.duilt\?\.ring\) \?\? ''\)\}<\/p>/.test(ui));
ok('a new age is announced with the line for your ring', /intro: ageIntro\(next\.age, this\.ring\)/.test(duilt));

process.exit(f ? 1 : 0);
