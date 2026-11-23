// PLAY-13 chunk 3: toasts on band change, counter dot, Town panel rows, talk lines.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { DuiltUI } from '../src/ui/DuiltUI.js';
import { Inventory } from '../src/items/Inventory.js';
import { World } from '../src/world/World.js';
import { PANELS_BY_ID } from '../src/config/panels.js';
import { SETTLER_TALK, MOOD_TALK, talkLine } from '../src/config/talk.js';

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const src = readFileSync(new URL('../src/ui/DuiltUI.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
const DAY = 900;

function make() {
  const handlers = new Map(), toasts = [];
  const bus = {
    emit: (name, e) => { if (name === 'toast') toasts.push(e); for (const h of handlers.get(name) ?? []) h(e); },
    on: (name, h) => { handlers.set(name, [...(handlers.get(name) ?? []), h]); },
    off() {},
  };
  const d = new DuiltGame({ world: new World({ sizeX: 16, sizeZ: 16, height: 16 }), scene: new THREE.Scene(), bus });
  d.inventory = new Inventory({ slots: 40, bus });
  const els = {};
  const el = (k) => (els[k] ??= { innerHTML: '', textContent: '', hidden: false, dataset: {}, title: '', classList: { toggle() {} }, querySelector: () => null, querySelectorAll: () => [] });
  const opened = [];
  const ui = Object.create(DuiltUI.prototype);
  Object.assign(ui, { bus, game: { duilt: d, ui: { openPanel: (id) => opened.push(id) } }, q: (sel) => el(sel), panels: { isOpen: () => false } });
  ui.renderVitals = () => {};
  ui.wireMood();
  return { d, ui, els, toasts, bus, opened };
}

// Markup and declarations.
ok('panel-town is declared on the Duilt layer', PANELS_BY_ID.get('panel-town')?.layer === 'duilt');
ok('its body has the head line and the list', /id="town-head"/.test(src) && /id="town-list"/.test(src));
ok('the people counter has a dot inside it', /<span class="people-dot" id="people-dot" hidden>/.test(src) && /\.people-dot \{[^}]*position: absolute/.test(css));
ok('Work Hall rows get the mood dot', /class="mood-dot" data-band=/.test(src));
ok('town rows are at least 44 px and buttons too', /\.town-row \{[^}]*min-height: 44px/.test(css) && /\.town-actions button \{ min-height: 44px/.test(css));
ok('band colours match the design', ['#e0b43a', '#e07a2e', '#d23a2a'].every((c) => css.includes(c)));
ok('tapping the counter opens the Town panel when nobody is hungry', /if \(population > 0\) return this\.game\.ui\.openPanel\('panel-town'\)/.test(src));
ok('the food toast gets a See people button', (src.match(/label: 'See people'/g) ?? []).length === 2);

// One toast per band on the way down, with the right button.
{
  const { d, bus, toasts } = make();
  const s = d.settlers;
  s.bus = bus;
  s.people.push({ id: 1, name: 'Bram', hungry: true, x: 0, y: 0, z: 0, homeId: 7, workId: null, target: null, wait: 5, mood: 70, idleFor: 0, furiousFor: 0, band: 'content', said: null, wasHungry: true });
  for (let t = 0; t < 4 * DAY && s.people.length; t += 10) s.moodTick(10);
  const titles = toasts.map((t) => t.title);
  ok(`Grumbling: no toast; Angry: one; Furious: one; left: one (${titles.join(' | ')})`, titles.length === 3
    && /^Bram is angry: no food$/.test(titles[0]) && /^Bram will leave tomorrow$/.test(titles[1]) && /^Bram left: no food$/.test(titles[2]));
  ok('the food toasts carry Give food', toasts[0].action.label === 'Give food' && toasts[1].action.label === 'Give food');
  ok('the leaving toast says how long the house stays empty', /empty for 2 days/.test(toasts[2].body));
}
{
  const { d, bus, toasts, opened } = make();
  const s = d.settlers;
  s.bus = bus;
  s.people.push({ id: 1, name: 'Cira', hungry: false, x: 0, y: 0, z: 0, homeId: 7, workId: null, target: null, wait: 5, mood: 41, idleFor: 4 * DAY, furiousFor: 0, band: 'grumbling', said: null, wasHungry: false });
  for (let t = 0; t < 0.2 * DAY; t += 10) s.moodTick(10);
  ok('no job: Angry toast names days and says what to build', /^Cira is angry: no work for 4 days$/.test(toasts[0]?.title ?? '') && /within 40 blocks/.test(toasts[0].body));
  toasts[0].action.onClick();
  ok('Show opens the Town panel', toasts[0].action.label === 'Show' && opened.join() === 'panel-town');
}

// Town panel rows, worst first.
{
  const { d, ui, els } = make();
  const s = d.settlers;
  const base = { x: 0, y: 0, z: 0, homeId: 7, workId: null, target: null, wait: 5, idleFor: 0, furiousFor: 0, said: null, wasHungry: false };
  s.people.push(
    { ...base, id: 1, name: 'Ana', mood: 92, band: 'content', hungry: false, workId: 4 },
    { ...base, id: 2, name: 'Bram', mood: 12, band: 'furious', hungry: true, furiousFor: 0.4 * DAY },
    { ...base, id: 3, name: 'Cira', mood: 33, band: 'angry', hungry: false, idleFor: 4 * DAY },
  );
  s.hasJob = (p) => p.workId != null;
  ui.renderTown();
  const html = els['#town-list'].innerHTML;
  const order = [...html.matchAll(/town-name">(\w+)</g)].map((m) => m[1]);
  ok(`rows sorted worst first (${order.join(',')})`, order.join() === 'Bram,Cira,Ana');
  ok('hungry row: reason and Give food', /Hungry/.test(html) && html.split('data-town-food').length === 2);
  ok('jobless rows: Find work, and days without a job', html.split('data-town-work').length === 3 && /No job for 4 days/.test(html));
  ok('Furious row: leaves in 0.6 days', /Leaves in 0\.6 days/.test(html));
  ok('header line', els['#town-head'].textContent === 'Town mood 46. 2 angry, 1 leaving.');
  ok('mood bar width follows mood', /width:12%/.test(html) && /width:92%/.test(html));
}

// Counter dot.
{
  const { d, ui, els } = make();
  const s = d.settlers;
  s.people.push({ id: 1, name: 'Ana', mood: 30, band: 'angry', hungry: false, workId: null, idleFor: 4 * DAY });
  const box = { title: '' };
  ui.renderMoodDot(box, s);
  ok('dot shows the worst band', els['#people-dot'].hidden === false && els['#people-dot'].dataset.band === 'angry');
  ok('and the tooltip names the worst case', box.title === 'Ana is angry: no work. Tap to see your people.');
  s.people[0].band = 'content';
  ui.renderMoodDot(box, s);
  ok('all Content: no dot', els['#people-dot'].hidden === true);
}

// Talk lines.
{
  const call = (person, job = null) => talkLine({ who: 'settler', person, job, jobId: null });
  ok('Content villagers talk as before', SETTLER_TALK.jobless.includes(call({ id: 1, band: 'content' })));
  const pools = [['grumbling', false, MOOD_TALK.grumbling.work], ['grumbling', true, MOOD_TALK.grumbling.food],
    ['angry', false, MOOD_TALK.angry.work], ['angry', true, MOOD_TALK.angry.food],
    ['furious', false, MOOD_TALK.leaving.work], ['furious', true, MOOD_TALK.leaving.food]];
  ok('Grumbling, Angry and Furious pick their own pools by reason', pools.every(([band, hungry, pool]) => pool.includes(call({ id: 1, band, hungry }))));
  ok('Angry about work: the design example line exists', MOOD_TALK.angry.work.some((l) => /nothing to do/.test(l)));
}

console.log(f ? `${f} FAILED` : 'ok');
process.exit(f ? 1 : 0);
