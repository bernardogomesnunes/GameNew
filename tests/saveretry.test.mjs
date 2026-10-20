/**
 * SAVE-4: "Failed uploads retry without telling you." Now a failed upload is
 * said once, tried again soon and on its own, and said again when it lands.
 *
 * SAVE-5: "The backup copy may not fit in the browser's small local storage
 * (about 5 MB) for a big world." Now a copy too big for it goes to IndexedDB,
 * and if even that fails, you're told.
 */

// --- a tiny IndexedDB, enough for storage/BackupStore.js ----------------------
const kept = new Map();
let broken = false;   // the device is out of room there too
globalThis.indexedDB = {
  open() {
    const req = {};
    queueMicrotask(() => {
      req.result = {
        createObjectStore() {},
        transaction() {
          const tx = {};
          const op = (fn) => {
            const r = {};
            queueMicrotask(() => { r.result = fn(); queueMicrotask(() => tx.oncomplete?.()); });
            return r;
          };
          tx.objectStore = () => ({
            put: (v, k) => {
              if (broken) { queueMicrotask(() => tx.onabort?.()); return {}; }
              return op(() => { kept.set(k, structuredClone(v)); });
            },
            get: (k) => op(() => kept.get(k)),
            delete: (k) => op(() => { kept.delete(k); }),
          });
          return tx;
        },
      };
      req.onupgradeneeded?.();
      req.onsuccess?.();
    });
    return req;
  },
};
globalThis.window ??= { addEventListener() {}, removeEventListener() {} };

const { Game } = await import('../src/Game.js');
const { World } = await import('../src/world/World.js');
const { getBackup } = await import('../src/storage/BackupStore.js');

let f = 0;
const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) f++; };
const settle = () => new Promise((r) => setTimeout(r, 0));

// --- SAVE-4 --------------------------------------------------------------------
const waits = [];
const realSetTimeout = globalThis.setTimeout, realClear = globalThis.clearTimeout;
globalThis.setTimeout = (fn, ms) => { waits.push(ms); return waits.length; };
globalThis.clearTimeout = () => {};
try {
  const toasts = [];
  const g = { saveError: 'The account did not answer.', bus: { emit: (_, t) => toasts.push(t) }, flush: async () => false };
  Game.prototype.uploadFailed.call(g);
  Game.prototype.uploadFailed.call(g);
  Game.prototype.uploadFailed.call(g);
  ok(`a failed upload is said once, not on every try (${toasts.length})`, toasts.length === 1 && /Not saved to your account yet/.test(toasts[0].title));
  ok('  saying why, and that it is kept and tried again', /did not answer/.test(toasts[0].body) && /kept on this device/.test(toasts[0].body) && /tries again/.test(toasts[0].body));
  ok(`tried again soon, then less often (${waits.join(', ')} ms)`, waits[0] === 30_000 && waits[1] === 60_000 && waits[2] === 120_000);
  for (let i = 0; i < 6; i++) Game.prototype.uploadFailed.call(g);
  ok('  never longer apart than five minutes', waits.at(-1) === 5 * 60_000);
  Game.prototype.uploadLanded.call(g);
  ok('when it lands, it says so', toasts.length === 2 && /Saved to your account/.test(toasts[1].title));
  ok('  and the next failure starts again from half a minute', (Game.prototype.uploadFailed.call(g), waits.at(-1) === 30_000 && toasts.length === 3));

  const quiet = [];
  const h = { saveError: 'x', bus: { emit: (_, t) => quiet.push(t) }, flush: async () => false };
  Game.prototype.uploadLanded.call(h);
  ok('an ordinary save that lands says nothing', quiet.length === 0);
  h.savingByHand = true;
  Game.prototype.uploadFailed.call(h);
  ok('a Save pressed by hand says how it went itself, so no second message', quiet.length === 0);
  h.savingByHand = false;
  Game.prototype.uploadLanded.call(h);
  ok('  but a try after it that lands still says so', quiet.length === 1);

  const before = waits.length;
  const m = { saveError: 'This world was not found in the current account.', bus: { emit: (_, t) => quiet.push(t) } };
  Game.prototype.uploadFailed.call(m, { retry: false });
  ok('a world missing from the account is said, but not tried again by itself', waits.length === before && quiet.at(-1).body === m.saveError);
} finally {
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClear;
}

// --- SAVE-5 --------------------------------------------------------------------
const world = new World({ sizeX: 16, sizeZ: 16, height: 16 });
world.setBlock(3, 3, 3, 1);
const store = new Map();
let full = false;
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => { if (full) throw new Error('QuotaExceededError'); store.set(k, v); },
  removeItem: (k) => store.delete(k),
};
const toasts = [];
const game = {
  worldId: 'world-1', worldName: 'Test world 1',
  saveState: () => ({ world, mode: 'creative', economy: null, duilt: null }),
  bus: { emit: (_, t) => toasts.push(t) },
};

Game.prototype.keepSafe.call(game);
await settle();
ok('a copy that fits goes to localStorage, as before', store.has('voxelgame:unsent') && !kept.size);

full = true;
world.setBlock(4, 3, 3, 1);
Game.prototype.keepSafe.call(game);
for (let i = 0; i < 5; i++) await settle();
const big = await getBackup();
ok('one too big for it goes to the bigger store', big?.worldId === 'world-1' && big.state?.world);
ok('  and the older copy in localStorage goes, so it is never sent in its place', !store.has('voxelgame:unsent'));
ok('  without a word: nothing is wrong', !toasts.length);

let sent = null;
const starting = {
  cloud: { signedIn: true, async save(id, data) { sent = { id, world: data.world }; return { revision: 1 }; } },
  syncState: { agreedFor: () => null, agree() {} },
  async cloudList() { return []; },
  dropSafeCopy() { Game.prototype.dropSafeCopy.call(this); },
  forgetCloudList() {},
};
ok('it goes up when the game next starts', await Game.prototype.sendUnsent.call(starting) && sent?.id === 'world-1'
  && sent.world.getBlock(4, 3, 3) === 1);
await settle(); await settle();
ok('  and is thrown away once it has', !(await getBackup()));

full = false;
Game.prototype.keepSafe.call(game);
await settle();
full = true;
broken = true;
Game.prototype.keepSafe.call(game);
for (let i = 0; i < 5; i++) await settle();
ok('when it fits nowhere, you are told', toasts.length === 1 && /No backup on this device/.test(toasts[0].title));
Game.prototype.keepSafe.call(game);
for (let i = 0; i < 5; i++) await settle();
ok('  once, not on every save', toasts.length === 1);

process.exit(f ? 1 : 0);
