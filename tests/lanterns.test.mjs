import { lightGroups } from '../src/render/LightManager.js';
import { lightOf } from '../src/config/blocks.js';

/**
 * Reported directly: "lanterns are not giving light anymore". Only the ten
 * placed lights nearest you were ever given real light; a settlement whose
 * buildings had been evolved (a light or four in each) had far more than ten
 * round it, and the rest stayed dark. Lights close together now share one,
 * and the ones in front of you come before the ones behind.
 */

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const LANTERN = 26;
const lamp = (x, y, z) => ({ x, y, z, light: lightOf(LANTERN) });

// A street of eight evolved houses, four lights in each, a house every 9 blocks.
const lights = [];
for (let h = 0; h < 8; h++) {
  const bx = h * 9;
  for (const [dx, dz] of [[1, 1], [4, 1], [1, 4], [4, 4]]) lights.push(lamp(bx + dx, 3, dz));
}
const me = { x: 30, y: 2, z: 10 };
const groups = lightGroups(lights, me, null, 10);
const lit = new Set(groups.flatMap((g) => g.members.map((m) => m.entry)));
ok(`${lights.length} lanterns, ten real lights: every one of them lit (${lit.size})`, lit.size === lights.length && groups.length <= 10);
ok('a house\'s four lights are one glow, brighter than one alone', groups.every((g) => g.members.length <= 4) && groups.some((g) => g.members.length === 4 && g.intensity > g.entry.light.intensity));
ok('and it sits in the middle of them', groups.every((g) => g.members.every((m) => Math.abs(m.x - g.x) <= 4 && Math.abs(m.z - g.z) <= 4)));

// More houses than the pool holds: the ones you're looking at first.
const town = [];
for (let h = 0; h < 30; h++) town.push(lamp(h * 9 - 135, 3, 0));
const ahead = lightGroups(town, { x: 0, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }, 10);
const fwd = ahead.filter((g) => g.x > 0).length;
ok(`looking east, the street ahead gets more of the light (${fwd} of ${ahead.length} ahead)`, fwd > ahead.length / 2);
const beside = lightGroups([lamp(-1, 2, 0), ...town], { x: 0, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }, 10);
ok('one right beside you is lit even behind you', beside.some((g) => g.members.some((m) => m.entry.x === -1)));
ok('nothing lit, nothing asked', lightGroups([], me).length === 0);

// --- lanterns the world doesn't hear about ---------------------------------------------------------
// Reported again: "Old lanterns in my world stopped throwing light". Opened
// from the account, a world's saved chunks were written straight in and
// never scanned (cloudworlds.test checks that path); and the places the
// land comes with — a city's lanterns, a camp's fire — are written straight
// into a chunk as it's made, so they never lit at all.
{
  const { World } = await import('../src/world/World.js');
  const { ChunkGen, WORLD_HEIGHT } = await import('../src/world/ChunkGen.js');
  const { landmarksFor } = await import('../src/world/landmarks.js');
  const { LANTERN_ID } = { LANTERN_ID: 26 };
  let city = null, gen = null;
  for (const seed of [41, 2024, 7, 99]) {
    gen = new ChunkGen({ seed, height: WORLD_HEIGHT });
    city = landmarksFor(gen).find((l) => l.kind === 'city');
    if (city) break;
  }
  const world = new World({ height: WORLD_HEIGHT, gen });
  const cx = city.x >> 4, cz = city.z >> 4;
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) world.getChunk(cx + a, cz + b);
  const lit = [...world.lights.values()].filter((e) => world.getBlock(e.x, e.y, e.z) === LANTERN_ID);
  ok(`a city's lanterns light as soon as its land is made (${lit.length})`, lit.length >= 8);
  ok('  every light the world knows of is really there', [...world.lights.values()].every((e) => lightOf(world.getBlock(e.x, e.y, e.z))));
  ok('  but not lava or glowing ore deep down — no end of those, nobody looks to them for light',
    [...world.lights.values()].every((e) => ![45, 116, 117, 118, 191, 192].includes(world.getBlock(e.x, e.y, e.z))));
  const before = world.lights.size;
  world.forgetBeyond(city.x + 5000, city.z, 64);
  ok(`walked away from, its lights go with its land (${before} → ${world.lights.size})`, world.lights.size === 0);
  world.getChunk(cx, cz);
  ok('  and come back with it', world.lights.size > 0);
  // A save laid over made land: the lanterns in the save, not the ones it was made with.
  const c = world.getChunk(cx, cz);
  const json = { endless: true, height: WORLD_HEIGHT, seed: gen.seed, homeX: gen.biomes.centreX, homeZ: gen.biomes.centreZ, chunks: [] };
  const { rleEncode } = await import('../src/world/World.js');
  const data = c.data.slice();
  for (let i = 0; i < data.length; i++) if (data[i] === LANTERN_ID) data[i] = 0;   // every lantern broken
  json.chunks.push({ cx, cz, rle: rleEncode(data), surface: Array.from(c.surface) });
  const back = World.deserialize(json, { makeGen: () => new ChunkGen({ seed: gen.seed, height: WORLD_HEIGHT, homeX: gen.biomes.centreX, homeZ: gen.biomes.centreZ }) });
  const inChunk = [...back.lights.values()].filter((e) => e.x >> 4 === cx && e.z >> 4 === cz);
  ok('lanterns broken before saving don\'t come back as lights from the land they were made with', inChunk.every((e) => lightOf(back.getBlock(e.x, e.y, e.z))) && !inChunk.some((e) => back.getBlock(e.x, e.y, e.z) === LANTERN_ID));
}

process.exit(f ? 1 : 0);
