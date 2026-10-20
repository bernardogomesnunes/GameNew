import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { ChunkGen, WORLD_HEIGHT } from '../src/world/ChunkGen.js';
import { World } from '../src/world/World.js';
import { BIOMES } from '../src/config/biomes.js';
import { mobsForBiome } from '../src/config/mobs.js';
import { FUTURE_AWAY, FUTURE_GROUND, CELL, inFuture, futureArrival, archiveAt, lotPlan } from '../src/world/future.js';
import { inPast } from '../src/world/past.js';
import {
  BLOCKS_BY_ID, isTransparent, PAVEMENT, ASPHALT, TINTED_GLASS, STEEL_PANEL, NEON_PINK, NEON_CYAN, SCREEN, MAGLEV_RAIL, LIT_WINDOW, FUTURE_LAMP, ARCHIVE,
} from '../src/config/blocks.js';
import { ITEMS_BY_ID } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { WANDERERS } from '../src/config/wanderers.js';
import { talkLine } from '../src/config/talk.js';
import { generateDuiltWorld } from '../src/world/StarterWorld.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { FutureView } from '../src/render/FutureView.js';

/**
 * Time travel, part three: the Future (backlog batch 4, D3: "Future: a city
 * ... flying cars, trams, a university you can take knowledge back from").
 * Asked for directly: "Nice keep going".
 */

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const game = src('Game.js');

// --- where it is ------------------------------------------------------------------------------------------

const HX = 100, HZ = -50;
const gen = new ChunkGen({ seed: 41, height: WORLD_HEIGHT, homeX: HX, homeZ: HZ });
const at = futureArrival(HX, HZ);
ok('you arrive due west of home, a long way out — the other way from the Past', at.x === HX - FUTURE_AWAY && at.z === HZ
  && inFuture(at.x, HX) && !inFuture(HX - 5000, HX) && !inPast(at.x, HX) && !inFuture(HX + FUTURE_AWAY, HX));
{
  const era = new Set(BIOMES.filter((b) => b.era === 'future').map((b) => b.id));
  let city = 0, other = 0, home = 0, flat = true, dry = true;
  for (let i = 0; i < 400; i++) {
    const x = at.x + (i % 20) * 37 - 300, z = at.z + Math.floor(i / 20) * 41 - 400;
    if (era.has(BIOMES[gen.biomeIndexAt(x, z)].id)) city++; else other++;
    if (gen.heightAt(x, z) !== FUTURE_GROUND) flat = false;
    if (gen.waterLevelAt(x, z)) dry = false;
    if (era.has(BIOMES[gen.biomeIndexAt(HX + (i % 20) * 53 - 500, HZ + Math.floor(i / 20) * 47 - 450)].id)) home++;
  }
  ok(`out there it's all city (${city} of ${city + other}), and none of it at home (${home})`, era.size === 1 && other === 0 && home === 0);
  ok('  on level ground, with no river or sea through it', flat && dry);
  ok('  nothing wild lives there', mobsForBiome([...era][0]).length === 0);
  ok('  the Past keeps its own biomes still', BIOMES[gen.biomeIndexAt(HX + FUTURE_AWAY, HZ)].era === 'past');
}

// --- the city ---------------------------------------------------------------------------------------------

