import * as THREE from 'three';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Inventory } from '../src/items/Inventory.js';
import { World } from '../src/world/World.js';
import { STRUCTURES_BY_ID, FACTORY_STATIONS, structuresForAge } from '../src/config/structures.js';
import { validateStructure } from '../src/structures/validate.js';
import { RECIPES } from '../src/config/recipes.js';
import { stackLimit } from '../src/config/items.js';
import { factoryRecipes, lineRuns, lineDaily, lineCap, maxLines } from '../src/structures/Factory.js';

/** PLAY-11 chunk B: the Factory (docs/design/play-11.md). */
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

const STONE = 3, PLANING = 527, WORKBENCH = 529, STONE_MILL = 380, JOINERY = 528, SPINNING = 534;
const R = { minX: 2, maxX: 11, minY: 1, maxY: 5, minZ: 2, maxZ: 11 };

/** A 10 x 10 stone hall, 3 high inside, with the given machine blocks on its floor. */
function hall(world, machines) {
  for (let x = R.minX; x <= R.maxX; x++) for (let z = R.minZ; z <= R.maxZ; z++) for (let y = R.minY; y <= R.maxY; y++) {
    const edge = x === R.minX || x === R.maxX || z === R.minZ || z === R.maxZ || y === R.minY || y === R.maxY;
    world.setBlock(x, y, z, edge ? STONE : 0);
  }
  machines.forEach((id, i) => world.setBlock(R.minX + 2 + i, R.minY + 1, R.minZ + 2, id));
}

/** A game at Age 10 with a won war, a storehouse and a Factory holding `machines`. */
function make({ machines = [PLANING, WORKBENCH, STONE_MILL], slots = 40, ending = 'white' } = {}) {
  const world = new World({ sizeX: 32, sizeZ: 32, height: 16 });
  const d = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  d.inventory = new Inventory({ slots });
  d.structures.inventory = d.inventory;
  d.territory.setAge(10);
  if (ending === 'white') d.war.stage = 'won';
  hall(world, machines);
  const shed = { id: d.structures.nextId++, type: 'storehouse', region: { minX: 20, maxX: 22, minY: 1, maxY: 3, minZ: 20, maxZ: 22 }, valid: true, locked: true, claimedAt: 0, lastPaidAt: Date.now(), brokenReason: null };
  d.structures.structures.push(shed);
  d.structures.storeFor(shed);
  const t0 = Date.now();
  const fac = { id: d.structures.nextId++, type: 'factory', region: { ...R }, valid: true, locked: true, claimedAt: t0, lastPaidAt: t0, brokenReason: null, excludes: [], tier: 0 };
  d.structures.structures.push(fac);
  const day = 86400_000 * d.structures.dayScale;
  return { d, world, shed, fac, t0, day };
}
/** Sets a line and puts its clock at `at`. */
function line(d, fac, station, recipe, at) {
  const r = d.setFactoryLine(fac.id, station, recipe);
  fac.lines.find((l) => l.station === station).at = at;
  return r;
}

