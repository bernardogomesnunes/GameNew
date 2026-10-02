import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { World, Chunk } from '../src/world/World.js';
import { STAIR_SHADE, STAIR_STEP_TONE } from '../src/world/ChunkMesher.js';
import { throughArmour } from '../src/config/armour.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { DuiltGame } from '../src/duilt/DuiltGame.js';
import { Wanderers, ROYAL_EVERY, HEAVY_CHANCE } from '../src/world/Wanderers.js';
import { skyFor, skyAt, stampSky, liftAt, skyColumn, rimAt, SKY_AT, FLOOR, SKY_REACH, ISLAND_R } from '../src/world/skyKingdom.js';
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

{
  const mid = skyColumn(3, at.x, at.z, at.x + 40, at.z + 40), edge = skyColumn(3, at.x, at.z, at.x + 100, at.z);
  ok(`its floor is grass high in the sky, rock under it — deep in the middle (${FLOOR - mid.bottom}), thin at the edge`, mid.top === 1 && FLOOR - mid.bottom > 30 && (!edge || FLOOR - edge.bottom < 20));
  ok(`it's big: ${ISLAND_R * 2} across`, ISLAND_R >= 100 && skyColumn(3, at.x, at.z, at.x + 95, at.z) && !skyColumn(3, at.x, at.z, at.x + ISLAND_R + 2, at.z));
}

// --- the city ---------------------------------------------------------------------------------------

