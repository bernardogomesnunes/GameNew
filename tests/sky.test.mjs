import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World, Chunk } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { skyFor, skyAt, stampSky, liftAt, SKY_AT, FLOOR, SKY_REACH } from '../src/world/skyKingdom.js';
import { placeBeacon, BEACON_FAR, BEACON_NEAR } from '../src/render/SkyBeacon.js';
import { WANDERERS, NEWS } from '../src/config/wanderers.js';
import { BLOCKS_BY_ID, CHAIN, SKY_LIFT } from '../src/config/blocks.js';
import { PROP_SHAPES } from '../src/world/propShapes.js';
import { ITEMS_BY_ID, ITEM_FOR_BLOCK } from '../src/config/items.js';
import { RECIPES } from '../src/config/recipes.js';
import { itemIcon } from '../src/config/cubes.js';
import { FINAL_AGE } from '../src/config/ages.js';

/**
 * The Sky Kingdom (the dark path — docs/plan-phase7-lore.md): the floating
 * island 5,000 blocks out, its anchor towers and chains, the lifts up and
 * down, its guards and its King, and its fall.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const chunkGen = readFileSync(new URL('../src/world/ChunkGen.js', import.meta.url), 'utf8');

// --- the island ------------------------------------------------------------------------------------

const gen = new ChunkGen({ seed: 3 });
const at = skyAt(gen);
const home = { x: gen.biomes?.centreX ?? 0, z: gen.biomes?.centreZ ?? 0 };
ok(`it hangs ${SKY_AT} blocks from home (${Math.round(Math.hypot(at.x - home.x, at.z - home.z))})`, Math.abs(Math.hypot(at.x - home.x, at.z - home.z) - SKY_AT) < 2);
ok('finding it costs nothing: no plan made yet', gen.skyCache === undefined);
const t0 = performance.now();
const sky = skyFor(gen);
const ms = performance.now() - t0;
ok(`planned once (${ms.toFixed(0)} ms, ${sky.count} blocks), and kept`, skyFor(gen) === sky && sky.x === at.x && sky.z === at.z);
const cell = new Map();
for (const list of sky.byChunk.values()) for (const [x, y, z, id] of list) cell.set(`${x},${y},${z}`, id);
const id = (x, y, z) => cell.get(`${Math.floor(x)},${y},${Math.floor(z)}`);
const solid = (x, y, z) => { const b = id(x, y, z); return b != null && b !== 0 && b !== CHAIN; };
const open = (x, y, z) => { const b = id(x, y, z); return b == null || b === 0; };

ok('its floor is grass high in the sky, rock under it', id(at.x + 30, FLOOR - 1, at.z) === 1 || solid(at.x + 30, FLOOR - 1, at.z));
ok('the palace: marble, a gold roof, a throne', id(at.x, FLOOR + 1, sky.palace.maxZ - 1) === 13 && [...cell.values()].filter((b) => b === 13).length > 100);
ok('waterfalls pour off its rim', [...cell.entries()].filter(([k, b]) => b === 11 && Number(k.split(',')[1]) < FLOOR - 20).length >= 3);

ok(`four anchor towers on the ground round it (${sky.towers.map((t) => `${t.ground}→${t.y}`).join(', ')})`,
  sky.towers.length === 4 && sky.towers.every((t) => t.y > t.ground + 20 && t.y < FLOOR - 20));
for (const [i, t] of sky.towers.entries()) {
  const links = [...cell.entries()].filter(([k, b]) => b === CHAIN && Math.hypot(Number(k.split(',')[0]) - t.x, Number(k.split(',')[2]) - t.z) < 60).length;
  const up = liftAt(gen, t.lift.x, t.lift.y, t.lift.z), down = liftAt(gen, t.landing.x, t.landing.y, t.landing.z);
  ok(`tower ${i + 1}: a chain up to the rim (${links} links), a lift at the top and one on the island`,
    links > 30 && id(t.lift.x, t.lift.y, t.lift.z) === SKY_LIFT && id(t.landing.x, t.landing.y, t.landing.z) === SKY_LIFT && up?.up && down && !down.up);
  ok(`  up: you land on the island, on your feet`, solid(up.to.x, FLOOR - 1, up.to.z) && open(up.to.x, FLOOR, up.to.z) && open(up.to.x, FLOOR + 1, up.to.z));
  ok(`  down: you land on the tower's top, on your feet`, solid(down.to.x, t.y - 1, down.to.z) && open(down.to.x, t.y, down.to.z) && open(down.to.x, t.y + 1, down.to.z)
    && Math.hypot(down.to.x - t.lift.x - 0.5, down.to.z - t.lift.z - 0.5) > 1.5);
  ok('  and a door at its foot, and a stair inside', open(t.x + Math.sign(Math.round(Math.cos(t.landing.theta) * 2)) * 2, t.ground, t.z + Math.sign(Math.round(Math.sin(t.landing.theta) * 2)) * 2)
    && [...cell.values()].filter((b) => [29, 57, 58, 59].includes(b)).length >= 4 * 20);
}
ok('a lift anywhere else goes nowhere', liftAt(gen, at.x, 0, at.z) === null);

// --- only on the dark path -------------------------------------------------------------------------

{
  const [key] = [...sky.byChunk.keys()].filter((k) => sky.byChunk.get(k).some((b) => b[3] === SKY_LIFT));
  const [cx, cz] = key.split(',').map(Number);
  const make = () => new Chunk(cx, cz, 200);
  const count = (c) => { let n = 0; for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 200; y++) if (c.get(x, y, z) === SKY_LIFT) n++; return n; };
  const g2 = new ChunkGen({ seed: 3 });
  const white = make(); stampSky(g2, white, 16);
  ok('without it (the white path), not one block of it is laid', count(white) === 0 && g2.skyCache === undefined);
  g2.sky = true;
  const dark = make(); stampSky(g2, dark, 16);
  ok('on the dark path, its chunks get it', count(dark) >= 1);
  const far = new ChunkGen({ seed: 3 }); far.sky = true;
  stampSky(far, new Chunk(0, 0, 200), 16);
  ok(`and a chunk at home doesn't even plan it (reach ${SKY_REACH})`, far.skyCache === undefined);
  ok('ChunkGen lays it after the Stone Kingdom', /stampKingdom\([\s\S]{0,300}stampSky\(this, chunk, CHUNK_SIZE\)/.test(chunkGen));
  ok('Game sets it from your ring: the Black — and Creative', /this\.world\.gen\.sky = this\.skyOpen\(\)/.test(game) && /d\.sandbox \|\| d\.ring === 'black'/.test(game));
}

// --- the chains and lifts as blocks ----------------------------------------------------------------

{
  const chain = ITEMS_BY_ID.get(ITEM_FOR_BLOCK.get(CHAIN)), lift = ITEMS_BY_ID.get(ITEM_FOR_BLOCK.get(SKY_LIFT));
  const w = new World({ sizeX: 4, sizeZ: 4, height: 4 });
  w.setBlock(1, 1, 1, CHAIN);
  ok('a chain: modelled, walked through, made from iron', PROP_SHAPES.chain?.length >= 4 && w.collisionBoxAt(1, 1, 1) == null
    && RECIPES.some((r) => r.output.id === chain?.id && r.inputs.iron_ingot) && (itemIcon(chain) ?? '').includes('<svg'));
  ok('a sky lift: gold, modelled, drawn in the bag', PROP_SHAPES.sky_lift?.length >= 4 && BLOCKS_BY_ID.get(SKY_LIFT) && (itemIcon(lift) ?? '').includes('<svg'));
  ok('Place on a lift rides it, and the button says Ride', /aimed\.block === SKY_LIFT\) return void this\.rideLift\(aimed\)/.test(game) && /if \(id === SKY_LIFT\) return 'Ride';/.test(game));
  ok('the hint says where it goes, and tapping it rides', /up to the Sky Kingdom' : 'down to the ground'/.test(game) && /painting \|\| \(lift && lift !== 'nowhere'\)\) && swingLabel/.test(game));
  ok('warriors following you ride up with you', /army\.mode === 'follow'\) \{\s*for \(const w of army\.field\)/.test(game));
}

// --- its people ------------------------------------------------------------------------------------

{
  // An island stand-in on a flat world: its floor at y 10.
  const world = new World({ sizeX: 96, sizeZ: 96, height: 32 });
  for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) for (let y = 0; y < 10; y++) world.setBlock(x, y, z, 3);
  const isle = { kind: 'sky', x: 48, z: 48, y: 10, king: { x: 48.5, z: 52.5, dy: 0, facing: Math.PI }, posts: [{ x: 44.5, z: 44.5 }, { x: 52.5, z: 44.5 }, { x: 48.5, z: 40.5 }] };
  let hostile = false, fallen = 0;
  const w = new Wanderers({ world, rand: rng(4), sky: () => isle, skyHostile: () => hostile, onSkyKing: () => fallen++ });
  w.untilMessenger = w.untilExplorer = 1e9;
  const you = { x: 48.5, y: 10, z: 30.5 };
  w.tick(0.05, you);
  const king = w.list.find((p) => p.kind === 'sky_king'), guards = w.list.filter((p) => p.kind === 'sky_guard');
  ok(`near it: the Sky King and ${guards.length} guards, on the island`, king && guards.length === 3 && guards.every((g) => g.y === 10));
  ok('white and gold, the King the strongest thing on it', WANDERERS.sky_guard.colours.every((c) => (c >> 16) > 0xd0) && WANDERERS.sky_king.hp > WANDERERS.guard.hp * 3);
  const blows = [];
  w.onAttack = (p) => blows.push(p);
  you.z = 42; you.x = 46; // by the guards, out of the King's reach
  for (let i = 0; i < 100; i++) w.tick(0.05, you);
  ok('not hostile (Creative): they let you be', blows.length === 0);
  hostile = true;
  for (let i = 0; i < 100; i++) w.tick(0.05, you);
  ok(`the Black Ring: they fight you (${blows.length} blows)`, blows.length > 0 && blows.every((p) => p.kind === 'sky_guard' || p.kind === 'sky_king'));
  ok('and the King stays by his throne till you come to him', Math.hypot(king.x - 48.5, king.z - 52.5) < 1);
  let res;
  for (let i = 0; i < 40 && !king.dead; i++) res = w.hit(king, 3, king.x, king.z - 1);
  ok('bring him down and word goes out — once', king.dead && res.killed && fallen === 1 && (res.drops.gold ?? 0) >= 12);
  ok('Game listens: the Sky Kingdom falls', /onSkyKing: \(\) => this\.skyKingDown\(\)/.test(game) && /if \(!d \|\| !d\.bringDownSky\(\)\) return;/.test(game));
  ok('fallen, nobody is put on it again', /if \(!this\.skyOpen\(\) \|\| this\.duilt\.skyFallen\) return null;/.test(game));
  ok('your army fights them too', /WANDERERS\[e\.kind\]\.sky && this\.wanderers\.skyHostile\(\)/.test(game));
}

// --- the end of the dark path ----------------------------------------------------------------------

{
  const world = new World({ sizeX: 32, sizeZ: 32, height: 32 });
  const bus = { emit() {}, on() {} };
  const g = new DuiltGame({ world, scene: new THREE.Scene(), bus });
  g.ring = 'black';
  g.territory.setAge(FINAL_AGE);
  g.ageComplete = () => true;
  g.checkAgeAdvance();
  ok('the last age done with the Black Ring: not the end yet', !g.finished && !g.war.atWar);
  ok('the Sky Kingdom falls', g.bringDownSky() && g.skyFallen && !g.bringDownSky());
  ok('and that ends it', g.finished);
  const back = new DuiltGame({ world, scene: new THREE.Scene(), bus });
  back.loadJSON(JSON.parse(JSON.stringify(g.toJSON())));
  ok('its fall is saved with the world', back.skyFallen === true);
  const fresh = new DuiltGame({ world, scene: new THREE.Scene(), bus });
  fresh.loadJSON(JSON.parse(JSON.stringify({ ...g.toJSON(), skyFallen: undefined })));
  ok('an older world: still standing', fresh.skyFallen === false);
}

// --- seen from home --------------------------------------------------------------------------------

{
  const eye = { x: home.x, y: 110, z: home.z };
  const b = placeBeacon(at, eye);
  const d = Math.hypot(b.x - eye.x, b.z - eye.z);
  ok(`from home: a light low in the sky that way, drawn ${Math.round(d)} out`, Math.abs(d - BEACON_FAR) < 1
    && Math.abs(Math.atan2(b.z - eye.z, b.x - eye.x) - Math.atan2(at.z - eye.z, at.x - eye.x)) < 1e-6 && b.y > eye.y + 50 && b.size > 40);
  ok('close enough to see the island itself, it goes', placeBeacon(at, { x: at.x + BEACON_NEAR - 10, y: 110, z: at.z }) === null);
  ok('drawn every frame, only where there is a Sky Kingdom', /this\.skyBeacon\.update\(this\.skyOpen\(\) \? skyAt\(this\.world\.gen\) : null/.test(game));
  ok('the sworn King points the way', NEWS.king.sworn.some((l) => l.includes('{dir}')) && /lines\[this\.kingLine\]\.replace\('\{dir\}'/.test(game));
}

process.exit(f ? 1 : 0);