// 1. The spec and the ending gate.
{
  const spec = STRUCTURES_BY_ID.get('factory');
  ok('factory: Age 10, sizes 8 to 24, afterEnding, cost iron 8 brick 24 glass 6',
    spec.age === 10 && spec.minSize === 8 && spec.maxSize === 24 && spec.afterEnding === true
    && spec.cost.iron_ingot === 8 && spec.cost.brick === 24 && spec.cost.glass === 6);
  ok('it is offered at Age 10, not Age 9', structuresForAge(10).includes(spec) && !structuresForAge(9).includes(spec));
  const { d } = make({ ending: null });
  const refuse = () => d.claimOptionsFor(R).find((o) => o.id === 'factory');
  ok(`no ending: refused ("${refuse().reason}")`, !refuse().ok && /Finish the war first/.test(refuse().reason) && !d.claim(R, 'factory').ok);
  d.war.stage = 'truce';
  ok('a truce is no ending: still refused', /Finish the war first/.test(refuse().reason));
  d.war.stage = 'won';
  ok('won war (white): open', d.storyRefuses(STRUCTURES_BY_ID.get('factory')) === null && !/Finish the war/.test(refuse().reason ?? ''));
  d.war.stage = 'truce'; d.ring = 'black'; d.skyFallen = true;
  ok('Sky King down (dark): open', d.storyRefuses(STRUCTURES_BY_ID.get('factory')) === null);
  d.skyWar.yielded = true;
  ok('four chains cut (yielded): open', d.storyRefuses(STRUCTURES_BY_ID.get('factory')) === null);
  const c = make({ ending: null }).d;
  c.sandbox = true;
  ok('Creative: open', c.storyRefuses(STRUCTURES_BY_ID.get('factory')) === null);
}

// 2. Machines: 3 kinds needed.
{
  const two = make({ machines: [PLANING, PLANING, WORKBENCH] });
  const v2 = validateStructure(two.world, R, 'factory');
  ok(`2 machine kinds fail ("${v2.reason}")`, !v2.ok && /1 more kind of machine/.test(v2.reason));
  const three = make();
  const v3 = validateStructure(three.world, R, 'factory');
  ok(`3 kinds in a 192-block hall pass (${v3.reason ?? 'ok'})`, v3.ok);
  const small = make();
  for (let x = R.minX + 1; x < R.maxX; x++) for (let z = R.minZ + 3; z < R.maxZ; z++) for (let y = R.minY + 1; y < R.maxY; y++) small.world.setBlock(x, y, z, STONE);
  const vs = validateStructure(small.world, R, 'factory');
  ok(`a hall under 60 blocks fails ("${vs.reason}")`, !vs.ok && /hall bigger/.test(vs.reason));
}

// 3. Which recipes a line runs.
{
  ok('the workbench line runs 132 recipes', factoryRecipes('workbench').length === 132);
  const all = FACTORY_STATIONS.flatMap((st) => factoryRecipes(st));
  ok(`220 recipes across the 13 machines (${all.length})`, all.length === 220);
  ok('none needs a ring, water, a temple or a temple level', all.every((r) => !r.ring && !r.needs && r.needsTemple == null && r.tier == null));
  ok('no line makes coins', all.every((r) => r.output.id !== 'coin'));
  ok('every Factory recipe is a registry recipe, so tests/selling.test.mjs covers it for loops', all.every((r) => RECIPES.includes(r)));
}

// 4. Rates.
{
  const by = (id) => RECIPES.find((r) => r.id === id);
  ok('planks (3) 4 runs, door (1) 12, stone brick (6) 2',
    lineRuns(by('bench_planks')) === 4 && lineRuns(by('joinery_door')) === 12 && lineRuns(by('stone_mill_stone_brick')) === 2);
  const daily = FACTORY_STATIONS.flatMap((st) => factoryRecipes(st)).map((r) => lineDaily(r));
  ok(`every recipe makes 10 to 12 a day (${Math.min(...daily)} to ${Math.max(...daily)})`, Math.min(...daily) >= 10 && Math.max(...daily) <= 12);
  ok('line caps 12, 18, 30, 42; lines 6, 7, 8, 9',
    [0, 1, 2, 3].map(lineCap).join() === '12,18,30,42' && [0, 1, 2, 3].map(maxLines).join() === '6,7,8,9');
}

// 5. A Planing Bench line, a day.
{
  const { d, shed, fac, t0, day } = make();
  shed.store.add('wood', 10);
  d.inventory.add('apple', 1);
  const bag = JSON.stringify(d.inventory.toJSON());
  ok('the line is set', line(d, fac, 'planing_bench', 'bench_planks', t0).ok);
  d.runFactories(t0 + day);
  ok(`after one day: 12 planks in the store, 6 logs left (${shed.store.countOf('planks')}, ${shed.store.countOf('wood')})`,
    shed.store.countOf('planks') === 12 && shed.store.countOf('wood') === 6);
  ok('the bag unchanged', JSON.stringify(d.inventory.toJSON()) === bag);
}

