/**
 * A world keeps the shape of land it was made with (biomeMap.js's TERRAIN).
 *
 * A saved world only keeps the chunks somebody changed and makes the rest
 * again from its seed, so WORLD-1 and WORLD-3's new mountains and plains
 * would have reshaped the country round every old world's builds. Old saves
 * carry no shape, and read as the first; new worlds get the latest.
 */
const localStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (localStore.has(k) ? localStore.get(k) : null),
  setItem: (k, v) => localStore.set(k, String(v)),
  removeItem: (k) => localStore.delete(k),
};

const { World, Chunk } = await import('../src/world/World.js');
const { ChunkGen } = await import('../src/world/ChunkGen.js');
const { TERRAIN } = await import('../src/world/biomeMap.js');
const { CloudWorlds } = await import('../src/net/CloudWorlds.js');

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const makeGen = (o) => new ChunkGen(o);

ok('a new world gets the latest land', new ChunkGen({ seed: 5 }).terrain === TERRAIN && TERRAIN >= 2);

// --- a save on this device ---------------------------------------------------
const fresh = new World({ height: 200, gen: new ChunkGen({ seed: 5 }) });
fresh.getChunk(0, 0).touched = true;
const saved = fresh.serialize();
ok('saving a world writes down its land', saved.terrain === TERRAIN);
ok('  and it comes back the same', World.deserialize(saved, { makeGen }).gen.terrain === TERRAIN);
const { terrain: _, ...old } = saved;
ok('a save from before reads as the first land', World.deserialize(old, { makeGen }).gen.terrain === 1);

// --- the account -------------------------------------------------------------
const cloud = new CloudWorlds({ auth: { user: null, accessToken: async () => null }, bus: { emit() {} } });
let pushed = null;
cloud.sync.push = async (_id, { meta }) => { pushed = meta; return {}; };
await cloud.save('w1', { world: fresh, name: 'Test world 1', mode: 'duilt' });
ok('the account copy writes down its land', pushed?.worldGen?.terrain === TERRAIN);
const meta = { ...pushed, worldGen: { seed: 5, homeX: 0, homeZ: 0 } };
cloud.sync.pull = async () => ({ meta, chunks: [] });
ok('an account copy from before reads as the first land', (await cloud.restore('w1')).world.gen.terrain === 1);
meta.worldGen.terrain = TERRAIN;
ok('  and a new one as its own', (await cloud.restore('w1')).world.gen.terrain === TERRAIN);

// --- what the first land is --------------------------------------------------
// The two shapes differ out in the country, where the old one is remade.
const a = new ChunkGen({ seed: 42, terrain: 1 }), b = new ChunkGen({ seed: 42 });
let differ = 0;
for (let i = 0; i < 40; i++) if (a.heightAt(i * 97, i * 61) !== b.heightAt(i * 97, i * 61)) differ++;
ok(`old and new land differ across the country (${differ}/40 columns)`, differ > 10);
ok('there are no huge peaks in the first land', [...Array(40).keys()].every((i) => !a.biomes.weigh(i * 300, i * 170).massif));
// Its chunks are made the same in either order, like any other land.
const w1 = new World({ height: 200, gen: a }), w2 = new World({ height: 200, gen: new ChunkGen({ seed: 42, terrain: 1 }) });
const c1 = new Chunk(20, -7, 200), c2 = new Chunk(20, -7, 200);
w2.getChunk(21, -7);
a.fill(w1, c1); w2.gen.fill(w2, c2);
ok('first-land chunks agree whatever was made first', c1.data.every((v, i) => v === c2.data[i]));

process.exit(f ? 1 : 0);