const world = new World({ endless: true, gen, height: WORLD_HEIGHT });
const G = FUTURE_GROUND;
const B = (u, y, v) => world.getBlock(at.x + u, y, at.z + v);
{
  // An east–west street runs along the north of each lot: asphalt, two maglev rails.
  const rails = [], road = [];
  for (let dv = -24; dv < -16; dv++) (B(5, G - 1, dv) === MAGLEV_RAIL ? rails : road).push(B(5, G - 1, dv));
  ok(`streets: asphalt, and down the east–west ones the trams' two rails (${rails.length})`, rails.length === 2 && road.every((b) => b === ASPHALT || b === PAVEMENT) && road.includes(ASPHALT));
  ok('  pavements beside them, with lamps on posts', B(-15, G - 1, -15) === PAVEMENT && [...Array(60).keys()].some((k) => B(-15, G + 3, k - 30) === FUTURE_LAMP || B(k - 30, G + 3, -15) === FUTURE_LAMP));
}
{
  // The towers: count what stands on a few lots round the plaza.
  const seen = new Map();
  let tallest = 0;
  for (const [i, j] of [[-1, 0], [0, 1], [-1, 1], [1, 1], [0, -1], [-1, -1], [2, 0], [2, 1]]) {
    const plan = lotPlan(i, j, gen.seed);
    if (plan.kind !== 'tower') continue;
    tallest = Math.max(tallest, plan.height);
    const u0 = i * CELL, v0 = j * CELL;
    for (let du = -22; du < 22; du += 1) {
      for (let y = G; y < G + plan.height + 9; y += 1) {
        const b = B(u0 + du, y, v0 + 4);
        seen.set(b, (seen.get(b) ?? 0) + 1);
      }
    }
  }
  ok(`glass towers, steel-framed, some windows lit (tallest ${tallest})`, seen.get(TINTED_GLASS) > 50 && seen.get(STEEL_PANEL) > 50 && seen.get(LIT_WINDOW) > 5 && tallest >= 50);
  ok('  neon round their roofs', (seen.get(NEON_PINK) ?? 0) + (seen.get(NEON_CYAN) ?? 0) > 0);
  const plans = [];
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) plans.push(lotPlan(i, j, gen.seed));
  ok('  some with a great screen on them, some parks between', plans.some((p) => p.screen) && plans.some((p) => p.kind === 'park'));
  ok('  the same city every time it\'s made', JSON.stringify(lotPlan(3, -2, 41)) === JSON.stringify(lotPlan(3, -2, 41)));
}
{
  // From the plaza, straight east into the university and up to the Archive.
  const a = archiveAt(HX, HZ);
  ok('the university, east of the plaza: the Archive on its floor', world.getBlock(a.x, a.y, a.z) === ARCHIVE && a.y === G);
  let clear = true;
  for (let x = at.x + 1; x < a.x; x++) for (const y of [G, G + 1]) if (world.isSolid?.(x, y, a.z) ?? world.getBlock(x, y, a.z)) clear = false;
  ok('  a clear walk to it, in at the door — no step up', clear);
  ok('  screens on its inside wall', [...Array(30).keys()].some((k) => world.getBlock(a.x + 14, G + 4, a.z - 15 + k) === SCREEN));
  ok('  nothing breaks it', BLOCKS_BY_ID.get(ARCHIVE).system && BLOCKS_BY_ID.get(ARCHIVE).light);
}

// --- what it's made of ------------------------------------------------------------------------------------

const futureBlocks = [PAVEMENT, ASPHALT, TINTED_GLASS, STEEL_PANEL, NEON_PINK, NEON_CYAN, SCREEN, MAGLEV_RAIL, LIT_WINDOW, FUTURE_LAMP];
ok('its blocks, each an item', futureBlocks.every((id) => [...ITEMS_BY_ID.values()].some((it) => it.block === id)));
ok('  and each made at an engineering centre after the war', futureBlocks.every((id) => {
  const item = [...ITEMS_BY_ID.values()].find((it) => it.block === id);
  const r = RECIPES.find((x) => x.output.id === item.id);
  return r && r.future && r.station === 'engineering' && r.age === 11;
}));
ok('neon, screens, lit windows and lamps shine on their own at night', [NEON_PINK, NEON_CYAN, SCREEN, LIT_WINDOW, FUTURE_LAMP, ARCHIVE].every((id) => BLOCKS_BY_ID.get(id).glows)
  && !BLOCKS_BY_ID.get(STEEL_PANEL).glows && isTransparent(TINTED_GLASS));
const mesher = src('world/ChunkMesher.js');
ok('  drawn with their own colour added back over the light', /GLOWS\[blockId\] \? GLOW_KEY : OPAQUE_KEY/.test(mesher)
  && /totalEmissiveRadiance \+= diffuseColor\.rgb \*/.test(mesher));
ok('  the lamps light what\'s round them too', !!BLOCKS_BY_ID.get(FUTURE_LAMP).light && !BLOCKS_BY_ID.get(NEON_PINK).light);

// --- the knowledge ----------------------------------------------------------------------------------------