// 6. Short of logs: the clock moves on, no backlog.
{
  const { d, shed, fac, t0, day } = make();
  shed.store.add('wood', 2);
  line(d, fac, 'planing_bench', 'bench_planks', t0);
  d.runFactories(t0 + day);
  const row = d.factoryLines(fac.id).rows.find((r) => r.station === 'planing_bench');
  ok(`2 logs: 2 runs (${shed.store.countOf('planks')} planks), then short of 1 log`,
    shed.store.countOf('planks') === 6 && row.short.length === 1 && row.short[0].item === 'wood' && row.short[0].n === 1 && row.short[0].have === 0);
  ok('the clock moved on to the day', fac.lines.find((l) => l.station === 'planing_bench').at === t0 + day);
  shed.store.add('wood', 10);
  d.runFactories(t0 + day + 1000);
  ok('logs added later: no backlog', shed.store.countOf('planks') === 6 && shed.store.countOf('wood') === 10);
  d.runFactories(t0 + day * 1.25);
  ok('the next run comes on time', shed.store.countOf('planks') === 9);
}

// 7. Nowhere for the output: nothing spent, the run stays owed.
{
  const { d, shed, fac, t0, day } = make({ slots: 1 });
  d.inventory.add('axe', 1);
  const lim = stackLimit('wood');
  for (let i = 0; i < shed.store.slots.length; i++) shed.store.slots[i] = { id: 'wood', count: lim };
  const full = shed.store.countOf('wood');
  line(d, fac, 'planing_bench', 'bench_planks', t0);
  d.runFactories(t0 + day);
  ok(`full stores and bag: no logs spent (${shed.store.countOf('wood')} of ${full})`, shed.store.countOf('wood') === full && shed.store.countOf('planks') === 0);
  ok('the run stays owed: the clock did not move', fac.lines.find((l) => l.station === 'planing_bench').at === t0);
  shed.store.remove('wood', lim);
  d.runFactories(t0 + day);
  ok(`room made: the owed runs come (${shed.store.countOf('planks')})`, shed.store.countOf('planks') === 12);
}

// 8. Two lines, one output.
{
  const { d, fac, t0 } = make({ machines: [WORKBENCH, PLANING, JOINERY, SPINNING] });
  ok('the Planing Bench makes planks', line(d, fac, 'planing_bench', 'bench_planks', t0).ok);
  const r = d.setFactoryLine(fac.id, 'workbench', 'planks');
  ok(`the Workbench cannot make planks too ("${r.reason}")`, !r.ok && /Planing Bench line makes this/.test(r.reason));
  const row = d.factoryLines(fac.id).rows.find((x) => x.station === 'workbench');
  ok('and the picker says so', row.recipes.find((x) => x.id === 'planks').takenBy === 'Planing Bench');
  ok('a machine not inside has no line', !d.setFactoryLine(fac.id, 'forge', 'dark_stone').ok);
  ok('a recipe of another machine is refused', !d.setFactoryLine(fac.id, 'spinning_wheel', 'bench_planks').ok);
}

