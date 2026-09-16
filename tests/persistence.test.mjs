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
  save.write(state);
  const loaded = save.read('w-1');

  assert.equal(loaded.mode, 'duilt', 'the mode must survive — loading it as creative strands the player');
  assert.deepEqual(loaded.duilt, state.duilt);
  assert.equal(loaded.duilt.inventory.slots[2].count, 64);
  assert.equal(loaded.duilt.territory.age, 2);
});

test('a world with no Duilt state round-trips as null, not undefined', () => {
  const save = new SaveManager();
  const state = fixture('creative');
  state.duilt = null;
  state.worldId = 'w-plain';
  save.write(state);
  const loaded = save.read('w-plain');
  assert.equal(loaded.mode, 'creative');
  assert.equal(loaded.duilt, null);
});

test('a save written before Duilt existed still loads', () => {
  // Exactly what a version 2 payload looked like: no `duilt` key at all.
  store.set('voxelgame:world:old', JSON.stringify({
    version: 2, timestamp: 1, mode: 'creative', worldId: 'old', worldName: 'Old',
    world: new World({ sizeX: 16, sizeZ: 16, height: 16 }).serialize(),
    player: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 },
    gamification: { xp: 0 }, economy: {},
  }));
  const loaded = new SaveManager().read('old');
  assert.equal(loaded.duilt, null);
  assert.equal(loaded.mode, 'creative');
});

test('a world saved under the old name-keyed store comes across', () => {
  // A player mid-game when this changed: one __autosave__ and a named copy of
  // the same world. They are one world, and the later of the two wins.
  store.clear();
  const w = new World({ sizeX: 16, sizeZ: 16, height: 16 }).serialize();
  const payload = (at, name) => JSON.stringify({
    version: 3, timestamp: at, mode: 'duilt', worldId: 'w-old', worldName: name,
    world: w, player: { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 },
    gamification: { xp: 5 }, economy: {}, duilt: { territory: { age: 3 } },
  });
  store.set('voxelgame:saves', JSON.stringify(['__autosave__', 'a copy']));
  store.set('voxelgame:save:__autosave__', payload(200, 'Riverbend'));
  store.set('voxelgame:save:a copy', payload(100, 'Riverbend copy'));

  const save = new SaveManager();
  const list = save.list();
  assert.equal(list.length, 1, 'two names for one world is one world');
  assert.equal(list[0].id, 'w-old');
  assert.equal(list[0].name, 'Riverbend', 'the later save wins');
  assert.equal(list[0].age, 3);
  assert.equal(save.lastOpened(), 'w-old', 'and it is the one you were last in');
  assert.equal(save.read('w-old').duilt.territory.age, 3);

  // Running again must not duplicate anything.
  const again = new SaveManager();
  assert.equal(again.list().length, 1);
});

test('a save from before worlds had ids still becomes a world', () => {
  store.clear();
  store.set('voxelgame:saves', JSON.stringify(['__autosave__']));
  store.set('voxelgame:save:__autosave__', JSON.stringify({
    version: 2, timestamp: 7, mode: 'creative', worldName: 'Nameless',
    world: new World({ sizeX: 16, sizeZ: 16, height: 16 }).serialize(),
    player: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, gamification: {}, economy: {},
  }));
  const list = new SaveManager().list();
  assert.equal(list.length, 1);
  assert.ok(list[0].id, 'it is given an id so it has a handle at all');
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
