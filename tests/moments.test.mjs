import { readFileSync } from 'node:fs';
import { MOMENTS, momentForPlace } from '../src/config/moments.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';

/**
 * Asked for as part of the story work: "small story moments inside each age,
 * not only between ages" — told once per world, kept to read again.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

ok('a handful, each with a title and a few lines', Object.keys(MOMENTS).length >= 10 && Object.values(MOMENTS).every((m) => m.title && m.text.length > 60));
ok('one for finding each kind of place', ['ruin', 'ruined_temple', 'mine', 'monument', 'camp', 'hermit', 'kingdom'].every((k) => momentForPlace(k)) && momentForPlace('nowhere') === null);

const d = Object.create(DuiltGame.prototype);
Object.assign(d, { sandbox: false, moments: [] });
ok('told the first time', d.moment('first_night')?.title === MOMENTS.first_night.title);
ok('and never again in that world', d.moment('first_night') === null && d.moments.length === 1);
ok('an unknown one is never told', d.moment('nope') === null);
const sand = Object.assign(Object.create(DuiltGame.prototype), { sandbox: true, moments: [] });
ok('no story in Creative', sand.moment('first_night') === null);

const dg = readFileSync(new URL('../src/duilt/DuiltGame.js', import.meta.url), 'utf8');
ok('kept with the world', /moments: this\.moments,/.test(dg) && /this\.moments = Array\.isArray\(data\.moments\)/.test(dg));
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
for (const id of ['first_night', 'first_hunt', 'first_settler', 'first_temple', 'first_fireflies', 'first_trader', 'first_fall']) {
  ok(`${id} is told when it happens`, game.includes(`'${id}'`));
}
ok('places found tell theirs', /const m = momentForPlace\(lm\.kind\);\s*if \(m\) this\.tellMoment\(m\);/.test(game));
ok('as a story card that stays long enough to read', /kind: 'story', title: m\.title, body: m\.text, duration: 9000/.test(game));
const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
ok('and kept in the Lore tab, under Your story', /Your story/.test(ui) && /\(d\.moments \?\? \[\]\)\.map\(\(id\) => MOMENTS\[id\]\)/.test(ui));

process.exit(f ? 1 : 0);