// 9. Save and load.
{
  const { d, fac, t0 } = make();
  line(d, fac, 'planing_bench', 'bench_planks', t0);
  line(d, fac, 'stone_mill', 'stone_mill_stone_brick', t0);
  const saved = JSON.parse(JSON.stringify(d.structures.toJSON()));
  const f2 = saved.structures.find((s) => s.type === 'factory');
  ok('the save keeps lines', f2.lines.length === 3 && f2.lines.find((l) => l.station === 'planing_bench').recipe === 'bench_planks');
  f2.lines.find((l) => l.station === 'stone_mill').recipe = 'no_such_recipe';
  f2.lines.push({ station: 'moon_press', recipe: 'x', at: 0 });
  const { d: e } = make();
  e.structures.loadJSON(saved);
  e.validateFactoryLines();
  const back = e.structures.list().find((s) => s.type === 'factory');
  ok('loaded: planks still on, an unknown recipe off, an unknown machine gone',
    back.lines.find((l) => l.station === 'planing_bench').recipe === 'bench_planks'
    && back.lines.find((l) => l.station === 'stone_mill').recipe === null && !back.lines.some((l) => l.station === 'moon_press'));
  const old = JSON.parse(JSON.stringify(saved));
  for (const s of old.structures) delete s.lines;
  const { d: o } = make();
  o.structures.loadJSON(old);
  o.validateFactoryLines();
  const shedBack = o.structures.list().find((s) => s.type === 'storehouse');
  ok('an old save without lines loads, no lines field', !o.structures.list().some((s) => 'lines' in s) && !!shedBack);
  ok('and saves again without one', !JSON.stringify(o.structures.toJSON()).includes('"lines"'));
}
{
  // The whole game's save, through DuiltGame.loadJSON.
  const { d, world, fac, t0 } = make();
  line(d, fac, 'workbench', 'torch', t0);
  const saved = JSON.parse(JSON.stringify(d.toJSON()));
  const e = new DuiltGame({ world, scene: new THREE.Scene(), bus: null });
  e.loadJSON(saved);
  const back = e.structures.list().find((s) => s.type === 'factory');
  ok('a full game save and load keeps the Workbench line on torches', back?.lines?.find((l) => l.station === 'workbench')?.recipe === 'torch');
}

// 10. Time away is skipped.
{
  const { d, shed, fac, t0, day } = make();
  shed.store.add('wood', 20);
  line(d, fac, 'planing_bench', 'bench_planks', t0);
  const away = 6 * 3600_000;
  d.structures.skipAway(away, { now: t0 + away });
  ok('skipAway moves the line clock', fac.lines[0].at === t0 + away || fac.lines.find((l) => l.station === 'planing_bench').at === t0 + away);
  d.runFactories(t0 + away);
  ok('no runs owed for the time away', shed.store.countOf('planks') === 0);
  d.runFactories(t0 + away + day);
  ok('a day after: 12', shed.store.countOf('planks') === 12);
}

// 11. Tended: 18 a day.
{
  const { d, shed, fac, t0, day } = make();
  fac.tier = 1;
  shed.store.add('wood', 20);
  line(d, fac, 'planing_bench', 'bench_planks', t0);
  d.runFactories(t0 + day);
  ok(`at Tended the line makes 18 a day (${shed.store.countOf('planks')})`, shed.store.countOf('planks') === 18 && d.factoryLines(fac.id).rows.find((r) => r.station === 'planing_bench').daily === 18);
}

// 12. Line limit.
{
  const { d, fac, t0 } = make({ machines: [WORKBENCH, PLANING, JOINERY, SPINNING, STONE_MILL, 538, 525] });
  const picks = { workbench: 'torch', planing_bench: 'bench_planks', joinery_bench: 'joinery_door', spinning_wheel: 'string_spun', stone_mill: 'stone_mill_stone_brick', masons_bench: 'mason_slab_stone' };
  for (const [st, r] of Object.entries(picks)) line(d, fac, st, r, t0);
  const r = d.setFactoryLine(fac.id, 'forge', 'dark_stone');
  ok(`7 machine kinds, 6 lines at Humble ("${r.reason}")`, !r.ok && /All 6 lines/.test(r.reason));
  fac.tier = 1;
  ok('at Tended a seventh runs', d.setFactoryLine(fac.id, 'forge', 'dark_stone').ok);
}

console.log(f ? `\n${f} failed` : '\nall passed');
process.exit(f ? 1 : 0);