{
  const kinds = {};
  for (const p of sky.plots) kinds[p.kind] = (kinds[p.kind] ?? 0) + 1;
  const homes = (kinds.cottage ?? 0) + (kinds.townhouse ?? 0) + (kinds.villa ?? 0);
  ok(`houses: ${kinds.cottage} cottages, ${kinds.townhouse} townhouses, ${kinds.villa} villas`, homes >= 30 && kinds.cottage && kinds.townhouse && kinds.villa);
  ok(`the military quarter: ${kinds.barracks} barracks, ${kinds.armoury} armouries, ${kinds.yard} training yards`, kinds.barracks >= 3 && kinds.armoury >= 2 && kinds.yard >= 3);
  ok('gardens and fountain squares between them', (kinds.garden ?? 0) + (kinds.square ?? 0) >= 2);
  const count = (want) => [...cell.values()].filter((b) => want(b)).length;
  ok(`every home has a door and somewhere to sleep (${count((b) => b >= 69 && b <= 72)} doors, ${count((b) => b >= 193 && b <= 196)} beds)`,
    count((b) => b >= 69 && b <= 72) >= homes + kinds.barracks + kinds.armoury && count((b) => b >= 193 && b <= 196) >= homes + kinds.barracks * 6);
  ok('arms in the military quarter: racks, dummies, targets', count((b) => b >= 212 && b <= 215) >= 20 && count((b) => b >= 216 && b <= 219) >= 9 && count((b) => b >= 220 && b <= 223) >= 9);
  // Every plot inside the city wall, none on the avenues or in the citadel.
  ok('every plot inside the city wall, clear of the avenues and the citadel', sky.plots.every((p) => {
    const corners = [[p.x0, p.z0], [p.x0 + 12, p.z0 + 12]].map(([x, z]) => [x - at.x, z - at.z]);
    return corners.every(([x, z]) => Math.hypot(x, z) < rimAt(3, Math.atan2(z, x)) - 12)
      && corners.every(([x, z]) => Math.abs(x) > 6 || Math.abs(z) > 6) && !(Math.abs(corners[0][0]) < 31 && Math.abs(corners[0][1]) < 31 && Math.abs(corners[1][0]) < 31 && Math.abs(corners[1][1]) < 31);
  }));

  // The city wall: all the way round, but open where each avenue goes through.
  let walled = 0, around = 0;
  for (let a = 0; a < 360; a += 3) {
    const t = a * Math.PI / 180, r = rimAt(3, t);
    if (Math.abs(Math.cos(t) * r) < 8 || Math.abs(Math.sin(t) * r) < 8) continue; // the gates
    around++;
    for (let k = -14; k <= -8; k++) {
      const x = Math.round(at.x + Math.cos(t) * (r + k)), z = Math.round(at.z + Math.sin(t) * (r + k));
      if (solid(x, FLOOR + 3, z)) { walled++; break; }
    }
  }
  ok(`a wall round the city (${walled} of ${around} bearings)`, walled === around);
  for (const l of sky.landings) {
    // From where the lift sets you down to the citadel's gate, the avenue is clear to walk.
    let blocked = 0;
    for (let s = Math.hypot(l.arrive.x - 0.5 - at.x, l.arrive.z - 0.5 - at.z); s > 32; s--) {
      const x = at.x + l.ux * Math.round(s), z = at.z + l.uz * Math.round(s);
      if (!solid(x, FLOOR - 1, z) || solid(x, FLOOR, z) || solid(x, FLOOR + 1, z)) blocked++;
    }
    ok(`  the ${['east', 'south', 'west', 'north'][sky.landings.indexOf(l)]} gate: in through the wall and down the avenue to the citadel`, blocked === 0
      && solid(at.x + l.ux * (Math.round(l.wall) + 1) - l.uz * 7, FLOOR + 10, at.z + l.uz * (Math.round(l.wall) + 1) + l.ux * 7));
  }
  ok('the citadel: walled, towers on its corners, the palace inside with a spire', solid(at.x + 10, FLOOR + 3, at.z - 28) && solid(at.x + 28, FLOOR + 12, at.z + 28)
    && id(at.x, FLOOR + 26, at.z) === 13 && open(at.x, FLOOR + 1, at.z - 28));
  ok(`${sky.posts.length} guards posted — gates, avenues, palace, yards — each on open ground`, sky.posts.length >= 25
    && sky.posts.every((p) => solid(p.x, FLOOR - 1, p.z) || skyColumn(3, at.x, at.z, Math.floor(p.x), Math.floor(p.z))) && sky.posts.every((p) => open(p.x, FLOOR, p.z) && open(p.x, FLOOR + 1, p.z)));
}
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
// Walk each tower: in at its door, up the stair to the lift, and back down —
// a step at a time, never more than a block up or down, with room for your
// head at every step and between steps (reported: "there's a block blocking
// the path in the first patch of stairs").
{
  const STAIRS = new Set([29, 57, 58, 59]);
  const blocks = (x, y, z) => { const b = cell.get(`${x},${y},${z}`); return b != null && b !== 0 && b !== CHAIN; };
  for (const [n, t] of sky.towers.entries()) {
    const { ux, uz } = t.landing;
    const feetAt = (x, z, near) => {
      // Where you'd stand in this column near height `near`: on something, with two clear above.
      for (const y of [near, near + 1, near - 1]) if (blocks(x, y - 1, z) && !blocks(x, y, z) && !blocks(x, y + 1, z)) return y;
      return null;
    };
    const start = { x: t.x + ux * 3, z: t.z + uz * 3, y: t.ground };
    const seen = new Set([`${start.x},${start.y},${start.z}`]);
    const queue = [start];
    let reached = false;
    while (queue.length && !reached) {
      const p = queue.shift();
      if (p.y === t.y && Math.abs(p.x - t.x) <= 3 && Math.abs(p.z - t.z) <= 3) { reached = true; break; }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = p.x + dx, z = p.z + dz;
        if (Math.abs(x - t.x) > 3 || Math.abs(z - t.z) > 3) { if (!(x === start.x && z === start.z)) continue; }
        const y = feetAt(x, z, p.y);
        if (y == null || Math.abs(y - p.y) > 1) continue;
        // Going up takes a stair to step onto; and the head clears both cells at the higher height.
        if (y > p.y && !STAIRS.has(cell.get(`${x},${y - 1},${z}`))) continue;
        const hi = Math.max(y, p.y);
        if (blocks(p.x, hi, p.z) || blocks(p.x, hi + 1, p.z) || blocks(x, hi, z) || blocks(x, hi + 1, z)) continue;
        const k = `${x},${y},${z}`;
        if (!seen.has(k)) { seen.add(k); queue.push({ x, y, z }); }
      }
    }
    ok(`  tower ${n + 1}: in at the door, up the stair to the lift and down again, headroom all the way`, reached);
  }
}
// And with the real thing: a player walked up each tower's stair and back
// down by the game's own movement and collision.
{
  globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
  const { PlayerController } = await import('../src/player/PlayerController.js');
  const RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  for (const [n, t] of sky.towers.entries()) {
    const ox = t.x - 8, oz = t.z - 8;
    const world = new World({ sizeX: 16, sizeZ: 16, height: 160 });
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < t.ground; y++) world.setBlock(x, y, z, 3);
    for (const list of sky.byChunk.values()) for (const [x, y, z, b] of list) {
      if (Math.abs(x - t.x) <= 4 && Math.abs(z - t.z) <= 4 && y < 160 && y >= t.ground - 4) world.setBlock(x - ox, y, z - oz, b);
    }
    const { ux, uz } = t.landing;
    const first = RING.findIndex(([i, j]) => i === ux && j === uz), steps = t.y - t.ground;
    const route = [[ux * 3, uz * 3], [ux * 2, uz * 2]];
    for (let k = 0; k <= steps; k++) route.push(RING[(first + k) % 8]);
    const walk = (cells, y) => {
      const p = new PlayerController(world, new THREE.PerspectiveCamera(), { x: 8.5 + cells[0][0], y, z: 8.5 + cells[0][1] });
      for (let i = 0; i < 30; i++) p.update(1 / 60);
      for (const [cx, cz] of cells.slice(1)) {
        const tx = 8.5 + cx, tz = 8.5 + cz;
        for (let i = 0; Math.hypot(p.position.x - tx, p.position.z - tz) > 0.25; i++) {
          if (i > 240) return null;
          p.yaw = Math.atan2(-(tx - p.position.x), -(tz - p.position.z)); p.externalMove.z = 1;
          p.update(1 / 60);
        }
      }
      p.externalMove.z = 0;
      for (let i = 0; i < 30; i++) p.update(1 / 60);
      return Math.round(p.position.y);
    };
    ok(`  tower ${n + 1}, walked for real: up to the lift (${steps + 1} steps) and back down to the door`, walk(route, t.ground) === t.y && walk([...route].reverse(), t.y) === t.ground);
  }
}
ok('stairs show their steps: risers in shade, each step down a little darker', STAIR_SHADE.px <= 0.7 && STAIR_SHADE.pz <= 0.75 && STAIR_SHADE.py >= 1 && STAIR_STEP_TONE[0] < STAIR_STEP_TONE[2]);
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

