/**
 * Round-trips for the save boundaries.
 *
 * Every one of these guards the same class of bug: a field that exists in the
 * game, is written by `toJSON`, and is then quietly dropped by a function that
 * destructures a fixed list of keys. That is how Duilt worlds came back as
 * empty sandboxes — the bag, the land, the buildings, hunger and skills were
 * all being computed, saved by the game, and discarded by the save file.
 *
 * A field added to a save should fail here until it survives a round trip.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// --- a localStorage good enough for SaveManager -----------------------------
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { SaveManager } = await import('../src/storage/SaveManager.js');
const { buildWorldPayload, parseWorldPayload } = await import('../src/storage/WorldExport.js');
const { World } = await import('../src/world/World.js');

/** The smallest state the save path will accept, with a recognisable Duilt blob. */
function fixture(mode = 'duilt') {
  const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  world.setBlock(2, 1, 2, 4);
  return {
    world,
    player: { position: { x: 1.5, y: 2, z: 3.5 }, yaw: 0.5, pitch: -0.25 },
    gamification: { toJSON: () => ({ xp: 12, level: 2 }) },
    economy: { toJSON: () => ({ wood: 7 }) },
    mode,
    worldId: 'w-1',
    worldName: 'Test world',
    duilt: {
      inventory: { slots: [{ id: 'axe', count: 1, wear: 3 }, null, { id: 'wood', count: 64, wear: 0 }] },
      territory: { age: 2 },
      structures: { claims: [{ id: 'c1', type: 'forest' }] },
      hunger: { value: 71 },
      skills: { foraging: 140 },
    },
  };
}

test('a saved Duilt world loads back as a Duilt world', () => {
  const save = new SaveManager();
  const state = fixture();
  save.save('roundtrip', state);
  const loaded = save.load('roundtrip');

  assert.equal(loaded.mode, 'duilt', 'the mode must survive — loading it as creative strands the player');
  assert.deepEqual(loaded.duilt, state.duilt);
  assert.equal(loaded.duilt.inventory.slots[2].count, 64);
  assert.equal(loaded.duilt.territory.age, 2);
});

test('a world with no Duilt state round-trips as null, not undefined', () => {
  const save = new SaveManager();
  const state = fixture('creative');
  state.duilt = null;
  save.save('plain', state);
  const loaded = save.load('plain');
  assert.equal(loaded.mode, 'creative');
  assert.equal(loaded.duilt, null);
});

test('a save written before Duilt existed still loads', () => {
  // Exactly what a version 2 payload looked like: no `duilt` key at all.
  store.set('voxelgame:save:old', JSON.stringify({
    version: 2, timestamp: 1, mode: 'creative', worldId: null, worldName: 'Old',
    world: new World({ sizeX: 16, sizeZ: 16, height: 16 }).serialize(),
    player: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 },
    gamification: { xp: 0 }, economy: {},
  }));
  const loaded = new SaveManager().load('old');
  assert.equal(loaded.duilt, null);
  assert.equal(loaded.mode, 'creative');
});

test('exporting and re-importing a world keeps its Duilt state', () => {
  const state = fixture();
  const payload = buildWorldPayload({ ...state, templates: [], name: 'Exported' });
  const back = parseWorldPayload(JSON.stringify(payload));

  assert.equal(back.mode, 'duilt');
  assert.deepEqual(back.duilt, state.duilt);
});

test('an exported file from before Duilt imports as a creative world', () => {
  const payload = buildWorldPayload({ ...fixture('creative'), duilt: null, templates: [], name: 'Old' });
  delete payload.duilt;
  const back = parseWorldPayload(JSON.stringify(payload));
  assert.equal(back.mode, 'creative');
  assert.equal(back.duilt, null);
});
