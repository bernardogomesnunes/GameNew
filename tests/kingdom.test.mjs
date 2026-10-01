import { readFileSync } from 'node:fs';
import { World } from '../src/world/World.js';
import { ChunkGen } from '../src/world/ChunkGen.js';
import { kingdomFor, skylineAt, CITY_HALF } from '../src/world/kingdom.js';
import { landmarksFor, PLACE_NAMES } from '../src/world/landmarks.js';
import { roadsFor } from '../src/world/roads.js';
import { Wanderers } from '../src/world/Wanderers.js';
import { WANDERERS, NEWS } from '../src/config/wanderers.js';
import { LOOT } from '../src/duilt/Loot.js';
import { BIOMES } from '../src/config/biomes.js';
import { isChest } from '../src/config/blocks.js';

/**
 * Phase 7e — the Stone Kingdom (docs/plan-phase7-lore.md): "a walled city of
 * dark stone, placed by the world seed away from home ... walls with towers
 * and a gatehouse; streets; houses, a market, an armoury and barracks, in
 * the new dark style; a keep with the Stone King. Its walls and towers show
 * on the horizon."
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const game = readFileSync(new URL('../src/Game.js', import.meta.url), 'utf8');
const far = readFileSync(new URL('../src/render/FarTerrain.js', import.meta.url), 'utf8');

const DARK_STONE = 156, DARK_BRICK = 157, GOLD_TRIM = 159, NIGHTSTONE = 192, WAVE = 211, AIR = 0;
/** A bed's foot, any way round. */
const isBedFoot = (id) => id >= 193 && id <= 196;

// --- where it stands --------------------------------------------------------------------------

for (const seed of [5, 41, 2024]) {
  const gen = new ChunkGen({ seed });
  const k = kingdomFor(gen);
  const d = Math.hypot(k.x - gen.biomes.centreX, k.z - gen.biomes.centreZ);
  ok(`seed ${seed}: a city ${Math.round(d)} blocks from home, on ${BIOMES[gen.biomeIndexAt(k.x, k.z)].id}`, d > 900 && d < 1500 && BIOMES[gen.biomeIndexAt(k.x, k.z)].id !== 'ocean');
  ok('  the same city for the same seed', JSON.stringify([k.x, k.z, k.y, k.count]) === JSON.stringify((() => { const o = kingdomFor(new ChunkGen({ seed })); return [o.x, o.z, o.y, o.count]; })()));
  const others = landmarksFor(gen).filter((l) => l !== k);
  ok('  first among the landmarks, and none of the rest built inside it', landmarksFor(gen)[0] === k
    && others.every((l) => Math.max(Math.abs(l.x - k.x), Math.abs(l.z - k.z)) > k.half + l.half));
}

// --- what's in it --------------------------------------------------------------------------------

const gen = new ChunkGen({ seed: 41 });
const k = kingdomFor(gen);
const at = new Map(k.blocks.map(([dx, dy, dz, id]) => [`${dx},${dy},${dz}`, id]));
const block = (dx, dy, dz) => at.get(`${dx},${dy},${dz}`);
const count = (id) => k.blocks.filter((b) => b[3] === id).length;
ok(`dark stone and dark brick through and through (${count(DARK_STONE)} + ${count(DARK_BRICK)})`, count(DARK_STONE) > 3000 && count(DARK_BRICK) > 3000);
ok('walls ten high all the way round', [-CITY_HALF, CITY_HALF].every((e) => [9, 25, -25].every((a) => block(a, 9, e) && block(e, 9, a))));
ok('with towers taller than the walls at the corners', [DARK_STONE, DARK_BRICK].includes(block(-CITY_HALF + 4, 15, -CITY_HALF)) && block(-CITY_HALF + 4, 16, -CITY_HALF + 4) !== undefined);
ok('and a gate through the south wall', block(0, 2, CITY_HALF) === AIR && block(0, 2, CITY_HALF - 1) === AIR && block(0, 6, CITY_HALF) === GOLD_TRIM);
ok('a street from the gate to the keep', [30, 10, -5].every((z) => block(0, -1, z) === 210));
ok('the keep, with a throne in it', block(0, 1, -34) === GOLD_TRIM && block(-9, 10, -20) !== undefined);
ok('the dark god\'s temple, with a heart of Nightstone on its altar', count(NIGHTSTONE) === 1);
ok(`beds in the barracks (${k.blocks.filter(([dx, , dz, id]) => isBedFoot(id) && dx >= 14 && dz <= -6 && dz >= -16).length})`, k.blocks.filter(([dx, , dz, id]) => isBedFoot(id) && dx >= 14 && dz <= -6 && dz >= -16).length >= 6);
ok('a market square of calçada waves', count(WAVE) > 200);
ok(`chests in the armoury and the stalls (${k.blocks.filter((b) => isChest(b[3])).length})`, k.blocks.filter((b) => isChest(b[3])).length >= 7 && LOOT.kingdom?.items.length >= 6);
{
  const houses = new Set(k.blocks.filter(([dx, , dz, id]) => isBedFoot(id) && !(dx >= 14 && dz <= -6 && dz >= -16)).map(([dx, , dz]) => `${Math.floor((dx + 36) / 10)},${Math.floor((dz + 36) / 10)}`));
  ok(`houses filling the quarters (${houses.size} with a bed)`, houses.size >= 8);
}
ok('the King on a dais before his throne, and guards at their posts', k.king.dy === 1 && k.posts.length >= 8
  && k.posts.some((p) => p.role === 'gate') && k.posts.some((p) => p.role === 'throne'));

