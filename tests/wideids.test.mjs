/**
 * Block ids past 255 (backlog batch 3, before #23–26): a byte a cell had six
 * ids left, not enough for a fence, door and trapdoor in every wood. A chunk
 * stays a byte a cell until a block past 255 goes in, then widens to two;
 * saves, the cloud format and the mesher all take either.
 */
import { World, Chunk, rleEncode, rleDecode } from '../src/world/World.js';
import { ChunkMesher } from '../src/world/ChunkMesher.js';
import { packRle, unpackRle, isWide, hashBytes } from '../src/storage/SyncEngine.js';
import { ID_COUNT, ID_LIMIT, BLOCKS_BY_ID } from '../src/config/blocks.js';
import { blockTextureArray } from '../src/render/BlockTextures.js';

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { CloudWorlds } = await import('../src/net/CloudWorlds.js');

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };

// --- the chunk ----------------------------------------------------------------

{
  const c = new Chunk(0, 0, 8);
  c.set(1, 1, 1, 200);
  ok('a chunk is a byte a cell while its blocks fit', c.data.BYTES_PER_ELEMENT === 1);
  c.set(2, 2, 2, 700);
  ok('and widens to two when a block past 255 goes in', c.data.BYTES_PER_ELEMENT === 2);
  ok('keeping what was already there', c.get(1, 1, 1) === 200 && c.get(2, 2, 2) === 700);
  ok(`room for ids up to ${ID_LIMIT - 1}; ${ID_COUNT} in use`, ID_COUNT <= ID_LIMIT && ID_LIMIT <= 0x10000);
  ok('every id fits', [...BLOCKS_BY_ID.keys()].every((id) => id < ID_COUNT));
}

// --- the local save -------------------------------------------------------------

{
  const data = new Uint16Array(64);
  data.fill(3, 0, 20); data.fill(900, 20, 30);
  const back = rleDecode(rleEncode(data), 64);
  ok('a wide chunk saves and loads', back.BYTES_PER_ELEMENT === 2 && back.every((v, i) => v === data[i]));
  const narrow = rleDecode(rleEncode(Uint8Array.from([1, 1, 2, 2])), 4);
  ok('a narrow one comes back narrow', narrow.BYTES_PER_ELEMENT === 1);

  const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
  w.setBlock(3, 2, 3, 1000);
  w.setBlock(4, 2, 3, 5);
  const again = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  ok('a whole world round trips a block past 255', again.getBlock(3, 2, 3) === 1000 && again.getBlock(4, 2, 3) === 5);
}

// --- the cloud format ------------------------------------------------------------

{
  const pairs = [19, 256, 3, 1000, 0, 4000];
  // What every chunk already in the cloud was written as.
  const old = new Uint8Array(9);
  const view = new DataView(old.buffer);
  for (let i = 0; i < 3; i++) { old[i * 3] = pairs[i * 2]; view.setUint16(i * 3 + 1, pairs[i * 2 + 1], true); }
  const packed = packRle(pairs);
  ok('a chunk that fits a byte packs exactly as before, so its hash is unchanged',
    !isWide(packed) && hashBytes(packed) === hashBytes(old));
  ok('chunks already in the cloud read back the same', JSON.stringify(unpackRle(old)) === JSON.stringify(pairs));

  const wide = [19, 256, 600, 10, 0, 4000];
  const wp = packRle(wide);
  ok('one with a block past 254 is marked wide', isWide(wp) && wp[0] === 0xff && wp[1] === 2 && wp.length === 2 + 3 * 4);
  ok('and reads back', JSON.stringify(unpackRle(wp)) === JSON.stringify(wide));
  ok('no old chunk can look wide: no block has ever been 255', !BLOCKS_BY_ID.has(255));
}

{
  // Restoring from the cloud into a fixed world, through CloudWorlds itself.
  const cw = new CloudWorlds({ auth: { user: null }, bus: null });
  const cells = 16 * 16 * 4;
  cw.sync.pull = async () => ({
    meta: { sizeX: 16, sizeZ: 16, height: 4, mode: 'creative', name: 'Test world 1' },
    chunks: [{ cx: 0, cz: 0, bytes: packRle([3, 10, 800, 1, 0, cells - 11]) }],
  });
  const { world } = await cw.restore('test');
  ok('a wide chunk restores from the cloud', world.getBlock(10, 0, 0) === 800 && world.getBlock(9, 0, 0) === 3 && world.getBlock(11, 0, 0) === 0);
}

// --- drawing -------------------------------------------------------------------

{
  const build = (wide) => {
    const w = new World({ sizeX: 16, sizeZ: 16, height: 8 });
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) w.setBlock(x, 0, z, 3);
    w.setBlock(5, 1, 5, 4);
    w.setBlock(6, 1, 5, 29);
    if (wide) w.getChunk(0, 0).widen();
    const m = new ChunkMesher({ add() {}, remove() {} });
    const c = w.getChunk(0, 0);
    m.rebuild(w, c);
    let v = 0;
    for (const mesh of c.mesh.values()) v += mesh.geometry.attributes.position.count;
    return v + (c.propMesh?.geometry.attributes.position.count ?? 0);
  };
  const a = build(false), b = build(true);
  ok(`a wide chunk draws the same as a narrow one (${a} vertices)`, a > 0 && a === b);
  ok(`texture layers still fit the byte the mesher sends them in (${blockTextureArray().layers})`, blockTextureArray().layers <= 256);
}

process.exit(f ? 1 : 0);
