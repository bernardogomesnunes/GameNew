import { readFileSync, existsSync } from 'node:fs';
import {
  SHOWCASE_SEED, SHOWCASE_TIMES, SHOWCASE_SPOTS, SHOWCASE_SPOTS_BY_ID, SHOWCASE_BUILDINGS, SHOWCASE_FIGURES,
  SHOWCASE_BOUNDS, findShowcaseSite, flattenShowcase, showcaseRegion, placeBlocks, showcaseLabels, spotPose,
  clearSight, forestNear,
} from '../src/world/showcase.js';
import { STARTER_DESIGNS } from '../src/config/starterDesigns.js';
import { STRUCTURES } from '../src/config/structures.js';
import { MOBS } from '../src/config/mobs.js';
import { WANDERERS } from '../src/config/wanderers.js';
import { landmarkDesigns } from '../src/world/landmarks.js';
import { generateEndlessWorld } from '../src/world/StarterWorld.js';
import { Mobs } from '../src/world/Mobs.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { MENU_BY_ID, menuFor } from '../src/config/menu.js';
import { daylightAt } from '../src/render/DayCycle.js';

/**
 * The showcase (docs/plan-look-and-sound.md, section 1): "a Creative test
 * world laid out for looking at — the Stone Kingdom; the Sky city; every
 * building template in rows; every animal and kind of person standing in a
 * line. Fixed camera spots, shot at phone size by day, at dusk and at night."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const game = read('../src/Game.js');
const ui = read('../src/ui/UIManager.js');
const mobsSrc = read('../src/world/Mobs.js');
const wanderSrc = read('../src/world/Wanderers.js');
const plan = read('../docs/plan-look-and-sound.md');

// --- what's in it ------------------------------------------------------------------------------

const built = new Set(SHOWCASE_BUILDINGS.map((b) => b.id));
ok(`every starter design is in the rows (${STARTER_DESIGNS.length})`, STARTER_DESIGNS.every((d) => built.has(d.id)));
ok('so every kind of building is', STRUCTURES.every((s) => SHOWCASE_BUILDINGS.some((b) => b.structure === s.id)));
ok('and one of every place out in the world', landmarkDesigns().every((p) => built.has(`place_${p.kind}`)));
ok('each has a name for its label', SHOWCASE_BUILDINGS.every((b) => b.name && b.name.length > 2));

const figures = SHOWCASE_FIGURES.flatMap((g) => g.figures);
ok(`every animal stands in the yard (${MOBS.length})`, MOBS.every((m) => figures.some((x) => x.kind === 'mob' && x.type === m.id)));
const people = new Set(figures.filter((x) => x.kind === 'wanderer').flatMap((x) => [x.type, x.rider]));
ok(`and every kind of person out in the world (${Object.keys(WANDERERS).length})`, Object.keys(WANDERERS).every((k) => people.has(k)));
ok('hermit, guards, both Kings, bandits, soldiers, sky and royal guards among them',
  ['hermit', 'guard', 'king', 'sky_king', 'bandit', 'soldier', 'archer', 'sky_guard', 'royal_guard', 'warlord'].every((k) => people.has(k)));
ok('the Warlord rides his beast', figures.some((x) => x.type === 'warbeast' && x.rider === 'warlord'));
ok('your settlers, in different coats', new Set(figures.filter((x) => x.kind === 'settler').map((x) => x.n)).size >= 3);
ok('your soldier and your archer', ['soldier', 'archer'].every((t) => figures.some((x) => x.kind === 'defender' && x.type === t)));
ok('a warrior of your army', figures.some((x) => x.kind === 'warrior'));
ok('and both guardians', ['white', 'black'].every((t) => figures.some((x) => x.kind === 'guardian' && x.type === t)));
ok('a picture never has more than four in it, so each is big enough to judge', SHOWCASE_FIGURES.every((g) => g.figures.length <= 4));

// --- laid out for looking at -------------------------------------------------------------------

const boxes = SHOWCASE_BUILDINGS.map((b) => ({ id: b.id, minX: b.centre.x - b.w / 2, maxX: b.centre.x + b.w / 2, minZ: b.centre.z - b.d / 2, maxZ: b.centre.z + b.d / 2 }));
const inside = (p, b, pad = 0) => p[0] > b.minX - pad && p[0] < b.maxX + pad && p[2] > b.minZ - pad && p[2] < b.maxZ + pad;
ok('every building is stamped on whole blocks', SHOWCASE_BUILDINGS.every((b) => Number.isInteger(b.anchor.x) && Number.isInteger(b.anchor.z)));
ok('no two buildings overlap, and there is ground between them',
  boxes.every((a, i) => boxes.every((b, j) => i === j || a.maxX + 2 <= b.minX || b.maxX + 2 <= a.minX || a.maxZ + 2 <= b.minZ || b.maxZ + 2 <= a.minZ)));
ok('every building\'s camera stands in front of it (north, where its door is)', SHOWCASE_BUILDINGS.every((b) => b.eye[2] < b.centre.z - b.d / 2));
ok('and inside no building', SHOWCASE_BUILDINGS.every((b) => boxes.every((x) => !inside(b.eye, x, 0.5))));
ok('nor does anything stand between a camera and its building', SHOWCASE_BUILDINGS.every((b) => boxes.every((x) => {
  if (x.id === b.id) return true;
  for (let t = 0.05; t < 0.85; t += 0.05) {
    const p = [b.eye[0] + (b.look[0] - b.eye[0]) * t, 0, b.eye[2] + (b.look[2] - b.eye[2]) * t];
    if (inside(p, x)) return false;
  }
  return true;
})));
ok('the figures stand clear of the buildings', figures.every((x) => boxes.every((b) => !inside([x.x, 0, x.z], b, 3))));
ok('every figure turns to its camera', SHOWCASE_FIGURES.every((g) => g.figures.every((x) => {
  const want = Math.atan2(g.eye[0] - x.x, g.eye[2] - x.z);
  return Math.abs(Math.atan2(Math.sin(x.facing - want), Math.cos(x.facing - want))) < 0.8;
})));
ok('everything is on the flattened ground', SHOWCASE_BUILDINGS.every((b) => b.eye[0] > SHOWCASE_BOUNDS.minX && b.eye[0] < SHOWCASE_BOUNDS.maxX && b.eye[2] > SHOWCASE_BOUNDS.minZ && b.eye[2] < SHOWCASE_BOUNDS.maxZ)
  && figures.every((x) => x.x > SHOWCASE_BOUNDS.minX && x.x < SHOWCASE_BOUNDS.maxX && x.z > SHOWCASE_BOUNDS.minZ && x.z < SHOWCASE_BOUNDS.maxZ));

// --- the camera spots --------------------------------------------------------------------------

ok(`${SHOWCASE_SPOTS.length} spots, every id different`, SHOWCASE_SPOTS_BY_ID.size === SHOWCASE_SPOTS.length);
ok('each named, grouped and placeable', SHOWCASE_SPOTS.every((s) => s.name && ['main', 'buildings'].includes(s.group) && typeof s.resolve === 'function'));
for (const id of ['overview', 'row-1', 'animals-1', 'people-settlers', 'people-stone', 'people-sky', 'guardians',
  'kingdom-gate', 'kingdom-street', 'kingdom-keep', 'kingdom-air', 'sky-gate', 'sky-palace', 'sky-below', 'forest']) {
  ok(`  the '${id}' spot`, SHOWCASE_SPOTS_BY_ID.get(id)?.group === 'main');
}
ok('a row spot for every row', new Set(SHOWCASE_BUILDINGS.map((b) => b.row)).size === SHOWCASE_SPOTS.filter((s) => s.id.startsWith('row-')).length);
ok('a close spot for every building', SHOWCASE_BUILDINGS.every((b) => SHOWCASE_SPOTS_BY_ID.get(`b-${b.id}`)?.group === 'buildings'));
ok('and one for every group of figures', SHOWCASE_FIGURES.every((g) => SHOWCASE_SPOTS_BY_ID.has(g.id)));

ok('day, dusk and night', Object.keys(SHOWCASE_TIMES).join() === 'day,dusk,night');
ok('  day is daylight', daylightAt(SHOWCASE_TIMES.day).day > 0.95);
ok('  dusk is the golden hour', daylightAt(SHOWCASE_TIMES.dusk).dusk > 0.6);
ok('  night is dark', daylightAt(SHOWCASE_TIMES.night).day < 0.05);

// --- in the world --------------------------------------------------------------------------------

const { world } = generateEndlessWorld({ height: 200, seed: SHOWCASE_SEED });
const gen = world.gen;
gen.sky = true;
const site = findShowcaseSite(gen);
ok('the showcase seed has somewhere to put it', !!site && Number.isInteger(site.x) && Number.isInteger(site.y) && Number.isInteger(site.z));
ok('the same place every time', JSON.stringify(site) === JSON.stringify(findShowcaseSite(generateEndlessWorld({ height: 200, seed: SHOWCASE_SEED }).world.gen)));
flattenShowcase(world, site);
{
  const r = showcaseRegion(site);
  let flat = true;
  for (let x = r.minX; x <= r.maxX && flat; x += 7) {
    for (let z = r.minZ; z <= r.maxZ && flat; z += 7) {
      if (world.getBlock(x, site.y - 1, z) !== 1) flat = false;
      for (let y = site.y; y < site.y + 12; y++) if (world.getBlock(x, y, z)) flat = false;
    }
  }
  ok('the ground under it is flat grass with open sky over it', flat);
  ok('  and the chunks it changed are kept while you\'re away', world.getChunk(r.minX >> 4, r.minZ >> 4).touched);
}
ok('the places are laid on its floor', placeBlocks(site).length > 500 && placeBlocks(site).every(([, y]) => y >= site.y - 14 && y < site.y + 20));
ok('a label for every building and every figure', showcaseLabels(site).length === SHOWCASE_BUILDINGS.length + figures.length);

for (const s of SHOWCASE_SPOTS.filter((x) => x.group === 'main')) {
  const p = spotPose(s, { site, gen });
  ok(`  '${s.id}' resolves to a place to stand`, p && [p.eye.x, p.eye.y, p.eye.z, p.yaw, p.pitch].every(Number.isFinite) && Math.abs(p.pitch) < 1.2);
}
{
  const p = spotPose(SHOWCASE_SPOTS_BY_ID.get('overview'), { site, gen });
  const toward = { x: site.x + (SHOWCASE_BOUNDS.minX + SHOWCASE_BOUNDS.maxX) / 2, z: site.z + (SHOWCASE_BOUNDS.minZ + SHOWCASE_BOUNDS.maxZ) / 2 };
  ok('a spot looks the way PlayerController reads yaw (0 is north, -z)', Math.abs(Math.atan2(-(toward.x - p.eye.x), -(toward.z - p.eye.z)) - p.yaw) < 1e-6 && p.pitch < 0);
}
ok('the forest spot finds forest', !!forestNear(gen, site));
{
  // Out in the wild the eye is moved out of the trees: from inside a block of leaves, it rises clear.
  const at = { x: site.x + 0.5, y: site.y + 2, z: site.z + SHOWCASE_BOUNDS.minZ + 2.5 };
  for (let y = at.y - 1; y < at.y + 4; y++) world.setBlock(Math.floor(at.x), y, Math.floor(at.z), 5);
  const moved = clearSight(world, at, { x: at.x, y: at.y, z: at.z + 20 });
  ok('a spot in a tree climbs out of it', world.getBlock(Math.floor(moved.x), Math.floor(moved.y), Math.floor(moved.z)) === 0);
}

// --- standing still ----------------------------------------------------------------------------

{
  const mobs = new Mobs({ world, cap: 0 });
  const m = Object.assign(mobs.make(MOBS[0], site.x + 0.5, site.y, site.z + 0.5), { still: true, facing: 1 });
  mobs.list.push(m);
  for (let i = 0; i < 120; i++) mobs.tick(0.1, { x: site.x + 3, y: site.y, z: site.z + 3 });
  ok('a still animal stays put, facing the same way', m.x === site.x + 0.5 && m.z === site.z + 0.5 && m.facing === 1 && mobs.list.includes(m));
  mobs.tick(0.1, { x: site.x + 5000, y: 100, z: site.z });
  ok('  and is not forgotten when you go to the Sky city', mobs.list.includes(m));
  ok('  (Mobs leaves `still` ones out of thinking and moving)', /if \(m\.still\) continue;/.test(mobsSrc));

  const w = new Wanderers({ world, hostile: () => true });
  const b = w.person('bandit', site.x + 0.5, site.y, site.z + 0.5, { still: true, facing: 2, name: 'Bandit' });
  w.list.push(b);
  for (let i = 0; i < 120; i++) w.tick(0.1, { x: site.x + 2, y: site.y, z: site.z + 2 });
  ok('a still bandit neither walks nor fights', b.x === site.x + 0.5 && b.z === site.z + 0.5 && !(b.strike > 0) && b.facing === 2);
  w.tick(0.1, { x: site.x + 5000, y: 100, z: site.z });
  ok('  and is still there when you come back', w.list.includes(b));
  ok('  (a rider stays in the saddle)', /if \(p\.still\) \{ this\.riding\(p\); continue; \}/.test(wanderSrc));
}

// --- the wiring --------------------------------------------------------------------------------

ok('Game opens it in a seeded Creative world that is never saved',
  /openShowcase\(/.test(game) && /newWorld\(\{ mode: CREATIVE, name: 'Showcase', scenery: true, silent: true, seed: SHOWCASE_SEED \}\)/.test(game));
ok('  a new world can be given its seed', /generateEndlessWorld\(\{ height: WORLD_HEIGHT, \.\.\.\(seed != null \? \{ seed \} : \{\}\) \}\)/.test(game));
ok('  the starter designs go down through starterPlacement, as a tap does', /this\.duilt\.starterPlacement\(b\.structure/.test(game));
ok('  no wild herds or explorers wander through', /this\.mobs\.cap = 0/.test(game) && /untilExplorer = Infinity/.test(game));
ok('  its own people join the lists the game draws', /withShowcase\('settlers'/.test(game) && /withShowcase\('defenders'/.test(game) && /withShowcase\('warriors'/.test(game));
ok('  a new world or a load leaves it', (game.match(/this\.showcase = null;/g) ?? []).length >= 3);
ok('spots and times for scripts', /showcaseSpot\(id, \{ settle = false \} = \{\}\)/.test(game) && /showcaseTime\(when\)/.test(game) && /finishLoading\(\)/.test(game));
ok('  the clock holds while it\'s open', /if \(playing && !this\.showcase\) this\.dayCycle\.advance\(dt\)/.test(game));
ok('in the menu, behind the workshop switch', MENU_BY_ID.get('menu-showcase')?.dev === true && !menuFor({ cloud: true }).some((m) => m.id === 'menu-showcase'));
ok('  with a way in, a spot to look from, and the hour', ui.includes('id="btn-showcase-open"') && ui.includes('id="showcase-spot"') && ui.includes('data-showcase-time'));
ok('the picture script is there', existsSync(new URL('../tools/showcase-shots.mjs', import.meta.url)));
{
  const tool = read('../tools/showcase-shots.mjs');
  ok('  at phone size, every spot by day, dusk and night, into a folder you name',
    /390x780/.test(tool) && /day,dusk,night/.test(tool) && /--out/.test(tool) && /showcaseSpot\(/.test(tool));
}
ok('and the plan says how to use it', /tools\/showcase-shots\.mjs/.test(plan));

process.exit(f ? 1 : 0);