// --- the fight: varied blows, the King's wind-up, his royal guard -----------------------------------------

{
  const world = new World({ sizeX: 96, sizeZ: 96, height: 32 });
  for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) for (let y = 0; y < 10; y++) world.setBlock(x, y, z, 3);
  const isle = {
    kind: 'sky', x: 48, z: 48, y: 10, king: { x: 48.5, z: 52.5, dy: 0, facing: Math.PI }, posts: [],
    royal: [{ x: 46.5, z: 52.5 }, { x: 50.5, z: 52.5 }], palaceDoor: { x: 48.5, z: 36.5 },
  };
  const blows = [], royals = [];
  let t = 0;
  const w = new Wanderers({ world, rand: rng(11), sky: () => isle, skyHostile: () => true, onAttack: (p, hits, b) => blows.push({ kind: p.kind, hits, heavy: !!b?.heavy, t, wound: p._wound }), onRoyal: (p) => royals.push(p) });
  w.untilMessenger = w.untilExplorer = 1e9;
  const far = { x: 48.5, y: 10, z: 20.5 };
  w.tick(0.05, far);
  const royal = () => w.list.filter((p) => p.kind === 'royal_guard' && !p.dead);
  const king = w.list.find((p) => p.kind === 'sky_king');
  ok(`two royal guards beside the King (${royal().length}), tougher than the island's guards`, royal().length === 2 && WANDERERS.royal_guard.hp > WANDERERS.sky_guard.hp && royal().every((g) => Math.abs(g.z - king.z) < 1 && Math.abs(Math.abs(g.x - king.x) - 2) < 0.1));
  for (let i = 0; i < 200; i++) { t += 0.05; w.tick(0.05, far); }
  ok('they don\'t leave his side to chase you across the hall', royal().every((g) => Math.hypot(g.x - g.home.x, g.z - g.home.z) < 1.5));

  // Stand in reach of the King and his guard for a minute.
  const you = { x: 48.5, y: 10, z: 50.8 };
  // Watch the King: a heavy blow must be wound up first.
  let windups = 0, sawWinding = false;
  for (let i = 0; i < 1200; i++) {
    t += 0.05;
    w.tick(0.05, you);
    if (king.winding && !sawWinding) { windups++; king._wound = true; }
    sawWinding = !!king.winding;
    for (const g of royal()) g.hp = WANDERERS.royal_guard.hp; // keep them standing for now
  }
  const kings = blows.filter((b) => b.kind === 'sky_king'), guards = blows.filter((b) => b.kind === 'royal_guard');
  const gaps = (list) => list.slice(1).map((b, i) => +(b.t - list[i].t).toFixed(2));
  const kg = gaps(kings);
  ok(`no two blows alike: the King's ${kings.length} came ${Math.min(...kg)}–${Math.max(...kg)} s apart, ${[...new Set(kings.map((b) => b.hits))].sort((a, b) => a - b).join('/')} half-hearts`,
    kings.length > 20 && Math.max(...kg) - Math.min(...kg) > 0.5 && new Set(kings.map((b) => b.hits)).size >= 3);
  const heavy = kings.filter((b) => b.heavy);
  ok(`now and then a heavy one (${heavy.length} of ${kings.length}), twice as hard`, heavy.length > 0 && heavy.length < kings.length / 2 && Math.min(...heavy.map((b) => b.hits)) >= 2 * (WANDERERS.sky_king.hits - 1));
  ok(`and the King winds each heavy blow up where you can see it (${windups} wind-ups)`, windups >= heavy.length && heavy.every((b) => b.wound));
  ok(`his royal guard fights beside him (${guards.length} blows)`, guards.length > 10);

  // Step back while he winds up, and it misses.
  const w2 = new Wanderers({ world, rand: rng(5), sky: () => isle, skyHostile: () => true, onAttack: (p, hits, b) => blows.push({ kind: p.kind, heavy: !!b?.heavy, late: true }) });
  w2.untilMessenger = w2.untilExplorer = 1e9;
  w2.tick(0.05, far);
  w2.list = w2.list.filter((p) => p.kind === 'sky_king');
  const k2 = w2.list[0];
  let dodged = false;
  for (let i = 0; i < 2000 && !dodged; i++) {
    w2.tick(0.05, you);
    if (k2.winding) {
      const back = { x: you.x, y: 10, z: you.z - 6 };
      for (let j = 0; j < 20; j++) w2.tick(0.05, back);
      dodged = !k2.winding && !blows.some((b) => b.late && b.heavy);
    }
  }
  ok('step back while he winds up, and the heavy blow misses', dodged);

  // Kill a royal guard: another comes from the palace door to take the place.
  const [first] = royal();
  w.hit(first, 999, you.x, you.z);
  w.tick(0.05, far);
  ok('one falls: one left, for now', royal().length === 1 && royals.length === 0);
  for (let i = 0; i < (ROYAL_EVERY - 1) / 0.05; i++) w.tick(0.05, far);
  ok('not straight away', royal().length === 1);
  for (let i = 0; i < 2 / 0.05; i++) w.tick(0.05, far);
  const fresh = royal().find((g) => g !== royal()[0] || g.post === first.post);
  ok(`${ROYAL_EVERY} s later another marches in from the palace door, and you're told`, royal().length === 2 && royals.length === 1 && Math.hypot(royals[0].x - 48.5, royals[0].z - 36.5) < 12);
  for (let i = 0; i < 400; i++) w.tick(0.05, far);
  ok('to stand where the fallen one stood', royal().every((g) => Math.hypot(g.x - g.home.x, g.z - g.home.z) < 2) && !!fresh);
  w.hit(king, 999, you.x, you.z);
  w.hit(royal()[0], 999, you.x, you.z);
  for (let i = 0; i < (ROYAL_EVERY + 2) / 0.05; i++) w.tick(0.05, far);
  ok('the King fallen, nobody comes', royal().length === 1 && royals.length === 1);

  // The island's people fight your warriors back.
  const warrior = { x: 30.5, y: 10, z: 30.5, hp: 20, kind: 'warrior' };
  const struck = [];
  const w3 = new Wanderers({ world, rand: rng(8), skyHostile: () => true, foes: () => [warrior], onFoe: (p, f) => struck.push(f) });
  w3.untilMessenger = w3.untilExplorer = 1e9;
  const g3 = w3.person('sky_guard', 31.5, 10, 30.5, { landmark: isle, home: { x: 31.5, z: 30.5 } });
  w3.list.push(g3);
  for (let i = 0; i < 100; i++) w3.tick(0.05, { x: 80, y: 10, z: 80 });
  ok(`Sky guards fight your warriors, not just you (${struck.length} blows)`, struck.length > 2);
}

