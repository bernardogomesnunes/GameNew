// Owner, 9 November: "I logged in my game on the desktop and lost all
// progress done in mobile." The desktop's older copy went up over the phone's
// newer save: an upload only warned when the account held a newer revision.
// It now refuses, at start-up (the unsent copy) and while playing (flush).
import assert from 'node:assert/strict';

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { Game, staleAgainst } = await import('../src/Game.js');
const { World } = await import('../src/world/World.js');

assert.equal(staleAgainst({ revision: 533 }, { revision: 400 }), true);
assert.equal(staleAgainst({ revision: 400 }, { revision: 400 }), false);
assert.equal(staleAgainst(null, { revision: 400 }), false);
assert.equal(staleAgainst({ revision: 2 }, null), false);
console.log('PASS the account copy counts as newer only past the revision this device last agreed');

function fake({ agreed, server = 533 }) {
  const g = {
    saves: 0, toasts: [], dropped: [],
    cloud: { signedIn: true, save: async () => { g.saves++; return { revision: server + 1 }; }, reportFailure: async () => {} },
    syncState: { agreedFor: () => agreed, agree() {} },
    async cloudList() { return [{ id: 'w1', revision: server }]; },
    dropSafeCopy(id) { g.dropped.push(id); },
    forgetCloudList() {},
    bus: { emit: (_, t) => g.toasts.push(t) },
  };
  return g;
}

// At start-up: an Age 8 copy put aside on the desktop at revision 400.
const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
store.clear();
store.set('voxelgame:unsent', JSON.stringify({ worldId: 'w1', name: 'Home', at: 1, state: { world: world.serialize(), mode: 'duilt' } }));
const old = fake({ agreed: { revision: 400 } });
assert.equal(await Game.prototype.sendUnsent.call(old), false);
assert.equal(old.saves, 0, 'the old copy is not uploaded');
assert.deepEqual(old.dropped, [], 'and it stays on this device');
assert.ok(old.toasts.some((t) => /older copy was not sent/.test(t.title)), 'and it says so');
console.log('PASS at start-up, an older copy is kept here, not sent over the newer save');

// The same copy, when nobody saved elsewhere, still goes up.
store.set('voxelgame:unsent', JSON.stringify({ worldId: 'w1', name: 'Home', at: 2, state: { world: world.serialize(), mode: 'duilt' } }));
const fine = fake({ agreed: { revision: 533 } });
assert.equal(await Game.prototype.sendUnsent.call(fine), true);
assert.equal(fine.saves, 1);
console.log('PASS a copy that is still the newest goes up as before');

// While playing: the world was opened at 400 here, then saved at 533 elsewhere.
const playing = fake({ agreed: { revision: 400 } });
let landed = 0, failed = null;
Object.assign(playing, {
  pendingSave: true, worldId: 'w1', worldName: 'Home',
  saveToCloud: async () => { playing.saves++; },
  uploadLanded: () => landed++, uploadFailed: (o) => { failed = o; },
  ui: null,
});
assert.equal(await Game.prototype.flush.call(playing), false);
assert.equal(playing.saves, 0, 'nothing goes up over the newer save');
assert.deepEqual(playing.dropped, [], 'the copy put aside stays');
assert.deepEqual(failed, { retry: false });
assert.match(playing.saveError, /That newer save is kept/);
console.log('PASS while playing, a world saved elsewhere since is not written over');