{
  const { world: home } = generateDuiltWorld({ sizeX: 64, sizeZ: 64, seed: 6 });
  const d = new DuiltGame({ world: home, scene: new THREE.Scene(), bus: { emit() {} } });
  const steel = RECIPES.find((r) => r.id === 'steel_panel');
  ok('until you\'ve read the Archive, none of it can be made', /Archive/.test(d.crafting.locked(steel) ?? ''));
  ok('  other recipes aren\'t held back by it', d.crafting.locked(RECIPES.find((r) => r.id === 'helix')) == null);
  d.time.futureKnown = true; d.time.futureVisited = true;
  ok('  read, it can', d.crafting.locked(steel) == null);
  const back = new DuiltGame({ world: home, scene: new THREE.Scene(), bus: { emit() {} } });
  back.loadJSON(JSON.parse(JSON.stringify(d.toJSON())));
  ok('  and that\'s saved', back.time.futureKnown && back.time.futureVisited);
}
ok('Place on the Archive reads it — a tap too', /if \(aimed && aimed\.block === ARCHIVE\) return void this\.readArchive\(\);/.test(game)
  && /aimed\.block === TIME_MACHINE \|\| aimed\.block === ARCHIVE/.test(game) && /d\.time\.futureKnown = true;/.test(game));

// --- getting there ----------------------------------------------------------------------------------------

ok('the time machine offers the Future beside the Past', /ok: 'To the Past',\s*alt: 'To the Future',/.test(game)
  && /if \(go === 'alt'\) this\.travelFuture\(\); else if \(go\) this\.travelPast\(\);/.test(game));
ok('  a pop-up with two choices', /data-alt/.test(src('ui/Confirm.js')) && /done\('alt'\)/.test(src('ui/Confirm.js')));
ok('there, a machine beside you for the way home, and your dinosaurs come too', /travelFuture\(\) \{[\s\S]{0,500}w\.setBlock\(at\.x \+ 2, y, at\.z, TIME_MACHINE\);[\s\S]{0,200}this\.bringPack\(p, \{ x: at\.x, y, z: at\.z \}\);/.test(game));
ok('  from the Future, a machine takes you home', /if \(inPast\(x, cx\) \|\| inFuture\(x, cx\)\) return void this\.travelHome\(\);/.test(game));

// --- its people and its traffic -----------------------------------------------------------------------------

ok('its people about the square: neutral, and they talk', WANDERERS.futurian?.neutral && /'futurian'/.test(game)
  && /peopleTheFuture\(at, y\);/.test(game) && /Archive/.test(talkLine({ who: 'futurian', person: { id: 0, said: 1 } })));
ok('  gone again when you go home', /travelHome\(\) \{[\s\S]{0,400}landmark\?\.kind !== 'future'/.test(game));
{
  const scene = new THREE.Scene();
  const view = new FutureView(scene);
  view.update({ x: HX + 10, y: 110, z: HZ }, 100, HX, HZ);
  ok('trams and flying cars: none at home', !view.group.visible);
  const you = { x: at.x + 3, y: G, z: at.z + 3 };
  view.update(you, 100, HX, HZ);
  const trams = view.trams.map((t) => t.position.clone());
  const onRails = trams.every((p) => world.getBlock(Math.floor(p.x), G - 1, Math.floor(p.z) - 2) === MAGLEV_RAIL
    && world.getBlock(Math.floor(p.x), G - 1, Math.floor(p.z) + 1) === MAGLEV_RAIL);
  ok(`  in the Future, trams between the rails (${trams.length})`, view.group.visible && trams.length > 6 && onRails);
  view.update(you, 101, HX, HZ);
  ok('  moving', view.trams.some((t, k) => Math.abs(t.position.x - trams[k].x) > 5 && Math.abs(t.position.x - trams[k].x) < 20));
  const overStreets = view.cars.every((c) => {
    const p = c.mesh.position;
    const lu = (((p.x - at.x + CELL / 2) % CELL) + CELL) % CELL, lv = (((p.z - at.z + CELL / 2) % CELL) + CELL) % CELL;
    return p.y > G + 12 && (lu < 8 || lv < 8);
  });
  ok('  cars flying high, in lanes over the streets — never through a tower', view.cars.length > 10 && overStreets);
}

process.exit(f ? 1 : 0);