// The throne room, balanced: you against the King and his two royal guards,
// standing and swinging (no stepping back, no army, no food). The best
// sword, full armour and the Black Ring should usually win, if not by much;
// without armour, never.
{
  const world = new World({ sizeX: 96, sizeZ: 96, height: 32 });
  for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) for (let y = 0; y < 10; y++) world.setBlock(x, y, z, 3);
  const isle = { kind: 'sky', x: 48, z: 48, y: 10, king: { x: 48.5, z: 52.5, dy: 0 }, posts: [], royal: [{ x: 46.5, z: 52.5 }, { x: 50.5, z: 52.5 }], palaceDoor: { x: 48.5, z: 36.5 } };
  const fight = ({ sword, armour, ring, seed }) => {
    let hp = 20;
    const w = new Wanderers({ world, rand: rng(seed), sky: () => isle, skyHostile: () => true });
    w.untilMessenger = w.untilExplorer = 1e9;
    const you = { x: 48.5, y: 10, z: 48.5 };
    w.onAttack = (p, hits) => { hp -= throughArmour(hits, armour); if (ring) w.hit(p, 4, you.x, you.z); };
    let cool = 0;
    for (let t = 0; t < 60 && hp > 0; t += 0.05) {
      w.tick(0.05, you);
      const foes = w.list.filter((p) => !p.dead && (p.kind === 'royal_guard' || p.kind === 'sky_king'));
      if (!foes.some((p) => p.kind === 'sky_king')) return { won: true, hp };
      const near = foes.sort((a, b) => Math.hypot(a.x - you.x, a.z - you.z) - Math.hypot(b.x - you.x, b.z - you.z))[0];
      const d = Math.hypot(near.x - you.x, near.z - you.z);
      if (d > 2.2) { you.x += ((near.x - you.x) / d) * 4.3 * 0.05; you.z += ((near.z - you.z) / d) * 4.3 * 0.05; }
      cool -= 0.05;
      if (d <= 3 && cool <= 0) { cool = 0.35; w.hit(near, sword, you.x, you.z); }
    }
    return { won: false, hp };
  };
  const odds = (cfg) => [...Array(30)].map((_, i) => fight({ ...cfg, seed: i + 1 })).filter((r) => r.won);
  const best = odds({ sword: 9, armour: 10, ring: true }), bare = odds({ sword: 9, armour: 0, ring: false }), mid = odds({ sword: 6, armour: 10, ring: true });
  const left = best.reduce((a, r) => a + r.hp, 0) / Math.max(1, best.length) / 2;
  ok(`balanced: best sword, armour and the Black Ring win ${best.length}/30 (about ${left.toFixed(1)} hearts left); a lesser sword ${mid.length}/30; no armour ${bare.length}/30`,
    best.length >= 20 && left < 5 && mid.length < best.length && bare.length <= 2);
}