// --- in the world ---------------------------------------------------------------------------------

{
  const world = new World({ height: 200, gen });
  for (let cx = (k.x - 60) >> 4; cx <= (k.x + 60) >> 4; cx++) for (let cz = (k.z - 60) >> 4; cz <= (k.z + 60) >> 4; cz++) world.getChunk(cx, cz);
  const floors = new Set();
  for (const [dx, dz] of [[-30, 20], [25, 30], [-20, 5], [33, -2]]) {
    let y = 199;
    while (y > 0 && world.getBlock(k.x + dx, y, k.z + dz) === AIR) y--;
    if (![DARK_STONE, DARK_BRICK].includes(world.getBlock(k.x + dx, y, k.z + dz))) floors.add(y + 1);
  }
  ok(`built chunk by chunk, on level ground (floor at ${[...floors].join(', ')}, city at ${k.y})`, floors.size >= 1 && [...floors].every((y) => y === k.y || y === k.y + 1));
  ok('its walls standing in the real world', world.getBlock(k.x + 20, k.y + 9, k.z - CITY_HALF) === DARK_BRICK);
  ok('its throne too', world.getBlock(k.x, k.y + 1, k.z - 34) === GOLD_TRIM);
  ok('no wild tree inside it', (() => { for (let x = -45; x <= 45; x += 3) for (let z = -45; z <= 45; z += 3) if (gen.treeAt(k.x + x, k.z + z)) return false; return true; })());
}

// --- the road to it ---------------------------------------------------------------------------------

{
  const roads = roadsFor(gen);
  let toGate = false, inside = 0;
  for (const key of roads.keys()) {
    const [x, z] = key.split(',').map(Number);
    if (Math.hypot(x - k.x, z - (k.z + CITY_HALF + 3)) < 10) toGate = true;
    if (Math.max(Math.abs(x - k.x), Math.abs(z - k.z)) <= CITY_HALF + 1) inside++;
  }
  ok('an old road leads up to its gate', toGate);
  ok('and none runs through its walls', inside === 0);
}

// --- seen from afar (#130) ------------------------------------------------------------------------

ok('its towers stand up out of the far-off country', skylineAt(gen, k.x - CITY_HALF - 4, k.z - CITY_HALF - 4, 8) >= k.y + 15);
ok('and nothing is drawn where it isn\'t', skylineAt(gen, k.x + 400, k.z, 24) === null);
ok('the far view is drawn from it', /const city = skylineAt\(this\.gen, x, z, step\)/.test(far));
ok('and from anything you\'ve built — a changed chunk shows as it really is', /if \(!chunk\?\.touched\) continue;/.test(far) && /farTerrain\?\.invalidateAt\(c\.x, c\.z\)/.test(game));

// --- its people ---------------------------------------------------------------------------------------

{
  const world = new World({ height: 200, gen });
  for (let cx = (k.x - 50) >> 4; cx <= (k.x + 50) >> 4; cx++) for (let cz = (k.z - 50) >> 4; cz <= (k.z + 50) >> 4; cz++) world.getChunk(cx, cz);
  let hostile = false;
  const w = new Wanderers({ world, kingdomHostile: () => hostile });
  w.populate(k);
  const guards = w.list.filter((p) => p.kind === 'guard'), king = w.list.find((p) => p.kind === 'king');
  ok(`the Stone King and ${guards.length} guards, when you come near`, !!king && guards.length === k.posts.length && king.name === 'the Stone King');
  const player = { x: guards[0].x + 3, y: k.y, z: guards[0].z };
  const hits = [];
  w.onAttack = (p, n) => hits.push(n);
  for (let i = 0; i < 120; i++) w.think(guards[0], 1 / 30, player);
  ok('to anyone without the White Ring the guards keep watch', hits.length === 0);
  hostile = true;
  for (let i = 0; i < 120; i++) { w.think(guards[0], 1 / 30, player); w.move(guards[0], 1 / 30); }
  ok(`to the White Ring they're enemies (${hits.length} blows)`, hits.length >= 1 && hits[0] === WANDERERS.guard.hits);
  guards[0].hp = 1;
  w.think(guards[0], 1 / 30, player);
  ok('and a guard never runs', guards[0].speed !== WANDERERS.guard.run || guards[0].target == null || Math.hypot(guards[0].target.x - player.x, guards[0].target.z - player.z) < 3);
  const was = { x: king.x, z: king.z };
  for (let i = 0; i < 60; i++) { w.think(king, 1 / 30, player); w.move(king, 1 / 30); }
  ok('the King never leaves his throne', king.x === was.x && king.z === was.z);
}
ok('he speaks to you by the ring you bear', ['none', 'white', 'black'].every((r) => NEWS.king[r]?.length >= 2)
  && /if \(this\.kingTarget\(\)\) return void this\.speakToKing\(\)/.test(game) && /NEWS\.king\[ring\]/.test(game));
ok('the guards are the White Ring\'s enemy', /kingdomHostile: \(\) => !!\(this\.duilt && !this\.duilt\.sandbox && this\.duilt\.ring === 'white'\)/.test(game));
ok('messengers talk of it, and it goes on the map when you find it', NEWS.kingdom?.length >= 2 && PLACE_NAMES.kingdom === 'The Stone Kingdom');

process.exit(f ? 1 : 0);
