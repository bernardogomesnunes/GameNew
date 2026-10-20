import assert from 'node:assert/strict';
import { Game } from '../src/Game.js';
import { World } from '../src/world/World.js';

let failures = 0;
async function check(name, run) {
  try { await run(); console.log('PASS ' + name); }
  catch (err) { failures++; console.log('FAIL ' + name + ': ' + err.message); }
}
function session({ rows = [], agreed = { revision: 2 }, error = null } = {}) {
  const calls = { lists: 0, saves: 0, drops: 0 };
  const game = {
    worldId: 'world-1', worldName: 'Home', pendingSave: true, discarded: false,
    cloud: { signedIn: true, reportFailure: async () => {} },
    syncState: { agreedFor: () => agreed },
    bus: { emit() {} },
    async cloudList() { calls.lists++; if (error) throw error; return rows; },
    async saveToCloud(name, options) { calls.saves++; calls.revision = options.revision; },
    dropSafeCopy() { calls.drops++; },
  };
  return { game, calls };
}
await check('missing known world keeps progress and remains retryable without uploads', async () => {
  const { game, calls } = session();
  assert.equal(await Game.prototype.flush.call(game), false);
  assert.equal(game.discarded, false);
  assert.equal(game.pendingSave, true);
  assert.equal(calls.drops, 0);
  assert.equal(calls.saves, 0);
  assert.equal(calls.lists, 1);
  assert.ok(game.saveError);
  game.cloudList = async () => [{ id: 'world-1', revision: 2 }];
  assert.equal(await Game.prototype.flush.call(game), true);
  assert.equal(calls.saves, 1);
  assert.equal(calls.revision, 3);
  assert.equal(game.saveError, null);
});
await check('new world can be saved when it has never existed on the account', async () => {
  const { game, calls } = session({ agreed: null });
  assert.equal(await Game.prototype.flush.call(game), true);
  assert.equal(calls.revision, 1);
});
await check('network or authentication error preserves pending progress', async () => {
  const { game, calls } = session({ error: new Error('Session expired') });
  assert.equal(await Game.prototype.flush.call(game), false);
  assert.equal(game.pendingSave, true);
  assert.equal(game.discarded, false);
  assert.equal(calls.drops, 0);
  assert.equal(calls.saves, 0);
});
await check('signed out or explicitly discarded sessions do no requests', async () => {
  for (const state of ['signedOut', 'discarded']) {
    const { game, calls } = session();
    if (state === 'signedOut') game.cloud.signedIn = false; else game.discarded = true;
    assert.equal(await Game.prototype.flush.call(game), false);
    assert.equal(calls.lists, 0);
  }
});
await check('concurrent flush calls share one list request and upload', async () => {
  const { game, calls } = session();
  let release;
  game.cloudList = () => { calls.lists++; return new Promise((resolve) => { release = resolve; }); };
  const first = Game.prototype.flush.call(game);
  const second = Game.prototype.flush.call(game);
  release([{ id: 'world-1', revision: 2 }]);
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(calls.lists, 1);
  assert.equal(calls.saves, 1);
});

const originalStorage = globalThis.localStorage;
try {
  await check('startup preserves missing-world backup before reconstructing terrain', async () => {
    // Invalid terrain deliberately proves the missing-world check runs first.
    const held = JSON.stringify({ worldId: 'world-1', state: { world: null } });
    let drops = 0, lists = 0;
    globalThis.localStorage = { getItem: () => held };
    const game = { cloud: { signedIn: true }, syncState: { agreedFor: () => ({ revision: 2 }) },
      async cloudList() { lists++; return []; }, dropSafeCopy() { drops++; } };
    assert.equal(await Game.prototype.sendUnsent.call(game), false);
    assert.equal(lists, 1);
    assert.equal(drops, 0);
  });
  await check('startup retries retained backup when world reappears', async () => {
    const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
    const held = JSON.stringify({ worldId: 'world-1', name: 'Home', state: { world: world.serialize(), mode: 'creative' } });
    let drops = 0, saves = 0;
    globalThis.localStorage = { getItem: () => held };
    const game = { cloud: { signedIn: true, async save(id, data) { saves++; assert.equal(data.revision, 3); return { revision: 3 }; } },
      syncState: { agreedFor: () => ({ revision: 2 }), agree() {} },
      async cloudList() { return [{ id: 'world-1', revision: 2 }]; }, dropSafeCopy() { drops++; }, forgetCloudList() {} };
    assert.equal(await Game.prototype.sendUnsent.call(game), true);
    assert.equal(saves, 1);
    assert.equal(drops, 1);
  });
} finally { if (originalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalStorage; }
process.exitCode = failures ? 1 : 0;