// A heavy blow throws you back.
{
  globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
  const { PlayerController } = await import('../src/player/PlayerController.js');
  const world = new World({ sizeX: 32, sizeZ: 32, height: 16 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) world.setBlock(x, 0, z, 3);
  const p = new PlayerController(world, new THREE.PerspectiveCamera(), { x: 16.5, y: 1, z: 16.5 });
  for (let i = 0; i < 30; i++) p.update(1 / 60);
  p.knockBack(1, 0);
  for (let i = 0; i < 90; i++) p.update(1 / 60);
  ok(`a heavy blow throws you back (${(p.position.x - 16.5).toFixed(1)} blocks) and you land on your feet`, p.position.x - 16.5 > 1 && p.position.x - 16.5 < 4 && p.grounded);
  ok('Game throws you away from whoever struck', /if \(blow\.heavy\) this\.player\.knockBack\(this\.player\.position\.x - p\.x, this\.player\.position\.z - p\.z\)/.test(game));
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

// --- finding them: on the map, and in Creative a way straight there -----------------------------------

{
  const ui = readFileSync(new URL('../src/ui/UIManager.js', import.meta.url), 'utf8');
  const map = readFileSync(new URL('../src/render/WorldMap.js', import.meta.url), 'utf8');
  ok('the map marks both kingdoms: the Stone once found, the Sky once sworn — both from the start in Creative',
    /d\.sandbox \|\| d\.foundPlaces\(\)\.some\(\(p\) => p\.kind === 'kingdom'\)/.test(game) && /this\.skyOpen\(\) && \(d\.sandbox \|\| d\.army\.sworn\)/.test(game));
  ok('off the edge of the map, an arrow on the edge points the way, with how far', /for \(const s of sites\) drawSite\(/.test(map) && /`\$\{s\.name\} · \$\{far\.toLocaleString/.test(map));
  ok('in Creative, a Travel button for each, closing the map', /const go = duilt\?\.sandbox \? sites : \[\];/.test(ui) && /Travel to the \$\{s\.name\}/.test(ui) && /this\.game\.travelTo\(b\.dataset\.travel\)\) this\.closePanel\('panel-map'\)/.test(ui));
  ok('travel is Creative only: the Sky Kingdom at its gate nearest home, the Stone Kingdom from the air',
    /travelTo\(kind\) \{\s*const d = this\.duilt, gen = this\.world\?\.gen;\s*if \(!d\?\.sandbox \|\| !gen\) return false;/.test(game) && /this\.player\.teleport\(l\.arrive\.x, l\.arrive\.y, l\.arrive\.z\)/.test(game));
}

process.exit(f ? 1 : 0);
