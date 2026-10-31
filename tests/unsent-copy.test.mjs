/**
 * SAVE-7: a stored upload backup must not stall the game. The unsent copy is
 * sent once at a time, waits while a world opens, and stops by itself after
 * failing three times with the account answering.
 */
import assert from 'node:assert/strict';

let failures = 0;
async function check(name, fn) {
  try { await fn(); console.log('PASS ' + name); } catch (e) { failures++; console.log('FAIL ' + name + '\n  ' + e.message); }
}

globalThis.window ??= { addEventListener() {}, removeEventListener() {} };
const { Game } = await import('../src/Game.js');
const { World } = await import('../src/world/World.js');

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
function hold(extra = {}) {
  const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
  store.clear();
  store.set('voxelgame:unsent', JSON.stringify({ worldId: 'w1', name: 'Home', at: 1, state: { world: world.serialize(), mode: 'creative' }, ...extra }));
}
function fakeGame(save) {
  const g = {
    cloud: { signedIn: true, save },
    syncState: { agreedFor: () => null, agree() {} },
    lists: 0, toasts: [], dropped: [],
    async cloudList() { g.lists++; return [{ id: 'w1', revision: 1 }]; },
    dropSafeCopy(id) { g.dropped.push(id); },
    forgetCloudList() {},
    bus: { emit: (_, t) => g.toasts.push(t) },
  };
  return g;
}

await check('two callers share one send', async () => {
  hold();
  let saves = 0;
  const g = fakeGame(async () => { saves++; return { revision: 2 }; });
  const [a, b] = await Promise.all([Game.prototype.sendUnsent.call(g), Game.prototype.sendUnsent.call(g)]);
  assert.equal(a, true); assert.equal(b, true);
  assert.equal(saves, 1);
  assert.deepEqual(g.dropped, ['w1']);
});

await check('it waits while a world is opening', async () => {
  hold();
  let saves = 0;
  const g = fakeGame(async () => { saves++; return { revision: 2 }; });
  g.loadingWorld = 1;
  assert.equal(await Game.prototype.sendUnsent.call(g), false);
  assert.equal(saves, 0);
  assert.equal(g.lists, 0);
  clearTimeout(g.unsentTimer);
});

await check('no connection is not counted as a failed try', async () => {
  hold();
  const g = fakeGame(async () => { throw new Error('no'); });
  g.cloudList = async () => { throw new Error('offline'); };
  for (let i = 0; i < 5; i++) assert.equal(await Game.prototype.sendUnsent.call(g), false);
  assert.equal(store.get('voxelgame:unsent-tries'), undefined);
});

await check('three failed sends and it stops trying, keeping the copy', async () => {
  hold();
  let saves = 0;
  const g = fakeGame(async () => { saves++; throw new Error('server said no'); });
  for (let i = 0; i < 5; i++) assert.equal(await Game.prototype.sendUnsent.call(g), false);
  assert.equal(saves, 3);
  assert.equal(g.toasts.length, 1);
  assert.ok(store.has('voxelgame:unsent'), 'the copy stays on the device');
  assert.equal(g.dropped.length, 0);
});

await check('a newer copy of the world is tried again from zero', async () => {
  hold({ at: 2 });
  let saves = 0;
  const g = fakeGame(async () => { saves++; return { revision: 2 }; });
  assert.equal(await Game.prototype.sendUnsent.call(g), true);
  assert.equal(saves, 1);
  assert.equal(store.get('voxelgame:unsent-tries'), undefined);
});

await check('a copy that cannot be rebuilt counts as a failed try', async () => {
  hold({ state: { world: { broken: true }, mode: 'creative' } });
  const g = fakeGame(async () => ({ revision: 2 }));
  assert.equal(await Game.prototype.sendUnsent.call(g), false);
  assert.equal(JSON.parse(store.get('voxelgame:unsent-tries')).tries, 1);
});

await check('a caller waits at most 20 seconds', async () => {
  hold({ at: 3 });
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => realSetTimeout(fn, ms === 20_000 ? 5 : ms);
  try {
    const g = fakeGame(() => new Promise(() => {}));
    assert.equal(await Game.prototype.sendUnsent.call(g), false);
  } finally { globalThis.setTimeout = realSetTimeout; }
});

process.exitCode = failures ? 1 : 0;
